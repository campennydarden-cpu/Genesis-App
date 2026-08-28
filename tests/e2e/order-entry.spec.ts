import { test, expect, type Page } from '@playwright/test'

function uniqueEmail() {
  // NOTE: @example.com is deliberately avoided — Supabase Auth (GoTrue) hard-rejects
  // RFC 2606 reserved test domains (example.com/.org/.net) with error_code
  // "email_address_invalid" regardless of project config. Using a non-reserved
  // placeholder domain instead so signUp() actually reaches account creation.
  return `genesis-test-${Date.now()}@genesis-app-e2e-test.dev`
}

const TEST_PASSWORD = 'TestPassword123!'

// Fixed seeded test user — created once via the real /signup flow against the
// production Supabase project (hlahrypglnmjjxrdtfkm). This is a dedicated
// test-only account with no real data, not a secret. Every test below except
// the signup-specific one logs in as this account instead of creating a
// fresh account, so the suite stops writing a new row to Supabase Auth on
// every local + CI + deployed run.
const SEEDED_EMAIL = 'genesis-e2e-seed@genesis-app-e2e-test.dev'
const SEEDED_PASSWORD = 'E2eSeedPass123!'

async function loginAsSeededUser(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(SEEDED_EMAIL)
  await page.getByLabel('Password').fill(SEEDED_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/orders')
}

test.describe('Genesis foundation phase', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/orders')
    await page.waitForURL('**/login**')
    await expect(page.getByRole('heading', { name: 'Genesis — Sign In' })).toBeVisible()
  })

  test('sign up and log in', async ({ page }) => {
    // This is the ONLY test that exercises the real signup flow — a fresh,
    // unique-per-run email is fine here since the test is specifically
    // verifying the signup+login round trip, not just needing a session.
    const email = uniqueEmail()

    await page.goto('/signup')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign Up' }).click()

    await page.waitForURL('**/login**')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await page.waitForURL('**/orders')
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
  })

  test('bad login shows an error and does not redirect to /orders', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(SEEDED_EMAIL)
    await page.getByLabel('Password').fill('WrongPassword999!')
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Should stay on /login with an error message rendered, never reach /orders.
    await page.waitForURL('**/login**')
    await expect(page.getByRole('heading', { name: 'Genesis — Sign In' })).toBeVisible()
    await expect(page.locator('p.text-red-700')).toBeVisible()
    expect(page.url()).not.toContain('/orders')
  })

  test('create an order with contact add and remove', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    await page.waitForURL('**/orders/new')

    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('Purchase Price').fill('250000')
    await page.getByLabel('Property Address').fill('123 Main St')
    await page.getByRole('button', { name: 'Create Order' }).click()

    await page.waitForURL('**/orders/**')
    await expect(page.getByRole('heading', { name: `Order ${fileNumber}` })).toBeVisible()

    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').fill('Buyer/Borrower')
    await page.getByLabel('Name').fill('Jane Test Buyer')
    await page.getByLabel('Phone').fill('555-0100')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByTestId('contact-row')).toContainText('Jane Test Buyer')
    await expect(page.getByTestId('contact-row')).toContainText('Buyer/Borrower')

    // Remove the contact and confirm the row disappears (this order has
    // exactly one contact, so the single "Remove" button is unambiguous).
    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('contact-row')).not.toBeVisible()
  })

  test('orders list shows created orders and status edits persist', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**')

    // Edit status fields and save
    await page.getByLabel('Title Status').selectOption('Searching')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/orders/**')
    await expect(page.getByLabel('Title Status')).toHaveValue('Searching')

    // Back to the list — the order should appear with its status
    await page.goto('/orders')
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)
    await expect(page.getByTestId('order-list')).toContainText('Searching')

    // Sign out returns to /login
    await page.getByRole('button', { name: 'Sign Out' }).click()
    await page.waitForURL('**/login**')
  })
})
