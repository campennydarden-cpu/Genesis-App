// tests/e2e/commitment-document.spec.ts
// Requires a running local ONLYOFFICE Document Server (ONLYOFFICE_DOCUMENT_SERVER_URL)
// and a seeded commitment template (scripts/upload-commitment-template.mjs) —
// this suite talks to the real Document Server, not a mock, matching this
// codebase's existing preference for full Playwright user-flow coverage over
// unit tests (see Attachments Core plan's Global Constraints).
import { test, expect, type Page } from '@playwright/test'
import { readFileSync, statSync } from 'node:fs'

// Same seeded account every sibling spec.ts under tests/e2e uses (see e.g.
// tests/e2e/attachments.spec.ts) — the app's middleware (src/lib/supabase/middleware.ts)
// redirects any unauthenticated request to /login, so this is the "exact
// fixture/seed call used elsewhere" the plan's Step 1 comment points at.
// TEST_ORDER_ID/TEST_ORDER_ID_WITH_DIVERGENCE are pre-seeded orders (not
// created per-test like other specs), owned by this same seeded account.
const SEEDED_EMAIL = 'genesis-e2e-seed@genesis-app-e2e-test.dev'
const SEEDED_PASSWORD = 'E2eSeedPass123!'

async function loginAsSeededUser(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(SEEDED_EMAIL)
  await page.getByLabel('Password').fill(SEEDED_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/orders')
}

test.describe('Commitment Document', () => {
  test('generating a document shows the embedded editor and no error', async ({ page }) => {
    // Assumes a seeded test order with commitment_sch_a filled in — reuse this
    // codebase's existing test-order seeding convention (see any sibling
    // *.spec.ts under tests/ for the exact fixture/seed call used elsewhere).
    const testOrderId = process.env.TEST_ORDER_ID
    test.skip(!testOrderId, 'TEST_ORDER_ID not set — see tests/ setup docs')

    await loginAsSeededUser(page)
    await page.goto(`/orders/${testOrderId}/commitment-document`)
    // TEST_ORDER_ID is a long-lived, previously-merged fixture (other tasks'
    // manual verification already generated a document for it), so the button
    // reads "Refresh from current data" rather than "Generate document" -- both
    // labels invoke the identical mergeCommitmentDocument action (see
    // CommitmentDocumentEditor.tsx), so either is the correct target here.
    await page.getByRole('button', { name: /^(Generate document|Refresh from current data)$/ }).click()
    await expect(page.locator('#onlyoffice-editor-container iframe')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/could not merge/i)).not.toBeVisible()
  })

  test('divergent fields surface in the review panel with accept/reject controls', async ({ page }) => {
    const testOrderId = process.env.TEST_ORDER_ID_WITH_DIVERGENCE
    test.skip(!testOrderId, 'TEST_ORDER_ID_WITH_DIVERGENCE not set — see tests/ setup docs')

    await loginAsSeededUser(page)
    await page.goto(`/orders/${testOrderId}/commitment-document`)
    await expect(page.getByText(/field.*changed inside the document/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Accept' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reject' }).first()).toBeVisible()
  })

  test('exporting produces a downloadable PDF', async ({ page }) => {
    const testOrderId = process.env.TEST_ORDER_ID
    test.skip(!testOrderId, 'TEST_ORDER_ID not set — see tests/ setup docs')
    // Default 30s test timeout is too tight here: this test does a real merge
    // round trip *and* a real PDF export round trip (docbuilder open + save +
    // fetch + storage upload + re-sign), each against the live Document
    // Server -- confirmed by measurement to sometimes exceed 30s combined.
    test.setTimeout(90_000)

    await loginAsSeededUser(page)
    await page.goto(`/orders/${testOrderId}/commitment-document`)
    // Same pre-merged-fixture reasoning as the first test above.
    await page.getByRole('button', { name: /^(Generate document|Refresh from current data)$/ }).click()
    await expect(page.locator('#onlyoffice-editor-container iframe')).toBeVisible({ timeout: 15000 })

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export PDF' }).click().then(() => page.getByRole('link', { name: 'Download PDF' }).click()),
    ])
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)

    // A matching filename isn't proof of a real file -- Playwright's `download`
    // event fires on the browser's download disposition regardless of body
    // content, so a 0-byte or corrupted download would still pass the check
    // above. Verify actual bytes: non-empty, and starting with the PDF magic
    // number (same `%PDF-` signature this codebase already uses to build a
    // minimal real PDF fixture in tests/e2e/attachments.spec.ts's MINIMAL_PDF).
    const downloadPath = await download.path()
    expect(downloadPath).not.toBeNull()
    const stats = statSync(downloadPath!)
    expect(stats.size).toBeGreaterThan(0)
    const header = readFileSync(downloadPath!).subarray(0, 5).toString('ascii')
    expect(header).toBe('%PDF-')
  })
})
