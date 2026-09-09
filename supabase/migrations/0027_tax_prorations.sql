-- Tax / Other Prorations — covers County Tax, City/Town Tax, Assessments, HOA/COA
-- (all four SoftPro screens share one shape). Manual entry + a documented day-count
-- proration calculation (not rate-table dependent, unlike the other Escrow/Closing
-- shells this session).

create table tax_prorations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sort_order int not null default 0,
  description text,
  category text,
  payee_contact_id uuid references contacts(id) on delete set null,
  account_number text,
  compute_for text,
  credit_debit text,
  share_of_amount numeric,
  proration_date date,
  period_from date,
  period_to date,
  use_30_day_months boolean not null default false,
  days_in_period numeric,
  days_prorated numeric,
  per_diem numeric,
  prorated_amount numeric,
  cdf_line text,
  bill_code text,
  created_at timestamptz not null default now()
);

create index tax_prorations_order_id_idx on tax_prorations(order_id);

alter table tax_prorations enable row level security;

create policy "authenticated_all_tax_prorations" on tax_prorations
  for all to authenticated using (true) with check (true);
