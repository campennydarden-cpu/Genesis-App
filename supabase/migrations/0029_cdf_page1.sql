-- CDF Page 1 (Loan Terms / Projected Payments / Costs at Closing) — one row per order,
-- manual entry. Simplified to the fixed-rate payment shape (see plan doc) — no
-- multi-row ARM payment-schedule modeling.

create table cdf_page1 (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade unique,
  loan_amount numeric,
  interest_rate numeric,
  monthly_principal_interest numeric,
  principal_interest_can_increase boolean not null default false,
  principal_interest_increase_explanation text,
  has_prepayment_penalty boolean not null default false,
  prepayment_penalty_max numeric,
  has_balloon_payment boolean not null default false,
  balloon_payment_amount numeric,
  estimated_total_monthly_payment numeric,
  estimated_escrow_monthly numeric,
  taxes_included_in_escrow boolean not null default false,
  homeowners_insurance_included_in_escrow boolean not null default false,
  other_escrow_included boolean not null default false,
  other_escrow_description text,
  closing_costs_total numeric,
  closing_costs_note text,
  cash_to_close_total numeric,
  cash_to_close_note text,
  created_at timestamptz not null default now()
);

alter table cdf_page1 enable row level security;

create policy "authenticated_all_cdf_page1" on cdf_page1
  for all to authenticated using (true) with check (true);
