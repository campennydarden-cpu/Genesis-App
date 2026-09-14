import { test, expect } from '@playwright/test'

test("adding a loan seeds Principal Amount from the order's Loan Amount", async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('genesis-e2e-seed@genesis-app-e2e-test.dev')
  await page.getByLabel('Password').fill('E2eSeedPass123!')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/orders')

  await page.goto('/orders')
  await page.getByRole('link', { name: /26-00001NC/ }).click()
  await page.getByRole('link', { name: 'Loan Information & Funding' }).click()

  await page.getByRole('button', { name: '+ Add Loan' }).click()
  await page.waitForSelector('[data-testid^="loan-row-"]')

  const principalInput = page.locator('[data-testid^="loan-row-"] input[name="principal_amount"]')
  await expect(principalInput).not.toHaveValue('')

  // Cleanup: remove the loan this test created.
  page.on('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Remove' }).click()
})
