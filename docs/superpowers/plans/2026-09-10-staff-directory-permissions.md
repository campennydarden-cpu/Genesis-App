# Staff Directory & Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace open self-signup with invite-only staff accounts, and replace
the four SQL-only `can_manage_*` boolean flags with an admin console that
manages both staff (invite/deactivate) and role-based permissions
(admin-creatable roles, each a named bundle of flat permission keys).

**Architecture:** Two new tables (`roles`, `role_permissions`) plus three new
columns on `profiles` (`full_name`, `active`, `role_id`), replacing the four
dropped boolean columns. One `hasPermission()` helper replaces every existing
permission check. Account creation moves from public `supabase.auth.signUp()`
to `auth.admin.inviteUserByEmail()`, using a Next.js Route Handler
(`/auth/confirm`) to exchange the invite token for a session server-side —
the standard `@supabase/ssr` pattern for cookie-based sessions, not the
client-only hash-fragment flow.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + Auth, `@supabase/ssr`),
TypeScript, shadcn/ui (Base UI primitives), Playwright e2e (this repo has no
unit-test runner — `npm run test:e2e` is the only automated test tooling,
matching every prior feature in this codebase).

**Spec:** `docs/superpowers/specs/2026-09-10-staff-directory-permissions-design.md`

## Global Constraints

- No hard delete of a staff member — deactivate only (spec decision 5).
- Functional-role/task-assignee fields snapshot the assigned person's name as
  plain text at assignment time — no FK, no schema change to those columns
  (spec decision 4).
- Every action that changes who's active or what a role grants revalidates at
  the `'layout'` level, not `'page'` — this exact bug already bit Contacts'
  payee dropdowns once (spec, "Wiring into existing fields").
- `manage_users` can never be fully revoked — block any change that would
  leave zero active users holding it (spec, permission list).
- One role per profile (spec, "Out of scope for this pass").

## Operational prerequisites (not built in this plan — confirm before Task 6)

1. **Custom SMTP configured in the Supabase dashboard, using Resend** (Cam's
   pick). Supabase's default SMTP only delivers to addresses that are members
   of the Supabase org's own team — invites to real staff will silently fail
   without this.
2. **The "Invite user" email template edited** in the Supabase dashboard
   (Authentication → Email Templates → Invite user) to link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/invite/complete`
   instead of the default `{{ .ConfirmationURL }}`. This is the officially
   documented pattern for exchanging an invite token for a cookie-based
   session server-side in a Next.js App Router app — the default template
   sends the browser straight to Supabase's own hosted verify endpoint
   instead, which doesn't produce a session our server can read. Task 6
   builds the route this points to; without this template edit, that route
   never gets hit.
3. **A `SUPABASE_SERVICE_ROLE_KEY` environment variable**, added to
   `.env.local` locally and to the Vercel project's environment variables.
   Task 4 is the first code that reads it. This key must never be exposed to
   the client — it's read only inside `src/lib/supabase/admin.ts` (server-only
   module, never imported by a Client Component).

---

### Task 1: Migration `0054` — roles, role_permissions, profiles changes, backfill

**Files:**
- Create: `supabase/migrations/0054_staff_directory_permissions.sql`

**Interfaces:**
- Produces: `public.roles(id, name, created_at)`, `public.role_permissions(role_id, permission_key)`,
  `public.profiles.full_name`, `public.profiles.active`, `public.profiles.role_id`.
  All later tasks query these.

- [ ] **Step 1: Write the migration**

```sql
-- 0054_staff_directory_permissions.sql
-- Replaces the four SQL-only profiles.can_manage_* flags with role-based
-- permissions, and adds the columns an invite-only staff directory needs.
-- See docs/superpowers/specs/2026-09-10-staff-directory-permissions-design.md.

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null,
  primary key (role_id, permission_key)
);

insert into public.roles (name) values ('Admin'), ('Staff');

