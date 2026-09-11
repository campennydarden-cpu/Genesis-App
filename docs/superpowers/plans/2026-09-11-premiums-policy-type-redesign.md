# Title Insurance Premiums Policy-Type-Dependent Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Title Insurance Premiums screen policy-type-aware — the order's existing top-level Policy Type drives Simultaneous Issue behavior, Loan Policy lines get underwriter-restricted variant options, and a new small Underwriters admin table backs both the variant restriction and a stored (not yet auto-applied) default split configuration.

**Architecture:** Three new Supabase tables (`underwriters`, `underwriter_loan_policy_variants`, `underwriter_default_splits`) plus three new columns on the existing `title_insurance_premiums` table, a new permission-gated admin console, and targeted edits to the already-shipped `PremiumsPanel.tsx`/`title-premiums.ts`. Premium amounts stay fully manual — no rate-table calculation in this pass.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + `@supabase/ssr`), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-09-11-premiums-endorsements-policy-type-redesign.md`

## Global Constraints

- **Real dependency, confirm before starting Task 3:** the admin console (Task 4) is gated by `hasPermission(supabase, 'manage_underwriters')`, which requires the Staff Directory & Permissions plan (`docs/superpowers/plans/2026-09-10-staff-directory-permissions.md`) to be built and merged first. Do not start Task 3 until that's confirmed live.
- Migration file numbers below are written as `00XX` — before creating each migration, run `ls supabase/migrations | sort -V | tail -3` to find the actual next available number.
- New tables get RLS enabled with the same permissive policy already used throughout this codebase: `create policy "Authenticated M&L staff can do anything with X" on public.X for all to authenticated using (true) with check (true);`
- New server actions in Task 3 (the admin actions) call `revalidatePath('/', 'layout')`. The existing `title-premiums.ts` actions modified in Task 5 keep their current `revalidatePath('/orders/${orderId}/premiums')` calls unchanged — not part of this plan's scope to fix.

---

### Task 1: Underwriters schema migration

**Files:**
- Create: `supabase/migrations/00XX_underwriters.sql`

**Interfaces:**
- Produces: tables `underwriters`, `underwriter_loan_policy_variants`, `underwriter_default_splits`; new columns `underwriter_id`, `loan_policy_variant`, `simultaneous_issue_premium` on `title_insurance_premiums`. Tasks 2-7 all depend on this.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/00XX_underwriters.sql
create table public.underwriters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.underwriter_loan_policy_variants (
  id uuid primary key default gen_random_uuid(),
  underwriter_id uuid not null references public.underwriters(id) on delete cascade,
  state text not null,
  variant text not null check (variant in (
    'Refinance Loan Policy', 'Limited Coverage Junior Loan Policy',
    'Standard Loan Policy', 'Enhanced Loan Policy', 'Centralized Loan Policy'
  )),
  created_at timestamptz not null default now(),
  unique (underwriter_id, state, variant)
);

create table public.underwriter_default_splits (
  id uuid primary key default gen_random_uuid(),
  underwriter_id uuid not null references public.underwriters(id) on delete cascade,
  state text not null,
  sort_order integer not null default 0,
  split_to_label text,
  basis text,
  percent numeric,
  bill_code text,
  created_at timestamptz not null default now()
);

create index underwriter_loan_policy_variants_lookup_idx
  on public.underwriter_loan_policy_variants(underwriter_id, state);
create index underwriter_default_splits_lookup_idx
  on public.underwriter_default_splits(underwriter_id, state);

alter table public.title_insurance_premiums
  add column underwriter_id uuid references public.underwriters(id) on delete set null,
  add column loan_policy_variant text check (loan_policy_variant in (
    'Refinance Loan Policy', 'Limited Coverage Junior Loan Policy',
    'Standard Loan Policy', 'Enhanced Loan Policy', 'Centralized Loan Policy'
  )),
  add column simultaneous_issue_premium numeric;

alter table public.underwriters enable row level security;
alter table public.underwriter_loan_policy_variants enable row level security;
alter table public.underwriter_default_splits enable row level security;

create policy "Authenticated M&L staff can do anything with underwriters"
  on public.underwriters for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with underwriter_loan_policy_variants"
  on public.underwriter_loan_policy_variants for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with underwriter_default_splits"
  on public.underwriter_default_splits for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: migration applies cleanly; `title_insurance_premiums` has the 3 new nullable columns; the 3 new tables exist.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00XX_underwriters.sql
git commit -m "feat: add underwriters schema (master table, loan policy variants, default splits)"
```

