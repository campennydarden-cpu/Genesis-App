# Multi-Tenant Foundation — Design

**Status:** design complete, awaiting Cam's spec review
**Date:** 2026-09-11

## Problem

Cam decided (2026-09-11, business-strategy conversation) that Genesis' path to
selling to other title companies is single-tenant cloud first — each customer
gets its own isolated Supabase project/Vercel deployment — collapsing into a
shared multi-tenant database once enough customers exist that N separate
environments become an ops burden rather than a selling point. That collapse
is a schema migration against live customer data unless the schema already
supports it.

Today Genesis has no concept of an owning account at all. Across 56 tables and
53 migrations there is zero `organization_id`/`tenant_id`/`company_id` column
anywhere. RLS is enabled on 54 of the 56 tables, but it enforces nothing
beyond "is this an authenticated M&L staff member" — every policy except
`profiles`' own self-select (`id = auth.uid()`) and the attachments storage
bucket (`bucket_id = 'attachments'`) reads `using (true)`. Two tables
(`cdf_page`, `entity_directory_code_sequences`) don't have RLS enabled at all.
This is correct and harmless for one customer. It becomes an actual data-leak
risk the day a second customer's data lands in the same database — and
retrofitting isolation onto 56 live tables under a real second customer is a
materially worse project than building it in now, while it's still empty.

## Decision

Add the organization boundary to the schema now, populate it with exactly one
row, and rewrite RLS to actually check it — without changing the deployment
model. Single-tenant cloud (one Supabase project per customer) stays exactly
as decided; this doesn't accelerate onboarding a second customer or build any
multi-tenant UI. The payoff is that isolation runs under real production load
for however long single-tenant cloud lasts, so when the collapse to shared
multi-tenant eventually happens, it's a known, already-proven schema change —
not a from-scratch migration invented under time pressure with a live second
customer waiting on it.

## Naming: `organizations`, not `accounts`

Title/escrow work already overloads "account" for real domain concepts
(escrow accounts, trust accounts) this app will eventually model. Calling the
tenant boundary `organizations` avoids that collision entirely and matches
common SaaS convention (Slack/Notion "organization"/"workspace").

## Data model

New migration (next number after whatever Staff Directory & Permissions
claims — see Sequencing below).

**`organizations`**
| column | type | notes |
|---|---|---|
| `id` | uuid, pk | |
| `name` | text, not null | |
| `active` | boolean, not null, default `true` | mirrors the active-not-delete convention Staff Directory established for `profiles` |
| `created_at` | timestamptz, not null, default `now()` | |

Seeded row: `M&L Title`, `active = true`. Nothing in this pass ever creates a
second row — see Out of scope.

**`profiles`** — add `organization_id uuid not null references organizations(id)`,
backfilled to the single seeded org for every existing row. This lands on the
same table Staff Directory & Permissions is also modifying (`role_id`,
`full_name`, `active`) — both are the same underlying shift, from "assume one
implicit user/company" to "a real modeled account."

**`current_org_id()`** — one `security definer` SQL function:

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

Every tenant-owned table's RLS policy calls this instead of repeating the
subquery — one function to audit later, not fifty copy-pasted joins.
`security definer` is required because a policy on table X can't otherwise
read `profiles` if `profiles`' own RLS would block that nested read; `stable`
lets Postgres cache the result once per statement instead of re-evaluating it
per row.

## The 56-table split

Two buckets. Getting this classification wrong in either direction is the
expensive mistake — scoping shared regulatory data per-tenant needlessly
duplicates it per customer and lets copies drift out of sync, while leaving a
tenant-owned table on the shared list is an actual cross-customer data leak.

