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

  test('signup is disabled (post-bootstrap security posture)', async ({ page }) => {
    // Public signup was intentionally closed in the Supabase dashboard once the
    // one seeded account existed (final-review Critical finding: an open /signup
    // route + single-tenant "to authenticated" RLS meant anyone with the URL
    // could self-register and read/write every order and contact, SSN/DOB
    // included). This test verifies that fix holds, rather than testing a flow
    // that's now deliberately unavailable.
    const email = uniqueEmail()

    await page.goto('/signup')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign Up' }).click()

    await page.waitForURL('**/signup?error=**')
    await expect(page.locator('p.text-red-700')).toBeVisible()
    expect(page.url()).not.toContain('/orders')
  })

  test('log in with the seeded account', async ({ page }) => {
    await loginAsSeededUser(page)
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

    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/contacts`)
    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').fill('Buyer/Borrower')
    await page.getByLabel('Name').fill('Jane Test Buyer')
    await page.getByLabel('Phone').fill('555-0100')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByTestId('contact-row')).toContainText('Jane Test Buyer')
    await expect(page.getByTestId('contact-row')).toContainText('Buyer/Borrower')

    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('contact-row')).not.toBeVisible()
  })

  test('orders list shows created orders and status edits persist', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/order-info`)
    await page.getByLabel('Title Status').selectOption('Searching')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/order-info')
    await expect(page.getByLabel('Title Status')).toHaveValue('Searching')

    await page.goto('/orders')
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)
    await expect(page.getByTestId('order-list')).toContainText('Searching')

    await page.getByRole('button', { name: 'Sign Out' }).click()
    await page.waitForURL('**/login**')
  })

  test('navigation shell: sidebar and vertical nav render and link correctly', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await expect(page.getByTestId('order-sidebar')).toContainText(fileNumber)

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Contacts' }).click()
    await page.waitForURL('**/contacts')
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible()

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Order Info' }).click()
    await page.waitForURL('**/order-info')
    await expect(page.getByLabel('Order Status')).toBeVisible()

    await expect(
      page.getByTestId('file-section-nav').getByTestId('nav-disabled').filter({ hasText: 'Prelim Title Search' })
    ).toBeVisible()
    await expect(
      page.getByTestId('file-section-nav').getByRole('link', { name: 'Property' })
    ).toHaveCount(1)
  })

  test('navigation shell: toolbar tabs show placeholder content and reset on nav', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await expect(page.getByLabel('File Number')).toBeVisible()

    await page.getByTestId('toolbar-tab-attachments').click()
    await expect(page.getByTestId('toolbar-placeholder')).toContainText('Not built yet')
    await expect(page.getByLabel('File Number')).not.toBeVisible()

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Order Info' }).click()
    await page.waitForURL('**/order-info')
    await expect(page.getByTestId('toolbar-placeholder')).not.toBeVisible()
    await expect(page.getByLabel('Order Status')).toBeVisible()
  })

  test('property: pre-fills from Order Entry, saves fields, and manages easements', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('City').fill('Lorain')
    await page.getByLabel('County').fill('Lorain')
    await page.getByLabel('State').fill('OH')
    await page.getByLabel('Zip').fill('44053')
    await page.getByLabel('Parcel Number').fill('12-34-567')
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Property' }).click()
    await page.waitForURL('**/property')

    await expect(page.getByLabel('City')).toHaveValue('Lorain')
    await expect(page.getByLabel('County')).toHaveValue('Lorain')
    await expect(page.getByLabel('State')).toHaveValue('OH')
    await expect(page.getByLabel('Zip')).toHaveValue('44053')

    await page.getByLabel('House Number').fill('640')
    await page.getByLabel('Street Name').fill('Bayberry Rd')
    await page.getByLabel('Use Type').selectOption('Single Family')

    await page.getByTestId('property-tab-legal').click()
    await expect(page.getByLabel('Parcel Number', { exact: true })).toHaveValue('12-34-567')
    await page.getByLabel('Parcel Number Type').selectOption('APN')
    await page.getByLabel('Full Legal Description').fill('Lot 5, Block 2, Test Subdivision')

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/property')
    await page.waitForLoadState('networkidle')

    await page.getByTestId('property-tab-identification').click()
    await expect(page.getByLabel('House Number')).toHaveValue('640')
    await expect(page.getByLabel('Use Type')).toHaveValue('Single Family')

    await page.getByTestId('property-tab-legal').click()
    await expect(page.getByLabel('Full Legal Description')).toHaveValue('Lot 5, Block 2, Test Subdivision')

    await page.getByText('Add an easement').click()
    await page.locator('#easement_type').selectOption('Utility Easement')
    await page.locator('#description').fill('Rear yard utility line')
    await page.getByRole('button', { name: 'Add Easement' }).click()

    await expect(page.getByTestId('easement-row')).toContainText('Utility Easement')
    await expect(page.getByTestId('easement-row')).toContainText('Rear yard utility line')

    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('easement-row')).not.toBeVisible()
  })

  test('property: clearing a saved field does not re-pull the order default on reload', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('City').fill('Lorain')
    await page.getByLabel('County').fill('Lorain')
    await page.getByLabel('State').fill('OH')
    await page.getByLabel('Zip').fill('44053')
    await page.getByLabel('Parcel Number').fill('12-34-567')
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Property' }).click()
    await page.waitForURL('**/property')

    // No property_details row exists yet — fields are pre-filled from the order.
    await expect(page.getByLabel('City')).toHaveValue('Lorain')
    await expect(page.getByLabel('County')).toHaveValue('Lorain')
    await expect(page.getByLabel('State')).toHaveValue('OH')
    await expect(page.getByLabel('Zip')).toHaveValue('44053')

    // Save with the pre-filled values untouched — this creates the property_details row.
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/property')
    await page.waitForLoadState('networkidle')

    await expect(page.getByLabel('City')).toHaveValue('Lorain')
    await expect(page.getByLabel('County')).toHaveValue('Lorain')
    await expect(page.getByLabel('State')).toHaveValue('OH')
    await expect(page.getByLabel('Zip')).toHaveValue('44053')

    await page.getByTestId('property-tab-legal').click()
    await expect(page.getByLabel('Parcel Number', { exact: true })).toHaveValue('12-34-567')
    await page.getByTestId('property-tab-identification').click()

    // Now the row exists — deliberately clear just City and save again.
    await page.getByLabel('City').fill('')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/property')
    await page.waitForLoadState('networkidle')

    // Reload from scratch to prove this isn't just uncommitted client state.
    await page.reload()
    await page.waitForLoadState('networkidle')

    // City must stay empty — never silently repopulated from the order default —
    // while the other saved fields keep their values.
    await expect(page.getByLabel('City')).toHaveValue('')
    await expect(page.getByLabel('County')).toHaveValue('Lorain')
    await expect(page.getByLabel('State')).toHaveValue('OH')
    await expect(page.getByLabel('Zip')).toHaveValue('44053')

    await page.getByTestId('property-tab-legal').click()
    await expect(page.getByLabel('Parcel Number', { exact: true })).toHaveValue('12-34-567')
  })
})
