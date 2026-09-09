-- Payoff Calculations: per-line detail on the existing K. Payoffs and Payments rows.
-- Earmarked as a follow-up in 0030_cdf_page3.sql's own comment ("out of scope here
-- (separate, not-yet-built 'Payoff Calculations' feature)"). `amount` on
-- cdf_payoffs_payments stays the single source of truth for CDF Page 3's total —
-- these columns are supporting detail only, never derived from or folded back into it.

alter table cdf_payoffs_payments
  add column principal_balance numeric,
  add column interest_rate numeric,
  add column per_diem numeric,
  add column interest_from date,
  add column interest_to date,
  add column additional_interest numeric,
  add column late_fee numeric,
  add column payoff_expires_on date;

create table cdf_payoff_additional_charges (
  id uuid primary key default gen_random_uuid(),
  payoff_id uuid not null references cdf_payoffs_payments(id) on delete cascade,
  sort_order int not null default 0,
  description text,
  fee numeric,
  created_at timestamptz not null default now()
);

create index cdf_payoff_additional_charges_payoff_id_idx on cdf_payoff_additional_charges(payoff_id);

alter table cdf_payoff_additional_charges enable row level security;

create policy "authenticated_all_cdf_payoff_additional_charges" on cdf_payoff_additional_charges
  for all to authenticated using (true) with check (true);
