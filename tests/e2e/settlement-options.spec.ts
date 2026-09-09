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

test('nav shows Settlement Type & Options under Escrow / Closing group', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/order-entry`)
  const group = page.locator('div', { has: page.getByText('Escrow / Closing', { exact: true }) }).first()
  await expect(group.getByRole('link', { name: 'Settlement Type & Options' })).toBeVisible()
})

test('settlement type, address, seller credit election, and admin data persist after reload', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/settlement-options`)

  await page.locator('select[name="settlement_type"]').selectOption('Combined')
  await page.locator('textarea[name="place_of_settlement_address"]').fill('1 South Wacker Drive, Suite 2400\nChicago, IL 60606')
  await page.locator('textarea[name="place_of_settlement_address"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.locator('input[name="seller_credit_method"]').nth(1).check()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.locator('input[name="admin_data_cdf2"]').fill('Loan #445621')
  await page.locator('input[name="admin_data_cdf2"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  await expect(page.locator('select[name="settlement_type"]')).toHaveValue('Combined')
  await expect(page.locator('textarea[name="place_of_settlement_address"]')).toHaveValue('1 South Wacker Drive, Suite 2400\nChicago, IL 60606')
  await expect(page.locator('input[name="seller_credit_method"]').nth(1)).toBeChecked()
  await expect(page.locator('input[name="admin_data_cdf2"]')).toHaveValue('Loan #445621')
})

test('Settlement Agent picker refills the Place of Settlement address from the linked contact', async ({ page }) => {
  const orderId = await createOrder(page)

  // Seed a contact with a real address via the real Contacts screen (same pattern
  // title-premiums-endorsements.spec.ts uses for its own underwriter contact).
  await page.goto(`/orders/${orderId}/contacts`)
  await page.getByText('Add a contact').click()
  await page.getByLabel('Role').click()
  await page.getByRole('option', { name: 'Settlement Agent', exact: true }).click()
  await page.getByLabel('Name').fill('Acme Settlement Services')
  await page.getByLabel('Address').fill('500 Main St, Suite 100, Asheville, NC 28801')
  await page.getByRole('button', { name: 'Add Contact' }).click()
  await expect(page.getByTestId('contact-row').filter({ hasText: 'Acme Settlement Services' })).toBeVisible()

  await page.goto(`/orders/${orderId}/settlement-options`)
  await page.locator('select[name="settlement_agent_contact_id"]').selectOption({ label: 'Acme Settlement Services' })
  // Native `blur` doesn't bubble, and React's onBlur is implemented via the bubbling
  // `focusout` event — locator.blur() doesn't reliably trigger it here, so dispatch
  // focusout directly to fire this app's onBlur-based autosave before the Refill
  // action reads the just-selected contact back from the DB.
  await page.locator('select[name="settlement_agent_contact_id"]').dispatchEvent('focusout')
  await expect(page.getByText('Saved')).toBeVisible()
  await page.getByRole('button', { name: 'Refill address from contact' }).click()

  await expect(page.locator('textarea[name="place_of_settlement_address"]')).toHaveValue('500 Main St, Suite 100, Asheville, NC 28801')

  await page.reload()
  await expect(page.locator('select[name="settlement_agent_contact_id"]')).toHaveValue(/.+/)
  await expect(page.locator('textarea[name="place_of_settlement_address"]')).toHaveValue('500 Main St, Suite 100, Asheville, NC 28801')
})
