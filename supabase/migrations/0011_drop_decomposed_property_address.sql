-- supabase/migrations/0011_drop_decomposed_property_address.sql
-- Follow-up to 0009: house_number/street_name/street_suffix/directional were superseded
-- by property_address (backfilled in 0009) and confirmed unreferenced anywhere in app
-- code. Dropping now that the UI cutover is verified clean.
alter table public.property_details
  drop column house_number,
  drop column street_name,
  drop column street_suffix,
  drop column directional;
