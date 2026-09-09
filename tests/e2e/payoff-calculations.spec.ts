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

test('nav shows Payoff Calculations under Escrow / Closing group', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/order-entry`)
  const group = page.locator('div', { has: page.getByText('Escrow / Closing', { exact: true }) }).first()
  await expect(group.getByRole('link', { name: 'Payoff Calculations' })).toBeVisible()
})

test('empty state points at CDF Page 3 when no payoffs exist', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/payoff-calculations`)
  await expect(page.getByText('No payoffs yet. Add one on CDF Page 3.')).toBeVisible()
})

test('fill calculation detail and additional charge for a CDF Page 3 payoff, autosave persists', async ({ page }) => {
  const orderId = await createOrder(page)

  await page.goto(`/orders/${orderId}/cdf-page-3`)
  await page.getByRole('button', { name: '+ Add Item' }).first().click()
  const payoffRow = page.getByTestId('cdf-payoffs-list').locator('[data-testid^="cdf-payoff-"]').first()
  await payoffRow.locator('input[name="description"]').fill('Payoff of First Mortgage Loan')
  await payoffRow.locator('input[name="description"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.goto(`/orders/${orderId}/payoff-calculations`)
  const card = page.getByTestId('payoff-calculations-panel').locator('[data-testid^="payoff-calc-"]').first()
  await expect(card.getByText('Payoff of First Mortgage Loan')).toBeVisible()

  await card.locator('input[name="principal_balance"]').fill('182500')
  await card.locator('input[name="interest_rate"]').fill('4.25')
  await card.locator('input[name="interest_rate"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await card.getByRole('button', { name: '+ Add Charge' }).click()
  const chargeRow = card.locator('[data-testid^="payoff-charge-"]').first()
  await chargeRow.locator('input[name="description"]').fill('Recording fee for release')
  await chargeRow.locator('input[name="fee"]').fill('35')
  await chargeRow.locator('input[name="fee"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedCard = page.getByTestId('payoff-calculations-panel').locator('[data-testid^="payoff-calc-"]').first()
  await expect(reloadedCard.locator('input[name="principal_balance"]')).toHaveValue('182500')
  await expect(reloadedCard.locator('input[name="interest_rate"]')).toHaveValue('4.25')
  const reloadedChargeRow = reloadedCard.locator('[data-testid^="payoff-charge-"]').first()
  await expect(reloadedChargeRow.locator('input[name="description"]')).toHaveValue('Recording fee for release')
  await expect(reloadedChargeRow.locator('input[name="fee"]')).toHaveValue('35')
})
