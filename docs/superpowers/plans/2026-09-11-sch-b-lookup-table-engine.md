# Commitment Sch B-I/B-II Requirements/Exceptions Lookup-Table Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Commitment Schedule B-I/B-II a real Requirements/Exceptions template library — two lookup tables of reusable, tag-driven legal language — while converging the four existing hardcoded auto-chip generators onto the same admin-editable mechanism.

**Architecture:** Two new Supabase tables (`requirement_templates`, `exception_templates`) plus per-table state-variant tables, a shared `{{namespace.field}}` tag-substitution renderer (`src/lib/template-tags.ts`), an admin CRUD console gated by a new permission, and a "From Library" picker added to the existing Schedule B UI alongside the existing auto-chip row.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + `@supabase/ssr`), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-09-11-sch-b-lookup-table-design.md`

## Global Constraints

- **Real dependency, confirm before starting Task 5:** the admin console (Task 6) is gated by `hasPermission(supabase, 'manage_requirement_templates')`, which requires the Staff Directory & Permissions plan (`docs/superpowers/plans/2026-09-10-staff-directory-permissions.md`) to be built and merged first — its `src/lib/permissions.ts`, `src/lib/constants.ts` `PERMISSIONS` array, and `hasPermission()` helper must already exist. Do not start Task 5 until that's confirmed live.
- Migration file numbers below are written as `00XX` — before creating each migration, run `ls supabase/migrations | sort -V | tail -3` to find the actual next available number (other plans may have merged migrations ahead of this one).
- Tag syntax is exactly `{{namespace.field}}` (lowercase, underscore-separated) — distinct from the existing `[Mortgagor]`-style bracket placeholders already used for missing data, so the two conventions never collide.
- Every new mutating server action calls `revalidatePath('/', 'layout')`, not `'page'` — this codebase has a known staleness bug when narrower revalidation is used (see Contacts payee-dropdown history).
- New tables get RLS enabled with the same permissive policy already used throughout this codebase: `create policy "Authenticated M&L staff can do anything with X" on public.X for all to authenticated using (true) with check (true);`

---

### Task 1: Template tables migration

**Files:**
- Create: `supabase/migrations/00XX_sch_b_requirement_exception_templates.sql`

**Interfaces:**
- Produces: tables `requirement_templates`, `exception_templates`, `requirement_template_variants`, `exception_template_variants`. Task 2's TypeScript types, Task 3's tag renderer, Task 4's seed data, Task 5's actions, and Task 7/8's rewired chip actions all read/write these.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/00XX_sch_b_requirement_exception_templates.sql
create table public.requirement_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'Mortgage', 'Judgment', 'Lien', 'HOA', 'Tax',
    'Entity-Confirmation', 'Related-Document-Release', 'General'
  )),
  label text not null,
  body text not null,
  trigger_source_type text check (trigger_source_type in ('si', 'rel', 'lien')),
  parent_template_id uuid references public.requirement_templates(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.requirement_template_variants (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.requirement_templates(id) on delete cascade,
  state text,
  body text not null,
  created_at timestamptz not null default now(),
  unique (template_id, state)
);

create table public.exception_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'Mortgage', 'Judgment', 'Lien', 'HOA', 'Tax',
    'Entity-Confirmation', 'Related-Document-Release', 'General'
  )),
  label text not null,
  body text not null,
  trigger_source_type text check (trigger_source_type in ('em', 'easement')),
  parent_template_id uuid references public.exception_templates(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exception_template_variants (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.exception_templates(id) on delete cascade,
  state text,
  body text not null,
  created_at timestamptz not null default now(),
  unique (template_id, state)
);

create index requirement_templates_category_idx on public.requirement_templates(category);
create index requirement_templates_trigger_idx on public.requirement_templates(trigger_source_type);
create index requirement_template_variants_template_id_idx on public.requirement_template_variants(template_id);
create index exception_templates_category_idx on public.exception_templates(category);
create index exception_templates_trigger_idx on public.exception_templates(trigger_source_type);
create index exception_template_variants_template_id_idx on public.exception_template_variants(template_id);

alter table public.requirement_templates enable row level security;
alter table public.requirement_template_variants enable row level security;
alter table public.exception_templates enable row level security;
alter table public.exception_template_variants enable row level security;

create policy "Authenticated M&L staff can do anything with requirement_templates"
  on public.requirement_templates for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with requirement_template_variants"
  on public.requirement_template_variants for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with exception_templates"
  on public.exception_templates for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with exception_template_variants"
  on public.exception_template_variants for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply the migration locally and verify**

Run: `npx supabase db reset` (or the project's usual local-apply command)
Expected: migration applies cleanly, all 4 tables exist.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00XX_sch_b_requirement_exception_templates.sql
git commit -m "feat: add requirement/exception template tables"
```

---

### Task 2: Types, constants, and permission

**Files:**
- Modify: `src/lib/types.ts` (add types; widen `CommitmentRequirement.source_type` at line 273 and `CommitmentException.source_type` at line 287)
- Modify: `src/lib/constants.ts` (add `TEMPLATE_CATEGORIES`; add `manage_requirement_templates` to the `PERMISSIONS` array from the Staff Directory plan)

**Interfaces:**
- Consumes: `PERMISSIONS`/`PermissionKey` from the Staff Directory plan (Global Constraints dependency).
- Produces: `RequirementTemplate`, `ExceptionTemplate`, `RequirementTemplateVariant`, `ExceptionTemplateVariant`, `TEMPLATE_CATEGORIES`, `TemplateCategory`. Every later task imports these.

- [ ] **Step 1: Add template types to `src/lib/types.ts`**

```ts
export type TemplateCategory =
  | 'Mortgage'
  | 'Judgment'
  | 'Lien'
  | 'HOA'
  | 'Tax'
  | 'Entity-Confirmation'
  | 'Related-Document-Release'
  | 'General'

export type RequirementTemplate = {
  id: string
  category: TemplateCategory
  label: string
  body: string
  trigger_source_type: 'si' | 'rel' | 'lien' | null
  parent_template_id: string | null
  active: boolean
}

export type RequirementTemplateVariant = {
  id: string
  template_id: string
  state: string | null
  body: string
}

export type ExceptionTemplate = {
  id: string
  category: TemplateCategory
  label: string
  body: string
  trigger_source_type: 'em' | 'easement' | null
  parent_template_id: string | null
  active: boolean
}

export type ExceptionTemplateVariant = {
  id: string
  template_id: string
  state: string | null
  body: string
}
```

- [ ] **Step 2: Widen the source_type unions on the existing row types**

In `src/lib/types.ts`, change:
```ts
export type CommitmentRequirement = {
  ...
  source_type: 'si' | 'rel' | 'lien' | null
  ...
}
```
to:
```ts
export type CommitmentRequirement = {
  ...
  source_type: 'si' | 'rel' | 'lien' | 'template' | null
  ...
}
```

And change:
```ts
export type CommitmentException = {
  ...
  source_type: 'em' | null
  ...
}
```
to:
```ts
export type CommitmentException = {
  ...
  source_type: 'em' | 'easement' | 'template' | null
  ...
}
```

- [ ] **Step 3: Add `TEMPLATE_CATEGORIES` and the new permission to `src/lib/constants.ts`**

```ts
export const TEMPLATE_CATEGORIES = [
  'Mortgage', 'Judgment', 'Lien', 'HOA', 'Tax',
  'Entity-Confirmation', 'Related-Document-Release', 'General',
] as const
```

In the same file, add one entry to the existing `PERMISSIONS` array (from the Staff Directory plan):
```ts
export const PERMISSIONS = [
  { key: 'manage_users', label: 'Manage Users & Roles' },
  { key: 'manage_bill_codes', label: 'Manage Bill Codes' },
  { key: 'manage_checklist_templates', label: 'Manage Checklist Templates' },
  { key: 'manage_folder_templates', label: 'Manage Folder Templates' },
  { key: 'manage_lookup_data', label: 'Manage Lookup Data (Entity Directory)' },
  { key: 'manage_requirement_templates', label: 'Manage Requirement/Exception Templates' },
] as const
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: clean build — additive-only changes, nothing new imports them yet.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add requirement/exception template types and permission"
```

---

### Task 3: Tag renderer (`src/lib/template-tags.ts`)

**Files:**
- Create: `src/lib/template-tags.ts`
- Test: `src/lib/template-tags.test.ts` — this codebase has no unit test runner (Playwright e2e only, per Global Constraints of the Loan Info & Funding plan); write a small standalone assertion script instead, run via `npx tsx`.