**Shared reference (4 tables) — untouched, no `organization_id`, RLS unchanged:**
`zip_lookup`, `recording_fee_schedules`, `transfer_tax_schedules`,
`recordation_tax_schedules` — county/state regulatory and geographic facts,
identical for every title company regardless of who's running the software.
A second customer in a different state adds rows to these tables (or none, if
their state's already covered); it never needs its own copy of Maryland's
recordation tax schedule.

**Tenant-owned (52 tables) — gets `organization_id`, RLS rewritten from
`using (true)` to `using (organization_id = current_org_id())`:**
`orders`, `contacts`, `contact_principals`, `contact_signature_lines`,
`property_details`, `property_easements`, `chain_of_title`, `prelim_search`,
`commitment_sch_a`, `commitment_sch_b_settings`, `commitment_requirements`,
`commitment_exceptions`, `exception_matters`, `curative_settings`,
`derivation_principals`, `security_instruments`,
`security_instrument_related_docs`, `liens`,
`doc_prep_deed`, `doc_prep_deed_principals`, `doc_prep_deed_signature_lines`,
`doc_prep_deed_subject_to`, `doc_prep_security_instrument`,
`doc_prep_si_principals`, `doc_prep_affidavits`, `doc_prep_notary_acks`,
`title_insurance_premiums`, `title_insurance_premium_splits`, `endorsements`,
`endorsement_splits`, `additional_title_charges`,
`additional_title_charge_splits`, `settlement_options`, `tax_prorations`,
`recording_documents`, `invoices`, `invoice_line_items`,
`cdf_page`, `cdf_cash_to_close`, `cdf_transaction_summary_lines`,
`cdf_payoffs_payments`, `cdf_payoff_additional_charges`,
`entity_directory`, `entity_directory_people`,
`entity_directory_code_sequences`, `attachments`, `attachment_folders`,
`bill_codes`, `checklist_task_templates`, `checklist_tasks`,
`folder_templates`, `file_number_counters`, `requested_tasks`, and — once
Staff Directory & Permissions ships — `roles`/`role_permissions` (role
definitions are firm-specific, not universal, so they're tenant-owned too).

`cdf_page` and `entity_directory_code_sequences` currently have no RLS at
all — they get it added as part of this pass, straight to the org-scoped
policy, not first patched with `using (true)` and rewritten twice.

## `profiles` itself is a special case

`profiles.organization_id` is the column `current_org_id()` reads — it can't
be scoped by its own output. Its RLS policy stays keyed to `id = auth.uid()`
(a person reads their own row), untouched. What matters is that
`organization_id` is set correctly by whatever creates the row — the Staff
Directory invite flow's server action (`auth.admin.inviteUserByEmail` +
immediate `profiles` insert) is where this is hardcoded to the single seeded
org for now, and becomes "which org is this admin inviting into" the day a
second org ever exists.

## The going-forward rule

This is what actually prevents the retrofit-under-pressure scenario in the
Problem section. From this migration forward, **every new migration that
creates a table declares which bucket it's in** — tenant-owned gets
`organization_id` and an org-scoped policy from its first migration;
shared-reference is a deliberate, named exception. This is the same kind of
convention-not-code decay this codebase already caught once (the four flat
`can_manage_*` booleans Staff Directory & Permissions is now unwinding) —
cheap to state now, expensive to rediscover missing three years and thirty
tables later. Recorded as a line in `AGENTS.md`/`CLAUDE.md`, not only in this
doc, so it survives past this conversation.

## Sequencing — real dependency, confirm before executing

`organization_id` belongs on `profiles`, the exact table Staff Directory &
Permissions (migration `0054`, spec written, not yet built) is also modifying
with `role_id`/`full_name`/`active`. Two options, Cam's call at execution
time:
1. Fold `organization_id` into migration `0054` itself — one `profiles`
   migration and one backfill pass, instead of two back-to-back.
2. Land this as its own migration immediately after `0054` merges.

Either way, this project's RLS rewrite touches tables gated by the *new*
permission model (`hasPermission()`/`role_permissions`) once the admin console
exists, not the old flat booleans — so, same as the Sch B Lookup Table
Engine's own dependency note, this can be **planned** independently of Staff
Directory's build status, but not **executed** before it lands.

## Out of scope

- Any UI exposing "organization" as a concept — staff never see a picker,
  switcher, or setting for it in this pass. Pure backend scaffolding behind a
  single, invisible seeded row.
- Actually onboarding a second title company, or any signup/org-creation/
  provisioning flow. That's the eventual multi-tenant collapse project, which
  this spec only de-risks — it isn't being built now.
- Per-org customization of anything (branding, fee schedules, document
  templates differing structurally rather than by data) — out of scope until
  there's a second customer to actually need it.
- Attachments' storage bucket scoping (`storage.objects`,
  `bucket_id = 'attachments'`) beyond what already exists. True isolation at
  the bucket level would need an org-id path prefix; flagged as a known gap
  for whenever multi-tenant storage is actually needed, not fixed here since
  single-tenant makes it moot today.
- Billing, subscription, or infrastructure-provisioning tooling for spinning
  up a new customer's Supabase project/Vercel deployment — an ops workflow
  question, not a schema question.
- SOC 2 / compliance audit work — a gate for the *shared multi-tenant*
  collapse later, not for this schema-readiness pass.
