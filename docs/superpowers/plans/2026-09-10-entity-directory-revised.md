# Entity Directory (Lender Vertical Slice) Implementation Plan — Revised

> **Supersedes** `2026-08-29-entity-directory.md`. That plan was written against an 8/29 snapshot of the codebase; re-verifying it against today's code (per [[Entity Directory - Implementation Readiness]] Q6) found it would fail outright if run as written. This plan fixes those issues and folds in Cam's 2026-09-10 answers. See the 8/29 file's own header for a pointer here — it stays in place as history, not deleted.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared Entity Directory system (firm-wide, Lookup-Code-driven contact directory with fuzzy-dedup) across the 10 role types Cam confirmed want it, and fully wire up Lender — the only role type with a known field set — end to end as the proof slice, **folded directly into the existing `AddContactForm.tsx` role picker** rather than a separate "Add Lender" entry point (Cam's explicit call, 2026-09-10 — `role` is already a structured picker there, not free text, so there's no reason for a parallel form).

**What changed from the 8/29 plan, and why:**

1. **Role list corrected.** The old plan invented a 13-value `role_type` list (`Abstractor, Lender, Mortgage Broker, Tax Collector, Recording Office, Buying Agent, Selling Agent, General Contractor, Sub Contractor, Title Company, Settlement Agent, Underwriter, Counter Signature`) that doesn't match anything Contacts actually has. This plan uses the app's real `CONTACT_ROLES` (`src/lib/constants.ts`), minus `Buyer/Borrower` and `Seller` (transaction parties, not reusable firm vendors — flagged to Cam as an assumption, not yet explicitly confirmed) — 10 role types. See Task 2/3.
2. **Task 1 trimmed.** shadcn/ui is already installed (`components.json` exists, most primitives already in `src/components/ui/`) — only `command`, `popover`, and `table` are missing.
3. **Task 2's migration fixed.** `public.profiles` already exists (migration `0018`, `can_manage_folder_templates` column) — this plan `alter table`s it to add `can_manage_lookup_data`, it does not `create table` from scratch. Migration number is `0053` (the real current head is `0052`, not `0003`).
4. **No separate `AddLenderPanel` / no `ContactsSection.tsx` changes.** Cam: "'Add Lender' needs to be folded into the existing Contact role picker." `DirectoryLookupField` is rendered directly inside `AddContactForm.tsx`, conditional on the selected role being Directory-eligible and the form being in add-new-contact mode. This also means Task 6's old e2e flow (`click "Add Lender" button` → `Save Lender`) is rewritten to match: open the existing "Add a contact" disclosure, select Role = Lender, use the Directory field, submit the existing "Add Contact" button.
5. **CSV export/import and the admin page are deferred to a separate Phase 2 plan** (Cam's answer, Q4 — "Save and Add New entry and the picker with CSV to come later, is perfectly fine"). This plan stops after fuzzy-dedup e2e coverage (old Task 7) and a full regression pass. The old plan's Tasks 8–10 (CSV utility, admin page, permission-gate e2e) are not reproduced here — write them as their own plan once there's real data worth bulk-managing. `can_manage_lookup_data` is still added to the schema now (Task 2) since the RLS deactivation-gate policy needs it to exist, even with no UI to grant it yet — same precedent as `can_manage_folder_templates` today (no self-service grant path either).
6. **Lender's `details` shape gets Cam's preference-profile fields folded in now** (Q3 — "Yes"), not deferred. Field names below are a first pass, not yet individually confirmed with Cam field-by-field — flag for a quick check before Task 2 ships if any look wrong.
7. **"Local VIP Client Management" vs. "Local Lookup, eventually Global Access" vs. "Local only"** (Cam's Q1 grouping) is not yet a concrete schema distinction — nothing in this plan encodes different behavior per group beyond which roles get the nested `entity_directory_people` roster (the VIP group: Lender, Mortgage Broker, Selling Agent, Listing Agent). What "eventually Global Access" or "Local only" mean structurally is still an open question, not answered by this revision — don't assume it's handled.

**Architecture:** Unchanged from the 8/29 design — one shared `entity_directory` table (+ `entity_directory_people` for the 4 VIP-client roles) keyed by `role_type`, server-generated Lookup Codes, copy-once-decouple into a Contact (no live FK from an order back into the directory), `pg_trgm` fuzzy-dedup on the search picker and add-flow.

**Tech Stack:** Unchanged — Next.js 16 (App Router, Server Actions), React 19, Supabase (Postgres + `@supabase/ssr`), Tailwind CSS 4, shadcn/ui, Playwright e2e only (no unit-test framework in this repo).

**Spec:** `M&L Title - Obsidian Vault/Genesis Rebuild - Entity Directory Design.md`, refined by `M&L Title - Obsidian Vault/Entity Directory - Implementation Readiness.md`.

## Global Constraints

- Migrations use `text` columns + `check (col in (...))` for enums, never native Postgres `enum` types.
- Every new table gets `id uuid primary key default gen_random_uuid()`, RLS enabled, an explicit policy block.
- Server actions are `'use server'` files under `src/app/actions/`, use `createClient()` from `@/lib/supabase/server`.
- No unit-test framework — all new logic covered via Playwright e2e against the real dev server and the real seeded Supabase project (`genesis-e2e-seed@genesis-app-e2e-test.dev` / `E2eSeedPass123!`).
- shadcn/ui primitives already installed; only add what's missing (Task 1).
- `AddContactForm.tsx` is a **shared** component used for both adding a new contact (uncontrolled `action` submit) and editing an existing one (autosave via `saveContact`) — the Directory picker only renders in add-new-contact mode (`!contact`), never when editing.

---

## Task 1: Add the 3 missing shadcn primitives

**Files:**
- Modify: `package.json` (shadcn CLI adds the new deps)
- Create: `src/components/ui/command.tsx`, `src/components/ui/popover.tsx`, `src/components/ui/table.tsx`

- [ ] **Step 1: Add the missing primitives**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npx shadcn@latest add command popover table
```

Do **not** run `shadcn@latest init` — `components.json` and the rest of `src/components/ui/` already exist.

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/components/ui/command.tsx src/components/ui/popover.tsx src/components/ui/table.tsx
git commit -m "chore: add shadcn command/popover/table primitives for Entity Directory"
```

---

## Task 2: Migration — `profiles.can_manage_lookup_data`, `entity_directory`, `entity_directory_people`

**Files:**
- Create: `supabase/migrations/0053_entity_directory.sql`

**Interfaces:**
- Produces: `public.profiles.can_manage_lookup_data` (new column on the existing table), tables `public.entity_directory(id, lookup_code, role_type, name, address_line1, address_line2, city, state, zip, county, phone, fax, email, license_number, details, is_active, created_at, updated_at, created_by, updated_by)`, `public.entity_directory_people(id, entity_id, first_name, last_name, title, email, phone, ext, cell)`, `public.entity_directory_code_sequences(role_type, next_value)`; functions `public.generate_entity_lookup_code(text, text)`, `public.set_entity_directory_lookup_code()` (trigger), `public.search_entity_directory(text, text, integer)`, `public.find_entity_directory_duplicates(text, text, real)`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0053_entity_directory.sql

create extension if not exists pg_trgm;

-- profiles already exists (0018_profiles_permissions.sql, can_manage_folder_templates
-- for Attachments' admin gate) -- add a second gate column, don't recreate the table.
alter table public.profiles
  add column can_manage_lookup_data boolean not null default false;

-- Per-role-type Lookup Code counters (avoids 10 named Postgres sequences).
create table public.entity_directory_code_sequences (
  role_type text primary key,
  next_value integer not null default 1
);

create or replace function public.generate_entity_lookup_code(p_role_type text, p_prefix text)
returns text
language plpgsql
as $$
declare
  v_next integer;
begin
  insert into public.entity_directory_code_sequences (role_type, next_value)
  values (p_role_type, 2)
  on conflict (role_type) do update
    set next_value = entity_directory_code_sequences.next_value + 1
  returning next_value - 1 into v_next;

  return p_prefix || '-' || lpad(v_next::text, 4, '0');
end;
$$;

-- Role list matches CONTACT_ROLES (src/lib/constants.ts) minus Buyer/Borrower and
-- Seller -- those are transaction parties, not reusable firm vendors, so they never
-- belong in a firm-wide directory (flagged to Cam in the readiness doc, not yet
-- explicitly confirmed -- revisit if he says otherwise).
create table public.entity_directory (
  id uuid primary key default gen_random_uuid(),
  lookup_code text unique,
  role_type text not null check (role_type in (
    'Lender', 'Mortgage Broker', 'Underwriter', 'Settlement Agent', 'Title Company',
    'Listing Agent (Seller''s Agent)', 'Selling Agent (Buyer''s Agent)',
    'Recording Office', 'Tax Collector', 'Payoff Lender'
  )),
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  county text,
  phone text,
  fax text,
  email text,
  license_number text,
  details jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create or replace function public.set_entity_directory_lookup_code()
returns trigger
language plpgsql
as $$
declare
  v_prefix text;
begin
  if new.lookup_code is not null then
    return new;
  end if;

  v_prefix := case new.role_type
    when 'Lender' then 'LEN'
    when 'Mortgage Broker' then 'MB'
    when 'Underwriter' then 'UW'
    when 'Settlement Agent' then 'SET'
    when 'Title Company' then 'TC'
    when 'Listing Agent (Seller''s Agent)' then 'LST'
    when 'Selling Agent (Buyer''s Agent)' then 'SEL'
    when 'Recording Office' then 'REC'
    when 'Tax Collector' then 'TAX'
    when 'Payoff Lender' then 'PL'
  end;

  new.lookup_code := public.generate_entity_lookup_code(new.role_type, v_prefix);
  return new;
end;
$$;

create trigger entity_directory_set_lookup_code
  before insert on public.entity_directory
  for each row
  execute function public.set_entity_directory_lookup_code();

create index entity_directory_name_trgm_idx
  on public.entity_directory using gin (name gin_trgm_ops);
create index entity_directory_role_type_idx
  on public.entity_directory (role_type);
create index entity_directory_active_idx
  on public.entity_directory (is_active) where is_active = true;

-- The 4 "Local VIP Client Management" roles (Cam's Q1 grouping) get a nested people
-- roster; the rest don't.
create table public.entity_directory_people (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entity_directory(id) on delete cascade,
  first_name text not null,
  last_name text,
  title text,
  email text,
  phone text,
  ext text,
  cell text,
  created_at timestamptz not null default now()
);

create index entity_directory_people_entity_id_idx
  on public.entity_directory_people(entity_id);

-- Search: always server-filtered by role_type, ranked by trigram similarity.
-- Never called without a role_type -- the picker never lists "all entities."
create or replace function public.search_entity_directory(p_role_type text, p_query text, p_limit integer default 10)
returns setof public.entity_directory
language sql
stable
as $$
  select *
  from public.entity_directory
  where role_type = p_role_type
    and is_active = true
    and name % p_query
  order by similarity(name, p_query) desc
  limit p_limit;
$$;

-- Dedup check used by "Save and Add New" (CSV row-insert reuse deferred to Phase 2).
create or replace function public.find_entity_directory_duplicates(p_role_type text, p_name text, p_threshold real default 0.45)
returns setof public.entity_directory
language sql
stable
as $$
  select *
  from public.entity_directory
  where role_type = p_role_type
    and is_active = true
    and similarity(name, p_name) >= p_threshold
  order by similarity(name, p_name) desc
  limit 5;
$$;

alter table public.entity_directory enable row level security;
alter table public.entity_directory_people enable row level security;

create policy "Authenticated M&L staff can view entity_directory"
  on public.entity_directory
  for select
  to authenticated
  using (true);

create policy "Authenticated M&L staff can insert entity_directory"
  on public.entity_directory
  for insert
  to authenticated
  with check (true);

-- Any authenticated user can edit a record, but only a user with
-- can_manage_lookup_data can flip is_active to false. No self-service grant path
-- exists yet -- same precedent as can_manage_folder_templates (0018).
create policy "Authenticated M&L staff can update entity_directory, deactivation gated"
  on public.entity_directory
  for update
  to authenticated
  using (true)
  with check (
    is_active = true
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and can_manage_lookup_data = true
    )
  );

create policy "Only permitted users can delete entity_directory"
  on public.entity_directory
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and can_manage_lookup_data = true
    )
  );

create policy "Authenticated M&L staff can do anything with entity_directory_people"
  on public.entity_directory_people
  for all
  to authenticated
  using (true)
  with check (true);
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP's `apply_migration` tool against project `hlahrypglnmjjxrdtfkm` (matches how `0049`–`0052` were applied this project).

- [ ] **Step 3: Verify the schema landed**

Run (Supabase MCP `execute_sql`): `select table_name from information_schema.tables where table_schema = 'public' and table_name in ('entity_directory', 'entity_directory_people', 'entity_directory_code_sequences') order by table_name;` and `select column_name from information_schema.columns where table_name = 'profiles';`
Expected: all three table names returned; `profiles` columns include both `can_manage_folder_templates` and `can_manage_lookup_data`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0053_entity_directory.sql
git commit -m "feat: add entity_directory schema, lookup code generation, can_manage_lookup_data"
```

---

## Task 3: Constants and types

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `ENTITY_DIRECTORY_ROLE_TYPES: readonly string[]`, `ENTITY_DIRECTORY_ROLE_TYPES_WITH_PEOPLE: readonly string[]`, `type EntityDirectoryRoleType`, `type EntityDirectoryRecord`, `type EntityDirectoryPerson`, `type LenderDetails`.

- [ ] **Step 1: Add constants**

Append to `src/lib/constants.ts`:

```typescript
// Matches CONTACT_ROLES minus Buyer/Borrower and Seller (transaction parties, not
// reusable firm vendors -- see Entity Directory - Implementation Readiness.md Q2/Q6).
export const ENTITY_DIRECTORY_ROLE_TYPES = [
  'Lender',
  'Mortgage Broker',
  'Underwriter',
  'Settlement Agent',
  'Title Company',
  "Listing Agent (Seller's Agent)",
  "Selling Agent (Buyer's Agent)",
  'Recording Office',
  'Tax Collector',
  'Payoff Lender',
] as const

// Cam's "Local VIP Client Management" group (2026-09-10) -- these get a nested
// entity_directory_people roster; the rest don't.
export const ENTITY_DIRECTORY_ROLE_TYPES_WITH_PEOPLE = [
  'Lender',
  'Mortgage Broker',
  "Selling Agent (Buyer's Agent)",
  "Listing Agent (Seller's Agent)",
] as const
```

- [ ] **Step 2: Add types**

Append to `src/lib/types.ts`:

```typescript
export type EntityDirectoryRoleType =
  | 'Lender'
  | 'Mortgage Broker'
  | 'Underwriter'
  | 'Settlement Agent'
  | 'Title Company'
  | "Listing Agent (Seller's Agent)"
  | "Selling Agent (Buyer's Agent)"
  | 'Recording Office'
  | 'Tax Collector'
  | 'Payoff Lender'

// Preference-profile fields per Cam's Q3 answer ("Yes," fold in settlement type/CD-HUD
// preference, Premium/Endorsement policy-type defaults, communication routing) --
// first-pass field names, not yet confirmed field-by-field with Cam. Flag before Task 2
// ships if any look wrong.
export type LenderDetails = {
  nmls_number: string | null
  cdf_payee_type: string | null
  proposed_insured_clause: string | null
  vesting_loss_payable: string | null
  settlement_type_preference: string | null
  cd_hud_preference: string | null
  premium_policy_type_default: string | null
  endorsement_defaults: string | null
  communication_routing: string | null
}

export type EntityDirectoryRecord = {
  id: string
  lookup_code: string
  role_type: EntityDirectoryRoleType
  name: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  county: string | null
  phone: string | null
  fax: string | null
  email: string | null
  license_number: string | null
  details: Record<string, unknown>
  is_active: boolean
}

export type EntityDirectoryPerson = {
  id: string
  entity_id: string
  first_name: string
  last_name: string | null
  title: string | null
  email: string | null
  phone: string | null
  ext: string | null
  cell: string | null
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/types.ts
git commit -m "feat: add entity directory constants and types"
```

---

## Task 4: Server actions — search, create (with fuzzy-dedup), update, deactivate

**Files:**
- Create: `src/app/actions/entity-directory.ts`
- Test: `tests/e2e/entity-directory.spec.ts` (created here, extended in Task 7)

**Interfaces:**
- Consumes: `EntityDirectoryRecord`, `EntityDirectoryRoleType` from `@/lib/types`; `createClient` from `@/lib/supabase/server`.
- Produces:
  - `searchEntityDirectory(roleType: EntityDirectoryRoleType, query: string): Promise<EntityDirectoryRecord[]>`
  - `createDirectoryEntry(roleType: EntityDirectoryRoleType, formData: FormData): Promise<{ status: 'created'; record: EntityDirectoryRecord } | { status: 'duplicates_found'; candidates: EntityDirectoryRecord[]; pendingName: string; pendingFormData: Record<string, string> }>`
  - `confirmCreateAsNew(roleType: EntityDirectoryRoleType, pendingFormData: Record<string, string>): Promise<EntityDirectoryRecord>`
  - `mergeIntoExisting(existingId: string, pendingFormData: Record<string, string>): Promise<EntityDirectoryRecord>`
  - `deactivateDirectoryEntry(id: string): Promise<void>` (no UI calls this yet — Phase 2's admin page will; kept here since the RLS policy already supports it)

This task is unchanged from the 8/29 plan's Task 4 **except** it drops `refillContactFromDirectory` (that assumed a live lookup-code-keyed refill after the fact; Task 6 below copies directory fields into the Contact form directly at add-time instead, so a separate refill path isn't needed for this slice) and drops the CSV-related exports (Phase 2). Write:

```typescript
// src/app/actions/entity-directory.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import type { EntityDirectoryRecord, EntityDirectoryRoleType } from '@/lib/types'

export async function searchEntityDirectory(
  roleType: EntityDirectoryRoleType,
  query: string
): Promise<EntityDirectoryRecord[]> {
  const supabase = await createClient()
  if (!query.trim()) return []

  const { data, error } = await supabase.rpc('search_entity_directory', {
    p_role_type: roleType,
    p_query: query,
    p_limit: 10,
  })

  if (error) {
    console.error('searchEntityDirectory failed:', error)
    return []
  }

  return data as EntityDirectoryRecord[]
}

function formDataToRecord(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') result[key] = value
  }
  return result
}

async function insertDirectoryRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roleType: EntityDirectoryRoleType,
  fields: Record<string, string>
): Promise<EntityDirectoryRecord> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('entity_directory')
    .insert({
      role_type: roleType,
      name: fields.name,
      address_line1: fields.address_line1 || null,
      address_line2: fields.address_line2 || null,
      city: fields.city || null,
      state: fields.state || null,
      zip: fields.zip || null,
      county: fields.county || null,
      phone: fields.phone || null,
      fax: fields.fax || null,
      email: fields.email || null,
      license_number: fields.license_number || null,
      details: {
        nmls_number: fields.nmls_number || null,
        cdf_payee_type: fields.cdf_payee_type || null,
        proposed_insured_clause: fields.proposed_insured_clause || null,
        vesting_loss_payable: fields.vesting_loss_payable || null,
        settlement_type_preference: fields.settlement_type_preference || null,
        cd_hud_preference: fields.cd_hud_preference || null,
        premium_policy_type_default: fields.premium_policy_type_default || null,
        endorsement_defaults: fields.endorsement_defaults || null,
        communication_routing: fields.communication_routing || null,
      },
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`insertDirectoryRow failed: ${error.message}`)
  return data as EntityDirectoryRecord
}

export async function createDirectoryEntry(
  roleType: EntityDirectoryRoleType,
  formData: FormData
): Promise<
  | { status: 'created'; record: EntityDirectoryRecord }
  | {
      status: 'duplicates_found'
      candidates: EntityDirectoryRecord[]
      pendingName: string
      pendingFormData: Record<string, string>
    }
> {
  const supabase = await createClient()
  const fields = formDataToRecord(formData)
  const name = fields.name

  const { data: candidates, error: dupError } = await supabase.rpc(
    'find_entity_directory_duplicates',
    { p_role_type: roleType, p_name: name, p_threshold: 0.45 }
  )

  if (dupError) {
    console.error('find_entity_directory_duplicates failed:', dupError)
  }

  if (candidates && candidates.length > 0) {
    return {
      status: 'duplicates_found',
      candidates: candidates as EntityDirectoryRecord[],
      pendingName: name,
      pendingFormData: fields,
    }
  }

  const record = await insertDirectoryRow(supabase, roleType, fields)
  return { status: 'created', record }
}

export async function confirmCreateAsNew(
  roleType: EntityDirectoryRoleType,
  pendingFormData: Record<string, string>
): Promise<EntityDirectoryRecord> {
  const supabase = await createClient()
  return insertDirectoryRow(supabase, roleType, pendingFormData)
}

export async function mergeIntoExisting(
  existingId: string,
  pendingFormData: Record<string, string>
): Promise<EntityDirectoryRecord> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('entity_directory')
    .update({
      name: pendingFormData.name,
      address_line1: pendingFormData.address_line1 || null,
      address_line2: pendingFormData.address_line2 || null,
      city: pendingFormData.city || null,
      state: pendingFormData.state || null,
      zip: pendingFormData.zip || null,
      county: pendingFormData.county || null,
      phone: pendingFormData.phone || null,
      fax: pendingFormData.fax || null,
      email: pendingFormData.email || null,
      license_number: pendingFormData.license_number || null,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existingId)
    .select()
    .single()

  if (error) throw new Error(`mergeIntoExisting failed: ${error.message}`)
  return data as EntityDirectoryRecord
}

export async function deactivateDirectoryEntry(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('entity_directory')
    .update({ is_active: false })
    .eq('id', id)

  if (error) throw new Error(`deactivateDirectoryEntry failed: ${error.message}`)
}
```

- [ ] **Step 1: Commit**

```bash
git add src/app/actions/entity-directory.ts
git commit -m "feat: add entity directory server actions (search, create with fuzzy-dedup, merge, deactivate)"
```

---

## Task 5: `DirectoryLookupField` — search/add combobox

Unchanged from the 8/29 plan's Task 5 — this component is generic across role types and had no drift.

**Files:**
- Create: `src/components/DirectoryLookupField.tsx`

```tsx
// src/components/DirectoryLookupField.tsx
'use client'

import { useState, useTransition } from 'react'
import { Command, CommandInput, CommandList, CommandItem } from '@/components/ui/command'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { searchEntityDirectory } from '@/app/actions/entity-directory'
import type { EntityDirectoryRecord, EntityDirectoryRoleType } from '@/lib/types'

export function DirectoryLookupField({
  roleType,
  onSelected,
  onAddNew,
}: {
  roleType: EntityDirectoryRoleType
  onSelected: (record: EntityDirectoryRecord) => void
  onAddNew: (name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EntityDirectoryRecord[]>([])
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleQueryChange(value: string) {
    setQuery(value)
    setOpen(true)
    startTransition(async () => {
      const found = await searchEntityDirectory(roleType, value)
      setResults(found)
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search ${roleType.toLowerCase()}s or add new…`}
              value={query}
              onValueChange={handleQueryChange}
            />
          </Command>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandList>
            {isPending && <CommandItem disabled>Searching…</CommandItem>}
            {!isPending &&
              results.map((record) => (
                <CommandItem
                  key={record.id}
                  value={record.id}
                  onSelect={() => {
                    onSelected(record)
                    setOpen(false)
                  }}
                >
                  {record.name}{' '}
                  <span className="ml-2 text-xs text-slate-500">{record.lookup_code}</span>
                </CommandItem>
              ))}
            {!isPending && query.trim().length > 0 && (
              <CommandItem
                value={`add-new-${query}`}
                onSelect={() => {
                  onAddNew(query)
                  setOpen(false)
                }}
              >
                Add &quot;{query}&quot; as new
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 1: Verify types compile** — `npx tsc --noEmit`, expect no errors.
- [ ] **Step 2: Commit**

```bash
git add src/components/DirectoryLookupField.tsx
git commit -m "feat: add DirectoryLookupField search/add combobox"
```

---

## Task 6 (revised): `DirectoryDedupeDialog`, folded into `AddContactForm.tsx`

**This is the task that changes most from the 8/29 plan.** No `AddLenderPanel.tsx`, no `ContactsSection.tsx` changes — Cam: "'Add Lender' needs to be folded into the existing Contact role picker."

**Files:**
- Create: `src/components/DirectoryDedupeDialog.tsx`
- Modify: `src/components/AddContactForm.tsx`

**Interfaces:**
- Consumes: `DirectoryLookupField` (Task 5), `createDirectoryEntry`/`confirmCreateAsNew`/`mergeIntoExisting` (Task 4), `ENTITY_DIRECTORY_ROLE_TYPES` (Task 3).

- [ ] **Step 1: Write `DirectoryDedupeDialog`** (unchanged from the 8/29 plan)

```tsx
// src/components/DirectoryDedupeDialog.tsx
'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { EntityDirectoryRecord } from '@/lib/types'

export function DirectoryDedupeDialog({
  open,
  onOpenChange,
  candidates,
  pendingName,
  onUpdateExisting,
  onAddAsNew,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: EntityDirectoryRecord[]
  pendingName: string
  onUpdateExisting: (existingId: string) => void
  onAddAsNew: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>&quot;{pendingName}&quot; looks similar to an existing entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {candidates.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded border p-3">
              <span>
                {c.name} <span className="text-xs text-slate-500">{c.lookup_code}</span>
              </span>
              <Button size="sm" onClick={() => onUpdateExisting(c.id)}>
                Update this record
              </Button>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={onAddAsNew}>
            Add &quot;{pendingName}&quot; as new
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Fold the Directory picker into `AddContactForm.tsx`**

`role` is already `useState`, and `current_address`/`mailing_address`/`forwarding_address` are already controlled — only `name`, `phone`, `email` need to become controlled to let a Directory selection populate them (Lender uses the single-address field, no license). Changes:

Add imports:
```tsx
import { ENTITY_DIRECTORY_ROLE_TYPES } from '@/lib/constants'
import { DirectoryLookupField } from '@/components/DirectoryLookupField'
import { DirectoryDedupeDialog } from '@/components/DirectoryDedupeDialog'
import { createDirectoryEntry, confirmCreateAsNew, mergeIntoExisting } from '@/app/actions/entity-directory'
import type { EntityDirectoryRecord, EntityDirectoryRoleType } from '@/lib/types'
```

Add state (alongside the existing `role`/`entityType`/address state):
```tsx
const [name, setName] = useState(contact?.name ?? '')
const [phone, setPhone] = useState(contact?.phone ?? '')
const [email, setEmail] = useState(contact?.email ?? '')
const [directoryPendingName, setDirectoryPendingName] = useState<string | null>(null)
const [directoryDedupe, setDirectoryDedupe] = useState<{
  candidates: EntityDirectoryRecord[]
  pendingFormData: Record<string, string>
} | null>(null)

const showDirectoryLookup = !contact && (ENTITY_DIRECTORY_ROLE_TYPES as readonly string[]).includes(role)

function applyDirectoryRecord(record: EntityDirectoryRecord) {
  setName(record.name)
  setCurrentAddress([record.address_line1, record.address_line2].filter(Boolean).join(' '))
  setPhone(record.phone ?? '')
  setEmail(record.email ?? '')
  setDirectoryPendingName(null)
  setDirectoryDedupe(null)
}

async function handleDirectorySave(fields: Record<string, string>) {
  const result = await createDirectoryEntry(role as EntityDirectoryRoleType, (() => {
    const fd = new FormData()
    Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
    return fd
  })())
  if (result.status === 'duplicates_found') {
    setDirectoryDedupe({ candidates: result.candidates, pendingFormData: result.pendingFormData })
    return
  }
  applyDirectoryRecord(result.record)
}
```

(`setCurrentAddress` already exists from the existing address state — reused here since Lender is single-address.)

Replace the uncontrolled `Name` input's `defaultValue={contact?.name}` with `value={name}` / `onChange={(e) => setName(e.target.value)}`, and likewise for `Phone` (`value={phone}`) and `Email` (`value={email}`), each keeping their existing `onBlur={() => handleSave()}` for edit-mode autosave.

Directly under the Role `<Select>` block, add:
```tsx
{showDirectoryLookup && (
  <div className="sm:col-span-2">
    <DirectoryLookupField
      roleType={role as EntityDirectoryRoleType}
      onSelected={applyDirectoryRecord}
      onAddNew={(newName) => {
        setDirectoryPendingName(newName)
        setName(newName)
      }}
    />
  </div>
)}
```

And at the end of the form (before `{!contact && <OrderFormSubmitButton .../>}`), add the dedupe dialog, wired to fire the directory-create check on submit rather than on blur (so "Add Contact" both creates the directory entry and the contact together):

```tsx
{directoryDedupe && (
  <DirectoryDedupeDialog
    open
    onOpenChange={() => setDirectoryDedupe(null)}
    candidates={directoryDedupe.candidates}
    pendingName={directoryPendingName ?? ''}
    onUpdateExisting={async (existingId) => {
      const record = await mergeIntoExisting(existingId, directoryDedupe.pendingFormData)
      applyDirectoryRecord(record)
    }}
    onAddAsNew={async () => {
      const record = await confirmCreateAsNew(role as EntityDirectoryRoleType, directoryDedupe.pendingFormData)
      applyDirectoryRecord(record)
    }}
  />
)}
```

For the actual "was this a new directory name" check: since the form's normal submit still goes straight to `addContact` via the native `action` prop, wrap the submit in an `onSubmit` handler (only when `showDirectoryLookup && directoryPendingName`) that first calls `handleDirectorySave({ name: directoryPendingName, address_line1: currentAddress, phone, email })`, and — if that returns `duplicates_found` — calls `event.preventDefault()` so the Contact isn't saved until the dedupe dialog is resolved (re-submitting afterward once `applyDirectoryRecord` has run).

- [ ] **Step 3: Verify types compile** — `npx tsc --noEmit`, expect no errors.
- [ ] **Step 4: Commit**

```bash
git add src/components/DirectoryDedupeDialog.tsx src/components/AddContactForm.tsx
git commit -m "feat: fold Entity Directory lookup into the existing Add Contact role picker"
```

---

## Task 7: e2e coverage (create, fuzzy-dedup) and full regression pass

**Files:**
- Create: `tests/e2e/entity-directory.spec.ts`

The flow changed from the 8/29 plan's tests (no "Add Lender" button, no "Save Lender" button — the existing "Add a contact" disclosure and "Add Contact" submit are reused):

```typescript
import { test, expect, type Page } from '@playwright/test'

const SEEDED_EMAIL = 'genesis-e2e-seed@genesis-app-e2e-test.dev'
const SEEDED_PASSWORD = 'E2eSeedPass123!'

async function loginAsSeededUser(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(SEEDED_EMAIL)
  await page.getByLabel('Password').fill(SEEDED_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/orders')
}

async function createTestOrder(page: Page): Promise<string> {
  await loginAsSeededUser(page)
  await page.getByRole('link', { name: '+ New Order' }).click()
  await page.getByRole('button', { name: 'Create Order' }).click()
  await page.waitForURL('**/orders/*/order-entry')
  return page.url().match(/orders\/([^/]+)/)![1]
}

test.describe('Entity Directory — Lender', () => {
  test('adding a Lender via the directory creates a new entry with a Lookup Code', async ({ page }) => {
    const orderId = await createTestOrder(page)
    await page.goto(`/orders/${orderId}/contacts`)
    await page.getByText('Add a contact').click()

    await page.getByLabel('Role').click()
    await page.getByRole('option', { name: 'Lender' }).click()

    const uniqueName = `E2E Test Lender ${Date.now()}`
    await page.getByPlaceholder('Search lenders or add new…').fill(uniqueName)
    await page.getByRole('option', { name: `Add "${uniqueName}" as new` }).click()

    await page.getByLabel('Phone').fill('555-100-2000')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByTestId('contact-row').filter({ hasText: uniqueName })).toBeVisible()
  })

  test('adding a near-duplicate Lender name prompts update-or-add-new', async ({ page }) => {
    const orderId = await createTestOrder(page)
    const baseName = `E2E Dedupe Lender ${Date.now()}`

    await page.goto(`/orders/${orderId}/contacts`)
    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').click()
    await page.getByRole('option', { name: 'Lender' }).click()
    await page.getByPlaceholder('Search lenders or add new…').fill(baseName)
    await page.getByRole('option', { name: `Add "${baseName}" as new` }).click()
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await expect(page.getByTestId('contact-row').filter({ hasText: baseName })).toBeVisible()

    const secondOrderId = await createTestOrder(page)
    const nearDuplicate = `${baseName} Co`
    await page.goto(`/orders/${secondOrderId}/contacts`)
    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').click()
    await page.getByRole('option', { name: 'Lender' }).click()
    await page.getByPlaceholder('Search lenders or add new…').fill(nearDuplicate)
    await page.getByRole('option', { name: `Add "${nearDuplicate}" as new` }).click()
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByText('looks similar to an existing entry')).toBeVisible()
    await expect(page.getByText(baseName)).toBeVisible()
  })
})
```

- [ ] **Step 1: Run it, expect failures first, then iterate on Task 6 until green**

Run: `npx playwright test tests/e2e/entity-directory.spec.ts`

- [ ] **Step 2: Full regression pass**

Run: `npm run build`, `npm run lint`, `npx playwright test`
Expected: all clean, including every pre-existing suite (especially `tests/e2e/order-entry.spec.ts`'s Contacts coverage — `AddContactForm.tsx` is a shared, heavily-used component).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/entity-directory.spec.ts
git commit -m "test: cover Entity Directory create and fuzzy-dedup flows"
```

---

## Phase 2 (not this plan)

CSV export/import, the permission-gated `/admin/entity-directory` page, and its own e2e coverage (the 8/29 plan's old Tasks 8–10) — deferred per Cam's Q4 answer. Write as its own plan once there's real directory data worth bulk-managing. `can_manage_lookup_data` already exists in the schema (Task 2 above) for that plan to build on.

## Self-Review Notes

- **Drift fixed:** role list now matches real `CONTACT_ROLES`; migration targets the real current head (`0053`, not `0003`) and `alter table`s the real `profiles`; Task 1 only adds what's missing; no `AddLenderPanel`/`ContactsSection.tsx` touch — folded into `AddContactForm.tsx` per Cam's explicit instruction.
- **Spec coverage:** data model (Task 2), Lookup Code generation (Task 2), picker/copy-once flow (Tasks 5–6), fuzzy-dedup on add (Tasks 4, 6, 7) all covered for Phase 1. CSV and admin permission gate explicitly deferred, not silently dropped.
- **Open items carried forward, not resolved here:** exact `LenderDetails` preference-profile field names (Task 3, flagged), the 3 unmentioned role types' soon/eventually status and Buyer/Borrower-Seller exclusion (both in the readiness doc's Q2 checklist), what "Local Lookup, eventually Global Access" and "Local only" mean structurally (not just VIP-roster or not).
