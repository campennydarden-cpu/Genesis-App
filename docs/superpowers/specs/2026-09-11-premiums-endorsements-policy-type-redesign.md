# Title Insurance Premiums — Policy-Type-Dependent Redesign — Design

**Status:** design complete, awaiting Cam's spec review
**Date:** 2026-09-11

## Problem

The Fix Plan's "Premiums & Endorsements" ask started as "what does Simultaneous mean on one line" but Cam's own explanation revealed the real mechanics: an Owner's Policy premium applies to cash purchases, a Loan Policy premium to Refinances/Seconds, and — for financed Purchases — a Simultaneous Issue (SI) transaction where the underwriter's SI Fee structure replaces standalone Owner's/Loan pricing rather than sitting alongside it. Loan Policy itself isn't one product either — depending on the underwriter it could be a Refinance Loan Policy, Limited Coverage Junior Loan Policy, Standard Loan Policy, Enhanced Loan Policy, or Centralized Loan Policy. None of this exists today: `TITLE_POLICY_LINE_TYPES` is only `["Owner's", 'Loan']`, the Premiums screen has no Simultaneous Issue handling, and no underwriter-specific Loan Policy sub-types.

Today's `title_insurance_premiums` table already supports multiple policy rows per order (the "+Add Policy" shell Cam separately asked for already exists) — this design is entirely about the missing policy-type behavior on top of that existing shell, not about building the shell itself.

## Scope split: structure now, rate-table calculation later

A real NC rate manual review (`Source Material/Rate Manuals/NC - All Underwriters Rate Manual Eff 2.1.26.pdf`) confirmed Simultaneous Issue pricing is genuinely a rate-table problem: NC's promulgated rules compute one Policy Premium off the *higher* of Owner's vs. total Loan coverage, plus a flat Simultaneous Issue Premium surcharge per Loan Policy ($28.50 in NC). Building real rate-table calculation (state-specific, underwriter-specific, coverage-amount-banded) is comparable in size to the already-built Recording Rate-Table project and is explicitly **out of scope** for this pass — its own future design cycle, the same way Recording's rate tables were their own project.

**This pass** covers only the structural gaps: the right fields, the right options, in the right places, still manually keyed — exactly the same manual-entry-shell philosophy `title_insurance_premiums` was originally built with (see migration `0025`'s own comment: "manual-entry shell (no rate-table calc)").

## Order-level Policy Type drives the screen

The existing Order Entry `POLICY_TYPES` field (`None` / `Owner's` / `Loan` / `Simultaneous`) is the single source of truth for whether a file is an SI transaction. No independent per-line "Simultaneous" option is added — `TITLE_POLICY_LINE_TYPES` stays exactly `["Owner's", 'Loan']`. A single premium line was never able to represent "Simultaneous" on its own; the order-level field already exists and already gets set at intake, so the Premiums screen reads it rather than asking again.

## Structural fields (still manual)

Per Cam's confirmation, a Simultaneous Issue file still produces two real policies — an Owner's Policy and one or more Loan Policies, each needing its own tracked coverage amount — priced via a rate table in the future, computed by hand for now. `base_premium`/`final_premium` stay exactly as they are today on every line, Owner's or Loan.

One addition, directly grounded in NC's real formula shape: a new `simultaneous_issue_premium` field on `title_insurance_premiums`, shown only on Loan-type lines when the order's Policy Type is Simultaneous — gives staff a place to key in the flat SI surcharge (NC's $28.50-style charge) separately from Base/Final Premium instead of folding it into one number.

**"+Add Policy" behavior when Simultaneous:** when the order's Policy Type is Simultaneous and no premium rows exist yet, the first "+Add Policy" click seeds one Owner's line and one Loan line together (since SI inherently needs both) rather than one at a time. Once that first pair exists, "+Add Policy" behaves exactly as it does today — a single additional row, e.g. for a second Loan Policy on a piggyback second mortgage (the same multi-loan scenario Loan Information & Funding's Phase B anticipates).

## Underwriter-specific Loan Policy variants

Underwriter is currently a per-order Contact only — re-entered fresh on every file, with no shared identity to persistently attach "which Loan Policy variants does this underwriter offer" to. Rather than fold this into the still-undecided Entity Directory Phase 2 (Underwriter isn't yet scoped there), this pass adds a small, standalone master-data table independent of Contacts entirely:

- **`underwriters`**: `id`, `name`.
- **`underwriter_loan_policy_variants`**: `underwriter_id`, `state`, `variant` (`'Refinance Loan Policy' | 'Limited Coverage Junior Loan Policy' | 'Standard Loan Policy' | 'Enhanced Loan Policy' | 'Centralized Loan Policy'`). No general/no-state fallback row — an underwriter's variant availability is inherently state-specific.

On a premium line, alongside the existing (unchanged) `underwriter_contact_id`, a new optional `underwriter_id` links to this master table via a second dropdown, independent of which Contact was picked. When it's set and the line is Loan-type, the new `loan_policy_variant` field's dropdown filters to that underwriter's configured variants for the order's property state. When unset — the underwriter isn't in the master table yet, or staff hasn't linked it — the dropdown falls back to the unrestricted flat list of all 5, so nothing blocks entry while the master data is still being built out.

## Default underwriter split — storage now, auto-apply later

Cam's separately-parked "default split by state" item shares the exact same admin infrastructure this pass is already building (underwriter + state scoping), so storing the configuration is folded in here — but *applying* it automatically to a real order's splits is not, since there's no computed Final Premium yet for a default split to apply against until the rate-table project exists.

- **`underwriter_default_splits`**: `id`, `underwriter_id`, `state`, `sort_order`, `split_to_label` (text — a default template has no order yet to pull a real Contact from, e.g. "M&L Title & Escrow" or "Underwriter"), `basis` (same basis vocabulary `SplitFields.tsx` already uses), `percent`, `bill_code`. Up to 5 rows per underwriter+state, matching the vault's `Default Split Editor.png` reference shape. Resolving `split_to_label` into a real order Contact when auto-applying is explicitly the rate-table follow-up project's responsibility.

## Admin panel & permissions

One new admin screen — Underwriters — covering all three pieces above: the underwriter list, each one's per-state Loan Policy variants, and each one's per-state default split rows. Gated by a new `manage_underwriters` permission.

**Real dependency to flag, same as the Sch B project:** this admin screen needs Staff Directory & Permissions live first (its `PERMISSIONS` array and `hasPermission()` helper). Sequencing gate for execution only, not for planning.

## Out of scope

- The premium rate-table calculation engine itself — its own future project, mirroring Recording's rate-table build (state-specific, underwriter-specific, coverage-amount-banded pricing).
- Auto-applying default splits to a real order's Premiums screen splits — stored now, applied later.
- Endorsements lookup table by state — Cam's own call: "needs its own pass."
- Any change to Endorsements' current manual entry (code/description/charge/bill code).
- Giving Underwriter Entity Directory (master-record) treatment.
- Commitment Schedule D (the title-premium underwriter/agent split disclosure form) — still just flagged from an earlier pass, never actually asked for.
