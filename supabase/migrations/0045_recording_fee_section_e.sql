-- Recording fee calculation, resolved by Section E Recording Charges calculation
-- and configuration.png / CDF Pg2 SectionE Recording.png: Recording Fees live in
-- CDF Page 2 Section E ("Taxes and Other Government Fees"), not Section G as the
-- Fix Plan note guessed. Cam's call: manual fee entry for now (no curated rate
-- table — same E&O-risk governance already parked for recordation/transfer tax
-- in Design Notes - Platform.md), auto-reported to a real Section E line via the
-- same cdf_page2_line_id link pattern every other charge screen already uses.

alter table recording_documents
  add column fee numeric,
  add column seller_pay_percent numeric,
  add column cdf_page2_line_id uuid references cdf_page2_lines(id) on delete set null;
