-- CDF Page 4 (Additional Information About This Loan) — one row per order. Fixed
-- disclosure structure per the official form: Assumption, Demand Feature, Late Payment,
-- Negative Amortization, Partial Payments, Security Interest, Escrow Account.

create table cdf_page4 (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade unique,
  has_assumption boolean not null default false,
  assumption_allowed boolean not null default false,
  has_demand_feature boolean not null default false,
  demand_feature_explanation text,
  late_payment_grace_period_days int,
  late_payment_fee_percent numeric,
  has_negative_amortization boolean not null default false,
  negative_amortization_explanation text,
  partial_payments_accepted boolean not null default false,
  partial_payments_explanation text,
  has_security_interest boolean not null default false,
  security_interest_property_address text,
  escrow_type text,
  escrow_initial_deposit numeric,
  escrow_monthly_payment numeric,
  no_escrow_estimated_property_costs numeric,
  no_escrow_escrowed_note text,
  created_at timestamptz not null default now()
);

alter table cdf_page4 enable row level security;

create policy "authenticated_all_cdf_page4" on cdf_page4
  for all to authenticated using (true) with check (true);
