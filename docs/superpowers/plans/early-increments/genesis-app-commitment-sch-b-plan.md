# Genesis App — Commitment Schedule B-I/B-II Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Commitment Schedule B-I/B-II File Section — third of the Title nav group's 4 items — porting the proven chip-generation-from-Prelim-data and sub-item numbering model from the old prototype.

**Architecture:** Three new tables (`commitment_requirements`, `commitment_exceptions`, `commitment_sch_b_settings`), all keyed by `order_id` directly (not nested under Schedule A). One route (`/orders/[id]/commitment-sch-b`) with two sections: Requirements (chip bar sourced from Security Instruments/Related Documents/Liens, seed phrases, manual add, full edit, sub-item lettering) and Exceptions (same pattern, Exception Matter chip source, no sub-items). Requirement/exception text generation is server-computed from the source record at insert time — never trusts client-supplied text for chip-generated items.

**Tech Stack:** Same as prior increments — Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, `@supabase/ssr`, Playwright E2E extending `tests/e2e/order-entry.spec.ts`. Supabase project `hlahrypglnmjjxrdtfkm`.

**Spec:** `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Commitment Schedule B-I,B-II Design.md`

## Global Constraints

- All file operations happen in the T7 copy (`/Volumes/T7/Claude Code/Genesis Platform/`), never the Desktop backup.
- Repo: `/Volumes/T7/Claude Code/Genesis Platform/genesis-app/`, remote `origin` → `https://github.com/campennydarden-cpu/Genesis-App.git`, branch `main`, Vercel auto-deploys on push, live at `https://genesis-app-tau.vercel.app`.
- Model-cost discipline: haiku for mechanical/fully-specified tasks, sonnet for tasks requiring judgment (chip-generation logic, sub-item numbering, text-template generation, test design). No opus.
- **Migration numbering:** prior parked plans reserve `0003_prelim_search.sql` and `0004_commitment_sch_a.sql` (neither executed yet). This plan uses `0005_commitment_sch_b.sql`. Whichever of the three parked plans executes first applies its migration on top of the current `0001`/`0002` baseline; the others stay reserved for whenever they run, in nav order (Prelim Search → Sch A → Sch B).
- This screen reads from `prelim_search`, `security_instruments`, `security_instrument_related_docs`, and `liens` (all from the Prelim Title Search increment) — those tables must exist before this screen is functional. Apply migrations in nav order.
- Curative's disposition workflow (Finalize/Draft-lock, "Don't Show", CTC) is explicitly out of scope — the schema includes `disposition`/`disposition_notes`/`dont_show` columns for forward compatibility, but no UI reads or writes them this round.
- The generated Commitment document (including ALTA's copyrighted standard boilerplate) is out of scope. `REQUIREMENT_SEEDS`/`EXCEPTION_SEEDS` below are M&L's own operational shorthand phrases, not ALTA's form text, and are fine to port.
- Testing stays Playwright E2E only, extending the existing cumulative spec file.
- Dev server must be running (`npm run dev`, no `webServer` entry in `playwright.config.ts`) before `npm run test:e2e`.
- This plan document is the deliverable for this round — do not invoke `subagent-driven-development` or execute any task below; the user is stopping at planning this round.

## File Structure

```
genesis-app/
├── supabase/migrations/
│   └── 0005_commitment_sch_b.sql                            # NEW
├── src/
│   ├── lib/
│   │   ├── constants.ts                                      # MODIFY: + REQUIREMENT_SEEDS, EXCEPTION_SEEDS, STANDARD_BI_ITEM_COUNTS
│   │   ├── types.ts                                          # MODIFY: + CommitmentRequirement, CommitmentException, CommitmentSchBSettings
│   │   └── commitment-text.ts                                 # NEW: text-generation + numbering utilities
│   ├── app/
│   │   ├── actions/
│   │   │   └── commitment-sch-b.ts                           # NEW
│   │   └── orders/[id]/
│   │       └── commitment-sch-b/page.tsx                      # NEW
│   └── components/
│       ├── FileSectionsNav.tsx                               # MODIFY: Commitment Sch B-I/B-II gains segment
│       └── commitment-sch-b/
│           ├── RequirementsSection.tsx                        # NEW
│           └── ExceptionsSection.tsx                          # NEW
└── tests/e2e/order-entry.spec.ts                             # MODIFY
```

---

### Task 1: Schema — `commitment_requirements`, `commitment_exceptions`, `commitment_sch_b_settings`

**Suggested model:** haiku (fully-specified schema transcription)

**Files:**
- Create: `supabase/migrations/0005_commitment_sch_b.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0005_commitment_sch_b.sql
create table public.commitment_requirements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  description text not null,
  notes text,
  source_type text check (source_type in ('si', 'rel', 'lien')),
  source_id uuid,
  parent_requirement_id uuid references public.commitment_requirements(id) on delete cascade,
  disposition text,
  disposition_notes text,
  dont_show boolean not null default false,
  created_at timestamptz not null default now()
);

create index commitment_requirements_order_id_idx on public.commitment_requirements(order_id);

create table public.commitment_exceptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  description text not null,
  notes text,
  source_type text check (source_type in ('em')),
  source_id uuid,
  disposition text,
  disposition_notes text,
  dont_show boolean not null default false,
  created_at timestamptz not null default now()
);

create index commitment_exceptions_order_id_idx on public.commitment_exceptions(order_id);

create table public.commitment_sch_b_settings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  begin_requirements_at integer,
  begin_exceptions_at integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commitment_requirements enable row level security;
alter table public.commitment_exceptions enable row level security;
alter table public.commitment_sch_b_settings enable row level security;

create policy "Authenticated M&L staff can do anything with commitment_requirements"
  on public.commitment_requirements for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with commitment_exceptions"
  on public.commitment_exceptions for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with commitment_sch_b_settings"
  on public.commitment_sch_b_settings for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool against project `hlahrypglnmjjxrdtfkm`, with `name: "commitment_sch_b"` and the SQL above as `query`.

- [ ] **Step 3: Verify**

Use the Supabase MCP `list_tables` tool and confirm all 3 new tables appear with RLS enabled.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add supabase/migrations/0005_commitment_sch_b.sql
git commit -m "feat: add commitment_sch_b schema (Requirements, Exceptions, numbering settings)"
```

---

### Task 2: Constants and types

**Suggested model:** haiku (fully-specified value lists and type definitions)

**Files:**
- Modify: `src/lib/constants.ts` (append)
- Modify: `src/lib/types.ts` (append)

- [ ] **Step 1: Append the constants**

```ts
// append to src/lib/constants.ts

export const REQUIREMENT_SEEDS = [
  'Warranty Deed from current owner to Buyer, to be recorded',
  'Release of existing Deed of Trust, to be recorded',
  'Payoff of existing mortgage',
  'Payment of delinquent real estate taxes',
  'Satisfaction of judgment against Seller',
  'Affidavit of title from Seller',
] as const

export const EXCEPTION_SEEDS = [
  'Real estate taxes for the current year, not yet due and payable',
  'Easements, restrictions, and rights of way of record',
  'Restrictive covenants of record',
  'Rights of parties in possession, not shown of record',
  'Matters that would be disclosed by an accurate survey',
] as const

export const STANDARD_BI_ITEM_COUNTS: Record<string, number> = {
  Standard: 4,
  'Short Form': 5,
}
```

- [ ] **Step 2: Append the types**

```ts
// append to src/lib/types.ts

export type CommitmentRequirement = {
  id: string
  order_id: string
  description: string
  notes: string | null
  source_type: 'si' | 'rel' | 'lien' | null
  source_id: string | null
  parent_requirement_id: string | null
  disposition: string | null
  disposition_notes: string | null
  dont_show: boolean
}

export type CommitmentException = {
  id: string
  order_id: string
  description: string
  notes: string | null
  source_type: 'em' | null
  source_id: string | null
  disposition: string | null
  disposition_notes: string | null
  dont_show: boolean
}

export type CommitmentSchBSettings = {
  id: string
  order_id: string
  begin_requirements_at: number | null
  begin_exceptions_at: number
}
```

- [ ] **Step 3: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/types.ts
git commit -m "feat: add Commitment Schedule B constants and types"
```

---

### Task 3: Text-generation and numbering utilities

**Suggested model:** sonnet (judgment-heavy — porting conditional template logic and the numbering algorithm correctly)

**Files:**
- Create: `src/lib/commitment-text.ts`

**Interfaces:**
- Consumes: `SecurityInstrument`, `SecurityInstrumentRelatedDoc`, `Lien`, `ExceptionMatter` (from Prelim Title Search's types, already in `src/lib/types.ts`), `CommitmentRequirement` (Task 2).
- Produces: `siRequirementText(si)`, `relRequirementText(rel, si)`, `lienRequirementText(lien)`, `emExceptionText(em)` — each returns a generated `string`. `computeReqLabels(requirements, startAt)` — returns `string[]` (one label per requirement, in the same order). Consumed by Task 4's server actions and Task 5's component.

- [ ] **Step 1: Create the file**

```ts
// src/lib/commitment-text.ts
import type { SecurityInstrument, SecurityInstrumentRelatedDoc, Lien, ExceptionMatter, CommitmentRequirement } from '@/lib/types'

export function siRequirementText(si: SecurityInstrument): string {
  const instr = si.type || 'Security Instrument'
  const partyClause = si.trustee
    ? `executed by ${si.mortgagor || '[Mortgagor]'} to ${si.trustee}, Trustee, for the benefit of ${si.mortgagee || '[Mortgagee]'}`
    : `executed by ${si.mortgagor || '[Mortgagor]'} to ${si.mortgagee || '[Mortgagee]'}`
  const parts: string[] = [partyClause]
  if (si.dated_date) parts.push(`dated ${si.dated_date}`)
  const recParts: string[] = []
  if (si.recorded_date) recParts.push(`recorded ${si.recorded_date}`)
  const locBits: string[] = []
  if (si.book || si.page) locBits.push(`in Book ${si.book || '—'}, Page ${si.page || '—'}`)
  if (si.instrument_number) locBits.push(`Instrument No. ${si.instrument_number}`)
  if (locBits.length) recParts.push(locBits.join(', '))
  if (recParts.length) parts.push(recParts.join(' '))
  if (si.original_amount) parts.push(`securing an original amount of ${si.original_amount}`)
  return `Release of ${instr} ${parts.join(', ')}, to be released of record prior to closing.`
}

export function relRequirementText(rel: SecurityInstrumentRelatedDoc, si: SecurityInstrument): string {
  const docType = rel.type || 'Related Document'
  const parts: string[] = []
  if (rel.assignor || rel.assignee) parts.push(`from ${rel.assignor || '[Assignor]'} to ${rel.assignee || '[Assignee]'}`)
  if (rel.dated_date) parts.push(`dated ${rel.dated_date}`)
  const recParts: string[] = []
  if (rel.recorded_date) recParts.push(`recorded ${rel.recorded_date}`)
  const locBits: string[] = []
  if (rel.book || rel.page) locBits.push(`in Book ${rel.book || '—'}, Page ${rel.page || '—'}`)
  if (rel.instrument_number) locBits.push(`Instrument No. ${rel.instrument_number}`)
  if (locBits.length) recParts.push(locBits.join(', '))
  if (recParts.length) parts.push(recParts.join(' '))
  let affecting = `affecting the ${si.type || 'Security Instrument'}`
  const siLocBits: string[] = []
  if (si.book || si.page) siLocBits.push(`Book ${si.book || '—'}, Page ${si.page || '—'}`)
  if (si.instrument_number) siLocBits.push(`Instrument No. ${si.instrument_number}`)
  if (siLocBits.length) affecting += ` recorded as ${siLocBits.join(', ')}`
  parts.push(affecting)
  return `Release of ${docType} ${parts.join(', ')}, to be released of record prior to closing.`
}

export function lienRequirementText(lien: Lien): string {
  if (lien.type === 'Lis Pendens') {
    const parts: string[] = []
    if (lien.plaintiff || lien.defendant) parts.push(`filed by ${lien.plaintiff || '[Plaintiff]'} against ${lien.defendant || '[Defendant]'}`)
    if (lien.case_number) parts.push(`Case No. ${lien.case_number}`)
    if (lien.court) parts.push(`in ${lien.court}`)
    return `Dismissal of Lis Pendens ${parts.join(', ')}, to be released of record prior to closing.`
  }
  const favorOf =
    lien.type === 'Tax Lien'
      ? lien.taxing_authority || '[Taxing Authority]'
      : lien.type === 'HOA/COA Lien'
        ? lien.hoa_company || '[HOA/COA]'
        : lien.type === 'Mechanics Lien'
          ? lien.materialman || '[Materialman]'
          : lien.creditor || '[Creditor]'
  const parts: string[] = [`against ${lien.debtor || '[Debtor]'} in favor of ${favorOf}`]
  if (lien.tax_type) parts.push(`${lien.tax_type} tax`)
  if (lien.case_number) parts.push(`Case No. ${lien.case_number}`)
  if (lien.certificate_id) parts.push(`Certificate No. ${lien.certificate_id}`)
  const datedDate = lien.dated_date || lien.docket_date
  if (datedDate) parts.push(`dated ${datedDate}`)
  const filedParts: string[] = []
  const filed = lien.filed_date || lien.recorded_date
  if (filed) filedParts.push(`filed ${filed}`)
  if (lien.court) filedParts.push(`in ${lien.court}`)
  if (filedParts.length) parts.push(filedParts.join(' '))
  const recParts: string[] = []
  if (lien.book || lien.page) recParts.push(`Book ${lien.book || '—'}, Page ${lien.page || '—'}`)
  if (lien.instrument_number) recParts.push(`Instrument No. ${lien.instrument_number}`)
  if (recParts.length) parts.push(recParts.join(', '))
  if (lien.amount) parts.push(`in the amount of ${lien.amount}`)
  if (lien.type === 'Tax Sale Certificate' && lien.redemption_expiration) {
    parts.push(`redemption period expiring ${lien.redemption_expiration}`)
  }
  return `Satisfaction of ${lien.type} ${parts.join(', ')}, to be released of record prior to closing.`
}

export function emExceptionText(em: ExceptionMatter): string {
  const parts: string[] = [em.description || '(matter of record)']
  const recParts: string[] = []
  if (em.recorded_date) recParts.push(`recorded ${em.recorded_date}`)
  else if (em.dated_date) recParts.push(`dated ${em.dated_date}`)
  const locBits: string[] = []
  if (em.book || em.page) locBits.push(`in Book ${em.book || '—'}, Page ${em.page || '—'}`)
  if (em.instrument_number) locBits.push(`Instrument No. ${em.instrument_number}`)
  if (locBits.length) recParts.push(locBits.join(', '))
  if (recParts.length) parts.push(recParts.join(' '))
  return parts.join(', ') + '.'
}

export function computeReqLabels(requirements: CommitmentRequirement[], startAt: number): string[] {
  const ids = new Set(requirements.map((r) => r.id))
  let mainNum = startAt || 0
  let childNum = 0
  return requirements.map((r) => {
    const hasParent = r.parent_requirement_id && ids.has(r.parent_requirement_id)
    if (!hasParent) {
      mainNum++
      childNum = 0
      return String(mainNum)
    }
    childNum++
    return String(mainNum) + String.fromCharCode(96 + childNum)
  })
}
```

Note: `computeReqLabels` relies on child requirements being contiguous with their parent in the `requirements` array's order — same invariant as the prototype. Task 4's `addRequirementFromChip` must insert (not just create) each sub-item so that querying requirements ordered by `created_at` keeps children adjacent to their parent — this holds naturally as long as a parent's own requirement is always added before any of its sub-items (enforced by the chip UI itself: a Related Document's chip only appears once its parent SI's requirement already exists).

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/commitment-text.ts
git commit -m "feat: add Commitment Sch B text-generation and numbering utilities"
```

---

### Task 4: Server Actions

**Suggested model:** sonnet (chip actions re-fetch and server-compute generated text — cross-table logic, not pure CRUD)

**Files:**
- Create: `src/app/actions/commitment-sch-b.ts`

**Interfaces:**
- Consumes: `siRequirementText`/`relRequirementText`/`lienRequirementText`/`emExceptionText` (Task 3).
- Produces: `addRequirementFromChip(orderId, sourceType, sourceId, parentRequirementId, formData)`, `addRequirementManual(orderId, formData)`, `updateRequirement(orderId, requirementId, formData)`, `deleteRequirement(orderId, requirementId)`, `addExceptionFromChip(orderId, sourceId, formData)`, `addExceptionManual(orderId, formData)`, `updateException(orderId, exceptionId, formData)`, `deleteException(orderId, exceptionId)`, `upsertSchBSettings(orderId, formData)`. Consumed by Tasks 5-6 via `.bind()`.

- [ ] **Step 1: Create the actions file**

```ts
// src/app/actions/commitment-sch-b.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { siRequirementText, relRequirementText, lienRequirementText, emExceptionText } from '@/lib/commitment-text'

function fail(orderId: string, message: string): never {
  redirect(`/orders/${orderId}/commitment-sch-b?error=${encodeURIComponent(message)}`)
}

export async function addRequirementFromChip(
  orderId: string,
  sourceType: 'si' | 'rel' | 'lien',
  sourceId: string,
  parentRequirementId: string | null,
  formData: FormData
) {
  void formData
  const supabase = await createClient()
  let description = ''

  if (sourceType === 'si') {
    const { data: si } = await supabase.from('security_instruments').select('*').eq('id', sourceId).single()
    if (si) description = siRequirementText(si)
  } else if (sourceType === 'rel') {
    const { data: rel } = await supabase.from('security_instrument_related_docs').select('*').eq('id', sourceId).single()
    if (rel) {
      const { data: si } = await supabase.from('security_instruments').select('*').eq('id', rel.security_instrument_id).single()
      if (si) description = relRequirementText(rel, si)
    }
  } else if (sourceType === 'lien') {
    const { data: lien } = await supabase.from('liens').select('*').eq('id', sourceId).single()
    if (lien) description = lienRequirementText(lien)
  }

  if (!description) fail(orderId, 'Could not generate requirement text from that source.')

  const { error } = await supabase.from('commitment_requirements').insert({
    order_id: orderId,
    description,
    source_type: sourceType,
    source_id: sourceId,
    parent_requirement_id: parentRequirementId,
  })

  if (error) {
    console.error('addRequirementFromChip failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function addRequirementManual(orderId: string, formData: FormData) {
  const supabase = await createClient()
  const description = formData.get('description') as string
  const notes = (formData.get('notes') as string) || null

  const { error } = await supabase.from('commitment_requirements').insert({
    order_id: orderId,
    description,
    notes,
    source_type: null,
    source_id: null,
    parent_requirement_id: null,
  })

  if (error) {
    console.error('addRequirementManual failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function updateRequirement(orderId: string, requirementId: string, formData: FormData) {
  const supabase = await createClient()
  const description = formData.get('description') as string
  const notes = (formData.get('notes') as string) || null

  const { error } = await supabase.from('commitment_requirements').update({ description, notes }).eq('id', requirementId)

  if (error) {
    console.error('updateRequirement failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function deleteRequirement(orderId: string, requirementId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('commitment_requirements').delete().eq('id', requirementId)

  if (error) {
    console.error('deleteRequirement failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function addExceptionFromChip(orderId: string, sourceId: string, formData: FormData) {
  void formData
  const supabase = await createClient()
  const { data: em } = await supabase.from('exception_matters').select('*').eq('id', sourceId).single()

  if (!em) fail(orderId, 'Could not generate exception text from that source.')

  const description = emExceptionText(em)
  const { error } = await supabase.from('commitment_exceptions').insert({
    order_id: orderId,
    description,
    source_type: 'em',
    source_id: sourceId,
  })

  if (error) {
    console.error('addExceptionFromChip failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function addExceptionManual(orderId: string, formData: FormData) {
  const supabase = await createClient()
  const description = formData.get('description') as string
  const notes = (formData.get('notes') as string) || null

  const { error } = await supabase.from('commitment_exceptions').insert({
    order_id: orderId,
    description,
    notes,
    source_type: null,
    source_id: null,
  })

  if (error) {
    console.error('addExceptionManual failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function updateException(orderId: string, exceptionId: string, formData: FormData) {
  const supabase = await createClient()
  const description = formData.get('description') as string
  const notes = (formData.get('notes') as string) || null

  const { error } = await supabase.from('commitment_exceptions').update({ description, notes }).eq('id', exceptionId)

  if (error) {
    console.error('updateException failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function deleteException(orderId: string, exceptionId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('commitment_exceptions').delete().eq('id', exceptionId)

  if (error) {
    console.error('deleteException failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function upsertSchBSettings(orderId: string, formData: FormData) {
  const supabase = await createClient()
  const beginReq = formData.get('begin_requirements_at') as string
  const beginExc = formData.get('begin_exceptions_at') as string

  const { error } = await supabase.from('commitment_sch_b_settings').upsert(
    {
      order_id: orderId,
      begin_requirements_at: beginReq ? Number(beginReq) : null,
      begin_exceptions_at: beginExc ? Number(beginExc) : 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  )

  if (error) {
    console.error('upsertSchBSettings failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
  redirect(`/orders/${orderId}/commitment-sch-b`)
}
```

Note: `addRequirementFromChip` and `addExceptionFromChip` take a `formData` parameter only because they're bound to a `<form action={...}>` (Next.js server actions used as a form's `action` must accept the FormData as their final parameter) — they don't read anything from it, hence `void formData`.

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/commitment-sch-b.ts
git commit -m "feat: add Commitment Schedule B server actions"
```

---

### Task 5: RequirementsSection (chip bar, seed phrases, manual add, full edit, sub-item numbering)

**Suggested model:** sonnet (chip-source computation, parent/child lookup, numbering display)

**Files:**
- Create: `src/components/commitment-sch-b/RequirementsSection.tsx`

**Interfaces:**
- Consumes: `addRequirementFromChip`/`addRequirementManual`/`updateRequirement`/`deleteRequirement` (Task 4), `computeReqLabels` (Task 3), `REQUIREMENT_SEEDS` (Task 2), `CommitmentRequirement` (Task 2), `SecurityInstrument`/`SecurityInstrumentRelatedDoc`/`Lien` (Prelim Search types).
- Produces: `RequirementsSection({ orderId, requirements, securityInstruments, relatedDocs, liens, beginAt })` — Client Component.

- [ ] **Step 1: Create the component**

```tsx
// src/components/commitment-sch-b/RequirementsSection.tsx
'use client'

