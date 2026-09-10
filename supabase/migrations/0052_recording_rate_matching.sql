-- supabase/migrations/0052_recording_rate_matching.sql
-- Wires up the curated rate tables from 0049/0050 to Recording's document-type picker
-- (readiness doc "Recording Rate-Table Wiring", Cam answered 2026-09-10). Recording's
-- document_description is a fixed 6-value list (Mortgage, Deed, Release, Power of
-- Attorney, Affidavit, Other) that doesn't line up 1:1 with every state's document_type
-- strings -- some rows are specific to one Recording category, some (Florida's generic
-- bucket) cover several, and Virginia doesn't key by document type at all (flat fee by
-- page-count tier, same for every type). `applies_to` resolves this per Cam's call
-- ("the schema approach is best... Deed can be generic, same with Mortgage, Affidavit,
-- POA"), matching this design's existing "data, not per-state code" convention:
--   * an explicit array of Recording document_description values = this row is the rate
--     for exactly those categories (Florida's generic row lists several).
--   * NULL = a page-count-tiered/universal fallback row (Virginia's 3 tiers) -- applies
--     to any document type, disambiguated by number_of_pages against base_page_count
--     instead of by category.
--   * '{}' (empty array) = deliberately not auto-matched (Assignment/Plat/UCC rows --
--     Recording has no corresponding category, or the row is a rare secondary variant
--     like GA's "endorsed on original" release). Matching code treats "no row found" and
--     "matched row with a null base_fee / verified = false" the same way in the UI --
--     both mean "no confirmed rate, enter manually" (Cam's answer to Q4).
alter table public.recording_fee_schedules
  add column applies_to text[];

comment on column public.recording_fee_schedules.applies_to is
  'Which Recording document_description values this row prices. NULL = page-count-tiered/universal fallback (Virginia). Empty array = deliberately unmapped.';

-- Default every row to "not auto-matched" so nothing is missed below, then fill in the
-- ones we do want to wire up.
update public.recording_fee_schedules set applies_to = '{}';

update public.recording_fee_schedules set applies_to = array['Deed']
  where state in ('NC', 'SC', 'TN') and document_type = 'Deed';
update public.recording_fee_schedules set applies_to = array['Mortgage']
  where state in ('NC', 'SC', 'TN') and document_type = 'Deed of Trust/Mortgage';
update public.recording_fee_schedules set applies_to = array['Release']
  where state in ('NC', 'SC', 'TN') and document_type = 'Satisfaction/Release';
update public.recording_fee_schedules set applies_to = array['Power of Attorney']
  where state in ('NC', 'SC', 'TN') and document_type = 'Power of Attorney';

update public.recording_fee_schedules set applies_to = array['Deed']
  where state = 'GA' and document_type = 'Deed';
update public.recording_fee_schedules set applies_to = array['Mortgage']
  where state = 'GA' and document_type = 'Security Deed/Deed to Secure Debt';
update public.recording_fee_schedules set applies_to = array['Release']
  where state = 'GA' and document_type = 'Satisfaction/Release (separate document)';
update public.recording_fee_schedules set applies_to = array['Power of Attorney']
  where state = 'GA' and document_type = 'Power of Attorney';

update public.recording_fee_schedules set applies_to = array['Deed', 'Affidavit', 'Other']
  where state = 'FL' and document_type = 'Deed/General Instrument';
update public.recording_fee_schedules set applies_to = array['Mortgage']
  where state = 'FL' and document_type = 'Mortgage';
update public.recording_fee_schedules set applies_to = array['Release']
  where state = 'FL' and document_type = 'Satisfaction/Release';
update public.recording_fee_schedules set applies_to = array['Power of Attorney']
  where state = 'FL' and document_type = 'Power of Attorney';

update public.recording_fee_schedules set applies_to = null
  where state = 'VA' and document_type like 'Any Instrument%';
