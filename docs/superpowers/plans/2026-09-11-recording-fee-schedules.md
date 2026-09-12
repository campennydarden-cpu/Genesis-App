# Recording Fee Schedules (Refinance Tax Exemptions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff pick a "Fee Schedule" (Standard / a refinance exemption / an outright exemption) for a Mortgage recording document, so states that reduce or waive their loan-amount-based recordation tax on certain refinances (GA, VA) compute the reduced tax automatically instead of staff hand-calculating it — while every other state's Recording tab is untouched.

**Architecture:** A new `fee_schedules` table (pure data — which schedules exist per state, and which of 3 fixed computation modes each uses) plus a `fee_schedule_id` FK on `recording_documents`. `matchRecordingRate` (`src/lib/recording-rates.ts`) gains two new optional parameters so its existing per-state/county recordation-tax row summation can be pointed at a different tax base (or skipped entirely) without changing how it works for every order that never touches a Fee Schedule. `RecordingPanel.tsx` gets a new dropdown, shown only for Mortgage documents in a state that has schedules on file.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres), React (client component), Playwright e2e.

**Spec:** [[Fee Schedules & Loan-Amount Tax Exemptions - Design]] (`M&L Title - Obsidian Vault/Fee Schedules & Loan-Amount Tax Exemptions - Design.md`), approved 2026-09-09. This plan implements that design with one deliberate deviation and one scope narrowing — both called out under Global Constraints below, since they change what the approved design describes.

## Global Constraints

