import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hlahrypglnmjjxrdtfkm.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsYWhyeXBnbG5tamp4cmR0ZmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MzYyMDEsImV4cCI6MjEwMzMxMjIwMX0.dhgrZ8ei_NY2wG6bs6Ah--AHPEagl36gI7tcAX8llsY'
const SEEDED_EMAIL = 'genesis-e2e-seed@genesis-app-e2e-test.dev'
const SEEDED_PASSWORD = 'E2eSeedPass123!'

const createdOrderIds = new Set<string>()

async function deleteTrackedOrders() {
  if (createdOrderIds.size === 0) return
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: SEEDED_EMAIL,
    password: SEEDED_PASSWORD,
  })
  if (authError) {
    console.error('deleteTrackedOrders auth failed:', authError)
    return
  }
  await supabase.from('orders').delete().in('id', [...createdOrderIds])
}

async function loginAsSeededUser(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(SEEDED_EMAIL)
  await page.getByLabel('Password').fill(SEEDED_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/orders')
}

async function createOrder(page: Page): Promise<string> {
  await loginAsSeededUser(page)
  await page.getByRole('link', { name: '+ New Order' }).click()
  await page.getByRole('button', { name: 'Create Order' }).click()
  await page.waitForURL('**/orders/**/order-entry')
  const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1] as string
  createdOrderIds.add(orderId)
  return orderId
}

async function setOrderFields(orderId: string, fields: Record<string, unknown>) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  await supabase.auth.signInWithPassword({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD })
  await supabase.from('orders').update(fields).eq('id', orderId)
}

test.afterAll(async () => {
  await deleteTrackedOrders()
})

test('nav shows Recording under Escrow / Closing group', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/order-entry`)
  const group = page.locator('div', { has: page.getByText('Escrow / Closing', { exact: true }) }).first()
  await expect(group.getByRole('link', { name: 'Recording' })).toBeVisible()
})

test('add recording document, edit, autosave persists, delete', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/recording`)

  await page.getByRole('button', { name: '+ Add Document' }).click()
  await expect(page.getByTestId('recording-doc-list').locator('[data-testid^="recording-doc-"]')).toHaveCount(1)

  const row = page.getByTestId('recording-doc-list').locator('[data-testid^="recording-doc-"]').first()
  await row.locator('select[name="document_description"]').selectOption('Deed')
  await row.locator('select[name="status"]').selectOption('Recorded')
  await row.locator('input[name="instrument_number"]').fill('2026-000123')
  await row.locator('input[name="instrument_number"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedRow = page.getByTestId('recording-doc-list').locator('[data-testid^="recording-doc-"]').first()
  await expect(reloadedRow.locator('select[name="document_description"]')).toHaveValue('Deed')
  await expect(reloadedRow.locator('select[name="status"]')).toHaveValue('Recorded')
  await expect(reloadedRow.locator('input[name="instrument_number"]')).toHaveValue('2026-000123')

  await Promise.all([page.waitForNavigation(), reloadedRow.getByRole('button', { name: 'Remove document' }).click()])
  await expect(page.getByTestId('recording-doc-list').getByText('No documents yet.')).toBeVisible()
})

test('Recording Fee, Recordation/Transfer Tax, and Stamp Tax auto-sum into fixed CDF Page 2 Section E lines, split by Seller Pay %', async ({
  page,
}) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/recording`)

  await page.getByRole('button', { name: '+ Add Document' }).click()
  const row = page.getByTestId('recording-doc-list').locator('[data-testid^="recording-doc-"]').first()
  await row.getByLabel('Recording Fee').fill('100')
  await row.getByLabel('Recordation Tax').fill('50')
  await row.getByLabel('Transfer Tax').fill('25')
  await row.getByLabel('Stamp Tax').fill('10')
  await row.locator('input[name="seller_pay_percent"]').fill('50')
  await row.locator('input[name="seller_pay_percent"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.goto(`/orders/${orderId}/cdf-page-2`)
  const feeLine = page.getByTestId('cdf-section-E-fixed').filter({ hasText: 'Recording Fees' })
  await expect(feeLine).toContainText('$50.00') // half of $100, Borrower
  const taxLine = page.getByTestId('cdf-section-E-fixed').filter({ hasText: 'Recordation/Transfer Tax' })
  await expect(taxLine).toContainText('$37.50') // half of ($50 + $25)
  const stampLine = page.getByTestId('cdf-section-E-fixed').filter({ hasText: 'Stamp Tax' })
  await expect(stampLine).toContainText('$5.00') // half of $10

  // Removing the document zeroes the totals rather than deleting the fixed lines.
  await page.goto(`/orders/${orderId}/recording`)
  await Promise.all([page.waitForNavigation(), page.getByRole('button', { name: 'Remove document' }).click()])
  await expect(page.getByTestId('recording-doc-list').getByText('No documents yet.')).toBeVisible()

  await page.goto(`/orders/${orderId}/cdf-page-2`)
  await expect(page.getByTestId('cdf-section-E-fixed').filter({ hasText: 'Recording Fees' })).toContainText('$0.00')
})

test('Recording Fee and Transfer Tax auto-fill from the state rate tables on Deed document type', async ({ page }) => {
  const orderId = await createOrder(page)
  await setOrderFields(orderId, { property_state: 'GA', purchase_price: 200000 })
  await page.goto(`/orders/${orderId}/recording`)

  await page.getByRole('button', { name: '+ Add Document' }).click()
  const row = page.getByTestId('recording-doc-list').locator('[data-testid^="recording-doc-"]').first()
  const docSelect = row.locator('select[name="document_description"]')
  // selectOption() alone doesn't focus the element the way a real click does, so a
  // trailing .blur() is a no-op (nothing was ever focused to blur) -- focus first so the
  // subsequent blur actually fires the field's onBlur.
  await docSelect.focus()
  await docSelect.selectOption('Deed')
  await Promise.all([page.waitForNavigation(), docSelect.blur()])

  const reloadedRow = page.getByTestId('recording-doc-list').locator('[data-testid^="recording-doc-"]').first()
  await expect(reloadedRow.getByLabel('Recording Fee')).toHaveValue('$25.00') // GA flat Deed fee
  await expect(reloadedRow.getByLabel('Transfer Tax')).toHaveValue('$200.00') // GA: $200,000 / 100 * $0.10
})
