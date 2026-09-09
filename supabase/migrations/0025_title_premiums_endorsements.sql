-- Title Insurance Premiums & Endorsements — manual-entry shell (no rate-table calc).

create table title_insurance_premiums (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sort_order int not null default 0,
  policy_type text,
  underwriter_contact_id uuid references contacts(id) on delete set null,
  coverage_amount numeric,
  base_premium numeric,
  final_premium numeric,
  bill_code text,
  created_at timestamptz not null default now()
);

create index title_insurance_premiums_order_id_idx on title_insurance_premiums(order_id);

create table title_insurance_premium_splits (
  id uuid primary key default gen_random_uuid(),
  premium_id uuid not null references title_insurance_premiums(id) on delete cascade,
  sort_order int not null default 0,
  payee_contact_id uuid references contacts(id) on delete set null,
  basis text,
  percent numeric,
  amount numeric,
  bill_code text,
  created_at timestamptz not null default now()
);

create index title_insurance_premium_splits_premium_id_idx on title_insurance_premium_splits(premium_id);

create table endorsements (
  id uuid primary key default gen_random_uuid(),
  premium_id uuid not null references title_insurance_premiums(id) on delete cascade,
  sort_order int not null default 0,
  code text,
  description text,
  charge numeric,
  bill_code text,
  created_at timestamptz not null default now()
);

create index endorsements_premium_id_idx on endorsements(premium_id);

create table endorsement_splits (
  id uuid primary key default gen_random_uuid(),
  endorsement_id uuid not null references endorsements(id) on delete cascade,
  sort_order int not null default 0,
  payee_contact_id uuid references contacts(id) on delete set null,
  basis text,
  percent numeric,
  amount numeric,
  bill_code text,
  created_at timestamptz not null default now()
);

create index endorsement_splits_endorsement_id_idx on endorsement_splits(endorsement_id);

alter table title_insurance_premiums enable row level security;
alter table title_insurance_premium_splits enable row level security;
alter table endorsements enable row level security;
alter table endorsement_splits enable row level security;

create policy "authenticated_all_title_insurance_premiums" on title_insurance_premiums
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_title_insurance_premium_splits" on title_insurance_premium_splits
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_endorsements" on endorsements
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_endorsement_splits" on endorsement_splits
  for all to authenticated using (true) with check (true);