- **Migration filename number is not `0054`/`0055`** — those are reserved by `docs/superpowers/plans/2026-09-10-staff-directory-permissions.md`. Run `ls supabase/migrations | sort -V | tail -3` before writing the migration file and use the real next number. If `docs/superpowers/plans/2026-09-11-settlement-format-policy-type-defaults.md` has already been executed by the time this plan runs, account for its migration too.
- **Deviation from the approved design — no `recordation_tax_schedule_id` FK on `fee_schedules`.** The design's schema section proposes `fee_schedules.recordation_tax_schedule_id uuid references recordation_tax_schedules(id)` (one specific rate row per schedule). That doesn't fit the data that already exists: Virginia's "standard" recordation tax is the *sum* of two distinct `recordation_tax_schedules` rows (State Recordation Tax + Local Recordation Tax, both always apply together — see migration `0049`), and `matchRecordingRate`'s existing `sumTaxRows` helper already sums however many state/county rows apply, generically, without needing a specific row pointed at. Pointing `fee_schedules` at a single row would silently drop Virginia's Local Recordation Tax whenever a Fee Schedule is selected. Task 2 below instead has the Fee Schedule's `tax_computation_mode` change the **tax base** fed into the existing, unmodified row-summation logic — same rate rows always apply, only the number they're multiplied against changes. `fee_schedules` therefore has no `recordation_tax_schedule_id` column at all.
- **Scope narrowing — Florida is not seeded.** The design's own Open Items list FL's refinance exemption as unverified ("Cam believes... but this needs the same statute-sourced research pass... before it's seeded as real data"). This plan seeds only Georgia and Virginia, which have confirmed statute citations already in `recordation_tax_schedules`/migration `0049`. Seeding FL is a follow-up once that research pass happens — do not guess at its rule here.
- **NC, SC, TN get zero `fee_schedules` rows** — those states have no loan-amount-based recordation tax at all (per the design's own Edge Cases section and the base-rate seed data in migration `0049`), so there is nothing to schedule. Per the same Edge Cases section, this plan resolves the "hide vs. show empty" UI question as **hide entirely**: the Fee Schedule dropdown does not render at all for a document whose order's `property_state` has zero `fee_schedules` rows.
- `fee_schedules.document_type` is always the literal string `'Mortgage'` — the same generic category `recording_documents.document_description` and `RECORDING_DOCUMENT_TYPES` already use everywhere else in this feature area (`src/lib/constants.ts`, `RecordingPanel.tsx`, `recording-rates.ts`), not the state-specific `'Deed of Trust/Mortgage'` wording the design doc used loosely. A loan-amount tax exemption never touches any other Recording document category, so this column exists for schema clarity/future-proofing, not because it varies yet.
- Per the design's edge case: if `new_money_only` is picked but the order has no payoff row at all, fall back to the full loan amount and show a visible warning — never silently zero.
- Requirements conditions (e.g. VA's "1st lien only, prior DOT open of record") are **documentation only** — shown as helper text so staff can self-check eligibility. The system does not independently validate lien position or track prior-lien status. This matches the design's Option-1 choice.

---

### Task 1: Migration — `fee_schedules` table, `recording_documents.fee_schedule_id`, GA/VA seed data

**Files:**
- Create: `supabase/migrations/00XX_fee_schedules.sql` (replace `00XX` with the real next number per Global Constraints)
- Modify: `src/lib/types.ts` (new `FeeSchedule` type, `RecordingDocument.fee_schedule_id`)

**Interfaces:**
- Produces: `public.fee_schedules` table, `recording_documents.fee_schedule_id` column, `FeeSchedule` TypeScript type, `RecordingDocument.fee_schedule_id: string | null` — consumed by Task 2 (`recording-rates.ts`), Task 3 (`recording.ts`), Task 4 (`RecordingPanel.tsx`).

- [ ] **Step 1: Find the real next migration number**

Run: `ls supabase/migrations | sort -V | tail -3`

Use whatever number comes after the highest one listed in place of `00XX` below.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/00XX_fee_schedules.sql
-- Fee Schedules & Loan-Amount Tax Exemptions (vault design, approved 2026-09-09; this
-- migration implements it with one deviation -- see the implementation plan's Global
-- Constraints for why there is no recordation_tax_schedule_id FK here). Lets staff pick
-- a named schedule per Mortgage recording document, which src/lib/recording-rates.ts
-- (Task 2 of the same plan) uses to change the recordation-tax BASE it computes against
-- -- the same recordation_tax_schedules rows for that state/county still apply, summed
-- the same way as every order that never touches this table.
create table public.fee_schedules (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  document_type text not null default 'Mortgage' check (document_type = 'Mortgage'),
  name text not null,
  tax_computation_mode text not null check (tax_computation_mode in ('standard', 'new_money_only', 'exempt')),
  is_default boolean not null default false,
  requirements_note text,
  notes text,
  source_url text,
  verified boolean not null default true,
  verified_date date,
  created_at timestamptz not null default now()
);

create index fee_schedules_state_idx on public.fee_schedules(state, document_type);

alter table public.recording_documents
  add column fee_schedule_id uuid references public.fee_schedules(id);

alter table public.fee_schedules enable row level security;
create policy "Authenticated M&L staff can do anything with fee_schedules"
  on public.fee_schedules for all to authenticated using (true) with check (true);

-- ============================================================
-- Georgia -- O.C.G.A. § 48-6-61 (Intangible Recording Tax). Base rate already in
-- recordation_tax_schedules from migration 0049; this only adds the exemption layer.
-- ============================================================
insert into public.fee_schedules
  (state, name, tax_computation_mode, is_default, requirements_note, verified_date, source_url) values
  ('GA', 'Standard', 'standard', true, null, '2026-09-11', 'https://dor.georgia.gov'),
  ('GA', 'Refinance – Same Lender', 'new_money_only', false,
   'O.C.G.A. § 48-6-61: on a refinance with the SAME lender, Intangible Recording Tax applies only to the increase over the existing loan balance, not the full new loan amount. Confirm the new lender is in fact the same lender as the loan being refinanced before selecting this.',
   '2026-09-11', 'https://dor.georgia.gov'),
  ('GA', 'Refinance – Federal Credit Union', 'exempt', false,
   'Federal credit unions are exempt from GA Intangible Recording Tax entirely, by federal preemption -- unrelated to the same-lender reduction above. NOTE: the exact trigger (whether this covers the loan''s originating federal credit union only, or also a federal credit union taking assignment) has not been independently confirmed against the statute -- verify before relying on this for an unusual case.',
   '2026-09-11', 'https://dor.georgia.gov');

-- ============================================================
-- Virginia -- Va. Code § 58.1-803(E). Base rate already in recordation_tax_schedules
-- from migration 0049 (State Recordation Tax + Local Recordation Tax rows, both always
-- apply and are summed by matchRecordingRate's existing sumTaxRows -- unaffected by
-- fee_schedules, per this plan's Global Constraints deviation note).
-- ============================================================
insert into public.fee_schedules
  (state, name, tax_computation_mode, is_default, requirements_note, verified_date, source_url) values
  ('VA', 'Standard', 'standard', true, null, '2026-09-11', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-803/'),
  ('VA', 'Refinance – Same Lender, 1st Lien', 'new_money_only', false,
   'Va. Code § 58.1-803(E): reduced recordation tax on a refinance, but only when there is an open Deed of Trust of record being refinanced, only on a 1st-lien refinance (not a 2nd), and -- following the same-lender pattern used elsewhere -- likely requires the same lender. These conditions are Cam''s own stated understanding and have NOT been independently re-verified against the statute text (the base rate itself, $0.25/$100, is already statute-sourced) -- verify eligibility directly before relying on this for an unusual case.',
   '2026-09-11', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-803/');

-- Florida is deliberately NOT seeded here -- its refinance exemption rule is unverified
-- (design doc Open Item #1). North Carolina, South Carolina, and Tennessee have no
-- loan-amount-based recordation tax at all, so they get no rows either.
```

- [ ] **Step 3: Apply the migration**

Use whichever Supabase migration-apply workflow this project already uses for prior migrations (check `docs/superpowers/plans/2026-09-10-staff-directory-permissions.md` Task 1 Step 5 for the exact command).

- [ ] **Step 4: Add the `FeeSchedule` type and extend `RecordingDocument`**

In `src/lib/types.ts`, add a new type near `RecordingDocument` (currently around line 768):

```typescript
export type FeeSchedule = {
  id: string
  state: string
  document_type: string
  name: string
  tax_computation_mode: 'standard' | 'new_money_only' | 'exempt'
  is_default: boolean
  requirements_note: string | null
}
```

Add `fee_schedule_id` to the existing `RecordingDocument` type (after `cdf_page2_line_id`):

```typescript
export type RecordingDocument = {
  id: string
  order_id: string
  sort_order: number
  document_description: string | null
  county: string | null
  status: string
  date_submitted: string | null
  date_recorded: string | null
  instrument_number: string | null
  book: string | null
  page: string | null
  number_of_pages: number | null
  e_recording_reference: string | null
  fee: number | null
  recordation_tax: number | null
  transfer_tax: number | null
  stamp_tax: number | null
  seller_pay_percent: number | null
  cdf_page2_line_id: string | null
  fee_schedule_id: string | null
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00XX_fee_schedules.sql src/lib/types.ts
git commit -m "feat: add fee_schedules table with GA/VA refinance exemption data"
```

---

### Task 2: `recording-rates.ts` — recordation-tax base override and exemption

**Files:**
- Modify: `src/lib/recording-rates.ts`

**Interfaces:**
- Consumes: nothing new (pure function, no DB access).
- Produces: `matchRecordingRate`'s `params` gains `recordationTaxBase?: number | null` and `recordationTaxExempt?: boolean` — consumed by Task 3 (`recording.ts`).

- [ ] **Step 1: Write the updated function signature and recordation-tax branch**

In `src/lib/recording-rates.ts`, replace the `matchRecordingRate` function (currently lines 92-151):

```typescript
export function matchRecordingRate(params: {
  state: string | null
  county: string | null
  documentDescription: string | null
  numberOfPages: number | null
  purchasePrice: number | null
  loanAmount: number | null
  feeRows: RecordingFeeScheduleRow[]
  transferTaxRows: TransferTaxScheduleRow[]
  recordationTaxRows: RecordationTaxScheduleRow[]
  // Fee Schedules (design: "Fee Schedules & Loan-Amount Tax Exemptions"): when a
  // non-Standard fee_schedules row is selected for a Mortgage document, its
  // tax_computation_mode changes what base the SAME state/county recordation-tax rows
  // below are priced against -- it never changes which rows apply. `new_money_only`
  // passes `max(0, loanAmount - principalBalance)` here instead of the raw loan amount.
  // Omit (or pass null) for the ordinary case -- the full loan amount is used, exactly
  // as before this parameter existed.
  recordationTaxBase?: number | null
  // `exempt` mode: skip recordation tax entirely and report it as a confirmed $0, not
  // "no rate found" -- this is a deliberate exemption, not missing data.
  recordationTaxExempt?: boolean
}): RecordingRateMatch {
  const {
    state,
    county,
    documentDescription,
    numberOfPages,
    purchasePrice,
    loanAmount,
    feeRows,
    transferTaxRows,
    recordationTaxRows,
    recordationTaxBase,
    recordationTaxExempt,
  } = params

  if (!state || !documentDescription) {
    return {
      fee: null,
      feeStatus: 'no_rate',
      transferTax: null,
      transferTaxStatus: 'not_applicable',
      recordationTax: null,
      recordationTaxStatus: 'not_applicable',
    }
  }

  const stateFeeRows = feeRows.filter((r) => r.state === state)
  const { fee, status: feeStatus } = matchFee(stateFeeRows, documentDescription, numberOfPages)

  // Transfer tax (conveyance tax) only applies to Deeds; recordation tax (mortgage/note
  // tax) only applies to Mortgages -- neither applies to Release/POA/Affidavit/Other.
  let transferTax: number | null = null
  let transferTaxStatus: RecordingRateMatch['transferTaxStatus'] = 'not_applicable'
  if (documentDescription === 'Deed') {
    const rows = transferTaxRows.filter((r) => r.state === state)
    const { total, matchedAny } = sumTaxRows(rows, county, purchasePrice ?? 0, (row, base) => {
      const rate = (base / row.unit_amount) * row.rate_per_unit
      // GA's Real Estate Transfer Tax: flat_amount is a minimum floor for tiny considerations
      // ("$1.00 flat covers the first $1,000... $0.10 per additional $100 above that" is
      // algebraically just a flat 0.10/100 rate once base clears $1,000), not an add-on.
      return row.flat_amount ? Math.max(row.flat_amount, rate) : rate
    })
    transferTax = matchedAny ? total : null
    transferTaxStatus = matchedAny ? 'matched' : 'no_rate'
  }

  let recordationTax: number | null = null
  let recordationTaxStatus: RecordingRateMatch['recordationTaxStatus'] = 'not_applicable'
  if (documentDescription === 'Mortgage') {
    if (recordationTaxExempt) {
      recordationTax = 0
      recordationTaxStatus = 'matched'
    } else {
      const rows = recordationTaxRows.filter((r) => r.state === state)
      const base = recordationTaxBase ?? (loanAmount ?? 0)
      const { total, matchedAny } = sumTaxRows(rows, county, base, (row, taxBase) => {
        const taxable = Math.max(0, taxBase - (row.exemption_amount ?? 0))
        const tax = (taxable / row.unit_amount) * row.rate_per_unit
        return row.cap_amount ? Math.min(tax, row.cap_amount) : tax
      })
      recordationTax = matchedAny ? total : null
      recordationTaxStatus = matchedAny ? 'matched' : 'no_rate'
    }
  }

  return { fee, feeStatus, transferTax, transferTaxStatus, recordationTax, recordationTaxStatus }
}
```

(This is the same logic as before for every caller that doesn't pass the two new parameters — `recordationTaxBase` defaults to `loanAmount` exactly as the old hardcoded `loanAmount ?? 0` did, and `recordationTaxExempt` defaults to falsy so the branch is unreachable unless a caller opts in.)

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit` from `genesis-app/`
Expected: no new errors from `src/lib/recording-rates.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/recording-rates.ts
git commit -m "feat: recordation-tax base override + exemption mode in matchRecordingRate"
```

---

### Task 3: `recording.ts` — Fee Schedule lookup, `fee_schedule_id` persistence, autofill wiring

**Files:**
- Modify: `src/app/actions/recording.ts`

**Interfaces:**
- Consumes: `FeeSchedule` type (Task 1), `matchRecordingRate`'s new params (Task 2).
- Produces: `listFeeSchedulesForState(state: string): Promise<FeeSchedule[]>` — consumed by Task 4 (`page.tsx`). `updateRecordingDocument` now accepts a `fee_schedule_id` form field — consumed by Task 4 (`RecordingPanel.tsx`).

- [ ] **Step 1: Add the Fee Schedule lookup action**

In `src/app/actions/recording.ts`, replace the existing type import (currently line 6, `import type { RecordingDocument } from '@/lib/types'`) with:

```typescript
import type { RecordingDocument, FeeSchedule } from '@/lib/types'
```

Add this function after `listRecordingDocuments` (currently ending at line 13):

```typescript
export async function listFeeSchedulesForState(state: string): Promise<FeeSchedule[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fee_schedules')
    .select('*')
    .eq('state', state)
    .eq('document_type', 'Mortgage')
    .order('is_default', { ascending: false })
    .order('name')
  return data ?? []
}
```

- [ ] **Step 2: Persist `fee_schedule_id` in `updateRecordingDocument`**

In `updateRecordingDocument` (currently lines 100-142), add `fee_schedule_id: strOrNull('fee_schedule_id'),` to the update payload (after `seller_pay_percent: ...` at line 130):

```typescript
      seller_pay_percent: formData.get('seller_pay_percent') ? Number(formData.get('seller_pay_percent')) : null,
      fee_schedule_id: strOrNull('fee_schedule_id'),
```

- [ ] **Step 3: Wire the Fee Schedule into `autofillRecordingRates`**

Replace `autofillRecordingRates` (currently lines 151-205):

```typescript
export async function autofillRecordingRates(
  orderId: string,
  id: string
): Promise<{ error?: string; noRateFor?: string[]; updated?: boolean; warning?: string }> {
  const supabase = await createClient()

  const { data: doc } = await supabase.from('recording_documents').select('*').eq('id', id).single()
  if (!doc) return { error: 'Document not found.' }

  const { data: order } = await supabase.from('orders').select('property_state, purchase_price, loan_amount').eq('id', orderId).single()
  if (!order?.property_state) return { noRateFor: [], updated: false }

  const [{ data: feeRows }, { data: transferTaxRows }, { data: recordationTaxRows }] = await Promise.all([
    supabase.from('recording_fee_schedules').select('*').eq('state', order.property_state),
    supabase.from('transfer_tax_schedules').select('*').eq('state', order.property_state),
    supabase.from('recordation_tax_schedules').select('*').eq('state', order.property_state),
  ])

  // Fee Schedules (design: "Fee Schedules & Loan-Amount Tax Exemptions") -- only
  // Mortgage documents with a non-Standard schedule selected change the recordation-tax
  // base; every other document, and every Mortgage on Standard or with no schedule
  // selected, behaves exactly as before this feature existed.
  let recordationTaxBase: number | null = null
  let recordationTaxExempt = false
  let warning: string | undefined

  if (doc.document_description === 'Mortgage' && doc.fee_schedule_id) {
    const { data: schedule } = await supabase.from('fee_schedules').select('*').eq('id', doc.fee_schedule_id).single()
    if (schedule?.tax_computation_mode === 'exempt') {
      recordationTaxExempt = true
    } else if (schedule?.tax_computation_mode === 'new_money_only') {
      const { data: earliestPayoff } = await supabase
        .from('cdf_payoffs_payments')
        .select('principal_balance')
        .eq('order_id', orderId)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (earliestPayoff?.principal_balance != null) {
        recordationTaxBase = Math.max(0, (order.loan_amount ?? 0) - earliestPayoff.principal_balance)
      } else {
        // Design's documented edge case: fall back to the full loan amount rather than
        // silently zeroing the tax, but tell staff why the reduction wasn't applied.
        warning = 'Fee Schedule requires a payoff on file to compute "new money only" — using full loan amount until one is added.'
      }
    }
  }

  const match = matchRecordingRate({
    state: order.property_state,
    county: doc.county,
    documentDescription: doc.document_description,
    numberOfPages: doc.number_of_pages,
    purchasePrice: order.purchase_price,
    loanAmount: order.loan_amount,
    feeRows: feeRows ?? [],
    transferTaxRows: transferTaxRows ?? [],
    recordationTaxRows: recordationTaxRows ?? [],
    recordationTaxBase,
    recordationTaxExempt,
  })

  const update: Record<string, number> = {}
  if (match.feeStatus === 'matched' && match.fee !== null) update.fee = match.fee
  if (match.transferTaxStatus === 'matched' && match.transferTax !== null) update.transferTax = match.transferTax
  if (match.recordationTaxStatus === 'matched' && match.recordationTax !== null) update.recordationTax = match.recordationTax

  if (Object.keys(update).length > 0) {
    await supabase
      .from('recording_documents')
      .update({
        fee: match.feeStatus === 'matched' ? match.fee : doc.fee,
        transfer_tax: match.transferTaxStatus === 'matched' ? match.transferTax : doc.transfer_tax,
        recordation_tax: match.recordationTaxStatus === 'matched' ? match.recordationTax : doc.recordation_tax,
      })
      .eq('id', id)
    await syncRecordingCdfLines(orderId)
    revalidatePath(`/orders/${orderId}/recording`)
  }

  const noRateFor: string[] = []
  if (match.feeStatus === 'no_rate') noRateFor.push('Recording Fee')
  if (match.transferTaxStatus === 'no_rate') noRateFor.push('Transfer Tax')
  if (match.recordationTaxStatus === 'no_rate') noRateFor.push('Recordation Tax')

  return { noRateFor, updated: Object.keys(update).length > 0, warning }
}
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit` from `genesis-app/`
Expected: no new errors from `src/app/actions/recording.ts`

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/recording.ts
git commit -m "feat: wire Fee Schedule selection into recording-rate autofill"
```

---

### Task 4: `RecordingPanel.tsx` — Fee Schedule dropdown

**Files:**
- Modify: `src/components/title/RecordingPanel.tsx`
- Modify: `src/app/orders/[id]/recording/page.tsx`

**Interfaces:**
- Consumes: `listFeeSchedulesForState` (Task 3), `FeeSchedule` type (Task 1).
- Produces: a `fee_schedule_id` `<select>` in each Mortgage document row, rendered only when schedules exist for the order's state.

- [ ] **Step 1: Fetch the order's state and its Fee Schedules in the page component**

Replace `src/app/orders/[id]/recording/page.tsx` in full:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listRecordingDocuments, listFeeSchedulesForState } from '@/app/actions/recording'
import { RecordingPanel } from '@/components/title/RecordingPanel'

export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [documents, order] = await Promise.all([
    listRecordingDocuments(orderId),
    supabase.from('orders').select('property_state').eq('id', orderId).single().then((r) => r.data),
  ])
  const feeSchedules = order?.property_state ? await listFeeSchedulesForState(order.property_state) : []

  return <RecordingPanel orderId={orderId} documents={documents} feeSchedules={feeSchedules} />
}
```

- [ ] **Step 2: Accept `feeSchedules` and render the dropdown for Mortgage rows**

In `src/components/title/RecordingPanel.tsx`, update the import (currently line 17) to also bring in the type:

```typescript
import type { RecordingDocument, FeeSchedule } from '@/lib/types'
```

Update `DocumentRow`'s props and add the dropdown. Replace the `DocumentRow` function signature (currently line 23):

```typescript
function DocumentRow({ orderId, doc, feeSchedules }: { orderId: string; doc: RecordingDocument; feeSchedules: FeeSchedule[] }) {
```

Add a derived value right after the existing `noRateMessage` state (currently line 27):

```typescript
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const selectedSchedule = feeSchedules.find((s) => s.id === doc.fee_schedule_id)
```

Update `handleSaveAndAutofill` to also capture the new `warning` field (replace the function, currently lines 37-50):

```typescript
  function handleSaveAndAutofill() {
    if (!formRef.current) return
    startTransition(async () => {
      await save(new FormData(formRef.current!))
      const result = await autofillRecordingRates(orderId, doc.id)
      setWarningMessage(result.warning ?? null)
      if (result.updated) {
        refresh()
        return
      }
      setNoRateMessage(
        result.noRateFor && result.noRateFor.length > 0 ? `No Available Rates: ${result.noRateFor.join(', ')} — enter manually.` : null
      )
    })
  }
```

Insert the Fee Schedule dropdown immediately after the existing "Document" field block (after the closing `</div>` for `document_description`, currently line 71, before the "County" field), rendered only for Mortgage documents in a state that has schedules:

```tsx
        {doc.document_description === 'Mortgage' && feeSchedules.length > 0 && (
          <div className="col-span-2">
            <Label htmlFor={`recording-doc-${doc.id}-fee_schedule_id`}>Fee Schedule</Label>
            <select
              id={`recording-doc-${doc.id}-fee_schedule_id`}
              name="fee_schedule_id"
              defaultValue={doc.fee_schedule_id ?? feeSchedules.find((s) => s.is_default)?.id ?? ''}
              onBlur={handleSaveAndAutofill}
              className="block w-full rounded border px-2 py-1 text-sm"
            >
              <option value="" />
              {feeSchedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {selectedSchedule?.requirements_note && (
              <p className="mt-1 text-xs text-muted-foreground">{selectedSchedule.requirements_note}</p>
            )}
          </div>
        )}
```

Add the warning message display near the existing `noRateMessage` block (currently lines 185-189), right after it:

```tsx
        {warningMessage && (
          <p className="col-span-4 text-xs text-amber-600" data-testid={`recording-doc-${doc.id}-warning`}>
            {warningMessage}
          </p>
        )}
```

- [ ] **Step 3: Pass `feeSchedules` down from `RecordingPanel`**

Update the `RecordingPanel` component's props and pass-through (currently lines 216-237):

```typescript
export function RecordingPanel({
  orderId,
  documents,
  feeSchedules,
}: {
  orderId: string
  documents: RecordingDocument[]
  feeSchedules: FeeSchedule[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-5xl space-y-6" data-testid="recording-panel">
      <div>
        <h2 className="text-lg font-semibold">Recording</h2>
        <p className="text-sm text-muted-foreground">
          Tracks each document sent to the recorder&apos;s office. Recording fees stay on CDF Page 2, Section E.
        </p>
      </div>

      <div className="space-y-3" data-testid="recording-doc-list">
        {documents.map((d) => (
          <DocumentRow key={d.id} orderId={orderId} doc={d} feeSchedules={feeSchedules} />
        ))}
        {documents.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          startTransition(async () => {
            await addRecordingDocument(orderId)
            refresh()
          })
        }
        disabled={isPending}
      >
        + Add Document
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Run the app locally and sanity-check by eye**

Run: `npm run dev` from `genesis-app/`. Create an order with `property_state` = `GA`, go to Recording, add a document, set Document = Mortgage.
Expected: a "Fee Schedule" dropdown appears with "Standard", "Refinance – Same Lender", "Refinance – Federal Credit Union". Selecting "Refinance – Same Lender" shows its requirements note as helper text. For an order with `property_state` = `NC`, the same steps show no Fee Schedule dropdown at all.

- [ ] **Step 5: Commit**

```bash
git add src/components/title/RecordingPanel.tsx src/app/orders/[id]/recording/page.tsx
git commit -m "feat: Fee Schedule dropdown on Recording's Mortgage documents"
```

---

### Task 5: e2e test — GA new-money-only reduction and exempt mode

**Files:**
- Create: `tests/e2e/recording-fee-schedules.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-4.

- [ ] **Step 1: Write the test**

```typescript
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
  const { error: authError } = await supabase.auth.signInWithPassword({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD })
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

test.afterAll(async () => {
  await deleteTrackedOrders()
})

test('GA Mortgage: Fee Schedule reduces recordation tax to the new-money base', async ({ page }) => {
  await loginAsSeededUser(page)

  await page.getByRole('link', { name: '+ New Order' }).click()
  await page.getByLabel('State').fill('GA')
  await page.getByLabel('Loan Amount').fill('300000')
  await page.getByRole('button', { name: 'Create Order' }).click()
  await page.waitForURL('**/orders/**/order-entry')
  const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1] as string
  createdOrderIds.add(orderId)

  // Add a payoff so "new money only" has a principal balance to subtract.
  await page.goto(`/orders/${orderId}/payoff-calculations`)
  await page.getByText('+ Add Payoff').click()
  await page.locator('input[name="principal_balance"]').first().fill('200000')
  await page.locator('input[name="principal_balance"]').first().blur()
  await expect(page.getByTestId('save-indicator')).toContainText('Saved')

  await page.goto(`/orders/${orderId}/recording`)
  await page.getByRole('button', { name: '+ Add Document' }).click()

  await page.locator('select[name="document_description"]').selectOption('Mortgage')
  await expect(page.locator('select[name="fee_schedule_id"]')).toBeVisible()

  await page.locator('select[name="fee_schedule_id"]').selectOption({ label: 'Refinance – Same Lender' })
  await expect(page.getByText(/tax applies only to the increase over the existing balance/)).toBeVisible()

  // GA Intangible Recording Tax is $1.50/$500 -- new-money base = 300000 - 200000 = 100000,
  // so tax = 100000 / 500 * 1.50 = $300.00, well under the $25,000 cap.
  await expect(page.locator('input[name="recordation_tax"]')).toHaveValue('$300.00')

  await page.locator('select[name="fee_schedule_id"]').selectOption({ label: 'Refinance – Federal Credit Union' })
  await expect(page.locator('input[name="recordation_tax"]')).toHaveValue('$0.00')

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('input[name="recordation_tax"]')).toHaveValue('$0.00')
})

test('NC Mortgage: no Fee Schedule dropdown (state has no loan-amount tax)', async ({ page }) => {
  await loginAsSeededUser(page)

  await page.getByRole('link', { name: '+ New Order' }).click()
  await page.getByLabel('State').fill('NC')
  await page.getByRole('button', { name: 'Create Order' }).click()
  await page.waitForURL('**/orders/**/order-entry')
  const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1] as string
  createdOrderIds.add(orderId)

  await page.goto(`/orders/${orderId}/recording`)
  await page.getByRole('button', { name: '+ Add Document' }).click()
  await page.locator('select[name="document_description"]').selectOption('Mortgage')

  await expect(page.locator('select[name="fee_schedule_id"]')).toHaveCount(0)
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/recording-fee-schedules.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/recording-fee-schedules.spec.ts
git commit -m "test: GA/VA Fee Schedule recordation-tax reduction and exemption"
```
