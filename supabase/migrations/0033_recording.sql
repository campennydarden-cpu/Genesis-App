-- Recording: tracks the status of each document actually sent to the recorder's
-- office, distinct from CDF Page 2 Section E which already captures the recording
-- fee as a generic charge line.

create table recording_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sort_order int not null default 0,
  document_description text,
  county text,
  status text not null default 'Not Submitted',
  date_submitted date,
  date_recorded date,
  instrument_number text,
  book text,
  page text,
  number_of_pages int,
  e_recording_reference text,
  created_at timestamptz not null default now()
);

create index recording_documents_order_id_idx on recording_documents(order_id);

alter table recording_documents enable row level security;

create policy "authenticated_all_recording_documents" on recording_documents
  for all to authenticated using (true) with check (true);
