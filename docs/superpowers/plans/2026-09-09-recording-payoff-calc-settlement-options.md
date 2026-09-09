# Recording, Payoff Calculations, Settlement Type & Options

User request: "Lets do Recording, Payoff Calculations, then Settlement Type and Options
(I'd combine these)." Three remaining Escrow/Closing nav placeholders, closed out in one
batch. Reference: SoftPro screenshots (`CDF Pg2 SectionE Recording.png`, `CDF Pg3 Payoff
Calculation.png`, `CDF Pg3 Payoffs.png`, `Escrow.Closing Options to Config 1/2.png`) plus
the four ALTA Settlement Statement variants in Source Material.

## 1. Recording

Standalone document-recording tracker (distinct from CDF Page 2's Section E, which already
captures the recording *fee* as a generic charge line). This page tracks the status of each
document actually sent to the recorder's office.

New list table `recording_documents` (order_id, sort_order, document_description, county,
status, date_submitted, date_recorded, instrument_number, book, page, number_of_pages,
e_recording_reference). `status` is a constrained select: Not Submitted / Submitted /
Recorded / Rejected. County is free text per row (not defaulted from `orders.property_county`
— manual entry, no cross-table derivation, matching the rest of this app).

Out of scope: linking rows back to specific Doc Prep documents (Deed, Security Instrument,
etc. are separate tables with no shared "documents" concept to join against) — description
is free text instead.

## 2. Payoff Calculations

SoftPro's "Payoff Calculation" tab is per-line detail on an existing K. Payoffs and Payments
row — migration `0030_cdf_page3.sql` already earmarked this as a follow-up ("out of scope
here (separate, not-yet-built 'Payoff Calculations' feature)"). So this is an ALTER on
`cdf_payoffs_payments`, not a new list: add principal_balance, interest_rate, per_diem,
interest_from, interest_to, additional_interest, late_fee, payoff_expires_on. Plus a child
list `cdf_payoff_additional_charges` (payoff_id, sort_order, description, fee) for the
"Additional payoff charges" grid.

Deliberately dropped vs. the SoftPro screen: the interlocking "Interest to / Per diem based
on / Payoff date basis / After" dropdowns and the principal-balance-vs-payoff-amount radio —
those exist to drive SoftPro's own per-diem × days auto-calculation, which this app doesn't
have (manual-entry-shell scope, same carve-out as every other CDF page this session). The
fields kept are the ones a closer would want on record regardless of who computes the total.

The existing `amount` column on `cdf_payoffs_payments` stays the single source of truth for
the total shown on CDF Page 3 — this page adds supporting detail, it does not compute or
overwrite `amount` (no cross-page aggregation, same rule as every other CDF page).

The Payoff Calculations nav page lists the same payoff rows CDF Page 3 owns (read via
`listPayoffsPayments`) and edits only the new detail columns + additional-charges sublist.
Adding/removing payoff line items themselves stays owned by CDF Page 3 to avoid two pages
mutating the same list's membership; if an order has no payoffs yet, this page shows an
empty state pointing at CDF Page 3.

## 3. Settlement Type & Options (combined per Cam's request)

New singleton `settlement_options` (order_id unique): settlement_type (select: Combined /
Borrower-Buyer / Seller / Cash — mirrors the four ALTA Settlement Statement variants in
Source Material), place_of_settlement_address, admin_data_cdf1..5 (free text, one per CDF
page, matches SoftPro's "Administrative data" block), seller_credit_method (select, the
three radio options from the "Options" screenshot's "Credit for seller paid premium(s)"
section).

Everything else on the two Options screenshots is dropped: print/sort/logo toggles and the
sales-tax-calculation sub-config all exist to drive SoftPro's own computation+print engine,
which this app doesn't have — same carve-out applied throughout. `seller_credit_method` is
kept as a plain informational election (which policy the closer is following), not a switch
that changes any calculation here.

One merged nav entry, "Settlement Type & Options" (`settlement-options`), replaces the two
separate placeholder entries — two links to an identical page would be confusing.

## Build order

Recording → Payoff Calculations → Settlement Type & Options (per Cam's message), migrations
0033-0035, then types/constants, actions, panels, routes, nav, e2e tests, full suite, review.