**Interfaces:**
- Consumes: `SecurityInstrument`, `SecurityInstrumentRelatedDoc`, `Lien`, `ExceptionMatter`, `PropertyEasement`, `PropertyDetails`, `Order`, `PrelimSearch`, `Contact` (all `src/lib/types.ts`); `fmtDate`, `fmtCurrency` (`src/lib/format.ts`).
- Produces: `parseTemplateTags(body)`, `renderTemplateBody(body, context)`, `resolveVariantBody(body, variants, state)`, `buildFileLevelTags(...)`, `siFieldTags`, `siClauseTags`, `relClauseTags`, `lienFullText`, `emFieldTags`, `emClauseTags`, `easementFieldTags`, `easementClauseTags`. Tasks 4, 7, 8 all import from here.

- [ ] **Step 1: Write `src/lib/template-tags.ts`**

```ts
import type {
  SecurityInstrument,
  SecurityInstrumentRelatedDoc,
  Lien,
  ExceptionMatter,
  PropertyEasement,
  PropertyDetails,
  Order,
  PrelimSearch,
  Contact,
  RequirementTemplateVariant,
  ExceptionTemplateVariant,
} from '@/lib/types'
import { fmtDate, fmtCurrency } from '@/lib/format'

const TAG_PATTERN = /\{\{\s*([a-z0-9_]+)\.([a-z0-9_]+)\s*\}\}/g

const BRACKET_LABELS: Record<string, string> = {
  'security_instrument.mortgagor': 'Mortgagor',
  'security_instrument.mortgagee': 'Mortgagee',
  'security_instrument.type': 'Security Instrument',
  'security_instrument.trustee': 'Trustee',
  'lien.creditor': 'Creditor',
  'lien.debtor': 'Debtor',
  'lien.amount': 'Amount',
  'lien.type': 'Lien Type',
  'related_document.type': 'Related Document',
  'related_document.assignor': 'Assignor',
  'related_document.assignee': 'Assignee',
  'exception_matter.description': 'Matter',
  'easement.type': 'Easement Type',
  'easement.description': 'Easement Description',
  'deed.type': 'Deed Type',
  'loan.principal_amount': 'Loan Amount',
  'contact.buyer_names': 'Buyer/Borrower',
  'contact.seller_names': 'Seller',
  'property.county': 'County',
  'property.state': 'State',
  'property.legal_description': 'Legal Description',
  'order.file_number': 'File Number',
  'order.effective_date': 'Effective Date',
}

/** Returns every distinct `{{namespace.field}}` reference found in a template body. */
export function parseTemplateTags(body: string): { namespace: string; field: string }[] {
  const matches: { namespace: string; field: string }[] = []
  const re = new RegExp(TAG_PATTERN)
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    matches.push({ namespace: m[1], field: m[2] })
  }
  return matches
}

/**
 * `undefined` in context means "required field, missing" -> renders the bracket
 * placeholder (e.g. "[Mortgagor]"), matching the existing missing-data convention.
 * An empty string means "optional clause, legitimately absent" -> renders nothing.
 * This distinction is why clause-builder functions below always provide a string
 * (possibly ''), while simple field tags pass `?? undefined`.
 */
export function renderTemplateBody(body: string, context: Record<string, string | undefined>): string {
  return body.replace(TAG_PATTERN, (_whole, namespace: string, field: string) => {
    const key = `${namespace}.${field}`
    const value = context[key]
    if (value === undefined) return `[${BRACKET_LABELS[key] ?? key}]`
    return value
  })
}

/** Picks the order's state-specific variant body, falling back to the template's own body. */
export function resolveVariantBody(
  templateBody: string,
  variants: (RequirementTemplateVariant | ExceptionTemplateVariant)[],
  state: string | null
): string {
  if (state) {
    const match = variants.find((v) => v.state === state)
    if (match) return match.body
  }
  const general = variants.find((v) => v.state === null)
  return general ? general.body : templateBody
}

export function buildFileLevelTags(params: {
  order: Order
  property: PropertyDetails | null
  prelimSearch: PrelimSearch | null
  contacts: Contact[]
}): Record<string, string | undefined> {
  const { order, property, prelimSearch, contacts } = params
  const namesByRole = (role: string) => {
    const names = contacts.filter((c) => c.role === role).map((c) => c.name)
    return names.length ? names.join(' and ') : undefined
  }
  return {
    'property.county': property?.county ?? undefined,
    'property.state': property?.state ?? undefined,
    'property.legal_description': property?.full_legal_description ?? undefined,
    'order.file_number': order.file_number,
    'order.effective_date': prelimSearch?.effective_date ? fmtDate(prelimSearch.effective_date) : undefined,
    'contact.buyer_names': namesByRole('Buyer/Borrower'),
    'contact.seller_names': namesByRole('Seller'),
  }
}

export function siFieldTags(si: SecurityInstrument): Record<string, string | undefined> {
  return {
    'security_instrument.type': si.type || 'Security Instrument',
    'security_instrument.mortgagor': si.mortgagor ?? undefined,
    'security_instrument.mortgagee': si.mortgagee ?? undefined,
    'security_instrument.trustee': si.trustee ?? undefined,
  }
}

/**
 * Ported unchanged from the retired `siRequirementText` (src/lib/commitment-text.ts).
 * `party_clause` bakes in the trustee/no-trustee branch (structural, not wording — kept
 * as code); `optional_clauses` pre-joins the dated/recording/amount clauses with a
 * leading ", " so the seed template body can concatenate it directly without producing
 * doubled commas when a clause is absent.
 */
export function siClauseTags(si: SecurityInstrument): Record<string, string> {
  const partyClause = si.trustee
    ? `executed by ${si.mortgagor || '[Mortgagor]'} to ${si.trustee}, Trustee, for the benefit of ${si.mortgagee || '[Mortgagee]'}`
    : `executed by ${si.mortgagor || '[Mortgagor]'} to ${si.mortgagee || '[Mortgagee]'}`
  const parts: string[] = []
  if (si.dated_date) parts.push(`dated ${fmtDate(si.dated_date)}`)
  const recParts: string[] = []
  if (si.recorded_date) recParts.push(`recorded ${fmtDate(si.recorded_date)}`)
  const locBits: string[] = []
  if (si.book || si.page) locBits.push(`in Book ${si.book || '—'}, Page ${si.page || '—'}`)
  if (si.instrument_number) locBits.push(`Instrument No. ${si.instrument_number}`)
  if (locBits.length) recParts.push(locBits.join(', '))
  if (recParts.length) parts.push(recParts.join(' '))
  if (si.original_amount) parts.push(`securing an original amount of ${fmtCurrency(si.original_amount)}`)
  return {
    'security_instrument.party_clause': partyClause,
    'security_instrument.optional_clauses': parts.length ? `, ${parts.join(', ')}` : '',
  }
}

/** Ported unchanged from the retired `relRequirementText`. Same leading-comma convention as siClauseTags. */
export function relClauseTags(
  rel: SecurityInstrumentRelatedDoc,
  si: SecurityInstrument
): Record<string, string> {
  const parts: string[] = []
  if (rel.assignor || rel.assignee) parts.push(`from ${rel.assignor || '[Assignor]'} to ${rel.assignee || '[Assignee]'}`)
  if (rel.dated_date) parts.push(`dated ${fmtDate(rel.dated_date)}`)
  const recParts: string[] = []
  if (rel.recorded_date) recParts.push(`recorded ${fmtDate(rel.recorded_date)}`)
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
  return {
    'related_document.type': rel.type || 'Related Document',
    'related_document.detail_clause': parts.join(', '),
  }
}

/**
 * Liens branch into 5 structurally different sentences by lien.type (Lis Pendens reads
 * as a dismissal, not a release/satisfaction; Tax/HOA/Mechanics/generic each pick a
 * different "in favor of" source). That's true today in the pre-existing
 * `lienRequirementText` too. Rather than fake a decomposition that would produce
 * wrong sentences for some lien types, this ports that function's full logic
 * unchanged as one opaque `lien.full_text` tag — the seed template body is just
 * `{{lien.full_text}}`. Liens are not wording-editable per-state through the admin
 * panel as a result; flagged as a known limitation, same one that exists today.
 */
export function lienFullText(lien: Lien): string {
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
  if (datedDate) parts.push(`dated ${fmtDate(datedDate)}`)
  const filedParts: string[] = []
  const filed = lien.filed_date || lien.recorded_date
  if (filed) filedParts.push(`filed ${fmtDate(filed)}`)
  if (lien.court) filedParts.push(`in ${lien.court}`)
  if (filedParts.length) parts.push(filedParts.join(' '))
  const recParts: string[] = []
  if (lien.book || lien.page) recParts.push(`Book ${lien.book || '—'}, Page ${lien.page || '—'}`)
  if (lien.instrument_number) recParts.push(`Instrument No. ${lien.instrument_number}`)
  if (recParts.length) parts.push(recParts.join(', '))
  if (lien.amount) parts.push(`in the amount of ${fmtCurrency(lien.amount)}`)
  if (lien.type === 'Tax Sale Certificate' && lien.redemption_expiration) {
    parts.push(`redemption period expiring ${fmtDate(lien.redemption_expiration)}`)
  }
  return `Satisfaction of ${lien.type} ${parts.join(', ')}, to be released of record prior to closing.`
}

export function emFieldTags(em: ExceptionMatter): Record<string, string | undefined> {
  return { 'exception_matter.description': em.description || undefined }
}

/** Ported unchanged from the retired `emExceptionText`. */
export function emClauseTags(em: ExceptionMatter): Record<string, string> {
  const recParts: string[] = []
  if (em.recorded_date) recParts.push(`recorded ${fmtDate(em.recorded_date)}`)
  else if (em.dated_date) recParts.push(`dated ${fmtDate(em.dated_date)}`)
  const locBits: string[] = []
  if (em.book || em.page) locBits.push(`in Book ${em.book || '—'}, Page ${em.page || '—'}`)
  if (em.instrument_number) locBits.push(`Instrument No. ${em.instrument_number}`)
  if (locBits.length) recParts.push(locBits.join(', '))
  return {
    'exception_matter.description_or_default': em.description || '(matter of record)',
    'exception_matter.recording_clause': recParts.length ? `, ${recParts.join(' ')}` : '',
  }
}

export function easementFieldTags(easement: PropertyEasement): Record<string, string | undefined> {
  const typeLabel = easement.type === 'Other' && easement.other_type_text ? easement.other_type_text : easement.type
  return {
    'easement.type': typeLabel || undefined,
    'easement.description': easement.description ?? undefined,
  }
}

/** New — Property Easements had no prior text generator. Draft wording, not ALTA-sourced; review in the admin panel. */
export function easementClauseTags(easement: PropertyEasement): Record<string, string> {
  return {
    'easement.description_clause': easement.description ? `: ${easement.description}` : '',
  }
}
```

