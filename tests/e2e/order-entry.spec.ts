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
    await expect(page.locator('[data-slot="card-title"]')).toBeVisible()
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
    await expect(page.getByRole('heading', { name: 'Genesis' })).toBeVisible()
  })

  test('bad login shows an error and does not redirect to /orders', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(SEEDED_EMAIL)
    await page.getByLabel('Password').fill('WrongPassword999!')
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Should stay on /login with an error message rendered, never reach /orders.
    await page.waitForURL('**/login**')
    await expect(page.locator('[data-slot="card-title"]')).toBeVisible()
    await expect(page.getByRole('alert')).toBeVisible()
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
      page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' })
    ).toHaveCount(1)
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

  test('dashboard search matches file number, property address, and buyer/seller name', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('Property Address').fill('789 Search Test Ave')
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/contacts`)
    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').fill('Buyer/Borrower')
    await page.getByLabel('Name').fill('Search Test Buyer')
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await expect(page.getByTestId('contact-row')).toContainText('Search Test Buyer')

    // The "Add a contact" <details> disclosure stays open after a successful
    // submit (the form resets, but the disclosure itself isn't re-closed) —
    // clicking the summary again here would toggle it CLOSED, not reopen it.
    await page.getByLabel('Role').fill('Listing Agent')
    await page.getByLabel('Name').fill('Nonmatching Agent')
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await expect(page.getByTestId('contact-row').filter({ hasText: 'Nonmatching Agent' })).toBeVisible()

    await page.goto('/orders')

    await page.getByTestId('dashboard-search').fill(fileNumber)
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)

    await page.getByTestId('dashboard-search').fill('789 Search Test Ave')
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)

    await page.getByTestId('dashboard-search').fill('Search Test Buyer')
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)

    await page.getByTestId('dashboard-search').fill('Nonmatching Agent')
    await expect(page.getByTestId('order-list')).not.toContainText(fileNumber)

    await page.getByTestId('dashboard-search').fill('no-such-order-xyz')
    await expect(page.getByTestId('order-list')).toContainText('No orders match')
  })

  test('dashboard queue badges filter the order list and toggle off', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/order-info`)
    await page.getByLabel('Title Status').selectOption('Exam')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/order-info')
    await expect(page.getByLabel('Title Status')).toHaveValue('Exam')

    await page.goto('/orders')
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)

    await page
      .getByTestId('queue-panel-title')
      .getByTestId('queue-badge')
      .filter({ hasText: /^Curative/ })
      .click()
    await expect(page.getByTestId('order-list')).not.toContainText(fileNumber)

    await page
      .getByTestId('queue-panel-title')
      .getByTestId('queue-badge')
      .filter({ hasText: /^Curative/ })
      .click()
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)

    await page
      .getByTestId('queue-panel-title')
      .getByTestId('queue-badge')
      .filter({ hasText: /^Exam/ })
      .click()
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)
  })

  test('dashboard shows Tasks and Firm Analytics as placeholders', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto('/orders')

    await expect(page.getByTestId('dashboard-placeholder-tasks')).toContainText('Tasks')
    await expect(page.getByTestId('dashboard-placeholder-tasks')).toContainText('Not built yet')
    await expect(page.getByTestId('dashboard-placeholder-analytics')).toContainText('Firm Analytics')
    await expect(page.getByTestId('dashboard-placeholder-analytics')).toContainText('Not built yet')
  })

  test('prelim search: Derivation form saves, generates Vesting/Derivation Clause, and manages Principals', async ({
    page,
  }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('County').fill('Lorain')
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')

    await page.getByLabel('Effective Date').fill('2026-06-01')
    await page.getByLabel('Instrument Type').click()
    await page.getByRole('option', { name: 'Warranty Deed', exact: true }).click()
    await page.getByLabel('Recorded Date').fill('2026-05-15')
    await page.getByLabel('Grantee Name').fill('Test Trust Co')
    await page.getByLabel('Grantee Entity Type').click()
    await page.getByRole('option', { name: 'Trust' }).click()
    await page.getByLabel('Grantor Name').fill('Original Owner LLC')
    await page.getByLabel('Grantor Entity Type').click()
    await page.getByRole('option', { name: 'LLC' }).click()

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    // No trustees yet - Vesting Clause shows the "not yet added" fallback.
    await expect(page.getByTestId('vesting-clause')).toContainText('[Trustee(s) not yet added] of the Test Trust Co')

    // Add a Grantee (Trust) principal.
    await page.getByTestId('grantee-principal-roster').getByText('Add Grantee Principal').click()
    await page.locator('#grantee-new-name').fill('Jane Trustee')
    await page.locator('#grantee-new-role').click()
    await page.getByRole('option', { name: 'Trustee', exact: true }).click()
    await page.getByTestId('grantee-principal-roster').getByRole('button', { name: 'Add' }).click()

    await expect(page.getByTestId('grantee-principal-row')).toContainText('Jane Trustee')
    await expect(page.getByTestId('vesting-clause')).toContainText('Jane Trustee, as Trustee of the Test Trust Co')
    await expect(page.getByTestId('derivation-clause')).toContainText(
      'Being the same parcel conveyed unto Jane Trustee, as Trustee of the Test Trust Co by Warranty Deed of Original Owner LLC recorded May 15, 2026 of the Lorain County records.'
    )

    // Edit the principal via the pencil/Edit control.
    await page.getByTestId('grantee-principal-row').getByRole('button', { name: /Edit/ }).click();
    await page.getByTestId('grantee-principal-row-editing').locator('input[name="name"]').fill('Jane A. Trustee');
    await page.getByTestId('grantee-principal-row-editing').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('grantee-principal-row')).toContainText('Jane A. Trustee')

    // Remove it.
    await page.getByTestId('grantee-principal-row').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('grantee-principal-row')).not.toBeVisible()
  })

  test('prelim search: Security Instruments add, edit, and remove', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')

    // Security Instruments need a saved prelim_search row first (foreign key) -
    // save Derivation with the minimum required fields.
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    await page.getByText('Add a Security Instrument').click()
    await page.locator('#si-new-type').click()
    await page.getByRole('option', { name: 'Deed of Trust' }).click()
    await page.locator('#si-new-mortgagor').fill('Test Borrower')
    await page.locator('#si-new-mortgagee').fill('Test Lender Bank')
    await page.getByRole('button', { name: 'Add Security Instrument' }).click()

    await expect(page.getByTestId('security-instrument-row')).toContainText('Deed of Trust')
    await expect(page.getByTestId('security-instrument-row')).toContainText('Test Borrower → Test Lender Bank')

    await page.getByTestId('security-instrument-row').getByRole('button', { name: /Edit/ }).click()
    await page.getByTestId('security-instrument-row-editing').locator('[name="mortgagee"]').fill('Updated Lender Bank')
    await page.getByTestId('security-instrument-row-editing').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('security-instrument-row')).toContainText('Test Borrower → Updated Lender Bank')

    await page.getByTestId('security-instrument-row').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('security-instrument-row')).not.toBeVisible()
  })

  test('prelim search: Related Documents show Assignor/Assignee only for Assignment-family types', async ({
    page,
  }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    await page.getByText('Add a Security Instrument').click()
    await page.locator('#si-new-type').click()
    await page.getByRole('option', { name: 'Mortgage' }).click()
    await page.getByRole('button', { name: 'Add Security Instrument' }).click()
    await expect(page.getByTestId('security-instrument-row')).toBeVisible()

    await page.getByText('Add a Related Document').click()
    const relatedDocForm = page.locator('[data-testid="related-docs-section"] details')
    await relatedDocForm.locator('button[role="combobox"]').click()
    await page.getByRole('option', { name: 'Substitution of Trustee' }).click()
    await expect(relatedDocForm.getByLabel('Assignor')).not.toBeVisible()

    await relatedDocForm.locator('button[role="combobox"]').click()
    await page.getByRole('option', { name: 'Assignment', exact: true }).click()
    await expect(relatedDocForm.getByLabel('Assignor')).toBeVisible()
    await relatedDocForm.getByLabel('Assignor').fill('Original Bank')
    await relatedDocForm.getByLabel('Assignee').fill('New Bank')
    await relatedDocForm.getByRole('button', { name: 'Add' }).click()

    await expect(page.getByTestId('related-doc-row')).toContainText('Original Bank → New Bank')
  })

  test('prelim search: Liens show different fields per type', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    await page.getByText('Add a Lien').click()
    const lienForm = page.locator('#liens').locator('details')
    await lienForm.locator('#lien-new-type').click()
    await page.getByRole('option', { name: 'Judgment' }).click()
    await expect(lienForm.getByLabel('Debtor')).toBeVisible()
    await expect(lienForm.getByLabel('Court')).toBeVisible()
    await expect(lienForm.getByLabel('Taxing Authority')).not.toBeVisible()

    await lienForm.locator('#lien-new-type').click()
    await page.getByRole('option', { name: 'Tax Lien' }).click()
    await expect(lienForm.getByLabel('Taxing Authority')).toBeVisible()
    await expect(lienForm.getByLabel('Court')).not.toBeVisible()

    await lienForm.getByLabel('Debtor').fill('Test Debtor')
    await lienForm.getByLabel('Taxing Authority').fill('County Tax Office')
    await page.getByRole('button', { name: 'Add Lien' }).click()

    await expect(page.getByTestId('lien-row')).toContainText('Tax Lien')
    await expect(page.getByTestId('lien-row')).toContainText('Test Debtor')
  })

  test('prelim search: Exception Matters add, edit, and remove', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    await page.getByText('Add an Exception Matter').click()
    await page.locator('#em-new-description').fill('Easement of record affecting the rear 10 feet')
    await page.getByRole('button', { name: 'Add Exception Matter' }).click()

    await expect(page.getByTestId('exception-matter-row')).toContainText('Easement of record affecting the rear 10 feet')

    await page.getByTestId('exception-matter-row').getByRole('button', { name: 'Edit exception matter' }).click()
    await page.getByTestId('exception-matter-row-editing').locator('textarea[name="description"]').fill('Updated exception text')
    await page.getByTestId('exception-matter-row-editing').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('exception-matter-row')).toContainText('Updated exception text')

    await page.getByTestId('exception-matter-row').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('exception-matter-row')).not.toBeVisible()
  })

  test('commitment sch A: Form Type and Policy Type drive Owner\'s/Loan Policy visibility', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByLabel('Policy Type').selectOption('Simultaneous')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch A' }).click()
    await page.waitForURL('**/commitment-sch-a')

    await expect(page.getByTestId('owner-policy-card')).toBeVisible()
    await expect(page.getByTestId('loan-policy-card')).toBeVisible()

    await page.locator('#form_type').click()
    await page.getByRole('option', { name: 'Short Form' }).click()

    await expect(page.getByTestId('owner-policy-card')).not.toBeVisible()
    await expect(page.getByTestId('loan-policy-card')).toBeVisible()
    await expect(page.getByTestId('estate-fact')).toContainText('Fee Simple')
    await expect(page.getByLabel(/Environmental Protection Lien Statutes/)).toBeVisible()

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/commitment-sch-a')
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('estate-fact')).toContainText('Fee Simple')
    await expect(page.getByLabel(/Environmental Protection Lien Statutes/)).toBeVisible()

    // Real reload, not just leftover client state after the redirect - proves it persisted server-side.
    await page.reload()
    await expect(page.getByTestId('estate-fact')).toContainText('Fee Simple')
    await expect(page.getByLabel(/Environmental Protection Lien Statutes/)).toBeVisible()
  })

  test('commitment sch A: Chain of Title add/edit/remove with Copy from Derivation seed, and contact seed chips', async ({
    page,
  }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('County').fill('Lorain')
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByLabel('Policy Type').selectOption('Simultaneous')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/order-entry')

    // Derivation on Prelim Search, so the Chain of Title "Copy from Derivation" seed has data.
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')
    await page.getByLabel('Instrument Type').click()
    await page.getByRole('option', { name: 'Warranty Deed', exact: true }).click()
    await page.getByLabel('Grantee Name').fill('Test Trust Co')
    await page.getByLabel('Grantor Name').fill('Original Owner LLC')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    // Add a Buyer/Borrower contact and a Lender contact (with a mortgagee clause) for the seed chips.
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Contacts' }).click()
    await page.waitForURL('**/contacts')

    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').fill('Buyer/Borrower')
    await page.getByLabel('Name').fill('Jane Buyer')
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await expect(page.getByText('Jane Buyer')).toBeVisible()

    await page.getByLabel('Role').fill('Lender')
    await page.getByLabel('Name').fill('First National Bank')
    await page.getByLabel('Mortgagee Clause').fill('First National Bank, its successors and/or assigns, ISAOA/ATIMA')
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await expect(page.getByText('First National Bank')).toBeVisible()

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch A' }).click()
    await page.waitForURL('**/commitment-sch-a')

    await expect(page.getByTestId('owner-insured-seed-chips')).toContainText('Jane Buyer')
    await page.getByTestId('owner-policy-card').getByRole('button', { name: '+ Jane Buyer' }).click()
    await expect(page.getByTestId('owner-policy-card').getByLabel('Proposed Insured')).toHaveValue('Jane Buyer')

    await expect(page.getByTestId('loan-insured-seed-chips')).toContainText('First National Bank')
    await page.getByTestId('loan-policy-card').getByRole('button', { name: '+ First National Bank' }).click()
    await expect(page.getByTestId('loan-policy-card').getByLabel('Proposed Insured')).toHaveValue('First National Bank')

    await expect(page.getByTestId('mortgagee-clause-seed-chips')).toContainText('Copy from First National Bank')
    await page.getByTestId('mortgagee-clause-seed-chips').getByRole('button', { name: '+ Copy from First National Bank' }).click()
    await expect(page.getByTestId('loan-policy-card').getByLabel('Mortgagee Clause')).toHaveValue(
      'First National Bank, its successors and/or assigns, ISAOA/ATIMA'
    )

    // Save the main form first - chain_of_title needs the commitment_sch_a row's FK.
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/commitment-sch-a')
    await page.waitForLoadState('networkidle')

    // Real reload, not just leftover client state after the redirect - proves it persisted server-side.
    await page.reload()
    await expect(page.getByTestId('owner-policy-card').getByLabel('Proposed Insured')).toHaveValue('Jane Buyer')

    await expect(page.getByTestId('chain-of-title-list')).toBeVisible()
    await page.getByText('Add a Chain of Title Entry').click()
    await page.getByText(/Copy from Derivation/).click()

    await expect(page.locator('#cot-new-instrument_type')).toHaveValue('Warranty Deed')
    await expect(page.locator('#cot-new-grantor')).toHaveValue('Original Owner LLC')
    await expect(page.locator('#cot-new-grantee')).toHaveValue('Test Trust Co')

    await page.locator('#cot-new-book').fill('1234')
    await page.locator('#cot-new-page').fill('567')
    await page.getByRole('button', { name: 'Add Chain of Title Entry' }).click()

    await expect(page.getByTestId('chain-of-title-row')).toContainText('Warranty Deed: Original Owner LLC → Test Trust Co')

    await page.getByTestId('chain-of-title-row').getByRole('button', { name: /Edit/ }).click()
    await page.getByTestId('chain-of-title-row-editing').locator('[name="grantee"]').fill('Updated Trust Co')
    await page.getByTestId('chain-of-title-row-editing').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('chain-of-title-row')).toContainText('Updated Trust Co')

    await page.getByTestId('chain-of-title-row').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('chain-of-title-row')).not.toBeVisible()
  })

  test('commitment schedule B: chip generation, sub-item numbering, manual add', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')

    // Security Instruments/Liens/Exception Matters only render once a prelim_search row
    // exists (foreign key) - save Derivation with the minimum required fields first.
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    await page.getByText('Add a Security Instrument').click()
    const siForm = page.locator('details:has-text("Add a Security Instrument")')
    await page.locator('#si-new-type').click()
    await page.getByRole('option', { name: 'Deed of Trust' }).click()
    await siForm.getByLabel('Mortgagor').fill('Test Owner')
    await siForm.getByLabel('Mortgagee').fill('Test Lender')
    await siForm.getByRole('button', { name: 'Add Security Instrument' }).click()
    await expect(page.getByTestId('security-instrument-row')).toContainText('Deed of Trust')

    const siRow = page.getByTestId('security-instrument-row').first()
    await siRow.getByText('Add a Related Document').click()
    const relatedForm = siRow.locator('details:has-text("Add a Related Document")')
    await relatedForm.locator('button[role="combobox"]').click()
    await page.getByRole('option', { name: 'Assignment', exact: true }).click()
    await relatedForm.getByLabel('Assignor').fill('Test Lender')
    await relatedForm.getByLabel('Assignee').fill('Assignee Bank')
    await relatedForm.getByRole('button', { name: 'Add' }).click()
    await expect(siRow.getByTestId('related-doc-row')).toContainText('Assignment')

    await page.getByText('Add a Lien').click()
    const lienForm = page.locator('details:has-text("Add a Lien")')
    await lienForm.locator('#lien-new-type').click()
    await page.getByRole('option', { name: 'Judgment' }).click()
    await lienForm.getByLabel('Debtor').fill('Test Debtor')
    await lienForm.getByLabel('Creditor').fill('Test Creditor')
    await lienForm.getByRole('button', { name: 'Add Lien' }).click()
    await expect(page.getByTestId('lien-row')).toContainText('Test Debtor')

    await page.getByText('Add an Exception Matter').click()
    const emForm = page.locator('details:has-text("Add an Exception Matter")')
    await emForm.getByLabel('Description').fill('Utility easement of record')
    await emForm.getByRole('button', { name: 'Add Exception Matter' }).click()
    await expect(page.getByTestId('exception-matter-row')).toContainText('Utility easement of record')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch B-I/B-II' }).click()
    await page.waitForURL('**/commitment-sch-b')

    // Chips exist for the SI and Lien, but the Related Document sub-item chip is absent until the SI chip is used
    await expect(page.getByTestId('si-req-chip')).toBeVisible()
    await expect(page.getByTestId('lien-req-chip')).toBeVisible()
    await expect(page.getByTestId('rel-req-chip')).not.toBeVisible()
    await expect(page.getByTestId('em-exc-chip')).toBeVisible()

    // A fresh order has no Commitment Sch A form_type on file, so requirement numbering
    // defaults to Standard's 4 pre-printed items (STANDARD_BI_ITEM_COUNTS.Standard) - the
    // first added requirement is "5.", not "1."
    await page.getByTestId('si-req-chip').click()
    await expect(page.getByTestId('requirement-row')).toContainText('Release of Deed of Trust')
    await expect(page.getByTestId('requirement-row')).toContainText('5.')

    // Now the Related Document's sub-item chip appears
    await expect(page.getByTestId('rel-req-chip')).toBeVisible()

    // Regression (numbering contiguity): add the Lien BEFORE the Related Document sub-item,
    // so the sub-item row is stored after an unrelated top-level item. It must still be
    // lettered under its true parent (the SI, item 5) and render grouped with it - not
    // lettered "6a." under the Lien, which is what the created_at-order walk produced before
    // reorderForNumbering existed.
    await page.getByTestId('lien-req-chip').click()
    await expect(page.getByTestId('requirement-list').getByTestId('requirement-row').nth(1)).toContainText('6.')

    await page.getByTestId('rel-req-chip').click()
    const relRow = page.getByTestId('requirement-list').getByTestId('requirement-row').nth(1)
    await expect(relRow).toContainText('Release of Assignment')
    await expect(relRow).toContainText('5a.')
    await expect(page.getByTestId('requirement-list').getByTestId('requirement-row').nth(2)).toContainText('6.')

    await page.getByTestId('em-exc-chip').click()
    await expect(page.getByTestId('exception-row')).toContainText('Utility easement of record')
    await expect(page.getByTestId('exception-row')).toContainText('1.')

    // Manual add
    await page.getByText('Add a requirement').click()
    const reqForm = page.locator('details:has-text("Add a requirement")')
    await reqForm.getByLabel('Description').fill('Manual test requirement')
    await reqForm.getByRole('button', { name: 'Add Requirement' }).click()
    await expect(page.getByTestId('requirement-list').getByTestId('requirement-row').nth(3)).toContainText('7.')
    await expect(page.getByTestId('requirement-list').getByTestId('requirement-row').nth(3)).toContainText('Manual test requirement')

    // Edit a requirement. Note: filling the textarea changes its DOM `.value`, not its
    // rendered textContent, so keep scoping by the original description text throughout.
    const requirementRow = page.getByTestId('requirement-row').filter({ hasText: 'Manual test requirement' })
    await requirementRow.getByRole('button', { name: 'Edit' }).click()
    await requirementRow.locator('textarea[name="description"]').fill('Edited test requirement')
    await requirementRow.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('requirement-list')).toContainText('Edited test requirement')

    // Reload and confirm persistence
    await page.reload()
    await expect(page.getByTestId('requirement-list').getByTestId('requirement-row')).toHaveCount(4)
    await expect(page.getByTestId('exception-list').getByTestId('exception-row')).toHaveCount(1)
  })
})
