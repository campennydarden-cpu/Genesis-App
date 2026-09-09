-- CDF Page 5 (Loan Calculations, Other Disclosures, Contact Information) — singleton
-- plus a Contact Information list. Confirm Receipt (signature print config) is
-- deliberately not built — Genesis doesn't generate a printable CDF yet.

create table cdf_page5 (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade unique,
  total_of_payments numeric,
  finance_charge numeric,
  amount_financed numeric,
  apr numeric,
  total_interest_percentage numeric,
  print_appraisal_disclosure boolean not null default true,
  liability_after_foreclosure text,
  created_at timestamptz not null default now()
);

create table cdf_page5_contacts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sort_order int not null default 0,
  role text,
  contact_id uuid references contacts(id) on delete set null,
  nmls_id text,
  license_id text,
  contact_person text,
  contact_nmls_id text,
  contact_license_id text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create index cdf_page5_contacts_order_id_idx on cdf_page5_contacts(order_id);

alter table cdf_page5 enable row level security;
alter table cdf_page5_contacts enable row level security;

create policy "authenticated_all_cdf_page5" on cdf_page5
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_cdf_page5_contacts" on cdf_page5_contacts
  for all to authenticated using (true) with check (true);
