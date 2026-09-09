# Title Insurance Premiums & Endorsements — Implementation Plan

Shell scope approved by Cam 2026-09-08: manual entry only, no rate-table calculation
(same reasoning as deferred Recording/stamp-tax auto-calc — real underwriter rate
manuals are E&O-risk-governed and not something to build without curated data).

## Schema

`title_insurance_premiums` (one-to-many per order — supports piggyback second policy):
- id, order_id (fk orders), sort_order
- policy_type ('Owner's' | 'Loan')
- underwriter_contact_id (fk contacts, nullable — role='Underwriter')
- coverage_amount numeric, base_premium numeric, final_premium numeric
- bill_code text
- created_at

`title_insurance_premium_splits` (child, multi-way):
- id, premium_id (fk, cascade delete), sort_order
- payee_contact_id (fk contacts, nullable)
- basis ('Percent of Final Premium' | 'Percent of Balance' | 'Fixed Amount')
- percent numeric, amount numeric
- bill_code text

`endorsements` (attached to a policy):
- id, premium_id (fk title_insurance_premiums, cascade delete), sort_order
- code text, description text
- charge numeric
- bill_code text

`endorsement_splits` (child, same shape as premium splits):
- id, endorsement_id (fk, cascade delete), sort_order
- payee_contact_id, basis, percent, amount, bill_code

All RLS-enabled, standard blanket `authenticated` policy matching every other table.

No `ensureXId` pattern needed here — these are one-to-many lists, not one-row-per-order,
so plain insert/update/delete (like `doc_prep_affidavits`) is the right shape, not the
atomic upsert pattern (that's only for singleton per-order rows).

## Constants

`src/lib/constants.ts`:
- `TITLE_POLICY_LINE_TYPES = ["Owner's", "Loan"]` (per-line type; distinct from the
  existing order-level `POLICY_TYPES` which includes 'None'/'Simultaneous' as a
  whole-order selection, not a per-line value)
- `SPLIT_BASIS_TYPES = ['Percent of Final Premium', 'Percent of Balance', 'Fixed Amount']`

## Types (`src/lib/types.ts`)

`TitleInsurancePremium`, `PremiumSplit`, `Endorsement`, `EndorsementSplit`.

## Server actions

`src/app/actions/title-premiums.ts`:
- `listPremiums(orderId)`, `addPremium(orderId)`, `updatePremium(id, formData)`, `deletePremium(id)`
- `listPremiumSplits(premiumId)`, `addSplit(premiumId)`, `updateSplit(id, formData)`, `deleteSplit(id)`
- `listUnderwriterContacts(orderId)` — contacts filtered `role='Underwriter'`

`src/app/actions/endorsements.ts`:
- `listEndorsements(premiumId)`, `addEndorsement(premiumId)`, `updateEndorsement(id, formData)`, `deleteEndorsement(id)`
- `listEndorsementSplits(endorsementId)`, `addSplit`, `updateSplit`, `deleteSplit`

## Components / routes

Following the SoftPro screenshots' grid-plus-detail-form shape, but simplified to
match this codebase's existing list+detail card convention (`AffidavitsPanel`-style),
not a literal spreadsheet grid:

- `src/components/title/PremiumsPanel.tsx` — list of policy cards, each expandable to
  a detail form (Underwriter, Policy Type, Coverage, Base/Final Premium, Bill Code)
  plus a nested Splits list (add/edit/delete rows) and a nested Endorsements list
  (add/edit/delete, each with its own Splits).
- `src/app/orders/[id]/premiums/page.tsx`

Endorsements are nested under their policy on the same Premiums screen — not a
separate route — since every endorsement belongs to exactly one policy and the
screenshots show them as a sub-section, not an independent list.

## Nav

`FileSectionsNav.tsx`: remove `{ label: 'Premiums' }` / `{ label: 'Endorsements' }`
from "Escrow / Closing", add one item `{ label: 'Premiums & Endorsements', segment: 'premiums' }`
to the "Title" group, per Cam's explicit request to move these into Title.

## Verification

- Playwright: add policy, edit fields + autosave, add split, add endorsement under a
  policy, add split under endorsement, delete flows, nav shows under Title group.
- `npm run lint`, `npm run build`, full test suite.
- Live browser check.
- Independent code-reviewer subagent pass, fix findings, re-verify.
- Update Genesis Build Log.
