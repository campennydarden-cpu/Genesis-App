# Commitment Schedule B-I/B-II — Requirements/Exceptions Lookup-Table Engine — Design

**Status:** design complete, awaiting Cam's spec review
**Date:** 2026-09-11

## Problem

Cam's own note called this "the largest single ask" in the batch that produced
the current Fix Plan: Commitment Schedule B-I/B-II's Requirements and
Exceptions today can only be added two ways — a handful of fully-automatic
"chips" (Security Instruments, Related Docs, Liens, Exception Matters, each
tied to one specific record on the file and rendered via a hardcoded
TypeScript text-generator function), or fully manual free-text entry. There is
no library of reusable, firm-standard requirement/exception language, and no
way to fill boilerplate text with the file's own data automatically. The
separately-tracked ALTA Standard Requirements/Exceptions content Cam supplied
2026-09-09 has nowhere real to live because this mechanism doesn't exist yet.

## Scope: two lookup tables, one shared tag/template mechanism

Per Cam's direction, Requirements and Exceptions get their own separate
lookup tables (not a single merged table with a kind flag) — `requirement_templates`
and `exception_templates`. Both share the same underlying mechanism: entries
are canned legal text containing smart field tags that resolve from the
order's actual data when an entry is added to a file's Schedule B.

This does not replace `commitment_requirements`/`commitment_exceptions` —
those remain exactly what they are today, the per-order rows Schedule B
displays and Curative reads/writes. The templates are a new source those rows
can be generated from, alongside manual entry and the existing auto-chip
sources.

## Data model

**`requirement_templates`**
- `id`, `category` (fixed list: Mortgage, Judgment, Lien, HOA, Tax,
  Entity-Confirmation, Related-Document-Release, General — extensible later,
  code-defined for v1)
- `label` — short name shown in the library picker
- `body` — the requirement text, with embedded `{{tag}}` placeholders
- `trigger_source_type` — nullable; `'si'` | `'rel'` | `'lien'` | `null`.
  Non-null means this template auto-fires from that source's existing chip
  mechanism (see "Auto-triggered templates" below); `null` means it only
  appears in the manually-browsed library.
- `parent_template_id` — nullable, self-referencing. When a template with
  children is added, its children are offered as optional sub-item checkboxes
  (see "Optional sub-item templates" below).
- `active` — soft-disable without deleting.

**`exception_templates`** — identical shape; `trigger_source_type` is
`'em'` | `'easement'` | `null`.

**`requirement_template_variants`** / **`exception_template_variants`**
- `template_id`, `state` (nullable = general/fallback wording), `body`.
- A template with no state-specific row uses its own `body`. One with a
  Texas-specific row serves that instead when `property_details.state = 'TX'`.
  Resolution is automatic and invisible to staff — they never pick "the TX
  version," the system does.

## Smart tags

**Syntax:** `{{tag.name}}` — deliberately distinct from the existing
`[Mortgagor]`-style bracket placeholders already used for missing data
(`siRequirementText` etc.), so the two never collide.

**File-level tags** — singular per order, never ambiguous: e.g.
`{{property.county}}`, `{{property.state}}`, `{{property.legal_description}}`,
`{{order.file_number}}`, `{{order.effective_date}}`, `{{contact.buyer_names}}`.
Resolve automatically the instant a template is added.

**Scoped tags** — reference a record type that can have more than one
instance on a file: e.g. `{{security_instrument.mortgagor}}`,
`{{security_instrument.mortgagee}}`, `{{lien.creditor}}`, `{{lien.amount}}`
(the same field names `siRequirementText`/`lienRequirementText`/etc. already
use today).

**Resolution logic:**
- **Auto-triggered templates** never hit ambiguity — the specific chip
  clicked already identifies which record's data fills any scoped tags, same
  as today's chip behavior.
