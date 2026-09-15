import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Public URL + anon key — same values the app itself ships to the browser
// (NEXT_PUBLIC_*), not secrets. Copied verbatim from tests/e2e/order-entry.spec.ts
// for consistency — Playwright's test runner does not load Next's .env files,
// so an env-var reference here would resolve to undefined at run time.
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

test('adds a requirement from the template library, including its optional children', async ({ page }) => {
  const orderId = await createOrder(page)

  await page.goto(`/orders/${orderId}/prelim-search`)

  // Security Instruments only render once a prelim_search row exists (foreign
  // key) - save Derivation with the minimum required fields first, same as
  // order-entry.spec.ts's "commitment schedule B" test.
  await page.getByLabel('Search Type').click()
  await page.getByLabel('Search Type').blur()
  await expect(page.getByTestId('save-indicator')).toContainText('Saved')

  // Seed TWO Security Instruments so the library picker's ambiguous-namespace
  // radio actually has something to disambiguate: ALTA 4b references
  // {{security_instrument.*}}, and the picker computes ambiguity from ALL of a
  // template's children up front (see ambiguousNamespaces in
  // RequirementsSection.tsx), not just the ones currently checked.
  await page.getByTestId('prelim-search-tab-security-instruments').click()
  await page.getByText('Add a Security Instrument').click()
  const siForm = page.locator('details:has-text("Add a Security Instrument")')

  await page.locator('#si-new-type').click()
  await page.getByRole('option', { name: 'Deed of Trust' }).click()
  await siForm.getByLabel('Mortgagor').fill('Test Borrower One')
  await siForm.getByLabel('Mortgagee').fill('Test Lender One')
  await siForm.getByRole('button', { name: 'Add Security Instrument' }).click()
  await expect(page.getByTestId('security-instrument-row')).toHaveCount(1)

  // The "Add a Security Instrument" <details> disclosure stays open after a
  // successful submit (same behavior as "Add a contact" - see
  // order-entry.spec.ts's dashboard-search test) - don't click the summary
  // again, it would toggle the still-open form closed.
  await page.locator('#si-new-type').click()
  await page.getByRole('option', { name: 'Mortgage' }).click()
  await siForm.getByLabel('Mortgagor').fill('Test Borrower Two')
  await siForm.getByLabel('Mortgagee').fill('Test Lender Two')
  await siForm.getByRole('button', { name: 'Add Security Instrument' }).click()
  await expect(page.getByTestId('security-instrument-row')).toHaveCount(2)

  await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch B-I/B-II' }).click()
  await page.waitForURL('**/commitment-sch-b')

  // "From Library" appears once in RequirementsSection and once (identically
  // worded) in ExceptionsSection below it on the same page - .first() is the
  // Requirements one, since RequirementsSection renders first in the DOM.
  await page.getByText('From Library').first().click()
  await page.getByRole('button', { name: /ALTA Standard Requirement 4/ }).click()

  // Two Security Instruments on file makes {{security_instrument.*}} (used by
  // the 4b child) an ambiguous namespace, so the picker must ask which one -
  // pick the first radio option, per the brief's sketch.
  const radios = page.locator('input[type="radio"]')
  await expect(radios).toHaveCount(2)
  await radios.first().check()

  await page.getByLabel(/4a/).check()

  const modal = page.locator('.fixed.inset-0.z-50')
  await modal.getByRole('button', { name: 'Add' }).click()

  const requirementRows = page.getByTestId('requirement-list').getByTestId('requirement-row')
  await expect(requirementRows).toHaveCount(2)
  await expect(requirementRows.nth(0)).toContainText('Documents satisfactory to the Company')
  await expect(requirementRows.nth(1)).toContainText('to be recorded among the land records for')
})

test('easement chip on Exceptions renders the Property Easement template', async ({ page }) => {
  const orderId = await createOrder(page)

  await page.getByTestId('file-section-nav').getByRole('link', { name: 'Property' }).click()
  await page.waitForURL('**/property')

  // Easements need a saved property_details row first (PropertyForm.tsx shows
  // "Save Property Details first before adding easements" until propertyId
  // exists) - blur a field on Identification to create it, same as
  // order-entry.spec.ts's property test does before it reaches "Add an easement".
  await page.getByLabel('City').fill('Lorain')
  await page.getByLabel('City').blur()
  await expect(page.getByTestId('save-indicator')).toContainText('Saved')

  // Seed a Property Easement via the UI - the same "Add an easement" flow
  // order-entry.spec.ts's property test already uses (there's no pre-seeded
  // order with an easement to reuse, so it has to be created here). Easements
  // live under the Legal tab, not the default Identification tab.
  await page.getByTestId('property-tab-legal').click()
  await page.getByText('Add an easement').click()
  await page.locator('#easement_type').click()
  await page.getByRole('option', { name: 'Utility Easement' }).click()
  await page.locator('#description').fill('Rear yard access easement')
  await page.getByRole('button', { name: 'Add Easement' }).click()
  await expect(page.getByTestId('easement-row')).toContainText('Utility Easement')

  await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch B-I/B-II' }).click()
  await page.waitForURL('**/commitment-sch-b')

  await expect(page.getByTestId('easement-exc-chip')).toBeVisible()
  await page.getByTestId('easement-exc-chip').first().click()

  await expect(page.getByTestId('exception-row')).toContainText('as shown by the public records')
})
