# CDF Page 2 — Many-to-One Fee Line Merging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tier 5 item 18. Let any "Assign to CDF Page 2" flow (Premiums, Endorsements, Additional Title/Escrow Charges, Tax/Other Prorations, Recording) merge a fee onto an **existing** CDF Page 2 line instead of always creating a new one. When a line ends up with 2+ merged sources, its description auto-collapses to "Multiple Items." Traceability is kept via a per-line "Sources" expand (read-only) plus a page-level **Refresh** button that re-syncs every merged line's amount from its currently-linked sources on demand.

**Decisions made in chat (2026-09-11):**
- Merge amounts are a **one-time additive seed, not a live sync** — matches `assignNextCdfPage2Line`'s existing philosophy everywhere on this screen (Recording's `syncRecordingCdfLines` live-recompute pattern was considered and rejected as the model here — that pattern only works because it owns a fixed set of 3 known categories, not arbitrary user-chosen merges).
- Drift between a merged line and its sources (if a source's amount is edited after merging) is handled by one **page-level "Refresh" button** on CDF Page 2 — not a per-line button, not an auto-trigger on any file-close event (no such concept exists in this app today).

**Architecture:** No schema change beyond one new column. `cdf_page2_lines.source_count` tracks how many source rows are currently linked to each line (already-existing `cdf_page2_line_id` FKs on the 5 source tables have no unique constraint, so many-to-one was always structurally possible — it just needed the UI/action layer built). `CdfLineAssign.tsx`'s existing-line picker (today gated to sections with fixed rows only) becomes available on every section. A new shared set of actions in `cdf-page2.ts` handles merge/unmerge math and the bulk refresh; each of the 5 caller screens swaps its existing "link to existing line" wiring (already built for fixed sections on Tax Prorations; net-new for the other 4) to call these instead of the naive FK-only set today.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres), React (client components).

**Spec:** No separate spec file — bounded change approved in chat 2026-09-11. Source: [[Genesis Screen Notes - Fix Plan]] Tier 5, item 18 — "allow multiple fees to report to the same line," collapsing the description to "Multiple Items" when more than one fee lands on one line.

## Global Constraints

- **Allowlist of source tables** — the 5 tables carrying `cdf_page2_line_id`: `title_insurance_premiums`, `endorsements`, `additional_title_charges`, `tax_prorations`, `recording_documents`. New shared actions take a `sourceTable` parameter restricted to this literal union (never raw/interpolated from user input) so Supabase's `.from(sourceTable)` call stays type-safe and injection-safe.
- **Description auto-collapse is one-directional.** The moment a line's `source_count` crosses from 1 to 2+, its `description` is overwritten to `'Multiple Items'`. If a source is later unmerged and `source_count` drops back to 1, the description is **not** auto-reverted to the sole remaining source's own description — that would require looking up which source is "the other one" and isn't worth the extra query for a field staff can already freely retype. `ponytail: description doesn't un-collapse on the way back down to 1 source; upgrade path if ever needed is looking up the sole remaining source's row and restoring its description.`
- **Recording's category-sync lines (Section E's 3 fixed rows) are out of scope.** They already auto-aggregate every Recording document via `syncRecordingCdfLines` and render read-only on CDF Page 2 (see `CdfPage2Panel.tsx`'s `isRecordingComputed`) — this plan's merge/unmerge/refresh logic must not touch those 3 rows. Recording documents can still merge onto *other* CDF Page 2 lines (e.g., a manually-entered Section H fee) exactly like every other source table.
- **Unmerging when `source_count <= 1` keeps today's exact existing behavior** — delete the line outright if it isn't fixed (Cam's 2026-09-10 call: "the fee needs to come off the CD"), or just clear the FK if it's fixed (e.g., Section F's Prepaids). Only when `source_count > 1` does the new subtract-and-decrement path apply, so no caller's existing single-assignment behavior changes.
- **Refresh is manual and page-level, not per-line, not automatic.** One button on the CDF Page 2 screen re-syncs every line whose `source_count >= 1` from its currently-linked sources' current values; lines with 0 linked sources (manually added blank lines) are left untouched.

---

### Task 1: Migration — `source_count` column + backfill

**Files:**
- Create: `supabase/migrations/00XX_cdf_page2_line_merging.sql`
- Modify: `src/lib/types.ts` (`CdfPage2Line`)

- [ ] **Step 1: Find the real next migration number** — `ls supabase/migrations | sort -V | tail -3`.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/00XX_cdf_page2_line_merging.sql
-- Tier 5 item 18: many-to-one fee-line merging. source_count tracks how many source
-- rows (across the 5 tables carrying cdf_page2_line_id) are currently linked to each
-- line, so the assign/merge/unmerge actions know when to collapse the description to
-- "Multiple Items" and the Refresh button knows which lines to re-sync.
alter table cdf_page2_lines add column source_count integer not null default 0;

-- Backfill existing lines from their actual currently-linked sources (safe to run
-- whether or not any orders have used this screen yet).
update cdf_page2_lines l set source_count = (
  select count(*) from (
    select cdf_page2_line_id from title_insurance_premiums where cdf_page2_line_id = l.id
    union all
    select cdf_page2_line_id from endorsements where cdf_page2_line_id = l.id
    union all
    select cdf_page2_line_id from additional_title_charges where cdf_page2_line_id = l.id
    union all
    select cdf_page2_line_id from tax_prorations where cdf_page2_line_id = l.id
    union all
    select cdf_page2_line_id from recording_documents where cdf_page2_line_id = l.id
  ) s
);
```

- [ ] **Step 3: Apply the migration** (same workflow as prior plans' Task 1).

- [ ] **Step 4: Add `source_count: number` to `CdfPage2Line` in `src/lib/types.ts`.**

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00XX_cdf_page2_line_merging.sql src/lib/types.ts
git commit -m "feat: add source_count to cdf_page2_lines for fee-line merging"
```

---

### Task 2: `cdf-page2.ts` — merge, unmerge, and refresh-all actions

**Files:**
- Modify: `src/app/actions/cdf-page2.ts`

- [ ] **Step 1: Set `source_count: 1` on the existing single-assign path**

In `assignNextCdfPage2Line`'s insert, add `source_count: 1`.

- [ ] **Step 2: Add the source-table allowlist and split-math helper**

```typescript
const SOURCE_TABLES = [
  'title_insurance_premiums',
  'endorsements',
  'additional_title_charges',
  'tax_prorations',
  'recording_documents',
] as const
type SourceTable = (typeof SOURCE_TABLES)[number]

function splitBorrowerSeller(amount: number | null, sellerPayPercent?: number | null) {
  const pct = sellerPayPercent ? Math.min(Math.max(sellerPayPercent, 0), 100) / 100 : 0
  const seller = amount != null ? amount * pct : 0
  const borrower = amount != null ? amount - seller : 0
  return { borrower, seller }
}
```

- [ ] **Step 3: Add `mergeSourceIntoCdfPage2Line`**

```typescript
// Links a source row to an EXISTING CDF Page 2 line (any section, not just fixed rows)
// and additively seeds its amount into that line — one-time, same non-live-sync
// philosophy as assignNextCdfPage2Line, just merging into a line that may already
// carry other sources instead of always creating a fresh one.
export async function mergeSourceIntoCdfPage2Line(
  orderId: string,
  lineId: string,
  sourceTable: SourceTable,
  sourceRowId: string,
  amount?: number | null,
  sellerPayPercent?: number | null
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: line, error: lineError } = await supabase
    .from('cdf_page2_lines')
    .select('borrower_paid_at_closing, seller_paid_at_closing, source_count')
    .eq('id', lineId)
    .single()
  if (lineError || !line) return { error: 'Could not find that line.' }

  const { error: linkError } = await supabase.from(sourceTable).update({ cdf_page2_line_id: lineId }).eq('id', sourceRowId)
  if (linkError) return { error: 'Could not assign. Please try again.' }

  const { borrower, seller } = splitBorrowerSeller(amount ?? null, sellerPayPercent)
  const newCount = (line.source_count ?? 0) + 1

  const { error: updateError } = await supabase
    .from('cdf_page2_lines')
    .update({
      borrower_paid_at_closing: (line.borrower_paid_at_closing ?? 0) + borrower || null,
      seller_paid_at_closing: (line.seller_paid_at_closing ?? 0) + seller || null,
      source_count: newCount,
      ...(newCount >= 2 ? { description: 'Multiple Items' } : {}),
    })
    .eq('id', lineId)
  if (updateError) return { error: 'Could not merge onto that line. Please try again.' }

  revalidatePath(`/orders/${orderId}/cdf-page-2`)
  return {}
}
```

- [ ] **Step 4: Add `unmergeSourceFromCdfPage2Line`**

```typescript
// Reverses a merge (or a plain single assignment). If this source is the line's only
// one (source_count <= 1), behaves exactly like today: delete the line unless it's
// fixed. Otherwise subtracts this source's own contribution and decrements the count,
// leaving the still-merged remainder untouched (description does NOT un-collapse —
// see Global Constraints).
export async function unmergeSourceFromCdfPage2Line(
  orderId: string,
  lineId: string,
  sourceTable: SourceTable,
  sourceRowId: string,
  amount?: number | null,
  sellerPayPercent?: number | null
): Promise<{ error?: string }> {
  const supabase = await createClient()

  await supabase.from(sourceTable).update({ cdf_page2_line_id: null }).eq('id', sourceRowId)

  const { data: line } = await supabase
    .from('cdf_page2_lines')
    .select('is_fixed, borrower_paid_at_closing, seller_paid_at_closing, source_count')
    .eq('id', lineId)
    .single()
  if (!line) return {}

  if ((line.source_count ?? 0) <= 1) {
    if (!line.is_fixed) await supabase.from('cdf_page2_lines').delete().eq('id', lineId)
    else await supabase.from('cdf_page2_lines').update({ source_count: 0 }).eq('id', lineId)
    revalidatePath(`/orders/${orderId}/cdf-page-2`)
    return {}
  }

  const { borrower, seller } = splitBorrowerSeller(amount ?? null, sellerPayPercent)
  await supabase
    .from('cdf_page2_lines')
    .update({
      borrower_paid_at_closing: (line.borrower_paid_at_closing ?? 0) - borrower || null,
      seller_paid_at_closing: (line.seller_paid_at_closing ?? 0) - seller || null,
      source_count: line.source_count - 1,
    })
    .eq('id', lineId)

  revalidatePath(`/orders/${orderId}/cdf-page-2`)
  return {}
}
```

- [ ] **Step 5: Add `listCdfPage2LineSources` (traceability) and `refreshAllCdfPage2Lines` (page-level Refresh)**

```typescript
type LineSource = { table: SourceTable; id: string; description: string | null; amount: number | null; sellerPayPercent: number | null }

// Fan-out read across the 5 source tables for one line — powers both the "Sources"
// expand on CDF Page 2 and refreshAllCdfPage2Lines below. Each table's own
// description/amount/seller_pay_percent column names differ, hence the per-table
// select+map instead of one generic query.
async function fetchSourcesForLine(lineId: string): Promise<LineSource[]> {
  const supabase = await createClient()
  const [premiums, endorsements, charges, prorations, recordingDocs] = await Promise.all([
    supabase.from('title_insurance_premiums').select('id, policy_type, final_premium, base_premium').eq('cdf_page2_line_id', lineId),
    supabase.from('endorsements').select('id, description, charge').eq('cdf_page2_line_id', lineId),
    supabase.from('additional_title_charges').select('id, description, charge, seller_pay_percent').eq('cdf_page2_line_id', lineId),
    supabase.from('tax_prorations').select('id, description, prorated_amount').eq('cdf_page2_line_id', lineId),
    supabase.from('recording_documents').select('id, document_description, fee, seller_pay_percent').eq('cdf_page2_line_id', lineId),
  ])
  return [
    ...(premiums.data ?? []).map((r) => ({ table: 'title_insurance_premiums' as const, id: r.id, description: r.policy_type, amount: r.final_premium ?? r.base_premium, sellerPayPercent: null })),
    ...(endorsements.data ?? []).map((r) => ({ table: 'endorsements' as const, id: r.id, description: r.description, amount: r.charge, sellerPayPercent: null })),
    ...(charges.data ?? []).map((r) => ({ table: 'additional_title_charges' as const, id: r.id, description: r.description, amount: r.charge, sellerPayPercent: r.seller_pay_percent })),
    ...(prorations.data ?? []).map((r) => ({ table: 'tax_prorations' as const, id: r.id, description: r.description, amount: r.prorated_amount, sellerPayPercent: null })),
    ...(recordingDocs.data ?? []).map((r) => ({ table: 'recording_documents' as const, id: r.id, description: r.document_description, amount: r.fee, sellerPayPercent: r.seller_pay_percent })),
  ]
}

export async function listCdfPage2LineSources(lineId: string): Promise<LineSource[]> {
  return fetchSourcesForLine(lineId)
}

// The page-level Refresh button: re-sums every line with source_count >= 1 from its
// sources' CURRENT values, overwriting drift accumulated since the one-time merge
// seed. Recording's 3 fixed Section E category lines are skipped — they're already
// kept live by syncRecordingCdfLines and render read-only on this screen.
export async function refreshAllCdfPage2Lines(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: lines } = await supabase
    .from('cdf_page2_lines')
    .select('id, section, description')
    .eq('order_id', orderId)
    .gt('source_count', 0)

  for (const line of lines ?? []) {
    if (line.section === 'E') continue // Recording's own live sync owns these.
    const sources = await fetchSourcesForLine(line.id)
    const totals = sources.reduce(
      (acc, s) => {
        const { borrower, seller } = splitBorrowerSeller(s.amount, s.sellerPayPercent)
        return { borrower: acc.borrower + borrower, seller: acc.seller + seller }
      },
      { borrower: 0, seller: 0 }
    )
    await supabase
      .from('cdf_page2_lines')
      .update({
        borrower_paid_at_closing: totals.borrower || null,
        seller_paid_at_closing: totals.seller || null,
        source_count: sources.length,
      })
      .eq('id', line.id)
  }

  revalidatePath(`/orders/${orderId}/cdf-page-2`)
  return {}
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/cdf-page2.ts
git commit -m "feat: merge/unmerge/refresh actions for CDF Page 2 many-to-one fee lines"
```

---

### Task 3: `CdfLineAssign.tsx` — existing-line picker on every section

**Files:**
- Modify: `src/components/title/CdfLineAssign.tsx`

- [ ] **Step 1: Widen the existing-line picker to all sections, add a New/Existing mode toggle**

Today the component only shows the existing-line picker when `fixedLinesInSection.length > 0` (Section F's Prepaids). Replace that gating with a mode toggle so every section offers both:

```tsx
const [mode, setMode] = useState<'new' | 'existing'>('new')
const linesInSection = useMemo(() => cdfLines.filter((l) => l.section === section).sort((a, b) => a.sort_order - b.sort_order), [cdfLines, section])
```

Render a small `New Line` / `Existing Line` radio pair above the section `<select>`; when `mode === 'existing'`, show a picker over `linesInSection` (not just `fixedLinesInSection`) with each option labeled `l.is_fixed ? l.description : \`Line ${l.sort_order}\${l.description ? ' — ' + l.description : ''}\`\`, and the button calls `onLinkExisting` (unchanged prop name/signature) instead of `onAssign`. Keep the `fixedLinesInSection`-only case working exactly as today when `mode` isn't touched by a caller that doesn't pass `onLinkExisting` (Premiums today) — Task 4 adds that prop everywhere.

- [ ] **Step 2: Commit**

```bash
git add src/components/title/CdfLineAssign.tsx
git commit -m "feat: allow merging onto an existing CDF Page 2 line in any section"
```

---

### Task 4: Wire `onLinkExisting`/unmerge into all 5 source screens

**Files:**
- Modify: `src/components/title/PremiumsPanel.tsx` (2 call sites: premium, endorsement)
- Modify: `src/components/title/AdditionalChargesPanel.tsx`
- Modify: `src/components/title/TaxProrationsPanel.tsx` (already has `onLinkExisting` — replace its naive FK-only body)
- Modify: `src/components/title/RecordingPanel.tsx`

Each call site's `onAssign` stays as-is (still creates a fresh line via `assignNextCdfPage2Line`, now implicitly `source_count: 1` per Task 2 Step 1 — no caller change needed there). Add or replace `onLinkExisting` and `onUnassign` per this table (amount/description/seller-pay field names confirmed from each panel's own source row):

| Screen | Source table | Row id / description / amount / seller% fields |
|---|---|---|
| `PremiumsPanel.tsx` (premium block, ~L327) | `title_insurance_premiums` | `premium.id`, `premium.policy_type`, `premium.final_premium ?? premium.base_premium`, none |
| `PremiumsPanel.tsx` (endorsement block, ~L113) | `endorsements` | `endorsement.id`, `endorsement.description`, `endorsement.charge`, none |
| `AdditionalChargesPanel.tsx` (~L118) | `additional_title_charges` | `charge.id`, `charge.description`, `charge.charge`, `charge.seller_pay_percent` |
| `TaxProrationsPanel.tsx` (~L274) | `tax_prorations` | `proration.id`, `proration.description`, `proration.prorated_amount`, none |
| `RecordingPanel.tsx` | `recording_documents` | `doc.id`, `doc.document_description`, `doc.fee`, `doc.seller_pay_percent` |

- [ ] **Step 1: For each row above, add/replace:**

```tsx
onLinkExisting={async (lineId) => {
  await mergeSourceIntoCdfPage2Line(orderId, lineId, '<source table>', <row>.id, <amount field>, <seller% field or undefined>)
  refresh()
}}
onUnassign={async () => {
  await unmergeSourceFromCdfPage2Line(orderId, <cdfLineId prop's current value>, '<source table>', <row>.id, <amount field>, <seller% field or undefined>)
  refresh()
}}
```

(`TaxProrationsPanel.tsx` already has an `onLinkExisting` — replace its body, which today only calls `setProrationCdfLine`, with the block above. Its `onUnassign` similarly swaps `setProrationCdfLine(orderId, proration.id, null)` for the new `unmergeSourceFromCdfPage2Line` call.)

- [ ] **Step 2: Import `mergeSourceIntoCdfPage2Line`/`unmergeSourceFromCdfPage2Line` from `@/app/actions/cdf-page2` in each modified file.**

- [ ] **Step 3: Commit**

```bash
git add src/components/title/PremiumsPanel.tsx src/components/title/AdditionalChargesPanel.tsx src/components/title/TaxProrationsPanel.tsx src/components/title/RecordingPanel.tsx
git commit -m "feat: wire fee-line merging into Premiums, Endorsements, Additional Charges, Tax Prorations, Recording"
```

---

### Task 5: `CdfPage2Panel.tsx` — "Sources" traceability expand + page-level Refresh button

**Files:**
- Modify: `src/components/title/CdfPage2Panel.tsx`

- [ ] **Step 1: Add a "Sources" expand on any line with `source_count > 1`**

In `LineRow`, next to the description input, when `line.source_count > 1` render a small `({line.source_count} items) ▾` toggle; on expand, call `listCdfPage2LineSources(line.id)` and list each source's description/amount read-only underneath the row.

- [ ] **Step 2: Add the page-level Refresh button**

Near the screen's top-level totals bar, add a `Refresh` button that calls `refreshAllCdfPage2Lines(orderId)` then `refresh()` (the existing `window.location.reload()` helper already used throughout this panel).

- [ ] **Step 3: Run the app locally and sanity-check by eye**

`npm run dev`. On a seeded order: assign two Additional Charges to the same new Section H line via "Existing Line," confirm the description becomes "Multiple Items" and the amount is the sum of both. Edit one charge's amount on its own screen, click page-level Refresh on CDF Page 2, confirm the merged line's amount updates to match. Unmerge one of the two — confirm the line survives with the remaining source's amount and stays "Multiple Items" (not reverted). Unmerge the last one — confirm the line is deleted (matching today's single-assignment behavior).

- [ ] **Step 4: Commit**

```bash
git add src/components/title/CdfPage2Panel.tsx
git commit -m "feat: CDF Page 2 fee-line merge traceability and page-level Refresh"
```

---

### Task 6: e2e test

**Files:**
- Modify: `tests/e2e/cdf-page2.spec.ts` (or wherever existing CDF Page 2 coverage lives)

- [ ] **Step 1: Write a test** covering: merge two Additional Charges onto one line → description reads "Multiple Items," amount is the sum; unmerge one → line survives with the other's amount; click Refresh after editing a linked source's amount elsewhere → merged line's amount updates.

- [ ] **Step 2: Run it, confirm PASS.**

- [ ] **Step 3: Commit.**
