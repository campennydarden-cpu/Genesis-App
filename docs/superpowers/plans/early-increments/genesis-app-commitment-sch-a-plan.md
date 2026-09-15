# Genesis App — Commitment Schedule A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Commitment Schedule A File Section — second of the Title nav group's 4 items — porting the proven data model from the old prototype (`genesis-github-push/genesis-app.html`, `tplScheduleA`).

**Architecture:** New `commitment_sch_a` table (1:1 with `orders`) plus `chain_of_title` (1:many, FK to `commitment_sch_a`). One route (`/orders/[id]/commitment-sch-a`), one shared save form for everything except Chain of Title (matches Property's single-form convention). Owner's/Loan Policy card visibility reacts live to the in-form Form Type field via client state — no server round-trip needed.

**Tech Stack:** Same as prior increments — Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, `@supabase/ssr`, Playwright E2E extending `tests/e2e/order-entry.spec.ts`. Supabase project `hlahrypglnmjjxrdtfkm`.

**Spec:** `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Commitment Schedule A Design.md`

## Global Constraints

- All file operations happen in the T7 copy (`/Volumes/T7/Claude Code/Genesis Platform/`), never the Desktop backup.
- Repo: `/Volumes/T7/Claude Code/Genesis Platform/genesis-app/`, remote `origin` → `https://github.com/campennydarden-cpu/Genesis-App.git`, branch `main`, Vercel auto-deploys on push, live at `https://genesis-app-tau.vercel.app`.
- Model-cost discipline: haiku for mechanical/fully-specified tasks, sonnet for tasks requiring judgment (live card-visibility logic, seed-chip wiring, test design). No opus.
- **Migration numbering:** the Prelim Title Search plan (`genesis-app-prelim-title-search-plan.md`) reserves `0003_prelim_search.sql` but has not been executed yet (parked). This plan uses `0004_commitment_sch_a.sql` to avoid a future collision — if Prelim Title Search is executed first, 0003 will exist before 0004 is applied; if this plan executes first, apply 0004 as a migration on top of the current `0001`/`0002` baseline, and 0003 stays reserved for Prelim Search whenever it runs.
- `orders.policy_type` already exists (foundation schema) with values `None`/`Owner's`/`Loan`/`Simultaneous` — read-only here, not duplicated. Note genesis-app already has a `POLICY_TYPES` constant for that order-level list; Schedule A's own 7-value ALTA-form list must use a **different** constant name (`ALTA_POLICY_FORM_TYPES`) to avoid colliding with it.
- `contacts.role` is free text (no CHECK constraint, no fixed value list yet — a known, separately-tracked gap). Seed chips filter on an exact string match (`role === 'Buyer/Borrower'`, `role === 'Lender'`) — matches the prototype's own matching logic.
- Testing stays Playwright E2E only, extending the existing cumulative spec file.
- Dev server must be running (`npm run dev`, no `webServer` entry in `playwright.config.ts`) before `npm run test:e2e`.
- This plan document is the deliverable for this round — do not invoke `subagent-driven-development` or execute any task below; the user is stopping at planning this round to conserve credits.

## Value lists (exact, verbatim — verified against the prototype's actual source)

**Commitment Form Type (`COMMITMENT_FORM_TYPES`):** `Standard`, `Short Form`

**ALTA Policy Form Type (`ALTA_POLICY_FORM_TYPES`, 7 values, used for both Owner's and Loan Policy):** `ALTA Owner's Policy`, `ALTA Loan Policy`, `ALTA Homeowner's Policy`, `Leasehold Owner's Policy`, `Leasehold Loan Policy`, `Construction Loan Policy`, `Other`

## File Structure

```
genesis-app/
├── supabase/migrations/
│   └── 0004_commitment_sch_a.sql                          # NEW
├── src/
│   ├── lib/
│   │   ├── constants.ts                                    # MODIFY: + COMMITMENT_FORM_TYPES, ALTA_POLICY_FORM_TYPES
│   │   └── types.ts                                        # MODIFY: + CommitmentScheduleA, ChainOfTitleEntry
│   ├── app/
│   │   ├── actions/
│   │   │   └── commitment-sch-a.ts                         # NEW
│   │   └── orders/[id]/
│   │       └── commitment-sch-a/page.tsx                    # NEW
│   └── components/
│       ├── FileSectionsNav.tsx                             # MODIFY: Commitment Sch A gains segment
│       └── commitment-sch-a/
│           ├── CommitmentScheduleAForm.tsx                  # NEW
│           └── ChainOfTitleSection.tsx                       # NEW
└── tests/e2e/order-entry.spec.ts                           # MODIFY
```

---

### Task 1: Schema — `commitment_sch_a` + `chain_of_title`

**Suggested model:** haiku (fully-specified schema transcription)

**Files:**
- Create: `supabase/migrations/0004_commitment_sch_a.sql`

**Interfaces:**
- Produces: `commitment_sch_a` and `chain_of_title` tables, RLS-enabled `to authenticated using (true)`, matching the established pattern.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0004_commitment_sch_a.sql
create table public.commitment_sch_a (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  form_type text not null default 'Standard' check (form_type in ('Standard', 'Short Form')),
  company_state_of_org text,
  requirements_time_period text,
  env_protection_lien_statutes text,
  issuing_agent text,
  issuing_office text,
  alta_universal_id text,
  loan_id_number text,
  commitment_number text,
  revision_number text,
  date_issued date,
  time_issued text,
  title_held_as text,
  owner_policy_type text check (owner_policy_type in (
    'ALTA Owner''s Policy', 'ALTA Loan Policy', 'ALTA Homeowner''s Policy',
    'Leasehold Owner''s Policy', 'Leasehold Loan Policy', 'Construction Loan Policy', 'Other'
  )),
  owner_coverage_amount text,
  owner_coverage_tbd boolean not null default false,
  owner_proposed_insured text,
  loan_policy_type text check (loan_policy_type in (
    'ALTA Owner''s Policy', 'ALTA Loan Policy', 'ALTA Homeowner''s Policy',
    'Leasehold Owner''s Policy', 'Leasehold Loan Policy', 'Construction Loan Policy', 'Other'
  )),
  loan_coverage_amount text,
  loan_coverage_tbd boolean not null default false,
  loan_proposed_insured text,
  loan_mortgagee_clause text,
  counter_signature text,
  counter_signature_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chain_of_title (
  id uuid primary key default gen_random_uuid(),
  commitment_sch_a_id uuid not null references public.commitment_sch_a(id) on delete cascade,
  instrument_type text,
  grantor text,
  grantee text,
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  created_at timestamptz not null default now()
);

create index chain_of_title_commitment_sch_a_id_idx on public.chain_of_title(commitment_sch_a_id);

alter table public.commitment_sch_a enable row level security;
alter table public.chain_of_title enable row level security;

create policy "Authenticated M&L staff can do anything with commitment_sch_a"
  on public.commitment_sch_a for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with chain_of_title"
  on public.chain_of_title for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool against project `hlahrypglnmjjxrdtfkm`, with `name: "commitment_sch_a"` and the SQL above as `query`.

- [ ] **Step 3: Verify**

Use the Supabase MCP `list_tables` tool and confirm both new tables appear with RLS enabled.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add supabase/migrations/0004_commitment_sch_a.sql
git commit -m "feat: add commitment_sch_a schema (Policy & Coverage, Chain of Title)"
```

---

### Task 2: Constants and types

**Suggested model:** haiku (fully-specified value lists and type definitions)

**Files:**
- Modify: `src/lib/constants.ts` (append)
- Modify: `src/lib/types.ts` (append)

**Interfaces:**
- Produces: `COMMITMENT_FORM_TYPES`, `ALTA_POLICY_FORM_TYPES` (readonly string-tuple constants); `CommitmentScheduleA`, `ChainOfTitleEntry` types. Consumed by Task 3's actions and Tasks 4-6's components.

- [ ] **Step 1: Append the constants**

```ts
// append to src/lib/constants.ts

export const COMMITMENT_FORM_TYPES = ['Standard', 'Short Form'] as const

export const ALTA_POLICY_FORM_TYPES = [
  "ALTA Owner's Policy",
  'ALTA Loan Policy',
  "ALTA Homeowner's Policy",
  "Leasehold Owner's Policy",
  'Leasehold Loan Policy',
  'Construction Loan Policy',
  'Other',
] as const
```

- [ ] **Step 2: Append the types**

```ts
// append to src/lib/types.ts

export type CommitmentScheduleA = {
  id: string
  order_id: string
  form_type: string
  company_state_of_org: string | null
  requirements_time_period: string | null
  env_protection_lien_statutes: string | null
  issuing_agent: string | null
  issuing_office: string | null
  alta_universal_id: string | null
  loan_id_number: string | null
  commitment_number: string | null
  revision_number: string | null
  date_issued: string | null
  time_issued: string | null
  title_held_as: string | null
  owner_policy_type: string | null
  owner_coverage_amount: string | null
  owner_coverage_tbd: boolean
  owner_proposed_insured: string | null
  loan_policy_type: string | null
  loan_coverage_amount: string | null
  loan_coverage_tbd: boolean
  loan_proposed_insured: string | null
  loan_mortgagee_clause: string | null
  counter_signature: string | null
  counter_signature_date: string | null
}

export type ChainOfTitleEntry = {
  id: string
  commitment_sch_a_id: string
  instrument_type: string | null
  grantor: string | null
  grantee: string | null
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
}
```

- [ ] **Step 3: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/types.ts
git commit -m "feat: add Commitment Schedule A constants and types"
```

---

### Task 3: Server Actions

**Suggested model:** haiku (mechanical CRUD, same pattern as every prior increment)

**Files:**
- Create: `src/app/actions/commitment-sch-a.ts`

**Interfaces:**
- Produces: `upsertCommitmentScheduleA(orderId, formData)`; `addChainOfTitleEntry(commitmentSchAId, orderId, formData)`, `updateChainOfTitleEntry(orderId, entryId, formData)`, `deleteChainOfTitleEntry(orderId, entryId)`. Consumed by Tasks 4-5 via `.bind()`.

- [ ] **Step 1: Create the actions file**

```ts
// src/app/actions/commitment-sch-a.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function upsertCommitmentScheduleA(orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase.from('commitment_sch_a').upsert(
    {
      order_id: orderId,
      form_type: (formData.get('form_type') as string) || 'Standard',
      company_state_of_org: field('company_state_of_org'),
      requirements_time_period: field('requirements_time_period'),
      env_protection_lien_statutes: field('env_protection_lien_statutes'),
      issuing_agent: field('issuing_agent'),
      issuing_office: field('issuing_office'),
      alta_universal_id: field('alta_universal_id'),
      loan_id_number: field('loan_id_number'),
      commitment_number: field('commitment_number'),
      revision_number: field('revision_number'),
      date_issued: field('date_issued'),
      time_issued: field('time_issued'),
      title_held_as: field('title_held_as'),
      owner_policy_type: field('owner_policy_type'),
      owner_coverage_amount: field('owner_coverage_amount'),
      owner_coverage_tbd: formData.get('owner_coverage_tbd') === 'on',
      owner_proposed_insured: field('owner_proposed_insured'),
      loan_policy_type: field('loan_policy_type'),
      loan_coverage_amount: field('loan_coverage_amount'),
      loan_coverage_tbd: formData.get('loan_coverage_tbd') === 'on',
      loan_proposed_insured: field('loan_proposed_insured'),
      loan_mortgagee_clause: field('loan_mortgagee_clause'),
      counter_signature: field('counter_signature'),
      counter_signature_date: field('counter_signature_date'),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  )

  if (error) {
    console.error('upsertCommitmentScheduleA failed:', error)
    redirect(
      `/orders/${orderId}/commitment-sch-a?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/commitment-sch-a`)
  redirect(`/orders/${orderId}/commitment-sch-a`)
}

export async function addChainOfTitleEntry(commitmentSchAId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase.from('chain_of_title').insert({
    commitment_sch_a_id: commitmentSchAId,
    instrument_type: field('instrument_type'),
    grantor: field('grantor'),
    grantee: field('grantee'),
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
  })

  if (error) {
    console.error('addChainOfTitleEntry failed:', error)
    redirect(
      `/orders/${orderId}/commitment-sch-a?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-a`)
}

export async function updateChainOfTitleEntry(orderId: string, entryId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase
    .from('chain_of_title')
    .update({
      instrument_type: field('instrument_type'),
      grantor: field('grantor'),
      grantee: field('grantee'),
      dated_date: field('dated_date'),
      recorded_date: field('recorded_date'),
      book: field('book'),
      page: field('page'),
      instrument_number: field('instrument_number'),
    })
    .eq('id', entryId)

  if (error) {
    console.error('updateChainOfTitleEntry failed:', error)
    redirect(
      `/orders/${orderId}/commitment-sch-a?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-a`)
}

export async function deleteChainOfTitleEntry(orderId: string, entryId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('chain_of_title').delete().eq('id', entryId)

  if (error) {
    console.error('deleteChainOfTitleEntry failed:', error)
    redirect(
      `/orders/${orderId}/commitment-sch-a?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-a`)
}
```

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/commitment-sch-a.ts
git commit -m "feat: add Commitment Schedule A server actions"
```

---

### Task 4: CommitmentScheduleAForm (main form + live policy-card visibility + seed chips)

**Suggested model:** sonnet (live client-state visibility logic, ref-based seed-chip wiring)

**Files:**
- Create: `src/components/commitment-sch-a/CommitmentScheduleAForm.tsx`

**Interfaces:**
- Consumes: `upsertCommitmentScheduleA` (bound as `action` prop by Task 6's page), `COMMITMENT_FORM_TYPES`/`ALTA_POLICY_FORM_TYPES` (Task 2), `CommitmentScheduleA` (Task 2).
- Produces: `CommitmentScheduleAForm({ action, commitmentSchA, orderPolicyType, effectiveDateFact, buyerBorrowerContacts, lenderContacts })` — Client Component. `buyerBorrowerContacts: {id, name}[]`, `lenderContacts: {id, name, mortgagee_clause: string | null}[]`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/commitment-sch-a/CommitmentScheduleAForm.tsx
'use client'

import { useRef, useState } from 'react'
import { COMMITMENT_FORM_TYPES, ALTA_POLICY_FORM_TYPES } from '@/lib/constants'
import type { CommitmentScheduleA } from '@/lib/types'

type ContactOption = { id: string; name: string }
type LenderOption = { id: string; name: string; mortgagee_clause: string | null }

export function CommitmentScheduleAForm({
  action,
  commitmentSchA,
  orderPolicyType,
  effectiveDateFact,
  buyerBorrowerContacts,
  lenderContacts,
}: {
  action: (formData: FormData) => void
  commitmentSchA: CommitmentScheduleA | null
  orderPolicyType: string
  effectiveDateFact: string
  buyerBorrowerContacts: ContactOption[]
  lenderContacts: LenderOption[]
}) {
  const [formType, setFormType] = useState<string>(commitmentSchA?.form_type ?? 'Standard')
  const isShortForm = formType === 'Short Form'
  const showOwnerPolicy = !isShortForm && (orderPolicyType === "Owner's" || orderPolicyType === 'Simultaneous')
  const showLoanPolicy = isShortForm || orderPolicyType === 'Loan' || orderPolicyType === 'Simultaneous'

  const ownerProposedInsuredRef = useRef<HTMLInputElement>(null)
  const loanProposedInsuredRef = useRef<HTMLInputElement>(null)
  const loanMortgageeClauseRef = useRef<HTMLTextAreaElement>(null)

  return (
    <form action={action} className="space-y-6">
      <div className="rounded border p-4">
        <p className="mb-4 text-sm font-semibold">Commitment Form</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="form_type" className="block text-sm font-medium">
              Form Type
            </label>
            <select
              id="form_type"
              name="form_type"
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              {COMMITMENT_FORM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="company_state_of_org" className="block text-sm font-medium">
              Company&apos;s State of Organization
            </label>
            <input
              id="company_state_of_org"
              name="company_state_of_org"
              defaultValue={commitmentSchA?.company_state_of_org ?? undefined}
              placeholder="e.g. Ohio corporation"
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="requirements_time_period" className="block text-sm font-medium">
              Requirements Time Period
            </label>
            <input
              id="requirements_time_period"
              name="requirements_time_period"
              defaultValue={commitmentSchA?.requirements_time_period ?? undefined}
              placeholder="e.g. 6 months"
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
        </div>
        {isShortForm && (
          <div className="mt-4">
            <label htmlFor="env_protection_lien_statutes" className="block text-sm font-medium">
              ALTA 8.1-06 Environmental Protection Lien Statutes
            </label>
            <textarea
              id="env_protection_lien_statutes"
              name="env_protection_lien_statutes"
              rows={2}
              defaultValue={commitmentSchA?.env_protection_lien_statutes ?? undefined}
              placeholder="State statutes to be set forth on any ALTA 8.1-06 endorsement"
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
        )}
      </div>

      <div className="rounded border p-4">
        <p className="mb-4 text-sm font-semibold">
          Transaction Identification Data <span className="font-normal text-slate-500">(optional — for reference only)</span>
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="issuing_agent" className="block text-sm font-medium">
              Issuing Agent
            </label>
            <input id="issuing_agent" name="issuing_agent" defaultValue={commitmentSchA?.issuing_agent ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="issuing_office" className="block text-sm font-medium">
              Issuing Office
            </label>
            <input id="issuing_office" name="issuing_office" defaultValue={commitmentSchA?.issuing_office ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="alta_universal_id" className="block text-sm font-medium">
              ALTA Universal ID
            </label>
            <input id="alta_universal_id" name="alta_universal_id" defaultValue={commitmentSchA?.alta_universal_id ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="loan_id_number" className="block text-sm font-medium">
              Loan ID Number
            </label>
            <input id="loan_id_number" name="loan_id_number" defaultValue={commitmentSchA?.loan_id_number ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="commitment_number" className="block text-sm font-medium">
              Commitment Number
            </label>
            <input id="commitment_number" name="commitment_number" defaultValue={commitmentSchA?.commitment_number ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="revision_number" className="block text-sm font-medium">
              Revision Number
            </label>
            <input id="revision_number" name="revision_number" defaultValue={commitmentSchA?.revision_number ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
        </div>
      </div>

      <div className="rounded border p-4">
        <p className="mb-4 text-sm font-semibold">Policy &amp; Coverage</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="date_issued" className="block text-sm font-medium">
              Date Issued
            </label>
            <input id="date_issued" name="date_issued" type="date" defaultValue={commitmentSchA?.date_issued ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="time_issued" className="block text-sm font-medium">
              Time Issued
            </label>
            <input id="time_issued" name="time_issued" type="time" defaultValue={commitmentSchA?.time_issued ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <p className="block text-sm font-medium">Effective Date</p>
            <p className="mt-1 rounded border bg-slate-50 px-3 py-2 text-sm text-slate-600" data-testid="effective-date-fact">
              {effectiveDateFact}
            </p>
          </div>
          <div>
            <p className="block text-sm font-medium">Policy Type (Order Entry)</p>
            <p className="mt-1 rounded border bg-slate-50 px-3 py-2 text-sm text-slate-600" data-testid="policy-type-fact">
              {orderPolicyType}
            </p>
          </div>
          <div>
            <label htmlFor="title_held_as" className="block text-sm font-medium">
              The Estate or Interest in the Land
            </label>
            {isShortForm ? (
              <p className="mt-1 rounded border bg-slate-50 px-3 py-2 text-sm text-slate-600" data-testid="estate-fact">
                Fee Simple (fixed by the ALTA Short Form Commitment)
              </p>
            ) : (
              <input
                id="title_held_as"
                name="title_held_as"
                defaultValue={commitmentSchA?.title_held_as ?? undefined}
                placeholder="e.g. Fee Simple, Leasehold"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            )}
          </div>
        </div>
      </div>

      {showOwnerPolicy && (
        <div className="rounded border p-4" data-testid="owner-policy-card">
          <p className="mb-4 text-sm font-semibold">Owner&apos;s Policy</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="owner_policy_type" className="block text-sm font-medium">
                ALTA Form
              </label>
              <select id="owner_policy_type" name="owner_policy_type" defaultValue={commitmentSchA?.owner_policy_type ?? ''} className="mt-1 w-full rounded border px-3 py-2">
                <option value="">— Select —</option>
                {ALTA_POLICY_FORM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="owner_coverage_amount" className="block text-sm font-medium">
                Coverage Amount
              </label>
              <input id="owner_coverage_amount" name="owner_coverage_amount" defaultValue={commitmentSchA?.owner_coverage_amount ?? undefined} placeholder="0.00" className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <input id="owner_coverage_tbd" name="owner_coverage_tbd" type="checkbox" defaultChecked={commitmentSchA?.owner_coverage_tbd ?? false} className="h-4 w-4" />
              <label htmlFor="owner_coverage_tbd" className="text-sm font-medium">
                Coverage TBD
              </label>
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="owner_proposed_insured" className="block text-sm font-medium">
              Proposed Insured
            </label>
            <input
              id="owner_proposed_insured"
              name="owner_proposed_insured"
              ref={ownerProposedInsuredRef}
              defaultValue={commitmentSchA?.owner_proposed_insured ?? undefined}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          {buyerBorrowerContacts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {buyerBorrowerContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (ownerProposedInsuredRef.current) ownerProposedInsuredRef.current.value = c.name
                  }}
                  className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
                >
                  + {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showLoanPolicy && (
        <div className="rounded border p-4" data-testid="loan-policy-card">
          <p className="mb-4 text-sm font-semibold">Loan Policy</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="loan_policy_type" className="block text-sm font-medium">
                ALTA Form
              </label>
              <select id="loan_policy_type" name="loan_policy_type" defaultValue={commitmentSchA?.loan_policy_type ?? ''} className="mt-1 w-full rounded border px-3 py-2">
                <option value="">— Select —</option>
                {ALTA_POLICY_FORM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="loan_coverage_amount" className="block text-sm font-medium">
                Coverage Amount
              </label>
              <input id="loan_coverage_amount" name="loan_coverage_amount" defaultValue={commitmentSchA?.loan_coverage_amount ?? undefined} placeholder="0.00" className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <input id="loan_coverage_tbd" name="loan_coverage_tbd" type="checkbox" defaultChecked={commitmentSchA?.loan_coverage_tbd ?? false} className="h-4 w-4" />
              <label htmlFor="loan_coverage_tbd" className="text-sm font-medium">
                Coverage TBD
              </label>
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="loan_proposed_insured" className="block text-sm font-medium">
              Proposed Insured
            </label>
            <input
              id="loan_proposed_insured"
              name="loan_proposed_insured"
              ref={loanProposedInsuredRef}
              defaultValue={commitmentSchA?.loan_proposed_insured ?? undefined}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          {lenderContacts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {lenderContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (loanProposedInsuredRef.current) loanProposedInsuredRef.current.value = c.name
                  }}
                  className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
                >
                  + {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4">
            <label htmlFor="loan_mortgagee_clause" className="block text-sm font-medium">
              Mortgagee Clause
            </label>
            <textarea
              id="loan_mortgagee_clause"
              name="loan_mortgagee_clause"
              ref={loanMortgageeClauseRef}
              rows={2}
              defaultValue={commitmentSchA?.loan_mortgagee_clause ?? undefined}
              placeholder="ISAOA/ATIMA clause language"
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          {lenderContacts.filter((c) => c.mortgagee_clause).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {lenderContacts
                .filter((c) => c.mortgagee_clause)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (loanMortgageeClauseRef.current) loanMortgageeClauseRef.current.value = c.mortgagee_clause ?? ''
                    }}
                    className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    + Copy from {c.name}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded border p-4">
        <p className="mb-4 text-sm font-semibold">Countersignature</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="counter_signature" className="block text-sm font-medium">
              Counter Signature
            </label>
            <input id="counter_signature" name="counter_signature" defaultValue={commitmentSchA?.counter_signature ?? undefined} placeholder="Licensee name" className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="counter_signature_date" className="block text-sm font-medium">
              Counter Signature Date
            </label>
            <input id="counter_signature_date" name="counter_signature_date" type="date" defaultValue={commitmentSchA?.counter_signature_date ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
        </div>
      </div>

      <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
        Save Changes
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/commitment-sch-a/CommitmentScheduleAForm.tsx
git commit -m "feat: add CommitmentScheduleAForm component"
```

---

### Task 5: ChainOfTitleSection

**Suggested model:** sonnet (repeatable list with full edit, plus ref-based "Copy from Derivation" seed logic)

**Files:**
- Create: `src/components/commitment-sch-a/ChainOfTitleSection.tsx`

**Interfaces:**
- Consumes: `addChainOfTitleEntry`/`updateChainOfTitleEntry`/`deleteChainOfTitleEntry` (Task 3), `ChainOfTitleEntry` (Task 2).
- Produces: `ChainOfTitleSection({ orderId, commitmentSchAId, entries, derivationSeed })` — Client Component. `derivationSeed: { instrumentType: string; grantor: string; grantee: string } | null`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/commitment-sch-a/ChainOfTitleSection.tsx
'use client'

import { useRef, useState } from 'react'
import { addChainOfTitleEntry, updateChainOfTitleEntry, deleteChainOfTitleEntry } from '@/app/actions/commitment-sch-a'
import type { ChainOfTitleEntry } from '@/lib/types'

type DerivationSeed = { instrumentType: string; grantor: string; grantee: string }

function CotFields({ idPrefix, record }: { idPrefix: string; record?: ChainOfTitleEntry }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-instrument_type`} className="block text-sm font-medium">
            Instrument Type
          </label>
          <input id={`${idPrefix}-instrument_type`} name="instrument_type" defaultValue={record?.instrument_type ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-grantor`} className="block text-sm font-medium">
            Grantor
          </label>
          <input id={`${idPrefix}-grantor`} name="grantor" defaultValue={record?.grantor ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-grantee`} className="block text-sm font-medium">
            Grantee
          </label>
          <input id={`${idPrefix}-grantee`} name="grantee" defaultValue={record?.grantee ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-dated_date`} className="block text-sm font-medium">
            Dated Date
          </label>
          <input id={`${idPrefix}-dated_date`} name="dated_date" type="date" defaultValue={record?.dated_date ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-recorded_date`} className="block text-sm font-medium">
            Recorded Date
          </label>
          <input id={`${idPrefix}-recorded_date`} name="recorded_date" type="date" defaultValue={record?.recorded_date ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-book`} className="block text-sm font-medium">
            Book
          </label>
          <input id={`${idPrefix}-book`} name="book" defaultValue={record?.book ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-page`} className="block text-sm font-medium">
            Page
          </label>
          <input id={`${idPrefix}-page`} name="page" defaultValue={record?.page ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-instrument_number`} className="block text-sm font-medium">
            Instrument Number
          </label>
          <input id={`${idPrefix}-instrument_number`} name="instrument_number" defaultValue={record?.instrument_number ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
      </div>
    </>
  )
}

export function ChainOfTitleSection({
  orderId,
  commitmentSchAId,
  entries,
  derivationSeed,
}: {
  orderId: string
  commitmentSchAId: string | null
  entries: ChainOfTitleEntry[]
  derivationSeed: DerivationSeed | null
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const addInstrumentTypeRef = useRef<HTMLInputElement>(null)
  const addGrantorRef = useRef<HTMLInputElement>(null)
  const addGranteeRef = useRef<HTMLInputElement>(null)
  const addCommitmentSchAId = commitmentSchAId ? addChainOfTitleEntry.bind(null, commitmentSchAId, orderId) : null

  return (
    <div className="rounded border p-4">
      <p className="mb-4 text-sm font-semibold">Chain of Title</p>

      <ul className="mb-4 space-y-2" data-testid="cot-list">
        {entries.map((e, idx) =>
          editingId === e.id ? (
            <li key={e.id} className="rounded border p-4" data-testid="cot-row">
              <form
                action={async (formData: FormData) => {
                  await updateChainOfTitleEntry(orderId, e.id, formData)
                  setEditingId(null)
                }}
                className="space-y-4"
              >
                <CotFields idPrefix={`cot-edit-${e.id}`} record={e} />
                <div className="flex gap-2">
                  <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded border px-3 py-1.5 text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </li>
          ) : (
            <li key={e.id} className="flex items-center justify-between rounded border p-3" data-testid="cot-row">
              <p>
                {idx + 1}. {e.instrument_type || 'Instrument'}: {e.grantor || '?'} → {e.grantee || '?'}
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingId(e.id)} className="text-sm text-slate-600 hover:underline">
                  Edit
                </button>
                <form action={deleteChainOfTitleEntry.bind(null, orderId, e.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {entries.length === 0 && <p className="text-sm text-slate-500">No chain of title entries added.</p>}
      </ul>

      {addCommitmentSchAId ? (
        <details className="rounded border p-4">
          <summary className="cursor-pointer font-medium">Add a chain of title entry</summary>
          {derivationSeed && (
            <button
              type="button"
              onClick={() => {
                if (addInstrumentTypeRef.current) addInstrumentTypeRef.current.value = derivationSeed.instrumentType
                if (addGrantorRef.current) addGrantorRef.current.value = derivationSeed.grantor
                if (addGranteeRef.current) addGranteeRef.current.value = derivationSeed.grantee
              }}
              className="mt-2 rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              + Copy from Derivation ({derivationSeed.grantor} → {derivationSeed.grantee})
            </button>
          )}
          <form action={addCommitmentSchAId} className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="cot-add-instrument_type" className="block text-sm font-medium">
                  Instrument Type
                </label>
                <input id="cot-add-instrument_type" name="instrument_type" ref={addInstrumentTypeRef} className="mt-1 w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label htmlFor="cot-add-grantor" className="block text-sm font-medium">
                  Grantor
                </label>
                <input id="cot-add-grantor" name="grantor" ref={addGrantorRef} className="mt-1 w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label htmlFor="cot-add-grantee" className="block text-sm font-medium">
                  Grantee
                </label>
                <input id="cot-add-grantee" name="grantee" ref={addGranteeRef} className="mt-1 w-full rounded border px-3 py-2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cot-add-dated_date" className="block text-sm font-medium">
                  Dated Date
                </label>
                <input id="cot-add-dated_date" name="dated_date" type="date" className="mt-1 w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label htmlFor="cot-add-recorded_date" className="block text-sm font-medium">
                  Recorded Date
                </label>
                <input id="cot-add-recorded_date" name="recorded_date" type="date" className="mt-1 w-full rounded border px-3 py-2" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="cot-add-book" className="block text-sm font-medium">
                  Book
                </label>
                <input id="cot-add-book" name="book" className="mt-1 w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label htmlFor="cot-add-page" className="block text-sm font-medium">
                  Page
                </label>
                <input id="cot-add-page" name="page" className="mt-1 w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label htmlFor="cot-add-instrument_number" className="block text-sm font-medium">
                  Instrument Number
                </label>
                <input id="cot-add-instrument_number" name="instrument_number" className="mt-1 w-full rounded border px-3 py-2" />
              </div>
            </div>
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
              Add Chain of Title Entry
            </button>
          </form>
        </details>
      ) : (
        <p className="text-sm text-slate-500">Save Commitment Schedule A first before adding chain of title entries.</p>
      )}
    </div>
  )
}
```

Note: the "add" form's field ids (`cot-add-*`) are hardcoded (not per-instance-prefixed) because there is only ever one add form on screen at a time; edit forms use `cot-edit-${e.id}-*`, so no id collides with the add form or with each other.

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/commitment-sch-a/ChainOfTitleSection.tsx
git commit -m "feat: add ChainOfTitleSection component"
```

---

### Task 6: Route page and nav wiring

**Suggested model:** sonnet (orchestrates fetching across orders/prelim_search/contacts and passing derived props)

**Files:**
- Create: `src/app/orders/[id]/commitment-sch-a/page.tsx`
- Modify: `src/components/FileSectionsNav.tsx` (Commitment Sch A item gains `segment: 'commitment-sch-a'`)

**Interfaces:**
- Consumes: `CommitmentScheduleAForm` (Task 4), `ChainOfTitleSection` (Task 5), `upsertCommitmentScheduleA` (Task 3).

- [ ] **Step 1: Wire the nav item**

In `src/components/FileSectionsNav.tsx`, change:

```tsx
{ label: 'Commitment Sch A' },
```

to:

```tsx
{ label: 'Commitment Sch A', segment: 'commitment-sch-a' },
```

- [ ] **Step 2: Create the route page**

```tsx
// src/app/orders/[id]/commitment-sch-a/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { upsertCommitmentScheduleA } from '@/app/actions/commitment-sch-a'
import { CommitmentScheduleAForm } from '@/components/commitment-sch-a/CommitmentScheduleAForm'
import { ChainOfTitleSection } from '@/components/commitment-sch-a/ChainOfTitleSection'

export default async function CommitmentScheduleAPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id, policy_type').eq('id', id).single()
  if (!order) {
    notFound()
  }

  const { data: prelim } = await supabase
    .from('prelim_search')
    .select('effective_date, effective_time, derivation_instrument_type, derivation_grantee_name, derivation_grantor_name')
    .eq('order_id', id)
    .maybeSingle()

  const { data: commitmentSchA } = await supabase.from('commitment_sch_a').select('*').eq('order_id', id).maybeSingle()
  const commitmentSchAId = commitmentSchA?.id ?? null

  const { data: chainOfTitle } = commitmentSchAId
    ? await supabase.from('chain_of_title').select('*').eq('commitment_sch_a_id', commitmentSchAId).order('created_at')
    : { data: [] }

  const { data: contacts } = await supabase.from('contacts').select('id, name, role, mortgagee_clause').eq('order_id', id)
  const buyerBorrowerContacts = (contacts ?? [])
    .filter((c) => c.role === 'Buyer/Borrower')
    .map((c) => ({ id: c.id, name: c.name }))
  const lenderContacts = (contacts ?? [])
    .filter((c) => c.role === 'Lender')
    .map((c) => ({ id: c.id, name: c.name, mortgagee_clause: c.mortgagee_clause }))

  const effectiveDateFact = prelim?.effective_date
    ? `${prelim.effective_date}${prelim.effective_time ? ' ' + prelim.effective_time : ''}`
    : '— set on Prelim Search'

  const derivationSeed =
    prelim?.derivation_grantor_name && prelim?.derivation_grantee_name
      ? {
          instrumentType: prelim.derivation_instrument_type ?? '',
          grantor: prelim.derivation_grantor_name,
          grantee: prelim.derivation_grantee_name,
        }
      : null

  const upsertCommitmentScheduleAWithId = upsertCommitmentScheduleA.bind(null, id)

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <CommitmentScheduleAForm
        action={upsertCommitmentScheduleAWithId}
        commitmentSchA={commitmentSchA}
        orderPolicyType={order.policy_type}
        effectiveDateFact={effectiveDateFact}
        buyerBorrowerContacts={buyerBorrowerContacts}
        lenderContacts={lenderContacts}
      />
      <div className="mt-6">
        <ChainOfTitleSection
          orderId={id}
          commitmentSchAId={commitmentSchAId}
          entries={chainOfTitle ?? []}
          derivationSeed={derivationSeed}
        />
      </div>
    </div>
  )
}
```

Note: this page reads from `prelim_search` — if Prelim Title Search hasn't been executed yet in this Supabase project when this task runs, that table won't exist and the query will error. Apply the Prelim Title Search migration first, or adjust this query to tolerate a missing table, before running this task for real.

- [ ] **Step 3: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/FileSectionsNav.tsx "src/app/orders/[id]/commitment-sch-a/page.tsx"
git commit -m "feat: wire Commitment Schedule A route and nav"
```

---

### Task 7: E2E test suite extension

**Suggested model:** sonnet (test design needs judgment about visibility-toggle and seed-chip coverage)

**Files:**
- Modify: `tests/e2e/order-entry.spec.ts`

- [ ] **Step 1: Add the test**

Append to `tests/e2e/order-entry.spec.ts`:

```ts
  test('commitment schedule A: form-type-driven policy cards, seed chips, chain of title', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('Policy Type').selectOption('Simultaneous')
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Contacts' }).click()
    await page.waitForURL('**/contacts')
    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').fill('Buyer/Borrower')
    await page.getByLabel('Name').fill('Jane Buyer')
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await expect(page.getByTestId('contact-row').filter({ hasText: 'Jane Buyer' })).toBeVisible()

    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').fill('Lender')
    await page.getByLabel('Name').fill('Test Bank')
    await page.getByLabel('Mortgagee Clause').fill('Test Bank, its successors and/or assigns, ISAOA/ATIMA')
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await expect(page.getByTestId('contact-row').filter({ hasText: 'Test Bank' })).toBeVisible()

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch A' }).click()
    await page.waitForURL('**/commitment-sch-a')

    await expect(page.getByTestId('owner-policy-card')).toBeVisible()
    await expect(page.getByTestId('loan-policy-card')).toBeVisible()
    await expect(page.getByTestId('policy-type-fact')).toContainText('Simultaneous')

    await page.getByTestId('owner-policy-card').getByRole('button', { name: '+ Jane Buyer' }).click()
    await expect(page.getByLabel('Proposed Insured').first()).toHaveValue('Jane Buyer')
    await page.getByTestId('loan-policy-card').getByRole('button', { name: '+ Copy from Test Bank' }).click()
    await expect(page.getByLabel('Mortgagee Clause')).toHaveValue('Test Bank, its successors and/or assigns, ISAOA/ATIMA')

    await page.getByLabel('Form Type').selectOption('Short Form')
    await expect(page.getByTestId('owner-policy-card')).not.toBeVisible()
    await expect(page.getByTestId('loan-policy-card')).toBeVisible()
    await expect(page.getByTestId('estate-fact')).toContainText('Fee Simple')
    await expect(page.getByLabel('ALTA 8.1-06 Environmental Protection Lien Statutes')).toBeVisible()

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/commitment-sch-a')
    await expect(page.getByLabel('Form Type')).toHaveValue('Short Form')
    await expect(page.getByTestId('owner-policy-card')).not.toBeVisible()

    await page.getByText('Add a chain of title entry').click()
    await page.getByLabel('Instrument Type').last().fill('Warranty Deed')
    await page.getByLabel('Grantor').last().fill('Original Owner')
    await page.getByLabel('Grantee').last().fill('Current Owner')
    await page.getByRole('button', { name: 'Add Chain of Title Entry' }).click()
    await expect(page.getByTestId('cot-row')).toContainText('Original Owner')

    await page.getByTestId('cot-row').getByRole('button', { name: 'Edit' }).click()
    await page.locator('li:has-text("Original Owner")').getByLabel('Book').fill('1234')
    await page.locator('li:has-text("Original Owner")').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('cot-list')).not.toContainText('Cancel')
  })
```

- [ ] **Step 2: Run the full suite and verify**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run dev -- -p 3100 > /tmp/genesis-sch-a-task7-dev.log 2>&1 &
sleep 4
PLAYWRIGHT_BASE_URL="http://localhost:3100" npm run test:e2e
```

Expected: all tests pass (count = existing suite size + 1). Kill the dev server before finishing.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/order-entry.spec.ts
git commit -m "test: add Commitment Schedule A E2E coverage"
```

---

### Task 8: Final verification, deploy check, and vault sync

**Suggested model:** sonnet (final gate before deploy)

- [ ] **Step 1: Full local verification**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run lint
npm run build
```

If `npm run lint` shows errors pointing into a `.worktrees/**` path, that's the known ESLint ignore-pattern bug (see [[Open Items & Parking Lot]] item 4) — fully remove the SDD worktree before re-running lint on `main`.

- [ ] **Step 2: Push and confirm the Vercel auto-deploy**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git fetch origin && git status
git push origin main
```

Then, after the deploy completes:

```bash
PLAYWRIGHT_BASE_URL="https://genesis-app-tau.vercel.app" npx playwright test
```

- [ ] **Step 3: Update the vault**

In `M&L Title/M&L Title - Obsidian Vault/Genesis Build Log.md`, add a change-log entry: Commitment Schedule A shipped (Commitment Form, Transaction ID, Policy & Coverage with live Form-Type-driven Owner's/Loan Policy visibility, Coverage TBD, seed chips, Chain of Title), commit range, test results.

In `Genesis Rebuild - Commitment Schedule A Design.md`, change frontmatter `status:` to `implemented`.

- [ ] **Step 4: Re-sync T7 → Desktop backup and verify**

```bash
rsync -av --delete "/Volumes/T7/Claude Code/Genesis Platform/" "/Users/campenny/Desktop/Claude Code/Genesis Platform/"
bash "/Volumes/T7/Claude Code/Genesis Platform/.claude/hooks/verify-sync.sh"
```

---

## Self-Review

**Spec coverage:** Commitment Form, Transaction ID, Policy & Coverage, Owner's/Loan Policy cards with live visibility, Coverage TBD, seed chips, Chain of Title with full edit and Derivation seed, Countersignature — Tasks 4-5 ✓. Schema matches the design doc exactly — Task 1 ✓. Underwriter correctly absent (deferred gap) — never referenced ✓. Nav wiring — Task 6 Step 1 ✓.

**Placeholder scan:** No TBD/TODO. Migration numbering conflict with the parked Prelim Title Search plan is explicitly called out and resolved (0004, not 0003) rather than left ambiguous.

**Type consistency:** `CommitmentScheduleA`/`ChainOfTitleEntry` (Task 2) field names match the migration's columns (Task 1) and every form's `name`/`id` attributes (Tasks 4-5) exactly. `upsertCommitmentScheduleA(orderId, formData)`, `addChainOfTitleEntry(commitmentSchAId, orderId, formData)`, `updateChainOfTitleEntry(orderId, entryId, formData)`, `deleteChainOfTitleEntry(orderId, entryId)` (Task 3) match their `.bind()` call sites in Tasks 5-6 exactly. `CommitmentScheduleAForm`'s and `ChainOfTitleSection`'s prop shapes match exactly what Task 6's page passes.