import { useState } from 'react'
import { REQUIREMENT_SEEDS } from '@/lib/constants'
import { computeReqLabels } from '@/lib/commitment-text'
import { addRequirementFromChip, addRequirementManual, updateRequirement, deleteRequirement } from '@/app/actions/commitment-sch-b'
import type { CommitmentRequirement, SecurityInstrument, SecurityInstrumentRelatedDoc, Lien } from '@/lib/types'

export function RequirementsSection({
  orderId,
  requirements,
  securityInstruments,
  relatedDocs,
  liens,
  beginAt,
}: {
  orderId: string
  requirements: CommitmentRequirement[]
  securityInstruments: SecurityInstrument[]
  relatedDocs: SecurityInstrumentRelatedDoc[]
  liens: Lien[]
  beginAt: number
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const usedSources = new Set(
    requirements.filter((r) => r.source_type).map((r) => `${r.source_type}:${r.source_id}`)
  )

  const siChips = securityInstruments.filter((si) => !usedSources.has(`si:${si.id}`))

  const relChips: { rel: SecurityInstrumentRelatedDoc; si: SecurityInstrument; parentReqId: string }[] = []
  securityInstruments.forEach((si) => {
    const parentReq = requirements.find((r) => r.source_type === 'si' && r.source_id === si.id)
    if (!parentReq) return
    relatedDocs
      .filter((rd) => rd.security_instrument_id === si.id && !usedSources.has(`rel:${rd.id}`))
      .forEach((rd) => relChips.push({ rel: rd, si, parentReqId: parentReq.id }))
  })

  const lienChips = liens.filter((l) => !usedSources.has(`lien:${l.id}`))

  const labels = computeReqLabels(requirements, beginAt)

  return (
    <div className="rounded border p-4">
      <p className="mb-4 text-lg font-semibold">Requirements</p>

      {(siChips.length > 0 || relChips.length > 0 || lienChips.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2" data-testid="requirement-chips">
          {siChips.map((si) => (
            <form key={si.id} action={addRequirementFromChip.bind(null, orderId, 'si', si.id, null)}>
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100" data-testid="si-req-chip">
                + {si.type || 'Security Instrument'}: {si.mortgagor || '?'} → {si.mortgagee || '?'}
              </button>
            </form>
          ))}
          {relChips.map(({ rel, parentReqId }) => (
            <form key={rel.id} action={addRequirementFromChip.bind(null, orderId, 'rel', rel.id, parentReqId)}>
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100" data-testid="rel-req-chip">
                + {rel.type || 'Related Document'} (sub-item)
              </button>
            </form>
          ))}
          {lienChips.map((l) => (
            <form key={l.id} action={addRequirementFromChip.bind(null, orderId, 'lien', l.id, null)}>
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100" data-testid="lien-req-chip">
                + {l.type}: {l.creditor || l.debtor || '(no description)'}
              </button>
            </form>
          ))}
        </div>
      )}

      <ul className="mb-4 space-y-2" data-testid="requirement-list">
        {requirements.map((r, idx) =>
          editingId === r.id ? (
            <li key={r.id} className="rounded border p-4" data-testid="requirement-row">
              <form
                action={async (formData: FormData) => {
                  await updateRequirement(orderId, r.id, formData)
                  setEditingId(null)
                }}
                className="space-y-2"
              >
                <textarea name="description" defaultValue={r.description} rows={2} className="w-full rounded border px-3 py-2" />
                <input name="notes" defaultValue={r.notes ?? undefined} placeholder="Notes" className="w-full rounded border px-3 py-2" />
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
            <li
              key={r.id}
              className={`flex items-center justify-between rounded border p-3 ${r.parent_requirement_id ? 'ml-6' : ''}`}
              data-testid="requirement-row"
            >
              <div>
                <p>
                  {labels[idx]}. {r.description}
                </p>
                {r.notes && <p className="text-sm text-slate-500">{r.notes}</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingId(r.id)} className="text-sm text-slate-600 hover:underline">
                  Edit
                </button>
                <form action={deleteRequirement.bind(null, orderId, r.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {requirements.length === 0 && <p className="text-sm text-slate-500">No requirements added yet.</p>}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add a requirement</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {REQUIREMENT_SEEDS.map((s) => (
            <form key={s} action={addRequirementManual.bind(null, orderId)}>
              <input type="hidden" name="description" value={s} />
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">
                + {s}
              </button>
            </form>
          ))}
        </div>
        <form action={addRequirementManual.bind(null, orderId)} className="mt-4 space-y-3">
          <div>
            <label htmlFor="req-add-description" className="block text-sm font-medium">
              Description
            </label>
            <textarea id="req-add-description" name="description" rows={2} required className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="req-add-notes" className="block text-sm font-medium">
              Notes
            </label>
            <input id="req-add-notes" name="notes" className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
            Add Requirement
          </button>
        </form>
      </details>
    </div>
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
git add src/components/commitment-sch-b/RequirementsSection.tsx
git commit -m "feat: add RequirementsSection component"
```

---

### Task 6: ExceptionsSection

**Suggested model:** sonnet (chip-source computation, though simpler than Requirements — no sub-items)

**Files:**
- Create: `src/components/commitment-sch-b/ExceptionsSection.tsx`

**Interfaces:**
- Consumes: `addExceptionFromChip`/`addExceptionManual`/`updateException`/`deleteException` (Task 4), `EXCEPTION_SEEDS` (Task 2), `CommitmentException` (Task 2), `ExceptionMatter` (Prelim Search types).
- Produces: `ExceptionsSection({ orderId, exceptions, exceptionMatters, beginAt })` — Client Component.

- [ ] **Step 1: Create the component**

```tsx
// src/components/commitment-sch-b/ExceptionsSection.tsx
'use client'

import { useState } from 'react'
import { EXCEPTION_SEEDS } from '@/lib/constants'
import { addExceptionFromChip, addExceptionManual, updateException, deleteException } from '@/app/actions/commitment-sch-b'
import type { CommitmentException, ExceptionMatter } from '@/lib/types'

export function ExceptionsSection({
  orderId,
  exceptions,
  exceptionMatters,
  beginAt,
}: {
  orderId: string
  exceptions: CommitmentException[]
  exceptionMatters: ExceptionMatter[]
  beginAt: number
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const usedSources = new Set(exceptions.filter((e) => e.source_type).map((e) => `${e.source_type}:${e.source_id}`))
  const emChips = exceptionMatters.filter((em) => !usedSources.has(`em:${em.id}`))

  return (
    <div className="mt-6 rounded border p-4">
      <p className="mb-4 text-lg font-semibold">Exceptions</p>

      {emChips.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2" data-testid="exception-chips">
          {emChips.map((em) => (
            <form key={em.id} action={addExceptionFromChip.bind(null, orderId, em.id)}>
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100" data-testid="em-exc-chip">
                + {em.description || '(no description)'}
              </button>
            </form>
          ))}
        </div>
      )}

      <ul className="mb-4 space-y-2" data-testid="exception-list">
        {exceptions.map((e, idx) =>
          editingId === e.id ? (
            <li key={e.id} className="rounded border p-4" data-testid="exception-row">
              <form
                action={async (formData: FormData) => {
                  await updateException(orderId, e.id, formData)
                  setEditingId(null)
                }}
                className="space-y-2"
              >
                <textarea name="description" defaultValue={e.description} rows={2} className="w-full rounded border px-3 py-2" />
                <input name="notes" defaultValue={e.notes ?? undefined} placeholder="Notes" className="w-full rounded border px-3 py-2" />
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
            <li key={e.id} className="flex items-center justify-between rounded border p-3" data-testid="exception-row">
              <div>
                <p>
                  {beginAt + idx}. {e.description}
                </p>
                {e.notes && <p className="text-sm text-slate-500">{e.notes}</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingId(e.id)} className="text-sm text-slate-600 hover:underline">
                  Edit
                </button>
                <form action={deleteException.bind(null, orderId, e.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {exceptions.length === 0 && <p className="text-sm text-slate-500">No exceptions added yet.</p>}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add an exception</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXCEPTION_SEEDS.map((s) => (
            <form key={s} action={addExceptionManual.bind(null, orderId)}>
              <input type="hidden" name="description" value={s} />
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">
                + {s}
              </button>
            </form>
          ))}
        </div>
        <form action={addExceptionManual.bind(null, orderId)} className="mt-4 space-y-3">
          <div>
            <label htmlFor="exc-add-description" className="block text-sm font-medium">
              Description
            </label>
            <textarea id="exc-add-description" name="description" rows={2} required className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="exc-add-notes" className="block text-sm font-medium">
              Notes
            </label>
            <input id="exc-add-notes" name="notes" className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
            Add Exception
          </button>
        </form>
      </details>
    </div>
  )
}
```

Note: Exceptions have no sub-items, so their numbering is plain sequential (`beginAt + idx`), unlike Requirements which need `computeReqLabels`' parent/child logic.

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/commitment-sch-b/ExceptionsSection.tsx
git commit -m "feat: add ExceptionsSection component"
```

---

### Task 7: Route page and nav wiring

**Suggested model:** sonnet (orchestrates fetching across 6 tables and computing the numbering offset)

**Files:**
- Create: `src/app/orders/[id]/commitment-sch-b/page.tsx`
- Modify: `src/components/FileSectionsNav.tsx` (Commitment Sch B-I/B-II item gains `segment: 'commitment-sch-b'`)

- [ ] **Step 1: Wire the nav item**

In `src/components/FileSectionsNav.tsx`, change:

```tsx
{ label: 'Commitment Sch B-I/B-II' },
```

to:

```tsx
{ label: 'Commitment Sch B-I/B-II', segment: 'commitment-sch-b' },
```

- [ ] **Step 2: Create the route page**

```tsx
// src/app/orders/[id]/commitment-sch-b/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { STANDARD_BI_ITEM_COUNTS } from '@/lib/constants'
import { RequirementsSection } from '@/components/commitment-sch-b/RequirementsSection'
import { ExceptionsSection } from '@/components/commitment-sch-b/ExceptionsSection'

export default async function CommitmentScheduleBPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id').eq('id', id).single()
  if (!order) {
    notFound()
  }

  const { data: schA } = await supabase.from('commitment_sch_a').select('form_type').eq('order_id', id).maybeSingle()
  const formType = schA?.form_type ?? 'Standard'
  const standardCount = STANDARD_BI_ITEM_COUNTS[formType] ?? STANDARD_BI_ITEM_COUNTS.Standard

  const { data: prelim } = await supabase.from('prelim_search').select('id').eq('order_id', id).maybeSingle()
  const prelimId = prelim?.id ?? null

  const { data: securityInstruments } = prelimId
    ? await supabase.from('security_instruments').select('*').eq('prelim_search_id', prelimId).order('created_at')
    : { data: [] }
  const siIds = (securityInstruments ?? []).map((si) => si.id)
  const { data: relatedDocs } = siIds.length
    ? await supabase.from('security_instrument_related_docs').select('*').in('security_instrument_id', siIds).order('created_at')
    : { data: [] }
  const { data: liens } = prelimId
    ? await supabase.from('liens').select('*').eq('prelim_search_id', prelimId).order('created_at')
    : { data: [] }
  const { data: exceptionMatters } = prelimId
    ? await supabase.from('exception_matters').select('*').eq('prelim_search_id', prelimId).order('created_at')
    : { data: [] }

  const { data: requirements } = await supabase.from('commitment_requirements').select('*').eq('order_id', id).order('created_at')
  const { data: exceptions } = await supabase.from('commitment_exceptions').select('*').eq('order_id', id).order('created_at')
  const { data: settings } = await supabase.from('commitment_sch_b_settings').select('*').eq('order_id', id).maybeSingle()

  const beginRequirementsAt = settings?.begin_requirements_at ?? standardCount
  const beginExceptionsAt = settings?.begin_exceptions_at ?? 1

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <RequirementsSection
        orderId={id}
        requirements={requirements ?? []}
        securityInstruments={securityInstruments ?? []}
        relatedDocs={relatedDocs ?? []}
        liens={liens ?? []}
        beginAt={beginRequirementsAt}
      />
      <ExceptionsSection
        orderId={id}
        exceptions={exceptions ?? []}
        exceptionMatters={exceptionMatters ?? []}
        beginAt={beginExceptionsAt}
      />
    </div>
  )
}
```

Note: this page reads from `prelim_search`, `security_instruments`, `security_instrument_related_docs`, `liens`, `exception_matters` (Prelim Title Search increment) and `commitment_sch_a` (Schedule A increment). Both must be executed before this task runs for real, or the queries against those tables will error.

- [ ] **Step 3: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/FileSectionsNav.tsx "src/app/orders/[id]/commitment-sch-b/page.tsx"
git commit -m "feat: wire Commitment Schedule B route and nav"
```

---

### Task 8: E2E test suite extension

**Suggested model:** sonnet (test design needs judgment about chip-visibility ordering and sub-item numbering)

**Files:**
- Modify: `tests/e2e/order-entry.spec.ts`

- [ ] **Step 1: Add the test**

Append to `tests/e2e/order-entry.spec.ts`. This test builds a Prelim Search with a Security Instrument (plus one Related Document), a Lien, and an Exception Matter first, since Schedule B's chips are sourced from that data:

```ts
  test('commitment schedule B: chip generation, sub-item numbering, manual add', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')

    await page.getByRole('button', { name: 'Add a Security Instrument' }).click()
    const siForm = page.locator('details:has-text("Add a Security Instrument")')
    await siForm.getByLabel('Type').selectOption('Deed of Trust')
    await siForm.getByLabel('Mortgagor').fill('Test Owner')
    await siForm.getByLabel('Mortgagee').fill('Test Lender')
    await siForm.getByRole('button', { name: 'Add Security Instrument' }).click()
    await expect(page.getByTestId('si-row')).toContainText('Deed of Trust')

    const siRow = page.getByTestId('si-row').first()
    await siRow.getByText('Add a related document').click()
    const relatedForm = siRow.locator('details:has-text("Add a related document")')
    await relatedForm.getByLabel('Type').selectOption('Assignment')
    await relatedForm.getByLabel('Assignor').fill('Test Lender')
    await relatedForm.getByLabel('Assignee').fill('Assignee Bank')
    await relatedForm.getByRole('button', { name: 'Add' }).click()
    await expect(siRow.getByTestId('related-doc-row')).toContainText('Assignment')

    await page.getByRole('button', { name: 'Add a lien' }).click()
    const lienForm = page.locator('details:has-text("Add a lien")')
    await lienForm.getByLabel('Type').selectOption('Judgment')
    await lienForm.getByLabel('Debtor').fill('Test Debtor')
    await lienForm.getByLabel('Creditor').fill('Test Creditor')
    await lienForm.getByRole('button', { name: 'Add Lien' }).click()
    await expect(page.getByTestId('lien-row')).toContainText('Test Creditor v. Test Debtor')

    await page.getByText('Add an Exception Matter').click()
    const emForm = page.locator('details:has-text("Add an Exception Matter")')
    await emForm.getByLabel('Description').fill('Utility easement of record')
    await emForm.getByRole('button', { name: 'Add Exception Matter' }).click()
    await expect(page.getByTestId('exception-matter-row')).toContainText('Utility easement of record')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch B-I/B-II' }).click()
    await page.waitForURL('**/commitment-sch-b')

    // Chips exist for the SI and Lien, but the Related Document sub-item chip is absent until the SI chip is used
    await expect(page.getByTestId('si-req-chip')).toBeVisible()
    await expect(page.getByTestId('lien-req-chip')).toBeVisible()
    await expect(page.getByTestId('rel-req-chip')).not.toBeVisible()
    await expect(page.getByTestId('em-exc-chip')).toBeVisible()

    await page.getByTestId('si-req-chip').click()
    await expect(page.getByTestId('requirement-row')).toContainText('Release of Deed of Trust')
    await expect(page.getByTestId('requirement-row')).toContainText('1.')

    // Now the Related Document's sub-item chip appears
    await expect(page.getByTestId('rel-req-chip')).toBeVisible()
    await page.getByTestId('rel-req-chip').click()
    await expect(page.getByTestId('requirement-list').getByTestId('requirement-row').nth(1)).toContainText('1a.')

    await page.getByTestId('lien-req-chip').click()
    await expect(page.getByTestId('requirement-list').getByTestId('requirement-row').nth(2)).toContainText('2.')

    await page.getByTestId('em-exc-chip').click()
    await expect(page.getByTestId('exception-row')).toContainText('Utility easement of record')
    await expect(page.getByTestId('exception-row')).toContainText('1.')

    // Manual add
    await page.getByText('Add a requirement').click()
    const reqForm = page.locator('details:has-text("Add a requirement")')
    await reqForm.getByLabel('Description').fill('Manual test requirement')
    await reqForm.getByRole('button', { name: 'Add Requirement' }).click()
    await expect(page.getByTestId('requirement-list').getByTestId('requirement-row').nth(3)).toContainText('3.')
    await expect(page.getByTestId('requirement-list').getByTestId('requirement-row').nth(3)).toContainText('Manual test requirement')

    // Edit a requirement
    await page.getByTestId('requirement-row').filter({ hasText: 'Manual test requirement' }).getByRole('button', { name: 'Edit' }).click()
    await page.locator('li:has-text("Manual test requirement")').locator('textarea[name="description"]').fill('Edited test requirement')
    await page.locator('li:has-text("Edited test requirement")').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('requirement-list')).toContainText('Edited test requirement')

    // Reload and confirm persistence
    await page.reload()
    await expect(page.getByTestId('requirement-list').getByTestId('requirement-row')).toHaveCount(4)
    await expect(page.getByTestId('exception-list').getByTestId('exception-row')).toHaveCount(1)
  })
```

- [ ] **Step 2: Run the full suite and verify**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run dev -- -p 3100 > /tmp/genesis-sch-b-task8-dev.log 2>&1 &
sleep 4
PLAYWRIGHT_BASE_URL="http://localhost:3100" npm run test:e2e
```

Expected: all tests pass (count = existing suite size + 1). Kill the dev server before finishing.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/order-entry.spec.ts
git commit -m "test: add Commitment Schedule B E2E coverage"
```

---

### Task 9: Final verification, deploy check, and vault sync

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

In `M&L Title/M&L Title - Obsidian Vault/Genesis Build Log.md`, add a change-log entry: Commitment Schedule B-I/B-II shipped (chip-generation from Security Instruments/Related Documents/Liens/Exception Matters, sub-item numbering, seed phrases, manual add, full edit, numbering-offset override), commit range, test results.

In `Genesis Rebuild - Commitment Schedule B-I,B-II Design.md`, change frontmatter `status:` to `implemented`.

- [ ] **Step 4: Re-sync T7 → Desktop backup and verify**

```bash
rsync -av --delete "/Volumes/T7/Claude Code/Genesis Platform/" "/Users/campenny/Desktop/Claude Code/Genesis Platform/"
bash "/Volumes/T7/Claude Code/Genesis Platform/.claude/hooks/verify-sync.sh"
```

---

## Self-Review

**Spec coverage:** Chip generation from Security Instruments/Related Documents/Liens/Exception Matters, sub-item numbering, seed phrases, manual add, full edit, numbering-offset override — Tasks 3-6 ✓. Schema matches the design doc exactly (including reserved-for-Curative columns, unused this round) — Task 1 ✓. Curative disposition UI, Endorsements sync, and the generated document/ALTA boilerplate correctly absent — never referenced ✓. Nav wiring — Task 7 Step 1 ✓.

**Placeholder scan:** No TBD/TODO. The `void formData` pattern in Task 4's chip actions is a deliberate, explained choice (Next.js server actions bound to a form must accept FormData as their last parameter even when unused), not an unexplained artifact.

**Type consistency:** `CommitmentRequirement`/`CommitmentException`/`CommitmentSchBSettings` (Task 2) field names match the migration's columns (Task 1) and every form's `name` attributes (Tasks 5-6) exactly. `siRequirementText`/`relRequirementText`/`lienRequirementText`/`emExceptionText`/`computeReqLabels` (Task 3) signatures match their call sites in Task 4's actions and Task 5's component exactly. Server action signatures (Task 4) match their `.bind()` call sites in Tasks 5-6 exactly. `RequirementsSection`'s and `ExceptionsSection`'s prop shapes match exactly what Task 7's page passes.
