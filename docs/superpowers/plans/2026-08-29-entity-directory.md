# Entity Directory (Lender Vertical Slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared Entity Directory system (firm-wide, Lookup-Code-driven contact directory with fuzzy-dedup and CSV round-trip) generically across all 13 role types, and fully wire up Lender — the only role type with a known field set — end to end as the proof slice.

**Architecture:** One shared `entity_directory` table (+ `entity_directory_people` for the 4 roles that need a nested roster) keyed by `role_type`, with server-generated Lookup Codes. Selecting a directory record copies its fields into an order's Contact once, then decouples (matches Genesis's existing Deed/Security Instrument pattern) — no live foreign key from any order back into the directory. Fuzzy duplicate detection uses Postgres's `pg_trgm` trigram similarity, both for the search picker and the add/CSV-dedup check. CSV export/import and record deactivation are gated behind a new minimal `profiles.can_manage_lookup_data` permission; single-record "Save and Add New" stays open to any authenticated user.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Supabase (Postgres + `@supabase/ssr`), Tailwind CSS 4, shadcn/ui (new to this repo — installed in Task 1), Playwright for e2e (no unit-test framework exists in this repo; all testing follows the existing e2e-only convention against the real seeded Supabase project).

**Spec:** `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Entity Directory Design.md`

## Global Constraints

- Migrations use `text` columns + `check (col in (...))` for enums, never native Postgres `enum` types — matches `0001_foundation_schema.sql` and `0002_property_details.sql`.
- Every table gets `id uuid primary key default gen_random_uuid()`, RLS enabled, and an explicit policy block — no table ships without RLS.
- Server actions are `'use server'` files under `src/app/actions/`, use `createClient()` from `@/lib/supabase/server`, and follow the existing redirect-with-error-query-param pattern on failure (see `src/app/actions/contacts.ts`).
- No unit-test framework exists in this repo (no vitest/jest in `package.json`) — all new logic is covered via Playwright e2e against the real dev server and the real seeded Supabase project (`genesis-e2e-seed@genesis-app-e2e-test.dev` / `E2eSeedPass123!`), matching `tests/e2e/order-entry.spec.ts`'s existing convention. Do not introduce a unit-test framework as part of this plan.
- shadcn/ui is the locked component library (`design-system/MASTER.md`) but is not yet installed in this repo — Task 1 installs it. Every new component in this plan uses real shadcn primitives (Command, Popover, Dialog, Table, Button, Input, Select), not hand-rolled markup, per `genesis-app/CLAUDE.md`'s standing instruction that this is not Ponytail's decision to relitigate.
- This plan does **not** touch `ContactsSection.tsx`'s existing generic "Add a contact" form or its free-text `role` field — that's a separately flagged Fix Plan item (structured 24-value `ROLE_TYPES`). Lender integration is added as a distinct, parallel "Add Lender from Directory" path so this plan doesn't block on or duplicate that unrelated restructuring.

---

## Task 1: Install shadcn/ui and scaffold the primitives this plan needs

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/select.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/command.tsx`, `src/components/ui/popover.tsx`, `src/components/ui/table.tsx`, `src/components/ui/label.tsx`
- Modify: `package.json`, `src/app/globals.css` (shadcn init wires Tailwind theme tokens)

**Interfaces:**
- Produces: the standard shadcn component exports (`Button`, `Input`, `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`, `Command`/`CommandInput`/`CommandList`/`CommandItem`, `Popover`/`PopoverTrigger`/`PopoverContent`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableCell`) used by every later task.

- [ ] **Step 1: Run the shadcn init**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npx shadcn@latest init -d
```

Accept the defaults it infers from `tailwind.config`/`globals.css` (Next.js App Router, Tailwind CSS 4, `src/` directory). This creates `components.json` and `src/lib/utils.ts` (the `cn()` helper).

- [ ] **Step 2: Add the primitives this plan needs**

```bash
npx shadcn@latest add button input select dialog command popover table label
```

- [ ] **Step 3: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add components.json src/lib/utils.ts src/components/ui package.json package-lock.json src/app/globals.css
git commit -m "chore: install shadcn/ui primitives (button, input, select, dialog, command, popover, table, label)"
```

---

## Task 2: Migration — `profiles` permission gate, `entity_directory`, `entity_directory_people`

**Files:**
- Create: `supabase/migrations/0003_entity_directory.sql`

