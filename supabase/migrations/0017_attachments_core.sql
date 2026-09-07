-- supabase/migrations/0017_attachments_core.sql
-- Attachments Core (Genesis Rebuild - Attachments Core Design.md): firm-wide folder
-- taxonomy template, per-order folder tree copied from it, and the attachments that
-- live in those folders. Storage bucket + RLS policy for the actual file bytes.

create table public.folder_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null,
  parent_folder_template_id uuid references public.folder_templates(id) on delete cascade
);

create index folder_templates_parent_idx on public.folder_templates(parent_folder_template_id);

alter table public.folder_templates enable row level security;

create policy "Authenticated M&L staff can do anything with folder_templates"
  on public.folder_templates for all to authenticated using (true) with check (true);

create table public.attachment_folders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  name text not null,
  sort_order integer not null,
  parent_folder_id uuid references public.attachment_folders(id) on delete cascade,
  source_template_id uuid references public.folder_templates(id) on delete set null
);

create index attachment_folders_order_id_idx on public.attachment_folders(order_id);
create index attachment_folders_parent_idx on public.attachment_folders(parent_folder_id);

alter table public.attachment_folders enable row level security;

create policy "Authenticated M&L staff can do anything with attachment_folders"
  on public.attachment_folders for all to authenticated using (true) with check (true);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  folder_id uuid not null references public.attachment_folders(id) on delete cascade,
  name text not null,
  description text,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  source text not null default 'Attached' check (source in ('Attached', 'Merged')),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index attachments_order_id_idx on public.attachments(order_id);
create index attachments_folder_id_idx on public.attachments(folder_id);

alter table public.attachments enable row level security;

create policy "Authenticated M&L staff can do anything with attachments"
  on public.attachments for all to authenticated using (true) with check (true);

-- Seed the firm-wide 11-folder taxonomy (10 top-level + Trash), with "1. Title Docs"
-- carrying one nested sub-folder "1.a Title Work" per the design doc.
do $$
declare
  title_docs_id uuid;
begin
  insert into public.folder_templates (name, sort_order) values ('Title Docs', 1) returning id into title_docs_id;
  insert into public.folder_templates (name, sort_order, parent_folder_template_id) values ('Title Work', 1, title_docs_id);
  insert into public.folder_templates (name, sort_order) values
    ('Contracts', 2),
    ('Pre-Closing/Invoice', 3),
    ('Date Down/Bring Down', 4),
    ('Unsigned Closing Docs', 5),
    ('Signed Closing Docs', 6),
    ('Post-Closing', 7),
    ('Funding', 8),
    ('Recording and Policy', 9),
    ('Email Communication', 10),
    ('Trash', 11);
end $$;

-- Storage bucket for the actual file bytes. Private (not public) — access goes
-- through the app's own RLS-backed queries, matching how every other table here
-- enforces "authenticated M&L staff, no finer-grained scoping yet" (Security
-- Concerns.md item 1 tracks tightening this app-wide later, not just here).
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);

create policy "Authenticated M&L staff can do anything with attachments bucket objects"
  on storage.objects for all to authenticated
  using (bucket_id = 'attachments')
  with check (bucket_id = 'attachments');
