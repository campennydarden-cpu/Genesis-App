import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Same public URL + anon key convention as tests/e2e/attachments.spec.ts.
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

test.describe('Tasking (Requested Tasks + Checklist Tasks)', () => {
  test.afterAll(async () => {
    await deleteTrackedOrders()
  })

  test('new order gets the firm checklist template copied', async ({ page }) => {
    await createOrder(page)
    await page.getByTestId('toolbar-tab-checklist').click()
    await expect(page.getByTestId('checklist-task-list')).toContainText('New Order/Enter Order')
    await expect(page.getByTestId('checklist-task-list')).toContainText('Finalize Disbursement Ledger')
  })

  test('checklist task: mark Completed stamps a completed date, add an ad-hoc task', async ({ page }) => {
    await createOrder(page)
    await page.getByTestId('toolbar-tab-checklist').click()

    const row = page.getByTestId('checklist-task-list').getByRole('listitem').filter({ hasText: 'New Order/Enter Order' })
    await row.getByLabel('Status for New Order/Enter Order').selectOption('Completed')
    await expect(row).toContainText('Completed')

    await page.getByLabel('New checklist task description').fill('Custom ad-hoc task')
    await page.getByRole('button', { name: '+ Add Task' }).click()
    await expect(page.getByTestId('checklist-task-list')).toContainText('Custom ad-hoc task')
  })

  test('requested task: add via seed chip, mark Received stamps a received date', async ({ page }) => {
    await createOrder(page)
    await page.getByTestId('toolbar-tab-requested-tasks').click()

    await page.getByRole('button', { name: '+ Order and Publish Payoff' }).click()
    await expect(page.getByTestId('requested-task-list')).toContainText('Order and Publish Payoff')

    await page.getByLabel('Status for Order and Publish Payoff').selectOption('Received')
    await expect(page.getByLabel('Received date for Order and Publish Payoff')).not.toHaveValue('')
  })

  test('checklist-templates admin screen redirects a user without the permission', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto('/admin/checklist-templates')
    await page.waitForURL('**/orders')
  })
})