---

### Task 2: Types, constants, and permission

**Files:**
- Modify: `src/lib/types.ts` (add types; extend `TitleInsurancePremium` at line 496-507)
- Modify: `src/lib/constants.ts` (add `LOAN_POLICY_VARIANTS`; add `manage_underwriters` to `PERMISSIONS`)

**Interfaces:**
- Consumes: `PERMISSIONS`/`PermissionKey` from the Staff Directory plan.
- Produces: `Underwriter`, `UnderwriterLoanPolicyVariant`, `UnderwriterDefaultSplit`, widened `TitleInsurancePremium`, `LOAN_POLICY_VARIANTS`, `LoanPolicyVariant`. Every later task imports these.

- [ ] **Step 1: Add types to `src/lib/types.ts`**

```ts
export type Underwriter = {
  id: string
  name: string
}

export type UnderwriterLoanPolicyVariant = {
  id: string
  underwriter_id: string
  state: string
  variant: string
}

export type UnderwriterDefaultSplit = {
  id: string
  underwriter_id: string
  state: string
  sort_order: number
  split_to_label: string | null
  basis: string | null
  percent: number | null
  bill_code: string | null
}
```

- [ ] **Step 2: Widen `TitleInsurancePremium`**

In `src/lib/types.ts`, change:
```ts
export type TitleInsurancePremium = {
  id: string
  order_id: string
  sort_order: number
  policy_type: string | null
  underwriter_contact_id: string | null
  coverage_amount: number | null
  base_premium: number | null
  final_premium: number | null
  bill_code: string | null
  cdf_page2_line_id: string | null
}
```
to:
```ts
export type TitleInsurancePremium = {
  id: string
  order_id: string
  sort_order: number
  policy_type: string | null
  underwriter_contact_id: string | null
  underwriter_id: string | null
  loan_policy_variant: string | null
  simultaneous_issue_premium: number | null
  coverage_amount: number | null
  base_premium: number | null
  final_premium: number | null
  bill_code: string | null
  cdf_page2_line_id: string | null
}
```

- [ ] **Step 3: Add `LOAN_POLICY_VARIANTS` and the new permission to `src/lib/constants.ts`**

```ts
export const LOAN_POLICY_VARIANTS = [
  'Refinance Loan Policy',
  'Limited Coverage Junior Loan Policy',
  'Standard Loan Policy',
  'Enhanced Loan Policy',
  'Centralized Loan Policy',
] as const
export type LoanPolicyVariant = (typeof LOAN_POLICY_VARIANTS)[number]
```

In the same file, add one entry to the existing `PERMISSIONS` array (from the Staff Directory plan — this entry is additive alongside whatever that plan and the Sch B plan already added):
```ts
{ key: 'manage_underwriters', label: 'Manage Underwriters' },
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: clean build — additive-only, nothing new imports these yet.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add Underwriter types, LOAN_POLICY_VARIANTS, and manage_underwriters permission"
```

---

### Task 3: Underwriter admin server actions

**Files:**
- Create: `src/app/actions/underwriters.ts`

**Interfaces:**
- Consumes: `hasPermission` (`src/lib/permissions.ts`, Staff Directory plan — Global Constraints dependency), types from Task 2.
- Produces: `listUnderwriters()`, `createUnderwriter`, `renameUnderwriter`, `deleteUnderwriter`, `listUnderwriterVariants(underwriterId)`, `toggleUnderwriterVariant`, `listUnderwriterDefaultSplits(underwriterId)`, `createUnderwriterDefaultSplit`, `updateUnderwriterDefaultSplit`, `deleteUnderwriterDefaultSplit`, `listUnderwriterVariantsForState(state)`. Task 4 (admin UI) and Task 6 (Premiums page loader) both call these.

