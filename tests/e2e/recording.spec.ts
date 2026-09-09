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

test('nav shows Recording under Escrow / Closing group', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/order-entry`)
  const group = page.locator('div', { has: page.getByText('Escrow / Closing', { exact: true }) }).first()
  await expect(group.getByRole('link', { name: 'Recording' })).toBeVisible()
})

test('add recording document, edit, autosave persists, delete', async ({ page }) => {
  const orderId = await createOrder(page)
  await page.goto(`/orders/${orderId}/recording`)

  await page.getByRole('button', { name: '+ Add Document' }).click()
  await expect(page.getByTestId('recording-doc-list').locator('[data-testid^="recording-doc-"]')).toHaveCount(1)

  const row = page.getByTestId('recording-doc-list').locator('[data-testid^="recording-doc-"]').first()
  await row.locator('select[name="document_description"]').selectOption('Deed')
  await row.locator('select[name="status"]').selectOption('Recorded')
  await row.locator('input[name="instrument_number"]').fill('2026-000123')
  await row.locator('input[name="instrument_number"]').blur()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  const reloadedRow = page.getByTestId('recording-doc-list').locator('[data-testid^="recording-doc-"]').first()
  await expect(reloadedRow.locator('select[name="document_description"]')).toHaveValue('Deed')
  await expect(reloadedRow.locator('select[name="status"]')).toHaveValue('Recorded')
  await expect(reloadedRow.locator('input[name="instrument_number"]')).toHaveValue('2026-000123')

  await Promise.all([page.waitForNavigation(), reloadedRow.getByRole('button', { name: 'Remove document' }).click()])
  await expect(page.getByTestId('recording-doc-list').getByText('No documents yet.')).toBeVisible()
})
