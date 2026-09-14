-- supabase/migrations/0059_document_assembly_engine.sql
-- Document Assembly Engine, Phase 1a (Genesis Rebuild - Document Assembly Engine
-- Design.md): one template per document type (just 'commitment' for now), one
-- merged-document instance per order, tracking the last-merged snapshot of each
-- Content Control's value so the read-back step can tell "hand-edited" from
-- "nothing changed." Storage buckets for the template file and the per-order
-- merged .docx/PDF/temp docbuilder scripts, matching the Attachments bucket pattern.

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  document_type text not null unique check (document_type in ('commitment')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table public.commitment_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  template_id uuid not null references public.document_templates(id),
  storage_path text not null,
  last_merged_snapshot jsonb not null default '{}'::jsonb,
  pdf_storage_path text,
  revision_number integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index commitment_documents_order_id_idx on public.commitment_documents(order_id);

alter table public.document_templates enable row level security;
alter table public.commitment_documents enable row level security;

create policy "Authenticated M&L staff can do anything with document_templates"
  on public.document_templates for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with commitment_documents"
  on public.commitment_documents for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values
  ('document-templates', 'document-templates', false),
  ('commitment-documents', 'commitment-documents', false);

create policy "Authenticated M&L staff can do anything with document-templates bucket objects"
  on storage.objects for all to authenticated
  using (bucket_id = 'document-templates')
  with check (bucket_id = 'document-templates');

create policy "Authenticated M&L staff can do anything with commitment-documents bucket objects"
  on storage.objects for all to authenticated
  using (bucket_id = 'commitment-documents')
  with check (bucket_id = 'commitment-documents');
