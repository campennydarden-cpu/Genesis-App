# Prelim Title Search & Opinion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Prelim Title Search & Opinion File Section — the first of four Title nav-group screens — porting the proven data model and interaction pattern from the old prototype (`genesis-github-push/genesis-app.html`) into the real `genesis-app` (Next.js/Supabase) stack.

**Architecture:** One scrolling File Section page (`/orders/[id]/prelim-search`) with a sticky server-rendered anchor nav (Derivation, Security Instruments, Liens, Exception Matters). Derivation is one shared form (header + record + Real Property Taxes, all on the same `prelim_search` row) plus two standalone Principal rosters (Grantee/Grantor) with independent add/edit/delete. Security Instruments, Liens, and Exception Matters are each a repeatable list with a consistent pencil-icon inline-edit pattern; Related Documents nest under each Security Instrument the same way. Two pure functions (ported byte-faithful from the prototype's `entityQualifiedName`/`fullDerivationClause`) compute a read-only Vesting Clause / Derivation Clause preview from the saved record — nothing generated is stored in the database.

**Tech Stack:** Next.js 16.3.3 (App Router, Server Actions, React 19), Supabase (Postgres + `@supabase/ssr`), Tailwind CSS 4, shadcn/ui (new to this repo — installed in Task 1), Playwright for e2e (no unit-test framework exists in this repo; all testing follows the existing e2e-only convention against the real seeded Supabase project).

**Spec:** `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Prelim Title Search Design.md`

## Global Constraints

- Migrations use `text` columns + `check (col in (...))` for enums, native `date`/`time`/`numeric(14,2)` for their respective field kinds, never a native Postgres `enum` type — matches `0001_foundation_schema.sql` and `0002_property_details.sql`.
- Every table gets `id uuid primary key default gen_random_uuid()`, RLS enabled, and an explicit `for all to authenticated using (true) with check (true)` policy — single-tenant, matches every existing table. No table ships without RLS.
- Server actions are `'use server'` files under `src/app/actions/`, use `createClient()` from `@/lib/supabase/server`, and on a Supabase error `redirect` back to the same page with `?error=<generic message>` plus `console.error` server-side — never a raw DB error surfaced to the user. Matches `src/app/actions/property.ts`.
- Money fields use `type="number" step="0.01"` inputs and `field ? Number(field) : null` parsing server-side — matches `purchase_price`/`loan_amount` in `src/app/actions/orders.ts`. Never a currency-formatting library (none installed, not needed).
- No unit-test framework exists in this repo (no vitest/jest in `package.json`) — all new logic is covered via Playwright e2e against the real dev server and the real seeded Supabase project (`genesis-e2e-seed@genesis-app-e2e-test.dev` / `E2eSeedPass123!`), matching `tests/e2e/order-entry.spec.ts`'s existing convention. Do not introduce a unit-test framework as part of this plan.
- shadcn/ui is the locked component library (`design-system/MASTER.md`) but is not yet installed in this repo — Task 1 installs it. Every new component in this plan uses real shadcn primitives (Input, Select, Textarea, Checkbox, Button, Label), not hand-rolled `<input>`/`<select>` markup, per `genesis-app/CLAUDE.md`'s standing instruction that UI component choice is not Ponytail's to relitigate. If `components.json` already exists when Task 1 runs (e.g. a different plan installed shadcn first), skip `init` and only add any primitives listed in Task 1 that aren't already present in `src/components/ui/`.
- `contacts.role` is free text (no enum) — this plan doesn't touch Contacts at all, but note for later plans (Commitment Schedule A) that seed-chip matching against `role` must be substring/case-insensitive, not an exact enum comparison.
- Real Property Taxes is **not** a separate top-level section — it's folded into the end of the Derivation form and lives on the same `prelim_search` row (see design doc's "Corrected during planning" note: two independent `<form>`s hitting the same upsert action would null out whichever form wasn't submitted). The anchor nav has 4 targets (Derivation, Security Instruments, Liens, Exception Matters), not 5.
- The sticky anchor nav is plain server-rendered `<a href="#section-id">` with CSS `scroll-behavior: smooth` — no client-side scroll-spy, no separate client-shell component. `page.tsx` renders it directly as a Server Component.
- Suggested model tier per task is a comment under that task's heading (`_Model: haiku|sonnet_`), carried over from the prior two increments' cost-discipline convention — mechanical/small tasks on haiku, complex work on sonnet, no opus.

---

## Task 1: Install shadcn/ui and scaffold the primitives this plan needs

_Model: haiku_

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/select.tsx`, `src/components/ui/checkbox.tsx`, `src/components/ui/label.tsx`
- Modify: `package.json`, `package-lock.json`, `src/app/globals.css`

**Interfaces:**
- Produces: `Button`, `Input`, `Textarea`, `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`/`SelectValue`, `Checkbox`, `Label` — used by every later task in this plan.

- [ ] **Step 1: Check whether shadcn is already installed**

Run: `test -f "/Volumes/T7/Claude Code/Genesis Platform/genesis-app/components.json" && echo EXISTS || echo MISSING`

If `EXISTS`, skip Step 2 and go straight to Step 3 (add any primitives not already in `src/components/ui/`).

- [ ] **Step 2: Run the shadcn init**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npx shadcn@latest init -d
```

Accept the defaults it infers from `postcss.config.mjs`/`globals.css` (Next.js App Router, Tailwind CSS 4, `src/` directory, `@/*` alias already in `tsconfig.json`). This creates `components.json` and `src/lib/utils.ts` (the `cn()` helper) and wires Tailwind v4 theme tokens into `globals.css`.

- [ ] **Step 3: Add the primitives this plan needs**

```bash
npx shadcn@latest add button input textarea select checkbox label
```

- [ ] **Step 4: Apply the Design System's color/typography tokens**

Open `src/app/globals.css`. The shadcn init writes its own `--color-*` CSS variables into `:root` and `@theme inline` — replace their **values** (keep the variable names shadcn generated so every shadcn component keeps working) with the palette from `design-system/MASTER.md`:

```css
:root {
  --background: #F8FAFC;
  --foreground: #0F172A;
  --primary: #1E3A8A;
  --primary-foreground: #FFFFFF;
  --secondary: #1E40AF;
  --secondary-foreground: #FFFFFF;
  --accent: #B45309;
  --accent-foreground: #FFFFFF;
  --destructive: #DC2626;
  --destructive-foreground: #FFFFFF;
  --card: #FFFFFF;
  --card-foreground: #0F172A;
  --muted: #E9EEF5;
  --muted-foreground: #475569;
  --border: #CBD5E1;
  --ring: #1E3A8A;
}
```

Keep whatever other shadcn-generated variables exist (`--radius`, etc.) — only replace the color values above, matching whatever variable names `shadcn init` actually generated in Step 2 (shadcn's default variable names for Tailwind v4 are exactly these `--primary`/`--secondary`/`--accent`/`--destructive`/`--card`/`--muted`/`--border`/`--ring` pairs; if `init` produced different names, use those names with these values instead).

Add the font import at the top of `globals.css`, above the `@import "tailwindcss"` line:

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap');
```

And set it as the body font (replace the existing `font-family: Arial, Helvetica, sans-serif;` rule):

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: 'Plus Jakarta Sans', Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 5: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add components.json src/lib/utils.ts src/components/ui package.json package-lock.json src/app/globals.css
git commit -m "chore: install shadcn/ui and apply Genesis design-system tokens"
```

---

## Task 2: Migration — `prelim_search` and its five related tables

_Model: haiku_

**Files:**
- Create: `supabase/migrations/0003_prelim_search.sql`

**Interfaces:**
- Produces: tables `public.prelim_search(id, order_id, effective_date, effective_time, search_from_date, search_to_date, search_to_time, search_type, derivation_instrument_type, derivation_dated_date, derivation_recorded_date, derivation_book, derivation_page, derivation_instrument_number, derivation_consideration, derivation_grantee_name, derivation_grantee_entity_type, derivation_grantor_name, derivation_grantor_entity_type, derivation_is_portion, derivation_note, taxes_paid_through_year, taxes_now_due, taxes_not_yet_due, special_levies_assessments, created_at, updated_at)`, `public.derivation_principals(id, prelim_search_id, side, name, role, created_at)`, `public.security_instruments(id, prelim_search_id, type, dated_date, recorded_date, book, page, instrument_number, original_amount, mortgagor, mortgagee, trustee, created_at)`, `public.security_instrument_related_docs(id, security_instrument_id, type, dated_date, recorded_date, book, page, instrument_number, assignor, assignee, notes, created_at)`, `public.liens(id, prelim_search_id, type, dated_date, recorded_date, book, page, instrument_number, amount, debtor, creditor, docket_date, case_number, court, taxing_authority, tax_type, filed_date, hoa_company, materialman, last_service_date, plaintiff, defendant, certificate_id, redemption_expiration, created_at)`, `public.exception_matters(id, prelim_search_id, description, dated_date, recorded_date, book, page, instrument_number, created_at)`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0003_prelim_search.sql

create table public.prelim_search (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  effective_date date,
  effective_time time,
  search_from_date date,
  search_to_date date,
  search_to_time time,
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
  derivation_consideration numeric(14,2),
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
  type text not null check (type in ('Mortgage', 'Deed of Trust', 'Security Deed', 'UCC Financing Statement')),
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  original_amount numeric(14,2),
  mortgagor text,
  mortgagee text,
  trustee text,
  created_at timestamptz not null default now()
);

create index security_instruments_prelim_search_id_idx on public.security_instruments(prelim_search_id);

create table public.security_instrument_related_docs (
  id uuid primary key default gen_random_uuid(),
  security_instrument_id uuid not null references public.security_instruments(id) on delete cascade,
  type text not null check (type in (
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

create index security_instrument_related_docs_instrument_id_idx on public.security_instrument_related_docs(security_instrument_id);

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
  amount numeric(14,2),
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
  description text not null,
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

- [ ] **Step 2: Apply the migration to the real Supabase project**

Run (from `genesis-app/`, using whichever Supabase CLI/MCP workflow the prior two migrations used — check `Genesis Build Log.md`'s change log for the exact command if unsure):

```bash
npx supabase db push
```

Expected: no errors; the 6 new tables exist in the `campennydarden-cpu's Project` Supabase instance (ref `hlahrypglnmjjxrdtfkm`).

- [ ] **Step 3: Verify against the live project**

Query the project's table list (via the Supabase MCP `list_tables` tool, or `npx supabase db diff` against remote) and confirm all 6 new tables appear with RLS enabled.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add supabase/migrations/0003_prelim_search.sql
git commit -m "feat: add prelim_search schema (derivation, security instruments, related docs, liens, exception matters)"
```

---

## Task 3: Derivation clause generator — pure functions ported from the prototype

_Model: sonnet_ (faithful port of nontrivial branching logic — worth the extra care)

**Files:**
- Create: `src/lib/derivation-clause.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no DB/network access).
- Produces: `fmtDate(value: string | null): string`, `entityQualifiedName(name: string | null, entityType: EntityType | null, principals: PrincipalRecord[]): string`, `derivationVestingClause(granteeName: string | null, granteeEntityType: EntityType | null, principals: PrincipalRecord[]): string`, `fullDerivationClause(input: DerivationClauseInput, granteePrincipals: PrincipalRecord[], grantorPrincipals: PrincipalRecord[]): string`. Types `EntityType`, `PrincipalRecord`, `DerivationClauseInput` — all consumed by Task 5.

- [ ] **Step 1: Write the module**

This is a byte-faithful TypeScript port of `entityQualifiedName`, `derivationVestingClause`, `fullDerivationClause`, and `fmtDate` as verified directly in the prototype source (`genesis-github-push/genesis-app.html` lines 865–903, 2253–2260) — not re-derived from memory.

```typescript
// src/lib/derivation-clause.ts

export type EntityType = 'Individual' | 'LLC' | 'Corporation' | 'Partnership' | 'Trust' | 'Estate' | 'Other'

export type PrincipalRecord = {
  name: string
  role: string | null
}

export type DerivationClauseInput = {
  granteeName: string | null
  granteeEntityType: EntityType | null
  grantorName: string | null
  grantorEntityType: EntityType | null
  instrumentType: string | null
  recordedDate: string | null
  book: string | null
  page: string | null
  instrumentNumber: string | null
  isPortion: boolean
  county: string | null
}

const ROSTER_ENTITY_TYPES: EntityType[] = ['LLC', 'Corporation', 'Partnership', 'Trust']

/** Formats a `YYYY-MM-DD` date string as "January 5, 2026". Returns '' for falsy input. */
export function fmtDate(value: string | null): string {
  if (!value) return ''
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/**
 * Builds the "qualified name" used in generated clauses: a plain name for
 * Individual/Estate/Other, or an entity-qualified phrase built from the
 * name plus its principal roster for LLC/Corporation/Partnership/Trust.
 */
export function entityQualifiedName(
  name: string | null,
  entityType: EntityType | null,
  principals: PrincipalRecord[]
): string {
  const hasRoster = entityType !== null && ROSTER_ENTITY_TYPES.includes(entityType)
  if (!name && !hasRoster) return name ?? ''

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

/** Vesting Clause — the Grantee's qualified name, or '' if there's nothing to show yet. */
export function derivationVestingClause(
  granteeName: string | null,
  granteeEntityType: EntityType | null,
  principals: PrincipalRecord[]
): string {
  const hasRoster = granteeEntityType !== null && ROSTER_ENTITY_TYPES.includes(granteeEntityType)
  if (!granteeName && !hasRoster) return granteeName ?? ''
  return entityQualifiedName(granteeName, granteeEntityType, principals)
}

/**
 * Full Derivation Clause sentence. Renders '' until Grantee Name, Instrument
 * Type, Grantor Name, Recorded Date, and County are all present.
 */
export function fullDerivationClause(
  input: DerivationClauseInput,
  granteePrincipals: PrincipalRecord[],
  grantorPrincipals: PrincipalRecord[]
): string {
  const {
    granteeName,
    granteeEntityType,
    grantorName,
    grantorEntityType,
    instrumentType,
    recordedDate,
    book,
    page,
    instrumentNumber,
    isPortion,
    county,
  } = input

  if (!(granteeName && instrumentType && grantorName && recordedDate && county)) return ''

  const recordingParts: string[] = []
  if (book || page) recordingParts.push(`Book ${book || '—'}, Page ${page || '—'}`)
  if (instrumentNumber) recordingParts.push(`Instrument No. ${instrumentNumber}`)
  const recording = recordingParts.length ? ` as ${recordingParts.join(', ')}` : ''

  const granteeQualified = entityQualifiedName(granteeName, granteeEntityType, granteePrincipals)
  const grantorQualified = entityQualifiedName(grantorName, grantorEntityType, grantorPrincipals)
  const parcelPhrase = isPortion ? 'Being a portion of the same parcel' : 'Being the same parcel'

  return (
    `${parcelPhrase} conveyed unto ${granteeQualified} by ${instrumentType} of ${grantorQualified}` +
    ` recorded ${fmtDate(recordedDate)}${recording} of the ${county} County records.`
  )
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit` from `genesis-app/`
Expected: no errors referencing `derivation-clause.ts`.

- [ ] **Step 3: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add src/lib/derivation-clause.ts
git commit -m "feat: port Vesting/Derivation Clause generator from the prototype"
```

---

## Task 4: Types and constants for the Prelim Search domain

_Model: haiku_

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/constants.ts`

**Interfaces:**
- Produces: types `PrelimSearch`, `DerivationPrincipal`, `SecurityInstrument`, `SecurityInstrumentRelatedDoc`, `Lien`, `ExceptionMatter`. Constants `DERIVATION_INSTRUMENT_TYPES`, `PRELIM_ENTITY_TYPES`, `PRINCIPAL_ROLES`, `SECURITY_INSTRUMENT_TYPES`, `RELATED_DOC_TYPES`, `RELATED_DOC_ASSIGNMENT_TYPES`, `LIEN_TYPES`, `TAX_LIEN_TYPES`. Consumed by every remaining task.

- [ ] **Step 1: Add types to `src/lib/types.ts`**

Append:

```typescript
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
  derivation_consideration: number | null
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
  type: string
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
  original_amount: number | null
  mortgagor: string | null
  mortgagee: string | null
  trustee: string | null
}

export type SecurityInstrumentRelatedDoc = {
  id: string
  security_instrument_id: string
  type: string
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
  amount: number | null
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
  description: string
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
}
```

- [ ] **Step 2: Add constants to `src/lib/constants.ts`**

Append (values verified against the prototype's `DERIVATION_INSTRUMENT_TYPES`, `ENTITY_TYPES`, `PRINCIPAL_ROLES`, `SECURITY_INSTRUMENT_TYPES`, `RELATED_DOC_TYPES`, `LIEN_TYPES`, `TAX_LIEN_TYPES`, per the design doc's already-corrected field lists):

```typescript
export const DERIVATION_INSTRUMENT_TYPES = [
  'Warranty Deed', 'Special Warranty Deed', 'Limited Warranty Deed', "Trustee's Deed",
  'Deed of Distribution', 'Gift Deed', 'Quitclaim Deed', 'Grant Deed',
  'Deed of Bargain and Sale', 'Interspousal Transfer Deed', 'Transfer on Death Deed',
  'Affidavit', 'Death Certificate', 'Divorce Decree', 'Quiet Title Action', 'Confirmatory Deed',
] as const

export const PRELIM_ENTITY_TYPES = [
  'Individual', 'LLC', 'Corporation', 'Partnership', 'Trust', 'Estate', 'Other',
] as const

export const PRINCIPAL_ROLES: Record<string, readonly string[]> = {
  LLC: ['Member', 'Manager'],
  Corporation: ['President', 'Vice President', 'Secretary', 'Treasurer', 'Director', 'Chairman'],
  Partnership: ['General Partner', 'Limited Partner'],
  Trust: ['Trustee', 'Successor Trustee', 'Co-Trustee'],
}

export const SECURITY_INSTRUMENT_TYPES = [
  'Mortgage', 'Deed of Trust', 'Security Deed', 'UCC Financing Statement',
] as const

export const RELATED_DOC_TYPES = [
  'Assignment', 'Assignment of Leases and Rents', 'Assignment of Beneficial Interest',
  'Loan Modification Agreement', 'Substitution of Trustee', 'UCC Addendum - Continuation', 'Other',
] as const

export const RELATED_DOC_ASSIGNMENT_TYPES = [
  'Assignment', 'Assignment of Leases and Rents', 'Assignment of Beneficial Interest',
] as const

export const LIEN_TYPES = [
  'Judgment', 'Tax Lien', 'HOA/COA Lien', 'Mechanics Lien', 'Lis Pendens',
  'Tax Sale Certificate', 'Municipal Lien', 'Utility Lien', 'Other',
] as const

export const TAX_LIEN_TYPES = [
  'Income', 'Property', 'Franchise', 'Sales/Use', 'Estate', 'Other',
] as const
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit` from `genesis-app/`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add Prelim Search types and constants"
```

---

## Task 5: Derivation section — page, form, Principal rosters, clause preview, nav wiring

_Model: sonnet_ (largest, most interdependent task in this plan)

**Files:**
- Create: `src/app/orders/[id]/prelim-search/page.tsx`, `src/components/prelim-search/DerivationSection.tsx`, `src/components/prelim-search/DerivationPrincipalRoster.tsx`, `src/app/actions/prelim-search.ts`
- Modify: `src/components/FileSectionsNav.tsx`, `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: `fmtDate`, `entityQualifiedName`, `fullDerivationClause` from `@/lib/derivation-clause` (Task 3); `PrelimSearch`, `DerivationPrincipal` types and `DERIVATION_INSTRUMENT_TYPES`, `PRELIM_ENTITY_TYPES`, `PRINCIPAL_ROLES` constants (Task 4); `Button`/`Input`/`Textarea`/`Select`/`Checkbox`/`Label` from `@/components/ui/*` (Task 1).
- Produces: server actions `upsertPrelimSearch(orderId: string, formData: FormData)`, `addDerivationPrincipal(prelimSearchId: string, orderId: string, side: 'grantee' | 'grantor', formData: FormData)`, `updateDerivationPrincipal(id: string, orderId: string, formData: FormData)`, `deleteDerivationPrincipal(orderId: string, id: string)` — all in `src/app/actions/prelim-search.ts`, extended by Tasks 6–9. Route `/orders/[id]/prelim-search`.

- [ ] **Step 1: Write the server actions**

```typescript
// src/app/actions/prelim-search.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function upsertPrelimSearch(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const field = (name: string) => (formData.get(name) as string) || null
  const consideration = formData.get('derivation_consideration') as string

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
      derivation_consideration: consideration ? Number(consideration) : null,
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

export async function updateDerivationPrincipal(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const role = (formData.get('role') as string) || null

  const { error } = await supabase.from('derivation_principals').update({ name, role }).eq('id', id)

  if (error) {
    console.error('updateDerivationPrincipal failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteDerivationPrincipal(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('derivation_principals').delete().eq('id', id)

  if (error) {
    console.error('deleteDerivationPrincipal failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}
```

- [ ] **Step 2: Write `DerivationPrincipalRoster.tsx`**

Reused for both the Grantee and Grantor sides. Renders only when the corresponding side's entity type has a roster (LLC/Corporation/Partnership/Trust).

```tsx
// src/components/prelim-search/DerivationPrincipalRoster.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRINCIPAL_ROLES } from '@/lib/constants'
import {
  addDerivationPrincipal,
  updateDerivationPrincipal,
  deleteDerivationPrincipal,
} from '@/app/actions/prelim-search'
import type { DerivationPrincipal } from '@/lib/types'

export function DerivationPrincipalRoster({
  orderId,
  prelimSearchId,
  side,
  entityType,
  principals,
  label,
}: {
  orderId: string
  prelimSearchId: string
  side: 'grantee' | 'grantor'
  entityType: string
  principals: DerivationPrincipal[]
  label: string
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const roles = PRINCIPAL_ROLES[entityType] ?? []

  return (
    <div className="mt-4 border-t pt-4" data-testid={`${side}-principal-roster`}>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <ul className="mb-4 space-y-2">
        {principals.map((p) =>
          editingId === p.id ? (
            <li key={p.id} className="rounded border p-3" data-testid={`${side}-principal-row-editing`}>
              <form
                action={async (formData) => {
                  await updateDerivationPrincipal(p.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-3"
              >
                <div>
                  <Label htmlFor={`${side}-name-${p.id}`}>Name</Label>
                  <Input id={`${side}-name-${p.id}`} name="name" defaultValue={p.name} required />
                </div>
                <div>
                  <Label htmlFor={`${side}-role-${p.id}`}>Role</Label>
                  <Select name="role" defaultValue={p.role ?? undefined}>
                    <SelectTrigger id={`${side}-role-${p.id}`}>
                      <SelectValue placeholder="— Select —" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
            <li
              key={p.id}
              className="flex items-center justify-between rounded border p-3"
              data-testid={`${side}-principal-row`}
            >
              <div>
                <p className="font-medium">{p.name}</p>
                {p.role && <p className="text-sm text-slate-500">{p.role}</p>}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-sm text-slate-600 hover:underline"
                  onClick={() => setEditingId(p.id)}
                  aria-label={`Edit ${p.name}`}
                >
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
        {principals.length === 0 && <p className="text-sm text-slate-500">None added yet.</p>}
      </ul>

      <details className="rounded border p-3">
        <summary className="cursor-pointer text-sm font-medium">Add {label.replace(/s$/, '')}</summary>
        <form action={addDerivationPrincipal.bind(null, prelimSearchId, orderId, side)} className="mt-3 space-y-3">
          <div>
            <Label htmlFor={`${side}-new-name`}>Name</Label>
            <Input id={`${side}-new-name`} name="name" required />
          </div>
          <div>
            <Label htmlFor={`${side}-new-role`}>Role</Label>
            <Select name="role">
              <SelectTrigger id={`${side}-new-role`}>
                <SelectValue placeholder="— Select —" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      </details>
    </div>
  )
}
```

- [ ] **Step 3: Write `DerivationSection.tsx`**

```tsx
// src/components/prelim-search/DerivationSection.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DERIVATION_INSTRUMENT_TYPES, PRELIM_ENTITY_TYPES } from '@/lib/constants'
import { upsertPrelimSearch } from '@/app/actions/prelim-search'
import { fullDerivationClause, derivationVestingClause } from '@/lib/derivation-clause'
import type { PrelimSearch, DerivationPrincipal } from '@/lib/types'
import { DerivationPrincipalRoster } from './DerivationPrincipalRoster'

export function DerivationSection({
  orderId,
  prelimSearch,
  granteePrincipals,
  grantorPrincipals,
  county,
}: {
  orderId: string
  prelimSearch: PrelimSearch | null
  granteePrincipals: DerivationPrincipal[]
  grantorPrincipals: DerivationPrincipal[]
  county: string | null
}) {
  const [granteeType, setGranteeType] = useState(prelimSearch?.derivation_grantee_entity_type ?? '')
  const [grantorType, setGrantorType] = useState(prelimSearch?.derivation_grantor_entity_type ?? '')
  const action = upsertPrelimSearch.bind(null, orderId)

  const vestingClause = prelimSearch
    ? derivationVestingClause(
        prelimSearch.derivation_grantee_name,
        (prelimSearch.derivation_grantee_entity_type as never) ?? null,
        granteePrincipals
      )
    : ''

  const derivationClause = prelimSearch
    ? fullDerivationClause(
        {
          granteeName: prelimSearch.derivation_grantee_name,
          granteeEntityType: (prelimSearch.derivation_grantee_entity_type as never) ?? null,
          grantorName: prelimSearch.derivation_grantor_name,
          grantorEntityType: (prelimSearch.derivation_grantor_entity_type as never) ?? null,
          instrumentType: prelimSearch.derivation_instrument_type,
          recordedDate: prelimSearch.derivation_recorded_date,
          book: prelimSearch.derivation_book,
          page: prelimSearch.derivation_page,
          instrumentNumber: prelimSearch.derivation_instrument_number,
          isPortion: prelimSearch.derivation_is_portion,
          county,
        },
        granteePrincipals,
        grantorPrincipals
      )
    : ''

  return (
    <section id="derivation" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-semibold">Derivation</h2>

      <form action={action} className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="effective_date">Effective Date</Label>
            <Input id="effective_date" name="effective_date" type="date" defaultValue={prelimSearch?.effective_date ?? undefined} />
          </div>
          <div>
            <Label htmlFor="effective_time">Effective Time</Label>
            <Input id="effective_time" name="effective_time" type="time" defaultValue={prelimSearch?.effective_time ?? undefined} />
          </div>
          <div>
            <Label htmlFor="search_type">Search Type</Label>
            <Input id="search_type" name="search_type" defaultValue={prelimSearch?.search_type ?? undefined} />
          </div>
          <div>
            <Label htmlFor="search_from_date">Search From Date</Label>
            <Input id="search_from_date" name="search_from_date" type="date" defaultValue={prelimSearch?.search_from_date ?? undefined} />
          </div>
          <div>
            <Label htmlFor="search_to_date">Search To Date</Label>
            <Input id="search_to_date" name="search_to_date" type="date" defaultValue={prelimSearch?.search_to_date ?? undefined} />
          </div>
          <div>
            <Label htmlFor="search_to_time">Search To Time</Label>
            <Input id="search_to_time" name="search_to_time" type="time" defaultValue={prelimSearch?.search_to_time ?? undefined} />
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">Derivation Record</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="derivation_instrument_type">Instrument Type</Label>
              <Select name="derivation_instrument_type" defaultValue={prelimSearch?.derivation_instrument_type ?? undefined}>
                <SelectTrigger id="derivation_instrument_type">
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {DERIVATION_INSTRUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="derivation_dated_date">Dated Date</Label>
              <Input id="derivation_dated_date" name="derivation_dated_date" type="date" defaultValue={prelimSearch?.derivation_dated_date ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_recorded_date">Recorded Date</Label>
              <Input id="derivation_recorded_date" name="derivation_recorded_date" type="date" defaultValue={prelimSearch?.derivation_recorded_date ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_book">Book</Label>
              <Input id="derivation_book" name="derivation_book" defaultValue={prelimSearch?.derivation_book ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_page">Page</Label>
              <Input id="derivation_page" name="derivation_page" defaultValue={prelimSearch?.derivation_page ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_instrument_number">Instrument Number</Label>
              <Input id="derivation_instrument_number" name="derivation_instrument_number" defaultValue={prelimSearch?.derivation_instrument_number ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_consideration">Consideration</Label>
              <Input id="derivation_consideration" name="derivation_consideration" type="number" step="0.01" defaultValue={prelimSearch?.derivation_consideration ?? undefined} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="derivation_grantee_name">Grantee Name</Label>
              <Input id="derivation_grantee_name" name="derivation_grantee_name" defaultValue={prelimSearch?.derivation_grantee_name ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_grantee_entity_type">Grantee Entity Type</Label>
              <Select
                name="derivation_grantee_entity_type"
                defaultValue={prelimSearch?.derivation_grantee_entity_type ?? undefined}
                onValueChange={setGranteeType}
              >
                <SelectTrigger id="derivation_grantee_entity_type">
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {PRELIM_ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="derivation_grantor_name">Grantor Name</Label>
              <Input id="derivation_grantor_name" name="derivation_grantor_name" defaultValue={prelimSearch?.derivation_grantor_name ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_grantor_entity_type">Grantor Entity Type</Label>
              <Select
                name="derivation_grantor_entity_type"
                defaultValue={prelimSearch?.derivation_grantor_entity_type ?? undefined}
                onValueChange={setGrantorType}
              >
                <SelectTrigger id="derivation_grantor_entity_type">
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {PRELIM_ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Checkbox id="derivation_is_portion" name="derivation_is_portion" defaultChecked={prelimSearch?.derivation_is_portion ?? false} />
            <Label htmlFor="derivation_is_portion">Conveys a Portion (unchecked = conveys entire property)</Label>
          </div>

          <div className="mt-4">
            <Label htmlFor="derivation_note">Derivation Note</Label>
            <Textarea id="derivation_note" name="derivation_note" rows={3} defaultValue={prelimSearch?.derivation_note ?? undefined} />
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">Real Property Taxes</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="taxes_paid_through_year">Taxes Paid Through Year</Label>
              <Input id="taxes_paid_through_year" name="taxes_paid_through_year" defaultValue={prelimSearch?.taxes_paid_through_year ?? undefined} />
            </div>
            <div>
              <Label htmlFor="taxes_now_due">Taxes Now Due</Label>
              <Input id="taxes_now_due" name="taxes_now_due" defaultValue={prelimSearch?.taxes_now_due ?? undefined} />
            </div>
            <div>
              <Label htmlFor="taxes_not_yet_due">Taxes Not Yet Due</Label>
              <Input id="taxes_not_yet_due" name="taxes_not_yet_due" defaultValue={prelimSearch?.taxes_not_yet_due ?? undefined} />
            </div>
            <div>
              <Label htmlFor="special_levies_assessments">Special Levies/Assessments</Label>
              <Input id="special_levies_assessments" name="special_levies_assessments" defaultValue={prelimSearch?.special_levies_assessments ?? undefined} />
            </div>
          </div>
        </div>

        <Button type="submit">Save Changes</Button>
      </form>

      {prelimSearch && (
        <div className="mt-6 rounded border bg-slate-50 p-4" data-testid="derivation-clause-preview">
          <p className="text-sm font-medium">Vesting Clause</p>
          <p className="mb-3 text-sm text-slate-700" data-testid="vesting-clause">
            {vestingClause || '— complete Grantee Name/Entity Type to generate —'}
          </p>
          <p className="text-sm font-medium">Derivation Clause</p>
          <p className="text-sm text-slate-700" data-testid="derivation-clause">
            {derivationClause || '— complete Grantee, Instrument Type, Grantor, and Recorded Date to generate —'}
          </p>
        </div>
      )}

      {prelimSearch ? (
        <>
          <DerivationPrincipalRoster
            orderId={orderId}
            prelimSearchId={prelimSearch.id}
            side="grantee"
            entityType={granteeType}
            principals={granteePrincipals}
            label="Grantee Principals"
          />
          <DerivationPrincipalRoster
            orderId={orderId}
            prelimSearchId={prelimSearch.id}
            side="grantor"
            entityType={grantorType}
            principals={grantorPrincipals}
            label="Grantor Principals"
          />
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Save Derivation first before adding Principals.</p>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Write `page.tsx` and wire the nav**

```tsx
// src/app/orders/[id]/prelim-search/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DerivationSection } from '@/components/prelim-search/DerivationSection'

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

  const { data: property } = await supabase
    .from('property_details')
    .select('county')
    .eq('order_id', id)
    .maybeSingle()

  const { data: prelimSearch } = await supabase
    .from('prelim_search')
    .select('*')
    .eq('order_id', id)
    .maybeSingle()

  const { data: granteePrincipals } = prelimSearch
    ? await supabase
        .from('derivation_principals')
        .select('*')
        .eq('prelim_search_id', prelimSearch.id)
        .eq('side', 'grantee')
        .order('created_at', { ascending: true })
    : { data: [] }

  const { data: grantorPrincipals } = prelimSearch
    ? await supabase
        .from('derivation_principals')
        .select('*')
        .eq('prelim_search_id', prelimSearch.id)
        .eq('side', 'grantor')
        .order('created_at', { ascending: true })
    : { data: [] }

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <nav
        className="sticky top-0 z-10 mb-6 flex gap-4 border-b bg-white/95 py-2 text-sm backdrop-blur"
        data-testid="prelim-search-anchor-nav"
      >
        <a href="#derivation" className="text-slate-600 hover:text-slate-900 hover:underline">
          Derivation
        </a>
        <a href="#security-instruments" className="text-slate-600 hover:text-slate-900 hover:underline">
          Security Instruments
        </a>
        <a href="#liens" className="text-slate-600 hover:text-slate-900 hover:underline">
          Liens
        </a>
        <a href="#exception-matters" className="text-slate-600 hover:text-slate-900 hover:underline">
          Exception Matters
        </a>
      </nav>

      <div className="space-y-10">
        <DerivationSection
          orderId={id}
          prelimSearch={prelimSearch ?? null}
          granteePrincipals={granteePrincipals ?? []}
          grantorPrincipals={grantorPrincipals ?? []}
          county={property?.county ?? null}
        />
        {/* Security Instruments, Liens, Exception Matters sections are added in Tasks 6-9 */}
      </div>
    </div>
  )
}
```

Add `scroll-behavior: smooth` globally (the anchor nav's own container doesn't control page scroll) — append to `src/app/globals.css`:

```css
html {
  scroll-behavior: smooth;
}
```

In `src/components/FileSectionsNav.tsx`, change the Title group's first item from a disabled placeholder to a real link:

```typescript
{ label: 'Prelim Title Search', segment: 'prelim-search' },
```

(Replace the existing `{ label: 'Prelim Title Search' }` entry in the `Title` group's `items` array with the line above — same array position, now with a `segment`.)

- [ ] **Step 5: Verify the build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed with no errors.

- [ ] **Step 6: Write the first e2e test**

Append to `tests/e2e/order-entry.spec.ts`, inside the existing `test.describe('Genesis foundation phase', ...)` block:

```typescript
  test('prelim search: Derivation form saves, generates Vesting/Derivation Clause, and manages Principals', async ({
    page,
  }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('County').fill('Lorain')
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')

    await page.getByLabel('Effective Date').fill('2026-06-01')
    await page.getByLabel('Instrument Type').click()
    await page.getByRole('option', { name: 'Warranty Deed' }).click()
    await page.getByLabel('Recorded Date').fill('2026-05-15')
    await page.getByLabel('Grantee Name').fill('Test Trust Co')
    await page.getByLabel('Grantee Entity Type').click()
    await page.getByRole('option', { name: 'Trust' }).click()
    await page.getByLabel('Grantor Name').fill('Original Owner LLC')
    await page.getByLabel('Grantor Entity Type').click()
    await page.getByRole('option', { name: 'LLC' }).click()

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    // No trustees yet - Vesting Clause shows the "not yet added" fallback.
    await expect(page.getByTestId('vesting-clause')).toContainText('[Trustee(s) not yet added] of the Test Trust Co')

    // Add a Grantee (Trust) principal.
    await page.getByTestId('grantee-principal-roster').getByText('Add Grantee Principal').click()
    await page.locator('#grantee-new-name').fill('Jane Trustee')
    await page.locator('#grantee-new-role').click()
    await page.getByRole('option', { name: 'Trustee' }).click()
    await page.getByTestId('grantee-principal-roster').getByRole('button', { name: 'Add' }).click()

    await expect(page.getByTestId('grantee-principal-row')).toContainText('Jane Trustee')
    await expect(page.getByTestId('vesting-clause')).toContainText('Jane Trustee, as Trustee of the Test Trust Co')
    await expect(page.getByTestId('derivation-clause')).toContainText(
      'Being the same parcel conveyed unto Jane Trustee, as Trustee of the Test Trust Co by Warranty Deed of Original Owner LLC recorded May 15, 2026 of the Lorain County records.'
    )

    // Edit the principal via the pencil/Edit control.
    await page.getByTestId('grantee-principal-row').getByRole('button', { name: /Edit/ }).click();
    await page.getByTestId('grantee-principal-row-editing').locator('input[name="name"]').fill('Jane A. Trustee');
    await page.getByTestId('grantee-principal-row-editing').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('grantee-principal-row')).toContainText('Jane A. Trustee')

    // Remove it.
    await page.getByTestId('grantee-principal-row').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('grantee-principal-row')).not.toBeVisible()
  })
```

- [ ] **Step 7: Run the new test**

Run: `npx playwright test -g "Derivation form saves"` from `genesis-app/`
Expected: PASS. The Grantor is an LLC with no principals added, so `entityQualifiedName`'s LLC branch returns just the base name with no `, by ...` suffix (an empty `names` array) — the expected Derivation Clause string above already reflects `Original Owner LLC` alone, no trailing `by` clause.

- [ ] **Step 8: Commit**

```bash
cd "/Volumes/T7/Claude Case Platform/genesis-app"
git add src/app/orders/[id]/prelim-search src/components/prelim-search src/app/actions/prelim-search.ts src/components/FileSectionsNav.tsx src/app/globals.css tests/e2e/order-entry.spec.ts
git commit -m "feat: build Prelim Search Derivation section, clause preview, and Principal rosters"
```

(Fix the path typo above before running — it must read `"/Volumes/T7/Claude Code/Genesis Platform/genesis-app"`, matching every other task's `cd` command in this plan.)

---

## Task 6: Security Instruments section

_Model: sonnet_

**Files:**
- Create: `src/components/prelim-search/SecurityInstrumentsSection.tsx`
- Modify: `src/app/actions/prelim-search.ts`, `src/app/orders/[id]/prelim-search/page.tsx`, `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: `SecurityInstrument` type, `SECURITY_INSTRUMENT_TYPES` constant (Task 4).
- Produces: server actions `addSecurityInstrument(prelimSearchId: string, orderId: string, formData: FormData)`, `updateSecurityInstrument(id: string, orderId: string, formData: FormData)`, `deleteSecurityInstrument(orderId: string, id: string)`, all appended to `src/app/actions/prelim-search.ts`. Consumed by Task 7 (Related Documents render nested inside this section's list rows).

- [ ] **Step 1: Add server actions**

Append to `src/app/actions/prelim-search.ts`:

```typescript
export async function addSecurityInstrument(prelimSearchId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null
  const originalAmount = formData.get('original_amount') as string

  const { error } = await supabase.from('security_instruments').insert({
    prelim_search_id: prelimSearchId,
    type: field('type'),
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
    original_amount: originalAmount ? Number(originalAmount) : null,
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

export async function updateSecurityInstrument(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null
  const originalAmount = formData.get('original_amount') as string

  const { error } = await supabase
    .from('security_instruments')
    .update({
      type: field('type'),
      dated_date: field('dated_date'),
      recorded_date: field('recorded_date'),
      book: field('book'),
      page: field('page'),
      instrument_number: field('instrument_number'),
      original_amount: originalAmount ? Number(originalAmount) : null,
      mortgagor: field('mortgagor'),
      mortgagee: field('mortgagee'),
      trustee: field('trustee'),
    })
    .eq('id', id)

  if (error) {
    console.error('updateSecurityInstrument failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteSecurityInstrument(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('security_instruments').delete().eq('id', id)

  if (error) {
    console.error('deleteSecurityInstrument failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}
```

- [ ] **Step 2: Write `SecurityInstrumentsSection.tsx`**

Ships Security Instruments alone (list, add, edit, delete) as a fully working, independently testable slice. Related Documents are wired in as a render-prop by Task 7 without touching this file's core logic again.

```tsx
// src/components/prelim-search/SecurityInstrumentsSection.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SECURITY_INSTRUMENT_TYPES } from '@/lib/constants'
import {
  addSecurityInstrument,
  updateSecurityInstrument,
  deleteSecurityInstrument,
} from '@/app/actions/prelim-search'
import type { SecurityInstrument } from '@/lib/types'

function SecurityInstrumentFields({ instrument }: { instrument?: SecurityInstrument }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <Label htmlFor="si-type">Type</Label>
        <Select name="type" defaultValue={instrument?.type}>
          <SelectTrigger id="si-type">
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {SECURITY_INSTRUMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="si-dated_date">Dated Date</Label>
        <Input id="si-dated_date" name="dated_date" type="date" defaultValue={instrument?.dated_date ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-recorded_date">Recorded Date</Label>
        <Input id="si-recorded_date" name="recorded_date" type="date" defaultValue={instrument?.recorded_date ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-book">Book</Label>
        <Input id="si-book" name="book" defaultValue={instrument?.book ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-page">Page</Label>
        <Input id="si-page" name="page" defaultValue={instrument?.page ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-instrument_number">Instrument Number</Label>
        <Input id="si-instrument_number" name="instrument_number" defaultValue={instrument?.instrument_number ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-original_amount">Original Amount</Label>
        <Input id="si-original_amount" name="original_amount" type="number" step="0.01" defaultValue={instrument?.original_amount ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-mortgagor">Mortgagor</Label>
        <Input id="si-mortgagor" name="mortgagor" defaultValue={instrument?.mortgagor ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-mortgagee">Mortgagee</Label>
        <Input id="si-mortgagee" name="mortgagee" defaultValue={instrument?.mortgagee ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-trustee">Trustee</Label>
        <Input id="si-trustee" name="trustee" defaultValue={instrument?.trustee ?? undefined} />
      </div>
    </div>
  )
}

export function SecurityInstrumentsSection({
  orderId,
  prelimSearchId,
  instruments,
  relatedDocsSlot,
}: {
  orderId: string
  prelimSearchId: string
  instruments: SecurityInstrument[]
  relatedDocsSlot?: (instrumentId: string) => React.ReactNode
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <section id="security-instruments" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-semibold">Security Instruments</h2>

      <ul className="mb-6 space-y-4" data-testid="security-instrument-list">
        {instruments.map((instrument) =>
          editingId === instrument.id ? (
            <li key={instrument.id} className="rounded border p-4" data-testid="security-instrument-row-editing">
              <form
                action={async (formData) => {
                  await updateSecurityInstrument(instrument.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-4"
              >
                <SecurityInstrumentFields instrument={instrument} />
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
            <li key={instrument.id} className="rounded border p-4" data-testid="security-instrument-row">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{instrument.type}</p>
                  <p className="text-sm text-slate-500">
                    {instrument.mortgagor} → {instrument.mortgagee}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="text-sm text-slate-600 hover:underline"
                    onClick={() => setEditingId(instrument.id)}
                    aria-label={`Edit ${instrument.type}`}
                  >
                    Edit
                  </button>
                  <form action={deleteSecurityInstrument.bind(null, orderId, instrument.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
              {relatedDocsSlot?.(instrument.id)}
            </li>
          )
        )}
        {instruments.length === 0 && <p className="text-sm text-slate-500">No Security Instruments on file — Add one.</p>}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add a Security Instrument</summary>
        <form action={addSecurityInstrument.bind(null, prelimSearchId, orderId)} className="mt-4 space-y-4">
          <SecurityInstrumentFields />
          <Button type="submit">Add Security Instrument</Button>
        </form>
      </details>
    </section>
  )
}
```

- [ ] **Step 3: Wire it into `page.tsx`**

In `src/app/orders/[id]/prelim-search/page.tsx`, add a Security Instruments fetch and render the section. Replace the `{/* Security Instruments, Liens, Exception Matters sections are added in Tasks 6-9 */}` comment with:

```tsx
        {prelimSearch && (
          <SecurityInstrumentsSection
            orderId={id}
            prelimSearchId={prelimSearch.id}
            instruments={securityInstruments ?? []}
          />
        )}
```

Add the import: `import { SecurityInstrumentsSection } from '@/components/prelim-search/SecurityInstrumentsSection'`

Add the fetch, alongside the existing Principal fetches:

```typescript
  const { data: securityInstruments } = prelimSearch
    ? await supabase
        .from('security_instruments')
        .select('*')
        .eq('prelim_search_id', prelimSearch.id)
        .order('created_at', { ascending: true })
    : { data: [] }
```

- [ ] **Step 4: Verify build**

Run: `npm run build && npm run lint`
Expected: succeeds.

- [ ] **Step 5: Extend the e2e test**

Add a new `test(...)` block (kept separate from Task 5's test so a failure here doesn't obscure a Derivation regression) in `tests/e2e/order-entry.spec.ts`:

```typescript
  test('prelim search: Security Instruments add, edit, and remove', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')

    // Security Instruments need a saved prelim_search row first (foreign key) -
    // save Derivation with the minimum required fields.
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    await page.getByText('Add a Security Instrument').click()
    await page.locator('#si-type').click()
    await page.getByRole('option', { name: 'Deed of Trust' }).click()
    await page.locator('#si-mortgagor').fill('Test Borrower')
    await page.locator('#si-mortgagee').fill('Test Lender Bank')
    await page.getByRole('button', { name: 'Add Security Instrument' }).click()

    await expect(page.getByTestId('security-instrument-row')).toContainText('Deed of Trust')
    await expect(page.getByTestId('security-instrument-row')).toContainText('Test Borrower → Test Lender Bank')

    await page.getByTestId('security-instrument-row').getByRole('button', { name: /Edit/ }).click()
    await page.getByTestId('security-instrument-row-editing').locator('#si-mortgagee').fill('Updated Lender Bank')
    await page.getByTestId('security-instrument-row-editing').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('security-instrument-row')).toContainText('Test Borrower → Updated Lender Bank')

    await page.getByTestId('security-instrument-row').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('security-instrument-row')).not.toBeVisible()
  })
```

- [ ] **Step 6: Run it**

Run: `npx playwright test -g "Security Instruments add, edit, and remove"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add src/components/prelim-search/SecurityInstrumentsSection.tsx src/app/actions/prelim-search.ts src/app/orders/[id]/prelim-search/page.tsx tests/e2e/order-entry.spec.ts
git commit -m "feat: add Security Instruments section to Prelim Search"
```

---

## Task 7: Security Instrument Related Documents (nested)

_Model: sonnet_

**Files:**
- Create: `src/components/prelim-search/RelatedDocumentsSection.tsx`
- Modify: `src/app/actions/prelim-search.ts`, `src/app/orders/[id]/prelim-search/page.tsx`, `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: `SecurityInstrumentRelatedDoc` type, `RELATED_DOC_TYPES`, `RELATED_DOC_ASSIGNMENT_TYPES` constants (Task 4); `relatedDocsSlot` render-prop on `SecurityInstrumentsSection` (Task 6).
- Produces: server actions `addRelatedDoc(securityInstrumentId: string, orderId: string, formData: FormData)`, `updateRelatedDoc(id: string, orderId: string, formData: FormData)`, `deleteRelatedDoc(orderId: string, id: string)`, appended to `src/app/actions/prelim-search.ts`.

- [ ] **Step 1: Add server actions**

Append to `src/app/actions/prelim-search.ts`:

```typescript
export async function addRelatedDoc(securityInstrumentId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null
  const type = field('type')
  const isAssignmentType = ['Assignment', 'Assignment of Leases and Rents', 'Assignment of Beneficial Interest'].includes(
    type ?? ''
  )

  const { error } = await supabase.from('security_instrument_related_docs').insert({
    security_instrument_id: securityInstrumentId,
    type,
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
    assignor: isAssignmentType ? field('assignor') : null,
    assignee: isAssignmentType ? field('assignee') : null,
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

export async function updateRelatedDoc(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null
  const type = field('type')
  const isAssignmentType = ['Assignment', 'Assignment of Leases and Rents', 'Assignment of Beneficial Interest'].includes(
    type ?? ''
  )

  const { error } = await supabase
    .from('security_instrument_related_docs')
    .update({
      type,
      dated_date: field('dated_date'),
      recorded_date: field('recorded_date'),
      book: field('book'),
      page: field('page'),
      instrument_number: field('instrument_number'),
      assignor: isAssignmentType ? field('assignor') : null,
      assignee: isAssignmentType ? field('assignee') : null,
      notes: field('notes'),
    })
    .eq('id', id)

  if (error) {
    console.error('updateRelatedDoc failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteRelatedDoc(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('security_instrument_related_docs').delete().eq('id', id)

  if (error) {
    console.error('deleteRelatedDoc failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}
```

- [ ] **Step 2: Write `RelatedDocumentsSection.tsx`**

```tsx
// src/components/prelim-search/RelatedDocumentsSection.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RELATED_DOC_TYPES, RELATED_DOC_ASSIGNMENT_TYPES } from '@/lib/constants'
import { addRelatedDoc, updateRelatedDoc, deleteRelatedDoc } from '@/app/actions/prelim-search'
import type { SecurityInstrumentRelatedDoc } from '@/lib/types'

function isAssignmentType(type: string | undefined) {
  return !!type && (RELATED_DOC_ASSIGNMENT_TYPES as readonly string[]).includes(type)
}

function RelatedDocFields({ doc, idPrefix }: { doc?: SecurityInstrumentRelatedDoc; idPrefix: string }) {
  const [type, setType] = useState<string | undefined>(doc?.type)

  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <Label htmlFor={`${idPrefix}-type`}>Type</Label>
        <Select name="type" defaultValue={doc?.type} onValueChange={setType}>
          <SelectTrigger id={`${idPrefix}-type`}>
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {RELATED_DOC_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-dated_date`}>Dated Date</Label>
        <Input id={`${idPrefix}-dated_date`} name="dated_date" type="date" defaultValue={doc?.dated_date ?? undefined} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-recorded_date`}>Recorded Date</Label>
        <Input id={`${idPrefix}-recorded_date`} name="recorded_date" type="date" defaultValue={doc?.recorded_date ?? undefined} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-book`}>Book</Label>
        <Input id={`${idPrefix}-book`} name="book" defaultValue={doc?.book ?? undefined} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-page`}>Page</Label>
        <Input id={`${idPrefix}-page`} name="page" defaultValue={doc?.page ?? undefined} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-instrument_number`}>Instrument Number</Label>
        <Input id={`${idPrefix}-instrument_number`} name="instrument_number" defaultValue={doc?.instrument_number ?? undefined} />
      </div>
      {isAssignmentType(type) && (
        <>
          <div>
            <Label htmlFor={`${idPrefix}-assignor`}>Assignor</Label>
            <Input id={`${idPrefix}-assignor`} name="assignor" defaultValue={doc?.assignor ?? undefined} />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-assignee`}>Assignee</Label>
            <Input id={`${idPrefix}-assignee`} name="assignee" defaultValue={doc?.assignee ?? undefined} />
          </div>
        </>
      )}
      <div className="col-span-3">
        <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
        <Textarea id={`${idPrefix}-notes`} name="notes" rows={2} defaultValue={doc?.notes ?? undefined} />
      </div>
    </div>
  )
}

export function RelatedDocumentsSection({
  orderId,
  securityInstrumentId,
  docs,
}: {
  orderId: string
  securityInstrumentId: string
  docs: SecurityInstrumentRelatedDoc[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="mt-3 border-t pt-3" data-testid="related-docs-section">
      <p className="mb-2 text-sm font-medium">Related Documents</p>
      <ul className="mb-3 space-y-3">
        {docs.map((doc) =>
          editingId === doc.id ? (
            <li key={doc.id} className="rounded border p-3" data-testid="related-doc-row-editing">
              <form
                action={async (formData) => {
                  await updateRelatedDoc(doc.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-3"
              >
                <RelatedDocFields doc={doc} idPrefix={`rd-edit-${doc.id}`} />
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
            <li key={doc.id} className="flex items-center justify-between rounded border p-3" data-testid="related-doc-row">
              <div>
                <p className="text-sm font-medium">{doc.type}</p>
                {isAssignmentType(doc.type) && (
                  <p className="text-xs text-slate-500">
                    {doc.assignor} → {doc.assignee}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-sm text-slate-600 hover:underline"
                  onClick={() => setEditingId(doc.id)}
                  aria-label={`Edit ${doc.type}`}
                >
                  Edit
                </button>
                <form action={deleteRelatedDoc.bind(null, orderId, doc.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {docs.length === 0 && <p className="text-sm text-slate-500">No Related Documents on file.</p>}
      </ul>

      <details className="rounded border p-3">
        <summary className="cursor-pointer text-sm font-medium">Add a Related Document</summary>
        <form action={addRelatedDoc.bind(null, securityInstrumentId, orderId)} className="mt-3 space-y-3">
          <RelatedDocFields idPrefix={`rd-new-${securityInstrumentId}`} />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      </details>
    </div>
  )
}
```

- [ ] **Step 3: Wire it into `page.tsx` via the `relatedDocsSlot` render-prop**

Fetch all related docs for the order's security instruments, group by `security_instrument_id`, and pass a rendering function into `SecurityInstrumentsSection`. In `src/app/orders/[id]/prelim-search/page.tsx`:

Add the import: `import { RelatedDocumentsSection } from '@/components/prelim-search/RelatedDocumentsSection'`

Add the fetch, after `securityInstruments`:

```typescript
  const instrumentIds = (securityInstruments ?? []).map((i) => i.id)
  const { data: relatedDocs } = instrumentIds.length
    ? await supabase
        .from('security_instrument_related_docs')
        .select('*')
        .in('security_instrument_id', instrumentIds)
        .order('created_at', { ascending: true })
    : { data: [] }
```

Update the `SecurityInstrumentsSection` usage to pass the render-prop:

```tsx
        {prelimSearch && (
          <SecurityInstrumentsSection
            orderId={id}
            prelimSearchId={prelimSearch.id}
            instruments={securityInstruments ?? []}
            relatedDocsSlot={(instrumentId) => (
              <RelatedDocumentsSection
                orderId={id}
                securityInstrumentId={instrumentId}
                docs={(relatedDocs ?? []).filter((d) => d.security_instrument_id === instrumentId)}
              />
            )}
          />
        )}
```

- [ ] **Step 4: Verify build**

Run: `npm run build && npm run lint`
Expected: succeeds.

- [ ] **Step 5: Extend the e2e test**

Add a new test in `tests/e2e/order-entry.spec.ts`:

```typescript
  test('prelim search: Related Documents show Assignor/Assignee only for Assignment-family types', async ({
    page,
  }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    await page.getByText('Add a Security Instrument').click()
    await page.locator('#si-type').click()
    await page.getByRole('option', { name: 'Mortgage' }).click()
    await page.getByRole('button', { name: 'Add Security Instrument' }).click()
    await expect(page.getByTestId('security-instrument-row')).toBeVisible()

    await page.getByText('Add a Related Document').click()
    const relatedDocForm = page.locator('[data-testid="related-docs-section"] details')
    await relatedDocForm.locator('button[role="combobox"]').click()
    await page.getByRole('option', { name: 'Substitution of Trustee' }).click()
    await expect(relatedDocForm.getByLabel('Assignor')).not.toBeVisible()

    await relatedDocForm.locator('button[role="combobox"]').click()
    await page.getByRole('option', { name: 'Assignment', exact: true }).click()
    await expect(relatedDocForm.getByLabel('Assignor')).toBeVisible()
    await relatedDocForm.getByLabel('Assignor').fill('Original Bank')
    await relatedDocForm.getByLabel('Assignee').fill('New Bank')
    await relatedDocForm.getByRole('button', { name: 'Add' }).click()

    await expect(page.getByTestId('related-doc-row')).toContainText('Original Bank → New Bank')
  })
```

- [ ] **Step 6: Run it**

Run: `npx playwright test -g "Assignor/Assignee only for Assignment-family types"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add src/components/prelim-search/RelatedDocumentsSection.tsx src/app/actions/prelim-search.ts src/app/orders/[id]/prelim-search/page.tsx tests/e2e/order-entry.spec.ts
git commit -m "feat: add Related Documents under Security Instruments in Prelim Search"
```

---

## Task 8: Liens section (9 types, per-type field reshaping)

_Model: sonnet_

**Files:**
- Create: `src/components/prelim-search/LiensSection.tsx`
- Modify: `src/app/actions/prelim-search.ts`, `src/app/orders/[id]/prelim-search/page.tsx`, `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: `Lien` type, `LIEN_TYPES`, `TAX_LIEN_TYPES` constants (Task 4).
- Produces: server actions `addLien`, `updateLien`, `deleteLien`, appended to `src/app/actions/prelim-search.ts`.

- [ ] **Step 1: Add server actions**

Append to `src/app/actions/prelim-search.ts`:

```typescript
function lienFieldsFromFormData(formData: FormData) {
  const field = (name: string) => (formData.get(name) as string) || null
  const amount = formData.get('amount') as string
  return {
    type: field('type'),
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
    amount: amount ? Number(amount) : null,
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
  }
}

export async function addLien(prelimSearchId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('liens').insert({
    prelim_search_id: prelimSearchId,
    ...lienFieldsFromFormData(formData),
  })

  if (error) {
    console.error('addLien failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function updateLien(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('liens').update(lienFieldsFromFormData(formData)).eq('id', id)

  if (error) {
    console.error('updateLien failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteLien(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('liens').delete().eq('id', id)

  if (error) {
    console.error('deleteLien failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}
```

- [ ] **Step 2: Write `LiensSection.tsx`**

Per-type field sets, verified against the design doc's Field List section:

```tsx
// src/components/prelim-search/LiensSection.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LIEN_TYPES, TAX_LIEN_TYPES } from '@/lib/constants'
import { addLien, updateLien, deleteLien } from '@/app/actions/prelim-search'
import type { Lien } from '@/lib/types'

type FieldKey =
  | 'debtor' | 'creditor' | 'docket_date' | 'case_number' | 'court' | 'amount'
  | 'taxing_authority' | 'tax_type' | 'filed_date' | 'book' | 'page' | 'instrument_number'
  | 'hoa_company' | 'materialman' | 'dated_date' | 'recorded_date'
  | 'plaintiff' | 'defendant'
  | 'certificate_id' | 'redemption_expiration'

const LIEN_TYPE_FIELDS: Record<string, FieldKey[]> = {
  Judgment: ['debtor', 'creditor', 'docket_date', 'case_number', 'court', 'amount'],
  'Tax Lien': ['debtor', 'taxing_authority', 'tax_type', 'filed_date', 'amount', 'book', 'page', 'instrument_number'],
  'HOA/COA Lien': ['debtor', 'hoa_company', 'filed_date', 'amount', 'book', 'page', 'instrument_number'],
  'Mechanics Lien': ['debtor', 'materialman', 'last_service_date', 'recorded_date', 'amount', 'book', 'page', 'instrument_number'],
  'Lis Pendens': ['plaintiff', 'defendant', 'court', 'case_number'],
  'Tax Sale Certificate': ['certificate_id', 'dated_date', 'recorded_date', 'debtor', 'creditor', 'book', 'page', 'instrument_number', 'redemption_expiration'],
}

const LIEN_TYPE_FIELDS_DEFAULT: FieldKey[] = ['debtor', 'creditor', 'dated_date', 'recorded_date', 'court', 'case_number', 'amount']

const FIELD_LABELS: Record<FieldKey, string> = {
  debtor: 'Debtor',
  creditor: 'Creditor',
  docket_date: 'Docket Date',
  case_number: 'Case/Reference No.',
  court: 'Court',
  amount: 'Amount',
  taxing_authority: 'Taxing Authority',
  tax_type: 'Tax Type',
  filed_date: 'Filed Date',
  book: 'Book',
  page: 'Page',
  instrument_number: 'Instrument Number',
  hoa_company: 'HOA/COA Company',
  materialman: 'Materialman',
  dated_date: 'Dated Date',
  recorded_date: 'Recorded/Filed Date',
  plaintiff: 'Plaintiff',
  defendant: 'Defendant',
  certificate_id: 'Certificate ID',
  redemption_expiration: 'Redemption Period Expiration',
}

const DATE_FIELDS: FieldKey[] = ['docket_date', 'filed_date', 'last_service_date', 'dated_date', 'recorded_date', 'redemption_expiration']

function fieldsForType(type: string | undefined): FieldKey[] {
  if (!type) return []
  return LIEN_TYPE_FIELDS[type] ?? LIEN_TYPE_FIELDS_DEFAULT
}

function LienFields({ lien, idPrefix }: { lien?: Lien; idPrefix: string }) {
  const [type, setType] = useState<string | undefined>(lien?.type)
  const fields = fieldsForType(type)

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}-type`}>Type</Label>
        <Select name="type" defaultValue={lien?.type} onValueChange={setType}>
          <SelectTrigger id={`${idPrefix}-type`}>
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {LIEN_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {fields.map((f) => {
          const fieldId = `${idPrefix}-${f}`
          if (f === 'tax_type') {
            return (
              <div key={f}>
                <Label htmlFor={fieldId}>{FIELD_LABELS[f]}</Label>
                <Select name={f} defaultValue={(lien?.tax_type as string | undefined) ?? undefined}>
                  <SelectTrigger id={fieldId}>
                    <SelectValue placeholder="— Select —" />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_LIEN_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          }
          if (f === 'amount') {
            return (
              <div key={f}>
                <Label htmlFor={fieldId}>{FIELD_LABELS[f]}</Label>
                <Input id={fieldId} name={f} type="number" step="0.01" defaultValue={lien?.amount ?? undefined} />
              </div>
            )
          }
          const value = lien ? (lien[f as keyof Lien] as string | null | undefined) : undefined
          return (
            <div key={f}>
              <Label htmlFor={fieldId}>{FIELD_LABELS[f]}</Label>
              <Input id={fieldId} name={f} type={DATE_FIELDS.includes(f) ? 'date' : 'text'} defaultValue={value ?? undefined} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LiensSection({
  orderId,
  prelimSearchId,
  liens,
}: {
  orderId: string
  prelimSearchId: string
  liens: Lien[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <section id="liens" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-semibold">Liens</h2>

      <ul className="mb-6 space-y-4" data-testid="lien-list">
        {liens.map((lien) =>
          editingId === lien.id ? (
            <li key={lien.id} className="rounded border p-4" data-testid="lien-row-editing">
              <form
                action={async (formData) => {
                  await updateLien(lien.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-4"
              >
                <LienFields lien={lien} idPrefix={`lien-edit-${lien.id}`} />
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
            <li key={lien.id} className="flex items-center justify-between rounded border p-4" data-testid="lien-row">
              <div>
                <p className="font-medium">{lien.type}</p>
                <p className="text-sm text-slate-500">{lien.debtor || lien.plaintiff || lien.certificate_id}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-sm text-slate-600 hover:underline"
                  onClick={() => setEditingId(lien.id)}
                  aria-label={`Edit ${lien.type}`}
                >
                  Edit
                </button>
                <form action={deleteLien.bind(null, orderId, lien.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {liens.length === 0 && <p className="text-sm text-slate-500">No Liens on file — Add one.</p>}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add a Lien</summary>
        <form action={addLien.bind(null, prelimSearchId, orderId)} className="mt-4 space-y-4">
          <LienFields idPrefix="lien-new" />
          <Button type="submit">Add Lien</Button>
        </form>
      </details>
    </section>
  )
}
```

- [ ] **Step 3: Wire it into `page.tsx`**

Add the import and fetch, then render alongside the other sections:

```typescript
  const { data: liens } = prelimSearch
    ? await supabase.from('liens').select('*').eq('prelim_search_id', prelimSearch.id).order('created_at', { ascending: true })
    : { data: [] }
```

```tsx
        {prelimSearch && (
          <LiensSection orderId={id} prelimSearchId={prelimSearch.id} liens={liens ?? []} />
        )}
```

Import: `import { LiensSection } from '@/components/prelim-search/LiensSection'`

- [ ] **Step 4: Verify build**

Run: `npm run build && npm run lint`
Expected: succeeds.

- [ ] **Step 5: Extend the e2e test**

Add a new test:

```typescript
  test('prelim search: Liens show different fields per type', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    await page.getByText('Add a Lien').click()
    const lienForm = page.locator('#liens').locator('details')
    await lienForm.locator('#lien-new-type').click()
    await page.getByRole('option', { name: 'Judgment' }).click()
    await expect(lienForm.getByLabel('Debtor')).toBeVisible()
    await expect(lienForm.getByLabel('Court')).toBeVisible()
    await expect(lienForm.getByLabel('Taxing Authority')).not.toBeVisible()

    await lienForm.locator('#lien-new-type').click()
    await page.getByRole('option', { name: 'Tax Lien' }).click()
    await expect(lienForm.getByLabel('Taxing Authority')).toBeVisible()
    await expect(lienForm.getByLabel('Court')).not.toBeVisible()

    await lienForm.getByLabel('Debtor').fill('Test Debtor')
    await lienForm.getByLabel('Taxing Authority').fill('County Tax Office')
    await page.getByRole('button', { name: 'Add Lien' }).click()

    await expect(page.getByTestId('lien-row')).toContainText('Tax Lien')
    await expect(page.getByTestId('lien-row')).toContainText('Test Debtor')
  })
```

- [ ] **Step 6: Run it**

Run: `npx playwright test -g "Liens show different fields per type"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add src/components/prelim-search/LiensSection.tsx src/app/actions/prelim-search.ts src/app/orders/[id]/prelim-search/page.tsx tests/e2e/order-entry.spec.ts
git commit -m "feat: add Liens section with per-type field reshaping to Prelim Search"
```

---

## Task 9: Exception Matters section

_Model: haiku_ (simplest remaining section — flat repeatable list, no conditional fields)

**Files:**
- Create: `src/components/prelim-search/ExceptionMattersSection.tsx`
- Modify: `src/app/actions/prelim-search.ts`, `src/app/orders/[id]/prelim-search/page.tsx`, `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: `ExceptionMatter` type (Task 4).
- Produces: server actions `addExceptionMatter`, `updateExceptionMatter`, `deleteExceptionMatter`, appended to `src/app/actions/prelim-search.ts`.

- [ ] **Step 1: Add server actions**

Append to `src/app/actions/prelim-search.ts`:

```typescript
export async function addExceptionMatter(prelimSearchId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase.from('exception_matters').insert({
    prelim_search_id: prelimSearchId,
    description: formData.get('description') as string,
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

export async function updateExceptionMatter(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase
    .from('exception_matters')
    .update({
      description: formData.get('description') as string,
      dated_date: field('dated_date'),
      recorded_date: field('recorded_date'),
      book: field('book'),
      page: field('page'),
      instrument_number: field('instrument_number'),
    })
    .eq('id', id)

  if (error) {
    console.error('updateExceptionMatter failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteExceptionMatter(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('exception_matters').delete().eq('id', id)

  if (error) {
    console.error('deleteExceptionMatter failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}
```

- [ ] **Step 2: Write `ExceptionMattersSection.tsx`**

```tsx
// src/components/prelim-search/ExceptionMattersSection.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { addExceptionMatter, updateExceptionMatter, deleteExceptionMatter } from '@/app/actions/prelim-search'
import type { ExceptionMatter } from '@/lib/types'

function ExceptionMatterFields({ matter, idPrefix }: { matter?: ExceptionMatter; idPrefix: string }) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea id={`${idPrefix}-description`} name="description" rows={2} defaultValue={matter?.description} required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-dated_date`}>Dated Date</Label>
          <Input id={`${idPrefix}-dated_date`} name="dated_date" type="date" defaultValue={matter?.dated_date ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-recorded_date`}>Recorded Date</Label>
          <Input id={`${idPrefix}-recorded_date`} name="recorded_date" type="date" defaultValue={matter?.recorded_date ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-book`}>Book</Label>
          <Input id={`${idPrefix}-book`} name="book" defaultValue={matter?.book ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-page`}>Page</Label>
          <Input id={`${idPrefix}-page`} name="page" defaultValue={matter?.page ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-instrument_number`}>Instrument Number</Label>
          <Input id={`${idPrefix}-instrument_number`} name="instrument_number" defaultValue={matter?.instrument_number ?? undefined} />
        </div>
      </div>
    </div>
  )
}

export function ExceptionMattersSection({
  orderId,
  prelimSearchId,
  matters,
}: {
  orderId: string
  prelimSearchId: string
  matters: ExceptionMatter[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <section id="exception-matters" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-semibold">Exception Matters</h2>

      <ul className="mb-6 space-y-3" data-testid="exception-matter-list">
        {matters.map((matter) =>
          editingId === matter.id ? (
            <li key={matter.id} className="rounded border p-4" data-testid="exception-matter-row-editing">
              <form
                action={async (formData) => {
                  await updateExceptionMatter(matter.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-3"
              >
                <ExceptionMatterFields matter={matter} idPrefix={`em-edit-${matter.id}`} />
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
            <li key={matter.id} className="flex items-center justify-between rounded border p-3" data-testid="exception-matter-row">
              <p className="text-sm">{matter.description}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-sm text-slate-600 hover:underline"
                  onClick={() => setEditingId(matter.id)}
                  aria-label="Edit exception matter"
                >
                  Edit
                </button>
                <form action={deleteExceptionMatter.bind(null, orderId, matter.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {matters.length === 0 && <p className="text-sm text-slate-500">No Exception Matters on file — Add one.</p>}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add an Exception Matter</summary>
        <form action={addExceptionMatter.bind(null, prelimSearchId, orderId)} className="mt-4 space-y-3">
          <ExceptionMatterFields idPrefix="em-new" />
          <Button type="submit">Add Exception Matter</Button>
        </form>
      </details>
    </section>
  )
}
```

- [ ] **Step 3: Wire it into `page.tsx`**

Add the import and fetch, then render as the last section:

```typescript
  const { data: exceptionMatters } = prelimSearch
    ? await supabase.from('exception_matters').select('*').eq('prelim_search_id', prelimSearch.id).order('created_at', { ascending: true })
    : { data: [] }
```

```tsx
        {prelimSearch && (
          <ExceptionMattersSection orderId={id} prelimSearchId={prelimSearch.id} matters={exceptionMatters ?? []} />
        )}
```

Import: `import { ExceptionMattersSection } from '@/components/prelim-search/ExceptionMattersSection'`

- [ ] **Step 4: Verify build**

Run: `npm run build && npm run lint`
Expected: succeeds.

- [ ] **Step 5: Extend the e2e test**

```typescript
  test('prelim search: Exception Matters add, edit, and remove', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    await page.getByText('Add an Exception Matter').click()
    await page.locator('#em-new-description').fill('Easement of record affecting the rear 10 feet')
    await page.getByRole('button', { name: 'Add Exception Matter' }).click()

    await expect(page.getByTestId('exception-matter-row')).toContainText('Easement of record affecting the rear 10 feet')

    await page.getByTestId('exception-matter-row').getByRole('button', { name: 'Edit exception matter' }).click()
    await page.getByTestId('exception-matter-row-editing').locator('textarea[name="description"]').fill('Updated exception text')
    await page.getByTestId('exception-matter-row-editing').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('exception-matter-row')).toContainText('Updated exception text')

    await page.getByTestId('exception-matter-row').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('exception-matter-row')).not.toBeVisible()
  })
```

- [ ] **Step 6: Run it**

Run: `npx playwright test -g "Exception Matters add, edit, and remove"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add src/components/prelim-search/ExceptionMattersSection.tsx src/app/actions/prelim-search.ts src/app/orders/[id]/prelim-search/page.tsx tests/e2e/order-entry.spec.ts
git commit -m "feat: add Exception Matters section to Prelim Search"
```

---

## Task 10: Full regression, Build Log update, sync

_Model: haiku_

**Files:**
- Modify: `M&L Title/M&L Title - Obsidian Vault/Genesis Build Log.md`, `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Prelim Title Search Design.md`, `M&L Title/M&L Title - Obsidian Vault/Welcome.md`

**Interfaces:**
- Consumes: nothing new — this task closes out the increment.

- [ ] **Step 1: Run the full test suite**

Run: `npx playwright test` from `genesis-app/`
Expected: all tests pass, including every test from Tasks 5–9 plus every pre-existing test in `order-entry.spec.ts`.

- [ ] **Step 2: Run a final build + lint pass**

Run: `npm run build && npm run lint`
Expected: both succeed cleanly.

- [ ] **Step 3: Update the Build Log**

Open `M&L Title/M&L Title - Obsidian Vault/Genesis Build Log.md`. Add a new change-log entry (matching the existing entries' format) noting: Prelim Title Search & Opinion shipped — Derivation (header, record, Real Property Taxes, generated Vesting/Derivation Clause, Grantee/Grantor Principal rosters), Security Instruments + nested Related Documents, Liens (9 types with per-type field reshaping), Exception Matters; shadcn/ui installed as the first screen on the Design System; new tables `prelim_search`, `derivation_principals`, `security_instruments`, `security_instrument_related_docs`, `liens`, `exception_matters`; N/N Playwright tests passing (fill in the actual count from Step 1's output).

- [ ] **Step 4: Update the design doc's status**

In `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Prelim Title Search Design.md`, change the frontmatter `status:` from `design complete — pending implementation` to `built and deployed` (or the exact phrase this vault uses elsewhere for a shipped increment — check `Genesis Rebuild - Property Screen Design.md`'s frontmatter for the precedent wording) and update `updated:` to today's date.

- [ ] **Step 5: Update Welcome.md's index**

In `M&L Title/M&L Title - Obsidian Vault/Welcome.md`, update the Prelim Title Search Design line from "**Design complete 2026-08-29, pending implementation.**" to reflect it's now built and deployed, matching the phrasing used for the Property Screen and Navigation Shell entries above it.

- [ ] **Step 6: Sync to the Desktop backup copy**

Per `CLAUDE.md`'s standing process: this session worked from the T7 (primary) copy directly, so no forward-sync is needed — but confirm T7 and Desktop haven't drifted from an unrelated change mid-session:

```bash
diff -rq "/Volumes/T7/Claude Code/Genesis Platform" "/Users/campenny/Desktop/Claude Code/Genesis Platform" 2>/dev/null | grep -v "\.claude-flow\|\.obsidian/workspace.json\|\.DS_Store\|\.git/index"
```

If this reports only the files touched by Tasks 1–9 (migration, new components, actions, types, constants, globals.css, FileSectionsNav.tsx, e2e spec, and this task's 3 vault edits), copy them forward to Desktop the same way the prior session's sync was done — or run a full `rsync -av --delete` from T7 to Desktop per `CLAUDE.md`'s normal backup direction, since T7 is authoritative and Desktop is the periodically-resynced backup.

- [ ] **Step 7: Confirm the commit history**

```bash
git -C "/Volumes/T7/Claude Code/Genesis Platform/genesis-app" log --oneline -10
```

Expected: 9 new commits from Tasks 1–9 (shadcn install, schema, clause generator, types/constants, Derivation, Security Instruments, Related Documents, Liens, Exception Matters), each with a real, testable diff. Vault edits from Steps 3–5 above aren't part of the `genesis-app` git repo — they're saved directly to the Obsidian vault, not committed.

---

## Self-review notes (writing-plans skill, Step 5)

- **Spec coverage:** every Field List subsection (Derivation header/record/Real Property Taxes, Derivation Principals, Security Instruments, Related Documents, Liens all 9 types + shared default, Exception Matters), the Schema section's 6 tables, the Routing & components section's 6 files, and the Testing section's described flow are each covered by a task above. The two `Out of scope` items (Header admin fields; Derivation auto-fill from Contacts) are deliberately **not** built, matching the design doc.
- **Placeholder scan:** no task step says "similar to Task N," "add appropriate error handling," or leaves a function body empty — every SQL, TypeScript, and Playwright block above is complete, real code, including the exact prototype-verified clause-generation logic in Task 3. Fixed one placeholder-adjacent path typo in Task 5 Step 8's commit command during this review.
- **Type consistency:** `PrelimSearch`, `DerivationPrincipal`, `SecurityInstrument`, `SecurityInstrumentRelatedDoc`, `Lien`, `ExceptionMatter` (Task 4) are used with identical field names across every later task's components and actions. `entityQualifiedName`/`derivationVestingClause`/`fullDerivationClause` (Task 3) are called with the same signature in Task 5 as defined. Server action names (`upsertPrelimSearch`, `add/update/deleteDerivationPrincipal`, `add/update/deleteSecurityInstrument`, `add/update/deleteRelatedDoc`, `add/update/deleteLien`, `add/update/deleteExceptionMatter`) match between each task's "Produces" line and its actual usage in the following task's imports. `LiensSection.tsx`'s `LienFields` uses an explicit `keyof Lien` cast for its generic field lookup rather than the earlier draft's untyped `lien?.[f]`, avoiding a `tsc` indexing error against the `Lien` type from Task 4.
