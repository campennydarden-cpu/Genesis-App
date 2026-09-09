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

test('nav shows Additional Charges under Escrow / Closing group', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/order-entry`)
  const group = page.locator('div', { has: page.getByText('Escrow / Closing', { exact: true }) }).first()
  await expect(group.getByRole('link', { name: 'Additional Charges' })).toBeVisible()
})

test('add charge, edit fields, autosave persists after reload', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/additional-charges`)

  await page.getByRole('button', { name: '+ Add Charge' }).click()
  await expect(page.getByTestId('charge-list').locator('[data-testid^="charge-"]')).toHaveCount(1)

  const row = page.getByTestId('charge-list').locator('[data-testid^="charge-"]').first()
  await row.locator('select[name="bill_code"]').selectOption('CLOSE')
  await row.locator('input[name="description"]').fill('Notary Fee')
  await row.locator('input[name="charge"]').fill('150')
  await row.locator('input[name="charge"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedRow = page.getByTestId('charge-list').locator('[data-testid^="charge-"]').first()
  await expect(reloadedRow.locator('input[name="description"]')).toHaveValue('Notary Fee')
  await expect(reloadedRow.locator('input[name="charge"]')).toHaveValue('150')
  await expect(reloadedRow.locator('select[name="bill_code"]')).toHaveValue('CLOSE')
})

test('add split under a charge', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/additional-charges`)
  await page.getByRole('button', { name: '+ Add Charge' }).click()

  const row = page.getByTestId('charge-list').locator('[data-testid^="charge-"]').first()
  await row.getByRole('button', { name: '+ Add Split' }).click()
  await expect(row.locator('select[name="basis"]')).toHaveCount(1)

  await row.locator('select[name="basis"]').selectOption('Fixed Amount')
  await row.locator('input[name="amount"]').fill('25')
  await row.locator('input[name="amount"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedRow = page.getByTestId('charge-list').locator('[data-testid^="charge-"]').first()
  await expect(reloadedRow.locator('select[name="basis"]')).toHaveValue('Fixed Amount')
  await expect(reloadedRow.locator('input[name="amount"]')).toHaveValue('25')
})

test('delete charge removes row', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/additional-charges`)
  await page.getByRole('button', { name: '+ Add Charge' }).click()
  await expect(page.getByTestId('charge-list').locator('[data-testid^="charge-"]')).toHaveCount(1)

  await Promise.all([page.waitForNavigation(), page.getByRole('button', { name: 'Remove charge' }).click()])
  await expect(page.getByText('No charges yet.')).toBeVisible()
})
