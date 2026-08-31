# Commitment Schedule A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Commitment Schedule A File Section — second of four Title nav-group screens — porting the proven data model and interaction pattern from the old prototype (`genesis-github-push/genesis-app.html`, `tplScheduleA`) into the real `genesis-app` (Next.js/Supabase) stack.

**Architecture:** One scrolling File Section page (`/orders/[id]/commitment-sch-a`) with a single shared upsert form (Commitment Form, Transaction Identification Data, Policy & Coverage, Owner's/Loan Policy cards, Countersignature) — matching Property's single-form convention, not Prelim Search's multi-anchor layout. Owner's/Loan Policy card visibility reacts live to the Form Type field and the order's Policy Type, driven by client-side `useState`, no server round-trip. Chain of Title is a separate repeatable list (full add/edit/delete) below the main form, following the exact pencil-icon inline-edit pattern established by Prelim Search's Security Instruments/Liens/Exception Matters sections. Two proposed-insured fields, one mortgagee-clause field, and three Chain of Title fields are deliberately controlled inputs (not this codebase's usual uncontrolled `defaultValue` pattern) so seed-chip buttons can set their value directly — see Global Constraints.

**Tech Stack:** Next.js 16.3.3 (App Router, Server Actions, React 19), Supabase (Postgres + `@supabase/ssr`), Tailwind CSS 4, shadcn/ui (already installed — Input, Select, Textarea, Checkbox, Button, Label), Playwright for e2e (no unit-test framework exists in this repo).

**Spec:** `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Commitment Schedule A Design.md`

## Global Constraints

- Migrations use `text` columns + `check (col in (...))` for enums, native `date`/`time`/`numeric(14,2)` for their respective field kinds, never a native Postgres `enum` type — matches `0001_foundation_schema.sql` through `0003_prelim_search.sql`.
- Every table gets `id uuid primary key default gen_random_uuid()`, RLS enabled, and an explicit `for all to authenticated using (true) with check (true)` policy — single-tenant, matches every existing table. No table ships without RLS.
- Server actions are `'use server'` files under `src/app/actions/`, use `createClient()` from `@/lib/supabase/server`, and on a Supabase error `redirect` back to the same page with `?error=<generic message>` plus `console.error` server-side — never a raw DB error surfaced to the user. Matches `src/app/actions/property.ts` and `src/app/actions/prelim-search.ts`.
- Money fields use `type="number" step="0.01"` inputs and `field ? Number(field) : null` parsing server-side — matches `purchase_price`/`loan_amount` in `src/app/actions/orders.ts`.
- Boolean checkbox fields parse as `formData.get('field') === 'on'` — matches `derivation_is_portion` in `src/app/actions/prelim-search.ts`.
- No unit-test framework exists in this repo — all new logic is covered via Playwright e2e against the real dev server and the real seeded Supabase project (`genesis-e2e-seed@genesis-app-e2e-test.dev` / `E2eSeedPass123!`), matching `tests/e2e/order-entry.spec.ts`'s existing convention.
- shadcn/ui is already installed (`src/components/ui/`) — every new field uses the real primitives (`Input`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`, `Textarea`, `Checkbox`, `Button`, `Label`), not hand-rolled `<input>`/`<select>` markup. Follow `SecurityInstrumentsSection.tsx`/`LiensSection.tsx` conventions exactly (per-row `idPrefix` on every `id`/`htmlFor`, `data-testid` on list items and their editing variant, `details`/`summary` for the "Add" affordance).
- `contacts.role` is free text (no enum) — carried over from the Prelim Title Search plan's own note. Seed-chip matching against `role` must be substring/case-insensitive (`role.toLowerCase().includes('buyer')` etc.), never an exact string/enum comparison.
- **Deliberate controlled-input deviation:** `owner_proposed_insured`, `loan_proposed_insured`, and `loan_mortgagee_clause` on the main form, and `instrument_type`/`grantor`/`grantee` on the Chain of Title add/edit form, are controlled inputs (`value`/`onChange` + local `useState`) instead of this codebase's usual `defaultValue` uncontrolled pattern — every other field on both forms stays uncontrolled. This is required because seed-chip buttons need to set these fields' values programmatically; a plain `defaultValue` input can't be updated that way without an unreliable ref-forwarding chain through the shadcn `Input` wrapper. Because React state doesn't reset on a native form submit the way uncontrolled fields do, the Chain of Title "Add" form's controlled fields are reset by remounting the fields subcomponent via a `key` counter incremented after a successful add (see Task 4) — do not "fix" this by making it uncontrolled; that would break the seed chip.
- Suggested model tier per task is a comment under that task's heading (`_Model: haiku|sonnet_`), carried over from the prior increments' cost-discipline convention — mechanical/small tasks on haiku, complex integration work on sonnet, no opus.

---

## Task 1: Migration — `commitment_sch_a` and `chain_of_title`

_Model: haiku_

**Files:**
- Create: `supabase/migrations/0004_commitment_sch_a.sql`

**Interfaces:**
- Produces: tables `public.commitment_sch_a(id, order_id, form_type, company_state_of_org, requirements_time_period, env_protection_lien_statutes, issuing_agent, issuing_office, alta_universal_id, loan_id_number, commitment_number, revision_number, date_issued, time_issued, title_held_as, owner_policy_type, owner_coverage_amount, owner_coverage_tbd, owner_proposed_insured, loan_policy_type, loan_coverage_amount, loan_coverage_tbd, loan_proposed_insured, loan_mortgagee_clause, counter_signature, counter_signature_date, created_at, updated_at)`, `public.chain_of_title(id, commitment_sch_a_id, instrument_type, grantor, grantee, dated_date, recorded_date, book, page, instrument_number, created_at)`.

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
  time_issued time,
  title_held_as text,
  owner_policy_type text check (owner_policy_type in (
    'ALTA Owner''s Policy', 'ALTA Loan Policy', 'ALTA Homeowner''s Policy',
    'Leasehold Owner''s Policy', 'Leasehold Loan Policy', 'Construction Loan Policy', 'Other'
  )),
  owner_coverage_amount numeric(14,2),
  owner_coverage_tbd boolean not null default false,
  owner_proposed_insured text,
  loan_policy_type text check (loan_policy_type in (
    'ALTA Owner''s Policy', 'ALTA Loan Policy', 'ALTA Homeowner''s Policy',
    'Leasehold Owner''s Policy', 'Leasehold Loan Policy', 'Construction Loan Policy', 'Other'
  )),
  loan_coverage_amount numeric(14,2),
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

- [ ] **Step 2: Apply the migration to the real Supabase project**

Run (from `genesis-app/`):

```bash
npx supabase db push
```

Expected: no errors; the 2 new tables exist in the `campennydarden-cpu's Project` Supabase instance (ref `hlahrypglnmjjxrdtfkm`).

- [ ] **Step 3: Verify against the live project**

Query the project's table list (via the Supabase MCP `list_tables` tool, or `npx supabase db diff` against remote) and confirm both new tables appear with RLS enabled.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add supabase/migrations/0004_commitment_sch_a.sql
git commit -m "feat: add commitment_sch_a and chain_of_title schema"
```

---

## Task 2: Types and constants for the Commitment Schedule A domain

_Model: haiku_

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/constants.ts`

**Interfaces:**
- Produces: types `CommitmentScheduleA`, `ChainOfTitleEntry`. Constants `COMMITMENT_FORM_TYPES`, `ALTA_POLICY_FORM_TYPES`. Consumed by Tasks 3 and 4.

- [ ] **Step 1: Add types to `src/lib/types.ts`**

Append:

```typescript
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
  owner_coverage_amount: number | null
  owner_coverage_tbd: boolean
  owner_proposed_insured: string | null
  loan_policy_type: string | null
  loan_coverage_amount: number | null
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

- [ ] **Step 2: Add constants to `src/lib/constants.ts`**

Append (values verified against the prototype's `COMMITMENT_FORM_TYPES`/`POLICY_TYPES` — note the prototype's `POLICY_TYPES` name refers to the *ALTA policy form* list, distinct from this codebase's existing `POLICY_TYPES` constant which is Order Entry's None/Owner's/Loan/Simultaneous — named `ALTA_POLICY_FORM_TYPES` here to avoid colliding with that existing export):

```typescript
export const COMMITMENT_FORM_TYPES = ['Standard', 'Short Form'] as const

export const ALTA_POLICY_FORM_TYPES = [
  "ALTA Owner's Policy", 'ALTA Loan Policy', "ALTA Homeowner's Policy",
  "Leasehold Owner's Policy", 'Leasehold Loan Policy', 'Construction Loan Policy', 'Other',
] as const
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit` from `genesis-app/`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add Commitment Schedule A types and constants"
```

---

## Task 3: Commitment Schedule A main form

_Model: sonnet_

**Files:**
- Create: `src/app/actions/commitment-sch-a.ts`, `src/components/commitment-sch-a/CommitmentScheduleAForm.tsx`, `src/app/orders/[id]/commitment-sch-a/page.tsx`
- Modify: `src/components/FileSectionsNav.tsx`, `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: `CommitmentScheduleA` type and `COMMITMENT_FORM_TYPES`/`ALTA_POLICY_FORM_TYPES` constants from Task 2. `orders.policy_type`, `orders.id`. `prelim_search.effective_date`/`effective_time`. `contacts.id`/`name`/`role`/`mortgagee_clause`.
- Produces: server actions `upsertCommitmentScheduleA(orderId, formData)`. Route `/orders/[id]/commitment-sch-a`. Consumed by Task 4 (which extends `page.tsx` and adds Chain of Title below this form).

- [ ] **Step 1: Write the server action**

```typescript
// src/app/actions/commitment-sch-a.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function upsertCommitmentScheduleA(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const field = (name: string) => (formData.get(name) as string) || null
  const numField = (name: string) => {
    const v = formData.get(name) as string
    return v ? Number(v) : null
  }

  const { error } = await supabase.from('commitment_sch_a').upsert(
    {
      order_id: orderId,
      form_type: field('form_type') ?? 'Standard',
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
      owner_coverage_amount: numField('owner_coverage_amount'),
      owner_coverage_tbd: formData.get('owner_coverage_tbd') === 'on',
      owner_proposed_insured: field('owner_proposed_insured'),
      loan_policy_type: field('loan_policy_type'),
      loan_coverage_amount: numField('loan_coverage_amount'),
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
```

- [ ] **Step 2: Write the form component**

```tsx
// src/components/commitment-sch-a/CommitmentScheduleAForm.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COMMITMENT_FORM_TYPES, ALTA_POLICY_FORM_TYPES } from '@/lib/constants'
import type { CommitmentScheduleA } from '@/lib/types'

type ContactSeed = { id: string; name: string; role: string; mortgagee_clause: string | null }

export function CommitmentScheduleAForm({
  action,
  commitmentSchA,
  policyType,
  effectiveDateDisplay,
  buyerBorrowerContacts,
  lenderContacts,
}: {
  action: (formData: FormData) => void
  commitmentSchA: CommitmentScheduleA | null
  policyType: string
  effectiveDateDisplay: string
  buyerBorrowerContacts: ContactSeed[]
  lenderContacts: ContactSeed[]
}) {
  const [formType, setFormType] = useState<string>(commitmentSchA?.form_type ?? 'Standard')
  const [ownerProposedInsured, setOwnerProposedInsured] = useState(commitmentSchA?.owner_proposed_insured ?? '')
  const [loanProposedInsured, setLoanProposedInsured] = useState(commitmentSchA?.loan_proposed_insured ?? '')
  const [loanMortgageeClause, setLoanMortgageeClause] = useState(commitmentSchA?.loan_mortgagee_clause ?? '')

  const isShortForm = formType === 'Short Form'
  const showOwnerPolicy = !isShortForm && (policyType === "Owner's" || policyType === 'Simultaneous')
  const showLoanPolicy = isShortForm || policyType === 'Loan' || policyType === 'Simultaneous'

  const contactsWithMortgageeClause = lenderContacts.filter((c) => c.mortgagee_clause)

  return (
    <form action={action} className="space-y-8">
      <div className="rounded border p-4" data-testid="commitment-form-card">
        <h3 className="mb-4 font-semibold">Commitment Form</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="form_type">Form Type</Label>
            <Select
              name="form_type"
              defaultValue={commitmentSchA?.form_type ?? 'Standard'}
              onValueChange={(value) => setFormType(value ?? 'Standard')}
            >
              <SelectTrigger id="form_type">
                <SelectValue placeholder="— Select —" />
              </SelectTrigger>
              <SelectContent>
                {COMMITMENT_FORM_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="company_state_of_org">Company&apos;s State of Organization</Label>
            <Input
              id="company_state_of_org"
              name="company_state_of_org"
              defaultValue={commitmentSchA?.company_state_of_org ?? undefined}
              placeholder="e.g. Ohio corporation"
            />
          </div>
          <div>
            <Label htmlFor="requirements_time_period">Requirements Time Period</Label>
            <Input
              id="requirements_time_period"
              name="requirements_time_period"
              defaultValue={commitmentSchA?.requirements_time_period ?? undefined}
              placeholder="e.g. 6 months"
            />
          </div>
        </div>
        {isShortForm && (
          <div className="mt-4">
            <Label htmlFor="env_protection_lien_statutes">
              ALTA 8.1-06 Environmental Protection Lien Statutes
            </Label>
            <Textarea
              id="env_protection_lien_statutes"
              name="env_protection_lien_statutes"
              defaultValue={commitmentSchA?.env_protection_lien_statutes ?? undefined}
              placeholder="State statutes to be set forth on any ALTA 8.1-06 endorsement"
            />
          </div>
        )}
      </div>

      <div className="rounded border p-4" data-testid="transaction-id-card">
        <h3 className="mb-4 font-semibold">Transaction Identification Data</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="issuing_agent">Issuing Agent</Label>
            <Input id="issuing_agent" name="issuing_agent" defaultValue={commitmentSchA?.issuing_agent ?? undefined} />
          </div>
          <div>
            <Label htmlFor="issuing_office">Issuing Office</Label>
            <Input id="issuing_office" name="issuing_office" defaultValue={commitmentSchA?.issuing_office ?? undefined} />
          </div>
          <div>
            <Label htmlFor="alta_universal_id">ALTA Universal ID</Label>
            <Input id="alta_universal_id" name="alta_universal_id" defaultValue={commitmentSchA?.alta_universal_id ?? undefined} />
          </div>
          <div>
            <Label htmlFor="loan_id_number">Loan ID Number</Label>
            <Input id="loan_id_number" name="loan_id_number" defaultValue={commitmentSchA?.loan_id_number ?? undefined} />
          </div>
          <div>
            <Label htmlFor="commitment_number">Commitment Number</Label>
            <Input id="commitment_number" name="commitment_number" defaultValue={commitmentSchA?.commitment_number ?? undefined} />
          </div>
          <div>
            <Label htmlFor="revision_number">Revision Number</Label>
            <Input id="revision_number" name="revision_number" defaultValue={commitmentSchA?.revision_number ?? undefined} />
          </div>
        </div>
      </div>

      <div className="rounded border p-4" data-testid="policy-coverage-card">
        <h3 className="mb-4 font-semibold">Policy &amp; Coverage</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="date_issued">Date Issued</Label>
            <Input id="date_issued" name="date_issued" type="date" defaultValue={commitmentSchA?.date_issued ?? undefined} />
          </div>
          <div>
            <Label htmlFor="time_issued">Time Issued</Label>
            <Input id="time_issued" name="time_issued" type="time" defaultValue={commitmentSchA?.time_issued ?? undefined} />
          </div>
          <div>
            <Label>Effective Date</Label>
            <p className="mt-2 text-sm text-slate-700" data-testid="effective-date-fact">
              {effectiveDateDisplay}
            </p>
          </div>
          <div>
            <Label>Policy Type</Label>
            <p className="mt-2 text-sm text-slate-700" data-testid="policy-type-fact">
              {policyType}
            </p>
          </div>
          {isShortForm ? (
            <div>
              <Label>The Estate or Interest in the Land</Label>
              <p className="mt-2 text-sm text-slate-700" data-testid="estate-fact">
                Fee Simple (fixed by the ALTA Short Form Commitment)
              </p>
            </div>
          ) : (
            <div>
              <Label htmlFor="title_held_as">The Estate or Interest in the Land</Label>
              <Input
                id="title_held_as"
                name="title_held_as"
                defaultValue={commitmentSchA?.title_held_as ?? undefined}
                placeholder="e.g. Fee Simple, Leasehold"
              />
            </div>
          )}
        </div>
        {!showOwnerPolicy && !showLoanPolicy && (
          <p className="mt-4 text-sm text-slate-500">
            Set a Policy Type (Owner&apos;s, Loan, or Simultaneous) on Order Entry to show the policy block(s) below.
          </p>
        )}
      </div>

      {showOwnerPolicy && (
        <div className="rounded border p-4" data-testid="owner-policy-card">
          <h3 className="mb-4 font-semibold">Owner&apos;s Policy</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="owner_policy_type">ALTA Form</Label>
              <Select name="owner_policy_type" defaultValue={commitmentSchA?.owner_policy_type ?? undefined}>
                <SelectTrigger id="owner_policy_type">
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {ALTA_POLICY_FORM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="owner_coverage_amount">Coverage Amount</Label>
              <Input
                id="owner_coverage_amount"
                name="owner_coverage_amount"
                type="number"
                step="0.01"
                defaultValue={commitmentSchA?.owner_coverage_amount ?? undefined}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox id="owner_coverage_tbd" name="owner_coverage_tbd" defaultChecked={commitmentSchA?.owner_coverage_tbd ?? false} />
              <Label htmlFor="owner_coverage_tbd">Coverage TBD</Label>
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="owner_proposed_insured">Proposed Insured</Label>
            <Input
              id="owner_proposed_insured"
              name="owner_proposed_insured"
              value={ownerProposedInsured}
              onChange={(e) => setOwnerProposedInsured(e.target.value)}
            />
          </div>
          {buyerBorrowerContacts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" data-testid="owner-insured-seed-chips">
              <span className="text-xs text-slate-500">From this file:</span>
              {buyerBorrowerContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                  onClick={() => setOwnerProposedInsured(c.name)}
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
          <h3 className="mb-4 font-semibold">Loan Policy</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="loan_policy_type">ALTA Form</Label>
              <Select name="loan_policy_type" defaultValue={commitmentSchA?.loan_policy_type ?? undefined}>
                <SelectTrigger id="loan_policy_type">
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {ALTA_POLICY_FORM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="loan_coverage_amount">Coverage Amount</Label>
              <Input
                id="loan_coverage_amount"
                name="loan_coverage_amount"
                type="number"
                step="0.01"
                defaultValue={commitmentSchA?.loan_coverage_amount ?? undefined}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox id="loan_coverage_tbd" name="loan_coverage_tbd" defaultChecked={commitmentSchA?.loan_coverage_tbd ?? false} />
              <Label htmlFor="loan_coverage_tbd">Coverage TBD</Label>
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="loan_proposed_insured">Proposed Insured</Label>
            <Input
              id="loan_proposed_insured"
              name="loan_proposed_insured"
              value={loanProposedInsured}
              onChange={(e) => setLoanProposedInsured(e.target.value)}
            />
          </div>
          {lenderContacts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" data-testid="loan-insured-seed-chips">
              <span className="text-xs text-slate-500">From this file:</span>
              {lenderContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                  onClick={() => setLoanProposedInsured(c.name)}
                >
                  + {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Label htmlFor="loan_mortgagee_clause">Mortgagee Clause</Label>
            <Textarea
              id="loan_mortgagee_clause"
              name="loan_mortgagee_clause"
              value={loanMortgageeClause}
              onChange={(e) => setLoanMortgageeClause(e.target.value)}
              placeholder="ISAOA/ATIMA clause language"
            />
          </div>
          {contactsWithMortgageeClause.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" data-testid="mortgagee-clause-seed-chips">
              <span className="text-xs text-slate-500">From Lender contact on file:</span>
              {contactsWithMortgageeClause.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                  title={c.mortgagee_clause ?? undefined}
                  onClick={() => setLoanMortgageeClause(c.mortgagee_clause ?? '')}
                >
                  + Copy from {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded border p-4" data-testid="countersignature-card">
        <h3 className="mb-4 font-semibold">Countersignature</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="counter_signature">Counter Signature</Label>
            <Input
              id="counter_signature"
              name="counter_signature"
              defaultValue={commitmentSchA?.counter_signature ?? undefined}
              placeholder="Licensee name"
            />
          </div>
          <div>
            <Label htmlFor="counter_signature_date">Counter Signature Date</Label>
            <Input
              id="counter_signature_date"
              name="counter_signature_date"
              type="date"
              defaultValue={commitmentSchA?.counter_signature_date ?? undefined}
            />
          </div>
        </div>
      </div>

      <Button type="submit">Save Changes</Button>
    </form>
  )
}
```

- [ ] **Step 3: Write the page**

```tsx
// src/app/orders/[id]/commitment-sch-a/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { upsertCommitmentScheduleA } from '@/app/actions/commitment-sch-a'
import { CommitmentScheduleAForm } from '@/components/commitment-sch-a/CommitmentScheduleAForm'

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

  const { data: commitmentSchA } = await supabase
    .from('commitment_sch_a')
    .select('*')
    .eq('order_id', id)
    .maybeSingle()

  const { data: prelimSearch } = await supabase
    .from('prelim_search')
    .select('effective_date, effective_time')
    .eq('order_id', id)
    .maybeSingle()

  const { data: contacts } = await supabase.from('contacts').select('id, name, role, mortgagee_clause').eq('order_id', id)

  const buyerBorrowerContacts = (contacts ?? []).filter(
    (c) => c.role.toLowerCase().includes('buyer') || c.role.toLowerCase().includes('borrower')
  )
  const lenderContacts = (contacts ?? []).filter((c) => c.role.toLowerCase().includes('lender'))

  const effectiveDateDisplay = prelimSearch?.effective_date
    ? `${prelimSearch.effective_date}${prelimSearch.effective_time ? ' ' + prelimSearch.effective_time : ''}`
    : '— set on Prelim Search'

  const upsertCommitmentScheduleAWithId = upsertCommitmentScheduleA.bind(null, id)

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <CommitmentScheduleAForm
        action={upsertCommitmentScheduleAWithId}
        commitmentSchA={commitmentSchA ?? null}
        policyType={order.policy_type}
        effectiveDateDisplay={effectiveDateDisplay}
        buyerBorrowerContacts={buyerBorrowerContacts}
        lenderContacts={lenderContacts}
      />
    </div>
  )
}
```

- [ ] **Step 4: Wire the nav**

In `src/components/FileSectionsNav.tsx`, change the Title group's Commitment Sch A entry from a disabled placeholder to a real link:

```typescript
      { label: 'Commitment Sch A', segment: 'commitment-sch-a' },
```

(replacing `{ label: 'Commitment Sch A' }` in the `Title` group's `items` array — leave `Commitment Sch B-I/B-II` and `Curative` as disabled placeholders, unchanged.)

- [ ] **Step 5: Verify build**

Run: `npm run build && npm run lint`
Expected: succeeds.

- [ ] **Step 6: Extend the e2e test**

Add a new `test(...)` block in `tests/e2e/order-entry.spec.ts`:

```typescript
  test('commitment sch A: Form Type and Policy Type drive Owner\'s/Loan Policy visibility', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByLabel('Policy Type').selectOption('Simultaneous')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch A' }).click()
    await page.waitForURL('**/commitment-sch-a')

    await expect(page.getByTestId('owner-policy-card')).toBeVisible()
    await expect(page.getByTestId('loan-policy-card')).toBeVisible()

    await page.locator('#form_type').click()
    await page.getByRole('option', { name: 'Short Form' }).click()

    await expect(page.getByTestId('owner-policy-card')).not.toBeVisible()
    await expect(page.getByTestId('loan-policy-card')).toBeVisible()
    await expect(page.getByTestId('estate-fact')).toContainText('Fee Simple')
    await expect(page.getByLabel(/Environmental Protection Lien Statutes/)).toBeVisible()

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/commitment-sch-a')
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('estate-fact')).toContainText('Fee Simple')
    await expect(page.getByLabel(/Environmental Protection Lien Statutes/)).toBeVisible()
  })
```

- [ ] **Step 7: Run it**

Run: `npx playwright test -g "Form Type and Policy Type drive"`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add src/app/actions/commitment-sch-a.ts src/components/commitment-sch-a/CommitmentScheduleAForm.tsx src/app/orders/\[id\]/commitment-sch-a/page.tsx src/components/FileSectionsNav.tsx tests/e2e/order-entry.spec.ts
git commit -m "feat: add Commitment Schedule A main form"
```

---

## Task 4: Chain of Title section

_Model: sonnet_

**Files:**
- Modify: `src/app/actions/commitment-sch-a.ts`, `src/app/orders/[id]/commitment-sch-a/page.tsx`, `tests/e2e/order-entry.spec.ts`
- Create: `src/components/commitment-sch-a/ChainOfTitleSection.tsx`

**Interfaces:**
- Consumes: `ChainOfTitleEntry` type from Task 2. `commitmentSchA.id` from Task 3's page fetch (Chain of Title needs the parent row's FK, so this section only renders once `commitment_sch_a` has a saved row — same pattern as Property's easements and Prelim Search's sub-lists).
- Produces: server actions `addChainOfTitleEntry(commitmentSchAId, orderId, formData)`, `updateChainOfTitleEntry(id, orderId, formData)`, `deleteChainOfTitleEntry(orderId, id)`.

- [ ] **Step 1: Add the Chain of Title actions**

Append to `src/app/actions/commitment-sch-a.ts`:

```typescript
function chainOfTitleFieldsFromFormData(formData: FormData) {
  const field = (name: string) => (formData.get(name) as string) || null
  return {
    instrument_type: field('instrument_type'),
    grantor: field('grantor'),
    grantee: field('grantee'),
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
  }
}

export async function addChainOfTitleEntry(commitmentSchAId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('chain_of_title').insert({
    commitment_sch_a_id: commitmentSchAId,
    ...chainOfTitleFieldsFromFormData(formData),
  })

  if (error) {
    console.error('addChainOfTitleEntry failed:', error)
    redirect(
      `/orders/${orderId}/commitment-sch-a?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/commitment-sch-a`)
}

export async function updateChainOfTitleEntry(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('chain_of_title').update(chainOfTitleFieldsFromFormData(formData)).eq('id', id)

  if (error) {
    console.error('updateChainOfTitleEntry failed:', error)
    redirect(
      `/orders/${orderId}/commitment-sch-a?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/commitment-sch-a`)
}

export async function deleteChainOfTitleEntry(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('chain_of_title').delete().eq('id', id)

  if (error) {
    console.error('deleteChainOfTitleEntry failed:', error)
    redirect(
      `/orders/${orderId}/commitment-sch-a?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/commitment-sch-a`)
}
```

- [ ] **Step 2: Write the component**

```tsx
// src/components/commitment-sch-a/ChainOfTitleSection.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addChainOfTitleEntry, updateChainOfTitleEntry, deleteChainOfTitleEntry } from '@/app/actions/commitment-sch-a'
import type { ChainOfTitleEntry } from '@/lib/types'

type DerivationSeed = { instrumentType: string; grantor: string; grantee: string } | null

function ChainOfTitleFields({
  entry,
  idPrefix,
  seedValues,
}: {
  entry?: ChainOfTitleEntry
  idPrefix: string
  seedValues?: DerivationSeed
}) {
  const [instrumentType, setInstrumentType] = useState(entry?.instrument_type ?? '')
  const [grantor, setGrantor] = useState(entry?.grantor ?? '')
  const [grantee, setGrantee] = useState(entry?.grantee ?? '')

  return (
    <div className="space-y-3">
      {seedValues && (
        <button
          type="button"
          className="text-sm text-slate-600 underline"
          onClick={() => {
            setInstrumentType(seedValues.instrumentType)
            setGrantor(seedValues.grantor)
            setGrantee(seedValues.grantee)
          }}
        >
          + Copy from Derivation ({seedValues.grantor || '?'} → {seedValues.grantee || '?'})
        </button>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-instrument_type`}>Instrument Type</Label>
          <Input
            id={`${idPrefix}-instrument_type`}
            name="instrument_type"
            value={instrumentType}
            onChange={(e) => setInstrumentType(e.target.value)}
            placeholder="e.g. Warranty Deed"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-grantor`}>Grantor</Label>
          <Input id={`${idPrefix}-grantor`} name="grantor" value={grantor} onChange={(e) => setGrantor(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-grantee`}>Grantee</Label>
          <Input id={`${idPrefix}-grantee`} name="grantee" value={grantee} onChange={(e) => setGrantee(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-dated_date`}>Dated Date</Label>
          <Input id={`${idPrefix}-dated_date`} name="dated_date" type="date" defaultValue={entry?.dated_date ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-recorded_date`}>Recorded Date</Label>
          <Input id={`${idPrefix}-recorded_date`} name="recorded_date" type="date" defaultValue={entry?.recorded_date ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-book`}>Book</Label>
          <Input id={`${idPrefix}-book`} name="book" defaultValue={entry?.book ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-page`}>Page</Label>
          <Input id={`${idPrefix}-page`} name="page" defaultValue={entry?.page ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-instrument_number`}>Instrument Number</Label>
          <Input id={`${idPrefix}-instrument_number`} name="instrument_number" defaultValue={entry?.instrument_number ?? undefined} />
        </div>
      </div>
    </div>
  )
}

export function ChainOfTitleSection({
  orderId,
  commitmentSchAId,
  entries,
  derivationSeed,
}: {
  orderId: string
  commitmentSchAId: string
  entries: ChainOfTitleEntry[]
  derivationSeed: DerivationSeed
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  // Controlled add-form fields (instrument_type/grantor/grantee) don't reset on native
  // form submit the way this codebase's usual uncontrolled fields do — remounting via
  // this key after a successful add is the reset mechanism. See plan Global Constraints.
  const [addFormKey, setAddFormKey] = useState(0)

  return (
    <section id="chain-of-title" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-semibold">Chain of Title</h2>

      <ul className="mb-6 space-y-4" data-testid="chain-of-title-list">
        {entries.map((entry) =>
          editingId === entry.id ? (
            <li key={entry.id} className="rounded border p-4" data-testid="chain-of-title-row-editing">
              <form
                action={async (formData) => {
                  await updateChainOfTitleEntry(entry.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-4"
              >
                <ChainOfTitleFields entry={entry} idPrefix={`cot-edit-${entry.id}`} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </li>
          ) : (
            <li key={entry.id} className="rounded border p-4" data-testid="chain-of-title-row">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    {entry.instrument_type || 'Instrument'}: {entry.grantor || '?'} → {entry.grantee || '?'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {[
                      entry.dated_date && `Dated ${entry.dated_date}`,
                      entry.recorded_date && `Recorded ${entry.recorded_date}`,
                      (entry.book || entry.page) && `Bk ${entry.book ?? ''} Pg ${entry.page ?? ''}`,
                      entry.instrument_number && `Instr# ${entry.instrument_number}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="text-sm text-slate-600 hover:underline"
                    onClick={() => setEditingId(entry.id)}
                    aria-label={`Edit ${entry.instrument_type ?? 'entry'}`}
                  >
                    Edit
                  </button>
                  <form action={deleteChainOfTitleEntry.bind(null, orderId, entry.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            </li>
          )
        )}
        {entries.length === 0 && <p className="text-sm text-slate-500">No Chain of Title entries added.</p>}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add a Chain of Title Entry</summary>
        <form
          action={async (formData) => {
            await addChainOfTitleEntry(commitmentSchAId, orderId, formData)
            setAddFormKey((k) => k + 1)
          }}
          className="mt-4 space-y-4"
        >
          <ChainOfTitleFields key={addFormKey} idPrefix="cot-new" seedValues={derivationSeed} />
          <Button type="submit">Add Chain of Title Entry</Button>
        </form>
      </details>
    </section>
  )
}
```

- [ ] **Step 3: Wire it into the page**

In `src/app/orders/[id]/commitment-sch-a/page.tsx`, add the Chain of Title fetch and render it below the form. Add these imports:

```typescript
import { ChainOfTitleSection } from '@/components/commitment-sch-a/ChainOfTitleSection'
```

Change the `prelimSearch` query to also select the Derivation fields the seed needs:

```typescript
  const { data: prelimSearch } = await supabase
    .from('prelim_search')
    .select('effective_date, effective_time, derivation_instrument_type, derivation_grantor_name, derivation_grantee_name')
    .eq('order_id', id)
    .maybeSingle()
```

Add the Chain of Title fetch and the derivation seed computation (after the `contacts`/`lenderContacts` block, before the `return`):

```typescript
  const { data: chainOfTitle } = commitmentSchA
    ? await supabase
        .from('chain_of_title')
        .select('*')
        .eq('commitment_sch_a_id', commitmentSchA.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  const derivationSeed =
    prelimSearch && (prelimSearch.derivation_grantee_name || prelimSearch.derivation_grantor_name)
      ? {
          instrumentType: prelimSearch.derivation_instrument_type ?? '',
          grantor: prelimSearch.derivation_grantor_name ?? '',
          grantee: prelimSearch.derivation_grantee_name ?? '',
        }
      : null
```

Add the section below `<CommitmentScheduleAForm .../>` in the returned JSX:

```tsx
      {commitmentSchA && (
        <div className="mt-10">
          <ChainOfTitleSection
            orderId={id}
            commitmentSchAId={commitmentSchA.id}
            entries={chainOfTitle ?? []}
            derivationSeed={derivationSeed}
          />
        </div>
      )}
```

- [ ] **Step 4: Verify build**

Run: `npm run build && npm run lint`
Expected: succeeds.

- [ ] **Step 5: Extend the e2e test**

Add a new `test(...)` block in `tests/e2e/order-entry.spec.ts` (kept separate from Task 3's test so a failure here doesn't obscure a regression there):

```typescript
  test('commitment sch A: Chain of Title add/edit/remove with Copy from Derivation seed, and contact seed chips', async ({
    page,
  }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('County').fill('Lorain')
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByLabel('Policy Type').selectOption("Owner's")
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/order-entry')

    // Derivation on Prelim Search, so the Chain of Title "Copy from Derivation" seed has data.
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')
    await page.getByLabel('Instrument Type').click()
    await page.getByRole('option', { name: 'Warranty Deed', exact: true }).click()
    await page.getByLabel('Grantee Name').fill('Test Trust Co')
    await page.getByLabel('Grantor Name').fill('Original Owner LLC')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    // Add a Buyer/Borrower contact and a Lender contact (with a mortgagee clause) for the seed chips.
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Contacts' }).click()
    await page.waitForURL('**/contacts')

    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').fill('Buyer/Borrower')
    await page.getByLabel('Name').fill('Jane Buyer')
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await expect(page.getByText('Jane Buyer')).toBeVisible()

    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').fill('Lender')
    await page.getByLabel('Name').fill('First National Bank')
    await page.getByLabel('Mortgagee Clause').fill('First National Bank, its successors and/or assigns, ISAOA/ATIMA')
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await expect(page.getByText('First National Bank')).toBeVisible()

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch A' }).click()
    await page.waitForURL('**/commitment-sch-a')

    await expect(page.getByTestId('owner-insured-seed-chips')).toContainText('Jane Buyer')
    await page.getByRole('button', { name: '+ Jane Buyer' }).click()
    await expect(page.getByLabel('Proposed Insured')).toHaveValue('Jane Buyer')

    // Save the main form first - chain_of_title needs the commitment_sch_a row's FK.
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/commitment-sch-a')
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('chain-of-title-list')).toBeVisible()
    await page.getByText('Add a Chain of Title Entry').click()
    await page.getByText(/Copy from Derivation/).click()

    await expect(page.locator('#cot-new-instrument_type')).toHaveValue('Warranty Deed')
    await expect(page.locator('#cot-new-grantor')).toHaveValue('Original Owner LLC')
    await expect(page.locator('#cot-new-grantee')).toHaveValue('Test Trust Co')

    await page.locator('#cot-new-book').fill('1234')
    await page.locator('#cot-new-page').fill('567')
    await page.getByRole('button', { name: 'Add Chain of Title Entry' }).click()

    await expect(page.getByTestId('chain-of-title-row')).toContainText('Warranty Deed: Original Owner LLC → Test Trust Co')

    await page.getByTestId('chain-of-title-row').getByRole('button', { name: /Edit/ }).click()
    await page.getByTestId('chain-of-title-row-editing').locator('[name="grantee"]').fill('Updated Trust Co')
    await page.getByTestId('chain-of-title-row-editing').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('chain-of-title-row')).toContainText('Updated Trust Co')

    await page.getByTestId('chain-of-title-row').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('chain-of-title-row')).not.toBeVisible()
  })
```

- [ ] **Step 6: Run it**

Run: `npx playwright test -g "Chain of Title add/edit/remove"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add src/app/actions/commitment-sch-a.ts src/components/commitment-sch-a/ChainOfTitleSection.tsx src/app/orders/\[id\]/commitment-sch-a/page.tsx tests/e2e/order-entry.spec.ts
git commit -m "feat: add Chain of Title section to Commitment Schedule A"
```

---

## Task 5: Full regression, Build Log update, sync

_Model: haiku_

**Files:**
- Modify: `M&L Title/M&L Title - Obsidian Vault/Genesis Build Log.md`, `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Commitment Schedule A Design.md`, `M&L Title/M&L Title - Obsidian Vault/Welcome.md`

**Interfaces:**
- Consumes: nothing new — this task closes out the increment.

- [ ] **Step 1: Run the full test suite**

Run: `npx playwright test` from `genesis-app/`
Expected: all tests pass, including both new tests from Tasks 3–4 plus every pre-existing test in `order-entry.spec.ts`.

- [ ] **Step 2: Run a final build + lint pass**

Run: `npm run build && npm run lint`
Expected: both succeed cleanly.

- [ ] **Step 3: Update the Build Log**

Open `M&L Title/M&L Title - Obsidian Vault/Genesis Build Log.md`. Add a new change-log entry (matching the existing entries' format) noting: Commitment Schedule A shipped — Commitment Form, Transaction Identification Data, Policy & Coverage (Effective Date/Policy Type pulled read-only from Prelim Search/Order Entry), Owner's/Loan Policy cards with live Form-Type-driven visibility and Coverage TBD, seed chips for Proposed Insured (Buyer/Borrower/Lender contacts) and Mortgagee Clause (from the Lender contact's own field), Chain of Title (full add/edit/delete with a "Copy from Derivation" seed), Countersignature; new tables `commitment_sch_a`, `chain_of_title`; N/N Playwright tests passing (fill in the actual count from Step 1's output). Note this task only covers the state through the tasks in this plan — do NOT write "merged" or "deployed" here; those happen after `finishing-a-development-branch` completes, which is outside this plan's tasks. Write "built, pending merge" (or the exact wording the prior increment used at this same point in its own SDD run, before its merge — check `genesis-app` git history for the pre-merge vault-edit phrasing around commit `94d2afd`) instead.

- [ ] **Step 4: Update the design doc's status**

In `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Commitment Schedule A Design.md`, change the frontmatter `status:` from `design complete — pending implementation plan` to `built, pending merge` (matching whatever exact phrasing the vault used for Prelim Title Search's design doc at the equivalent pre-merge point, if still discoverable; otherwise plain accurate language) and update `updated:` to today's date.

- [ ] **Step 5: Update Welcome.md's index**

In `M&L Title/M&L Title - Obsidian Vault/Welcome.md`, update the Commitment Schedule A line from "**Design complete 2026-08-29, pending implementation plan.**" to reflect it's now built and pending merge, matching the phrasing style used for the other entries above it.

- [ ] **Step 6: Sync to the Desktop backup copy**

Per the project's standing process: this session worked from the T7 (primary) copy directly, so no forward-sync is needed — but confirm T7 and Desktop haven't drifted from an unrelated change mid-session:

```bash
diff -rq "/Volumes/T7/Claude Code/Genesis Platform" "/Users/campenny/Desktop/Claude Code/Genesis Platform" 2>/dev/null | grep -v "\.claude-flow\|\.obsidian/workspace.json\|\.DS_Store\|\.git/index"
```

If this reports only the files touched by Tasks 1–4 (migration, new components, actions, types, constants, FileSectionsNav.tsx, e2e spec, and this task's 3 vault edits), that's expected — the actual sync (and any merge/push decision) happens after this plan's tasks are done, via `superpowers:finishing-a-development-branch`, not as part of this task.

- [ ] **Step 7: Confirm the commit history**

```bash
git -C "/Volumes/T7/Claude Code/Genesis Platform/genesis-app" log --oneline -6
```

Expected: 4 new commits from Tasks 1–4 (schema, types/constants, main form, Chain of Title), each with a real, testable diff. Vault edits from Steps 3–5 above aren't part of the `genesis-app` git repo — they're saved directly to the Obsidian vault, not committed.

---

## Self-review notes (writing-plans skill, Step 5)

- **Spec coverage:** every Decisions-table row (page structure, live visibility, Coverage TBD, Underwriter deferral, seed chips, Chain of Title full edit, read-only facts) and every Field List subsection (Commitment Form, Transaction ID, Policy & Coverage, Owner's Policy, Loan Policy, Chain of Title, Countersignature) has a task covering it. The Schema section's 2 tables (Task 1), the Routing & components section's 5 files plus the nav diff (Tasks 3–4), and the Testing section's described flow (split across the two e2e tests in Tasks 3 and 4, matching every scenario the design doc's Testing section names) are each covered.
- **Out of scope items respected:** Underwriter field, Commitment Schedule B-I/B-II and Curative, SoftPro's multi-policy model, and the generated Commitment document itself are deliberately not built anywhere in this plan, matching the design doc.
- **Placeholder scan:** no TBD/TODO markers; every step carries real, complete code.
- **Type consistency:** `CommitmentScheduleA` and `ChainOfTitleEntry` (Task 2) match the columns actions in Tasks 3–4 read/write and the props components in Tasks 3–4 consume; `derivationSeed`'s shape is identical between where `ChainOfTitleSection` declares it (`DerivationSeed`) and where `page.tsx` constructs it (Task 4, Step 3).
