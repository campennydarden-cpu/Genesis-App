# Genesis App — Prelim Title Search & Opinion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Prelim Title Search & Opinion File Section — the first of the Title nav group's 4 items — porting the proven data model from the old prototype (`genesis-github-push/genesis-app.html`), corrected against the prototype's actual source after an earlier extraction pass drifted from it.

**Architecture:** New `prelim_search` table (1:1 with `orders`) plus 5 related tables (`derivation_principals`, `security_instruments`, `security_instrument_related_docs`, `liens`, `exception_matters`). One route (`/orders/[id]/prelim-search`), a single scrolling page with a sticky plain-anchor jump nav (4 targets: Derivation, Security Instruments, Liens, Exception Matters — Real Property Taxes folds into Derivation's own form, see Task 4). One client component per sub-area rather than one giant file, unlike `PropertyForm.tsx`.

**Tech Stack:** Same as prior increments — Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, `@supabase/ssr`, Playwright E2E extending `tests/e2e/order-entry.spec.ts`. Supabase project `hlahrypglnmjjxrdtfkm`.

**Spec:** `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Prelim Title Search Design.md`

## Global Constraints

- All file operations happen in the T7 copy (`/Volumes/T7/Claude Code/Genesis Platform/`), never the Desktop backup.
- Repo: `/Volumes/T7/Claude Code/Genesis Platform/genesis-app/`, remote `origin` → `https://github.com/campennydarden-cpu/Genesis-App.git`, branch `main`, Vercel auto-deploys on push, live at `https://genesis-app-tau.vercel.app`.
- Model-cost discipline (explicit user instruction): haiku for mechanical/fully-specified tasks, sonnet for tasks requiring judgment (conditional logic, generated-text rendering, cross-component orchestration, test design). No opus. Each task below is tagged with its intended model.
- All dropdown value lists and field mappings in this plan were re-verified directly against the prototype's source (`grep`/`Read` on the actual `.html` file), not trusted from a prior summary — an earlier extraction pass had drifted on several concrete points (Derivation Instrument Types, Security Instrument Types' 4th value, and the entire Lien Type list + per-type fields). Do not "correct" these values back to anything that sounds more familiar — they are correct as written here.
- Derivation auto-fill from Order Contacts (the prototype's actual behavior) is explicitly out of scope this round — Genesis's `contacts` table doesn't yet have the marital-status/spouse-link/officer-roster fields that behavior depends on. Derivation Principals is a standalone manual roster local to this feature (name + role only).
- Real Property Taxes fields live inside Derivation's own save form (not a separate top-level form) — both are columns on the same `prelim_search` row, and two independent forms hitting the same upsert action would null out whichever fields aren't present in a given submission.
- Testing stays Playwright E2E only, extending the existing cumulative spec file — no unit-test framework introduced.
- Dev server must be running (`npm run dev`, no `webServer` entry in `playwright.config.ts`) before `npm run test:e2e`.
- Repeated label text across sections (e.g. "Dated Date", "Book", "Page" appear in Derivation, Security Instruments, Liens, and Exception Matters) means `page.getByLabel(...)` is ambiguous at the page level — E2E tests must scope such lookups to the relevant `data-testid` container first.

## Value lists (exact, verbatim — used in constants, schema CHECK constraints, and form `<select>`s)

**Derivation Instrument Type (16 values, verified against `DERIVATION_INSTRUMENT_TYPES`):** `Warranty Deed`, `Special Warranty Deed`, `Limited Warranty Deed`, `Trustee's Deed`, `Deed of Distribution`, `Gift Deed`, `Quitclaim Deed`, `Grant Deed`, `Deed of Bargain and Sale`, `Interspousal Transfer Deed`, `Transfer on Death Deed`, `Affidavit`, `Death Certificate`, `Divorce Decree`, `Quiet Title Action`, `Confirmatory Deed`

**Derivation Entity Type (7 values, verified against `ENTITY_TYPES`):** `Individual`, `LLC`, `Corporation`, `Partnership`, `Trust`, `Estate`, `Other` — kept as a separate constant from the existing `ENTITY_TYPES` in `constants.ts` because that one (used by Contacts) is missing `Other` relative to the prototype; not touching Contacts' constant in this round.

**Principal Roles by Entity Type (verified against `PRINCIPAL_ROLES`):** LLC → `Member`, `Manager`. Corporation → `President`, `Vice President`, `Secretary`, `Treasurer`, `Director`, `Chairman`. Partnership → `General Partner`, `Limited Partner`. Trust → `Trustee`, `Successor Trustee`, `Co-Trustee`. (Individual/Estate/Other get no roster.)

**Security Instrument Type (4 values, verified against `SECURITY_INSTRUMENT_TYPES`):** `Mortgage`, `Deed of Trust`, `Security Deed`, `UCC Financing Statement`

**Related Document Type (7 values, verified against `RELATED_DOC_TYPES`):** `Assignment`, `Assignment of Leases and Rents`, `Assignment of Beneficial Interest`, `Loan Modification Agreement`, `Substitution of Trustee`, `UCC Addendum - Continuation`, `Other`

**Related Document Assignment-family types (verified against `RELATED_DOC_ASSIGNMENT_TYPES`, gates Assignor/Assignee visibility):** `Assignment`, `Assignment of Leases and Rents`, `Assignment of Beneficial Interest`

**Lien Type (9 values, verified against `LIEN_TYPES`):** `Judgment`, `Tax Lien`, `HOA/COA Lien`, `Mechanics Lien`, `Lis Pendens`, `Tax Sale Certificate`, `Municipal Lien`, `Utility Lien`, `Other`

**Tax Lien Type (6 values, verified against `TAX_LIEN_TYPES`):** `Income`, `Property`, `Franchise`, `Sales/Use`, `Estate`, `Other`

## File Structure

```
genesis-app/
├── supabase/migrations/
│   └── 0003_prelim_search.sql                     # NEW
├── src/
│   ├── lib/
│   │   ├── constants.ts                            # MODIFY: + prelim search constants
│   │   └── types.ts                                # MODIFY: + prelim search types
│   ├── app/
│   │   ├── actions/
│   │   │   └── prelim-search.ts                    # NEW
│   │   ├── globals.css                             # MODIFY: + scroll-behavior: smooth
│   │   └── orders/[id]/
│   │       └── prelim-search/page.tsx               # NEW
│   └── components/
│       ├── FileSectionsNav.tsx                     # MODIFY: Prelim Title Search gains segment
│       └── prelim-search/
│           ├── DerivationSection.tsx                # NEW
│           ├── SecurityInstrumentsSection.tsx        # NEW
│           ├── LiensSection.tsx                      # NEW
│           └── ExceptionMattersSection.tsx            # NEW
└── tests/e2e/order-entry.spec.ts                   # MODIFY
```

---

### Task 1: Schema — `prelim_search` and 5 related tables

**Suggested model:** haiku (fully-specified schema transcription)

**Files:**
- Create: `supabase/migrations/0003_prelim_search.sql`

**Interfaces:**
- Produces: `prelim_search`, `derivation_principals`, `security_instruments`, `security_instrument_related_docs`, `liens`, `exception_matters` tables, all RLS-enabled `to authenticated using (true)`, matching the existing `orders`/`contacts`/`property_details` pattern.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0003_prelim_search.sql
create table public.prelim_search (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  effective_date date,
  effective_time text,
  search_from_date date,
  search_to_date date,
  search_to_time text,
  search_type text,
  derivation_instrument_type text check (derivation_instrument_type in (
    'Warranty Deed', 'Special Warranty Deed', 'Limited Warranty Deed', 'Trustee''s Deed',
    'Deed of Distribution', 'Gift Deed', 'Quitclaim Deed', 'Grant Deed',
    'Deed of Bargain and Sale', 'Interspousal Transfer Deed', 'Transfer on Death Deed',
    'Affidavit', 'Death Certificate', 'Divorce Decree', 'Quiet Title Action', 'Confirmatory Deed'
  )),
  derivation_dated_date date,
  derivation_recorded_date date,
  derivation_book text,
  derivation_page text,
  derivation_instrument_number text,
  derivation_consideration text,
  derivation_grantee_name text,
  derivation_grantee_entity_type text check (derivation_grantee_entity_type in (
    'Individual', 'LLC', 'Corporation', 'Partnership', 'Trust', 'Estate', 'Other'
  )),
  derivation_grantor_name text,
  derivation_grantor_entity_type text check (derivation_grantor_entity_type in (
    'Individual', 'LLC', 'Corporation', 'Partnership', 'Trust', 'Estate', 'Other'
  )),
  derivation_is_portion boolean not null default false,
  derivation_note text,
  taxes_paid_through_year text,
  taxes_now_due text,
  taxes_not_yet_due text,
  special_levies_assessments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.derivation_principals (
  id uuid primary key default gen_random_uuid(),
  prelim_search_id uuid not null references public.prelim_search(id) on delete cascade,
  side text not null check (side in ('grantee', 'grantor')),
  name text not null,
  role text,
  created_at timestamptz not null default now()
);

create index derivation_principals_prelim_search_id_idx on public.derivation_principals(prelim_search_id);

create table public.security_instruments (
  id uuid primary key default gen_random_uuid(),
  prelim_search_id uuid not null references public.prelim_search(id) on delete cascade,
  type text check (type in ('Mortgage', 'Deed of Trust', 'Security Deed', 'UCC Financing Statement')),
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  original_amount text,
  mortgagor text,
  mortgagee text,
  trustee text,
  created_at timestamptz not null default now()
);

create index security_instruments_prelim_search_id_idx on public.security_instruments(prelim_search_id);

create table public.security_instrument_related_docs (
  id uuid primary key default gen_random_uuid(),
  security_instrument_id uuid not null references public.security_instruments(id) on delete cascade,
  type text check (type in (
    'Assignment', 'Assignment of Leases and Rents', 'Assignment of Beneficial Interest',
    'Loan Modification Agreement', 'Substitution of Trustee', 'UCC Addendum - Continuation', 'Other'
  )),
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  assignor text,
  assignee text,
  notes text,
  created_at timestamptz not null default now()
);

create index security_instrument_related_docs_si_id_idx on public.security_instrument_related_docs(security_instrument_id);

create table public.liens (
  id uuid primary key default gen_random_uuid(),
  prelim_search_id uuid not null references public.prelim_search(id) on delete cascade,
  type text not null check (type in (
    'Judgment', 'Tax Lien', 'HOA/COA Lien', 'Mechanics Lien', 'Lis Pendens',
    'Tax Sale Certificate', 'Municipal Lien', 'Utility Lien', 'Other'
  )),
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  amount text,
  debtor text,
  creditor text,
  docket_date date,
  case_number text,
  court text,
  taxing_authority text,
  tax_type text check (tax_type in ('Income', 'Property', 'Franchise', 'Sales/Use', 'Estate', 'Other')),
  filed_date date,
  hoa_company text,
  materialman text,
  last_service_date date,
  plaintiff text,
  defendant text,
  certificate_id text,
  redemption_expiration date,
  created_at timestamptz not null default now()
);

create index liens_prelim_search_id_idx on public.liens(prelim_search_id);

create table public.exception_matters (
  id uuid primary key default gen_random_uuid(),
  prelim_search_id uuid not null references public.prelim_search(id) on delete cascade,
  description text,
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  created_at timestamptz not null default now()
);

create index exception_matters_prelim_search_id_idx on public.exception_matters(prelim_search_id);

alter table public.prelim_search enable row level security;
alter table public.derivation_principals enable row level security;
alter table public.security_instruments enable row level security;
alter table public.security_instrument_related_docs enable row level security;
alter table public.liens enable row level security;
alter table public.exception_matters enable row level security;

create policy "Authenticated M&L staff can do anything with prelim_search"
  on public.prelim_search for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with derivation_principals"
  on public.derivation_principals for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with security_instruments"
  on public.security_instruments for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with security_instrument_related_docs"
  on public.security_instrument_related_docs for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with liens"
  on public.liens for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with exception_matters"
  on public.exception_matters for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool (ToolSearch for `select:mcp__f2145503-a1fd-410e-a389-c079a07e574e__apply_migration` if not already loaded) against project `hlahrypglnmjjxrdtfkm`, with `name: "prelim_search"` and the SQL above as `query`.

Expected: migration applies with no errors.

- [ ] **Step 3: Verify**

Use the Supabase MCP `list_tables` tool (project `hlahrypglnmjjxrdtfkm`, schema `public`) and confirm all 6 new tables appear with RLS enabled.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add supabase/migrations/0003_prelim_search.sql
git commit -m "feat: add prelim_search schema (Derivation, Security Instruments, Liens, Exception Matters)"
```

---

### Task 2: Constants and types

**Suggested model:** haiku (fully-specified value lists and type definitions)

**Files:**
- Modify: `src/lib/constants.ts` (append)
- Modify: `src/lib/types.ts` (append)

**Interfaces:**
- Produces: `DERIVATION_INSTRUMENT_TYPES`, `DERIVATION_ENTITY_TYPES`, `PRINCIPAL_ROLES`, `SECURITY_INSTRUMENT_TYPES`, `RELATED_DOC_TYPES`, `RELATED_DOC_ASSIGNMENT_TYPES`, `LIEN_TYPES`, `TAX_LIEN_TYPES` (readonly string-tuple constants; `PRINCIPAL_ROLES` is a `Record<string, readonly string[]>`).
- Produces: `PrelimSearch`, `DerivationPrincipal`, `SecurityInstrument`, `SecurityInstrumentRelatedDoc`, `Lien`, `ExceptionMatter` types. Consumed by Task 3's actions and Tasks 4-8's components.

- [ ] **Step 1: Append the constants**

```ts
// append to src/lib/constants.ts

export const DERIVATION_INSTRUMENT_TYPES = [
  'Warranty Deed',
  'Special Warranty Deed',
  'Limited Warranty Deed',
  "Trustee's Deed",
  'Deed of Distribution',
  'Gift Deed',
  'Quitclaim Deed',
  'Grant Deed',
  'Deed of Bargain and Sale',
  'Interspousal Transfer Deed',
  'Transfer on Death Deed',
  'Affidavit',
  'Death Certificate',
  'Divorce Decree',
  'Quiet Title Action',
  'Confirmatory Deed',
] as const

export const DERIVATION_ENTITY_TYPES = [
  'Individual',
  'LLC',
  'Corporation',
  'Partnership',
  'Trust',
  'Estate',
  'Other',
] as const

export const PRINCIPAL_ROLES: Record<string, readonly string[]> = {
  LLC: ['Member', 'Manager'],
  Corporation: ['President', 'Vice President', 'Secretary', 'Treasurer', 'Director', 'Chairman'],
  Partnership: ['General Partner', 'Limited Partner'],
  Trust: ['Trustee', 'Successor Trustee', 'Co-Trustee'],
}

export const SECURITY_INSTRUMENT_TYPES = [
  'Mortgage',
  'Deed of Trust',
  'Security Deed',
  'UCC Financing Statement',
] as const

export const RELATED_DOC_TYPES = [
  'Assignment',
  'Assignment of Leases and Rents',
  'Assignment of Beneficial Interest',
  'Loan Modification Agreement',
  'Substitution of Trustee',
  'UCC Addendum - Continuation',
  'Other',
] as const

export const RELATED_DOC_ASSIGNMENT_TYPES = [
  'Assignment',
  'Assignment of Leases and Rents',
  'Assignment of Beneficial Interest',
] as const

export const LIEN_TYPES = [
  'Judgment',
  'Tax Lien',
  'HOA/COA Lien',
  'Mechanics Lien',
  'Lis Pendens',
  'Tax Sale Certificate',
  'Municipal Lien',
  'Utility Lien',
  'Other',
] as const

export const TAX_LIEN_TYPES = [
  'Income',
  'Property',
  'Franchise',
  'Sales/Use',
  'Estate',
  'Other',
] as const
```

- [ ] **Step 2: Append the types**

```ts
// append to src/lib/types.ts

export type PrelimSearch = {
  id: string
  order_id: string
  effective_date: string | null
  effective_time: string | null
  search_from_date: string | null
  search_to_date: string | null
  search_to_time: string | null
  search_type: string | null
  derivation_instrument_type: string | null
  derivation_dated_date: string | null
  derivation_recorded_date: string | null
  derivation_book: string | null
  derivation_page: string | null
  derivation_instrument_number: string | null
  derivation_consideration: string | null
  derivation_grantee_name: string | null
  derivation_grantee_entity_type: string | null
  derivation_grantor_name: string | null
  derivation_grantor_entity_type: string | null
  derivation_is_portion: boolean
  derivation_note: string | null
  taxes_paid_through_year: string | null
  taxes_now_due: string | null
  taxes_not_yet_due: string | null
  special_levies_assessments: string | null
}

export type DerivationPrincipal = {
  id: string
  prelim_search_id: string
  side: 'grantee' | 'grantor'
  name: string
  role: string | null
}

export type SecurityInstrument = {
  id: string
  prelim_search_id: string
  type: string | null
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
  original_amount: string | null
  mortgagor: string | null
  mortgagee: string | null
  trustee: string | null
}

export type SecurityInstrumentRelatedDoc = {
  id: string
  security_instrument_id: string
  type: string | null
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
  assignor: string | null
  assignee: string | null
  notes: string | null
}

export type Lien = {
  id: string
  prelim_search_id: string
  type: string
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
  amount: string | null
  debtor: string | null
  creditor: string | null
  docket_date: string | null
  case_number: string | null
  court: string | null
  taxing_authority: string | null
  tax_type: string | null
  filed_date: string | null
  hoa_company: string | null
  materialman: string | null
  last_service_date: string | null
  plaintiff: string | null
  defendant: string | null
  certificate_id: string | null
  redemption_expiration: string | null
}

export type ExceptionMatter = {
  id: string
  prelim_search_id: string
  description: string | null
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

Expected: succeeds — no consumers exist yet, this only checks the new files compile.

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/types.ts
git commit -m "feat: add Prelim Title Search constants and types"
```

---

### Task 3: Server Actions

**Suggested model:** haiku (mechanical CRUD, one repeated pattern per table)

**Files:**
- Create: `src/app/actions/prelim-search.ts`

**Interfaces:**
- Consumes: `PrelimSearch`, `DerivationPrincipal`, `SecurityInstrument`, `SecurityInstrumentRelatedDoc`, `Lien`, `ExceptionMatter` (Task 2, for reference only — actions read/write raw `FormData`, not typed objects).
- Produces: `upsertPrelimSearch(orderId, formData)`; `addDerivationPrincipal(prelimSearchId, orderId, side, formData)`, `updateDerivationPrincipal(orderId, principalId, formData)`, `deleteDerivationPrincipal(orderId, principalId)`; `addSecurityInstrument(prelimSearchId, orderId, formData)`, `updateSecurityInstrument(orderId, siId, formData)`, `deleteSecurityInstrument(orderId, siId)`; `addRelatedDoc(securityInstrumentId, orderId, formData)`, `updateRelatedDoc(orderId, docId, formData)`, `deleteRelatedDoc(orderId, docId)`; `addLien(prelimSearchId, orderId, formData)`, `updateLien(orderId, lienId, formData)`, `deleteLien(orderId, lienId)`; `addExceptionMatter(prelimSearchId, orderId, formData)`, `updateExceptionMatter(orderId, matterId, formData)`, `deleteExceptionMatter(orderId, matterId)`. All consumed by Tasks 4-8's components via `.bind()`, same pattern as `upsertPropertyDetails`/`addEasement`.

- [ ] **Step 1: Create the actions file**

```ts
// src/app/actions/prelim-search.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function upsertPrelimSearch(orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase.from('prelim_search').upsert(
    {
      order_id: orderId,
      effective_date: field('effective_date'),
      effective_time: field('effective_time'),
      search_from_date: field('search_from_date'),
      search_to_date: field('search_to_date'),
      search_to_time: field('search_to_time'),
      search_type: field('search_type'),
      derivation_instrument_type: field('derivation_instrument_type'),
      derivation_dated_date: field('derivation_dated_date'),
      derivation_recorded_date: field('derivation_recorded_date'),
      derivation_book: field('derivation_book'),
      derivation_page: field('derivation_page'),
      derivation_instrument_number: field('derivation_instrument_number'),
      derivation_consideration: field('derivation_consideration'),
      derivation_grantee_name: field('derivation_grantee_name'),
      derivation_grantee_entity_type: field('derivation_grantee_entity_type'),
      derivation_grantor_name: field('derivation_grantor_name'),
      derivation_grantor_entity_type: field('derivation_grantor_entity_type'),
      derivation_is_portion: formData.get('derivation_is_portion') === 'on',
      derivation_note: field('derivation_note'),
      taxes_paid_through_year: field('taxes_paid_through_year'),
      taxes_now_due: field('taxes_now_due'),
      taxes_not_yet_due: field('taxes_not_yet_due'),
      special_levies_assessments: field('special_levies_assessments'),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  )

  if (error) {
    console.error('upsertPrelimSearch failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
  redirect(`/orders/${orderId}/prelim-search`)
}

export async function addDerivationPrincipal(
  prelimSearchId: string,
  orderId: string,
  side: 'grantee' | 'grantor',
  formData: FormData
) {
  const supabase = await createClient()
  const name = formData.get('name') as string
  const role = (formData.get('role') as string) || null

  const { error } = await supabase.from('derivation_principals').insert({
    prelim_search_id: prelimSearchId,
    side,
    name,
    role,
  })

  if (error) {
    console.error('addDerivationPrincipal failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function updateDerivationPrincipal(orderId: string, principalId: string, formData: FormData) {
  const supabase = await createClient()
  const name = formData.get('name') as string
  const role = (formData.get('role') as string) || null

  const { error } = await supabase.from('derivation_principals').update({ name, role }).eq('id', principalId)

  if (error) {
    console.error('updateDerivationPrincipal failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteDerivationPrincipal(orderId: string, principalId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('derivation_principals').delete().eq('id', principalId)

  if (error) {
    console.error('deleteDerivationPrincipal failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function addSecurityInstrument(prelimSearchId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase.from('security_instruments').insert({
    prelim_search_id: prelimSearchId,
    type: field('type'),
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
    original_amount: field('original_amount'),
    mortgagor: field('mortgagor'),
    mortgagee: field('mortgagee'),
    trustee: field('trustee'),
  })

  if (error) {
    console.error('addSecurityInstrument failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function updateSecurityInstrument(orderId: string, siId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase
    .from('security_instruments')
    .update({
      type: field('type'),
      dated_date: field('dated_date'),
      recorded_date: field('recorded_date'),
      book: field('book'),
      page: field('page'),
      instrument_number: field('instrument_number'),
      original_amount: field('original_amount'),
      mortgagor: field('mortgagor'),
      mortgagee: field('mortgagee'),
      trustee: field('trustee'),
    })
    .eq('id', siId)

  if (error) {
    console.error('updateSecurityInstrument failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteSecurityInstrument(orderId: string, siId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('security_instruments').delete().eq('id', siId)

  if (error) {
    console.error('deleteSecurityInstrument failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function addRelatedDoc(securityInstrumentId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase.from('security_instrument_related_docs').insert({
    security_instrument_id: securityInstrumentId,
    type: field('type'),
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
    assignor: field('assignor'),
    assignee: field('assignee'),
    notes: field('notes'),
  })

  if (error) {
    console.error('addRelatedDoc failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function updateRelatedDoc(orderId: string, docId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase
    .from('security_instrument_related_docs')
    .update({
      type: field('type'),
      dated_date: field('dated_date'),
      recorded_date: field('recorded_date'),
      book: field('book'),
      page: field('page'),
      instrument_number: field('instrument_number'),
      assignor: field('assignor'),
      assignee: field('assignee'),
      notes: field('notes'),
    })
    .eq('id', docId)

  if (error) {
    console.error('updateRelatedDoc failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteRelatedDoc(orderId: string, docId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('security_instrument_related_docs').delete().eq('id', docId)

  if (error) {
    console.error('deleteRelatedDoc failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function addLien(prelimSearchId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase.from('liens').insert({
    prelim_search_id: prelimSearchId,
    type: formData.get('type') as string,
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
    amount: field('amount'),
    debtor: field('debtor'),
    creditor: field('creditor'),
    docket_date: field('docket_date'),
    case_number: field('case_number'),
    court: field('court'),
    taxing_authority: field('taxing_authority'),
    tax_type: field('tax_type'),
    filed_date: field('filed_date'),
    hoa_company: field('hoa_company'),
    materialman: field('materialman'),
    last_service_date: field('last_service_date'),
    plaintiff: field('plaintiff'),
    defendant: field('defendant'),
    certificate_id: field('certificate_id'),
    redemption_expiration: field('redemption_expiration'),
  })

  if (error) {
    console.error('addLien failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function updateLien(orderId: string, lienId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase
    .from('liens')
    .update({
      type: formData.get('type') as string,
      dated_date: field('dated_date'),
      recorded_date: field('recorded_date'),
      book: field('book'),
      page: field('page'),
      instrument_number: field('instrument_number'),
      amount: field('amount'),
      debtor: field('debtor'),
      creditor: field('creditor'),
      docket_date: field('docket_date'),
      case_number: field('case_number'),
      court: field('court'),
      taxing_authority: field('taxing_authority'),
      tax_type: field('tax_type'),
      filed_date: field('filed_date'),
      hoa_company: field('hoa_company'),
      materialman: field('materialman'),
      last_service_date: field('last_service_date'),
      plaintiff: field('plaintiff'),
      defendant: field('defendant'),
      certificate_id: field('certificate_id'),
      redemption_expiration: field('redemption_expiration'),
    })
    .eq('id', lienId)

  if (error) {
    console.error('updateLien failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteLien(orderId: string, lienId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('liens').delete().eq('id', lienId)

  if (error) {
    console.error('deleteLien failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function addExceptionMatter(prelimSearchId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase.from('exception_matters').insert({
    prelim_search_id: prelimSearchId,
    description: field('description'),
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
  })

  if (error) {
    console.error('addExceptionMatter failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function updateExceptionMatter(orderId: string, matterId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase
    .from('exception_matters')
    .update({
      description: field('description'),
      dated_date: field('dated_date'),
      recorded_date: field('recorded_date'),
      book: field('book'),
      page: field('page'),
      instrument_number: field('instrument_number'),
    })
    .eq('id', matterId)

  if (error) {
    console.error('updateExceptionMatter failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteExceptionMatter(orderId: string, matterId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('exception_matters').delete().eq('id', matterId)

  if (error) {
    console.error('deleteExceptionMatter failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }
  revalidatePath(`/orders/${orderId}/prelim-search`)
}
```

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/prelim-search.ts
git commit -m "feat: add Prelim Title Search server actions"
```

---

### Task 4: DerivationSection (incl. Real Property Taxes, generated clauses, Principal rosters)

**Suggested model:** sonnet (generated-text logic, conditional roster rendering, judgment-heavy)

**Files:**
- Create: `src/components/prelim-search/DerivationSection.tsx`

**Interfaces:**
- Consumes: `upsertPrelimSearch` (bound as `action` prop by Task 8's page), `addDerivationPrincipal`/`updateDerivationPrincipal`/`deleteDerivationPrincipal` (Task 3), `DERIVATION_INSTRUMENT_TYPES`/`DERIVATION_ENTITY_TYPES`/`PRINCIPAL_ROLES` (Task 2), `PrelimSearch`/`DerivationPrincipal` (Task 2).
- Produces: `DerivationSection({ action, orderId, prelim, county, granteePrincipals, grantorPrincipals })` — Client Component, self-contained `<section id="derivation">`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/prelim-search/DerivationSection.tsx
'use client'

import { useState } from 'react'
import { DERIVATION_INSTRUMENT_TYPES, DERIVATION_ENTITY_TYPES, PRINCIPAL_ROLES } from '@/lib/constants'
import { addDerivationPrincipal, updateDerivationPrincipal, deleteDerivationPrincipal } from '@/app/actions/prelim-search'
import type { PrelimSearch, DerivationPrincipal } from '@/lib/types'

function entityQualifiedName(
  name: string | null,
  entityType: string | null,
  principals: DerivationPrincipal[]
): string {
  if (!name && !(entityType && entityType in PRINCIPAL_ROLES)) return name ?? ''
  switch (entityType) {
    case 'Trust': {
      const trustees = principals.map((p) => p.name).filter(Boolean)
      if (trustees.length === 0) return `[Trustee(s) not yet added] of the ${name || '[Trust Name]'}`
      const label = trustees.length > 1 ? 'Trustees' : 'Trustee'
      return `${trustees.join(' and ')}, as ${label} of the ${name || '[Trust Name]'}`
    }
    case 'LLC':
    case 'Corporation':
    case 'Partnership': {
      const base = name || '[Entity Name]'
      const names = principals.map((p) => p.name + (p.role ? ` (${p.role})` : '')).filter(Boolean)
      return base + (names.length ? `, by ${names.join(', ')}` : '')
    }
    default:
      return name ?? ''
  }
}

function fullDerivationClause(
  prelim: PrelimSearch,
  granteePrincipals: DerivationPrincipal[],
  grantorPrincipals: DerivationPrincipal[],
  county: string | null
): string {
  if (
    !(
      prelim.derivation_grantee_name &&
      prelim.derivation_instrument_type &&
      prelim.derivation_grantor_name &&
      prelim.derivation_recorded_date &&
      county
    )
  ) {
    return ''
  }
  const recordingParts: string[] = []
  if (prelim.derivation_book || prelim.derivation_page) {
    recordingParts.push(`Book ${prelim.derivation_book || '—'}, Page ${prelim.derivation_page || '—'}`)
  }
  if (prelim.derivation_instrument_number) {
    recordingParts.push(`Instrument No. ${prelim.derivation_instrument_number}`)
  }
  const recording = recordingParts.length ? ` as ${recordingParts.join(', ')}` : ''
  const granteeName = entityQualifiedName(
    prelim.derivation_grantee_name,
    prelim.derivation_grantee_entity_type,
    granteePrincipals
  )
  const grantorName = entityQualifiedName(
    prelim.derivation_grantor_name,
    prelim.derivation_grantor_entity_type,
    grantorPrincipals
  )
  const parcelPhrase = prelim.derivation_is_portion ? 'Being a portion of the same parcel' : 'Being the same parcel'
  return `${parcelPhrase} conveyed unto ${granteeName} by ${prelim.derivation_instrument_type} of ${grantorName} recorded ${prelim.derivation_recorded_date}${recording} of the ${county} County records.`
}

function PrincipalRoster({
  side,
  entityType,
  principals,
  orderId,
  prelimSearchId,
}: {
  side: 'grantee' | 'grantor'
  entityType: string | null
  principals: DerivationPrincipal[]
  orderId: string
  prelimSearchId: string
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  if (!entityType || !(entityType in PRINCIPAL_ROLES)) return null

  const roles = PRINCIPAL_ROLES[entityType] ?? []
  const addPrincipal = addDerivationPrincipal.bind(null, prelimSearchId, orderId, side)
  const label = side === 'grantee' ? 'Grantee' : 'Grantor'

  return (
    <div className="mt-6 border-t pt-4">
      <p className="mb-2 text-sm font-medium">{label} Principals</p>
      <ul className="mb-4 space-y-2" data-testid={`${side}-principal-list`}>
        {principals.map((p) =>
          editingId === p.id ? (
            <li key={p.id} className="rounded border p-3" data-testid={`${side}-principal-row`}>
              <form
                action={async (formData: FormData) => {
                  await updateDerivationPrincipal(orderId, p.id, formData)
                  setEditingId(null)
                }}
                className="space-y-2"
              >
                <input name="name" defaultValue={p.name} required className="w-full rounded border px-3 py-2" />
                <select name="role" defaultValue={p.role ?? ''} className="w-full rounded border px-3 py-2">
                  <option value="">— Select —</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
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
            <li key={p.id} className="flex items-center justify-between rounded border p-3" data-testid={`${side}-principal-row`}>
              <p>
                {p.name}
                {p.role ? <span className="text-slate-500"> — {p.role}</span> : null}
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingId(p.id)} className="text-sm text-slate-600 hover:underline">
                  Edit
                </button>
                <form action={deleteDerivationPrincipal.bind(null, orderId, p.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {principals.length === 0 && (
          <p className="text-sm text-slate-500">No {label.toLowerCase()} principals added yet.</p>
        )}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add a {label.toLowerCase()} principal</summary>
        <form action={addPrincipal} className="mt-4 space-y-2">
          <input name="name" placeholder="Name" required className="w-full rounded border px-3 py-2" />
          <select name="role" defaultValue="" className="w-full rounded border px-3 py-2">
            <option value="">— Select —</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
            Add
          </button>
        </form>
      </details>
    </div>
  )
}

export function DerivationSection({
  action,
  orderId,
  prelim,
  county,
  granteePrincipals,
  grantorPrincipals,
}: {
  action: (formData: FormData) => void
  orderId: string
  prelim: PrelimSearch | null
  county: string | null
  granteePrincipals: DerivationPrincipal[]
  grantorPrincipals: DerivationPrincipal[]
}) {
  const clauseText = prelim ? fullDerivationClause(prelim, granteePrincipals, grantorPrincipals, county) : ''
  const vestingText = prelim
    ? entityQualifiedName(prelim.derivation_grantee_name, prelim.derivation_grantee_entity_type, granteePrincipals)
    : ''

  return (
    <section id="derivation" className="scroll-mt-20 border-b pb-8">
      <h2 className="mb-4 text-xl font-semibold">Derivation</h2>

      <form action={action} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="effective_date" className="block text-sm font-medium">
              Effective Date
            </label>
            <input id="effective_date" name="effective_date" type="date" defaultValue={prelim?.effective_date ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="effective_time" className="block text-sm font-medium">
              Effective Time
            </label>
            <input id="effective_time" name="effective_time" defaultValue={prelim?.effective_time ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="search_type" className="block text-sm font-medium">
              Search Type
            </label>
            <input id="search_type" name="search_type" defaultValue={prelim?.search_type ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="search_from_date" className="block text-sm font-medium">
              Search From Date
            </label>
            <input id="search_from_date" name="search_from_date" type="date" defaultValue={prelim?.search_from_date ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="search_to_date" className="block text-sm font-medium">
              Search To Date
            </label>
            <input id="search_to_date" name="search_to_date" type="date" defaultValue={prelim?.search_to_date ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="search_to_time" className="block text-sm font-medium">
              Search To Time
            </label>
            <input id="search_to_time" name="search_to_time" defaultValue={prelim?.search_to_time ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="derivation_instrument_type" className="block text-sm font-medium">
                Instrument Type
              </label>
              <select id="derivation_instrument_type" name="derivation_instrument_type" defaultValue={prelim?.derivation_instrument_type ?? ''} className="mt-1 w-full rounded border px-3 py-2">
                <option value="">— Select —</option>
                {DERIVATION_INSTRUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="derivation_consideration" className="block text-sm font-medium">
                Consideration
              </label>
              <input id="derivation_consideration" name="derivation_consideration" defaultValue={prelim?.derivation_consideration ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="derivation_dated_date" className="block text-sm font-medium">
                Dated Date
              </label>
              <input id="derivation_dated_date" name="derivation_dated_date" type="date" defaultValue={prelim?.derivation_dated_date ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div>
              <label htmlFor="derivation_recorded_date" className="block text-sm font-medium">
                Recorded Date
              </label>
              <input id="derivation_recorded_date" name="derivation_recorded_date" type="date" defaultValue={prelim?.derivation_recorded_date ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="derivation_book" className="block text-sm font-medium">
                  Book
                </label>
                <input id="derivation_book" name="derivation_book" defaultValue={prelim?.derivation_book ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label htmlFor="derivation_page" className="block text-sm font-medium">
                  Page
                </label>
                <input id="derivation_page" name="derivation_page" defaultValue={prelim?.derivation_page ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="derivation_instrument_number" className="block text-sm font-medium">
              Instrument Number
            </label>
            <input id="derivation_instrument_number" name="derivation_instrument_number" defaultValue={prelim?.derivation_instrument_number ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="derivation_grantee_name" className="block text-sm font-medium">
                Grantee Name
              </label>
              <input id="derivation_grantee_name" name="derivation_grantee_name" defaultValue={prelim?.derivation_grantee_name ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div>
              <label htmlFor="derivation_grantee_entity_type" className="block text-sm font-medium">
                Grantee Entity Type
              </label>
              <select id="derivation_grantee_entity_type" name="derivation_grantee_entity_type" defaultValue={prelim?.derivation_grantee_entity_type ?? 'Individual'} className="mt-1 w-full rounded border px-3 py-2">
                {DERIVATION_ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="derivation_grantor_name" className="block text-sm font-medium">
                Grantor Name
              </label>
              <input id="derivation_grantor_name" name="derivation_grantor_name" defaultValue={prelim?.derivation_grantor_name ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div>
              <label htmlFor="derivation_grantor_entity_type" className="block text-sm font-medium">
                Grantor Entity Type
              </label>
              <select id="derivation_grantor_entity_type" name="derivation_grantor_entity_type" defaultValue={prelim?.derivation_grantor_entity_type ?? 'Individual'} className="mt-1 w-full rounded border px-3 py-2">
                {DERIVATION_ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input id="derivation_is_portion" name="derivation_is_portion" type="checkbox" defaultChecked={prelim?.derivation_is_portion ?? false} className="h-4 w-4" />
            <label htmlFor="derivation_is_portion" className="text-sm font-medium">
              Conveys a portion of the property (not the entire parcel)
            </label>
          </div>
          <div className="mt-4">
            <label htmlFor="derivation_note" className="block text-sm font-medium">
              Derivation Note
            </label>
            <textarea id="derivation_note" name="derivation_note" rows={3} defaultValue={prelim?.derivation_note ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-medium">Real Property Taxes</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="taxes_paid_through_year" className="block text-sm font-medium">
                Taxes Paid Through Year
              </label>
              <input id="taxes_paid_through_year" name="taxes_paid_through_year" defaultValue={prelim?.taxes_paid_through_year ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div>
              <label htmlFor="taxes_now_due" className="block text-sm font-medium">
                Taxes Now Due
              </label>
              <input id="taxes_now_due" name="taxes_now_due" defaultValue={prelim?.taxes_now_due ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div>
              <label htmlFor="taxes_not_yet_due" className="block text-sm font-medium">
                Taxes Not Yet Due
              </label>
              <input id="taxes_not_yet_due" name="taxes_not_yet_due" defaultValue={prelim?.taxes_not_yet_due ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div>
              <label htmlFor="special_levies_assessments" className="block text-sm font-medium">
                Special Levies/Assessments
              </label>
              <input id="special_levies_assessments" name="special_levies_assessments" defaultValue={prelim?.special_levies_assessments ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
          </div>
        </div>

        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Save Changes
        </button>
      </form>

      <div className="mt-6 rounded bg-slate-50 p-4" data-testid="derivation-clauses">
        <p className="mb-1 text-sm font-medium">Vesting Clause</p>
        <p className="mb-4 text-sm text-slate-700" data-testid="vesting-clause">
          {vestingText || 'Fill in Grantee Name / Entity Type above to build the vesting clause.'}
        </p>
        <p className="mb-1 text-sm font-medium">Derivation Clause</p>
        <p className="text-sm text-slate-700" data-testid="derivation-clause">
          {clauseText || 'Fill in Grantee, Grantor, Instrument Type, and Recorded Date to build the derivation clause.'}
        </p>
      </div>

      {prelim ? (
        <>
          <PrincipalRoster side="grantee" entityType={prelim.derivation_grantee_entity_type} principals={granteePrincipals} orderId={orderId} prelimSearchId={prelim.id} />
          <PrincipalRoster side="grantor" entityType={prelim.derivation_grantor_entity_type} principals={grantorPrincipals} orderId={orderId} prelimSearchId={prelim.id} />
        </>
      ) : (
        <p className="mt-6 text-sm text-slate-500">Save Derivation first before adding principals.</p>
      )}
    </section>
  )
}
```

Note: the generated clauses recompute from the saved `prelim` prop, not from live-typed unsaved values — they update after "Save Changes" reloads the page, matching every other computed-from-saved-data element in this codebase.

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

Expected: succeeds (no route imports this component yet, so this only checks it compiles standalone — a full functional check happens in Task 8).

- [ ] **Step 3: Commit**

```bash
git add src/components/prelim-search/DerivationSection.tsx
git commit -m "feat: add DerivationSection component"
```

---

### Task 5: SecurityInstrumentsSection

**Suggested model:** sonnet (nested repeatable lists, conditional Assignor/Assignee fields)

**Files:**
- Create: `src/components/prelim-search/SecurityInstrumentsSection.tsx`

**Interfaces:**
- Consumes: `addSecurityInstrument`/`updateSecurityInstrument`/`deleteSecurityInstrument`/`addRelatedDoc`/`updateRelatedDoc`/`deleteRelatedDoc` (Task 3), `SECURITY_INSTRUMENT_TYPES`/`RELATED_DOC_TYPES`/`RELATED_DOC_ASSIGNMENT_TYPES` (Task 2), `SecurityInstrument`/`SecurityInstrumentRelatedDoc` (Task 2).
- Produces: `SecurityInstrumentsSection({ orderId, prelimSearchId, securityInstruments, relatedDocs })` — Client Component, self-contained `<section id="security-instruments">`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/prelim-search/SecurityInstrumentsSection.tsx
'use client'

import { useState } from 'react'
import { SECURITY_INSTRUMENT_TYPES, RELATED_DOC_TYPES, RELATED_DOC_ASSIGNMENT_TYPES } from '@/lib/constants'
import {
  addSecurityInstrument,
  updateSecurityInstrument,
  deleteSecurityInstrument,
  addRelatedDoc,
  updateRelatedDoc,
  deleteRelatedDoc,
} from '@/app/actions/prelim-search'
import type { SecurityInstrument, SecurityInstrumentRelatedDoc } from '@/lib/types'

function SIFields({ idPrefix, record }: { idPrefix: string; record?: SecurityInstrument }) {
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-type`} className="block text-sm font-medium">
          Type
        </label>
        <select id={`${idPrefix}-type`} name="type" defaultValue={record?.type ?? ''} className="mt-1 w-full rounded border px-3 py-2">
          <option value="">— Select —</option>
          {SECURITY_INSTRUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
      <div>
        <label htmlFor={`${idPrefix}-original_amount`} className="block text-sm font-medium">
          Original Amount
        </label>
        <input id={`${idPrefix}-original_amount`} name="original_amount" defaultValue={record?.original_amount ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-mortgagor`} className="block text-sm font-medium">
            Mortgagor
          </label>
          <input id={`${idPrefix}-mortgagor`} name="mortgagor" defaultValue={record?.mortgagor ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-mortgagee`} className="block text-sm font-medium">
            Mortgagee
          </label>
          <input id={`${idPrefix}-mortgagee`} name="mortgagee" defaultValue={record?.mortgagee ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-trustee`} className="block text-sm font-medium">
            Trustee
          </label>
          <input id={`${idPrefix}-trustee`} name="trustee" defaultValue={record?.trustee ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
      </div>
    </>
  )
}

function RelatedDocFields({ idPrefix, type, record }: { idPrefix: string; type: string; record?: SecurityInstrumentRelatedDoc }) {
  const showAssignment = (RELATED_DOC_ASSIGNMENT_TYPES as readonly string[]).includes(type)
  return (
    <>
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
      {showAssignment && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${idPrefix}-assignor`} className="block text-sm font-medium">
              Assignor
            </label>
            <input id={`${idPrefix}-assignor`} name="assignor" defaultValue={record?.assignor ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-assignee`} className="block text-sm font-medium">
              Assignee
            </label>
            <input id={`${idPrefix}-assignee`} name="assignee" defaultValue={record?.assignee ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
        </div>
      )}
      <div>
        <label htmlFor={`${idPrefix}-notes`} className="block text-sm font-medium">
          Notes
        </label>
        <input id={`${idPrefix}-notes`} name="notes" defaultValue={record?.notes ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
      </div>
    </>
  )
}

function RelatedDocsList({ orderId, securityInstrumentId, docs }: { orderId: string; securityInstrumentId: string; docs: SecurityInstrumentRelatedDoc[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingType, setEditingType] = useState<string>(RELATED_DOC_TYPES[0])
  const [addType, setAddType] = useState<string>(RELATED_DOC_TYPES[0])
  const addRelatedDocWithId = addRelatedDoc.bind(null, securityInstrumentId, orderId)

  return (
    <div className="mt-3 ml-4 border-l pl-4">
      <p className="mb-2 text-sm font-medium">Related Documents</p>
      <ul className="mb-3 space-y-2" data-testid="related-doc-list">
        {docs.map((d) =>
          editingId === d.id ? (
            <li key={d.id} className="rounded border p-3" data-testid="related-doc-row">
              <form
                action={async (formData: FormData) => {
                  await updateRelatedDoc(orderId, d.id, formData)
                  setEditingId(null)
                }}
                className="space-y-3"
              >
                <div>
                  <label htmlFor={`related-edit-${d.id}-type`} className="block text-sm font-medium">
                    Type
                  </label>
                  <select id={`related-edit-${d.id}-type`} name="type" value={editingType} onChange={(e) => setEditingType(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
                    {RELATED_DOC_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <RelatedDocFields idPrefix={`related-edit-${d.id}`} type={editingType} record={d} />
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
            <li key={d.id} className="flex items-center justify-between rounded border p-3" data-testid="related-doc-row">
              <div>
                <p className="font-medium">{d.type}</p>
                {(d.assignor || d.assignee) && (
                  <p className="text-sm text-slate-500">
                    {d.assignor || '(assignor unknown)'} → {d.assignee || '(assignee unknown)'}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingType(d.type ?? RELATED_DOC_TYPES[0])
                    setEditingId(d.id)
                  }}
                  className="text-sm text-slate-600 hover:underline"
                >
                  Edit
                </button>
                <form action={deleteRelatedDoc.bind(null, orderId, d.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {docs.length === 0 && <p className="text-sm text-slate-500">No related documents.</p>}
      </ul>

      <details className="rounded border p-3">
        <summary className="cursor-pointer text-sm font-medium">Add a related document</summary>
        <form action={addRelatedDocWithId} className="mt-3 space-y-3">
          <div>
            <label htmlFor={`related-add-${securityInstrumentId}-type`} className="block text-sm font-medium">
              Type
            </label>
            <select id={`related-add-${securityInstrumentId}-type`} name="type" value={addType} onChange={(e) => setAddType(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
              {RELATED_DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <RelatedDocFields idPrefix={`related-add-${securityInstrumentId}`} type={addType} />
          <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
            Add
          </button>
        </form>
      </details>
    </div>
  )
}

export function SecurityInstrumentsSection({
  orderId,
  prelimSearchId,
  securityInstruments,
  relatedDocs,
}: {
  orderId: string
  prelimSearchId: string | null
  securityInstruments: SecurityInstrument[]
  relatedDocs: SecurityInstrumentRelatedDoc[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const addSecurityInstrumentWithIds = prelimSearchId ? addSecurityInstrument.bind(null, prelimSearchId, orderId) : null

  return (
    <section id="security-instruments" className="scroll-mt-20 border-b py-8">
      <h2 className="mb-4 text-xl font-semibold">Security Instruments</h2>

      <ul className="mb-6 space-y-4" data-testid="si-list">
        {securityInstruments.map((si) =>
          editingId === si.id ? (
            <li key={si.id} className="rounded border p-4" data-testid="si-row">
              <form
                action={async (formData: FormData) => {
                  await updateSecurityInstrument(orderId, si.id, formData)
                  setEditingId(null)
                }}
                className="space-y-4"
              >
                <SIFields idPrefix={`si-edit-${si.id}`} record={si} />
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
            <li key={si.id} className="rounded border p-4" data-testid="si-row">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {si.type} — {si.mortgagor || '(mortgagor unknown)'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {si.mortgagee}
                    {si.original_amount ? ` · ${si.original_amount}` : ''}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setEditingId(si.id)} className="text-sm text-slate-600 hover:underline">
                    Edit
                  </button>
                  <form action={deleteSecurityInstrument.bind(null, orderId, si.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
              <RelatedDocsList orderId={orderId} securityInstrumentId={si.id} docs={relatedDocs.filter((d) => d.security_instrument_id === si.id)} />
            </li>
          )
        )}
        {securityInstruments.length === 0 && <p className="text-sm text-slate-500">No Security Instruments on file — add one below.</p>}
      </ul>

      {addSecurityInstrumentWithIds ? (
        <details className="rounded border p-4">
          <summary className="cursor-pointer font-medium">Add a Security Instrument</summary>
          <form action={addSecurityInstrumentWithIds} className="mt-4 space-y-4">
            <SIFields idPrefix="si-add" />
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
              Add Security Instrument
            </button>
          </form>
        </details>
      ) : (
        <p className="text-sm text-slate-500">Save Derivation first before adding Security Instruments.</p>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/prelim-search/SecurityInstrumentsSection.tsx
git commit -m "feat: add SecurityInstrumentsSection component"
```

---

### Task 6: LiensSection

**Suggested model:** sonnet (per-type field reshaping across 9 types — the most conditional-logic-heavy component)

**Files:**
- Create: `src/components/prelim-search/LiensSection.tsx`

**Interfaces:**
- Consumes: `addLien`/`updateLien`/`deleteLien` (Task 3), `LIEN_TYPES`/`TAX_LIEN_TYPES` (Task 2), `Lien` (Task 2).
- Produces: `LiensSection({ orderId, prelimSearchId, liens })` — Client Component, self-contained `<section id="liens">`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/prelim-search/LiensSection.tsx
'use client'

import { useState } from 'react'
import { LIEN_TYPES, TAX_LIEN_TYPES } from '@/lib/constants'
import { addLien, updateLien, deleteLien } from '@/app/actions/prelim-search'
import type { Lien } from '@/lib/types'

type LienFieldConfig = { key: keyof Lien; label: string; type?: 'date' | 'select'; options?: readonly string[] }

const LIEN_DEFAULT_FIELDS: LienFieldConfig[] = [
  { key: 'debtor', label: 'Debtor' },
  { key: 'creditor', label: 'Creditor' },
  { key: 'dated_date', label: 'Dated Date', type: 'date' },
  { key: 'recorded_date', label: 'Recorded/Filed Date', type: 'date' },
  { key: 'court', label: 'Court' },
  { key: 'case_number', label: 'Case/Reference No.' },
  { key: 'amount', label: 'Amount' },
]

const LIEN_TYPE_FIELDS: Record<string, LienFieldConfig[]> = {
  Judgment: [
    { key: 'debtor', label: 'Debtor' },
    { key: 'creditor', label: 'Creditor' },
    { key: 'docket_date', label: 'Docket Date', type: 'date' },
    { key: 'case_number', label: 'Case Number' },
    { key: 'court', label: 'Court' },
    { key: 'amount', label: 'Amount' },
  ],
  'Tax Lien': [
    { key: 'debtor', label: 'Debtor' },
    { key: 'taxing_authority', label: 'Taxing Authority' },
    { key: 'tax_type', label: 'Tax Type', type: 'select', options: TAX_LIEN_TYPES },
    { key: 'filed_date', label: 'Filed Date', type: 'date' },
    { key: 'amount', label: 'Amount' },
    { key: 'book', label: 'Book' },
    { key: 'page', label: 'Page' },
    { key: 'instrument_number', label: 'Instrument' },
  ],
  'HOA/COA Lien': [
    { key: 'debtor', label: 'Debtor' },
    { key: 'hoa_company', label: 'HOA/COA Company' },
    { key: 'filed_date', label: 'Filed Date', type: 'date' },
    { key: 'amount', label: 'Amount' },
    { key: 'book', label: 'Book' },
    { key: 'page', label: 'Page' },
    { key: 'instrument_number', label: 'Instrument' },
  ],
  'Mechanics Lien': [
    { key: 'debtor', label: 'Debtor' },
    { key: 'materialman', label: 'Materialman' },
    { key: 'last_service_date', label: 'Date of Last Service/Furnishing', type: 'date' },
    { key: 'recorded_date', label: 'Recorded Date', type: 'date' },
    { key: 'amount', label: 'Amount' },
    { key: 'book', label: 'Book' },
    { key: 'page', label: 'Page' },
    { key: 'instrument_number', label: 'Instrument' },
  ],
  'Lis Pendens': [
    { key: 'plaintiff', label: 'Plaintiff' },
    { key: 'defendant', label: 'Defendant' },
    { key: 'court', label: 'Court' },
    { key: 'case_number', label: 'Case Number' },
  ],
  'Tax Sale Certificate': [
    { key: 'certificate_id', label: 'Certificate ID' },
    { key: 'dated_date', label: 'Dated Date', type: 'date' },
    { key: 'recorded_date', label: 'Recorded Date', type: 'date' },
    { key: 'debtor', label: 'Debtor' },
    { key: 'creditor', label: 'Creditor' },
    { key: 'book', label: 'Book' },
    { key: 'page', label: 'Page' },
    { key: 'instrument_number', label: 'Instrument' },
    { key: 'redemption_expiration', label: 'Redemption Period Expiration', type: 'date' },
  ],
}

function lienFieldsFor(type: string): LienFieldConfig[] {
  return LIEN_TYPE_FIELDS[type] ?? LIEN_DEFAULT_FIELDS
}

function LienFields({ idPrefix, type, record }: { idPrefix: string; type: string; record?: Lien }) {
  return (
    <>
      {lienFieldsFor(type).map((f) => {
        const id = `lien-${idPrefix}-${f.key}`
        return (
          <div key={f.key}>
            <label htmlFor={id} className="block text-sm font-medium">
              {f.label}
            </label>
            {f.type === 'select' ? (
              <select id={id} name={f.key} defaultValue={(record?.[f.key] as string) ?? ''} className="mt-1 w-full rounded border px-3 py-2">
                <option value="">— Select —</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input id={id} name={f.key} type={f.type === 'date' ? 'date' : 'text'} defaultValue={(record?.[f.key] as string) ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
            )}
          </div>
        )
      })}
    </>
  )
}

function lienTitle(l: Lien): string {
  switch (l.type) {
    case 'Judgment':
      return `${l.type}: ${l.creditor || '(creditor unknown)'} v. ${l.debtor || '(debtor unknown)'}`
    case 'Tax Lien':
      return `${l.type}: ${l.taxing_authority || '(taxing authority unknown)'} v. ${l.debtor || '(debtor unknown)'}`
    case 'HOA/COA Lien':
      return `${l.type}: ${l.hoa_company || '(HOA/COA unknown)'} v. ${l.debtor || '(debtor unknown)'}`
    case 'Mechanics Lien':
      return `${l.type}: ${l.materialman || '(materialman unknown)'} v. ${l.debtor || '(debtor unknown)'}`
    case 'Lis Pendens':
      return `${l.type}: ${l.plaintiff || '(plaintiff unknown)'} v. ${l.defendant || '(defendant unknown)'}`
    case 'Tax Sale Certificate':
      return `${l.type}${l.certificate_id ? ' #' + l.certificate_id : ''}`
    default:
      return `${l.type}: ${l.creditor || l.debtor || '(no description)'}`
  }
}

export function LiensSection({ orderId, prelimSearchId, liens }: { orderId: string; prelimSearchId: string | null; liens: Lien[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingType, setEditingType] = useState<string>(LIEN_TYPES[0])
  const [addType, setAddType] = useState<string>(LIEN_TYPES[0])

  const addLienWithIds = prelimSearchId ? addLien.bind(null, prelimSearchId, orderId) : null

  return (
    <section id="liens" className="scroll-mt-20 border-b py-8">
      <h2 className="mb-4 text-xl font-semibold">Liens</h2>

      <ul className="mb-6 space-y-2" data-testid="lien-list">
        {liens.map((l) =>
          editingId === l.id ? (
            <li key={l.id} className="rounded border p-4" data-testid="lien-row">
              <form
                action={async (formData: FormData) => {
                  await updateLien(orderId, l.id, formData)
                  setEditingId(null)
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="lien-type-edit" className="block text-sm font-medium">
                    Type
                  </label>
                  <select id="lien-type-edit" name="type" value={editingType} onChange={(e) => setEditingType(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
                    {LIEN_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <LienFields idPrefix={`edit-${l.id}`} type={editingType} record={l} />
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
            <li key={l.id} className="flex items-center justify-between rounded border p-3" data-testid="lien-row">
              <p className="font-medium">{lienTitle(l)}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingType(l.type)
                    setEditingId(l.id)
                  }}
                  className="text-sm text-slate-600 hover:underline"
                >
                  Edit
                </button>
                <form action={deleteLien.bind(null, orderId, l.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {liens.length === 0 && <p className="text-sm text-slate-500">No liens on file — add one below.</p>}
      </ul>

      {addLienWithIds ? (
        <details className="rounded border p-4">
          <summary className="cursor-pointer font-medium">Add a lien</summary>
          <form action={addLienWithIds} className="mt-4 space-y-4">
            <div>
              <label htmlFor="lien-type-add" className="block text-sm font-medium">
                Type
              </label>
              <select id="lien-type-add" name="type" value={addType} onChange={(e) => setAddType(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
                {LIEN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <LienFields idPrefix="add" type={addType} />
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
              Add Lien
            </button>
          </form>
        </details>
      ) : (
        <p className="text-sm text-slate-500">Save Derivation first before adding liens.</p>
      )}
    </section>
  )
}
```

Note: `LienFields`' `idPrefix` prop keeps ids unique between the add form and any open edit form (`lien-add-debtor` vs. `lien-edit-<id>-debtor`) — without it, two simultaneously-rendered forms sharing field keys (e.g. both a Judgment add form and a Judgment edit form open at once) would produce duplicate DOM ids and break label association / Playwright's `getByLabel`.

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/prelim-search/LiensSection.tsx
git commit -m "feat: add LiensSection component with per-type field reshaping"
```

---

### Task 7: ExceptionMattersSection

**Suggested model:** haiku (simple repeatable list, pattern already established by Tasks 4-6)

**Files:**
- Create: `src/components/prelim-search/ExceptionMattersSection.tsx`

**Interfaces:**
- Consumes: `addExceptionMatter`/`updateExceptionMatter`/`deleteExceptionMatter` (Task 3), `ExceptionMatter` (Task 2).
- Produces: `ExceptionMattersSection({ orderId, prelimSearchId, exceptionMatters })` — Client Component, self-contained `<section id="exception-matters">`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/prelim-search/ExceptionMattersSection.tsx
'use client'

import { useState } from 'react'
import { addExceptionMatter, updateExceptionMatter, deleteExceptionMatter } from '@/app/actions/prelim-search'
import type { ExceptionMatter } from '@/lib/types'

function ExceptionMatterFields({ idPrefix, record }: { idPrefix: string; record?: ExceptionMatter }) {
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-description`} className="block text-sm font-medium">
          Description
        </label>
        <textarea id={`${idPrefix}-description`} name="description" rows={2} defaultValue={record?.description ?? undefined} className="mt-1 w-full rounded border px-3 py-2" />
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

export function ExceptionMattersSection({
  orderId,
  prelimSearchId,
  exceptionMatters,
}: {
  orderId: string
  prelimSearchId: string | null
  exceptionMatters: ExceptionMatter[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const addExceptionMatterWithIds = prelimSearchId ? addExceptionMatter.bind(null, prelimSearchId, orderId) : null

  return (
    <section id="exception-matters" className="scroll-mt-20 py-8">
      <h2 className="mb-4 text-xl font-semibold">Exception Matters</h2>

      <ul className="mb-6 space-y-2" data-testid="exception-matter-list">
        {exceptionMatters.map((e) =>
          editingId === e.id ? (
            <li key={e.id} className="rounded border p-4" data-testid="exception-matter-row">
              <form
                action={async (formData: FormData) => {
                  await updateExceptionMatter(orderId, e.id, formData)
                  setEditingId(null)
                }}
                className="space-y-4"
              >
                <ExceptionMatterFields idPrefix={`em-edit-${e.id}`} record={e} />
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
            <li key={e.id} className="flex items-center justify-between rounded border p-3" data-testid="exception-matter-row">
              <p>{e.description}</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingId(e.id)} className="text-sm text-slate-600 hover:underline">
                  Edit
                </button>
                <form action={deleteExceptionMatter.bind(null, orderId, e.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {exceptionMatters.length === 0 && <p className="text-sm text-slate-500">No Exception Matters on file — add one below.</p>}
      </ul>

      {addExceptionMatterWithIds ? (
        <details className="rounded border p-4">
          <summary className="cursor-pointer font-medium">Add an Exception Matter</summary>
          <form action={addExceptionMatterWithIds} className="mt-4 space-y-4">
            <ExceptionMatterFields idPrefix="em-add" />
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
              Add Exception Matter
            </button>
          </form>
        </details>
      ) : (
        <p className="text-sm text-slate-500">Save Derivation first before adding Exception Matters.</p>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/prelim-search/ExceptionMattersSection.tsx
git commit -m "feat: add ExceptionMattersSection component"
```

---

### Task 8: Route page, sticky anchor nav, and nav wiring

**Suggested model:** sonnet (orchestrates data-fetching and composition across all 4 sections)

**Files:**
- Create: `src/app/orders/[id]/prelim-search/page.tsx`
- Modify: `src/components/FileSectionsNav.tsx` (Prelim Title Search item gains `segment: 'prelim-search'`)
- Modify: `src/app/globals.css` (append `scroll-behavior: smooth`)

**Interfaces:**
- Consumes: `DerivationSection` (Task 4), `SecurityInstrumentsSection` (Task 5), `LiensSection` (Task 6), `ExceptionMattersSection` (Task 7), `upsertPrelimSearch` (Task 3), all types from Task 2.

- [ ] **Step 1: Wire the nav item**

In `src/components/FileSectionsNav.tsx`, change:

```tsx
{ label: 'Prelim Title Search' },
```

to:

```tsx
{ label: 'Prelim Title Search', segment: 'prelim-search' },
```

- [ ] **Step 2: Add smooth scrolling for the anchor nav**

Append to `src/app/globals.css`:

```css
html {
  scroll-behavior: smooth;
}
```

- [ ] **Step 3: Create the route page**

```tsx
// src/app/orders/[id]/prelim-search/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { upsertPrelimSearch } from '@/app/actions/prelim-search'
import { DerivationSection } from '@/components/prelim-search/DerivationSection'
import { SecurityInstrumentsSection } from '@/components/prelim-search/SecurityInstrumentsSection'
import { LiensSection } from '@/components/prelim-search/LiensSection'
import { ExceptionMattersSection } from '@/components/prelim-search/ExceptionMattersSection'

export default async function PrelimSearchPage({
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

  const { data: property } = await supabase.from('property_details').select('county').eq('order_id', id).maybeSingle()
  const { data: prelim } = await supabase.from('prelim_search').select('*').eq('order_id', id).maybeSingle()
  const prelimSearchId = prelim?.id ?? null

  const [
    { data: granteePrincipals },
    { data: grantorPrincipals },
    { data: securityInstruments },
    { data: liens },
    { data: exceptionMatters },
  ] = prelimSearchId
    ? await Promise.all([
        supabase.from('derivation_principals').select('*').eq('prelim_search_id', prelimSearchId).eq('side', 'grantee').order('created_at'),
        supabase.from('derivation_principals').select('*').eq('prelim_search_id', prelimSearchId).eq('side', 'grantor').order('created_at'),
        supabase.from('security_instruments').select('*').eq('prelim_search_id', prelimSearchId).order('created_at'),
        supabase.from('liens').select('*').eq('prelim_search_id', prelimSearchId).order('created_at'),
        supabase.from('exception_matters').select('*').eq('prelim_search_id', prelimSearchId).order('created_at'),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const siIds = (securityInstruments ?? []).map((si) => si.id)
  const { data: relatedDocs } = siIds.length
    ? await supabase.from('security_instrument_related_docs').select('*').in('security_instrument_id', siIds).order('created_at')
    : { data: [] }

  const upsertPrelimSearchWithId = upsertPrelimSearch.bind(null, id)

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <nav className="sticky top-0 z-10 mb-6 flex gap-4 border-b bg-white py-2 text-sm" data-testid="prelim-anchor-nav">
        <a href="#derivation" className="text-slate-600 hover:text-slate-900">
          Derivation
        </a>
        <a href="#security-instruments" className="text-slate-600 hover:text-slate-900">
          Security Instruments
        </a>
        <a href="#liens" className="text-slate-600 hover:text-slate-900">
          Liens
        </a>
        <a href="#exception-matters" className="text-slate-600 hover:text-slate-900">
          Exception Matters
        </a>
      </nav>

      <DerivationSection
        action={upsertPrelimSearchWithId}
        orderId={id}
        prelim={prelim}
        county={property?.county ?? null}
        granteePrincipals={granteePrincipals ?? []}
        grantorPrincipals={grantorPrincipals ?? []}
      />
      <SecurityInstrumentsSection
        orderId={id}
        prelimSearchId={prelimSearchId}
        securityInstruments={securityInstruments ?? []}
        relatedDocs={relatedDocs ?? []}
      />
      <LiensSection orderId={id} prelimSearchId={prelimSearchId} liens={liens ?? []} />
      <ExceptionMattersSection orderId={id} prelimSearchId={prelimSearchId} exceptionMatters={exceptionMatters ?? []} />
    </div>
  )
}
```

- [ ] **Step 4: Manual smoke check**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run dev -- -p 3100 > /tmp/genesis-prelim-task8-dev.log 2>&1 &
sleep 4
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/orders/new
kill %1 2>/dev/null || true
```

Expected: `200` (confirms the app boots and the new route's imports resolve without a runtime error; the full functional flow is exercised in Task 9's E2E test).

- [ ] **Step 5: Build check**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/FileSectionsNav.tsx src/app/globals.css "src/app/orders/[id]/prelim-search/page.tsx"
git commit -m "feat: wire Prelim Title Search route, anchor nav, and File Sections nav"
```

---

### Task 9: E2E test suite extension

**Suggested model:** sonnet (test design needs judgment about coverage and label-ambiguity scoping)

**Files:**
- Modify: `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: the full built feature from Tasks 1-8.

- [ ] **Step 1: Add the test**

Append to `tests/e2e/order-entry.spec.ts`:

```ts
  test('prelim title search: derivation, security instruments, liens, exception matters, real property taxes', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')

    // Derivation + Real Property Taxes (one shared form)
    await page.getByLabel('Instrument Type').selectOption('Warranty Deed')
    await page.getByLabel('Recorded Date').first().fill('2020-01-15')
    await page.getByLabel('Grantee Name').fill('Test Holdings LLC')
    await page.getByLabel('Grantee Entity Type').selectOption('LLC')
    await page.getByLabel('Grantor Name').fill('Original Grantor')
    await page.getByLabel('Taxes Paid Through Year').fill('2023')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')

    await expect(page.getByLabel('Grantee Name')).toHaveValue('Test Holdings LLC')
    await expect(page.getByLabel('Taxes Paid Through Year')).toHaveValue('2023')

    // Grantee Principal roster becomes available once Grantee Entity Type is LLC and saved
    await page.getByText('Add a grantee principal').click()
    await page.locator('[data-testid="grantee-principal-list"]').locator('..').getByPlaceholder('Name').fill('Jane Member')
    await page.locator('details:has-text("Add a grantee principal")').getByRole('button', { name: 'Add' }).click()
    await expect(page.getByTestId('grantee-principal-row')).toContainText('Jane Member')

    // Vesting clause now reflects the LLC + its principal
    await expect(page.getByTestId('vesting-clause')).toContainText('Test Holdings LLC')

    // Security Instruments + nested Related Documents
    await page.getByRole('button', { name: 'Add a Security Instrument' }).click()
    const siForm = page.locator('details:has-text("Add a Security Instrument")')
    await siForm.getByLabel('Type').selectOption('Deed of Trust')
    await siForm.getByLabel('Mortgagor').fill('Test Holdings LLC')
    await siForm.getByLabel('Mortgagee').fill('Test Lender')
    await siForm.getByRole('button', { name: 'Add Security Instrument' }).click()
    await expect(page.getByTestId('si-row')).toContainText('Deed of Trust')

    const siRow = page.getByTestId('si-row').first()
    await siRow.getByText('Add a related document').click()
    const relatedForm = siRow.locator('details:has-text("Add a related document")')
    await relatedForm.getByLabel('Type').selectOption('Assignment')
    await expect(relatedForm.getByLabel('Assignor')).toBeVisible()
    await relatedForm.getByLabel('Assignor').fill('Test Lender')
    await relatedForm.getByLabel('Assignee').fill('Assignee Bank')
    await relatedForm.getByRole('button', { name: 'Add' }).click()
    await expect(siRow.getByTestId('related-doc-row')).toContainText('Assignment')
    await expect(siRow.getByTestId('related-doc-row')).toContainText('Test Lender → Assignee Bank')

    // A non-assignment related doc type should NOT show Assignor/Assignee
    await siRow.getByText('Add a related document').click()
    const relatedForm2 = siRow.locator('details:has-text("Add a related document")')
    await relatedForm2.getByLabel('Type').selectOption('Substitution of Trustee')
    await expect(relatedForm2.getByLabel('Assignor')).not.toBeVisible()

    // Liens: add one of each of a few distinct per-type shapes
    await page.getByRole('button', { name: 'Add a lien' }).click()
    const lienForm = page.locator('details:has-text("Add a lien")')
    await lienForm.getByLabel('Type').selectOption('Judgment')
    await lienForm.getByLabel('Debtor').fill('Test Debtor')
    await lienForm.getByLabel('Creditor').fill('Test Creditor')
    await lienForm.getByLabel('Case Number').fill('CV-2024-001')
    await lienForm.getByRole('button', { name: 'Add Lien' }).click()
    await expect(page.getByTestId('lien-row')).toContainText('Test Creditor v. Test Debtor')

    await page.getByText('Add a lien').click()
    const lienForm2 = page.locator('details:has-text("Add a lien")')
    await lienForm2.getByLabel('Type').selectOption('Tax Lien')
    await expect(lienForm2.getByLabel('Tax Type')).toBeVisible()
    await expect(lienForm2.getByLabel('Case Number')).not.toBeVisible()
    await lienForm2.getByLabel('Debtor').fill('Test Debtor 2')
    await lienForm2.getByLabel('Taxing Authority').fill('IRS')
    await lienForm2.getByLabel('Tax Type').selectOption('Income')
    await lienForm2.getByRole('button', { name: 'Add Lien' }).click()
    await expect(page.getByTestId('lien-list').getByTestId('lien-row')).toHaveCount(2)

    // Edit the Judgment lien via its Edit link, confirm Save persists and Cancel discards
    const judgmentRow = page.getByTestId('lien-row').filter({ hasText: 'Test Creditor v. Test Debtor' }).first()
    await judgmentRow.getByRole('button', { name: 'Edit' }).click()
    const editForm = page.locator('li:has-text("Test Creditor")').locator('form')
    await editForm.getByLabel('Amount').fill('5000')
    await editForm.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('lien-list')).not.toContainText('Cancel')

    // Exception Matters
    await page.getByText('Add an Exception Matter').click()
    const emForm = page.locator('details:has-text("Add an Exception Matter")')
    await emForm.getByLabel('Description').fill('Utility easement in favor of test utility company')
    await emForm.getByRole('button', { name: 'Add Exception Matter' }).click()
    await expect(page.getByTestId('exception-matter-row')).toContainText('Utility easement in favor of test utility company')

    // Reload and confirm full persistence
    await page.reload()
    await expect(page.getByLabel('Grantee Name')).toHaveValue('Test Holdings LLC')
    await expect(page.getByTestId('grantee-principal-row')).toContainText('Jane Member')
    await expect(page.getByTestId('si-row')).toContainText('Deed of Trust')
    await expect(page.getByTestId('lien-list').getByTestId('lien-row')).toHaveCount(2)
    await expect(page.getByTestId('exception-matter-row')).toContainText('Utility easement in favor of test utility company')
  })
```

- [ ] **Step 2: Run the full suite and verify**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run dev -- -p 3100 > /tmp/genesis-prelim-task9-dev.log 2>&1 &
sleep 4
PLAYWRIGHT_BASE_URL="http://localhost:3100" npm run test:e2e
```

Expected: all 11 tests PASS (10 existing + 1 new). Kill the dev server before finishing. If any locator is ambiguous (Playwright strict-mode violation), scope it further to the relevant `data-testid` container rather than loosening the assertion.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/order-entry.spec.ts
git commit -m "test: add Prelim Title Search E2E coverage"
```

---

### Task 10: Final verification, deploy check, and vault sync

**Suggested model:** sonnet (final gate before deploy — same treatment as prior increments' final task)

**Files:**
- No new files — build/lint/test verification, deployment smoke check, and housekeeping.

- [ ] **Step 1: Full local verification**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run lint
npm run build
```

Expected: both clean. If `npm run lint` shows hundreds of errors pointing into a `.worktrees/**` path, that's the known ESLint ignore-pattern bug (see [[Open Items & Parking Lot]] item 4) — fully remove the SDD worktree (`git worktree remove`, `git worktree prune`, `git branch -d`) before re-running lint on `main`, don't try to fix the errors themselves.

- [ ] **Step 2: Push and confirm the Vercel auto-deploy**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git fetch origin && git status
git push origin main
```

Wait for the deploy, then:

```bash
PLAYWRIGHT_BASE_URL="https://genesis-app-tau.vercel.app" npx playwright test
```

Expected: all 11 tests PASS against the live deployment.

- [ ] **Step 3: Update the vault**

In `M&L Title/M&L Title - Obsidian Vault/Genesis Build Log.md`, add a change-log entry: Prelim Title Search & Opinion shipped (Derivation with generated Vesting/Derivation clauses, Security Instruments + Related Documents, Liens with 9-type field reshaping, Exception Matters, Real Property Taxes), note the mid-planning correction (dropdown values re-verified against prototype source after an earlier extraction pass drifted), commit range, 11/11 E2E passing locally and live.

In `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Prelim Title Search Design.md`, change frontmatter `status:` from `design complete — pending implementation` to `implemented`.

- [ ] **Step 4: Re-sync T7 → Desktop backup and verify**

```bash
rsync -av --delete "/Volumes/T7/Claude Code/Genesis Platform/" "/Users/campenny/Desktop/Claude Code/Genesis Platform/"
bash "/Volumes/T7/Claude Code/Genesis Platform/.claude/hooks/verify-sync.sh"
```

Expected: T7 == Desktop == `github/main`, byte-identical roots.

---

## Self-Review

**Spec coverage:** Derivation header + record fields, generated Vesting/Derivation clauses, standalone Principal rosters (auto-fill from Contacts explicitly deferred) — Task 4 ✓. Security Instruments + nested Related Documents with conditional Assignor/Assignee — Task 5 ✓. Liens with all 9 types' verified per-type field reshaping — Task 6 ✓. Exception Matters — Task 7 ✓. Real Property Taxes folded into Derivation's form — Task 4 ✓. Schema matches the corrected design doc exactly — Task 1 ✓. Sticky anchor nav (4 targets, plain links, no scroll-spy) — Task 8 ✓. Nav wiring — Task 8 Step 1 ✓. All dead/legacy prototype fields (`mortgages`, `otherLiens`, `judgments` arrays; the legacy Assignment/Loan Modification Agreement lien-type field shapes) correctly excluded — never referenced anywhere in this plan ✓.

**Placeholder scan:** No TBD/TODO. Every dropdown value list and per-type field mapping was re-verified against the prototype's actual source before being written into schema/constants — see the Global Constraints note on this.

**Type consistency:** `PrelimSearch`/`DerivationPrincipal`/`SecurityInstrument`/`SecurityInstrumentRelatedDoc`/`Lien`/`ExceptionMatter` (Task 2) field names match the migration's column names exactly (Task 1) and every form's `name`/`id` attributes exactly (Tasks 4-7). Server action signatures (`addDerivationPrincipal(prelimSearchId, orderId, side, formData)`, `addSecurityInstrument(prelimSearchId, orderId, formData)`, `addRelatedDoc(securityInstrumentId, orderId, formData)`, `addLien(prelimSearchId, orderId, formData)`, `addExceptionMatter(prelimSearchId, orderId, formData)`, and their `update`/`delete` counterparts — Task 3) match their `.bind()` call sites in Tasks 4-7 exactly. Each section component's prop shape matches exactly what `page.tsx` passes in Task 8. The `idPrefix` discipline in `LienFields`/`RelatedDocFields`/`SIFields`/`ExceptionMatterFields` (Tasks 5-7) is applied consistently everywhere an add form and an edit form can be open on screen at the same time, preventing duplicate-DOM-id bugs.