- [ ] **Step 1: Write `src/app/actions/underwriters.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import type { Underwriter, UnderwriterLoanPolicyVariant, UnderwriterDefaultSplit } from '@/lib/types'

async function requirePermission() {
  const supabase = await createClient()
  if (!(await hasPermission(supabase, 'manage_underwriters'))) {
    redirect('/orders')
  }
  return supabase
}

export async function listUnderwriters(): Promise<Underwriter[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('underwriters').select('*').order('name')
  return data ?? []
}

export async function createUnderwriter(formData: FormData) {
  const supabase = await requirePermission()
  const name = formData.get('name') as string
  const { error } = await supabase.from('underwriters').insert({ name })
  if (error) console.error('createUnderwriter failed:', error)
  revalidatePath('/', 'layout')
}

export async function renameUnderwriter(underwriterId: string, formData: FormData) {
  const supabase = await requirePermission()
  const name = formData.get('name') as string
  const { error } = await supabase.from('underwriters').update({ name }).eq('id', underwriterId)
  if (error) console.error('renameUnderwriter failed:', error)
  revalidatePath('/', 'layout')
}

export async function deleteUnderwriter(underwriterId: string) {
  const supabase = await requirePermission()
  const { error } = await supabase.from('underwriters').delete().eq('id', underwriterId)
  if (error) console.error('deleteUnderwriter failed:', error)
  revalidatePath('/', 'layout')
}

export async function listUnderwriterVariants(underwriterId: string): Promise<UnderwriterLoanPolicyVariant[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('underwriter_loan_policy_variants')
    .select('*')
    .eq('underwriter_id', underwriterId)
    .order('state')
  return data ?? []
}

/** Checked -> insert the row if missing. Unchecked -> delete it if present. Idempotent either way. */
export async function toggleUnderwriterVariant(underwriterId: string, state: string, variant: string, enabled: boolean) {
  const supabase = await requirePermission()
  if (enabled) {
    const { error } = await supabase
      .from('underwriter_loan_policy_variants')
      .upsert({ underwriter_id: underwriterId, state, variant }, { onConflict: 'underwriter_id,state,variant' })
    if (error) console.error('toggleUnderwriterVariant (enable) failed:', error)
  } else {
    const { error } = await supabase
      .from('underwriter_loan_policy_variants')
      .delete()
      .eq('underwriter_id', underwriterId)
      .eq('state', state)
      .eq('variant', variant)
    if (error) console.error('toggleUnderwriterVariant (disable) failed:', error)
  }
  revalidatePath('/', 'layout')
}

export async function listUnderwriterDefaultSplits(underwriterId: string): Promise<UnderwriterDefaultSplit[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('underwriter_default_splits')
    .select('*')
    .eq('underwriter_id', underwriterId)
    .order('state')
    .order('sort_order')
  return data ?? []
}

export async function createUnderwriterDefaultSplit(underwriterId: string, state: string, formData: FormData) {
  const supabase = await requirePermission()
  const { count } = await supabase
    .from('underwriter_default_splits')
    .select('*', { count: 'exact', head: true })
    .eq('underwriter_id', underwriterId)
    .eq('state', state)

  const { error } = await supabase.from('underwriter_default_splits').insert({
    underwriter_id: underwriterId,
    state,
    sort_order: (count ?? 0) + 1,
    split_to_label: (formData.get('split_to_label') as string) || null,
    basis: (formData.get('basis') as string) || null,
    percent: formData.get('percent') ? Number(formData.get('percent')) : null,
    bill_code: (formData.get('bill_code') as string) || null,
  })
  if (error) console.error('createUnderwriterDefaultSplit failed:', error)
  revalidatePath('/', 'layout')
}

export async function updateUnderwriterDefaultSplit(splitId: string, formData: FormData) {
  const supabase = await requirePermission()
  const { error } = await supabase
    .from('underwriter_default_splits')
    .update({
      split_to_label: (formData.get('split_to_label') as string) || null,
      basis: (formData.get('basis') as string) || null,
      percent: formData.get('percent') ? Number(formData.get('percent')) : null,
      bill_code: (formData.get('bill_code') as string) || null,
    })
    .eq('id', splitId)
  if (error) console.error('updateUnderwriterDefaultSplit failed:', error)
  revalidatePath('/', 'layout')
}

export async function deleteUnderwriterDefaultSplit(splitId: string) {
  const supabase = await requirePermission()
  const { error } = await supabase.from('underwriter_default_splits').delete().eq('id', splitId)
  if (error) console.error('deleteUnderwriterDefaultSplit failed:', error)
  revalidatePath('/', 'layout')
}

/**
 * Returns every underwriter's configured variants for one state, as a map keyed by
 * underwriter id -> variant list. Used by the Premiums page loader (Task 6) so the
 * client component never needs to know the order's state or do its own filtering —
 * it just looks up `variantsByUnderwriter[selectedUnderwriterId]`.
 */
export async function listUnderwriterVariantsForState(state: string | null): Promise<Record<string, string[]>> {
  if (!state) return {}
  const supabase = await createClient()
  const { data } = await supabase.from('underwriter_loan_policy_variants').select('underwriter_id, variant').eq('state', state)
  const map: Record<string, string[]> = {}
  for (const row of data ?? []) {
    if (!map[row.underwriter_id]) map[row.underwriter_id] = []
    map[row.underwriter_id].push(row.variant)
  }
  return map
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/underwriters.ts
git commit -m "feat: add underwriter admin actions"
```

