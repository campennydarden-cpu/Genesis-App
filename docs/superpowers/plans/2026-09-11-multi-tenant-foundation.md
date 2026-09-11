# Multi-Tenant Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every tenant-owned table in the schema a real `organization_id`
boundary and RLS that actually checks it, with exactly one seeded
organization (`M&L Title`), so isolation runs under real production use now
instead of being invented under pressure the day a second customer's data
needs to share the schema.

**Architecture:** One `organizations` table, one `current_org_id()` SQL
function, `profiles.organization_id`, and a table-by-table RLS rewrite from
today's blanket `using (true)` to `using (organization_id = current_org_id())`
across the 52 tenant-owned tables (4 tables — `zip_lookup`,
`recording_fee_schedules`, `transfer_tax_schedules`,
`recordation_tax_schedules` — are shared regulatory reference data and are
explicitly untouched).

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres +
`@supabase/ssr`), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-09-11-multi-tenant-foundation-design.md`

## Global Constraints

- **Real dependency, confirm before starting Task 1:** `organization_id`
  lands on `profiles`, the same table Staff Directory & Permissions
  (`docs/superpowers/plans/2026-09-10-staff-directory-permissions.md`) adds
  `role_id`/`full_name`/`active` to. Confirm with Cam whether this folds into
  that migration or lands immediately after it, per the spec's Sequencing
  section, before writing migration files.
- Migration file numbers below are written as `00XX` — before creating each
  migration, run `ls supabase/migrations | sort -V | tail -3` to find the
  actual next available number.
- `current_org_id()` is `security definer` + `stable` — required so a
  policy on any other table can read `profiles.organization_id` without
  `profiles`' own RLS blocking the nested read, and so Postgres evaluates it
  once per statement, not once per row.
- The existing permissive-policy naming convention
  (`"Authenticated M&L staff can do anything with X"`) is retained but
  reworded to make the new scoping visible in `\d+` / dashboard listings:
  `"Authenticated M&L staff can do anything with X in their organization"`.
- Every new/rewritten mutating server action or RLS-dependent read continues
  to call `revalidatePath('/', 'layout')`, not `'page'` — this codebase has a
  known staleness bug when narrower revalidation is used.

---

### Task 1: `organizations` table, seed row, `current_org_id()`

**Files:**
- Create: `supabase/migrations/00XX_organizations_foundation.sql`

**Interfaces:**
- Produces: table `organizations`, function `public.current_org_id()`.
  Task 2's policy rewrites and Task 3's `profiles.organization_id` backfill
  both depend on the seeded row's id existing before they run.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/00XX_organizations_foundation.sql
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.organizations (name) values ('M&L Title');

alter table public.organizations enable row level security;

create policy "Authenticated M&L staff can read organizations"
  on public.organizations for select to authenticated using (true);
```

