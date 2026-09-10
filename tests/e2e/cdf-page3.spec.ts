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

test('nav shows CDF Page 3 under Escrow / Closing group', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/order-entry`)
  const group = page.locator('div', { has: page.getByText('Escrow / Closing', { exact: true }) }).first()
  await expect(group.getByRole('link', { name: 'CDF Page 3' })).toBeVisible()
})

test('Calculating Cash to Close fields persist after reload', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-3`)

  const form = page.getByTestId('cdf-cash-to-close-form')
  await form.locator('select[name="loan_amount_changed"]').selectOption('Yes')
  await form.locator('#loan_amount_final').fill('227920')
  await form.locator('#loan_amount_final').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedForm = page.getByTestId('cdf-cash-to-close-form')
  await expect(reloadedForm.locator('input[name="loan_amount_final"]')).toHaveValue('227920')
  await expect(reloadedForm.locator('select[name="loan_amount_changed"]')).toHaveValue('Yes')
})

test('add K. Payoffs and Payments item, edit, autosave persists, delete', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-3`)

  await page.getByRole('button', { name: '+ Add Item' }).first().click()
  await expect(page.getByTestId('cdf-payoffs-list').locator('[data-testid^="cdf-payoff-"]')).toHaveCount(1)

  const row = page.getByTestId('cdf-payoffs-list').locator('[data-testid^="cdf-payoff-"]').first()
  await row.locator('input[name="description"]').fill('Payoff of First Mortgage Loan')
  await row.getByLabel('Amount').fill('185000')
  await row.getByLabel('Amount').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedRow = page.getByTestId('cdf-payoffs-list').locator('[data-testid^="cdf-payoff-"]').first()
  await expect(reloadedRow.locator('input[name="description"]')).toHaveValue('Payoff of First Mortgage Loan')
  await expect(reloadedRow.locator('input[name="amount"]')).toHaveValue('185000')

  await Promise.all([page.waitForNavigation(), reloadedRow.getByRole('button', { name: 'Remove item' }).click()])
  await expect(page.getByTestId('cdf-payoffs-list').getByText('No items yet.')).toBeVisible()
})

test('add Summaries of Transactions item under Borrower, autosave persists', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-3`)

  const section = page.getByTestId('cdf-summary-borrower-due_from_at_closing')
  await section.getByRole('button', { name: '+ Add Item' }).click()

  const line = section.getByTestId('cdf-summary-borrower-due_from_at_closing-list').locator('[data-testid^="cdf-summary-line-"]').first()
  await expect(line).toBeVisible()
  await line.locator('input[name="description"]').fill('Sale Price of Property')
  await line.getByLabel('Amount').fill('245000')
  await line.getByLabel('Amount').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedSection = page.getByTestId('cdf-summary-borrower-due_from_at_closing')
  const reloadedLine = reloadedSection
    .getByTestId('cdf-summary-borrower-due_from_at_closing-list')
    .locator('[data-testid^="cdf-summary-line-"]')
    .first()
  await expect(reloadedLine.locator('input[name="description"]')).toHaveValue('Sale Price of Property')
  await expect(reloadedLine.locator('input[name="amount"]')).toHaveValue('245000')
})
