-- CDF Page 2 Section F (Prepaids) gets 4 fixed, non-removable default lines
-- (Cam's exact wording: "these should default this way on every CD") — same
-- `is_fixed` mechanism as Section A's Points row and Section G's Aggregate
-- Adjustment row (0040), seeded idempotently by listCdfPage2Lines. The rows
-- themselves are seeded in application code, not this migration (no schema
-- change needed for that part — is_fixed/description already exist).
--
-- The "Prepaid Interest" row also carries its own per-diem config, resolved by
-- Prepaid Interest Config.png: a date range, a 365/360-day-basis toggle (mirrors
-- Tax/Other Prorations' existing use_30_day_months convention), and a per diem
-- rate. Display-only computed help, like Section A's points config — never
-- auto-written into the real Borrower/Seller-Paid columns.

alter table cdf_page2_lines
  add column prepaid_interest_from date,
  add column prepaid_interest_to date,
  add column prepaid_interest_per_diem_rate numeric,
  add column prepaid_interest_use_30_day_months boolean not null default false,
  add column prepaid_interest_date_basis text;