-- Admin gets every permission that exists today. New permissions added later
-- (in src/lib/constants.ts's PERMISSIONS list) are NOT auto-granted to
-- existing roles -- an admin grants them explicitly from the console.
insert into public.role_permissions (role_id, permission_key)
select (select id from public.roles where name = 'Admin'), key
from unnest(array[
  'manage_users',
  'manage_bill_codes',
  'manage_checklist_templates',
  'manage_folder_templates',
  'manage_lookup_data'
]) as key;

alter table public.profiles
  add column full_name text,
  add column active boolean not null default true,
  add column role_id uuid references public.roles(id);

-- Backfill BEFORE dropping the old columns and BEFORE making role_id
-- not-null, so every existing row (including Cam's) gets a real role from
-- data that's about to disappear, and no row is ever left with a null role.
update public.profiles
set role_id = (select id from public.roles where name = 'Admin')
where can_manage_folder_templates = true
   or can_manage_checklist_templates = true
   or can_manage_bill_codes = true
   or can_manage_lookup_data = true;

update public.profiles
set role_id = (select id from public.roles where name = 'Staff')
where role_id is null;

alter table public.profiles
  alter column role_id set not null,
  drop column can_manage_folder_templates,
  drop column can_manage_checklist_templates,
  drop column can_manage_bill_codes,
  drop column can_manage_lookup_data;

alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;

create policy "Authenticated M&L staff can view roles"
  on public.roles for select to authenticated using (true);

create policy "Authenticated M&L staff can view role_permissions"
  on public.role_permissions for select to authenticated using (true);

-- Insert/update/delete on roles and role_permissions happen only through
-- the service-role admin client (Task 4), which bypasses RLS entirely --
-- no authenticated-role write policy is needed or created here.
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP (`apply_migration`), matching how every prior
migration in this session was applied — this repo has no local Postgres, the
only database is the live Supabase project.

- [ ] **Step 3: Verify the backfill**

Run this query (via the Supabase MCP `execute_sql`) and confirm every
existing profile has a non-null `role_id`, and that any profile that
previously held a `can_manage_*` flag is now `Admin`:

```sql
select p.id, p.role_id, r.name as role_name
from public.profiles p
join public.roles r on r.id = p.role_id;
```

Expected: zero rows with a null `role_name`; the account(s) that previously
had `can_manage_*` flags set are `Admin`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0054_staff_directory_permissions.sql
git commit -m "feat: add roles/role_permissions tables, retire profiles.can_manage_* flags"
```

---

### Task 2: Permission list constant and shared types

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `PERMISSIONS`, `type PermissionKey`, `type Role`, `type Profile`.
  Task 3's `hasPermission()` and every admin-action task after it import
  these.

- [ ] **Step 1: Add the permission list to `src/lib/constants.ts`**

Add near `FUNCTIONAL_ROLES` (same file, same pattern — a code-defined list,
not a DB table):

```ts
// Flat, code-defined list of gateable capabilities. A role (public.roles) is
// just a named bundle of these keys via role_permissions -- adding a new
// permission here needs no migration, only a new gated call site.
export const PERMISSIONS = [
  { key: 'manage_users', label: 'Manage Users & Roles' },
  { key: 'manage_bill_codes', label: 'Manage Bill Codes' },
  { key: 'manage_checklist_templates', label: 'Manage Checklist Templates' },
  { key: 'manage_folder_templates', label: 'Manage Folder Templates' },
  { key: 'manage_lookup_data', label: 'Manage Lookup Data (Entity Directory)' },
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]['key']
```

- [ ] **Step 2: Add `Role` and `Profile` types to `src/lib/types.ts`**

```ts
export type Role = {
  id: string
  name: string
  created_at: string
}

export type Profile = {
  id: string
  full_name: string | null
  active: boolean
  role_id: string
}
```

- [ ] **Step 3: Verify the build picks up the new types**

Run: `npm run build`
Expected: clean build (these are additive-only changes, nothing imports them
yet).

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/types.ts
git commit -m "feat: add PERMISSIONS list and Role/Profile types"
```

---

### Task 3: `hasPermission()` helper, replacing `src/lib/permissions.ts`

**Files:**
- Modify: `src/lib/permissions.ts` (full rewrite)
- Modify: `src/app/admin/bill-codes/page.tsx:3,14`
- Modify: `src/app/admin/checklist-templates/page.tsx:3,14`
- Modify: `src/app/admin/folder-templates/page.tsx:3,14`
- Modify: `src/app/actions/bill-codes.ts:5,22,44,65`
- Modify: `src/app/actions/checklist-templates.ts:5,28,54,75`
- Modify: `src/app/actions/folder-templates.ts:5,32,56,74`
- Modify: `supabase/migrations/0053_entity_directory.sql` is NOT touched (past
  migrations are never edited) — instead:
- Create: `supabase/migrations/0055_entity_directory_role_permissions.sql`

**Interfaces:**
- Consumes: `PermissionKey` (Task 2), `public.role_permissions` (Task 1).
- Produces: `getCurrentProfile(supabase)`, `hasPermission(supabase, key)`.
  Task 4's admin actions and Task 7's middleware both call these.

- [ ] **Step 1: Rewrite `src/lib/permissions.ts`**

```ts
import type { createClient } from '@/lib/supabase/server'
import type { PermissionKey } from '@/lib/constants'
import type { Profile } from '@/lib/types'

export async function getCurrentProfile(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, active, role_id')
    .eq('id', user.id)
    .maybeSingle()

  return profile
}

export async function hasPermission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  key: PermissionKey
): Promise<boolean> {
  const profile = await getCurrentProfile(supabase)
  if (!profile || !profile.active) return false

  const { data } = await supabase
    .from('role_permissions')
    .select('permission_key')
    .eq('role_id', profile.role_id)
    .eq('permission_key', key)
    .maybeSingle()

  return data !== null
}
```

- [ ] **Step 2: Swap the three admin page gates**

In each of `src/app/admin/bill-codes/page.tsx`, `checklist-templates/page.tsx`,
`folder-templates/page.tsx` — same two-line change in each:

```diff
- import { requireBillCodePermission } from '@/lib/permissions'
+ import { hasPermission } from '@/lib/permissions'
```
```diff
- if (!(await requireBillCodePermission(supabase))) redirect('/orders')
+ if (!(await hasPermission(supabase, 'manage_bill_codes'))) redirect('/orders')
```

(substitute `'manage_checklist_templates'` and `'manage_folder_templates'`
for the other two files respectively).

- [ ] **Step 3: Swap the three action files' gates**

Same pattern, three call sites per file. In `src/app/actions/bill-codes.ts`
(lines 5, 22, 44, 65 — one import, three guard calls):

```diff
- import { requireBillCodePermission } from '@/lib/permissions'
+ import { hasPermission } from '@/lib/permissions'
```
```diff
- if (!(await requireBillCodePermission(supabase))) {
+ if (!(await hasPermission(supabase, 'manage_bill_codes'))) {
```
(repeated at all three guard call sites in that file). Apply the equivalent
substitution (`'manage_checklist_templates'` / `'manage_folder_templates'`) in
`checklist-templates.ts` and `folder-templates.ts`.

- [ ] **Step 4: Rewrite Entity Directory's RLS policies in a new migration**

Entity Directory's permission gate is NOT in `permissions.ts` — migration
`0053` checks `can_manage_lookup_data` directly inside two RLS policies. That
column no longer exists after Task 1, so this migration is not optional —
without it, Entity Directory's update/delete policies reference a dropped
column and every write breaks.

```sql
-- 0055_entity_directory_role_permissions.sql
-- 0053's RLS policies checked profiles.can_manage_lookup_data directly.
-- That column was dropped in 0054 -- these policies now check role-derived
-- permission instead. See 0054's migration comment for why the column was
-- dropped in the first place.

alter policy "Authenticated M&L staff can update entity_directory, deactivation gated"
  on public.entity_directory
  using (true)
  with check (
    is_active = true
    or exists (
      select 1 from public.profiles p
      join public.role_permissions rp on rp.role_id = p.role_id
      where p.id = auth.uid() and rp.permission_key = 'manage_lookup_data'
    )
  );

alter policy "Only permitted users can delete entity_directory"
  on public.entity_directory
  using (
    exists (
      select 1 from public.profiles p
      join public.role_permissions rp on rp.role_id = p.role_id
      where p.id = auth.uid() and rp.permission_key = 'manage_lookup_data'
    )
  );
```

- [ ] **Step 5: Apply migration 0055**

Apply via the Supabase MCP (`apply_migration`).

- [ ] **Step 6: Verify live against the seeded account**

Log in as `genesis-e2e-seed@genesis-app-e2e-test.dev` (already granted
`can_manage_lookup_data = true` per prior session precedent — after Task 1's
backfill this account is `Admin`, which holds every permission). Confirm:
`/admin/bill-codes`, `/admin/checklist-templates`, `/admin/folder-templates`
all still load (not redirected to `/orders`). Add a test Entity Directory
record and edit it (exercises the rewritten RLS policy) — confirm it saves.
Remove the test record after.

- [ ] **Step 7: Run the full e2e suite**

Run: `npx playwright test`
Expected: same pass count as before this task (this task only changes how
permission is checked, not what's gated) — no new failures.

- [ ] **Step 8: Commit**

```bash
git add src/lib/permissions.ts src/app/admin/bill-codes/page.tsx \
  src/app/admin/checklist-templates/page.tsx src/app/admin/folder-templates/page.tsx \
  src/app/actions/bill-codes.ts src/app/actions/checklist-templates.ts \
  src/app/actions/folder-templates.ts supabase/migrations/0055_entity_directory_role_permissions.sql
git commit -m "feat: replace can_manage_* boolean checks with role-based hasPermission()"
```

---

### Task 4: Service-role admin client and admin server actions

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Create: `src/app/actions/admin-users.ts`

**Interfaces:**
- Consumes: `hasPermission`, `getCurrentProfile` (Task 3); `Role`, `Profile`
  (Task 2); `public.roles`, `public.role_permissions` (Task 1).
- Produces: `listStaff()`, `listRoles()`, `inviteUser(email, fullName, roleId)`,
  `setUserActive(profileId, active)`, `createRole(name)`,
  `setRolePermission(roleId, permissionKey, granted)`, `deleteRole(roleId)`,
  `listActiveStaffNames()`. Task 5's console UI and Task 8's Order Info
  picker both call these.

- [ ] **Step 1: Create the service-role client factory**

```ts
// src/lib/supabase/admin.ts
// Server-only. Never import this from a Client Component -- the service-role
// key bypasses RLS entirely. Used only for operations the Supabase Admin API
// requires it for (inviting a user) and for admin-console writes to
// roles/role_permissions, which have no authenticated-role write policy
// (see 0054's migration comment).
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 2: Write the admin actions file**

```ts
// src/app/actions/admin-users.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPermission } from '@/lib/permissions'
import type { Role, Profile } from '@/lib/types'

async function requireManageUsers() {
  const supabase = await createClient()
  const allowed = await hasPermission(supabase, 'manage_users')
  return { supabase, allowed }
}

// Would this change leave zero active users able to manage users? Checked
// before revoking manage_users from a role, deleting a role that holds it,
// or deactivating a profile -- the lockout guard from the spec.
async function countOtherActiveManageUsersHolders(
  admin: ReturnType<typeof createAdminClient>,
  excludingProfileId?: string
): Promise<number> {
  const { data } = await admin
    .from('profiles')
    .select('id, active, role_id, role_permissions:role_id(permission_key)')
    .eq('active', true)
    .neq('id', excludingProfileId ?? '')

  // role_permissions is joined via role_id -- filter client-side since the
  // permission_key check can't be expressed as a simple column filter here.
  return (data ?? []).filter((p) =>
    (p.role_permissions as { permission_key: string }[] | null)?.some(
      (rp) => rp.permission_key === 'manage_users'
    )
  ).length
}

export async function listStaff(): Promise<
  (Profile & { email: string; role_name: string })[] | { error: string }
> {
  const { supabase, allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }

  const admin = createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, active, role_id, roles:role_id(name)')
    .order('full_name')

  if (!profiles) return { error: 'Could not load staff.' }

  const results = await Promise.all(
    profiles.map(async (p) => {
      const { data: authUser } = await admin.auth.admin.getUserById(p.id)
      return {
        id: p.id,
        full_name: p.full_name,
        active: p.active,
        role_id: p.role_id,
        role_name: (p.roles as { name: string } | null)?.name ?? 'Staff',
        email: authUser.user?.email ?? '',
      }
    })
  )
  return results
}

export async function listRoles(): Promise<
  (Role & { permission_keys: string[] })[] | { error: string }
> {
  const { supabase, allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }

  const { data } = await supabase
    .from('roles')
    .select('id, name, created_at, role_permissions(permission_key)')
    .order('name')

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    permission_keys: (r.role_permissions as { permission_key: string }[]).map(
      (rp) => rp.permission_key
    ),
  }))
}