No insert/update/delete policy on `organizations` for now — creating or
modifying an org happens via service role only (there is no admin UI for
this in scope, per the spec's Out of scope).

- [ ] **Step 2: `current_org_id()` function**

```sql
create function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;
```

This must run *after* Task 3 adds `profiles.organization_id` if folded into
the same migration file — order the statements accordingly, or keep this as
its own migration file that runs after Task 3's.

---

### Task 2: `profiles.organization_id`

**Files:**
- Modify or coordinate with: whichever migration adds Staff Directory &
  Permissions' `role_id`/`full_name`/`active` columns (per Global Constraints)

**Interfaces:**
- Produces: `profiles.organization_id`, not null, backfilled. Every table in
  Task 4's RLS rewrite depends on `current_org_id()` resolving a non-null
  value for every authenticated user, which depends on this column being
  populated for every existing profile before its `not null` constraint is
  added.

- [ ] **Step 1: Add nullable, backfill, then constrain**

```sql
alter table public.profiles
  add column organization_id uuid references public.organizations(id);

update public.profiles
  set organization_id = (select id from public.organizations where name = 'M&L Title');

alter table public.profiles
  alter column organization_id set not null;
```

- [ ] **Step 2: Confirm the invite flow sets it**

If Staff Directory & Permissions' invite server action already exists by the
time this runs, add `organization_id: (single seeded org's id)` to the
`profiles` insert it performs — hardcoded for now, exactly as the spec
describes, since there is only one organization to invite into.

---

### Task 3: Enable RLS on the two tables missing it, straight to org-scoped

**Files:**
- Create: `supabase/migrations/00XX_org_scope_missing_rls.sql`

**Interfaces:**
- Produces: RLS enabled + org-scoped policy on `cdf_page` and
  `entity_directory_code_sequences`. Must run after Task 1 and Task 2 (needs
  both `organizations` and `profiles.organization_id` to exist).

- [ ] **Step 1: `cdf_page`**

```sql
alter table public.cdf_page add column organization_id uuid references public.organizations(id);
update public.cdf_page set organization_id = (select id from public.organizations where name = 'M&L Title');
alter table public.cdf_page alter column organization_id set not null;
alter table public.cdf_page enable row level security;

create policy "Authenticated M&L staff can do anything with cdf_page in their organization"
  on public.cdf_page for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());
```

- [ ] **Step 2: `entity_directory_code_sequences`** — identical pattern,
  substituting the table name.

---

### Task 4: RLS rewrite across the 52 tenant-owned tables

**Files:**
- Create: `supabase/migrations/00XX_org_scope_rls_rewrite.sql` (may be split
  into multiple migration files if preferred for reviewability — Postgres
  has no limit either way)

**Interfaces:**
- Rewrites the existing `using (true)` policy to
  `using (organization_id = current_org_id())` on every table below. Depends
  on Task 1 and Task 2.

- [ ] **Step 1: Add the column to every table in the list**

For each table `X` below, run:

```sql
alter table public.X add column organization_id uuid references public.organizations(id);
update public.X set organization_id = (select id from public.organizations where name = 'M&L Title');
alter table public.X alter column organization_id set not null;
```

Tables (52): `orders`, `contacts`, `contact_principals`,
`contact_signature_lines`, `property_details`, `property_easements`,
`chain_of_title`, `prelim_search`, `commitment_sch_a`,
`commitment_sch_b_settings`, `commitment_requirements`,
`commitment_exceptions`, `exception_matters`, `curative_settings`,
`derivation_principals`, `security_instruments`,
`security_instrument_related_docs`, `liens`, `doc_prep_deed`,
`doc_prep_deed_principals`, `doc_prep_deed_signature_lines`,
`doc_prep_deed_subject_to`, `doc_prep_security_instrument`,
`doc_prep_si_principals`, `doc_prep_affidavits`, `doc_prep_notary_acks`,
`title_insurance_premiums`, `title_insurance_premium_splits`,
`endorsements`, `endorsement_splits`, `additional_title_charges`,
`additional_title_charge_splits`, `settlement_options`, `tax_prorations`,
`recording_documents`, `invoices`, `invoice_line_items`,
`cdf_cash_to_close`, `cdf_transaction_summary_lines`,
`cdf_payoffs_payments`, `cdf_payoff_additional_charges`, `entity_directory`,
`entity_directory_people`, `attachments`, `attachment_folders`,
`bill_codes`, `checklist_task_templates`, `checklist_tasks`,
`folder_templates`, `file_number_counters`, `requested_tasks`.

(`cdf_page` and `entity_directory_code_sequences` are handled in Task 3, not
here, since they need RLS enabled from scratch rather than an existing
policy dropped and replaced.)

- [ ] **Step 2: For each table above, drop and replace its policy**

```sql
drop policy "Authenticated M&L staff can do anything with X" on public.X;

create policy "Authenticated M&L staff can do anything with X in their organization"
  on public.X for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());
```

Before running this, check each table's actual existing policy name in its
origin migration — a handful may not follow the exact
`"Authenticated M&L staff can do anything with X"` wording (e.g. tables added
via multi-table migrations may name policies differently). Verify with:

```sql
select tablename, policyname from pg_policies where schemaname = 'public' and tablename = 'X';
```

before writing each `drop policy` statement, rather than assuming the name.

- [ ] **Step 3: Once Staff Directory & Permissions ships, apply the same
  Step 1 + Step 2 pattern to `roles` and `role_permissions`** — these don't
  exist yet as of this plan being written, so they're called out separately
  rather than included in the table list above.

---

### Task 5: Document the going-forward convention

**Files:**
- Modify: `AGENTS.md` and/or `CLAUDE.md`

**Interfaces:**
- No code interface — this is the guardrail against the same convention
  quietly rotting the way the four flat `can_manage_*` booleans did before
  Staff Directory & Permissions caught them.

- [ ] **Step 1: Add a short section**, e.g.:

> **Tenant scoping.** Every new table is either tenant-owned (gets
> `organization_id uuid not null references organizations(id)` and an RLS
> policy scoped to `organization_id = current_org_id()`) or shared reference
> data (a deliberate, named exception — jurisdiction/regulatory facts
> identical across every title company, e.g. `zip_lookup`,
> `recording_fee_schedules`). State which one a new table is in its
> migration's comments. See `docs/superpowers/specs/2026-09-11-multi-tenant-foundation-design.md`
> for the full rationale.

---

### Task 6: Verification — prove isolation actually works

**Files:**
- No production files — this runs against a local/staging Supabase instance
  only, never against the production M&L Title database.

**Interfaces:**
- Proves the mechanism before trusting it, since only one organization exists
  in production and the policy has never been exercised against a real
  second tenant.

- [ ] **Step 1:** In a local/staging environment, insert a second dummy
  `organizations` row and a dummy `auth.users`/`profiles` row pointing to it.
- [ ] **Step 2:** Authenticated as the dummy user, attempt to `select` from a
  handful of representative tenant-owned tables (`orders`, `contacts`,
  `invoices`) that contain only M&L Title's seeded org's rows. Confirm zero
  rows return.
- [ ] **Step 3:** Attempt an `insert`/`update` against an M&L Title row as the
  dummy user; confirm it's rejected by the `with check` clause.
- [ ] **Step 4:** Roll back / discard the dummy org and profile — this is a
  one-time proof, not a fixture that stays in any real environment.

---

### Task 7: e2e regression and full suite

**Files:**
- No new test files expected — existing Playwright coverage exercises the
  same tables now filtered by `organization_id`.

- [ ] **Step 1:** Run the full Playwright suite. Every existing test runs as
  M&L Title's one seeded org's staff, so results should be identical to
  pre-migration — any failure here means a table was misclassified (marked
  tenant-owned when some cross-cutting query assumed no scoping) or a policy
  rewrite has a bug, not that the tests need updating.
- [ ] **Step 2:** If anything fails, diagnose against the spec's table split
  before touching test expectations — the tests encode current correct
  behavior; the migration must match them, not the other way around.
