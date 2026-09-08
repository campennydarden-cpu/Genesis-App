-- supabase/migrations/0020_contact_signature_lines.sql
-- Per Cam's note: an editable Signature Line(s) list on Buyer/Borrower and Seller
-- contacts, defaulting from entity details but freely overridable. Mirrors the
-- existing contact_principals child-table pattern rather than a JSONB blob, to
-- match this codebase's established convention for per-contact CRUD lists.

create table public.contact_signature_lines (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index contact_signature_lines_contact_id_idx on public.contact_signature_lines(contact_id);

alter table public.contact_signature_lines enable row level security;

create policy "Authenticated M&L staff can do anything with contact_signature_lines"
  on public.contact_signature_lines for all to authenticated using (true) with check (true);