- **Manually-browsed templates**: if the picked template's body contains a
  scoped tag and the file has more than one candidate record of that type, a
  popup lists them (same label format as today's chips, e.g. "Deed of Trust:
  Smith → First National") for staff to pick which one fills the tag. Exactly
  one candidate fills silently, no popup. Zero candidates falls back to the
  bracket placeholder (e.g. `[Mortgagor]`), keeping the gap visible and
  editable — same convention already used for missing data today.

## Auto-triggered templates — converging the existing chip generators

The four existing hardcoded generator functions (`siRequirementText`,
`relRequirementText`, `lienRequirementText`, `emExceptionText` in
`src/lib/commitment-text.ts`) are retired and replaced by seeded template rows
with `trigger_source_type` set accordingly. Clicking an SI/Related-Doc/Lien/
Exception-Matter chip still auto-fires instantly exactly as it does today —
no browsing, no picker — it just resolves its text from an admin-editable
template row instead of buried TypeScript. Seeded starting `body` text is a
straight port of today's exact wording, so behavior doesn't change until
someone edits a template in the new admin screen.

`easement` becomes a new auto-trigger source type, generating an exception
chip from each `property_easements` row — the same mechanism, no new code
path, finally giving Property's Access/Easements/ROW entries a real path onto
Schedule B (absorbing that previously-flagged smaller ask).

## Schedule B UI — the library picker

`RequirementsSection.tsx`/`ExceptionsSection.tsx` gain a new "From Library"
picker alongside the existing auto-chip row and manual free-text form: a
category filter plus a search box listing matching template `label`s.
Selecting one runs tag resolution (silent fill → popup if ambiguous → bracket
placeholder if missing), then inserts the resulting text as an editable row
— staff can still hand-edit after insertion, same as any other row.

**Entity-type proactive suggestion:** when a Buyer/Borrower or Seller's
Entity Type isn't Individual, active Entity-Confirmation category templates
surface as their own suggested-chip group (visually distinct from the
SI/Lien/Related-Doc/Easement auto-chips, since these are suggestions to
evaluate rather than one-click-obvious additions). Clicking one adds it
through the same manual tag-resolution path as any library pick, since
Entity-Confirmation templates are `trigger_source_type = null`.

## Optional sub-item templates

`parent_template_id` generalizes the ALTA Requirement #4's optional 4a/4b
deed-type and security-instrument sub-items into a reusable concept: any
template can declare child templates. Adding a parent template that has
children shows a checkbox per optional child; checking one inserts it as a
`commitment_requirements` sub-item via the existing `parent_requirement_id`
mechanism (the same one that already renders Related-Document sub-items as
"5a", "5b" today). `exception_templates` gets the same column for structural
consistency, even with no current exception use case for it.

## Admin panel & permissions

Template management (create/edit/deactivate templates, their state variants,
and parent/child relationships, for both Requirements and Exceptions) is a
new screen in the Staff Directory & Permissions admin console (design
approved, not yet built — see dependency note below), gated by a new
`manage_requirement_templates` permission, following the exact instant-CRUD
pattern already used for Bill Codes/Checklist Templates/Folder Templates.

**Dependency — confirm before executing this plan:** Staff Directory &
Permissions must be live (built and deployed) before this project is
implemented. This project's admin screen is designed against the
role/permission system from that spec, not the current flat `can_manage_*`
boolean columns — building against the old system now would mean a throwaway
migration once Staff Directory lands. This is a sequencing gate for
execution, not for planning; the two projects can be planned independently
and are being written up in whatever order Cam chooses.

## Out of scope

- Bulk CSV/paste import — v1 is manual entry only through the admin panel;
  revisit if the starting library turns out to be large enough to make
  retyping painful.
- Any interaction with the Document Assembly Engine's Word-merge pipeline —
  fully separate systems; this feature only ever touches Schedule B's
  database rows and plain text, never a `.docx`.
- An admin-editable category list — the category list is fixed in code for
  v1; adding a new category is a code change.
- Any change to Curative — it already reads/writes the same
  `commitment_requirements`/`commitment_exceptions` rows this feature adds
  to, so nothing there needs to change.
- Property's "Plat/Survey Additional/Other Matters" list — flagged during
  design as logged in the Fix Plan (2026-09-09) as a built "quick fix" but
  confirmed absent from the schema today. Real gap, but its own small task,
  not part of this spec.