- [ ] **Step 2: Write the standalone assertion script**

```ts
// src/lib/template-tags.test.ts
import { parseTemplateTags, renderTemplateBody, siClauseTags, lienFullText } from './template-tags'
import type { SecurityInstrument, Lien } from './types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`PASS: ${msg}`)
}

assert(
  JSON.stringify(parseTemplateTags('Release of {{security_instrument.type}}, {{property.county}}')) ===
    JSON.stringify([
      { namespace: 'security_instrument', field: 'type' },
      { namespace: 'property', field: 'county' },
    ]),
  'parseTemplateTags finds all distinct tags in order'
)

assert(
  renderTemplateBody('{{property.county}} County', { 'property.county': 'Fulton' }) === 'Fulton County',
  'renderTemplateBody substitutes a present value'
)

assert(
  renderTemplateBody('{{property.county}} County', {}) === '[County] County',
  'renderTemplateBody falls back to the bracket placeholder when a key is undefined'
)

assert(
  renderTemplateBody('a{{lien.type}}b', { 'lien.type': '' }) === 'ab',
  'renderTemplateBody renders an explicit empty string as nothing, not a bracket'
)

const siNoTrustee = {
  type: 'Mortgage', mortgagor: 'Jane Smith', mortgagee: 'First National', trustee: null,
  dated_date: null, recorded_date: null, book: null, page: null, instrument_number: null, original_amount: null,
} as unknown as SecurityInstrument
const clauses = siClauseTags(siNoTrustee)
assert(
  clauses['security_instrument.party_clause'] === 'executed by Jane Smith to First National',
  'siClauseTags omits the trustee clause when trustee is null'
)
assert(clauses['security_instrument.optional_clauses'] === '', 'siClauseTags produces no optional clause text when all fields are absent')

const lisPendens = { type: 'Lis Pendens', plaintiff: 'ACME Corp', defendant: 'John Doe', case_number: '2024-CV-100', court: 'Superior Court' } as unknown as Lien
assert(
  lienFullText(lisPendens).startsWith('Dismissal of Lis Pendens filed by ACME Corp against John Doe'),
  'lienFullText branches to Dismissal wording for Lis Pendens'
)

console.log('All template-tags assertions passed.')
```

- [ ] **Step 3: Run the assertions**

