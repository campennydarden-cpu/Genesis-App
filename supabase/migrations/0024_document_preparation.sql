-- supabase/migrations/0024_document_preparation.sql
-- Document Preparation: Deed, Security Instrument, Affidavits, Power of Attorney,
-- Notary Acknowledgement. See genesis-app/docs/superpowers/plans/2026-09-08-document-preparation.md.
-- Deed and Security Instrument are one-row-per-order records (get-or-create-on-read,
-- same idea as curative_settings). Grantor/Grantee and Mortgagor/Mortgagee are
-- independent copies of Contact data, not live references — code-verified against the
-- old prototype after Design Notes - Platform.md turned out to be stale on this point.

create table public.doc_prep_deed (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  instrument_type text,
  consideration numeric,
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  prepared_by_contact_id uuid references public.contacts(id) on delete set null,
  return_to_contact_id uuid references public.contacts(id) on delete set null,
  exemption_code text,
  legal_as_exhibit boolean not null default false,
  final boolean not null default false,
  finalized_at timestamptz,
  grantor_name text,
  grantor_entity_type text default 'Individual',
  grantee_name text,
  grantee_entity_type text default 'Individual',
  notary_block text,
  legal_text text,
  parcel_number text,
  derivation_text text,
  situs_address text
);

alter table public.doc_prep_deed enable row level security;

create policy "Authenticated M&L staff can do anything with doc_prep_deed"
  on public.doc_prep_deed for all to authenticated using (true) with check (true);

create table public.doc_prep_deed_principals (
  id uuid primary key default gen_random_uuid(),
  deed_id uuid not null references public.doc_prep_deed(id) on delete cascade,
  side text not null check (side in ('grantor', 'grantee')),
  name text not null,
  role text
);

create index doc_prep_deed_principals_deed_id_idx on public.doc_prep_deed_principals(deed_id);

alter table public.doc_prep_deed_principals enable row level security;

create policy "Authenticated M&L staff can do anything with doc_prep_deed_principals"
  on public.doc_prep_deed_principals for all to authenticated using (true) with check (true);

create table public.doc_prep_deed_signature_lines (
  id uuid primary key default gen_random_uuid(),
  deed_id uuid not null references public.doc_prep_deed(id) on delete cascade,
  text text not null
);

create index doc_prep_deed_signature_lines_deed_id_idx on public.doc_prep_deed_signature_lines(deed_id);

alter table public.doc_prep_deed_signature_lines enable row level security;

create policy "Authenticated M&L staff can do anything with doc_prep_deed_signature_lines"
  on public.doc_prep_deed_signature_lines for all to authenticated using (true) with check (true);

create table public.doc_prep_deed_subject_to (
  id uuid primary key default gen_random_uuid(),
  deed_id uuid not null references public.doc_prep_deed(id) on delete cascade,
  description text not null,
  sort_order integer not null
);

create index doc_prep_deed_subject_to_deed_id_idx on public.doc_prep_deed_subject_to(deed_id);

alter table public.doc_prep_deed_subject_to enable row level security;

create policy "Authenticated M&L staff can do anything with doc_prep_deed_subject_to"
  on public.doc_prep_deed_subject_to for all to authenticated using (true) with check (true);

create table public.doc_prep_security_instrument (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  instrument_type text,
  trustee_name text,
  loan_amount numeric,
  dated_date date,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  mortgagor_name text,
  mortgagor_entity_type text default 'Individual',
  mortgagee_name text,
  mortgagee_entity_type text default 'Individual',
  note_date date,
  note_amount numeric,
  maturity_date date,
  interest_rate numeric
);

alter table public.doc_prep_security_instrument enable row level security;

create policy "Authenticated M&L staff can do anything with doc_prep_security_instrument"
  on public.doc_prep_security_instrument for all to authenticated using (true) with check (true);

create table public.doc_prep_si_principals (
  id uuid primary key default gen_random_uuid(),
  si_id uuid not null references public.doc_prep_security_instrument(id) on delete cascade,
  side text not null check (side in ('mortgagor', 'mortgagee')),
  name text not null,
  role text
);

create index doc_prep_si_principals_si_id_idx on public.doc_prep_si_principals(si_id);

alter table public.doc_prep_si_principals enable row level security;

create policy "Authenticated M&L staff can do anything with doc_prep_si_principals"
  on public.doc_prep_si_principals for all to authenticated using (true) with check (true);

create table public.doc_prep_affidavits (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null,
  affiant text,
  dated_date date,
  recorded boolean not null default false,
  recorded_date date,
  book text,
  page text,
  instrument_number text,
  notes text,
  sort_order integer not null
);

create index doc_prep_affidavits_order_id_idx on public.doc_prep_affidavits(order_id);

alter table public.doc_prep_affidavits enable row level security;

create policy "Authenticated M&L staff can do anything with doc_prep_affidavits"
  on public.doc_prep_affidavits for all to authenticated using (true) with check (true);

create table public.doc_prep_notary_acks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  doc_label text not null,
  text text not null,
  unique (contact_id, doc_label)
);

create index doc_prep_notary_acks_order_id_idx on public.doc_prep_notary_acks(order_id);

alter table public.doc_prep_notary_acks enable row level security;

create policy "Authenticated M&L staff can do anything with doc_prep_notary_acks"
  on public.doc_prep_notary_acks for all to authenticated using (true) with check (true);

-- POA recording data: structured fields on the Contact itself (Power of Attorney has no
-- table of its own — the Doc Prep screen lists every contacts.poa = true row and writes
-- back onto that same record), matching the prototype's own "upgraded from free-text
-- poaInstrumentRef" note.
alter table public.contacts add column poa_attorney_in_fact_name text;
alter table public.contacts add column poa_dated_date date;
alter table public.contacts add column poa_recorded_date date;
alter table public.contacts add column poa_book text;
alter table public.contacts add column poa_page text;
alter table public.contacts add column poa_instrument_number text;
