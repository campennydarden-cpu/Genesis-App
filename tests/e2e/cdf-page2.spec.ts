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

test('nav shows CDF Page 2 under Escrow / Closing group', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/order-entry`)
  const group = page.locator('div', { has: page.getByText('Escrow / Closing', { exact: true }) }).first()
  await expect(group.getByRole('link', { name: 'CDF Page 2' })).toBeVisible()
})

test('add item to section A, edit fields, autosave persists after reload', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-2`)

  await page.getByTestId('cdf-section-A').getByRole('button', { name: '+ Add Item' }).click()
  await expect(page.getByTestId('cdf-section-A-list').locator('[data-testid^="cdf-line-"]')).toHaveCount(1)

  const row = page.getByTestId('cdf-section-A-list').locator('[data-testid^="cdf-line-"]').first()
  await row.locator('input[name="description"]').fill('Origination Fee')
  await row.locator('input[name="borrower_paid_at_closing"]').fill('500')
  await row.locator('input[name="borrower_paid_at_closing"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedRow = page.getByTestId('cdf-section-A-list').locator('[data-testid^="cdf-line-"]').first()
  await expect(reloadedRow.locator('input[name="description"]')).toHaveValue('Origination Fee')
  await expect(reloadedRow.locator('input[name="borrower_paid_at_closing"]')).toHaveValue('500')
})

test('section subtotals and grand total compute correctly across sections and columns', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-2`)

  await page.getByTestId('cdf-section-A').getByRole('button', { name: '+ Add Item' }).click()
  const rowA = page.getByTestId('cdf-section-A-list').locator('[data-testid^="cdf-line-"]').first()
  await rowA.locator('input[name="borrower_paid_at_closing"]').fill('500')
  await rowA.locator('input[name="borrower_paid_at_closing"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.getByTestId('cdf-section-E').getByRole('button', { name: '+ Add Item' }).click()
  const rowE = page.getByTestId('cdf-section-E-list').locator('[data-testid^="cdf-line-"]').first()
  await rowE.locator('input[name="borrower_paid_at_closing"]').fill('271')
  await rowE.locator('input[name="seller_paid_at_closing"]').fill('50')
  await rowE.locator('input[name="seller_paid_at_closing"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()

  // D = A + B + C = 500 (borrower-only subtotal)
  await expect(page.getByTestId('cdf-subtotal-d')).toContainText('$500.00')
  // I = E + F + G + H = 271 borrower, 50 seller
  const iRow = page.getByTestId('cdf-subtotal-i')
  await expect(iRow).toContainText('$271.00')
  await expect(iRow).toContainText('$50.00')
  // J = D + I = 771 borrower, 50 seller
  const jRow = page.getByTestId('cdf-subtotal-j')
  await expect(jRow).toContainText('$771.00')
  await expect(jRow).toContainText('$50.00')
})

test('seller-paid amount entered on a Loan Cost row (section A) does not leak into D or J', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-2`)

  await page.getByTestId('cdf-section-A').getByRole('button', { name: '+ Add Item' }).click()
  const row = page.getByTestId('cdf-section-A-list').locator('[data-testid^="cdf-line-"]').first()
  await row.locator('input[name="borrower_paid_at_closing"]').fill('500')
  await row.locator('input[name="seller_paid_at_closing"]').fill('500')
  await row.locator('input[name="seller_paid_at_closing"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()

  // D has no seller column on the real CD form — the seller amount stays on the line
  // itself but must not be folded into D's (or J's) totals.
  await expect(page.getByTestId('cdf-subtotal-d')).toContainText('$500.00')
  await expect(page.getByTestId('cdf-subtotal-j')).toContainText('$500.00')
  await expect(page.getByTestId('cdf-subtotal-j')).not.toContainText('$1,000.00')
})