Run: `npx tsx src/lib/template-tags.test.ts`
Expected: 6 `PASS:` lines then `All template-tags assertions passed.`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/template-tags.ts src/lib/template-tags.test.ts
git commit -m "feat: add smart-tag renderer for requirement/exception templates"
```

---

### Task 4: Seed migration

**Files:**
- Create: `supabase/migrations/00XX_sch_b_requirement_exception_templates_seed.sql`

**Interfaces:**
- Consumes: the tag names defined in Task 3 (bodies below must match those exactly).
- Produces: seeded rows Task 7 depends on (`trigger_source_type` lookups must find exactly one active row per si/rel/lien/em/easement).

- [ ] **Step 1: Write the seed migration**

```sql
-- supabase/migrations/00XX_sch_b_requirement_exception_templates_seed.sql
-- Auto-triggered templates: straight ports of the retired commitment-text.ts
-- generators (src/lib/template-tags.ts's siClauseTags/relClauseTags/emClauseTags),
-- so behavior is unchanged until someone edits these in the admin panel.
insert into public.requirement_templates (category, label, body, trigger_source_type) values
  ('Mortgage', 'Release of Security Instrument',
   'Release of {{security_instrument.type}} {{security_instrument.party_clause}}{{security_instrument.optional_clauses}}, to be released of record prior to closing.',
   'si'),
  ('Related-Document-Release', 'Release of Related Document',
   'Release of {{related_document.type}} {{related_document.detail_clause}}, to be released of record prior to closing.',
   'rel'),
  ('Lien', 'Satisfaction/Dismissal of Lien',
   '{{lien.full_text}}',
   'lien');

-- ALTA Standard Requirements 1-4, verbatim per Cam's Screen Notes 2026-09-09.
-- No file-data tags in 1-3 (fixed boilerplate); 4a/4b are optional children of 4.
insert into public.requirement_templates (category, label, body, trigger_source_type) values
  ('General', 'ALTA Standard Requirement 1',
   'The Proposed Insured must notify the Company in writing of the name of any party not referred to in this Commitment who will obtain an interest in the Land or who will make a loan on the Land. The Company may then make additional Requirements or Exceptions.',
   null),
  ('General', 'ALTA Standard Requirement 2',
   'Pay the agreed amount for the estate or interest to be insured.',
   null),
  ('General', 'ALTA Standard Requirement 3',
   'Pay the premiums, fees, and charges for the Policy to the Company.',
   null),
  ('General', 'ALTA Standard Requirement 4',
   'Documents satisfactory to the Company that convey the Title or create the Mortgage to be insured, or both, must be properly authorized, executed, delivered, and recorded in the Public Records.',
   null);

insert into public.requirement_templates (category, label, body, trigger_source_type, parent_template_id) values
  ('General', 'ALTA Standard Requirement 4a (Deed)',
   '{{deed.type}} from {{contact.seller_names}} to {{contact.buyer_names}}, to recorded among the land records for {{property.county}} County, {{property.state}}.',
   null,
   (select id from public.requirement_templates where label = 'ALTA Standard Requirement 4')),
  ('General', 'ALTA Standard Requirement 4b (Security Instrument)',
   '{{security_instrument.type}} from {{contact.buyer_names}} to {{security_instrument.mortgagee}}, securing the principal sum of {{loan.principal_amount}} to be recorded among the land records for {{property.county}} County, {{property.state}}.',
   null,
   (select id from public.requirement_templates where label = 'ALTA Standard Requirement 4'));

-- Entity-Confirmation: Cam's own trigger rule ("when Buyer/Borrower or Seller's
-- entity type isn't Individual, suggest additional entity-confirmation
-- requirements/exceptions"). Draft wording pending Cam's review in the admin panel
-- (not ALTA-sourced, unlike Requirements 1-4 above).
insert into public.requirement_templates (category, label, body, trigger_source_type) values
  ('Entity-Confirmation', 'Entity Authority Documents',
   'Provide the Company with a copy of the organizational and authority documents (e.g. Articles of Organization/Incorporation, Operating Agreement/Bylaws, and a Certificate of Good Standing) for {{contact.buyer_names}}, evidencing the authority of the person executing documents on its behalf.',
   null);

-- Auto-triggered exception template: straight port of the retired emExceptionText.
insert into public.exception_templates (category, label, body, trigger_source_type) values
  ('General', 'Exception Matter',
   '{{exception_matter.description_or_default}}{{exception_matter.recording_clause}}.',
   'em');

-- Auto-triggered exception template for Property Access/Easements/ROW — new source
-- type, no prior generator existed. Draft wording pending Cam's review.
insert into public.exception_templates (category, label, body, trigger_source_type) values
  ('General', 'Property Easement',
   '{{easement.type}}{{easement.description_clause}}, as shown by the public records.',
   'easement');

-- ALTA Standard Exceptions 1-5, verbatim per Cam's Screen Notes 2026-09-09. Fixed
-- boilerplate, no tags.
insert into public.exception_templates (category, label, body, trigger_source_type) values
  ('General', 'ALTA Standard Exception 1',
   'Any defect, lien, encumbrance, adverse claim, or other matter that appears for the first time in the Public Records or is created, attaches, or is disclosed between the Commitment Date and the date on which all of the Schedule B, Part I—Requirements are met.',
   null),
  ('General', 'ALTA Standard Exception 2',
   'Rights or claims of parties in possession of the Land not shown by the public records.',
   null),
  ('General', 'ALTA Standard Exception 3',
   'Rights of tenants in possession or under unrecorded leases.',
   null),
  ('General', 'ALTA Standard Exception 4',
   'Easements, or claims of easements, not shown by the public records.',
   null),
  ('General', 'ALTA Standard Exception 5',
   'Any lien or right to a lien, for services, labor, or material heretofore or hereafter furnished, imposed by law and not shown by the public records.',
   null);

-- Entity-Confirmation exception counterpart to the requirement above. Draft wording.
insert into public.exception_templates (category, label, body, trigger_source_type) values
  ('Entity-Confirmation', 'Entity Authority Matters',
   'Matters relating to the organization, existence, and authority of {{contact.buyer_names}} to hold title and/or execute the instruments necessary to convey or encumber the Land.',
   null);
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: seed rows present — `select count(*) from requirement_templates` returns 8, `select count(*) from exception_templates` returns 8.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00XX_sch_b_requirement_exception_templates_seed.sql
git commit -m "feat: seed requirement/exception templates (ALTA Standard 1-5, converged auto-chip templates)"
```

---

### Task 5: Template admin server actions

**Files:**
- Create: `src/app/actions/requirement-templates.ts`
- Create: `src/app/actions/exception-templates.ts`

**Interfaces:**
- Consumes: `hasPermission` (`src/lib/permissions.ts`, Staff Directory plan — Global Constraints dependency), types from Task 2.
- Produces: `listRequirementTemplates()`, `createRequirementTemplate`, `updateRequirementTemplate`, `setRequirementTemplateActive`, `upsertRequirementTemplateVariant`, `deleteRequirementTemplateVariant` and the mirrored `*ExceptionTemplate*` set. Task 6 (admin UI) and Task 8 (library picker) both call these.

- [ ] **Step 1: Write `src/app/actions/requirement-templates.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import type { RequirementTemplate, RequirementTemplateVariant } from '@/lib/types'

async function requirePermission() {
  const supabase = await createClient()
  if (!(await hasPermission(supabase, 'manage_requirement_templates'))) {
    redirect('/orders')
  }
  return supabase
}

export async function listRequirementTemplates(): Promise<
  (RequirementTemplate & { variants: RequirementTemplateVariant[] })[]
> {
  const supabase = await createClient()
  const { data: templates } = await supabase.from('requirement_templates').select('*').order('label')
  const { data: variants } = await supabase.from('requirement_template_variants').select('*')
  return (templates ?? []).map((t) => ({
    ...t,
    variants: (variants ?? []).filter((v) => v.template_id === t.id),
  }))
}

export async function createRequirementTemplate(formData: FormData) {
  const supabase = await requirePermission()
  const category = formData.get('category') as string
  const label = formData.get('label') as string
  const body = formData.get('body') as string
  const parentTemplateId = (formData.get('parent_template_id') as string) || null

  const { error } = await supabase.from('requirement_templates').insert({ category, label, body, parent_template_id: parentTemplateId })
  if (error) console.error('createRequirementTemplate failed:', error)
  revalidatePath('/', 'layout')
}

export async function updateRequirementTemplate(templateId: string, formData: FormData) {
  const supabase = await requirePermission()
  const category = formData.get('category') as string
  const label = formData.get('label') as string
  const body = formData.get('body') as string

  const { error } = await supabase
    .from('requirement_templates')
    .update({ category, label, body, updated_at: new Date().toISOString() })
    .eq('id', templateId)
  if (error) console.error('updateRequirementTemplate failed:', error)
  revalidatePath('/', 'layout')
}

export async function setRequirementTemplateActive(templateId: string, active: boolean) {
  const supabase = await requirePermission()
  const { error } = await supabase.from('requirement_templates').update({ active }).eq('id', templateId)
  if (error) console.error('setRequirementTemplateActive failed:', error)
  revalidatePath('/', 'layout')
}

export async function upsertRequirementTemplateVariant(templateId: string, formData: FormData) {
  const supabase = await requirePermission()
  const state = (formData.get('state') as string) || null
  const body = formData.get('body') as string

  const { error } = await supabase
    .from('requirement_template_variants')
    .upsert({ template_id: templateId, state, body }, { onConflict: 'template_id,state' })
  if (error) console.error('upsertRequirementTemplateVariant failed:', error)
  revalidatePath('/', 'layout')
}

export async function deleteRequirementTemplateVariant(variantId: string) {
  const supabase = await requirePermission()
  const { error } = await supabase.from('requirement_template_variants').delete().eq('id', variantId)
  if (error) console.error('deleteRequirementTemplateVariant failed:', error)
  revalidatePath('/', 'layout')
}
```

- [ ] **Step 2: Write `src/app/actions/exception-templates.ts`** (identical shape, `exception_templates`/`exception_template_variants`)

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import type { ExceptionTemplate, ExceptionTemplateVariant } from '@/lib/types'

async function requirePermission() {
  const supabase = await createClient()
  if (!(await hasPermission(supabase, 'manage_requirement_templates'))) {
    redirect('/orders')
  }
  return supabase
}

export async function listExceptionTemplates(): Promise<
  (ExceptionTemplate & { variants: ExceptionTemplateVariant[] })[]
> {
  const supabase = await createClient()
  const { data: templates } = await supabase.from('exception_templates').select('*').order('label')
  const { data: variants } = await supabase.from('exception_template_variants').select('*')
  return (templates ?? []).map((t) => ({
    ...t,
    variants: (variants ?? []).filter((v) => v.template_id === t.id),
  }))
}

export async function createExceptionTemplate(formData: FormData) {
  const supabase = await requirePermission()
  const category = formData.get('category') as string
  const label = formData.get('label') as string
  const body = formData.get('body') as string
  const parentTemplateId = (formData.get('parent_template_id') as string) || null

  const { error } = await supabase.from('exception_templates').insert({ category, label, body, parent_template_id: parentTemplateId })
  if (error) console.error('createExceptionTemplate failed:', error)
  revalidatePath('/', 'layout')
}

export async function updateExceptionTemplate(templateId: string, formData: FormData) {
  const supabase = await requirePermission()
  const category = formData.get('category') as string
  const label = formData.get('label') as string
  const body = formData.get('body') as string

  const { error } = await supabase
    .from('exception_templates')
    .update({ category, label, body, updated_at: new Date().toISOString() })
    .eq('id', templateId)
  if (error) console.error('updateExceptionTemplate failed:', error)
  revalidatePath('/', 'layout')
}

export async function setExceptionTemplateActive(templateId: string, active: boolean) {
  const supabase = await requirePermission()
  const { error } = await supabase.from('exception_templates').update({ active }).eq('id', templateId)
  if (error) console.error('setExceptionTemplateActive failed:', error)
  revalidatePath('/', 'layout')
}

export async function upsertExceptionTemplateVariant(templateId: string, formData: FormData) {
  const supabase = await requirePermission()
  const state = (formData.get('state') as string) || null
  const body = formData.get('body') as string

  const { error } = await supabase
    .from('exception_template_variants')
    .upsert({ template_id: templateId, state, body }, { onConflict: 'template_id,state' })
  if (error) console.error('upsertExceptionTemplateVariant failed:', error)
  revalidatePath('/', 'layout')
}

export async function deleteExceptionTemplateVariant(variantId: string) {
  const supabase = await requirePermission()
  const { error } = await supabase.from('exception_template_variants').delete().eq('id', variantId)
  if (error) console.error('deleteExceptionTemplateVariant failed:', error)
  revalidatePath('/', 'layout')
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/requirement-templates.ts src/app/actions/exception-templates.ts
git commit -m "feat: add requirement/exception template admin actions"
```

---

### Task 6: Admin console UI

**Files:**
- Create: `src/app/admin/requirement-templates/page.tsx`
- Create: `src/components/AdminTemplateConsole.tsx`
- Modify: the admin nav (wherever Bill Codes/Checklist Templates/Folder Templates links live — locate via `grep -rn "folder-templates" src/components` at execution time and add a matching "Requirement/Exception Templates" link)

**Interfaces:**
- Consumes: Task 5's actions and list functions.
- Produces: the `/admin/requirement-templates` screen. No later task depends on this directly (it's the terminal admin UI).

- [ ] **Step 1: Write `src/app/admin/requirement-templates/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import { listRequirementTemplates } from '@/app/actions/requirement-templates'
import { listExceptionTemplates } from '@/app/actions/exception-templates'
import { AdminTemplateConsole } from '@/components/AdminTemplateConsole'

export default async function RequirementTemplatesAdminPage() {
  const supabase = await createClient()
  if (!(await hasPermission(supabase, 'manage_requirement_templates'))) {
    redirect('/orders')
  }

  const [requirementTemplates, exceptionTemplates] = await Promise.all([
    listRequirementTemplates(),
    listExceptionTemplates(),
  ])

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Requirement/Exception Templates</h1>
      <AdminTemplateConsole requirementTemplates={requirementTemplates} exceptionTemplates={exceptionTemplates} />
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/AdminTemplateConsole.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { TEMPLATE_CATEGORIES } from '@/lib/constants'
import {
  createRequirementTemplate,
  updateRequirementTemplate,
  setRequirementTemplateActive,
  upsertRequirementTemplateVariant,
  deleteRequirementTemplateVariant,
} from '@/app/actions/requirement-templates'
import {
  createExceptionTemplate,
  updateExceptionTemplate,
  setExceptionTemplateActive,
  upsertExceptionTemplateVariant,
  deleteExceptionTemplateVariant,
} from '@/app/actions/exception-templates'
import type {
  RequirementTemplate,
  RequirementTemplateVariant,
  ExceptionTemplate,
  ExceptionTemplateVariant,
} from '@/lib/types'

type TemplateWithVariants<T> = T & { variants: (RequirementTemplateVariant | ExceptionTemplateVariant)[] }

function TemplateList<T extends { id: string; category: string; label: string; body: string; active: boolean }>({
  templates,
  create,
  update,
  setActive,
  upsertVariant,
  deleteVariant,
}: {
  templates: TemplateWithVariants<T>[]
  create: (formData: FormData) => Promise<void>
  update: (templateId: string, formData: FormData) => Promise<void>
  setActive: (templateId: string, active: boolean) => Promise<void>
  upsertVariant: (templateId: string, formData: FormData) => Promise<void>
  deleteVariant: (variantId: string) => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {templates.map((t) => (
        <div key={t.id} className="rounded border p-4">
          {editingId === t.id ? (
            <form
              action={async (formData: FormData) => {
                await update(t.id, formData)
                setEditingId(null)
              }}
              className="space-y-2"
            >
              <select name="category" defaultValue={t.category} className="rounded border px-2 py-1">
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input name="label" defaultValue={t.label} className="w-full rounded border px-3 py-2" />
              <textarea name="body" defaultValue={t.body} rows={3} className="w-full rounded border px-3 py-2 font-mono text-sm" />
              <div className="flex gap-2">
                <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                  Save
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="rounded border px-3 py-1.5 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500">{t.category}</p>
                <p className="font-medium">{t.label}</p>
                <p className="mt-1 whitespace-pre-wrap font-mono text-sm text-slate-600">{t.body}</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingId(t.id)} className="text-sm text-slate-600 hover:underline">
                  Edit
                </button>
                <form action={setActive.bind(null, t.id, !t.active)}>
                  <button type="submit" className="text-sm text-slate-600 hover:underline">
                    {t.active ? 'Deactivate' : 'Activate'}
                  </button>
                </form>
              </div>
            </div>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-slate-500">
              State variants ({t.variants.filter((v) => v.state !== null).length})
            </summary>
            <ul className="mt-2 space-y-2">
              {t.variants
                .filter((v) => v.state !== null)
                .map((v) => (
                  <li key={v.id} className="rounded border p-2 text-sm">
                    <p className="font-medium">{v.state}</p>
                    <p className="whitespace-pre-wrap font-mono">{v.body}</p>
                    <form action={deleteVariant.bind(null, v.id)}>
                      <button type="submit" className="text-red-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
            </ul>
            <form action={upsertVariant.bind(null, t.id)} className="mt-2 space-y-2">
              <input name="state" placeholder="State (e.g. TX)" required className="rounded border px-2 py-1" />
              <textarea name="body" placeholder="State-specific wording" rows={2} required className="w-full rounded border px-3 py-2 font-mono text-sm" />
              <button type="submit" className="rounded border px-3 py-1.5 text-sm">
                Add/Update Variant
              </button>
            </form>
          </details>
        </div>
      ))}

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add a template</summary>
        <form action={create} className="mt-3 space-y-2">
          <select name="category" className="rounded border px-2 py-1">
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input name="label" placeholder="Label" required className="w-full rounded border px-3 py-2" />
          <textarea name="body" placeholder="Body (use {{namespace.field}} for smart tags)" rows={3} required className="w-full rounded border px-3 py-2 font-mono text-sm" />
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
            Add Template
          </button>
        </form>
      </details>
    </div>
  )
}

export function AdminTemplateConsole({
  requirementTemplates,
  exceptionTemplates,
}: {
  requirementTemplates: TemplateWithVariants<RequirementTemplate>[]
  exceptionTemplates: TemplateWithVariants<ExceptionTemplate>[]
}) {
  const [tab, setTab] = useState<'requirements' | 'exceptions'>('requirements')

  return (
    <div>
      <div className="mb-4 flex gap-4 border-b">
        <button
          type="button"
          onClick={() => setTab('requirements')}
          className={`pb-2 ${tab === 'requirements' ? 'border-b-2 border-slate-900 font-medium' : 'text-slate-500'}`}
        >
          Requirements
        </button>
        <button
          type="button"
          onClick={() => setTab('exceptions')}
          className={`pb-2 ${tab === 'exceptions' ? 'border-b-2 border-slate-900 font-medium' : 'text-slate-500'}`}
        >
          Exceptions
        </button>
      </div>

      {tab === 'requirements' ? (
        <TemplateList
          templates={requirementTemplates}
          create={createRequirementTemplate}
          update={updateRequirementTemplate}
          setActive={setRequirementTemplateActive}
          upsertVariant={upsertRequirementTemplateVariant}
          deleteVariant={deleteRequirementTemplateVariant}
        />
      ) : (
        <TemplateList
          templates={exceptionTemplates}
          create={createExceptionTemplate}
          update={updateExceptionTemplate}
          setActive={setExceptionTemplateActive}
          upsertVariant={upsertExceptionTemplateVariant}
          deleteVariant={deleteExceptionTemplateVariant}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add the nav link**

Run: `grep -rn "folder-templates" src/components` to find the admin nav file, then add a `"Requirement/Exception Templates"` link to `/admin/requirement-templates` next to the existing Bill Codes/Checklist Templates/Folder Templates links, matching that file's existing markup exactly.

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, sign in as a user with `manage_requirement_templates`, visit `/admin/requirement-templates`.
Expected: 8 requirement templates and 8 exception templates listed under their respective tabs, category/label/body all visible, Edit/Activate/Deactivate all work, adding a state variant to "ALTA Standard Requirement 4a (Deed)" for state "TX" and reloading shows it under that template.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/requirement-templates/page.tsx src/components/AdminTemplateConsole.tsx
git commit -m "feat: add requirement/exception template admin console"
```

---

### Task 7: Rewire the existing auto-chips onto templates

**Files:**
- Modify: `src/app/actions/commitment-sch-b.ts:34-75` (`addRequirementFromChip`), `:149-170` (`addExceptionFromChip`)
- Modify: `src/lib/commitment-text.ts` (remove `siRequirementText`, `relRequirementText`, `lienRequirementText`, `emExceptionText` — keep `reorderForNumbering`/`computeReqLabels`, which are unrelated)
- Modify: `src/components/commitment-sch-b/ExceptionsSection.tsx:29-30` (easement chips), `:39` (chip action call signature)

**Interfaces:**
- Consumes: `siFieldTags`, `siClauseTags`, `relClauseTags`, `lienFullText`, `emFieldTags`, `emClauseTags`, `easementFieldTags`, `easementClauseTags`, `renderTemplateBody`, `resolveVariantBody`, `buildFileLevelTags` (Task 3).
- Produces: `addRequirementFromChip` unchanged signature (still called from `RequirementsSection.tsx`); `addExceptionFromChip` gains a `sourceType: 'em' | 'easement'` parameter — Task 10 updates its one call site in `ExceptionsSection.tsx` to match.

- [ ] **Step 1: Rewrite `addRequirementFromChip` in `src/app/actions/commitment-sch-b.ts`**

Replace lines 34-75 with:

```ts
import {
  renderTemplateBody,
  resolveVariantBody,
  buildFileLevelTags,
  siFieldTags,
  siClauseTags,
  relClauseTags,
  lienFullText,
  emFieldTags,
  emClauseTags,
  easementFieldTags,
  easementClauseTags,
} from '@/lib/template-tags'

async function fetchFileTagContext(supabase: Awaited<ReturnType<typeof createClient>>, orderId: string) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single()
  const { data: property } = await supabase.from('property_details').select('*').eq('order_id', orderId).maybeSingle()
  const { data: prelim } = await supabase.from('prelim_search').select('*').eq('order_id', orderId).maybeSingle()
  const { data: contacts } = await supabase.from('contacts').select('*').eq('order_id', orderId)
  return {
    fileTags: buildFileLevelTags({ order, property: property ?? null, prelimSearch: prelim ?? null, contacts: contacts ?? [] }),
    state: property?.state ?? null,
  }
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
  const { fileTags, state } = await fetchFileTagContext(supabase, orderId)
  let description = ''

  if (sourceType === 'si') {
    const { data: si } = await supabase.from('security_instruments').select('*').eq('id', sourceId).single()
    const { data: template } = await supabase.from('requirement_templates').select('*').eq('trigger_source_type', 'si').eq('active', true).limit(1).maybeSingle()
    if (si && template) {
      const { data: variants } = await supabase.from('requirement_template_variants').select('*').eq('template_id', template.id)
      const body = resolveVariantBody(template.body, variants ?? [], state)
      description = renderTemplateBody(body, { ...fileTags, ...siFieldTags(si), ...siClauseTags(si) })
    }
  } else if (sourceType === 'rel') {
    const { data: rel } = await supabase.from('security_instrument_related_docs').select('*').eq('id', sourceId).single()
    if (rel) {
      const { data: si } = await supabase.from('security_instruments').select('*').eq('id', rel.security_instrument_id).single()
      const { data: template } = await supabase.from('requirement_templates').select('*').eq('trigger_source_type', 'rel').eq('active', true).limit(1).maybeSingle()
      if (si && template) {
        const { data: variants } = await supabase.from('requirement_template_variants').select('*').eq('template_id', template.id)
        const body = resolveVariantBody(template.body, variants ?? [], state)
        description = renderTemplateBody(body, { ...fileTags, ...relClauseTags(rel, si) })
      }
    }
  } else if (sourceType === 'lien') {
    const { data: lien } = await supabase.from('liens').select('*').eq('id', sourceId).single()
    const { data: template } = await supabase.from('requirement_templates').select('*').eq('trigger_source_type', 'lien').eq('active', true).limit(1).maybeSingle()
    if (lien && template) {
      const { data: variants } = await supabase.from('requirement_template_variants').select('*').eq('template_id', template.id)
      const body = resolveVariantBody(template.body, variants ?? [], state)
      description = renderTemplateBody(body, { ...fileTags, 'lien.full_text': lienFullText(lien) })
    }
  }

  if (!description) fail(orderId, 'Could not generate requirement text from that source.')

  const { error } = await supabase.from('commitment_requirements').insert({
    order_id: orderId,
    description,
    source_type: sourceType,
    source_id: sourceId,
    parent_requirement_id: parentRequirementId,
    sort_order: await nextRequirementSortOrder(supabase, orderId),
  })

  if (error) {
    console.error('addRequirementFromChip failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath('/', 'layout')
}
```

- [ ] **Step 2: Rewrite `addExceptionFromChip` to accept a `sourceType` and handle `easement`**

Replace lines 149-170 with:

```ts
export async function addExceptionFromChip(orderId: string, sourceType: 'em' | 'easement', sourceId: string, formData: FormData) {
  void formData
  const supabase = await createClient()
  const { fileTags, state } = await fetchFileTagContext(supabase, orderId)
  let description = ''

  if (sourceType === 'em') {
    const { data: em } = await supabase.from('exception_matters').select('*').eq('id', sourceId).single()
    const { data: template } = await supabase.from('exception_templates').select('*').eq('trigger_source_type', 'em').eq('active', true).limit(1).maybeSingle()
    if (em && template) {
      const { data: variants } = await supabase.from('exception_template_variants').select('*').eq('template_id', template.id)
      const body = resolveVariantBody(template.body, variants ?? [], state)
      description = renderTemplateBody(body, { ...fileTags, ...emFieldTags(em), ...emClauseTags(em) })
    }
  } else if (sourceType === 'easement') {
    const { data: easement } = await supabase.from('property_easements').select('*').eq('id', sourceId).single()
    const { data: template } = await supabase.from('exception_templates').select('*').eq('trigger_source_type', 'easement').eq('active', true).limit(1).maybeSingle()
    if (easement && template) {
      const { data: variants } = await supabase.from('exception_template_variants').select('*').eq('template_id', template.id)
      const body = resolveVariantBody(template.body, variants ?? [], state)
      description = renderTemplateBody(body, { ...fileTags, ...easementFieldTags(easement), ...easementClauseTags(easement) })
    }
  }

  if (!description) fail(orderId, 'Could not generate exception text from that source.')
  const { error } = await supabase.from('commitment_exceptions').insert({
    order_id: orderId,
    description,
    source_type: sourceType,
    source_id: sourceId,
    sort_order: await nextExceptionSortOrder(supabase, orderId),
  })

  if (error) {
    console.error('addExceptionFromChip failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath('/', 'layout')
}
```

- [ ] **Step 3: Remove the 4 retired functions from `src/lib/commitment-text.ts`**

Delete `siRequirementText`, `relRequirementText`, `lienRequirementText`, `emExceptionText` (lines 4-92 of the current file) and their now-unused imports (`SecurityInstrument`, `SecurityInstrumentRelatedDoc`, `Lien`, `ExceptionMatter`, `fmtCurrency` — check `reorderForNumbering`/`computeReqLabels` still only need `CommitmentRequirement` and `fmtDate` is no longer used either, confirm via `grep -n "fmtDate\|fmtCurrency" src/lib/commitment-text.ts` after deleting and trim imports to match).

- [ ] **Step 4: Update `ExceptionsSection.tsx`'s one call site**

In `src/components/commitment-sch-b/ExceptionsSection.tsx:39`, change:
```tsx
<form key={em.id} action={addExceptionFromChip.bind(null, orderId, em.id)}>
```
to:
```tsx
<form key={em.id} action={addExceptionFromChip.bind(null, orderId, 'em', em.id)}>
```

(Easement chips themselves are added in Task 10, which also updates this file's props and adds the easement chip row.)

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 6: Run the existing Schedule B e2e spec**

Run: `npx playwright test order-entry.spec.ts -g "commitment schedule B"`
Expected: PASS — clicking an SI/Related-Doc/Lien/Exception-Matter chip still produces byte-identical text to before this task (the seed template bodies were designed to reproduce the retired functions exactly).

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/commitment-sch-b.ts src/lib/commitment-text.ts src/components/commitment-sch-b/ExceptionsSection.tsx
git commit -m "feat: rewire auto-chips onto requirement/exception templates"
```

---

### Task 8: Library-pick server actions

**Files:**
- Modify: `src/app/actions/commitment-sch-b.ts` (add two new actions)

**Interfaces:**
- Consumes: `renderTemplateBody`, `resolveVariantBody`, `buildFileLevelTags`, `siFieldTags`, `siClauseTags`, `relClauseTags` (a manually-picked template can reference the same scoped tags), `lienFullText`.
- Produces: `addRequirementFromTemplate(orderId, templateId, parentRequirementId, chosenSourceIds, childSelections)`, `addExceptionFromTemplate(orderId, templateId, chosenSourceIds)`. Task 10's library picker calls both.

- [ ] **Step 1: Add `addRequirementFromTemplate` to `src/app/actions/commitment-sch-b.ts`**

```ts
/**
 * chosenSourceIds maps a scoped tag namespace ("security_instrument", "lien",
 * "related_document") to the specific record id the picker resolved it to (silently,
 * if there was exactly one candidate, or via the popup if there were several). Never
 * trusts client-supplied text — only ids, re-fetched and re-rendered here.
 */
export async function addRequirementFromTemplate(
  orderId: string,
  templateId: string,
  parentRequirementId: string | null,
  chosenSourceIds: Record<string, string>,
  childTemplateIds: string[]
) {
  const supabase = await createClient()
  const { fileTags, state } = await fetchFileTagContext(supabase, orderId)

  async function renderOne(id: string): Promise<string> {
    const { data: template } = await supabase.from('requirement_templates').select('*').eq('id', id).single()
    if (!template) return ''
    const { data: variants } = await supabase.from('requirement_template_variants').select('*').eq('template_id', id)
    const body = resolveVariantBody(template.body, variants ?? [], state)

    let scoped: Record<string, string | undefined> = {}
    if (chosenSourceIds.security_instrument) {
      const { data: si } = await supabase.from('security_instruments').select('*').eq('id', chosenSourceIds.security_instrument).single()
      if (si) scoped = { ...scoped, ...siFieldTags(si), ...siClauseTags(si) }
    }
    if (chosenSourceIds.lien) {
      const { data: lien } = await supabase.from('liens').select('*').eq('id', chosenSourceIds.lien).single()
      if (lien) scoped = { ...scoped, 'lien.full_text': lienFullText(lien), 'lien.type': lien.type, 'lien.creditor': lien.creditor ?? undefined, 'lien.debtor': lien.debtor ?? undefined, 'lien.amount': lien.amount != null ? String(lien.amount) : undefined }
    }
    return renderTemplateBody(body, { ...fileTags, ...scoped })
  }

  const parentDescription = await renderOne(templateId)
  if (!parentDescription) fail(orderId, 'Could not generate requirement text from that template.')

  const { data: inserted, error } = await supabase
    .from('commitment_requirements')
    .insert({
      order_id: orderId,
      description: parentDescription,
      source_type: 'template',
      source_id: templateId,
      parent_requirement_id: parentRequirementId,
      sort_order: await nextRequirementSortOrder(supabase, orderId),
    })
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('addRequirementFromTemplate failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  for (const childId of childTemplateIds) {
    const childDescription = await renderOne(childId)
    if (!childDescription) continue
    await supabase.from('commitment_requirements').insert({
      order_id: orderId,
      description: childDescription,
      source_type: 'template',
      source_id: childId,
      parent_requirement_id: inserted!.id,
      sort_order: await nextRequirementSortOrder(supabase, orderId),
    })
  }

  revalidatePath('/', 'layout')
}
```

- [ ] **Step 2: Add `addExceptionFromTemplate`**

```ts
export async function addExceptionFromTemplate(orderId: string, templateId: string, chosenSourceIds: Record<string, string>) {
  const supabase = await createClient()
  const { fileTags, state } = await fetchFileTagContext(supabase, orderId)

  const { data: template } = await supabase.from('exception_templates').select('*').eq('id', templateId).single()
  if (!template) fail(orderId, 'Could not generate exception text from that template.')
  const { data: variants } = await supabase.from('exception_template_variants').select('*').eq('template_id', templateId)
  const body = resolveVariantBody(template!.body, variants ?? [], state)

  let scoped: Record<string, string | undefined> = {}
  if (chosenSourceIds.exception_matter) {
    const { data: em } = await supabase.from('exception_matters').select('*').eq('id', chosenSourceIds.exception_matter).single()
    if (em) scoped = { ...scoped, ...emFieldTags(em), ...emClauseTags(em) }
  }
  if (chosenSourceIds.easement) {
    const { data: easement } = await supabase.from('property_easements').select('*').eq('id', chosenSourceIds.easement).single()
    if (easement) scoped = { ...scoped, ...easementFieldTags(easement), ...easementClauseTags(easement) }
  }

  const description = renderTemplateBody(body, { ...fileTags, ...scoped })
  const { error } = await supabase.from('commitment_exceptions').insert({
    order_id: orderId,
    description,
    source_type: 'template',
    source_id: templateId,
    sort_order: await nextExceptionSortOrder(supabase, orderId),
  })

  if (error) {
    console.error('addExceptionFromTemplate failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath('/', 'layout')
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/commitment-sch-b.ts
git commit -m "feat: add server actions for adding requirements/exceptions from the template library"
```

---

### Task 9: Load template/property/contact data on the Schedule B page

**Files:**
- Modify: `src/app/orders/[id]/commitment-sch-b/page.tsx`

**Interfaces:**
- Consumes: `listRequirementTemplates`, `listExceptionTemplates` (Task 5), `resolveVariantBody` (Task 3).
- Produces: `requirementTemplates`, `exceptionTemplates` (each pre-resolved to the order's state variant and filtered to `active`), `propertyEasements`, `contacts` props. Task 10's `RequirementsSection`/`ExceptionsSection` consume these.

- [ ] **Step 1: Add the new data loads and pass new props**

In `src/app/orders/[id]/commitment-sch-b/page.tsx`, after the existing `exceptionMatters` load, add:

```tsx
import { listRequirementTemplates } from '@/app/actions/requirement-templates'
import { listExceptionTemplates } from '@/app/actions/exception-templates'
import { resolveVariantBody } from '@/lib/template-tags'

// ... inside the component, after exceptionMatters is loaded:
const { data: property } = await supabase.from('property_details').select('*').eq('order_id', id).maybeSingle()
const { data: propertyEasements } = property
  ? await supabase.from('property_easements').select('*').eq('property_id', property.id).order('created_at')
  : { data: [] }
const { data: contacts } = await supabase.from('contacts').select('*').eq('order_id', id)

const allRequirementTemplates = await listRequirementTemplates()
const allExceptionTemplates = await listExceptionTemplates()
const state = property?.state ?? null
const requirementTemplates = allRequirementTemplates
  .filter((t) => t.active)
  .map((t) => ({ ...t, body: resolveVariantBody(t.body, t.variants, state) }))
const exceptionTemplates = allExceptionTemplates
  .filter((t) => t.active)
  .map((t) => ({ ...t, body: resolveVariantBody(t.body, t.variants, state) }))
```

Then pass `requirementTemplates`, `contacts` to `<RequirementsSection>` and `propertyEasements`, `exceptionTemplates`, `contacts` to `<ExceptionsSection>` alongside the props already passed.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: TypeScript errors on `RequirementsSection`/`ExceptionsSection` prop mismatches — expected, Task 10 adds those props.

- [ ] **Step 3: Commit**

```bash
git add src/app/orders/\[id\]/commitment-sch-b/page.tsx
git commit -m "feat: load template/property/contact data on the Schedule B page"
```

---

### Task 10: Library picker UI + easement chips

**Files:**
- Modify: `src/components/commitment-sch-b/RequirementsSection.tsx`
- Modify: `src/components/commitment-sch-b/ExceptionsSection.tsx`

**Interfaces:**
- Consumes: `parseTemplateTags` (Task 3), `addRequirementFromTemplate`/`addExceptionFromTemplate` (Task 8), `TEMPLATE_CATEGORIES` (Task 2), the props added in Task 9.
- Produces: the "From Library" picker, wired end to end. Terminal UI task before entity-type suggestions (Task 11).

- [ ] **Step 1: Add the library picker to `RequirementsSection.tsx`**

Add new props `requirementTemplates: (RequirementTemplate & { variants: unknown[] })[]` and add this block inside the component, right after the existing chip row's closing `)}`:

```tsx
const [libraryPickerTemplate, setLibraryPickerTemplate] = useState<RequirementTemplate | null>(null)
const [categoryFilter, setCategoryFilter] = useState<string>('')
const [search, setSearch] = useState('')

const childTemplates = (parentId: string) => requirementTemplates.filter((t) => t.parent_template_id === parentId)
const topLevelTemplates = requirementTemplates.filter((t) => !t.parent_template_id)
const filteredTemplates = topLevelTemplates.filter(
  (t) =>
    (!categoryFilter || t.category === categoryFilter) &&
    (!search || t.label.toLowerCase().includes(search.toLowerCase()))
)

function candidatesFor(namespace: string) {
  if (namespace === 'security_instrument') return securityInstruments
  if (namespace === 'lien') return liens
  return []
}

function ambiguousNamespaces(template: RequirementTemplate) {
  const tags = [
    ...parseTemplateTags(template.body),
    ...childTemplates(template.id).flatMap((c) => parseTemplateTags(c.body)),
  ]
  const namespaces = [...new Set(tags.map((t) => t.namespace))]
  return namespaces.filter((ns) => candidatesFor(ns).length > 1)
}
```

Add the picker markup (inside the same `{!readOnly && ...}` block as the existing "Add a requirement" `<details>`):

```tsx
{!readOnly && (
  <details className="mt-4 rounded border p-4">
    <summary className="cursor-pointer font-medium">From Library</summary>
    <div className="mt-3 flex flex-wrap gap-2">
      <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded border px-2 py-1 text-sm">
        <option value="">All categories</option>
        {[...new Set(topLevelTemplates.map((t) => t.category))].map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
        className="rounded border px-2 py-1 text-sm"
      />
    </div>
    <ul className="mt-3 space-y-1">
      {filteredTemplates.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => setLibraryPickerTemplate(t)}
            className="w-full rounded border px-3 py-2 text-left text-sm hover:bg-slate-50"
          >
            <span className="text-xs uppercase text-slate-500">{t.category}</span> — {t.label}
          </button>
        </li>
      ))}
    </ul>
  </details>
)}

{libraryPickerTemplate && (
  <LibraryPickerModal
    orderId={orderId}
    template={libraryPickerTemplate}
    children={childTemplates(libraryPickerTemplate.id)}
    ambiguousNamespaces={ambiguousNamespaces(libraryPickerTemplate)}
    candidatesFor={candidatesFor}
    onClose={() => setLibraryPickerTemplate(null)}
  />
)}
```

Add the modal component in the same file, below `RequirementsSection`:

```tsx
function LibraryPickerModal({
  orderId,
  template,
  children,
  ambiguousNamespaces,
  candidatesFor,
  onClose,
}: {
  orderId: string
  template: RequirementTemplate
  children: RequirementTemplate[]
  ambiguousNamespaces: string[]
  candidatesFor: (namespace: string) => { id: string; [key: string]: unknown }[]
  onClose: () => void
}) {
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [checkedChildren, setCheckedChildren] = useState<string[]>([])

  const namespaceLabel = (record: { [key: string]: unknown }) =>
    (record.type as string) || (record.description as string) || 'Record'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-4">
        <p className="mb-3 font-medium">{template.label}</p>
        {ambiguousNamespaces.map((ns) => (
          <div key={ns} className="mb-3">
            <p className="mb-1 text-sm font-medium">Which {ns.replace('_', ' ')}?</p>
            {candidatesFor(ns).map((record) => (
              <label key={record.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={ns}
                  checked={choices[ns] === record.id}
                  onChange={() => setChoices((c) => ({ ...c, [ns]: record.id }))}
                />
                {namespaceLabel(record)}
              </label>
            ))}
          </div>
        ))}
        {children.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-sm font-medium">Include:</p>
            {children.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checkedChildren.includes(c.id)}
                  onChange={(e) =>
                    setCheckedChildren((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                  }
                />
                {c.label}
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <form
            action={async () => {
              await addRequirementFromTemplate(orderId, template.id, null, choices, checkedChildren)
              onClose()
            }}
          >
            <button
              type="submit"
              disabled={ambiguousNamespaces.some((ns) => !choices[ns])}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

Add the two new imports at the top of the file: `import { parseTemplateTags } from '@/lib/template-tags'`, `import { addRequirementFromTemplate } from '@/app/actions/commitment-sch-b'`, and `import type { RequirementTemplate } from '@/lib/types'`.

- [ ] **Step 2: Add the easement chip row + library picker to `ExceptionsSection.tsx`**

Add new props `propertyEasements: PropertyEasement[]`, `exceptionTemplates: ExceptionTemplate[]`. Update the `usedSources` filter and chip row to include easements, matching the existing `emChips` pattern:

```tsx
const easementChips = propertyEasements.filter((pe) => !usedSources.has(`easement:${pe.id}`))
```

```tsx
{easementChips.map((pe) => (
  <form key={pe.id} action={addExceptionFromChip.bind(null, orderId, 'easement', pe.id)}>
    <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100" data-testid="easement-exc-chip">
      + {pe.type === 'Other' && pe.other_type_text ? pe.other_type_text : pe.type}
    </button>
  </form>
))}
```

Add the same "From Library" `<details>` block and a simplified `LibraryPickerModal` variant (no child-template checkboxes needed for exceptions, since no exception template has children yet — reuse the same component shape as Step 1 but calling `addExceptionFromTemplate(orderId, template.id, choices)` with `candidatesFor` mapped to `exception_matter`/`easement` namespaces using `exceptionMatters`/`propertyEasements`).

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: clean build — Task 9's prop-mismatch errors are now resolved.

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, open a test order's Schedule B.
Expected: "From Library" panel lists all 4 ALTA Standard Requirements plus Entity Authority Documents; clicking "ALTA Standard Requirement 4" with 2+ Security Instruments on the file shows the picker popup; checking one and the 4a/4b children, then Add, inserts 1-3 new requirement rows correctly numbered/nested.

- [ ] **Step 5: Commit**

```bash
git add src/components/commitment-sch-b/RequirementsSection.tsx src/components/commitment-sch-b/ExceptionsSection.tsx
git commit -m "feat: add From Library picker and easement chips to Schedule B"
```

---

### Task 11: Entity-type proactive suggestion

**Files:**
- Modify: `src/components/commitment-sch-b/RequirementsSection.tsx`
- Modify: `src/components/commitment-sch-b/ExceptionsSection.tsx`

**Interfaces:**
- Consumes: `contacts: Contact[]` (Task 9), the Entity-Confirmation category templates already present in `requirementTemplates`/`exceptionTemplates` props.

- [ ] **Step 1: Add the suggestion group to `RequirementsSection.tsx`**

```tsx
const nonIndividualParty = contacts.some(
  (c) => (c.role === 'Buyer/Borrower' || c.role === 'Seller') && c.entity_type !== 'Individual'
)
const suggestedTemplates = nonIndividualParty
  ? requirementTemplates.filter((t) => t.category === 'Entity-Confirmation' && !t.parent_template_id)
  : []
```

Render, right above the "From Library" `<details>`:

```tsx
{!readOnly && suggestedTemplates.length > 0 && (
  <div className="mb-4 flex flex-wrap gap-2" data-testid="entity-confirmation-suggestions">
    <p className="w-full text-xs text-slate-500">Suggested — a party's Entity Type isn't Individual:</p>
    {suggestedTemplates.map((t) => (
      <button
        key={t.id}
        type="button"
        onClick={() => setLibraryPickerTemplate(t)}
        className="rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-xs text-amber-800 hover:bg-amber-100"
      >
        + {t.label}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 2: Mirror the same block in `ExceptionsSection.tsx`** using `exceptionTemplates` and its own library picker state.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/commitment-sch-b/RequirementsSection.tsx src/components/commitment-sch-b/ExceptionsSection.tsx
git commit -m "feat: surface Entity-Confirmation templates when a party isn't an Individual"
```

---

### Task 12: e2e regression test and full suite

**Files:**
- Create: `tests/e2e/sch-b-template-library.spec.ts`

**Interfaces:**
- Consumes: the full stack built in Tasks 1-11.

- [ ] **Step 1: Write the e2e spec**

```ts
import { test, expect } from '@playwright/test'
// Follow this repo's existing order-creation/navigation helpers from order-entry.spec.ts
// (import and reuse them rather than duplicating setup).

test('adds a requirement from the template library, including its optional children', async ({ page }) => {
  // Navigate to a test order's Schedule B (reuse existing spec's setup helper).
  await page.goto('/orders/TEST_ORDER_ID/commitment-sch-b')

  await page.getByText('From Library').click()
  await page.getByRole('button', { name: /ALTA Standard Requirement 4/ }).click()

  // If the file has multiple Security Instruments, the popup asks which one -
  // pick the first radio option.
  const radios = page.locator('input[type="radio"]')
  if (await radios.count()) {
    await radios.first().check()
  }
  await page.getByLabel(/4a/).check()
  await page.getByRole('button', { name: 'Add' }).click()

  await expect(page.getByTestId('requirement-row')).toContainText('Documents satisfactory to the Company')
  await expect(page.getByTestId('requirement-row')).toContainText('to recorded among the land records for')
})

test('easement chip on Exceptions renders the Property Access/Easement template', async ({ page }) => {
  await page.goto('/orders/TEST_ORDER_ID_WITH_EASEMENT/commitment-sch-b')
  await page.getByTestId('easement-exc-chip').first().click()
  await expect(page.getByTestId('exception-row').last()).toContainText('as shown by the public records')
})
```

(Fill in real test order IDs / setup by following the exact pattern the existing `order-entry.spec.ts` "commitment schedule B" test already uses for seeding a test order with Security Instruments and Property Easements — do not invent a different setup mechanism.)

- [ ] **Step 2: Run the new spec**

Run: `npx playwright test sch-b-template-library.spec.ts`
Expected: both tests PASS.

- [ ] **Step 3: Run the full e2e suite**

Run: `npx playwright test`
Expected: all tests PASS, including the pre-existing "commitment schedule B" spec (unchanged behavior for the converged auto-chips).

- [ ] **Step 4: Update the Fix Plan**

Add a completed entry to `M&L Title - Obsidian Vault/Genesis Screen Notes - Fix Plan.md` noting this item as built, referencing the spec and this plan file, matching the existing "Built" entry format used elsewhere in that document.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/sch-b-template-library.spec.ts
git commit -m "test: add e2e coverage for the requirement/exception template library"
```
