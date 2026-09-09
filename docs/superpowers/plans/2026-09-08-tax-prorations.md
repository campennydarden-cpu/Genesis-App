# Tax / Other Prorations — Implementation Plan

SoftPro screenshots reviewed: `County Tax Proration(s).png`, `City.Town Tax Proration.png`,
`Misc Assessment Proration.png` (all four share one template: Tax Status & Dates / Tax
Amounts / Taxing Authority / Tax Prorations), and `HOA.COA Prorations.png` (a flat
grid + detail form with an explicit "Proration calculation" sub-section: Compute
Buyer/Seller, Share of, Proration date, Period From/To = Days, 30-day-months toggle,
Per diem).

## Scope decision (asked Cam, answered "Auto-calculate proration")

Unlike rate-table fields (excluded everywhere this session — county mill rates, premium
rate manuals — all E&O-risk-governed external data this app doesn't have), day-count
proration is plain date arithmetic with no external data dependency, so it's safe to
compute for real rather than leave fully manual.

Excluded from all four templated screens as genuinely rate-table-adjacent: "Tax
computation method" + "Rates & Values..." lookup button, "Current tax period lookup
code", "Show tax figures on CDF/as POC" (CDF integration doesn't exist yet), and the
escrow-reserve sub-fields (Escrow to be based on / months / total — that's an Impounds
concern, a different future screen, not proration).

## Unified model

All four screen types (County Tax, City/Town Tax, Assessments, HOA/COA) reduce to the
same shape once the excluded fields are dropped, so one flat list per order —
`tax_prorations` — covers all of them, distinguished by a `category` field. No Split
child table: none of these screenshots show a Split section (unlike Premiums/Charges).

## Schema

`tax_prorations`:
- id, order_id (fk orders, cascade), sort_order
- description text (free entry, e.g. "County Taxes", "HOA Proration")
- category text ('County Tax' | 'City/Town Tax' | 'Assessment' | 'HOA/COA' | 'Other')
- payee_contact_id (fk contacts, nullable, set null — taxing authority or HOA company)
- account_number text
- compute_for text ('Buyer' | 'Seller') — matches the screenshot's "Compute:" field
- credit_debit text ('Credit' | 'Debit')
- share_of_amount numeric (manual — the full amount being prorated, e.g. the annual bill)
- proration_date date
- period_from date, period_to date
- use_30_day_months boolean default false
- days_in_period numeric, days_prorated numeric, per_diem numeric, prorated_amount numeric
  (all plain editable columns — filled by a "Calculate" button, never silently
  recomputed on blur, same one-time-fill-then-editable UX as Deed's Notary Block
  Generate button; Cam's standing "everything stays editable" direction applies here too)
- cdf_line text, bill_code text

RLS: standard blanket `authenticated` policy.

## Calculation convention (documented, not hidden)

Day of closing (`proration_date`) belongs to the **Buyer** — the common title/escrow
default. Seller's portion is `period_from` through the day before `proration_date`;
Buyer's portion is `proration_date` through `period_to`. `days_in_period` and
`days_prorated` both respect the 30-day-months toggle (30/360 day-count) or actual
calendar days. This convention is a documented default, not a hardcoded rule — every
computed field stays a normal editable input afterward, and firms using a different
convention (e.g. seller owns day of closing) just edit the numbers directly.

`src/lib/tax-proration.ts` — pure calculation function, unit-testable in isolation,
with a small self-check (`demo()`/assert) per non-trivial branching money-path logic.

## Types / constants

`TaxProration` type. `TAX_PRORATION_CATEGORIES`, `PRORATION_COMPUTE_FOR`,
`PRORATION_CREDIT_DEBIT` constants.

## Server actions

`src/app/actions/tax-prorations.ts`: `listProrations`, `addProration`,
`updateProration`, `deleteProration`, `listAllContacts` (payee picker, same pattern as
Additional Charges).

## Components / route

`src/components/title/TaxProrationsPanel.tsx` — flat list, one row per item, each with
its own `useAutosave` + `SaveIndicator` (the fixed pattern from the start), plus a
"Calculate" button that runs `calculateProration()` and fills the 4 computed fields
into the form (still submitted through the same autosave path, not a separate write).
`src/app/orders/[id]/tax-prorations/page.tsx`.

## Nav

Wires the existing disabled "Tax/Other Prorations" placeholder in "Escrow / Closing"
to the real route. No group move requested for this screen.

## Verification

Unit-level: the `demo()` self-check in `tax-proration.ts` covers a few concrete
buyer/seller, 30-day and actual-day cases.
Playwright: add item, Calculate button fills fields correctly, edit + autosave
persists, delete. `npm run lint`/`build`, full suite, live browser check, independent
review, Build Log.
