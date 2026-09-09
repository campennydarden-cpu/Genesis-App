-- CDF Page 2 (Closing Cost Details) — manual-entry shell, same shape as Additional
-- Title Charges. One flat table distinguished by `section` (A/B/C/E/F/G/H); D/I/J
-- subtotals are computed in application code, never stored.

create table cdf_page2_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  section text not null,
  sort_order int not null default 0,
  description text,
  to_contact_id uuid references contacts(id) on delete set null,
  borrower_paid_at_closing numeric,
  borrower_paid_before_closing numeric,
  seller_paid_at_closing numeric,
  seller_paid_before_closing numeric,
  paid_by_others numeric,
  created_at timestamptz not null default now()
);

create index cdf_page2_lines_order_id_idx on cdf_page2_lines(order_id);

alter table cdf_page2_lines enable row level security;

create policy "authenticated_all_cdf_page2_lines" on cdf_page2_lines
  for all to authenticated using (true) with check (true);