---

### Task 4: Underwriters admin console UI

**Files:**
- Create: `src/app/admin/underwriters/page.tsx`
- Create: `src/components/AdminUnderwritersConsole.tsx`
- Modify: the admin nav (same file located in the Sch B plan's Task 6 Step 3 — add a matching "Underwriters" link)

**Interfaces:**
- Consumes: Task 3's actions.
- Produces: the `/admin/underwriters` screen. Terminal admin UI task.

- [ ] **Step 1: Write `src/app/admin/underwriters/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import { listUnderwriters } from '@/app/actions/underwriters'
import { AdminUnderwritersConsole } from '@/components/AdminUnderwritersConsole'

export default async function UnderwritersAdminPage() {
  const supabase = await createClient()
  if (!(await hasPermission(supabase, 'manage_underwriters'))) {
    redirect('/orders')
  }

  const underwriters = await listUnderwriters()

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Underwriters</h1>
      <AdminUnderwritersConsole underwriters={underwriters} />
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/AdminUnderwritersConsole.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { LOAN_POLICY_VARIANTS } from '@/lib/constants'
import {
  createUnderwriter,
  renameUnderwriter,
  deleteUnderwriter,
  listUnderwriterVariants,
  toggleUnderwriterVariant,
  listUnderwriterDefaultSplits,
  createUnderwriterDefaultSplit,
  updateUnderwriterDefaultSplit,
  deleteUnderwriterDefaultSplit,
} from '@/app/actions/underwriters'
import type { Underwriter, UnderwriterLoanPolicyVariant, UnderwriterDefaultSplit } from '@/lib/types'

function UnderwriterDetail({ underwriter }: { underwriter: Underwriter }) {
  const [state, setState] = useState('')
  const [variants, setVariants] = useState<UnderwriterLoanPolicyVariant[]>([])
  const [splits, setSplits] = useState<UnderwriterDefaultSplit[]>([])
  const [loaded, setLoaded] = useState(false)

  async function load() {
    const [v, s] = await Promise.all([listUnderwriterVariants(underwriter.id), listUnderwriterDefaultSplits(underwriter.id)])
    setVariants(v)
    setSplits(s)
    setLoaded(true)
  }

  if (!loaded) {
    load()
    return <p className="text-sm text-slate-500">Loading…</p>
  }

  const enabledForState = new Set(variants.filter((v) => v.state === state).map((v) => v.variant))
  const splitsForState = splits.filter((s) => s.state === state)

  return (
    <div className="space-y-3 rounded border p-3">
      <div>
        <label className="text-sm font-medium">State</label>
        <input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="e.g. NC" className="ml-2 w-20 rounded border px-2 py-1 text-sm" />
      </div>

      {state && (
        <>
          <div>
            <p className="mb-1 text-sm font-medium">Loan Policy Variants offered in {state}</p>
            {LOAN_POLICY_VARIANTS.map((variant) => (
              <label key={variant} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabledForState.has(variant)}
                  onChange={async (e) => {
                    await toggleUnderwriterVariant(underwriter.id, state, variant, e.target.checked)
                    setLoaded(false)
                  }}
                />
                {variant}
              </label>
            ))}
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Default Split — {state}</p>
            {splitsForState.map((s) => (
              <form
                key={s.id}
                action={async (formData: FormData) => {
                  await updateUnderwriterDefaultSplit(s.id, formData)
                  setLoaded(false)
                }}
                className="mb-2 grid grid-cols-5 gap-2"
              >
                <input name="split_to_label" defaultValue={s.split_to_label ?? ''} placeholder="Split To" className="rounded border px-2 py-1 text-sm" />
                <input name="basis" defaultValue={s.basis ?? ''} placeholder="Basis" className="rounded border px-2 py-1 text-sm" />
                <input name="percent" type="number" step="0.01" defaultValue={s.percent ?? ''} placeholder="%" className="rounded border px-2 py-1 text-sm" />
                <input name="bill_code" defaultValue={s.bill_code ?? ''} placeholder="Bill Code" className="rounded border px-2 py-1 text-sm" />
                <div className="flex gap-2">
                  <button type="submit" className="rounded border px-2 py-1 text-xs">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteUnderwriterDefaultSplit(s.id)
                      setLoaded(false)
                    }}
                    className="rounded border px-2 py-1 text-xs text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </form>
            ))}
            {splitsForState.length < 5 && (
              <form
                action={async (formData: FormData) => {
                  await createUnderwriterDefaultSplit(underwriter.id, state, formData)
                  setLoaded(false)
                }}
                className="grid grid-cols-5 gap-2"
              >
                <input name="split_to_label" placeholder="Split To" className="rounded border px-2 py-1 text-sm" />
                <input name="basis" placeholder="Basis" className="rounded border px-2 py-1 text-sm" />
                <input name="percent" type="number" step="0.01" placeholder="%" className="rounded border px-2 py-1 text-sm" />
                <input name="bill_code" placeholder="Bill Code" className="rounded border px-2 py-1 text-sm" />
                <button type="submit" className="rounded border px-2 py-1 text-xs">
                  + Add Split Row
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function AdminUnderwritersConsole({ underwriters }: { underwriters: Underwriter[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {underwriters.map((u) => (
        <div key={u.id} className="rounded border p-3">
          {editingId === u.id ? (
            <form
              action={async (formData: FormData) => {
                await renameUnderwriter(u.id, formData)
                setEditingId(null)
              }}
              className="flex gap-2"
            >
              <input name="name" defaultValue={u.name} className="rounded border px-2 py-1 text-sm" />
              <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
                Save
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setExpandedId(expandedId === u.id ? null : u.id)} className="font-medium hover:underline">
                {u.name}
              </button>
              <div className="flex gap-3 text-sm">
                <button type="button" onClick={() => setEditingId(u.id)} className="text-slate-600 hover:underline">
                  Rename
                </button>
                <form action={deleteUnderwriter.bind(null, u.id)}>
                  <button type="submit" className="text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </div>
          )}
          {expandedId === u.id && <div className="mt-3">{<UnderwriterDetail underwriter={u} />}</div>}
        </div>
      ))}

      <form action={createUnderwriter} className="flex gap-2 rounded border p-3">
        <input name="name" placeholder="New underwriter name" required className="flex-1 rounded border px-2 py-1 text-sm" />
        <button type="submit" className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white">
          Add Underwriter
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Add the nav link**

Add an "Underwriters" link to `/admin/underwriters` in the same admin nav file the Sch B plan's Task 6 already updated (or, if that plan hasn't executed yet, locate it via `grep -rn "folder-templates" src/components`).

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, sign in as a user with `manage_underwriters`, visit `/admin/underwriters`. Add an underwriter, expand it, enter state "NC", check 2 of the 5 variant boxes, add a default split row. Reload — expand again, enter "NC" — both the checkboxes and the split row should still be there.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/underwriters/page.tsx src/components/AdminUnderwritersConsole.tsx
git commit -m "feat: add Underwriters admin console"
```

---

### Task 5: Wire the new fields into `title-premiums.ts`

**Files:**
- Modify: `src/app/actions/title-premiums.ts:55-77` (`updatePremium`)
- Modify: `src/app/actions/title-premiums.ts` (add `addSimultaneousPolicyPair`)

**Interfaces:**
- Consumes: `TitleInsurancePremium` (Task 2, widened).
- Produces: `updatePremium` now persists `underwriter_id`/`loan_policy_variant`/`simultaneous_issue_premium`; new `addSimultaneousPolicyPair(orderId)`. Task 7's `PremiumsPanel.tsx` calls both.

- [ ] **Step 1: Extend `updatePremium`'s update payload**

In `src/app/actions/title-premiums.ts`, change the `.update({...})` call inside `updatePremium` (currently lines 60-67) from:

```ts
.update({
  policy_type: (formData.get('policy_type') as string) || null,
  underwriter_contact_id: (formData.get('underwriter_contact_id') as string) || null,
  coverage_amount: formData.get('coverage_amount') ? Number(formData.get('coverage_amount')) : null,
  base_premium: formData.get('base_premium') ? Number(formData.get('base_premium')) : null,
  final_premium: formData.get('final_premium') ? Number(formData.get('final_premium')) : null,
  bill_code: (formData.get('bill_code') as string) || null,
})
```

to:

```ts
.update({
  policy_type: (formData.get('policy_type') as string) || null,
  underwriter_contact_id: (formData.get('underwriter_contact_id') as string) || null,
  underwriter_id: (formData.get('underwriter_id') as string) || null,
  loan_policy_variant: (formData.get('loan_policy_variant') as string) || null,
  simultaneous_issue_premium: formData.get('simultaneous_issue_premium')
    ? Number(formData.get('simultaneous_issue_premium'))
    : null,
  coverage_amount: formData.get('coverage_amount') ? Number(formData.get('coverage_amount')) : null,
  base_premium: formData.get('base_premium') ? Number(formData.get('base_premium')) : null,
  final_premium: formData.get('final_premium') ? Number(formData.get('final_premium')) : null,
  bill_code: (formData.get('bill_code') as string) || null,
})
```

- [ ] **Step 2: Add `addSimultaneousPolicyPair`**

Add this function to `src/app/actions/title-premiums.ts`, near `addPremium`:

```ts
/**
 * Used only for the first "+Add Policy" click on a Simultaneous-Policy-Type order
 * with no existing premium rows — seeds one Owner's line and one Loan line together,
 * since a Simultaneous Issue transaction always involves both. Every subsequent
 * "+Add Policy" click (including on the same order, once this pair exists) still
 * goes through the plain single-row addPremium above.
 */
export async function addSimultaneousPolicyPair(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('title_insurance_premiums').insert([
    { order_id: orderId, sort_order: 1, policy_type: "Owner's" },
    { order_id: orderId, sort_order: 2, policy_type: 'Loan' },
  ])

  if (error) {
    console.error('addSimultaneousPolicyPair failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/title-premiums.ts
git commit -m "feat: persist underwriter/loan-policy-variant/SI-premium fields, add Simultaneous policy-pair seeding"
```

---

### Task 6: Load Policy Type, property state, and underwriter data on the Premiums page

**Files:**
- Modify: `src/app/orders/[id]/premiums/page.tsx`

**Interfaces:**
- Consumes: `listUnderwriters` (Task 3), `listUnderwriterVariantsForState` (Task 3).
- Produces: `orderPolicyType`, `underwriters`, `variantsByUnderwriter` props. Task 7's `PremiumsPanel` consumes these.

- [ ] **Step 1: Update the page loader**

In `src/app/orders/[id]/premiums/page.tsx`, change the `orders` select in the `Promise.all` (currently `supabase.from('orders').select('purchase_price, loan_amount').eq('id', orderId).single()`) to also select `policy_type`:

```ts
supabase.from('orders').select('purchase_price, loan_amount, policy_type').eq('id', orderId).single(),
```

Add a `property_details` load and the two new underwriter loads, then pass the new props:

```tsx
import { listUnderwriters, listUnderwriterVariantsForState } from '@/app/actions/underwriters'

// ... after the existing Promise.all destructure:
const { data: property } = await supabase.from('property_details').select('state').eq('order_id', orderId).maybeSingle()
const [underwriters, variantsByUnderwriter] = await Promise.all([
  listUnderwriters(),
  listUnderwriterVariantsForState(property?.state ?? null),
])
```

Pass `orderPolicyType={order?.policy_type ?? null}`, `underwriters={underwriters}`, `variantsByUnderwriter={variantsByUnderwriter}` to `<PremiumsPanel>` alongside the existing props.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: TypeScript errors on `PremiumsPanel`'s prop mismatch — expected, Task 7 adds those props.

- [ ] **Step 3: Commit**

```bash
git add src/app/orders/\[id\]/premiums/page.tsx
git commit -m "feat: load order policy type, property state, and underwriter data on the Premiums page"
```

---

### Task 7: Wire the UI — `PremiumsPanel.tsx`

**Files:**
- Modify: `src/components/title/PremiumsPanel.tsx`

**Interfaces:**
- Consumes: `LOAN_POLICY_VARIANTS` (Task 2), `addSimultaneousPolicyPair` (Task 5), the props added in Task 6.
- Produces: the fully wired screen. Terminal task before e2e coverage.

- [ ] **Step 1: Add new props through `PremiumsPanel` → `PremiumCard`**

Add `orderPolicyType: string | null`, `underwriters: Underwriter[]`, `variantsByUnderwriter: Record<string, string[]>` to `PremiumsPanel`'s prop type and pass them down to every `PremiumCard`. Add `import type { Underwriter } from '@/lib/types'` and `import { LOAN_POLICY_VARIANTS } from '@/lib/constants'` and `import { addSimultaneousPolicyPair } from '@/app/actions/title-premiums'` at the top of the file.

- [ ] **Step 2: Add the Underwriter (master), Loan Policy Variant, and SI Premium fields to `PremiumCard`**

Inside `PremiumCard`'s form (after the existing "Underwriter" `<select>` block, currently lines 261-277), add:

```tsx
<div>
  <Label htmlFor={`premium-${premium.id}-underwriter_id`}>Underwriter (Rate Profile)</Label>
  <select
    id={`premium-${premium.id}-underwriter_id`}
    name="underwriter_id"
    defaultValue={premium.underwriter_id ?? ''}
    onBlur={handleSave}
    className="block w-full rounded border px-2 py-1 text-sm"
  >
    <option value="">—</option>
    {underwriters.map((u) => (
      <option key={u.id} value={u.id}>
        {u.name}
      </option>
    ))}
  </select>
</div>
{premium.policy_type === 'Loan' && (
  <div>
    <Label htmlFor={`premium-${premium.id}-loan_policy_variant`}>Loan Policy Variant</Label>
    <select
      id={`premium-${premium.id}-loan_policy_variant`}
      name="loan_policy_variant"
      defaultValue={premium.loan_policy_variant ?? ''}
      onBlur={handleSave}
      className="block w-full rounded border px-2 py-1 text-sm"
    >
      <option value="">—</option>
      {(premium.underwriter_id && variantsByUnderwriter[premium.underwriter_id]?.length
        ? variantsByUnderwriter[premium.underwriter_id]
        : LOAN_POLICY_VARIANTS
      ).map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  </div>
)}
{orderPolicyType === 'Simultaneous' && premium.policy_type === 'Loan' && (
  <div>
    <Label htmlFor={`premium-${premium.id}-simultaneous_issue_premium`}>Simultaneous Issue Premium</Label>
    <CurrencyInput
      id={`premium-${premium.id}-simultaneous_issue_premium`}
      name="simultaneous_issue_premium"
      defaultValue={premium.simultaneous_issue_premium}
      onBlur={handleSave}
    />
  </div>
)}
```

Update `PremiumCard`'s prop type to accept `orderPolicyType: string | null`, `underwriters: Underwriter[]`, `variantsByUnderwriter: Record<string, string[]>`.

- [ ] **Step 3: Wire the Simultaneous "+Add Policy" seeding behavior**

In `PremiumsPanel`'s bottom "+ Add Policy" button (currently lines 438-449), change the `onClick` handler:

```tsx
<Button
  type="button"
  onClick={() =>
    startTransition(async () => {
      if (orderPolicyType === 'Simultaneous' && premiums.length === 0) {
        await addSimultaneousPolicyPair(orderId)
      } else {
        await addPremium(orderId)
      }
      refresh()
    })
  }
  disabled={isPending}
>
  {orderPolicyType === 'Simultaneous' && premiums.length === 0 ? "+ Add Owner's & Loan Policies" : '+ Add Policy'}
</Button>
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: clean build — Task 6's prop-mismatch errors are now resolved.

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`. On an order with Policy Type = Simultaneous and Property State = NC (with the "NC" underwriter/variants seeded from Task 4's manual check), open Premiums: the button reads "+ Add Owner's & Loan Policies"; clicking it creates one Owner's and one Loan line; the Loan line shows a Simultaneous Issue Premium field; picking the seeded Underwriter on that line narrows the Loan Policy Variant dropdown to the 2 checked variants. On a non-Simultaneous order, none of this appears and "+Add Policy" behaves exactly as before.

- [ ] **Step 6: Commit**

```bash
git add src/components/title/PremiumsPanel.tsx
git commit -m "feat: wire Simultaneous Issue policy-pair seeding and underwriter-restricted Loan Policy variants into the Premiums screen"
```

---

### Task 8: e2e regression test and full suite

**Files:**
- Modify or extend: `tests/e2e/title-premiums-endorsements.spec.ts`

**Interfaces:**
- Consumes: the full stack built in Tasks 1-7.

- [ ] **Step 1: Add regression coverage**

Add two tests to `tests/e2e/title-premiums-endorsements.spec.ts`, following that file's existing setup/navigation helpers rather than duplicating them:

```ts
test('Simultaneous order seeds an Owner\'s + Loan pair on first Add Policy click', async ({ page }) => {
  // Navigate to a test order whose Policy Type is Simultaneous and with no premiums yet
  // (reuse this file's existing order-setup helper).
  await page.getByRole('button', { name: "+ Add Owner's & Loan Policies" }).click()
  const rows = page.getByTestId('premium-list').locator('[data-testid^="premium-"]')
  await expect(rows).toHaveCount(2)
})

test('Loan Policy Variant options narrow to the linked underwriter\'s configured set', async ({ page }) => {
  // Navigate to a test order with a Loan-type premium line and a seeded test
  // underwriter (2 of 5 variants enabled for the order's property state).
  await page.getByLabel('Underwriter (Rate Profile)').selectOption({ label: 'Test Underwriter' })
  const variantOptions = await page.getByLabel('Loan Policy Variant').locator('option').allTextContents()
  expect(variantOptions.filter((v) => v !== '—')).toHaveLength(2)
})
```

- [ ] **Step 2: Run the extended spec**

Run: `npx playwright test title-premiums-endorsements.spec.ts`
Expected: all tests PASS, including the 2 new ones.

- [ ] **Step 3: Run the full e2e suite**

Run: `npx playwright test`
Expected: all tests PASS.

- [ ] **Step 4: Update the Fix Plan**

Add a completed entry to `M&L Title - Obsidian Vault/Genesis Screen Notes - Fix Plan.md` noting this item as built, referencing the spec and this plan file, matching the existing "Built" entry format.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/title-premiums-endorsements.spec.ts
git commit -m "test: add e2e coverage for Simultaneous Issue policy-pair seeding and underwriter-restricted Loan Policy variants"
```
