-- supabase/migrations/0002_property_details.sql
create table public.property_details (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  house_number text,
  street_name text,
  street_suffix text,
  directional text,
  city text,
  county text,
  state text,
  zip text,
  section_township_range text,
  brief_legal text,
  lot text,
  block text,
  subdivision_tract text,
  use_type text check (use_type in (
    '1-4 Family', 'Single Family', 'PUD', 'Condominium', 'Cooperative',
    'Mobile/Manufactured Housing', 'Vacant Land', 'Unimproved Land',
    'Ag Land', 'Commercial Property', 'Mixed Use'
  )),
  full_legal_description text,
  parcel_number text,
  parcel_number_type text check (parcel_number_type in (
    'Parcel ID', 'APN', 'Tax Map Number (TMS)', 'PIN', 'Folio Number', 'Account Number', 'Other'
  )),
  ccrs_dated date,
  ccrs_book text,
  ccrs_page text,
  ccrs_instrument_number text,
  ccrs_notes text,
  plat_survey_reference text,
  setback_front text,
  setback_side text,
  setback_side_street text,
  setback_rear text,
  lot_dimension_frontage text,
  lot_dimension_depth text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_easements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property_details(id) on delete cascade,
  type text not null check (type in (
    'Utility Easement', 'Ingress/Egress Easement', 'Drainage Easement',
    'Right of Way (ROW) Dedication', 'Shared Driveway Easement', 'Access Easement',
    'Pipeline/Transmission Easement', 'Conservation Easement', 'Party Wall Agreement', 'Other'
  )),
  other_type_text text,
  description text,
  created_at timestamptz not null default now()
);

create index property_easements_property_id_idx on public.property_easements(property_id);

alter table public.property_details enable row level security;
alter table public.property_easements enable row level security;

create policy "Authenticated M&L staff can do anything with property_details"
  on public.property_details
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated M&L staff can do anything with property_easements"
  on public.property_easements
  for all
  to authenticated
  using (true)
  with check (true);