test('delete item removes row and recomputes totals', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-2`)

  await page.getByTestId('cdf-section-B').getByRole('button', { name: '+ Add Item' }).click()
  const row = page.getByTestId('cdf-section-B-list').locator('[data-testid^="cdf-line-"]').first()
  await row.locator('input[name="borrower_paid_at_closing"]').fill('100')
  await row.locator('input[name="borrower_paid_at_closing"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()

  await expect(page.getByTestId('cdf-subtotal-d')).toContainText('$100.00')

  await Promise.all([
    page.waitForNavigation(),
    page.getByTestId('cdf-section-B-list').getByRole('button', { name: 'Remove item' }).click(),
  ])
  await expect(page.getByTestId('cdf-section-B-list').getByText('No items yet.')).toBeVisible()
  await expect(page.getByTestId('cdf-subtotal-d')).toContainText('$0.00')
})

test('Section A shows a fixed, non-removable Points line with a working percent calculation', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-2`)

  const fixedRow = page.getByTestId('cdf-section-A-fixed')
  await expect(fixedRow.locator('input[name="description"]')).toHaveValue('% of Loan Amount (Points)')
  await expect(fixedRow.getByRole('button', { name: 'Remove item' })).toHaveCount(0)

  // New order has no loan amount yet, so the computed total is just the adjustment.
  await fixedRow.getByLabel('Points Percent').fill('1')
  await fixedRow.locator('input[name="points_adjustment"]').fill('25.5')
  await fixedRow.locator('input[name="points_adjustment_for"]').fill('rounding true-up')
  await fixedRow.locator('input[name="points_adjustment_for"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()
  await expect(fixedRow).toContainText('$25.50')

  await page.reload()
  const reloadedRow = page.getByTestId('cdf-section-A-fixed')
  await expect(reloadedRow.getByLabel('Points Percent')).toHaveValue('1')
  await expect(reloadedRow.locator('input[name="points_adjustment_for"]')).toHaveValue('rounding true-up')
})

test('Section J shows a fixed Closing Costs Subtotal line and an editable Lender Credits line that reduces the grand total', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-2`)

  await page.getByTestId('cdf-section-A').getByRole('button', { name: '+ Add Item' }).click()
  const rowA = page.getByTestId('cdf-section-A-list').locator('[data-testid^="cdf-line-"]').first()
  await rowA.locator('input[name="borrower_paid_at_closing"]').fill('1000')
  await rowA.locator('input[name="borrower_paid_at_closing"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await expect(page.getByTestId('cdf-subtotal-j-subtotal')).toContainText('$1,000.00')
  await expect(page.getByTestId('cdf-subtotal-j')).toContainText('$1,000.00')

  const lenderCreditsRow = page.getByTestId('cdf-section-J-fixed')
  await expect(lenderCreditsRow.locator('input[name="description"]')).toHaveValue('Lender Credits')
  await expect(lenderCreditsRow.getByRole('button', { name: 'Remove item' })).toHaveCount(0)

  await lenderCreditsRow.locator('input[name="borrower_paid_at_closing"]').fill('-150')
  await lenderCreditsRow.locator('input[name="borrower_paid_at_closing"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()

  // Line 1 (Closing Costs Subtotal, D+I) stays at 1000; the grand total drops by the credit.
  await expect(page.getByTestId('cdf-subtotal-j-subtotal')).toContainText('$1,000.00')
  await expect(page.getByTestId('cdf-subtotal-j')).toContainText('$850.00')
})

test('Section G shows a fixed, non-removable Aggregate Adjustment line after any added items', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-2`)

  const fixedRow = page.getByTestId('cdf-section-G-fixed')
  await expect(fixedRow.locator('input[name="description"]')).toHaveValue('Aggregate Adjustment')
  await expect(fixedRow.getByRole('button', { name: 'Remove item' })).toHaveCount(0)

  await page.getByTestId('cdf-section-G').getByRole('button', { name: '+ Add Item' }).click()
  await expect(page.getByTestId('cdf-section-G-list').locator('[data-testid^="cdf-line-"]')).toHaveCount(1)
  await expect(page.getByTestId('cdf-section-G-fixed')).toBeVisible()
})

test('Section G regular items show a Per Month / Months calculation, not shown on the fixed Aggregate Adjustment line', async ({
  page,
}) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-2`)

  await page.getByTestId('cdf-section-G').getByRole('button', { name: '+ Add Item' }).click()
  const row = page.getByTestId('cdf-section-G-list').locator('[data-testid^="cdf-line-"]').first()
  await row.locator('input[name="per_month"]').fill('100')
  await row.locator('input[name="months"]').fill('3')
  await row.locator('input[name="months"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()
  await expect(row).toContainText('$300.00')

  // The fixed Aggregate Adjustment row has no Per Month / Months config.
  await expect(page.getByTestId('cdf-section-G-fixed').locator('input[name="per_month"]')).toHaveCount(0)

  await page.reload()
  const reloadedRow = page.getByTestId('cdf-section-G-list').locator('[data-testid^="cdf-line-"]').first()
  await expect(reloadedRow.locator('input[name="per_month"]')).toHaveValue('100')
  await expect(reloadedRow.locator('input[name="months"]')).toHaveValue('3')
})
