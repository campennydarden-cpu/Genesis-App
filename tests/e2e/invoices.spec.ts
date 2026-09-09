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

test.afterAll(async () => {
  await deleteTrackedOrders()
})

test('nav shows Invoices under Title group', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/order-entry`)
  const titleGroup = page.locator('div', { has: page.getByText('Title', { exact: true }) }).first()
  await expect(titleGroup.getByRole('link', { name: 'Invoices' })).toBeVisible()
})

test('add invoice, edit fields, autosave persists after reload', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/invoices`)
  await expect(page.getByText('No invoices yet.')).toBeVisible()

  await page.getByRole('button', { name: '+ Add Invoice' }).click()
  const card = page.getByTestId('invoice-list').locator('[data-testid^="invoice-"]').first()
  await expect(card).toBeVisible()
  await expect(card.locator('input[name="invoice_number"]')).not.toHaveValue('')

  await card.locator('select[name="status"]').selectOption('Sent')
  await card.locator('input[name="message"]').fill('Test invoice message')
  await card.locator('input[name="message"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedCard = page.getByTestId('invoice-list').locator('[data-testid^="invoice-"]').first()
  await expect(reloadedCard.locator('select[name="status"]')).toHaveValue('Sent')
})

test('generate line items from bill-coded splits, then remove invoice', async ({ page }) => {
  const orderId = await createOrder(page)

  await page.goto(`/orders/${orderId}/premiums`)
  await page.getByRole('button', { name: '+ Add Policy' }).click()
  const premiumCard = page.getByTestId('premium-list').locator('[data-testid^="premium-"]').first()
  await premiumCard.locator('select[name="policy_type"]').selectOption("Owner's")
  await premiumCard.locator('input[name="bill_code"]').fill('OP-1')
  await premiumCard.locator('input[name="bill_code"]').blur()
  await expect(page.getByText('Saved').first()).toBeVisible()

  await premiumCard.getByRole('button', { name: '+ Add Split' }).click()
  const splitRow = premiumCard.locator('form').filter({ has: page.locator('select[name="bill_code"]') }).first()
  await splitRow.locator('select[name="bill_code"]').selectOption('CLOSE')
  await splitRow.locator('input[name="amount"]').fill('100')
  await splitRow.locator('input[name="amount"]').blur()
  await expect(page.getByText('Saved').first()).toBeVisible()

  await page.goto(`/orders/${orderId}/invoices`)
  await page.getByRole('button', { name: '+ Add Invoice' }).click()
  const invoiceCard = page.getByTestId('invoice-list').locator('[data-testid^="invoice-"]').first()
  await invoiceCard.getByRole('button', { name: '+ Add Lines from Bill Codes' }).click()

  const lineRow = invoiceCard.locator('[data-testid^="invoice-line-"]').first()
  await expect(lineRow).toBeVisible()
  await expect(lineRow.locator('select[name="bill_code"]')).toHaveValue('CLOSE')
  await expect(lineRow.locator('input[name="amount"]')).toHaveValue('100')

  await invoiceCard.getByRole('button', { name: 'Remove invoice' }).click()
  await expect(page.getByText('No invoices yet.')).toBeVisible()
})
