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

async function createOrderWithContacts(page: Page): Promise<string> {
  await loginAsSeededUser(page)
  await page.getByRole('link', { name: '+ New Order' }).click()
  await page.getByRole('button', { name: 'Create Order' }).click()
  await page.waitForURL('**/orders/**/order-entry')
  const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1] as string
  createdOrderIds.add(orderId)

  await page.goto(`/orders/${orderId}/contacts`)
  await page.getByText('Add a contact').click()
  await page.getByLabel('Role').click()
  await page.getByRole('option', { name: 'Seller', exact: true }).click()
  await page.getByLabel('Name').fill('Jane Seller')
  await page.getByRole('button', { name: 'Add Contact' }).click()
  await expect(page.getByTestId('contact-row').filter({ hasText: 'Jane Seller' })).toBeVisible()

  await page.reload()
  await page.getByText('Add a contact').click()
  await page.getByLabel('Role').click()
  await page.getByRole('option', { name: 'Buyer/Borrower', exact: true }).click()
  await page.getByLabel('Name').fill('Bob Buyer')
  await page.getByRole('button', { name: 'Add Contact' }).click()
  await expect(page.getByTestId('contact-row').filter({ hasText: 'Bob Buyer' })).toBeVisible()

  return orderId
}

test.describe('Document Preparation', () => {
  test.afterAll(async () => {
    await deleteTrackedOrders()
  })

  test('Deed: copy Grantor from contact, autosave fields, finalize', async ({ page }) => {
    const orderId = await createOrderWithContacts(page)
    await page.goto(`/orders/${orderId}/deed`)

    await page.getByTestId('deed-grantor-section').getByLabel('Copy Grantor from contact').selectOption({ label: 'Jane Seller (Seller)' })
    await page.getByTestId('deed-grantor-section').getByRole('button', { name: 'Copy' }).click()
    await expect(page.locator('#grantor-name')).toHaveValue('Jane Seller')

    await page.locator('#consideration').fill('250000')
    await page.locator('#consideration').blur()
    await page.locator('#exemption_code').fill('EX-1')
    await page.locator('#exemption_code').blur()
    await expect(page.getByText('Saved')).toBeVisible()

    await page.reload()
    await expect(page.locator('#grantor-name')).toHaveValue('Jane Seller')
    await expect(page.locator('#consideration')).toHaveValue('250000')
    await expect(page.locator('#exemption_code')).toHaveValue('EX-1')

    await page.getByRole('button', { name: 'Finalize' }).click()
    await expect(page.getByRole('button', { name: 'Revert to Draft' })).toBeVisible()
    await expect(page.getByLabel('Recorded Date')).toBeVisible()
  })

  test('Deed: add signature line and subject-to item', async ({ page }) => {
    const orderId = await createOrderWithContacts(page)
    await page.goto(`/orders/${orderId}/deed`)

    await page.getByPlaceholder('Add a signature line').fill('Jane Seller')
    await page.getByPlaceholder('Add a signature line').locator('xpath=..').getByRole('button', { name: 'Add' }).click()
    await expect(page.getByTestId('deed-signature-lines').locator('input')).toHaveValue('Jane Seller')

    await page.getByPlaceholder('Add a Subject To item').fill('Easements of record')
    await page.getByPlaceholder('Add a Subject To item').locator('xpath=..').getByRole('button', { name: 'Add' }).click()
    await expect(page.getByTestId('deed-subject-to')).toContainText('Easements of record')
  })

  test('Security Instrument: copy Mortgagor from contact, save Note fields', async ({ page }) => {
    const orderId = await createOrderWithContacts(page)
    await page.goto(`/orders/${orderId}/security-instrument`)

    await page
      .getByTestId('si-mortgagor-section')
      .getByLabel('Copy Mortgagor from contact')
      .selectOption({ label: 'Bob Buyer (Buyer/Borrower)' })
    await page.getByTestId('si-mortgagor-section').getByRole('button', { name: 'Copy' }).click()
    await expect(page.locator('#mortgagor-name')).toHaveValue('Bob Buyer')

    await page.locator('#note_amount').fill('180000')
    await page.locator('#note_amount').blur()
    await expect(page.getByText('Saved')).toBeVisible()

    await page.reload()
    await expect(page.locator('#mortgagor-name')).toHaveValue('Bob Buyer')
    await expect(page.locator('#note_amount')).toHaveValue('180000')
  })

  test('Affidavits: add, edit, delete', async ({ page }) => {
    const orderId = await createOrderWithContacts(page)
    await page.goto(`/orders/${orderId}/affidavits`)

    await page.getByRole('button', { name: '+ Add Affidavit' }).click()
    await page.getByLabel('Affiant').fill('Jane Seller')
    await page.getByRole('button', { name: 'Add Affidavit' }).click()
    await expect(page.getByTestId('affidavit-list')).toContainText('Jane Seller')

    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Affiant').fill('Jane Seller Updated')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('affidavit-list')).toContainText('Jane Seller Updated')

    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('No affidavits yet.')).toBeVisible()
  })

  test('Power of Attorney: enabling POA on a contact surfaces it here and fields save', async ({ page }) => {
    const orderId = await createOrderWithContacts(page)

    await page.goto(`/orders/${orderId}/contacts`)
    await page.getByTestId('contact-row').filter({ hasText: 'Jane Seller' }).getByRole('link', { name: 'Edit' }).click()
    await page.getByRole('checkbox', { name: 'Power of Attorney (POA)' }).check()
    await expect(page.getByText('Saved')).toBeVisible()

    await page.goto(`/orders/${orderId}/power-of-attorney`)
    await expect(page.getByText('Jane Seller (Seller)')).toBeVisible()

    await page.getByLabel('Attorney-in-Fact Name').fill('Attorney Bob')
    await page.getByRole('button', { name: 'Save' }).click()

    await page.reload()
    await expect(page.getByLabel('Attorney-in-Fact Name')).toHaveValue('Attorney Bob')
  })

  test('Notary Acknowledgement: auto-generates for Seller and Buyer/Borrower, Regenerate overwrites edits', async ({ page }) => {
    const orderId = await createOrderWithContacts(page)
    await page.goto(`/orders/${orderId}/notary-acknowledgement`)
    await expect(page.getByRole('heading', { name: 'Notary Acknowledgement' })).toBeVisible()
    if (await page.getByText('No Deed Grantor').isVisible().catch(() => false)) {
      await page.reload()
    }

    await expect(page.getByText('Jane Seller · Deed')).toBeVisible()
    await expect(page.getByText('Bob Buyer · Security Instrument')).toBeVisible()

    const deedAckCard = page.getByTestId(/^notary-ack-[0-9a-f]/).filter({ hasText: 'Jane Seller · Deed' })
    const textarea = deedAckCard.locator('textarea')
    await textarea.fill('EDITED TEXT')
    await textarea.blur()

    await page.reload()
    await expect(page.getByTestId(/^notary-ack-[0-9a-f]/).filter({ hasText: 'Jane Seller · Deed' }).locator('textarea')).toHaveValue('EDITED TEXT')

    await page.getByTestId(/^notary-ack-[0-9a-f]/).filter({ hasText: 'Jane Seller · Deed' }).getByRole('button', { name: 'Regenerate' }).click()
    await expect(page.getByTestId(/^notary-ack-[0-9a-f]/).filter({ hasText: 'Jane Seller · Deed' }).locator('textarea')).toContainText('Jane Seller')
  })
})
