import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hlahrypglnmjjxrdtfkm.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsYWhyeXBnbG5tamp4cmR0ZmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MzYyMDEsImV4cCI6MjEwMzMxMjIwMX0.dhgrZ8ei_NY2wG6bs6Ah--AHPEagl36gI7tcAX8llsY'
const SEEDED_EMAIL = 'genesis-e2e-seed@genesis-app-e2e-test.dev'
const SEEDED_PASSWORD = 'E2eSeedPass123!'

// Distinctive value so the assertion proves the seeded amount came from THIS
// order's loan_amount, not a coincidental default.
const TEST_LOAN_AMOUNT = 437500

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

// Creates a throwaway order via the UI, then sets its loan_amount directly so
// the seeding assertion below has a known, distinctive value to check against
// instead of just asserting non-emptiness.
async function createOrderWithLoanAmount(page: Page): Promise<string> {
  await loginAsSeededUser(page)
  await page.getByRole('link', { name: '+ New Order' }).click()
  await page.getByRole('button', { name: 'Create Order' }).click()
  await page.waitForURL('**/orders/**/order-entry')
  const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1] as string
  createdOrderIds.add(orderId)

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: SEEDED_EMAIL,
    password: SEEDED_PASSWORD,
  })
  if (authError) throw new Error(`createOrderWithLoanAmount auth failed: ${authError.message}`)
  const { error } = await supabase.from('orders').update({ loan_amount: TEST_LOAN_AMOUNT }).eq('id', orderId)
  if (error) throw new Error(`createOrderWithLoanAmount update failed: ${error.message}`)

  return orderId
}

test.afterAll(async () => {
  await deleteTrackedOrders()
})

test("adding a loan seeds Principal Amount from the order's Loan Amount, and CDF Page 1 inherits it", async ({ page }) => {
  const orderId = await createOrderWithLoanAmount(page)

  await page.goto(`/orders/${orderId}/loan-info`)
  await page.getByRole('button', { name: '+ Add Loan' }).click()
  await page.waitForSelector('[data-testid^="loan-row-"]')

  const principalInput = page.locator('[data-testid^="loan-row-"] input[name="principal_amount"]')
  await expect(principalInput).toHaveValue(String(TEST_LOAN_AMOUNT))

  // Downstream: CDF Page 1's Loan Amount field should default from this same
  // loan's principal amount -- the first automated regression coverage for
  // any of Tasks 5-9's primary-loan seedings.
  await page.goto(`/orders/${orderId}/cdf-page-1`)
  const cdfLoanAmountInput = page.locator('input[name="loan_amount"]')
  await expect(cdfLoanAmountInput).toHaveValue(String(TEST_LOAN_AMOUNT))
})
