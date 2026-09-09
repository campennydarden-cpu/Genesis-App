# Additional Title/Escrow Charges — Implementation Plan

Shell scope, same precedent as Premiums & Endorsements: manual entry only. The SoftPro
screenshots (`Additional Title Charges.png`/`1`/`2`) show a "Calculate Charge" helper
section (Minimum/Maximum charge, Charge based on, Multiplication %, Amount per $1000) —
that's rate-table territory, deliberately excluded, same reasoning as Recording
auto-calc and Premiums.

## Schema

`additional_title_charges` (flat line-item list per order):
- id, order_id (fk orders, cascade), sort_order
- description text
- policy_id (fk title_insurance_premiums, nullable, set null — optional link to a policy,
  matching the screenshot's "Policy" dropdown; most charges aren't policy-scoped)
- charge numeric
- taxable boolean default false
- fee_type text
- cdf_line text (the screenshot's "Line" column, e.g. "B.05" — a CDF line reference,
  free text since no CDF integration exists yet)
- invoice text
- bill_code text
- seller_pay_percent numeric (the screenshot's "Seller %" column / "Seller pay: %" field)
- issued_date date, effective_date date

`additional_title_charge_splits` (same shape as the existing premium/endorsement splits):
- id, charge_id (fk additional_title_charges, cascade), sort_order
- payee_contact_id (fk contacts, set null)
- basis text, percent numeric, amount numeric, bill_code text

RLS: standard blanket `authenticated` policy, matching every other table.

## Shared component extraction

The Split UI (row + list, autosave per row) is now needed a second time, identically
shaped, so extract `SplitRow`/`SplitList` out of `PremiumsPanel.tsx` into
`src/components/title/SplitFields.tsx` and have both Premiums and this new screen import
from there — avoids duplicating a non-trivial six-field autosave component.

`SPLIT_BASIS_TYPES` in `constants.ts` currently reads "Percent of Final Premium" —
generalizing to "Percent of Final Charge" now, before any real split data exists
(confirmed 0 rows in both split tables), so the wording fits both Premiums and this
screen without a stored-value migration.

## Constants / types

No new constants beyond the split-basis rename above. New types:
`AdditionalTitleCharge`, `AdditionalTitleChargeSplit` in `types.ts`.

## Server actions

`src/app/actions/additional-title-charges.ts`:
- `listCharges(orderId)`, `addCharge(orderId)`, `updateCharge(orderId, id, formData)`, `deleteCharge(orderId, id)`
- `listChargeSplits(chargeId)`, `addChargeSplit`, `updateChargeSplit`, `deleteChargeSplit`
- `listPoliciesForOrder(orderId)` — for the optional Policy link dropdown (from `title_insurance_premiums`)

## Components / route

`src/components/title/AdditionalChargesPanel.tsx` — flat list of charge rows (not
nested under a policy, unlike Endorsements), each with its own autosave form + nested
Split via the shared `SplitList`. `src/app/orders/[id]/additional-charges/page.tsx`.

## Nav

Stays in "Escrow / Closing" — Cam's move request was specific to Premiums/Endorsements
only ("I need these move to the Title Group"), no mention of Additional Charges.
Replace the disabled placeholder with a real link.

## Verification

Playwright: add charge, edit fields + autosave (via SaveIndicator, not reload-per-field
— apply the just-fixed pattern from the start this time), add split, delete flows.
`npm run lint`/`build`, full suite, live browser check, independent review pass, Build Log.
