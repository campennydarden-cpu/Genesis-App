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

// Smallest valid PDF byte sequence that pdf.js can actually open — needed so the
// preview test exercises real rendering, not just a stubbed-out file.
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF'
)

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

async function createOrderAndOpenAttachments(page: Page): Promise<string> {
  await loginAsSeededUser(page)
  await page.getByRole('link', { name: '+ New Order' }).click()
  await page.getByRole('button', { name: 'Create Order' }).click()
  await page.waitForURL('**/orders/**/order-entry')
  const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1] as string
  createdOrderIds.add(orderId)
  await page.getByTestId('toolbar-tab-attachments').click()
  await expect(page.getByTestId('attachments-panel')).toBeVisible()
  return orderId
}

test.describe('Attachments', () => {
  test.beforeEach(async ({ page }) => {
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return
      const match = frame.url().match(/\/orders\/([^/?#]+)\/order-entry/)
      if (match) createdOrderIds.add(match[1])
    })
  })

  test.afterAll(async () => {
    await deleteTrackedOrders()
  })

  test('new order gets the firm folder template copied, including the nested sub-folder', async ({ page }) => {
    await createOrderAndOpenAttachments(page)

    await expect(page.getByTestId('folder-tree').getByText('Title Docs')).toBeVisible()
    await expect(page.getByTestId('folder-tree').getByText('Title Work')).toBeVisible()
    await expect(page.getByTestId('folder-tree').getByText('Trash')).toBeVisible()
  })

  test('upload, preview, search, move to Trash, and restore', async ({ page }) => {
    await createOrderAndOpenAttachments(page)

    await page.getByTestId('folder-tree').getByText('Contracts', { exact: true }).click()
    await page.getByRole('button', { name: 'Upload' }).click()
    await page.setInputFiles('#attachment-file', {
      name: 'sample-contract.pdf',
      mimeType: 'application/pdf',
      buffer: MINIMAL_PDF,
    })
    await page.getByLabel('Description').fill('Test contract upload')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.getByTestId('attachment-list')).toContainText('sample-contract.pdf')

    await page.getByRole('button', { name: 'sample-contract.pdf' }).click()
    await expect(page.getByTestId('pdf-preview-canvas')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByTestId('folder-tree').getByText('Post-Closing', { exact: true }).click()
    await page.getByLabel('Search attachments').fill('sample-contract')
    await expect(page.getByTestId('attachment-list')).toContainText('sample-contract.pdf')
    await expect(page.getByTestId('attachment-list')).toContainText('Contracts')
    await page.getByLabel('Search attachments').fill('')

    await page.getByTestId('folder-tree').getByText('Contracts', { exact: true }).click()
    await page.getByLabel('Move sample-contract.pdf').selectOption({ label: 'Trash' })
    await expect(page.getByTestId('attachment-list')).not.toContainText('sample-contract.pdf')
    await page.getByTestId('folder-tree').getByText('Trash', { exact: true }).click()
    await expect(page.getByTestId('attachment-list')).toContainText('sample-contract.pdf')
    await page.getByLabel('Move sample-contract.pdf').selectOption({ label: 'Contracts' })
    await expect(page.getByTestId('attachment-list')).not.toContainText('sample-contract.pdf')
    await page.getByTestId('folder-tree').getByText('Contracts', { exact: true }).click()
    await expect(page.getByTestId('attachment-list')).toContainText('sample-contract.pdf')
  })

  test('rejects a disallowed file type and an oversized file', async ({ page }) => {
    await createOrderAndOpenAttachments(page)

    await page.getByTestId('folder-tree').getByText('Contracts', { exact: true }).click()
    await page.getByRole('button', { name: 'Upload' }).click()
    await page.setInputFiles('#attachment-file', {
      name: 'malware.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('not really an executable'),
    })
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.getByText('That file type is not allowed.')).toBeVisible()

    await page.setInputFiles('#attachment-file', {
      name: 'huge.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(26 * 1024 * 1024, 1),
    })
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.getByText(/File is too large/)).toBeVisible()
  })

  test('folder-templates admin screen redirects a user without the permission', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto('/admin/folder-templates')
    await page.waitForURL('**/orders')
  })
})
