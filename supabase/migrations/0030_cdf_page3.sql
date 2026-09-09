-- CDF Page 3 (Calculating Cash to Close, K. Payoffs and Payments, Summaries of
-- Transactions) — manual entry across three tables. Payoffs and Payments is a plain
-- amount list; the per-line "Payoff Calculation" rate/per-diem detail SoftPro shows is
-- out of scope here (separate, not-yet-built "Payoff Calculations" feature).

create table cdf_cash_to_close (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade unique,
  loan_amount_estimate numeric,
  loan_amount_final numeric,
  loan_amount_changed text,
  closing_costs_j_estimate numeric,
  closing_costs_j_final numeric,
  closing_costs_changed text,
  closing_costs_paid_before_closing_estimate numeric,
  closing_costs_paid_before_closing_final numeric,
  payoffs_k_estimate numeric,
  payoffs_k_final numeric,
  payoffs_changed text,
  cash_to_close_estimate numeric,
  cash_to_close_final numeric,
  cash_to_close_from_borrower boolean not null default false,
  cash_to_close_to_borrower boolean not null default false,
  closing_costs_financed numeric,
  created_at timestamptz not null default now()
);

create table cdf_payoffs_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sort_order int not null default 0,
  description text,
  payee_contact_id uuid references contacts(id) on delete set null,
  amount numeric,
  created_at timestamptz not null default now()
);

create index cdf_payoffs_payments_order_id_idx on cdf_payoffs_payments(order_id);

create table cdf_transaction_summary_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  party text not null,
  section text not null,
  sort_order int not null default 0,
  description text,
  amount numeric,
  created_at timestamptz not null default now()
);

create index cdf_transaction_summary_lines_order_id_idx on cdf_transaction_summary_lines(order_id);

alter table cdf_cash_to_close enable row level security;
alter table cdf_payoffs_payments enable row level security;
alter table cdf_transaction_summary_lines enable row level security;

create policy "authenticated_all_cdf_cash_to_close" on cdf_cash_to_close
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_cdf_payoffs_payments" on cdf_payoffs_payments
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_cdf_transaction_summary_lines" on cdf_transaction_summary_lines
  for all to authenticated using (true) with check (true);
