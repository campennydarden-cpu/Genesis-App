-- supabase/migrations/0009_property_address_and_legal_split.sql

-- Collapse house_number/street_name/street_suffix/directional into one field, matching
-- Order Entry's property_address convention.
-- ponytail: old decomposed columns (house_number/street_name/street_suffix/directional) are kept,
-- not dropped, until the new property_address column is verified in production. Drop them in a
-- follow-up migration once the UI cutover is confirmed clean.
alter table public.property_details
  add column property_address text;

update public.property_details
set property_address = nullif(trim(both ' ' from concat_ws(' ', house_number, street_name, street_suffix, directional)), '')
where property_address is null;

-- Split section_township_range into 3 fields. Existing combined values are parked in `section`
-- for manual cleanup — there's no reliable way to auto-split free text into the 3 parts.
-- ponytail: old section_township_range column kept, not dropped, until manual cleanup is done.
alter table public.property_details
  add column section text,
  add column township text,
  add column range text;

update public.property_details
set section = section_township_range
where section is null and section_township_range is not null;
