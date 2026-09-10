# Loan Information & Funding (Phase A) — Design

**Status:** design complete, awaiting Cam's spec review
**Date:** 2026-09-10

## Problem

Loan data (amount, rate) is currently entered independently in at least four
places with no single source of truth: `orders.loan_amount` (Order Entry),
CDF Page 1's own `loan_amount`/`interest_rate`, CDF Page 3's
`loan_amount_estimate`/`loan_amount_final`, and the Document Preparation
screen's own `loan_amount`/`interest_rate`. None of these are kept in sync.
Separately, Commitment Schedule A's Loan Number is explicitly blocked on a
"Loan Information & Funding" screen that doesn't exist yet, and CDF Section
F's already-built Prepaid Interest per-diem line (migration `0047`) has a
real per-diem calculation UI but no way to compute its rate — the rate field
is manual entry because there's nowhere to source `loan_amount × annual_rate`
from.

Cam supplied real SoftPro reference screenshots for this screen (`Loan Info &
Funding.png` ×3, `Loan Terms & Payment.png`) — this is not a blank-slate
design.

## Scope decision: Phase A / Phase B split

The reference screenshots show SoftPro treating each loan as potentially
carrying its **own separate Closing Disclosure** (a "CDF" column per loan, a
CDF dropdown in Loan Funding) — matching federal reality (each loan generally
gets its own CD). Cam confirmed this is genuinely wanted: a second loan (e.g.
a piggyback second mortgage) needs its own full CDF Page 1-5, not just its
own line item.

That is a restructuring of the CDF subsystem itself — Pages 1-5, and every
screen that assigns a fee into Page 2 (Premiums, Additional Charges, Tax
Prorations, Recording), are all currently order-scoped (one set per order),
not loan-scoped. Making CDF loan-scoped touches roughly seven already-shipped
screens and their data model.

**Decision (Cam handed this call to me, so recording the reasoning):** split
into two phases rather than build both at once.

- **Phase A (this spec):** the `loans` table, multi-loan support, the field
  set below, and computing Section F's existing per-diem rate from it. Real,
  shippable value on its own — unblocks Schedule A's Loan Number and gives
  Section F a computed rate instead of manual entry. A file can carry two
  loans on this screen while still producing one CD for now.
- **Phase B (explicitly deferred, not scoped here):** make CDF Pages 1-5 and
  every fee-assignment control loan-scoped instead of order-scoped, so a
  second loan gets its own full CD. Its own brainstorm/spec/plan cycle when
  picked up — not guessed at in this document.

## Field set (confirmed with Cam)

Beyond what's structurally necessary for the seeding relationship below
(principal amount, interest rate, lender), Cam named exactly: **Loan Number,
Loan Type (Conventional / FHA / VA / USDA), Construction/Equity First Draw
Amount.**

Explicitly not building (SoftPro reference shows these; not named by Cam,
reads as loan-servicing detail this office doesn't enter): payment
schedule/late charges/balloon/prepayment penalty/ARM "Loan Data," Mtg. Ins.
case #, FHA old case #, loan approval/commitment dates, CDF Transfer Option,
Loan servicer, Post-Closing Inspection/Handling, generic Notes/Custom Fields.
Flag back to Cam if any of these turn out to be needed later — not guessed at
here.

## Data model

**`loans`** table (new migration — exact number determined at implementation
time, since Staff Directory's plan already provisionally claims `0054`/`0055`
and execution order between the two isn't fixed yet):

| column | type | notes |
|---|---|---|
| `id` | uuid, pk | |
| `order_id` | uuid, fk → `orders.id` | |
| `sort_order` | integer | first loan (lowest `sort_order`) is the primary loan for seeding, below |
| `lender_contact_id` | uuid, fk → `contacts.id`, nullable | reuses the order's existing Contacts (Lender role) — no new, parallel "Loan Contacts" concept |
| `principal_amount` | numeric | |
| `annual_interest_rate` | numeric | percent, e.g. `6.5` |
| `loan_number` | text | |
| `loan_type` | text | `Conventional` \| `FHA` \| `VA` \| `USDA` |
| `construction_equity_draw_amount` | numeric, nullable | |

One-to-many with `orders`, matching the existing multi-item list pattern
already used by Recording and Additional Charges (add/remove, no separate
sub-page per row).

## Seeding relationships — the primary loan is the single source of truth

- `orders.loan_amount` (today's early-estimate field on Order Entry) seeds
  the primary loan's `principal_amount` as a **one-time default** the first
  time a loan is added to a file — the same seed-once-editable-after
  convention used everywhere else in this app (Order Entry's purchase price
  seeding Schedule A, property address seeding Property, etc.). After that,
  the `loans` row is the real value; `orders.loan_amount` itself is not
  written back to or kept in sync going forward.
- CDF Page 1's `loan_amount`/`interest_rate`, CDF Page 3's
  `loan_amount_estimate`/`loan_amount_final`, and Document Prep's
  `loan_amount`/`interest_rate` all get the same one-time-default treatment
  from the primary loan instead of independent manual entry — this is the
  actual fix for the four-screens-drift problem described above.
- CDF Section F's Prepaid Interest per-diem **rate** field (already built,
  `0047` — date range, 365/360 basis toggle, live-computed total already
  exist and are unchanged) gets a computed default:
  `(primary_loan.annual_interest_rate ÷ 100 × primary_loan.principal_amount) ÷ days_per_year`,
  using that field's own existing 365/360 toggle. Still editable after.
- **Explicitly excluded from this seeding relationship:** Payoff
  Calculations' `interest_rate` (migration `0034`). That field describes the
  *old* loan being paid off in a refinance — a different loan than what this
  screen tracks. Raised and corrected during brainstorming rather than built
  wrong.

## UI placement

New "Loan Information & Funding" item in the Title nav group, alongside
Schedule A/B and Curative — matching where Cam's Fix Plan note already
parked "move Title Insurance Premiums into the Title nav group" (the same
underlying multi-loan/multi-policy need). A single screen with a repeating
loan list (add/remove), each loan's fields rendered inline — no separate
sub-page per loan needed for this field set's size.

## Out of scope for this pass

- Phase B (loan-scoped CDF) — its own future spec.
- Every SoftPro field listed under "Field set" as explicitly not building.
- Any change to Payoff Calculations.
