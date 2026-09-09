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

test('nav shows Tax/Other Prorations under Escrow / Closing group', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/order-entry`)
  const group = page.locator('div', { has: page.getByText('Escrow / Closing', { exact: true }) }).first()
  await expect(group.getByRole('link', { name: 'Tax/Other Prorations' })).toBeVisible()
})

test('add item, Calculate button computes buyer proration correctly, persists after reload', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/tax-prorations`)

  await page.getByRole('button', { name: '+ Add Item' }).click()
  await expect(page.getByTestId('proration-list').locator('[data-testid^="proration-"]')).toHaveCount(1)

  const row = page.getByTestId('proration-list').locator('[data-testid^="proration-"]').first()
  await row.locator('input[name="description"]').fill('County Taxes')
  await row.locator('select[name="category"]').selectOption('County Tax')
  await row.locator('input[name="share_of_amount"]').fill('3650')
  await row.locator('select[name="compute_for"]').selectOption('Buyer')
  await row.locator('input[name="period_from"]').fill('2026-01-01')
  await row.locator('input[name="period_to"]').fill('2026-12-31')
  await row.locator('input[name="proration_date"]').fill('2026-07-01')

  await row.getByRole('button', { name: 'Calculate' }).click()
  await expect(page.getByText('Saved')).toBeVisible()

  await expect(row.locator('input[name="days_in_period"]')).toHaveValue('365')
  await expect(row.locator('input[name="days_prorated"]')).toHaveValue('184')
  await expect(row.locator('input[name="prorated_amount"]')).toHaveValue('1840')

  await page.reload()
  const reloadedRow = page.getByTestId('proration-list').locator('[data-testid^="proration-"]').first()
  await expect(reloadedRow.locator('input[name="description"]')).toHaveValue('County Taxes')
  await expect(reloadedRow.locator('input[name="days_prorated"]')).toHaveValue('184')
  await expect(reloadedRow.locator('input[name="prorated_amount"]')).toHaveValue('1840')
})

test('computed fields stay manually editable after Calculate', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/tax-prorations`)
  await page.getByRole('button', { name: '+ Add Item' }).click()

  const row = page.getByTestId('proration-list').locator('[data-testid^="proration-"]').first()
  await row.locator('input[name="share_of_amount"]').fill('1200')
  await row.locator('select[name="compute_for"]').selectOption('Seller')
  await row.locator('input[name="period_from"]').fill('2026-01-01')
  await row.locator('input[name="period_to"]').fill('2026-12-31')
  await row.locator('input[name="proration_date"]').fill('2026-07-01')
  await row.getByRole('button', { name: 'Calculate' }).click()
  await expect(page.getByText('Saved')).toBeVisible()

  await row.locator('input[name="prorated_amount"]').fill('999.99')
  await row.locator('input[name="prorated_amount"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedRow = page.getByTestId('proration-list').locator('[data-testid^="proration-"]').first()
  await expect(reloadedRow.locator('input[name="prorated_amount"]')).toHaveValue('999.99')
})

test('delete item removes row', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/tax-prorations`)
  await page.getByRole('button', { name: '+ Add Item' }).click()
  await expect(page.getByTestId('proration-list').locator('[data-testid^="proration-"]')).toHaveCount(1)

  await Promise.all([page.waitForNavigation(), page.getByRole('button', { name: 'Remove item' }).click()])
  await expect(page.getByText('No tax or proration items yet.')).toBeVisible()
})
