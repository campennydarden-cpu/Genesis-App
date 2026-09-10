# Staff Directory & Permissions — Design

**Status:** design complete, awaiting Cam's spec review
**Date:** 2026-09-10

## Problem

Genesis has no real concept of "staff." Anyone who finds `/signup` can create a
login with just an email and password — there's no invite, no approval, and no
link between a login and a person Cam actually employs. Separately, four
feature-gating permissions (`can_manage_bill_codes`,
`can_manage_checklist_templates`, `can_manage_folder_templates`,
`can_manage_lookup_data`) exist only as raw booleans on `profiles`, flipped by
Cam running SQL directly — there's no UI for any of it. And several
already-identified Fix Plan items (Order Info's functional-role fields,
Requested/Checklist Tasks assignment) are blocked because there's no real
roster of people to assign work to — those fields are free text today.

This design covers: turning account creation into an invite-only flow tied to
real people, and building one admin console that manages both "who has a
login" and "what can they do."

## Decisions (confirmed with Cam)

1. **Invite-only.** The public `/signup` page is removed entirely. Every
   account starts as an admin-issued invite.
2. **One console for all permissions**, not just this new capability — the
   four existing `can_manage_*` flags fold into the same admin screen instead
   of staying SQL-only.
3. **Permissions stay a flat, code-defined list of capabilities.** Roles are
   the new, admin-creatable concept: a role is just a named bundle of
   permissions. Start with two seeded roles (Admin — every permission; Staff —
   none), but an admin can create additional roles and choose which
   permissions belong to each from the console.
4. **Assignment is a name-snapshot, not a live reference.** When someone is
   picked for a functional role (Order Info's Title Officer/Escrow
   Officer/etc.) or as a task assignee, their name is written into the
   existing free-text column at that moment — same as today's behavior. No
   schema change to those columns, and no broken references if someone is
   later deactivated or renamed.
5. **Deactivation, not deletion.** There is no hard-delete of a staff member.
   Turning a person inactive removes them from every future-assignment picker
   immediately, without touching anything already written under their name on
   past orders.
6. **Invite mechanism: Supabase's built-in invite** (`auth.admin.inviteUserByEmail`),
   not a hand-rolled token/expiry system and not manual temporary passwords.
7. **Considered and rejected: Logto** (or any other external identity
   provider). This app's entire authorization model is Supabase-native — every
   RLS policy across 53 migrations keys off `auth.uid()`, and `profiles.id` is
   a foreign key straight to `auth.users`. Replacing that foundation to get an
   admin console and RBAC that Supabase's own Admin API plus two small tables
   already provide isn't worth the operational cost of running (or paying
   for) a second identity service. Not revisited unless a need arises that
   Supabase Auth genuinely can't cover.

## Data model

New migration (next number: `0054`).

**`roles`**
| column | type | notes |
|---|---|---|
| `id` | uuid, pk | |
| `name` | text, unique | admin-editable |
| `created_at` | timestamptz | |

Seeded rows: `Admin`, `Staff`.

