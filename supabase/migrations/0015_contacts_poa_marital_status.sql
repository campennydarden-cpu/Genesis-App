-- supabase/migrations/0015_contacts_poa_marital_status.sql

alter table public.contacts
  add column poa boolean not null default false,
  add column marital_status text;