**Interfaces:**
- Produces: tables `public.profiles(id, can_manage_lookup_data)`, `public.entity_directory(id, lookup_code, role_type, name, address_line1, address_line2, city, state, zip, county, phone, fax, email, license_number, details, is_active, created_at, updated_at, created_by, updated_by)`, `public.entity_directory_people(id, entity_id, first_name, last_name, title, email, phone, ext, cell)`, `public.entity_directory_code_sequences(role_type, next_value)`; functions `public.generate_entity_lookup_code(text, text)`, `public.set_entity_directory_lookup_code()` (trigger), `public.search_entity_directory(text, text, integer)`, `public.find_entity_directory_duplicates(text, text, real)`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0003_entity_directory.sql

create extension if not exists pg_trgm;

-- Minimal permission primitive: gates CSV export/import and record deactivation.
-- Not the full MFA/SSO/step-up-reauth Admin system described in
-- "Design Notes - Admin.md" (unbuilt, separate initiative) — just enough
-- real enforcement for this feature.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  can_manage_lookup_data boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- Per-role-type Lookup Code counters (avoids 13 named Postgres sequences).
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

create table public.entity_directory (
  id uuid primary key default gen_random_uuid(),
  lookup_code text unique,
  role_type text not null check (role_type in (
    'Abstractor', 'Lender', 'Mortgage Broker', 'Tax Collector', 'Recording Office',
    'Buying Agent', 'Selling Agent', 'General Contractor', 'Sub Contractor',
    'Title Company', 'Settlement Agent', 'Underwriter', 'Counter Signature'
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
    when 'Abstractor' then 'ABS'
    when 'Lender' then 'LEN'
    when 'Mortgage Broker' then 'MB'
    when 'Tax Collector' then 'TAX'
    when 'Recording Office' then 'REC'
    when 'Buying Agent' then 'BAG'
    when 'Selling Agent' then 'SAG'
    when 'General Contractor' then 'GC'
    when 'Sub Contractor' then 'SUB'
    when 'Title Company' then 'TC'
    when 'Settlement Agent' then 'SET'
    when 'Underwriter' then 'UW'
    when 'Counter Signature' then 'CS'
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
-- Never called without a role_type — the picker never lists "all entities."
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

-- Dedup check used by both "Save and Add New" and CSV row inserts.
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
-- can_manage_lookup_data can flip is_active to false (deactivation is the
-- gated action, not editing in general — matches the design's split between
-- open "Save and Add New" and gated CSV/deletion workflows).
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

Run (Supabase CLI, from `genesis-app/`): `supabase db push`
Expected: migration applies with no errors. (If not using the CLI locally, apply via the Supabase MCP's `apply_migration` tool against the linked project instead.)

- [ ] **Step 3: Verify the schema landed**

Run: `supabase db execute --sql "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('profiles', 'entity_directory', 'entity_directory_people', 'entity_directory_code_sequences') order by table_name;"`
Expected: all four table names returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_entity_directory.sql
git commit -m "feat: add entity_directory schema, lookup code generation, and can_manage_lookup_data permission"
```

---

## Task 3: Constants and types

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `ENTITY_DIRECTORY_ROLE_TYPES: readonly string[]`, `ENTITY_DIRECTORY_ROLE_TYPES_WITH_PEOPLE: readonly string[]`, `type EntityDirectoryRecord`, `type EntityDirectoryPerson`, `type LenderDetails`.

- [ ] **Step 1: Add constants**

Append to `src/lib/constants.ts`:

```typescript
export const ENTITY_DIRECTORY_ROLE_TYPES = [
  'Abstractor',
  'Lender',
  'Mortgage Broker',
  'Tax Collector',
  'Recording Office',
  'Buying Agent',
  'Selling Agent',
  'General Contractor',
  'Sub Contractor',
  'Title Company',
  'Settlement Agent',
  'Underwriter',
  'Counter Signature',
] as const

export const ENTITY_DIRECTORY_ROLE_TYPES_WITH_PEOPLE = [
  'Lender',
  'Mortgage Broker',
  'Buying Agent',
  'Selling Agent',
] as const
```

- [ ] **Step 2: Add types**

Append to `src/lib/types.ts`:

```typescript
export type EntityDirectoryRoleType =
  | 'Abstractor'
  | 'Lender'
  | 'Mortgage Broker'
  | 'Tax Collector'
  | 'Recording Office'
  | 'Buying Agent'
  | 'Selling Agent'
  | 'General Contractor'
  | 'Sub Contractor'
  | 'Title Company'
  | 'Settlement Agent'
  | 'Underwriter'
  | 'Counter Signature'

export type LenderDetails = {
  nmls_number: string | null
  cdf_payee_type: string | null
  proposed_insured_clause: string | null
  vesting_loss_payable: string | null
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

## Task 4: Server actions — search, create (with fuzzy-dedup), update, deactivate, refill

**Files:**
- Create: `src/app/actions/entity-directory.ts`
- Test: `tests/e2e/entity-directory.spec.ts` (created here, extended in later tasks)

**Interfaces:**
- Consumes: `EntityDirectoryRecord`, `EntityDirectoryRoleType` from `@/lib/types`; `createClient` from `@/lib/supabase/server`.
- Produces:
  - `searchEntityDirectory(roleType: EntityDirectoryRoleType, query: string): Promise<EntityDirectoryRecord[]>`
  - `createDirectoryEntry(roleType: EntityDirectoryRoleType, formData: FormData): Promise<{ status: 'created'; record: EntityDirectoryRecord } | { status: 'duplicates_found'; candidates: EntityDirectoryRecord[]; pendingName: string; pendingFormData: Record<string, string> }>`
  - `confirmCreateAsNew(roleType: EntityDirectoryRoleType, pendingFormData: Record<string, string>): Promise<EntityDirectoryRecord>`
  - `mergeIntoExisting(existingId: string, pendingFormData: Record<string, string>): Promise<EntityDirectoryRecord>`
  - `deactivateDirectoryEntry(id: string): Promise<void>`
  - `refillContactFromDirectory(contactId: string, orderId: string, lookupCode: string): Promise<void>`

- [ ] **Step 1: Write the failing e2e test for search + create**

```typescript
// tests/e2e/entity-directory.spec.ts
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
  await page.goto('/orders/new')
  await page.getByLabel('File Number').fill(`E2E-ENTDIR-${Date.now()}`)
  await page.getByRole('button', { name: 'Create Order' }).click()
  await page.waitForURL('**/orders/*/order-entry')
  return page.url().match(/orders\/([^/]+)/)![1]
}

test.describe('Entity Directory — Lender', () => {
  test('adding a Lender via the directory creates a new entry with a Lookup Code', async ({ page }) => {
    await loginAsSeededUser(page)
    const orderId = await createTestOrder(page)

    await page.goto(`/orders/${orderId}/contacts`)
    await page.getByRole('button', { name: 'Add Lender' }).click()

    const uniqueName = `E2E Test Lender ${Date.now()}`
    await page.getByPlaceholder('Search lenders or add new…').fill(uniqueName)
    await page.getByRole('option', { name: `Add "${uniqueName}" as new` }).click()

    await page.getByLabel('Address').fill('100 Test St')
    await page.getByLabel('City').fill('Testville')
    await page.getByLabel('State').fill('NJ')
    await page.getByLabel('Zip').fill('08009')
    await page.getByRole('button', { name: 'Save Lender' }).click()

    await expect(page.getByTestId('contact-row').filter({ hasText: uniqueName })).toBeVisible()
    await expect(page.getByTestId('contact-row').filter({ hasText: uniqueName })).toContainText('LEN-')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/entity-directory.spec.ts`
Expected: FAIL — `/orders/[id]/contacts` has no "Add Lender" button yet.

- [ ] **Step 3: Write the server actions**

```typescript
// src/app/actions/entity-directory.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
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
  revalidatePath('/admin/entity-directory')
}

export async function refillContactFromDirectory(
  contactId: string,
  orderId: string,
  lookupCode: string
): Promise<void> {
  const supabase = await createClient()

  const { data: directoryRecord, error: lookupError } = await supabase
    .from('entity_directory')
    .select()
    .eq('lookup_code', lookupCode)
    .single()

  if (lookupError || !directoryRecord) {
    throw new Error(`refillContactFromDirectory: no directory record for ${lookupCode}`)
  }

  const { error } = await supabase
    .from('contacts')
    .update({
      name: directoryRecord.name,
      current_address: [directoryRecord.address_line1, directoryRecord.address_line2]
        .filter(Boolean)
        .join(' '),
      phone: directoryRecord.phone,
      email: directoryRecord.email,
      license_number: directoryRecord.license_number,
    })
    .eq('id', contactId)

  if (error) throw new Error(`refillContactFromDirectory update failed: ${error.message}`)
  revalidatePath(`/orders/${orderId}/contacts`)
}
```

- [ ] **Step 4: Run the test again**

Run: `npx playwright test tests/e2e/entity-directory.spec.ts`
Expected: still FAIL (server actions exist now, but the UI to call them doesn't) — proceeds to Task 5/6.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/entity-directory.ts tests/e2e/entity-directory.spec.ts
git commit -m "feat: add entity directory server actions (search, create with fuzzy-dedup, merge, deactivate, refill)"
```

---

## Task 5: `DirectoryLookupField` — search/add combobox

**Files:**
- Create: `src/components/DirectoryLookupField.tsx`

**Interfaces:**
- Consumes: `searchEntityDirectory`, `createDirectoryEntry` from `@/app/actions/entity-directory`; shadcn `Command`/`CommandInput`/`CommandList`/`CommandItem`, `Popover`/`PopoverTrigger`/`PopoverContent` from Task 1.
- Produces: `<DirectoryLookupField roleType={...} onSelected={(record) => void} onAddNew={(name) => void} />` — a client component other Contact-adding UIs can reuse for any of the 13 role types, not just Lender.

- [ ] **Step 1: Write the component**

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

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DirectoryLookupField.tsx
git commit -m "feat: add DirectoryLookupField search/add combobox"
```

---

## Task 6: `DirectoryDedupeDialog` and wiring "Add Lender" into Contacts

**Files:**
- Create: `src/components/DirectoryDedupeDialog.tsx`
- Create: `src/components/AddLenderPanel.tsx`
- Modify: `src/components/ContactsSection.tsx`
- Modify: `src/app/orders/[id]/contacts/page.tsx`

**Interfaces:**
- Consumes: `DirectoryLookupField` (Task 5), `createDirectoryEntry`/`confirmCreateAsNew`/`mergeIntoExisting` (Task 4), `addContact` (existing, `@/app/actions/contacts`).
- Produces: `<AddLenderPanel orderId={string} />`, rendered inside `ContactsSection`.

- [ ] **Step 1: Write `DirectoryDedupeDialog`**

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

- [ ] **Step 2: Write `AddLenderPanel`**

```tsx
// src/components/AddLenderPanel.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DirectoryLookupField } from '@/components/DirectoryLookupField'
import { DirectoryDedupeDialog } from '@/components/DirectoryDedupeDialog'
import {
  createDirectoryEntry,
  confirmCreateAsNew,
  mergeIntoExisting,
} from '@/app/actions/entity-directory'
import { addContact } from '@/app/actions/contacts'
import type { EntityDirectoryRecord } from '@/lib/types'

export function AddLenderPanel({ orderId }: { orderId: string }) {
  const [selected, setSelected] = useState<EntityDirectoryRecord | null>(null)
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [fields, setFields] = useState({
    address_line1: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
  })
  const [dedupeState, setDedupeState] = useState<{
    candidates: EntityDirectoryRecord[]
    pendingFormData: Record<string, string>
  } | null>(null)

  async function addContactFromDirectory(record: EntityDirectoryRecord) {
    const formData = new FormData()
    formData.set('role', 'Lender')
    formData.set('entity_type', 'Corporation')
    formData.set('name', record.name)
    formData.set('current_address', [record.address_line1, record.address_line2].filter(Boolean).join(' '))
    formData.set('phone', record.phone ?? '')
    formData.set('email', record.email ?? '')
    formData.set('license_number', record.license_number ?? '')
    await addContact(orderId, formData)
  }

  async function handleSave() {
    if (!pendingName) return

    const formData = new FormData()
    formData.set('name', pendingName)
    Object.entries(fields).forEach(([key, value]) => formData.set(key, value))

    const result = await createDirectoryEntry('Lender', formData)
    if (result.status === 'duplicates_found') {
      setDedupeState({ candidates: result.candidates, pendingFormData: result.pendingFormData })
      return
    }
    setSelected(result.record)
    await addContactFromDirectory(result.record)
  }

  return (
    <div className="rounded border p-4">
      <h3 className="mb-2 font-medium">Add Lender</h3>
      <DirectoryLookupField
        roleType="Lender"
        onSelected={async (record) => {
          setSelected(record)
          await addContactFromDirectory(record)
        }}
        onAddNew={(name) => setPendingName(name)}
      />

      {pendingName && !selected && (
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={fields.address_line1}
              onChange={(e) => setFields({ ...fields, address_line1: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={fields.city}
              onChange={(e) => setFields({ ...fields, city: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={fields.state}
              onChange={(e) => setFields({ ...fields, state: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="zip">Zip</Label>
            <Input
              id="zip"
              value={fields.zip}
              onChange={(e) => setFields({ ...fields, zip: e.target.value })}
            />
          </div>
          <Button onClick={handleSave}>Save Lender</Button>
        </div>
      )}

      {dedupeState && (
        <DirectoryDedupeDialog
          open
          onOpenChange={() => setDedupeState(null)}
          candidates={dedupeState.candidates}
          pendingName={pendingName ?? ''}
          onUpdateExisting={async (existingId) => {
            const record = await mergeIntoExisting(existingId, dedupeState.pendingFormData)
            setDedupeState(null)
            setSelected(record)
            await addContactFromDirectory(record)
          }}
          onAddAsNew={async () => {
            const record = await confirmCreateAsNew('Lender', dedupeState.pendingFormData)
            setDedupeState(null)
            setSelected(record)
            await addContactFromDirectory(record)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire it into `ContactsSection`**

In `src/components/ContactsSection.tsx`, add the import and render `<AddLenderPanel orderId={orderId} />` above the existing `<details>` "Add a contact" block (leave that block untouched):

```tsx
import { AddLenderPanel } from '@/components/AddLenderPanel'
```

```tsx
      <AddLenderPanel orderId={orderId} />

      <details className="rounded border p-4">
```

- [ ] **Step 4: Run the Task 4 e2e test**

Run: `npx playwright test tests/e2e/entity-directory.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DirectoryDedupeDialog.tsx src/components/AddLenderPanel.tsx src/components/ContactsSection.tsx
git commit -m "feat: wire Add Lender panel into Contacts with fuzzy-dedup dialog"
```

---

## Task 7: Fuzzy-dedup e2e coverage

**Files:**
- Modify: `tests/e2e/entity-directory.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
test('adding a near-duplicate Lender name prompts update-or-add-new', async ({ page }) => {
  await loginAsSeededUser(page)
  const orderId = await createTestOrder(page)
  const baseName = `E2E Dedupe Lender ${Date.now()}`

  // Create the first Lender.
  await page.goto(`/orders/${orderId}/contacts`)
  await page.getByRole('button', { name: 'Add Lender' }).click()
  await page.getByPlaceholder('Search lenders or add new…').fill(baseName)
  await page.getByRole('option', { name: `Add "${baseName}" as new` }).click()
  await page.getByLabel('Address').fill('100 Test St')
  await page.getByRole('button', { name: 'Save Lender' }).click()
  await expect(page.getByTestId('contact-row').filter({ hasText: baseName })).toBeVisible()

  // Create a second order and add a near-duplicate name.
  const secondOrderId = await createTestOrder(page)
  const nearDuplicate = `${baseName} Co`
  await page.goto(`/orders/${secondOrderId}/contacts`)
  await page.getByRole('button', { name: 'Add Lender' }).click()
  await page.getByPlaceholder('Search lenders or add new…').fill(nearDuplicate)
  await page.getByRole('option', { name: `Add "${nearDuplicate}" as new` }).click()
  await page.getByLabel('Address').fill('200 Test St')
  await page.getByRole('button', { name: 'Save Lender' }).click()

  await expect(page.getByText('looks similar to an existing entry')).toBeVisible()
  await expect(page.getByText(baseName)).toBeVisible()
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/entity-directory.spec.ts -g "near-duplicate"`
Expected: PASS (Task 6's `AddLenderPanel` already wires the dedupe dialog — this test should pass without new implementation code; if it fails, the gap is in the dialog's visibility logic from Task 6, fix there).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/entity-directory.spec.ts
git commit -m "test: cover fuzzy-dedup update-or-add-new prompt"
```

---

## Task 8: CSV export/import server actions

**Files:**
- Create: `src/lib/csv.ts`
- Modify: `src/app/actions/entity-directory.ts`

**Interfaces:**
- Produces: `parseCsv(text: string): string[][]`, `toCsv(rows: string[][]): string`, `exportDirectoryCsv(roleType: EntityDirectoryRoleType): Promise<string>`, `importDirectoryCsv(roleType: EntityDirectoryRoleType, csvText: string): Promise<{ inserted: number; updated: number; deactivated: number; reviewQueue: Array<{ row: Record<string, string>; candidates: EntityDirectoryRecord[] }> }>`.

- [ ] **Step 1: Write the CSV utility**

```typescript
// src/lib/csv.ts

// Minimal RFC4180-style CSV: handles quoted fields, embedded commas, and
// escaped quotes ("" inside a quoted field). No external dependency —
// nothing in package.json already does this and it's a small, self-contained
// parser/generator pair.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

function escapeField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeField).join(',')).join('\r\n')
}
```

- [ ] **Step 2: Write the failing e2e test for export/import**

```typescript
test('exporting Lenders then reuploading edits an existing record by lookup_code', async ({ page }) => {
  await loginAsSeededUser(page)
  // Seeded user must have can_manage_lookup_data = true for this test —
  // set directly via SQL against the test project before this suite runs
  // (see Task 9's Step 1 fixture note).
  const orderId = await createTestOrder(page)
  const name = `E2E CSV Lender ${Date.now()}`

  await page.goto(`/orders/${orderId}/contacts`)
  await page.getByRole('button', { name: 'Add Lender' }).click()
  await page.getByPlaceholder('Search lenders or add new…').fill(name)
  await page.getByRole('option', { name: `Add "${name}" as new` }).click()
  await page.getByLabel('Address').fill('100 Test St')
  await page.getByRole('button', { name: 'Save Lender' }).click()

  await page.goto('/admin/entity-directory')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Export Lenders' }).click(),
  ])
  const csvPath = await download.path()
  expect(csvPath).toBeTruthy()
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx playwright test tests/e2e/entity-directory.spec.ts -g "reuploading edits"`
Expected: FAIL — `/admin/entity-directory` doesn't exist yet (built in Task 9).

- [ ] **Step 4: Add export/import to the server actions file**

Append to `src/app/actions/entity-directory.ts`:

```typescript
import { parseCsv, toCsv } from '@/lib/csv'

const CSV_COLUMNS = [
  'lookup_code',
  'name',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'zip',
  'county',
  'phone',
  'fax',
  'email',
  'license_number',
  'is_active',
] as const

async function requireLookupDataPermission(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('can_manage_lookup_data')
    .eq('id', user.id)
    .single()

  if (!profile?.can_manage_lookup_data) {
    throw new Error('Not permitted to manage lookup data')
  }
}

export async function exportDirectoryCsv(roleType: EntityDirectoryRoleType): Promise<string> {
  const supabase = await createClient()
  await requireLookupDataPermission(supabase)

  const { data, error } = await supabase
    .from('entity_directory')
    .select()
    .eq('role_type', roleType)
    .order('name')

  if (error) throw new Error(`exportDirectoryCsv failed: ${error.message}`)

  const rows: string[][] = [[...CSV_COLUMNS]]
  for (const record of data as EntityDirectoryRecord[]) {
    rows.push(CSV_COLUMNS.map((col) => String((record as unknown as Record<string, unknown>)[col] ?? '')))
  }

  return toCsv(rows)
}

export async function importDirectoryCsv(
  roleType: EntityDirectoryRoleType,
  csvText: string
): Promise<{
  inserted: number
  updated: number
  deactivated: number
  reviewQueue: Array<{ row: Record<string, string>; candidates: EntityDirectoryRecord[] }>
}> {
  const supabase = await createClient()
  await requireLookupDataPermission(supabase)

  const rows = parseCsv(csvText)
  const [header, ...dataRows] = rows
  if (header.join(',') !== CSV_COLUMNS.join(',')) {
    throw new Error(
      `importDirectoryCsv: column mismatch — expected a ${roleType} export, got a different file`
    )
  }

  const parsedRows = dataRows.map((row) =>
    Object.fromEntries(CSV_COLUMNS.map((col, i) => [col, row[i] ?? ''])) as Record<string, string>
  )

  const { data: existingRows, error: existingError } = await supabase
    .from('entity_directory')
    .select()
    .eq('role_type', roleType)

  if (existingError) throw new Error(`importDirectoryCsv failed: ${existingError.message}`)

  const existingByCode = new Map(
    (existingRows as EntityDirectoryRecord[]).map((r) => [r.lookup_code, r])
  )
  const seenCodes = new Set<string>()

  let inserted = 0
  let updated = 0
  let deactivated = 0
  const reviewQueue: Array<{ row: Record<string, string>; candidates: EntityDirectoryRecord[] }> = []

  for (const row of parsedRows) {
    if (row.lookup_code) {
      seenCodes.add(row.lookup_code)
      const { error } = await supabase
        .from('entity_directory')
        .update({
          name: row.name,
          address_line1: row.address_line1 || null,
          address_line2: row.address_line2 || null,
          city: row.city || null,
          state: row.state || null,
          zip: row.zip || null,
          county: row.county || null,
          phone: row.phone || null,
          fax: row.fax || null,
          email: row.email || null,
          license_number: row.license_number || null,
          updated_at: new Date().toISOString(),
        })
        .eq('lookup_code', row.lookup_code)

      if (error) throw new Error(`importDirectoryCsv update failed: ${error.message}`)
      updated++
      continue
    }

    const { data: candidates } = await supabase.rpc('find_entity_directory_duplicates', {
      p_role_type: roleType,
      p_name: row.name,
      p_threshold: 0.45,
    })

    if (candidates && candidates.length > 0) {
      reviewQueue.push({ row, candidates: candidates as EntityDirectoryRecord[] })
      continue
    }

    const { error } = await supabase.from('entity_directory').insert({
      role_type: roleType,
      name: row.name,
      address_line1: row.address_line1 || null,
      address_line2: row.address_line2 || null,
      city: row.city || null,
      state: row.state || null,
      zip: row.zip || null,
      county: row.county || null,
      phone: row.phone || null,
      fax: row.fax || null,
      email: row.email || null,
      license_number: row.license_number || null,
    })

    if (error) throw new Error(`importDirectoryCsv insert failed: ${error.message}`)
    inserted++
  }

  for (const [code, record] of existingByCode) {
    if (!seenCodes.has(code) && record.is_active) {
      const { error } = await supabase
        .from('entity_directory')
        .update({ is_active: false })
        .eq('lookup_code', code)

      if (error) throw new Error(`importDirectoryCsv deactivate failed: ${error.message}`)
      deactivated++
    }
  }

  revalidatePath('/admin/entity-directory')
  return { inserted, updated, deactivated, reviewQueue }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.ts src/app/actions/entity-directory.ts
git commit -m "feat: add CSV export/import with lookup_code matching and soft-delete"
```

---

## Task 9: Admin page — permission-gated CSV UI and review queue

**Files:**
- Create: `src/app/admin/entity-directory/page.tsx`
- Create: `src/components/EntityDirectoryAdminPanel.tsx`

**Interfaces:**
- Consumes: `exportDirectoryCsv`, `importDirectoryCsv` (Task 8); shadcn `Table`, `Button`.
- Produces: `/admin/entity-directory` route, redirects non-permitted users.

- [ ] **Step 1: Seed the test fixture — grant the seeded e2e user permission**

Run against the linked Supabase project (via the Supabase MCP `execute_sql` tool, or `supabase db execute`):

```sql
insert into public.profiles (id, can_manage_lookup_data)
select id, true from auth.users where email = 'genesis-e2e-seed@genesis-app-e2e-test.dev'
on conflict (id) do update set can_manage_lookup_data = true;
```

- [ ] **Step 2: Write the admin page**

```tsx
// src/app/admin/entity-directory/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EntityDirectoryAdminPanel } from '@/components/EntityDirectoryAdminPanel'
import { ENTITY_DIRECTORY_ROLE_TYPES } from '@/lib/constants'

export default async function EntityDirectoryAdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('can_manage_lookup_data')
    .eq('id', user.id)
    .single()

  if (!profile?.can_manage_lookup_data) {
    redirect('/orders')
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Entity Directory</h1>
      <EntityDirectoryAdminPanel roleTypes={[...ENTITY_DIRECTORY_ROLE_TYPES]} />
    </div>
  )
}
```

- [ ] **Step 3: Write the admin panel**

```tsx
// src/components/EntityDirectoryAdminPanel.tsx
'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  exportDirectoryCsv,
  importDirectoryCsv,
  confirmCreateAsNew,
  mergeIntoExisting,
} from '@/app/actions/entity-directory'
import type { EntityDirectoryRecord, EntityDirectoryRoleType } from '@/lib/types'

export function EntityDirectoryAdminPanel({
  roleTypes,
}: {
  roleTypes: EntityDirectoryRoleType[]
}) {
  const [selectedRole, setSelectedRole] = useState<EntityDirectoryRoleType>(roleTypes[0])
  const [reviewQueue, setReviewQueue] = useState<
    Array<{ row: Record<string, string>; candidates: EntityDirectoryRecord[] }>
  >([])
  const [summary, setSummary] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport(roleType: EntityDirectoryRoleType) {
    const csv = await exportDirectoryCsv(roleType)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${roleType.replace(/\s+/g, '-').toLowerCase()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File) {
    const text = await file.text()
    const result = await importDirectoryCsv(selectedRole, text)
    setSummary(
      `${result.inserted} added, ${result.updated} updated, ${result.deactivated} deactivated, ${result.reviewQueue.length} flagged for review.`
    )
    setReviewQueue(result.reviewQueue)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as EntityDirectoryRoleType)}
          className="rounded border px-3 py-2"
        >
          {roleTypes.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <Button asChild variant="outline">
          <a
            role="link"
            aria-label={`Export ${selectedRole}s`}
            onClick={(e) => {
              e.preventDefault()
              handleExport(selectedRole)
            }}
            href="#"
          >
            Export {selectedRole}s
          </a>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
        />
      </div>

      {summary && <p className="text-sm text-slate-600">{summary}</p>}

      {reviewQueue.length > 0 && (
        <div>
          <h2 className="mb-2 font-medium">Review Queue</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>New row</TableHead>
                <TableHead>Similar existing entry</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewQueue.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>{item.row.name}</TableCell>
                  <TableCell>
                    {item.candidates.map((c) => `${c.name} (${c.lookup_code})`).join(', ')}
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        await mergeIntoExisting(item.candidates[0].id, item.row)
                        setReviewQueue((q) => q.filter((_, idx) => idx !== i))
                      }}
                    >
                      Update existing
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await confirmCreateAsNew(selectedRole, item.row)
                        setReviewQueue((q) => q.filter((_, idx) => idx !== i))
                      }}
                    >
                      Add as new
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the Task 8 e2e test**

Run: `npx playwright test tests/e2e/entity-directory.spec.ts -g "reuploading edits"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/entity-directory/page.tsx src/components/EntityDirectoryAdminPanel.tsx
git commit -m "feat: add permission-gated Entity Directory admin page (CSV export/import, review queue)"
```

---

## Task 10: Permission-gate e2e coverage and full regression pass

**Files:**
- Modify: `tests/e2e/entity-directory.spec.ts`

- [ ] **Step 1: Write the failing test for the permission gate**

```typescript
test('a user without can_manage_lookup_data is redirected away from the admin page', async ({ page, context }) => {
  // Uses a second, unprivileged seeded account — created once via /signup
  // the same way SEEDED_EMAIL was, but never granted can_manage_lookup_data.
  await page.goto('/login')
  await page.getByLabel('Email').fill('genesis-e2e-unprivileged@genesis-app-e2e-test.dev')
  await page.getByLabel('Password').fill('E2eUnprivPass123!')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/orders')

  await page.goto('/admin/entity-directory')
  await page.waitForURL('**/orders')
})
```

- [ ] **Step 2: Create the unprivileged seed account**

Sign up `genesis-e2e-unprivileged@genesis-app-e2e-test.dev` / `E2eUnprivPass123!` through the real `/signup` flow once (same approach used to create `SEEDED_EMAIL` originally), or insert directly via the Supabase MCP if signup is disabled per the existing security posture noted in `order-entry.spec.ts`. Do not grant it a `profiles` row with `can_manage_lookup_data = true`.

- [ ] **Step 3: Run it**

Run: `npx playwright test tests/e2e/entity-directory.spec.ts -g "redirected"`
Expected: PASS.

- [ ] **Step 4: Run the full suite**

Run: `npx playwright test`
Expected: all tests pass, including the pre-existing `order-entry.spec.ts` suite (no regressions).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/entity-directory.spec.ts
git commit -m "test: cover permission gate on the Entity Directory admin page"
```

---

## Self-Review Notes

- **Spec coverage:** data model (Task 2), Lookup Code generation (Task 2), picker/copy-once flow (Tasks 5–6), fuzzy-dedup on add (Tasks 4, 6, 7) and on CSV (Tasks 8–9), CSV export/reupload with soft-delete (Task 8), permissions split (Task 2 RLS + Task 9 page gate), scale protections — trigram GIN index and search-not-load-all (Task 2, Task 5) — all covered. Role types 2–13 (everything but Lender) are registered in the `role_type` check constraint and `ENTITY_DIRECTORY_ROLE_TYPES` but have no `details` UI or consumption site, exactly matching the spec's Out of Scope section.
- **Placeholder scan:** no TBDs; every step has real code or a real runnable command.
- **Type consistency:** `EntityDirectoryRecord`/`EntityDirectoryRoleType` (Task 3) used identically across Tasks 4–9; `DirectoryLookupField`'s `onSelected`/`onAddNew` props match how `AddLenderPanel` calls them in Task 6.
