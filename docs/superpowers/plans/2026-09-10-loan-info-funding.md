# Loan Information & Funding (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-loan "Loan Information & Funding" screen and make its
primary loan the single source of truth that Schedule A, CDF Page 1, CDF Page
3, Document Prep's Security Instrument, and CDF Section F's per-diem
calculation all default from, instead of five independently-typed copies of
the same loan amount/rate.

**Architecture:** One new `loans` table (order-scoped, one-to-many, ordered by
`sort_order` so the first row is "the primary loan"). No backfill of existing
data anywhere — every seeding relationship is a render-time fallback
(`existingValue ?? primaryLoan?.field`), the exact pattern this file already
uses for Schedule A's coverage-amount defaults from Order Entry. Nothing is
retroactively written; an order with no loan yet behaves exactly as it does
today on every downstream screen.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres), TypeScript,
shadcn/ui. Playwright e2e (this repo's only test tooling).

**Spec:** `docs/superpowers/specs/2026-09-10-loan-info-funding-design.md`

## Global Constraints

- No backfill migration, ever, in this plan — every seeding relationship is a
  read-time `??` fallback, never a write to existing rows.
- Only the **primary loan** (lowest `sort_order`) seeds anything downstream —
  a second loan added later never re-seeds fields that already have a value.
- Payoff Calculations is untouched by this plan (spec: it describes a
  different, prior loan being paid off, not this screen's loan).
- Phase B (loan-scoped CDF) is explicitly out of scope — this plan keeps CDF
  Pages 1-5 exactly as order-scoped as they are today.

---

### Task 1: Migration — `loans` table and Schedule A's `loan_number` column

**Files:**
- Create: `supabase/migrations/00XX_loan_information_funding.sql` (exact
  number = next available at implementation time; this plan doesn't assume
  execution order against the Staff Directory plan's own pending migrations)

**Interfaces:**
- Produces: `public.loans(id, order_id, sort_order, lender_contact_id,
  principal_amount, annual_interest_rate, loan_number, loan_type,
  construction_equity_draw_amount)`, `public.commitment_sch_a.loan_number`.
  Every later task queries these.

- [ ] **Step 1: Write the migration**

```sql
-- 00XX_loan_information_funding.sql
-- Loan Information & Funding, Phase A. See
-- docs/superpowers/specs/2026-09-10-loan-info-funding-design.md.
-- Order-scoped, one-to-many -- sort_order 0 (lowest) is "the primary loan"
-- that seeds Schedule A / CDF Page 1 / CDF Page 3 / Security Instrument /
-- CDF Section F's per-diem rate as a render-time fallback default. No
-- backfill: every seeding relationship reads existingValue ?? primaryLoan,
-- nothing is written to any existing row by this migration.

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sort_order integer not null default 0,
  lender_contact_id uuid references public.contacts(id) on delete set null,
  principal_amount numeric,
  annual_interest_rate numeric,
  loan_number text,
  loan_type text,
  construction_equity_draw_amount numeric
);

alter table public.loans enable row level security;

create policy "Authenticated M&L staff can do anything with loans"
  on public.loans for all to authenticated using (true) with check (true);

-- Schedule A's Loan Number never had its own column -- the Fix Plan's note
-- was "blocked until a Loan Info & Funding screen exists to source it from,"
-- not "wire up an existing field." Same seed-once-editable-after fallback as
-- this file's existing owner/loan coverage-amount defaults.
alter table public.commitment_sch_a add column loan_number text;
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP (`apply_migration`).

- [ ] **Step 3: Verify**

Run (via Supabase MCP `execute_sql`):

```sql
select column_name from information_schema.columns where table_name = 'loans';
select column_name from information_schema.columns where table_name = 'commitment_sch_a' and column_name = 'loan_number';
```

Expected: `loans` has all 8 columns; `commitment_sch_a` has the new column.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00XX_loan_information_funding.sql
git commit -m "feat: add loans table and commitment_sch_a.loan_number column"
```

---

### Task 2: Constants and shared type

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `LOAN_TYPES`, `type Loan`. Every later task imports these.

- [ ] **Step 1: Add `LOAN_TYPES` to `src/lib/constants.ts`**

```ts
// Loan Information & Funding, Phase A. Confirmed with Cam 2026-09-10 --
// narrower than SoftPro's full loan-type list.
export const LOAN_TYPES = ['Conventional', 'FHA', 'VA', 'USDA'] as const
```

- [ ] **Step 2: Add `Loan` to `src/lib/types.ts`**

```ts
export type Loan = {
  id: string
  order_id: string
  sort_order: number
  lender_contact_id: string | null
  principal_amount: number | null
  annual_interest_rate: number | null
  loan_number: string | null
  loan_type: string | null
  construction_equity_draw_amount: number | null
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: clean (additive-only, nothing imports these yet).

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/types.ts
git commit -m "feat: add LOAN_TYPES constant and Loan type"
```

---

### Task 3: Server actions (`src/app/actions/loans.ts`)

**Files:**
- Create: `src/app/actions/loans.ts`

**Interfaces:**
- Consumes: `Loan` (Task 2).
- Produces: `listLoans(orderId)`, `addLoan(orderId)`,
  `updateLoan(orderId, id, formData)`, `deleteLoan(orderId, id)`,
  `getPrimaryLoan(orderId)`. Task 4's UI and Tasks 5-9's seeding all call
  these (`getPrimaryLoan` is the one every downstream screen's page loader
  calls).

- [ ] **Step 1: Write the actions file**

Mirrors `src/app/actions/recording.ts`'s exact shape (`addRecordingDocument`
seeding `county` from `orders.property_county` on insert is the template for
`addLoan` seeding `principal_amount` from `orders.loan_amount` — only on the
very first loan, matching the spec's "primary loan only" rule).

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { LOAN_TYPES } from '@/lib/constants'
import type { Loan } from '@/lib/types'

export async function listLoans(orderId: string): Promise<Loan[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('loans').select('*').eq('order_id', orderId).order('sort_order')
  return data ?? []
}

// The one loan every other screen's seeding relationship reads from. Returns
// null for an order with no loans yet -- every caller treats that as "no
// seed available," not an error.
export async function getPrimaryLoan(orderId: string): Promise<Loan | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('loans')
    .select('*')
    .eq('order_id', orderId)
    .order('sort_order')
    .limit(1)
    .maybeSingle()
  return data
}

export async function addLoan(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('loans')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)

  const isFirstLoan = (count ?? 0) === 0
  let seedPrincipal: number | null = null
  if (isFirstLoan) {
    const { data: order } = await supabase.from('orders').select('loan_amount').eq('id', orderId).single()
    seedPrincipal = order?.loan_amount ?? null
  }

  const { error } = await supabase
    .from('loans')
    .insert({ order_id: orderId, sort_order: count ?? 0, principal_amount: seedPrincipal })

  if (error) {
    console.error('addLoan failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath('/', 'layout')
  return {}
}

export async function updateLoan(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const strOrNull = (key: string) => (formData.get(key) as string) || null
  const numOrNull = (key: string) => (formData.get(key) ? Number(formData.get(key)) : null)

  const loanType = strOrNull('loan_type')
  if (loanType && !(LOAN_TYPES as readonly string[]).includes(loanType)) {
    return { error: 'Invalid loan type.' }
  }

  const { error } = await supabase
    .from('loans')
    .update({
      lender_contact_id: strOrNull('lender_contact_id'),
      principal_amount: numOrNull('principal_amount'),
      annual_interest_rate: numOrNull('annual_interest_rate'),
      loan_number: strOrNull('loan_number'),
      loan_type: loanType,
      construction_equity_draw_amount: numOrNull('construction_equity_draw_amount'),
    })
    .eq('id', id)

  if (error) {
    console.error('updateLoan failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath('/', 'layout')
  return {}
}

export async function deleteLoan(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('loans').delete().eq('id', id)

  if (error) {
    console.error('deleteLoan failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }

  revalidatePath('/', 'layout')
  return {}
}
```

**Note on `revalidatePath('/', 'layout')`:** deliberately the widest possible
scope, not `/orders/${orderId}/loan-info`. This exact bug already bit
Contacts' payee dropdowns once this session (scoped to `'page'` instead of
`'layout'`, leaving sibling screens stale) — a loan change needs to be
visible on Schedule A, CDF Page 1, CDF Page 3, Security Instrument, and CDF
Page 2 simultaneously, so root-layout revalidation is the correct scope here,
not an oversight to narrow later.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/loans.ts
git commit -m "feat: add loans server actions (list/add/update/delete/getPrimaryLoan)"
```

---

### Task 4: Loan Info & Funding screen and nav entry

**Files:**
- Create: `src/app/orders/[id]/loan-info/page.tsx`
- Create: `src/components/title/LoanInfoPanel.tsx`
- Modify: `src/components/FileSectionsNav.tsx:22-29`

**Interfaces:**
- Consumes: `listLoans`, `addLoan`, `updateLoan`, `deleteLoan` (Task 3);
  `LOAN_TYPES` (Task 2).

- [ ] **Step 1: Add the nav entry**

```diff
   {
     heading: 'Title',
     items: [
       { label: 'Prelim Title Search', segment: 'prelim-search' },
       { label: 'Commitment Sch A', segment: 'commitment-sch-a' },
       { label: 'Commitment Sch B-I/B-II', segment: 'commitment-sch-b' },
       { label: 'Curative', segment: 'curative' },
+      { label: 'Loan Information & Funding', segment: 'loan-info' },
       { label: 'Premiums & Endorsements', segment: 'premiums' },
       { label: 'Invoices', segment: 'invoices' },
     ],
   },
```

- [ ] **Step 2: Write the page loader**

Reuses the exact Lender-contact query Schedule A's own loader already uses.

```tsx
// src/app/orders/[id]/loan-info/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listLoans } from '@/app/actions/loans'
import { LoanInfoPanel } from '@/components/title/LoanInfoPanel'

export default async function LoanInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id').eq('id', id).single()
  if (!order) notFound()

  const { data: contacts } = await supabase.from('contacts').select('id, name, role').eq('order_id', id)
  const lenderContacts = (contacts ?? []).filter((c) => c.role.toLowerCase().includes('lender'))

  const loans = await listLoans(id)

  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Loan Information & Funding</h1>
      <LoanInfoPanel orderId={id} loans={loans} lenderContacts={lenderContacts} />
    </main>
  )
}
```

- [ ] **Step 3: Write the panel**

Mirrors `RecordingPanel.tsx`'s exact per-row structure (`DocumentRow` →
`LoanRow`, same `useRef`+`useAutosave` per row, same `+ Add`/`refresh()`
pattern).

```tsx
// src/components/title/LoanInfoPanel.tsx
'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SaveIndicator } from '@/components/SaveIndicator'
import { addLoan, updateLoan, deleteLoan } from '@/app/actions/loans'
import { useAutosave } from '@/lib/use-autosave'
import { LOAN_TYPES } from '@/lib/constants'
import type { Loan } from '@/lib/types'

function refresh() {
  window.location.reload()
}

function LoanRow({
  orderId,
  loan,
  lenderContacts,
}: {
  orderId: string
  loan: Loan
  lenderContacts: { id: string; name: string }[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateLoan(orderId, loan.id, formData))

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="space-y-2 rounded border p-3" data-testid={`loan-row-${loan.id}`}>
      <form ref={formRef} className="grid grid-cols-4 gap-2">
        <div>
          <Label htmlFor={`loan-${loan.id}-lender_contact_id`}>Lender</Label>
          <select
            id={`loan-${loan.id}-lender_contact_id`}
            name="lender_contact_id"
            defaultValue={loan.lender_contact_id ?? ''}
            onChange={handleSave}
            className="w-full rounded border p-2"
          >
            <option value="">— Select —</option>
            {lenderContacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`loan-${loan.id}-principal_amount`}>Principal Amount</Label>
          <CurrencyInput
            id={`loan-${loan.id}-principal_amount`}
            name="principal_amount"
            defaultValue={loan.principal_amount ?? undefined}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`loan-${loan.id}-annual_interest_rate`}>Interest Rate (%)</Label>
          <Input
            id={`loan-${loan.id}-annual_interest_rate`}
            name="annual_interest_rate"
            type="number"
            step="0.001"
            defaultValue={loan.annual_interest_rate ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`loan-${loan.id}-loan_number`}>Loan Number</Label>
          <Input
            id={`loan-${loan.id}-loan_number`}
            name="loan_number"
            defaultValue={loan.loan_number ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`loan-${loan.id}-loan_type`}>Loan Type</Label>
          <select
            id={`loan-${loan.id}-loan_type`}
            name="loan_type"
            defaultValue={loan.loan_type ?? ''}
            onChange={handleSave}
            className="w-full rounded border p-2"
          >
            <option value="">— Select —</option>
            {LOAN_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`loan-${loan.id}-construction_equity_draw_amount`}>Construction/Equity First Draw Amount</Label>
          <CurrencyInput
            id={`loan-${loan.id}-construction_equity_draw_amount`}
            name="construction_equity_draw_amount"
            defaultValue={loan.construction_equity_draw_amount ?? undefined}
            onBlur={handleSave}
          />
        </div>
      </form>
      <div className="flex items-center justify-between">
        <SaveIndicator state={state} errorMessage={errorMessage} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm('Remove this loan?')) {
              deleteLoan(orderId, loan.id).then(refresh)
            }
          }}
        >
          Remove
        </Button>
      </div>
    </div>
  )
}

export function LoanInfoPanel({
  orderId,
  loans,
  lenderContacts,
}: {
  orderId: string
  loans: Loan[]
  lenderContacts: { id: string; name: string }[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-4">
      {loans.map((loan) => (
        <LoanRow key={loan.id} orderId={orderId} loan={loan} lenderContacts={lenderContacts} />
      ))}
      <Button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await addLoan(orderId)
            refresh()
          })
        }}
      >
        + Add Loan
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Write the e2e test**

```ts
// tests/e2e/loan-info.spec.ts
import { test, expect } from '@playwright/test'

test('adding a loan seeds Principal Amount from the order\'s Loan Amount', async ({ page }) => {
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
```

- [ ] **Step 5: Run the test**

Run: `npx playwright test tests/e2e/loan-info.spec.ts`
Expected: PASS.

- [ ] **Step 6: Run the full e2e suite**

Run: `npx playwright test`
Expected: no new failures.

- [ ] **Step 7: Commit**

```bash
git add src/app/orders/\[id\]/loan-info/page.tsx src/components/title/LoanInfoPanel.tsx \
  src/components/FileSectionsNav.tsx tests/e2e/loan-info.spec.ts
git commit -m "feat: build Loan Information & Funding screen"
```

---

### Task 5: Wire Schedule A's new Loan Number field

**Files:**
- Modify: `src/app/orders/[id]/commitment-sch-a/page.tsx`
- Modify: `src/components/commitment-sch-a/CommitmentScheduleAForm.tsx`
- Modify: `src/app/actions/commitment-sch-a.ts`

**Interfaces:**
- Consumes: `getPrimaryLoan` (Task 3).

- [ ] **Step 1: Pass the primary loan into the page**

```diff
+import { getPrimaryLoan } from '@/app/actions/loans'
+
 export default async function CommitmentScheduleAPage({ params }: { params: Promise<{ id: string }> }) {
   ...
+  const primaryLoan = await getPrimaryLoan(id)
   ...
-  return <CommitmentScheduleAForm ... />
+  return <CommitmentScheduleAForm ... primaryLoan={primaryLoan} />
 }
```

- [ ] **Step 2: Add the field, seeded from the primary loan**

Same fallback pattern this file already uses for
`owner_coverage_amount`/`loan_coverage_amount`
(`defaultValue={commitmentSchA?.field ?? (order.purchase_price/loan_amount)}`)
— add near the existing "Loan Policy" heading (line ~345):

```diff
+import type { Loan } from '@/lib/types'
+
 export function CommitmentScheduleAForm({
   ...
+  primaryLoan,
 }: {
   ...
+  primaryLoan: Loan | null
 }) {
```
```diff
             <h3 className="mb-4 font-semibold">Loan Policy</h3>
+            <div>
+              <Label htmlFor="loan_number">Loan Number</Label>
+              <Input
+                id="loan_number"
+                name="loan_number"
+                defaultValue={commitmentSchA?.loan_number ?? primaryLoan?.loan_number ?? ''}
+                onBlur={handleSave}
+              />
+            </div>
```

(Confirmed: this file's existing fields call `onBlur={() => handleSave()}` —
the diff above matches that exact convention, no adjustment needed.)

- [ ] **Step 3: Persist it in the action**

```diff
   const { error } = await supabase.from('commitment_sch_a').update({
     ...
+    loan_number: strOrNull('loan_number'),
   })
```

- [ ] **Step 4: Live-verify**

Add a test loan with a loan number on the Loan Info screen, load Schedule A,
confirm the Loan Number field shows it as the default. Type over it, confirm
the override saves and persists. Clean up.

- [ ] **Step 5: Run the full e2e suite**

Run: `npx playwright test`
Expected: no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/app/orders/\[id\]/commitment-sch-a/page.tsx \
  src/components/commitment-sch-a/CommitmentScheduleAForm.tsx \
  src/app/actions/commitment-sch-a.ts
git commit -m "feat: seed Schedule A's Loan Number from the primary loan"
```

---

### Task 6: Wire CDF Page 1's `loan_amount`/`interest_rate` defaults

**Files:**
- Modify: `src/app/orders/[id]/cdf-page-1/page.tsx`
- Modify: `src/components/title/CdfPage1Panel.tsx:40-52`

**Interfaces:**
- Consumes: `getPrimaryLoan` (Task 3).

- [ ] **Step 1: Pass the primary loan into the page, same pattern as Task 5 Step 1**

```diff
+import { getPrimaryLoan } from '@/app/actions/loans'
+
 export default async function CdfPage1Page({ params }: { params: Promise<{ id: string }> }) {
   ...
+  const primaryLoan = await getPrimaryLoan(id)
-  return <CdfPage1Panel ... />
+  return <CdfPage1Panel ... primaryLoan={primaryLoan} />
 }
```

- [ ] **Step 2: Seed the two fields**

```diff
+import type { Loan } from '@/lib/types'
+
 export function CdfPage1Panel({
   ...
+  primaryLoan,
 }: {
   ...
+  primaryLoan: Loan | null
 }) {
```
```diff
               id="loan_amount"
               name="loan_amount"
-              defaultValue={cdfPage1?.loan_amount}
+              defaultValue={cdfPage1?.loan_amount ?? primaryLoan?.principal_amount ?? undefined}
```
```diff
               name="interest_rate"
-              defaultValue={cdfPage1?.interest_rate ?? ''}
+              defaultValue={cdfPage1?.interest_rate ?? primaryLoan?.annual_interest_rate ?? ''}
```

- [ ] **Step 3: Live-verify**

Add a test loan with a principal amount and rate, load CDF Page 1, confirm
both fields default from it. Edit one, confirm the override persists.

- [ ] **Step 4: Run the full e2e suite**

Run: `npx playwright test`
Expected: no new failures.

- [ ] **Step 5: Commit**

```bash
git add src/app/orders/\[id\]/cdf-page-1/page.tsx src/components/title/CdfPage1Panel.tsx
git commit -m "feat: seed CDF Page 1 loan fields from the primary loan"
```

---

### Task 7: Wire CDF Page 3's `loan_amount_estimate` default

**Files:**
- Modify: `src/app/orders/[id]/cdf-page-3/page.tsx`
- Modify: `src/components/title/CdfPage3Panel.tsx:49`

**Interfaces:**
- Consumes: `getPrimaryLoan` (Task 3).

- [ ] **Step 1: Pass the primary loan into the page**

Same pattern as Task 5 Step 1 / Task 6 Step 1.

- [ ] **Step 2: Seed `loan_amount_estimate` only**

Only the **estimate** (the Loan Estimate-stage figure) seeds from the
primary loan — `loan_amount_final` and `loan_amount_changed` describe what
happened between estimate and closing and stay exactly as manual entry
(seeding a "did this change" comparison field from its own estimate would be
incoherent).

```diff
-    { label: 'Loan Amount', est: 'loan_amount_estimate', fin: 'loan_amount_final', changed: 'loan_amount_changed' },
+    { label: 'Loan Amount', est: 'loan_amount_estimate', fin: 'loan_amount_final', changed: 'loan_amount_changed', estDefault: primaryLoan?.principal_amount ?? undefined },
```

Confirmed the exact render line this row config feeds (the `rows.map((row) =>
...)` loop):

```diff
                 id={row.est}
                 name={row.est}
-                defaultValue={(cashToClose?.[row.est] as number) ?? null}
+                defaultValue={(cashToClose?.[row.est] as number) ?? row.estDefault ?? null}
```

Only the Loan Amount row config carries an `estDefault` — every other row
(Total Closing Costs, Total Payoffs and Payments, etc.) has no `estDefault`
key, so `row.estDefault` is `undefined` for them and this changes nothing
about how they render.

- [ ] **Step 3: Live-verify**

Add a test loan with a principal amount, load CDF Page 3, confirm the Loan
Amount row's Estimate column defaults from it, Final/Changed stay blank.

- [ ] **Step 4: Run the full e2e suite**

Run: `npx playwright test`
Expected: no new failures.

- [ ] **Step 5: Commit**

```bash
git add src/app/orders/\[id\]/cdf-page-3/page.tsx src/components/title/CdfPage3Panel.tsx
git commit -m "feat: seed CDF Page 3 loan amount estimate from the primary loan"
```

---

### Task 8: Wire Document Prep Security Instrument's loan fields

**Files:**
- Modify: `src/app/orders/[id]/security-instrument/page.tsx`
- Modify: `src/components/doc-prep/SecurityInstrumentForm.tsx:199-264`

**Interfaces:**
- Consumes: `getPrimaryLoan` (Task 3).

- [ ] **Step 1: Pass the primary loan into the page**

Same pattern as Task 5 Step 1.

- [ ] **Step 2: Seed the two fields**

```diff
-            <Input id="loan_amount" name="loan_amount" type="number" step="0.01" defaultValue={si?.loan_amount ?? ''} onBlur={handleSave} />
+            <Input id="loan_amount" name="loan_amount" type="number" step="0.01" defaultValue={si?.loan_amount ?? primaryLoan?.principal_amount ?? ''} onBlur={handleSave} />
```
```diff
-              <Input id="interest_rate" name="interest_rate" type="number" step="0.001" defaultValue={si?.interest_rate ?? ''} onBlur={handleSave} />
+              <Input id="interest_rate" name="interest_rate" type="number" step="0.001" defaultValue={si?.interest_rate ?? primaryLoan?.annual_interest_rate ?? ''} onBlur={handleSave} />
```

- [ ] **Step 3: Live-verify**

Add a test loan, load Security Instrument, confirm both fields default from
it.

- [ ] **Step 4: Run the full e2e suite**

Run: `npx playwright test`
Expected: no new failures.

- [ ] **Step 5: Commit**

```bash
git add src/app/orders/\[id\]/security-instrument/page.tsx \
  src/components/doc-prep/SecurityInstrumentForm.tsx
git commit -m "feat: seed Security Instrument loan fields from the primary loan"
```

---

### Task 9: Compute CDF Section F's Prepaid Interest per-diem rate default

**Files:**
- Modify: `src/app/orders/[id]/cdf-page-2/page.tsx`
- Modify: `src/components/title/CdfPage2Panel.tsx:82,292-293`

**Interfaces:**
- Consumes: `getPrimaryLoan` (Task 3).

- [ ] **Step 1: Pass the primary loan into the page**

Same pattern as Task 5 Step 1.

- [ ] **Step 2: Compute the default rate and use it as the field's fallback**

`computePrepaidInterest`'s existing 360-vs-actual day-count split
(`prepaid_interest_use_30_day_months`) already exists in
`CdfPage2Panel.tsx` — reuse the same true/false split for the divisor
(360 vs. 365) rather than introducing a second, inconsistent day-count
convention.

```diff
+import type { Loan } from '@/lib/types'
+
 export function CdfPage2Panel({
   ...
+  primaryLoan,
 }: {
   ...
+  primaryLoan: Loan | null
 }) {
```
```diff
   const isPrepaidInterest = line.is_fixed && line.section === 'F' && line.description === 'Prepaid Interest'
   const computedPrepaidInterest = isPrepaidInterest ? computePrepaidInterest(line) : null
+  const defaultPerDiemRate =
+    isPrepaidInterest && primaryLoan?.principal_amount != null && primaryLoan?.annual_interest_rate != null
+      ? ((primaryLoan.annual_interest_rate / 100) * primaryLoan.principal_amount) /
+        (line.prepaid_interest_use_30_day_months ? 360 : 365)
+      : undefined
```
```diff
             name="prepaid_interest_per_diem_rate"
-            defaultValue={line.prepaid_interest_per_diem_rate}
+            defaultValue={line.prepaid_interest_per_diem_rate ?? defaultPerDiemRate}
```

**Known, deliberate limitation, matching this app's existing convention for
every other computed helper (Section A's points calc, etc.):** this default
is computed once at render time using whichever day-basis toggle is
currently saved on the line (initially `false`/365-actual). If the user
later flips the 30-day-months checkbox, the rate field's *default* doesn't
live-recompute — the same non-reactive, seed-once behavior every other
computed field in this app already has. Not a bug to fix here.

- [ ] **Step 3: Live-verify**

Add a test loan with a principal amount and rate, load CDF Page 2, confirm
Section F's Prepaid Interest per-diem rate field now shows a computed
default instead of blank. Enter a date range, confirm the computed total
(`= $amount`) updates using the seeded rate. Override the rate manually,
confirm the override persists and the total recomputes from it.

- [ ] **Step 4: Run the full e2e suite**

Run: `npx playwright test`
Expected: no new failures — this only changes a `defaultValue` fallback, not
any existing computation or schema.

- [ ] **Step 5: Commit**

```bash
git add src/app/orders/\[id\]/cdf-page-2/page.tsx src/components/title/CdfPage2Panel.tsx
git commit -m "feat: compute CDF Section F's per-diem rate from the primary loan"
```

---

### Task 10: Full regression, vault docs, Build Log

**Files:**
- Modify: `M&L Title - Obsidian Vault/Genesis Screen Notes - Fix Plan.md`
- Modify: `M&L Title - Obsidian Vault/Genesis Build Log.md`
- Modify: `M&L Title - Obsidian Vault/Genesis Rebuild - Loan Information & Funding Design.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Full regression**

Run: `npm run build` — expected clean.
Run: `npm run lint` — expected clean.
Run: `npx playwright test` — expected full suite green, same or higher pass
count than session start.

- [ ] **Step 2: Update the vault design doc's status**

Change the frontmatter `status:` in
`Genesis Rebuild - Loan Information & Funding Design.md` to "built 2026-09-10"
(or actual ship date); add a closing paragraph noting Phase B (loan-scoped
CDF) is still open and explicitly not started.

- [ ] **Step 3: Update the Fix Plan**

Add a struck-through entry under today's date linking to the design doc,
noting: the Loan Information & Funding screen shipped with multi-loan
support and the confirmed field set; Schedule A's Loan Number, CDF Page 1,
CDF Page 3's estimate, Security Instrument, and CDF Section F's per-diem rate
all now seed from the primary loan instead of independent manual entry.
**Phase B (a second loan getting its own full CDF Page 1-5) is explicitly
NOT part of this build** — flag it as its own future design pass, not
forgotten scope.

- [ ] **Step 4: Add a Build Log entry**

Following this vault's established format — summarize the migration, the
five screens that now seed from the primary loan, the render-time-fallback
(no backfill) approach, and the deliberate Phase B descope.

- [ ] **Step 5: Sync T7 → Desktop**

Check for any Desktop-vault file edited more recently than the last sync
point that isn't `Cam's Screen Notes.md` before syncing (the earlier
`Cam's Notes.md` incident this session) — reconcile onto T7 first if found,
then run `.claude/hooks/sync-to-desktop.sh`.

- [ ] **Step 6: Confirm commits, ask before pushing**

```bash
git log --oneline main ^origin/main
```

Confirm every task's commit from this plan is present, then ask Cam before
pushing — a separate explicit approval, not implied by "commit."
