-- supabase/migrations/0012_contact_principals.sql
-- "People Box" — Trustee (Trust) / Member-Manager (LLC) roster for a Buyer/Borrower or
-- Seller contact, per Genesis Screen Notes - Fix Plan's 2026-09-01 decision. One roster
-- per contact (unlike derivation_principals, no grantor/grantee split needed).
create table public.contact_principals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  name text not null,
  role text,
  created_at timestamptz not null default now()
);

create index contact_principals_contact_id_idx on public.contact_principals(contact_id);

alter table public.contact_principals enable row level security;

create policy "Authenticated M&L staff can do anything with contact_principals"
  on public.contact_principals for all to authenticated using (true) with check (true);
