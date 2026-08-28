import { test, expect } from '@playwright/test'

function uniqueEmail() {
  // NOTE: @example.com is deliberately avoided — Supabase Auth (GoTrue) hard-rejects
  // RFC 2606 reserved test domains (example.com/.org/.net) with error_code
  // "email_address_invalid" regardless of project config. Using a non-reserved
  // placeholder domain instead so signUp() actually reaches account creation.
  return `genesis-test-${Date.now()}@genesis-app-e2e-test.dev`
}

const TEST_PASSWORD = 'TestPassword123!'

test.describe('Genesis foundation phase', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/orders')
    await page.waitForURL('**/login**')
    await expect(page.getByRole('heading', { name: 'Genesis — Sign In' })).toBeVisible()
  })

  test('sign up and log in', async ({ page }) => {
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

  test('create an order', async ({ page }) => {
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

    await page.getByRole('link', { name: '+ New Order' }).click()
    await page.waitForURL('**/orders/new')

    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('Purchase Price').fill('250000')
    await page.getByLabel('Property Address').fill('123 Main St')
    await page.getByRole('button', { name: 'Create Order' }).click()

    await page.waitForURL('**/orders/**')
    await expect(page.getByRole('heading', { name: `Order ${fileNumber}` })).toBeVisible()
  })
})
