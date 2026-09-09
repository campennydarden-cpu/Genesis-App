-- Section A's "% of Loan Amount (Points)" line and Section G's "Aggregate
-- Adjustment" line are fixed, non-removable rows confirmed by SoftPro reference
-- screenshots (see Genesis Screen Notes - Fix Plan, 2026-09-09 night pass).
-- `is_fixed` flags them so the UI hides their remove button; the points_*
-- columns hold Section A's percent-of-loan-amount config (only meaningful on
-- that one row, kept flat like every other CDF page's screen-specific column
-- rather than a separate one-row table).
alter table cdf_page2_lines
  add column is_fixed boolean not null default false,
  add column points_percent numeric,
  add column points_round_whole_dollar boolean not null default false,
  add column points_adjustment numeric,
  add column points_adjustment_for text;