export async function inviteUser(
  email: string,
  fullName: string,
  roleId: string
): Promise<{ error?: string }> {
  const { allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }
  if (!email.trim() || !fullName.trim() || !roleId) {
    return { error: 'Email, name, and role are all required.' }
  }

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    redirectTo: `${siteUrl}/invite/complete`,
  })

  if (error || !data.user) {
    return { error: error?.message ?? 'Could not send invite.' }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: data.user.id, full_name: fullName.trim(), role_id: roleId, active: true })

  if (profileError) return { error: profileError.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function setUserActive(
  profileId: string,
  active: boolean
): Promise<{ error?: string }> {
  const { allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }

  const admin = createAdminClient()

  if (!active) {
    const remaining = await countOtherActiveManageUsersHolders(admin, profileId)
    if (remaining === 0) {
      return { error: 'Deactivating this person would leave nobody able to manage users.' }
    }
  }

  const { error } = await admin.from('profiles').update({ active }).eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function createRole(name: string): Promise<{ error?: string }> {
  const { allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }
  if (!name.trim()) return { error: 'Role name is required.' }

  const admin = createAdminClient()
  const { error } = await admin.from('roles').insert({ name: name.trim() })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function setRolePermission(
  roleId: string,
  permissionKey: string,
  granted: boolean
): Promise<{ error?: string }> {
  const { allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }

  const admin = createAdminClient()

  if (!granted && permissionKey === 'manage_users') {
    const { data: holders } = await admin
      .from('profiles')
      .select('id')
      .eq('role_id', roleId)
      .eq('active', true)
    const otherHoldersOutsideThisRole = await countOtherActiveManageUsersHolders(admin)
    const affectedActiveUsersInThisRole = holders?.length ?? 0
    if (otherHoldersOutsideThisRole - affectedActiveUsersInThisRole <= 0 && affectedActiveUsersInThisRole > 0) {
      return { error: 'Removing this would leave nobody able to manage users.' }
    }
  }

  if (granted) {
    const { error } = await admin
      .from('role_permissions')
      .insert({ role_id: roleId, permission_key: permissionKey })
    if (error) return { error: error.message }
  } else {
    const { error } = await admin
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('permission_key', permissionKey)
    if (error) return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return {}
}

export async function deleteRole(roleId: string): Promise<{ error?: string }> {
  const { allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }

  const admin = createAdminClient()
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role_id', roleId)
    .eq('active', true)

  if ((count ?? 0) > 0) {
    return { error: 'Cannot delete a role while an active user still holds it.' }
  }

  const { error } = await admin.from('roles').delete().eq('id', roleId)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

// Used by pickers elsewhere in the app (Order Info's functional-role
// fields) -- any authenticated user can read this, not gated on
// manage_users, since assigning a coworker to a file is a normal-staff
// action, not an admin one.
export async function listActiveStaffNames(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('active', true)
    .not('full_name', 'is', null)
    .order('full_name')

  return (data ?? []).map((p) => p.full_name as string)
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: clean build. `SUPABASE_SERVICE_ROLE_KEY` must already be set in
`.env.local` (operational prerequisite #3) or `createAdminClient()` throws at
runtime the first time an admin action is called — confirm the env var is
present before moving to Task 5's live verification.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/admin.ts src/app/actions/admin-users.ts
git commit -m "feat: add service-role admin client and admin-users server actions"
```

---

### Task 5: Admin console UI (`/admin/users`)

**Files:**
- Create: `src/app/admin/users/page.tsx`
- Create: `src/components/AdminUsersConsole.tsx`

**Interfaces:**
- Consumes: `listStaff`, `listRoles`, `inviteUser`, `setUserActive`,
  `createRole`, `setRolePermission`, `deleteRole` (Task 4); `PERMISSIONS`
  (Task 2); `hasPermission` (Task 3).

- [ ] **Step 1: Write the page loader**

```tsx
// src/app/admin/users/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import { listStaff, listRoles } from '@/app/actions/admin-users'
import { AdminUsersConsole } from '@/components/AdminUsersConsole'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!(await hasPermission(supabase, 'manage_users'))) redirect('/orders')

  const staff = await listStaff()
  const roles = await listRoles()

  if ('error' in staff || 'error' in roles) redirect('/orders')

  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Users & Roles</h1>
      <AdminUsersConsole initialStaff={staff} initialRoles={roles} />
    </main>
  )
}
```

- [ ] **Step 2: Write the console component**

Two-tab layout matching Property/Prelim Search's existing in-page tab
pattern (`role="tablist"`), instant server-action CRUD matching
`BillCodeAdmin.tsx`'s existing pattern (`useTransition`, full reload on
success rather than optimistic local state — this screen is used rarely
enough that the extra wiring isn't worth it, same call already made there).

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  inviteUser,
  setUserActive,
  createRole,
  setRolePermission,
  deleteRole,
} from '@/app/actions/admin-users'
import { PERMISSIONS } from '@/lib/constants'
import type { Role, Profile } from '@/lib/types'

type StaffRow = Profile & { email: string; role_name: string }
type RoleRow = Role & { permission_keys: string[] }

export function AdminUsersConsole({
  initialStaff,
  initialRoles,
}: {
  initialStaff: StaffRow[]
  initialRoles: RoleRow[]
}) {
  const [tab, setTab] = useState<'users' | 'roles'>('users')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState(initialRoles[0]?.id ?? '')
  const [newRoleName, setNewRoleName] = useState('')

  function refresh() {
    window.location.reload()
  }

  function handleInvite() {
    startTransition(async () => {
      const result = await inviteUser(inviteEmail.trim(), inviteName.trim(), inviteRoleId)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleToggleActive(profileId: string, active: boolean) {
    startTransition(async () => {
      const result = await setUserActive(profileId, active)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleCreateRole() {
    if (!newRoleName.trim()) return
    startTransition(async () => {
      const result = await createRole(newRoleName.trim())
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleTogglePermission(roleId: string, permissionKey: string, granted: boolean) {
    startTransition(async () => {
      const result = await setRolePermission(roleId, permissionKey, granted)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleDeleteRole(roleId: string, name: string) {
    if (!window.confirm(`Delete role "${name}"?`)) return
    startTransition(async () => {
      const result = await deleteRole(roleId)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div role="tablist" className="mb-4 flex gap-2 border-b">
        <button
          role="tab"
          aria-selected={tab === 'users'}
          className="border-b-2 px-3 py-2 text-sm data-[selected=true]:border-primary"
          data-selected={tab === 'users'}
          onClick={() => setTab('users')}
        >
          Users
        </button>
        <button
          role="tab"
          aria-selected={tab === 'roles'}
          className="border-b-2 px-3 py-2 text-sm data-[selected=true]:border-primary"
          data-selected={tab === 'roles'}
          onClick={() => setTab('roles')}
        >
          Roles
        </button>
      </div>

      {tab === 'users' && (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email"
              aria-label="Invite email"
              className="max-w-xs"
            />
            <Input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Full name"
              aria-label="Invite full name"
              className="max-w-xs"
            />
            <Select value={inviteRoleId} onValueChange={(v) => v !== null && setInviteRoleId(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {initialRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={handleInvite} disabled={isPending}>
              + Invite User
            </Button>
          </div>

          <ul className="divide-y" data-testid="staff-list">
            {initialStaff.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2" data-testid="staff-row">
                <span className="flex-1">{s.full_name}</span>
                <span className="text-sm text-muted-foreground">{s.email}</span>
                <span className="text-xs">{s.role_name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleActive(s.id, !s.active)}
                  disabled={isPending}
                >
                  {s.active ? 'Deactivate' : 'Activate'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'roles' && (
        <div>
          <div className="mb-4 flex items-end gap-2">
            <Input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Role name"
              aria-label="New role name"
              className="max-w-xs"
            />
            <Button type="button" onClick={handleCreateRole} disabled={isPending}>
              + New Role
            </Button>
          </div>

          {initialRoles.map((role) => (
            <div key={role.id} className="mb-4 rounded border p-3" data-testid="role-card">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{role.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteRole(role.id, role.name)}
                  disabled={isPending}
                >
                  Delete
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSIONS.map((perm) => (
                  <label key={perm.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      defaultChecked={role.permission_keys.includes(perm.key)}
                      onChange={(e) =>
                        handleTogglePermission(role.id, perm.key, e.target.checked)
                      }
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Live-verify against the seeded account**

Log in as the seeded admin account, visit `/admin/users`. Confirm: the Users
tab lists existing staff with correct role badges; the Roles tab shows Admin
with every permission checked and Staff with none. Invite a throwaway test
address (use a real inbox you control, or skip send verification and just
confirm the `profiles` row was created via SQL — Resend's sandbox/test mode
depends on prerequisite #1 being configured). Deactivate and reactivate a
non-critical test profile, confirming the toggle round-trips. Create a
throwaway role, grant it one permission, delete it. Clean up all test data
created during this check.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/users/page.tsx src/components/AdminUsersConsole.tsx
git commit -m "feat: build admin console for staff and roles"
```

---

### Task 6: Invite completion flow and `/signup` removal

**Files:**
- Create: `src/app/auth/confirm/route.ts`
- Create: `src/app/invite/complete/page.tsx`
- Delete: `src/app/signup/page.tsx`
- Delete: `src/app/signup/actions.ts`
- Modify: `src/lib/supabase/middleware.ts:30`

**Interfaces:**
- Consumes: `createClient` (`@/lib/supabase/server` for the route handler,
  `@/lib/supabase/client` for the completion page).

- [ ] **Step 1: Write the server-side confirm route**

This is the officially documented Supabase + Next.js App Router pattern for
exchanging an invite/OTP token for a real cookie-based session — required
because this app uses `@supabase/ssr`'s cookie-based sessions, not the
client-only hash-fragment flow.

```ts
// src/app/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/orders'

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('type')
  redirectTo.searchParams.delete('next')

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(redirectTo)
    }
  }

  const errorUrl = request.nextUrl.clone()
  errorUrl.pathname = '/login'
  errorUrl.searchParams.set('error', 'This invite link is invalid or has expired.')
  return NextResponse.redirect(errorUrl)
}
```

- [ ] **Step 2: Write the invite-completion page**

By the time someone lands here, `/auth/confirm` has already established a
real session via cookies — this page just collects a password.

```tsx
// src/app/invite/complete/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function InviteCompletePage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSubmitting(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    router.push('/orders')
  }

  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="mb-4 text-xl font-semibold">Set your password</h1>
      <form onSubmit={handleSubmit}>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1"
        />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="mt-4 w-full" disabled={submitting}>
          Set Password & Continue
        </Button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Delete the public signup flow**

```bash
git rm src/app/signup/page.tsx src/app/signup/actions.ts
```

- [ ] **Step 4: Update the middleware's public paths**

```diff
-  const publicPaths = ['/login', '/signup']
+  const publicPaths = ['/login', '/auth/confirm', '/invite/complete']
```

- [ ] **Step 5: Verify live, end to end**

Complete prerequisites #1 and #2 first (custom SMTP + email template edit) —
this step can't be verified without them. Invite a real address you control
from `/admin/users`, receive the email, click the link, confirm it lands on
`/invite/complete` (not an error page), set a password, confirm it redirects
to `/orders` and you're logged in. Confirm `/signup` now 404s.

- [ ] **Step 6: Run the full e2e suite**

Run: `npx playwright test`
Expected: same pass count as before (no existing test references `/signup`
based on this repo's e2e conventions — confirm none broke).

- [ ] **Step 7: Commit**

```bash
git add src/app/auth/confirm/route.ts src/app/invite/complete/page.tsx \
  src/lib/supabase/middleware.ts
git commit -m "feat: replace public signup with invite-only account completion"
```

---

### Task 7: Enforce `active` on every authenticated request

**Files:**
- Modify: `src/lib/supabase/middleware.ts`

**Interfaces:**
- Consumes: `profiles.active` (Task 1).

- [ ] **Step 1: Add the active check to `updateSession`**

Inserted after `getUser()` succeeds, before the existing
`!user && !isPublicPath` redirect:

```diff
   const {
     data: { user },
   } = await supabase.auth.getUser()

+  if (user) {
+    const { data: profile } = await supabase
+      .from('profiles')
+      .select('active')
+      .eq('id', user.id)
+      .maybeSingle()
+
+    if (profile && !profile.active) {
+      await supabase.auth.signOut()
+      const url = request.nextUrl.clone()
+      url.pathname = '/login'
+      url.searchParams.set('error', 'Your account has been deactivated.')
+      return NextResponse.redirect(url)
+    }
+  }
+
   const publicPaths = ['/login', '/auth/confirm', '/invite/complete']
```

- [ ] **Step 2: Write the e2e test**

A throwaway staff account, not the shared seeded one — deactivating the
seeded account mid-suite would break every other test's login.

```ts
// tests/e2e/deactivated-user-login.spec.ts
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hlahrypglnmjjxrdtfkm.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

test('a deactivated user is signed out and blocked from logging back in', async ({ page }) => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const email = `e2e-deactivated-${Date.now()}@genesis-app-e2e-test.dev`
  const password = 'TempPass123!'

  const { data: created } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  const staffRole = await admin.from('roles').select('id').eq('name', 'Staff').single()
  await admin.from('profiles').insert({
    id: created.user!.id,
    full_name: 'E2E Deactivated Test',
    role_id: staffRole.data!.id,
    active: true,
  })

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/orders')

  await admin.from('profiles').update({ active: false }).eq('id', created.user!.id)

  await page.goto('/orders')
  await page.waitForURL('**/login**')
  await expect(page.getByText('Your account has been deactivated.')).toBeVisible()

  await admin.auth.admin.deleteUser(created.user!.id)
})
```

- [ ] **Step 3: Run the test**

Run: `npx playwright test tests/e2e/deactivated-user-login.spec.ts`
Expected: PASS.

- [ ] **Step 4: Run the full e2e suite**

Run: `npx playwright test`
Expected: no new failures.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/middleware.ts tests/e2e/deactivated-user-login.spec.ts
git commit -m "feat: sign out and block deactivated users at the middleware layer"
```

---

### Task 8: Wire Order Info's functional-role fields to the active-staff picker

**Files:**
- Modify: `src/app/orders/[id]/order-info/page.tsx`
- Modify: `src/components/OrderInfoForm.tsx`

**Interfaces:**
- Consumes: `listActiveStaffNames()` (Task 4).

- [ ] **Step 1: Pass the active staff list into the page**

```diff
+import { listActiveStaffNames } from '@/app/actions/admin-users'
+
 export default async function OrderInfoPage({ params }: { params: Promise<{ id: string }> }) {
   const { id } = await params
   const supabase = await createClient()

+  const activeStaffNames = await listActiveStaffNames()
+
   const { data: order } = await supabase
     ...
-  return <OrderInfoForm orderId={id} order={order} />
+  return <OrderInfoForm orderId={id} order={order} activeStaffNames={activeStaffNames} />
 }
```

- [ ] **Step 2: Replace the free-text functional-role inputs with a picker**

Matches this same file's existing `escrow_status` `<Select>` pattern exactly
(`onValueChange` calling `handleSave` with an explicit override, since the
field isn't in the form's native controlled state).

```diff
 export function OrderInfoForm({
   orderId,
   order,
+  activeStaffNames,
 }: {
   orderId: string
   order: OrderInfoFields
+  activeStaffNames: string[]
 }) {
```
```diff
         {FUNCTIONAL_ROLES.map(({ key, label }) => (
           <div key={key}>
             <Label htmlFor={key}>{label}</Label>
-            <Input id={key} name={key} className="mt-1" defaultValue={order[key] ?? undefined} onBlur={() => handleSave()} />
+            <Select
+              name={key}
+              defaultValue={order[key] ?? undefined}
+              onValueChange={(value) => value !== null && handleSave({ name: key, value })}
+            >
+              <SelectTrigger id={key} className="mt-1 w-full">
+                <SelectValue placeholder="— Select —" />
+              </SelectTrigger>
+              <SelectContent>
+                {activeStaffNames.map((name) => (
+                  <SelectItem key={name} value={name}>{name}</SelectItem>
+                ))}
+              </SelectContent>
+            </Select>
           </div>
         ))}
```

**Note on `Input` becoming unused in this file:** check whether `Input` is
still used elsewhere in `OrderInfoForm.tsx` before removing its import — this
file has no other free-text field today, so the import is likely now dead;
remove it only if `npm run lint` flags it.

- [ ] **Step 3: Write the e2e test**

```ts
// tests/e2e/order-info-staff-picker.spec.ts
import { test, expect } from '@playwright/test'

test('functional-role fields on Order Info pick from active staff', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('genesis-e2e-seed@genesis-app-e2e-test.dev')
  await page.getByLabel('Password').fill('E2eSeedPass123!')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/orders')

  await page.goto('/orders')
  await page.getByRole('link', { name: /26-00001NC/ }).click()
  await page.getByRole('link', { name: 'Order Info' }).click()

  await page.getByLabel('Title Officer').click()
  await expect(page.getByRole('option')).not.toHaveCount(0)
})
```

- [ ] **Step 4: Run the test**

Run: `npx playwright test tests/e2e/order-info-staff-picker.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the full e2e suite**

Run: `npx playwright test`
Expected: no new failures. (An existing Order Info test may currently `fill()`
a functional-role field as free text — if so, update it to `click()` +
`getByRole('option', { name: ... })` instead, matching how every other
`<Select>` field in this suite is already exercised.)

- [ ] **Step 6: Commit**

```bash
git add src/app/orders/[id]/order-info/page.tsx src/components/OrderInfoForm.tsx \
  tests/e2e/order-info-staff-picker.spec.ts
git commit -m "feat: wire Order Info functional-role fields to active-staff picker"
```

---

### Task 9: Full regression, vault docs, Build Log

**Files:**
- Modify: `M&L Title - Obsidian Vault/Genesis Screen Notes - Fix Plan.md`
- Modify: `M&L Title - Obsidian Vault/Genesis Build Log.md`
- Modify: `M&L Title - Obsidian Vault/Genesis Rebuild - Staff Directory & Permissions Design.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Full regression**

Run: `npm run build`
Expected: clean.

Run: `npm run lint`
Expected: clean.

Run: `npx playwright test`
Expected: full suite green, same or higher pass count than session start.

- [ ] **Step 2: Update the vault design doc's status**

Change the frontmatter `status:` line in
`Genesis Rebuild - Staff Directory & Permissions Design.md` from "design
complete — awaiting Cam's review" to "built 2026-09-10" (or the actual ship
date), and add a closing paragraph summarizing what shipped vs. what's
explicitly out of scope (Requested/Checklist Tasks assignee wiring — see
note below).

- [ ] **Step 3: Update the Fix Plan**

Add an entry to `Genesis Screen Notes - Fix Plan.md` under today's date,
struck through, linking to the design doc, noting: staff directory + admin
console + permissions shipped; Order Info's functional-role fields now use
the picker; **Requested/Checklist Tasks task-assignee wiring is explicitly
NOT part of this build** — those screens have no `assigned_to` column or UI
today, and adding one needs its own small design pass (which field shape,
one assignee or multiple) now that a real roster exists to assign from. Flag
it back to Cam as a fast-follow, not forgotten scope.

- [ ] **Step 4: Add a Build Log entry**

Following this vault's established format (see any prior entry in
`Genesis Build Log.md` for the pattern) — summarize the migration, the
permission-model swap, the invite flow, the two real technical findings from
this build (the `permissions.ts` near-duplicate consolidation, and Entity
Directory's RLS-policy-not-TypeScript-check gotcha), and the deliberate
Requested/Checklist Tasks descope.

- [ ] **Step 5: Sync T7 → Desktop**

Before running the sync script, check for any Desktop-vault file edited more
recently than the last known sync point that isn't `Cam's Screen Notes.md`
(the only file the sync script itself protects) — this bit the team once
already this session. If any are found, reconcile them onto T7 first (same
approach as the `Cam's Notes.md` incident earlier), then run
`.claude/hooks/sync-to-desktop.sh`.

- [ ] **Step 6: Confirm commits, ask before pushing**

```bash
git log --oneline main ^origin/main
```

Confirm every task's commit from this plan is present, then ask Cam before
pushing (per this project's established convention — pushing is a separate
explicit approval, not implied by "commit").
