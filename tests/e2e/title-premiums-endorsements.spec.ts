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

async function createOrderWithUnderwriter(page: Page): Promise<string> {
  await loginAsSeededUser(page)
  await page.getByRole('link', { name: '+ New Order' }).click()
  await page.getByRole('button', { name: 'Create Order' }).click()
  await page.waitForURL('**/orders/**/order-entry')
  const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1] as string
  createdOrderIds.add(orderId)

  await page.goto(`/orders/${orderId}/contacts`)
  await page.getByText('Add a contact').click()
  await page.getByLabel('Role').click()
  await page.getByRole('option', { name: 'Underwriter', exact: true }).click()
  await page.getByLabel('Name').fill('Acme Title Underwriters')
  await page.getByRole('button', { name: 'Add Contact' }).click()
  await expect(page.getByTestId('contact-row').filter({ hasText: 'Acme Title Underwriters' })).toBeVisible()

  return orderId
}

test.afterAll(async () => {
  await deleteTrackedOrders()
})

test('nav shows Premiums & Endorsements under Title group', async ({ page }) => {
  const orderId = await createOrderWithUnderwriter(page)
  await page.goto(`/orders/${orderId}/order-entry`)
  const titleGroup = page.locator('div', { has: page.getByText('Title', { exact: true }) }).first()
  await expect(titleGroup.getByRole('link', { name: 'Premiums & Endorsements' })).toBeVisible()
})

test('add policy, edit fields, autosave persists after reload', async ({ page }) => {
  const orderId = await createOrderWithUnderwriter(page)
  await page.goto(`/orders/${orderId}/premiums`)

  await page.getByRole('button', { name: '+ Add Policy' }).click()
  await expect(page.getByTestId('premium-list').locator('[data-testid^="premium-"]')).toHaveCount(1)

  const card = page.getByTestId('premium-list').locator('[data-testid^="premium-"]').first()
  await card.locator('select[name="policy_type"]').selectOption("Owner's")
  await card.locator('select[name="underwriter_contact_id"]').selectOption({ label: 'Acme Title Underwriters' })
  await card.locator('input[name="coverage_amount"]').fill('300000')
  await card.locator('input[name="base_premium"]').fill('1200')
  await card.locator('input[name="final_premium"]').fill('1200')
  await card.locator('input[name="bill_code"]').fill('OP-1')
  await card.locator('input[name="bill_code"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedCard = page.getByTestId('premium-list').locator('[data-testid^="premium-"]').first()
  await expect(reloadedCard.locator('select[name="policy_type"]')).toHaveValue("Owner's")
  await expect(reloadedCard.locator('input[name="coverage_amount"]')).toHaveValue('300000')
  await expect(reloadedCard.locator('input[name="bill_code"]')).toHaveValue('OP-1')
})

test('add split under a policy', async ({ page }) => {
  const orderId = await createOrderWithUnderwriter(page)
  await page.goto(`/orders/${orderId}/premiums`)
  await page.getByRole('button', { name: '+ Add Policy' }).click()

  const card = page.getByTestId('premium-list').locator('[data-testid^="premium-"]').first()
  await card.getByRole('button', { name: '+ Add Split' }).click()
  await expect(card.locator('select[name="basis"]')).toHaveCount(1)

  await card.locator('select[name="basis"]').selectOption('Percent of Final Charge')
  await card.locator('input[name="percent"]').fill('50')
  await card.locator('input[name="percent"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedCard = page.getByTestId('premium-list').locator('[data-testid^="premium-"]').first()
  await expect(reloadedCard.locator('select[name="basis"]')).toHaveValue('Percent of Final Charge')
  await expect(reloadedCard.locator('input[name="percent"]')).toHaveValue('50')
})

test('add endorsement under a policy with its own split', async ({ page }) => {
  const orderId = await createOrderWithUnderwriter(page)
  await page.goto(`/orders/${orderId}/premiums`)
  await page.getByRole('button', { name: '+ Add Policy' }).click()

  const card = page.getByTestId('premium-list').locator('[data-testid^="premium-"]').first()
  await card.getByRole('button', { name: '+ Add Endorsement' }).click()

  await card.locator('input[name="code"]').fill('ALTA 9')
  await card.locator('input[name="description"]').fill('Restrictions, Encroachments, Minerals')
  await card.locator('input[name="charge"]').fill('75')
  await card.locator('input[name="charge"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedCard = page.getByTestId('premium-list').locator('[data-testid^="premium-"]').first()
  await expect(reloadedCard.locator('input[name="code"]')).toHaveValue('ALTA 9')
  await expect(reloadedCard.locator('input[name="charge"]')).toHaveValue('75')

  await reloadedCard.getByRole('button', { name: '+ Add Split' }).last().click()
  await expect(reloadedCard.locator('select[name="basis"]')).toHaveCount(1)
})

test('delete policy removes card', async ({ page }) => {
  const orderId = await createOrderWithUnderwriter(page)
  await page.goto(`/orders/${orderId}/premiums`)
  await page.getByRole('button', { name: '+ Add Policy' }).click()
  await expect(page.getByTestId('premium-list').locator('[data-testid^="premium-"]')).toHaveCount(1)

  await Promise.all([page.waitForNavigation(), page.getByRole('button', { name: 'Remove policy' }).click()])
  await expect(page.getByText('No policies yet.')).toBeVisible()
})
