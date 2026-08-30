-- supabase/migrations/0003_prelim_search.sql

create table public.prelim_search (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  effective_date date,
  effective_time time,
  search_from_date date,
  search_to_date date,
  search_to_time time,
  search_type text,
  derivation_instrument_type text check (derivation_instrument_type in (
    'Warranty Deed', 'Special Warranty Deed', 'Limited Warranty Deed', 'Trustee''s Deed',
    'Deed of Distribution', 'Gift Deed', 'Quitclaim Deed', 'Grant Deed',
    'Deed of Bargain and Sale', 'Interspousal Transfer Deed', 'Transfer on Death Deed',
    'Affidavit', 'Death Certificate', 'Divorce Decree', 'Quiet Title Action', 'Confirmatory Deed'
  )),
  derivation_dated_date date,
  derivation_recorded_date date,
  derivation_book text,
  derivation_page text,
  derivation_instrument_number text,
  derivation_consideration numeric(14,2),
  derivation_grantee_name text,
  derivation_grantee_entity_type text check (derivation_grantee_entity_type in (
    'Individual', 'LLC', 'Corporation', 'Partnership', 'Trust', 'Estate', 'Other'
  )),
  derivation_grantor_name text,
  derivation_grantor_entity_type text check (derivation_grantor_entity_type in (
    'Individual', 'LLC', 'Corporation', 'Partnership', 'Trust', 'Estate', 'Other'
  )),
  derivation_is_portion boolean not null default false,
  derivation_note text,
  taxes_paid_through_year text,
  taxes_now_due text,
  taxes_not_yet_due text,
  special_levies_assessments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.derivation_principals (
  id uuid primary key default gen_random_uuid(),
  prelim_search_id uuid not null references public.prelim_search(id) on delete cascade,
  side text not null check (side in ('grantee', 'grantor')),
  name text not null,
  role text,
  created_at timestamptz not null default now()
);

create index derivation_principals_prelim_search_id_idx on public.derivation_principals(prelim_search_id);

create table public.security_instruments (
  id uuid primary key default gen_random_uuid(),
  prelim_search_id uuid not null references public.prelim_search(id) on delete cascade,
  type text not null check (type in ('Mortgage', 'Deed of Trust', 'Security Deed', 'UCC Financing Statement')),
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  original_amount numeric(14,2),
  mortgagor text,
  mortgagee text,
  trustee text,
  created_at timestamptz not null default now()
);

create index security_instruments_prelim_search_id_idx on public.security_instruments(prelim_search_id);

create table public.security_instrument_related_docs (
  id uuid primary key default gen_random_uuid(),
  security_instrument_id uuid not null references public.security_instruments(id) on delete cascade,
  type text not null check (type in (
    'Assignment', 'Assignment of Leases and Rents', 'Assignment of Beneficial Interest',
    'Loan Modification Agreement', 'Substitution of Trustee', 'UCC Addendum - Continuation', 'Other'
  )),
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  assignor text,
  assignee text,
  notes text,
  created_at timestamptz not null default now()
);

create index security_instrument_related_docs_instrument_id_idx on public.security_instrument_related_docs(security_instrument_id);

create table public.liens (
  id uuid primary key default gen_random_uuid(),
  prelim_search_id uuid not null references public.prelim_search(id) on delete cascade,
  type text not null check (type in (
    'Judgment', 'Tax Lien', 'HOA/COA Lien', 'Mechanics Lien', 'Lis Pendens',
    'Tax Sale Certificate', 'Municipal Lien', 'Utility Lien', 'Other'
  )),
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  amount numeric(14,2),
  debtor text,
  creditor text,
  docket_date date,
  case_number text,
  court text,
  taxing_authority text,
  tax_type text check (tax_type in ('Income', 'Property', 'Franchise', 'Sales/Use', 'Estate', 'Other')),
  filed_date date,
  hoa_company text,
  materialman text,
  last_service_date date,
  plaintiff text,
  defendant text,
  certificate_id text,
  redemption_expiration date,
  created_at timestamptz not null default now()
);

create index liens_prelim_search_id_idx on public.liens(prelim_search_id);

create table public.exception_matters (
  id uuid primary key default gen_random_uuid(),
  prelim_search_id uuid not null references public.prelim_search(id) on delete cascade,
  description text not null,
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  created_at timestamptz not null default now()
);

create index exception_matters_prelim_search_id_idx on public.exception_matters(prelim_search_id);

alter table public.prelim_search enable row level security;
alter table public.derivation_principals enable row level security;
alter table public.security_instruments enable row level security;
alter table public.security_instrument_related_docs enable row level security;
alter table public.liens enable row level security;
alter table public.exception_matters enable row level security;

create policy "Authenticated M&L staff can do anything with prelim_search"
  on public.prelim_search for all to authenticated using (true) with check (true);

create policy "Authenticated M&L staff can do anything with derivation_principals"
  on public.derivation_principals for all to authenticated using (true) with check (true);

create policy "Authenticated M&L staff can do anything with security_instruments"
  on public.security_instruments for all to authenticated using (true) with check (true);

create policy "Authenticated M&L staff can do anything with security_instrument_related_docs"
  on public.security_instrument_related_docs for all to authenticated using (true) with check (true);

create policy "Authenticated M&L staff can do anything with liens"
  on public.liens for all to authenticated using (true) with check (true);

create policy "Authenticated M&L staff can do anything with exception_matters"
  on public.exception_matters for all to authenticated using (true) with check (true);
