-- supabase/migrations/0039_invoices.sql
-- Invoices (Fix Plan's "Additional Title/Escrow Charges — Invoice dropdown of open invoices"
-- item, 2026-09-09 evening pass, unblocked by `Invoice.png`). Real screen shape: an invoice
-- header (number, status, dates, Bill To/Remit To) plus a line-items grid pulled from
-- Bill-Code-tagged split rows across the order (title_insurance_premium_splits,
-- endorsement_splits, additional_title_charge_splits) -- Bill Codes and Invoices are one
-- feature, per the same note. Bill To/Remit To are simplified to plain Contact pickers
-- (matching every other Payee-style picker in this rebuild) rather than SoftPro's
-- org+role-code+contact hierarchy. Line items are editable snapshots, not a live join, so a
-- generated line survives its source split being edited or deleted later -- `source_split_id`
-- only prevents pulling the same split in twice, it isn't a live reference.

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sort_order integer not null default 0,
  invoice_number text not null,
  status text not null default 'Pending',
  invoice_date date,
  due_date date,
  bill_to_contact_id uuid references public.contacts(id) on delete set null,
  remit_to_contact_id uuid references public.contacts(id) on delete set null,
  message text,
  created_at timestamptz not null default now()
);

create index invoices_order_id_idx on public.invoices(order_id);

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  sort_order integer not null default 0,
  source_table text,
  source_split_id uuid,
  print_to_invoice boolean not null default true,
  bill_code text,
  description text,
  amount numeric,
  taxable boolean not null default false,
  tax numeric,
  created_at timestamptz not null default now()
);

create index invoice_line_items_invoice_id_idx on public.invoice_line_items(invoice_id);

-- Guards "Generate from Bill Codes" against pulling the same split row onto two invoices.
create unique index invoice_line_items_source_split_idx
  on public.invoice_line_items(source_table, source_split_id)
  where source_split_id is not null;

alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;

create policy "Authenticated M&L staff can do anything with invoices"
  on public.invoices for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with invoice_line_items"
  on public.invoice_line_items for all to authenticated using (true) with check (true);
