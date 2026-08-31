-- supabase/migrations/0004_commitment_sch_a.sql

create table public.commitment_sch_a (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  form_type text not null default 'Standard' check (form_type in ('Standard', 'Short Form')),
  company_state_of_org text,
  requirements_time_period text,
  env_protection_lien_statutes text,
  issuing_agent text,
  issuing_office text,
  alta_universal_id text,
  loan_id_number text,
  commitment_number text,
  revision_number text,
  date_issued date,
  time_issued time,
  title_held_as text,
  owner_policy_type text check (owner_policy_type in (
    'ALTA Owner''s Policy', 'ALTA Loan Policy', 'ALTA Homeowner''s Policy',
    'Leasehold Owner''s Policy', 'Leasehold Loan Policy', 'Construction Loan Policy', 'Other'
  )),
  owner_coverage_amount numeric(14,2),
  owner_coverage_tbd boolean not null default false,
  owner_proposed_insured text,
  loan_policy_type text check (loan_policy_type in (
    'ALTA Owner''s Policy', 'ALTA Loan Policy', 'ALTA Homeowner''s Policy',
    'Leasehold Owner''s Policy', 'Leasehold Loan Policy', 'Construction Loan Policy', 'Other'
  )),
  loan_coverage_amount numeric(14,2),
  loan_coverage_tbd boolean not null default false,
  loan_proposed_insured text,
  loan_mortgagee_clause text,
  counter_signature text,
  counter_signature_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chain_of_title (
  id uuid primary key default gen_random_uuid(),
  commitment_sch_a_id uuid not null references public.commitment_sch_a(id) on delete cascade,
  instrument_type text,
  grantor text,
  grantee text,
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  created_at timestamptz not null default now()
);

create index chain_of_title_commitment_sch_a_id_idx on public.chain_of_title(commitment_sch_a_id);

alter table public.commitment_sch_a enable row level security;
alter table public.chain_of_title enable row level security;

create policy "Authenticated M&L staff can do anything with commitment_sch_a"
  on public.commitment_sch_a for all to authenticated using (true) with check (true);

create policy "Authenticated M&L staff can do anything with chain_of_title"
  on public.chain_of_title for all to authenticated using (true) with check (true);
