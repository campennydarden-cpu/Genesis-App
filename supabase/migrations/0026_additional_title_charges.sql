-- Additional Title/Escrow Charges — manual-entry shell, same shape as Premiums.

create table additional_title_charges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sort_order int not null default 0,
  description text,
  policy_id uuid references title_insurance_premiums(id) on delete set null,
  charge numeric,
  taxable boolean not null default false,
  fee_type text,
  cdf_line text,
  invoice text,
  bill_code text,
  seller_pay_percent numeric,
  issued_date date,
  effective_date date,
  created_at timestamptz not null default now()
);

create index additional_title_charges_order_id_idx on additional_title_charges(order_id);

create table additional_title_charge_splits (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references additional_title_charges(id) on delete cascade,
  sort_order int not null default 0,
  payee_contact_id uuid references contacts(id) on delete set null,
  basis text,
  percent numeric,
  amount numeric,
  bill_code text,
  created_at timestamptz not null default now()
);

create index additional_title_charge_splits_charge_id_idx on additional_title_charge_splits(charge_id);

alter table additional_title_charges enable row level security;
alter table additional_title_charge_splits enable row level security;

create policy "authenticated_all_additional_title_charges" on additional_title_charges
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_additional_title_charge_splits" on additional_title_charge_splits
  for all to authenticated using (true) with check (true);
