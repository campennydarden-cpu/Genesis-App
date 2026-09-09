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

test('nav shows CDF Page 5 under Escrow / Closing group', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/order-entry`)
  const group = page.locator('div', { has: page.getByText('Escrow / Closing', { exact: true }) }).first()
  await expect(group.getByRole('link', { name: 'CDF Page 5' })).toBeVisible()
})

test('Loan Calculations and Other Disclosures persist after reload', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-5`)

  await page.locator('input[name="apr"]').fill('6.812')
  await page.locator('input[name="apr"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.locator('input[name="liability_after_foreclosure"]').last().check()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  await expect(page.locator('input[name="apr"]')).toHaveValue('6.812')
  await expect(page.locator('input[name="liability_after_foreclosure"]').last()).toBeChecked()
})

test('add Contact Information row, edit, autosave persists, delete', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/cdf-page-5`)

  await page.getByRole('button', { name: '+ Add Contact' }).click()
  await expect(page.getByTestId('cdf-page5-contact-list').locator('[data-testid^="cdf-page5-contact-"]')).toHaveCount(1)

  const row = page.getByTestId('cdf-page5-contact-list').locator('[data-testid^="cdf-page5-contact-"]').first()
  await row.locator('select[name="role"]').selectOption('Lender')
  await row.locator('input[name="nmls_id"]').fill('123456')
  await row.locator('input[name="nmls_id"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedRow = page.getByTestId('cdf-page5-contact-list').locator('[data-testid^="cdf-page5-contact-"]').first()
  await expect(reloadedRow.locator('select[name="role"]')).toHaveValue('Lender')
  await expect(reloadedRow.locator('input[name="nmls_id"]')).toHaveValue('123456')

  await Promise.all([page.waitForNavigation(), reloadedRow.getByRole('button', { name: 'Remove contact' }).click()])
  await expect(page.getByText('No contacts added yet.')).toBeVisible()
})