**`role_permissions`**
| column | type | notes |
|---|---|---|
| `role_id` | uuid, fk → `roles.id` | |
| `permission_key` | text | validated against the code-defined permission list below, not a DB fk (permissions aren't a table) |

Composite primary key `(role_id, permission_key)`. Checking a box in the admin
console inserts/deletes a row here — this table *is* the "admin groups
permissions into a role" mechanism.

**Permission list** (code-defined, `src/lib/constants.ts`, same pattern as
`FUNCTIONAL_ROLES`/`CONTACT_ROLES` — new permissions are added here as new
gated features ship, no migration needed for that going forward):

- `manage_users` — access the admin console itself (invite/deactivate staff,
  create/edit roles). Guarded by a lockout rule: this permission cannot be
  removed from a role, or a role reassigned away from the last person holding
  it, if doing so would leave zero active users able to manage users.
- `manage_bill_codes`
- `manage_checklist_templates`
- `manage_folder_templates`
- `manage_lookup_data` (Entity Directory)

**`profiles`** — modified:
- add `full_name` (text)
- add `active` (boolean, not null, default `true`)
- add `role_id` (uuid, fk → `roles.id`, not null)
- drop `can_manage_folder_templates`, `can_manage_checklist_templates`,
  `can_manage_bill_codes`, `can_manage_lookup_data`

**Backfill (same migration):** any existing profile with any of the four
dropped columns `= true` is assigned the `Admin` role; every other existing
profile is assigned `Staff`. This runs before the columns are dropped, so
nobody's access silently changes the moment this ships — including Cam
himself, whose existing flags are all true today.

## Invite flow

1. Admin (someone holding `manage_users`) fills out "+ Invite User" in the
   console: email, full name, role.
2. A server action, using the Supabase service-role key (server-only, isolated
   to this one action file — never exposed to the client), calls
   `auth.admin.inviteUserByEmail(email, { redirectTo: '.../invite/complete' })`.
   Supabase creates the `auth.users` row and sends the invite email.
3. The same server action immediately creates the `profiles` row (`full_name`,
   `role_id`, `active: true`) keyed to the returned user id — the person has a
   real role and is already assignable before they ever log in.
4. The invitee clicks the emailed link, lands on a new `/invite/complete` page
   (net-new — this app has no auth callback route of any kind today), sets a
   password, and is redirected to `/login`.

**Operational prerequisite, not app code:** Supabase's default SMTP only
delivers to email addresses that are members of the Supabase organization's
own team — every other address is rejected outright. Real staff invites
require custom SMTP configured in the Supabase dashboard first. **Cam has
picked Resend** for this. Setup (Resend account, sending domain/DNS
verification, entering the SMTP credentials into Supabase's Auth settings) is
a one-time dashboard/vendor step, done before this ships, not part of the
build.

## Admin console

One `/admin/users` area, gated on `manage_users`, two tabs:

- **Users** — table of staff (name, email, role badge, active/inactive
  toggle), "+ Invite User" button. Toggling `active` is the only
  removal path; there is no delete.
- **Roles** — list of roles (starts with Admin/Staff), "+ New Role" (name
  only), and per-role a checklist of the 5 permission keys. A role can't be
  deleted while any active user still holds it.

## Permission enforcement

- One helper, `hasPermission(profile, key)`, replaces `src/lib/permissions.ts`
  in full. That file today holds three near-duplicate functions
  (`requireFolderTemplatePermission`, `requireChecklistTemplatePermission`,
  `requireBillCodePermission`), each independently re-fetching the user and
  re-selecting one boolean column — the same "about to become copies" signal
  this codebase already acted on once for autosave (`useAutosave`). One helper
  replaces all three call sites.
- **Entity Directory's `can_manage_lookup_data` gate is different in kind, not
  just another call site to swap.** It isn't checked via `permissions.ts` at
  all — migration `0053`'s RLS policies check `can_manage_lookup_data = true`
  directly in SQL. Moving this to the role model means rewriting those
  policies to check role-derived permission instead, e.g.
  `exists (select 1 from role_permissions rp join profiles p on p.role_id = rp.role_id where p.id = auth.uid() and rp.permission_key = 'manage_lookup_data')`
  — a policy rewrite, not a TypeScript-side change, and called out explicitly
  here so it isn't missed as "just another `hasPermission()` call site" during
  implementation.
- `active` is enforced at login and via a layout-level guard on authenticated
  routes — a deactivated person's session is signed out with a clear message
  rather than continuing to work silently until their next login.

## Wiring into existing free-text fields

No schema changes to `orders`' eight `FUNCTIONAL_ROLES` columns or to the
Requested/Checklist Tasks assignee fields. Each becomes a `<select>`/combobox
sourced from `profiles where active = true`, writing the chosen full name into
the existing text column exactly as manual entry does today (per decision 4
above).

**Revalidation, applied from the start rather than found as a bug later:**
this app already hit the exact failure mode of a stale dropdown once — the
Contacts payee pickers went stale system-wide because `revalidatePath` was
scoped to `'page'` instead of `'layout'`, so sibling screens kept serving a
cached contact list after an add. Every action that invites, deactivates, or
reactivates a user revalidates at the `'layout'` level, so every screen with
one of these assignment pickers reflects the change immediately.

## Rollout order

1. Migration `0054`: `roles`, `role_permissions`, `profiles` additions +
   backfill, in that order, in one migration.
2. Swap all four existing `can_manage_*` call sites to `hasPermission()`
   *before* the columns are dropped — done together, not left half-converted.
3. Build the admin console and invite flow.
4. Delete `/signup` and its action.
5. Wire the functional-role and task-assignee fields to the new picker.

## Out of scope for this pass

- Multiple roles per person (one role per profile for now).
- Per-permission audit log (who changed what, when).
- Self-service password reset (this app has none today; genuinely separate
  from invite-only account creation and not blocking it).
