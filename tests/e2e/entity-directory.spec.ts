import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hlahrypglnmjjxrdtfkm.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsYWhyeXBnbG5tamp4cmR0ZmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MzYyMDEsImV4cCI6MjEwMzMxMjIwMX0.dhgrZ8ei_NY2wG6bs6Ah--AHPEagl36gI7tcAX8llsY'
const SEEDED_EMAIL = 'genesis-e2e-seed@genesis-app-e2e-test.dev'
const SEEDED_PASSWORD = 'E2eSeedPass123!'

const createdOrderIds = new Set<string>()
// Fuzzy-dedup matches on shared substrings -- unlike other e2e suites' cleanup, this one
// can't just delete-by-prefix: two test cases sharing one prefix would make pg_trgm see
// them as duplicates OF EACH OTHER. Track exact names instead so each test can pick
// whatever base name it needs (including an intentional near-duplicate of its own name,
// which is the whole point of the second test) without cross-test collisions.
const createdDirectoryNames = new Set<string>()

async function cleanupTestData() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: SEEDED_EMAIL,
    password: SEEDED_PASSWORD,
  })
  if (authError) {
    console.error('cleanupTestData auth failed:', authError)
    return
  }
  if (createdOrderIds.size > 0) {
    await supabase.from('orders').delete().in('id', [...createdOrderIds])
  }
  if (createdDirectoryNames.size > 0) {
    await supabase.from('entity_directory').delete().in('name', [...createdDirectoryNames])
  }
}

async function loginAsSeededUser(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(SEEDED_EMAIL)
  await page.getByLabel('Password').fill(SEEDED_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/orders')
}

async function createTestOrder(page: Page): Promise<string> {
  await loginAsSeededUser(page)
  await page.getByRole('link', { name: '+ New Order' }).click()
  await page.getByRole('button', { name: 'Create Order' }).click()
  await page.waitForURL('**/orders/*/order-entry')
  const orderId = page.url().match(/orders\/([^/]+)/)![1]
  createdOrderIds.add(orderId)
  return orderId
}

test.afterAll(async () => {
  await cleanupTestData()
})

test.describe('Entity Directory — Lender', () => {
  test('adding a Lender via the directory creates a new entry with a Lookup Code', async ({ page }) => {
    const orderId = await createTestOrder(page)
    await page.goto(`/orders/${orderId}/contacts`)
    await page.getByText('Add a contact').click()

    await page.getByLabel('Role').click()
    await page.getByRole('option', { name: 'Lender', exact: true }).click()

    const uniqueName = `Zephyr Holdings ${Date.now()}`
    createdDirectoryNames.add(uniqueName)
    await page.getByPlaceholder('Search lenders or add new…').fill(uniqueName)
    await page.getByRole('option', { name: `Add "${uniqueName}" as new` }).click()

    await page.getByLabel('Phone').fill('555-100-2000')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByTestId('contact-row').filter({ hasText: uniqueName })).toBeVisible()
  })

  test('adding a near-duplicate Lender name prompts update-or-add-new', async ({ page }) => {
    const orderId = await createTestOrder(page)
    const baseName = `Quasar Mortgage Group ${Date.now()}`
    createdDirectoryNames.add(baseName)

    await page.goto(`/orders/${orderId}/contacts`)
    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').click()
    await page.getByRole('option', { name: 'Lender', exact: true }).click()
    await page.getByPlaceholder('Search lenders or add new…').fill(baseName)
    await page.getByRole('option', { name: `Add "${baseName}" as new` }).click()
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await expect(page.getByTestId('contact-row').filter({ hasText: baseName })).toBeVisible()

    const secondOrderId = await createTestOrder(page)
    const nearDuplicate = `${baseName} Co`
    createdDirectoryNames.add(nearDuplicate)
    await page.goto(`/orders/${secondOrderId}/contacts`)
    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').click()
    await page.getByRole('option', { name: 'Lender', exact: true }).click()
    await page.getByPlaceholder('Search lenders or add new…').fill(nearDuplicate)
    await page.getByRole('option', { name: `Add "${nearDuplicate}" as new` }).click()
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByText('looks similar to an existing entry')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Update this record' })).toBeVisible()
  })
})
