-- Payoff Calculations real redesign (Fix Plan: "a real redesign, not a tweak"),
-- resolved by Payoff Calculation.png: two mutually-exclusive methods, Principal
-- Balance vs Payoff Amount. Payoff Amount auto-calculates from the Principal
-- Balance fields when that method is chosen (Cam's own note); when the Payoff
-- Amount method is chosen instead, `payoff_amount` is the manually entered figure.
-- `amount` (existing) stays the untouched CDF Page 3 K-line source of truth per
-- 0034's own comment — these columns are supporting detail only.

alter table cdf_payoffs_payments
  add column payoff_method text not null default 'principal_balance'
    check (payoff_method in ('principal_balance', 'payoff_amount')),
  add column interest_charged numeric,
  add column late_fee_after date,
  add column payoff_amount numeric,
  add column per_diem_days_basis text not null default '365' check (per_diem_days_basis in ('365', '360')),
  add column payoff_date_basis text,
  add column payoff_date_basis_from date,
  add column payoff_date_basis_to date,
  add column extra_days numeric;
