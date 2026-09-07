-- supabase/migrations/0014_zip_lookup.sql
-- Backs the Order Entry zip-code lookup (Fix Plan: "Zip-code lookup -> County/City/State
-- autofill with multi-county disambiguation popup"). Source data: uszips.csv (SimpleMaps),
-- imported once via scripts/import-zip-lookup.ts -- this migration only creates the table.
-- county/state per zip is always single-valued in this dataset; only county can be
-- ambiguous, so `counties` carries every overlapping county sorted by weight desc.
create table public.zip_lookup (
  zip text primary key,
  city text not null,
  state text not null,
  state_name text not null,
  primary_county text not null,
  counties jsonb not null, -- [{ "name": "...", "fips": "...", "weight": 98.74 }, ...] sorted by weight desc
  updated_at timestamptz not null default now()
);

alter table public.zip_lookup enable row level security;

create policy "Authenticated M&L staff can do anything with zip_lookup"
  on public.zip_lookup
  for all
  to authenticated
  using (true)
  with check (true);
