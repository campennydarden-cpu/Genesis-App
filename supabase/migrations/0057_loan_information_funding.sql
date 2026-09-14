-- 0057_loan_information_funding.sql
-- Loan Information & Funding, Phase A. See
-- docs/superpowers/specs/2026-09-10-loan-info-funding-design.md.
-- Order-scoped, one-to-many -- sort_order 0 (lowest) is "the primary loan"
-- that seeds Schedule A / CDF Page 1 / CDF Page 3 / Security Instrument /
-- CDF Section F's per-diem rate as a render-time fallback default. No
-- backfill: every seeding relationship reads existingValue ?? primaryLoan,
-- nothing is written to any existing row by this migration.

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sort_order integer not null default 0,
  lender_contact_id uuid references public.contacts(id) on delete set null,
  principal_amount numeric,
  annual_interest_rate numeric,
  loan_number text,
  loan_type text,
  construction_equity_draw_amount numeric
);

alter table public.loans enable row level security;

create policy "Authenticated M&L staff can do anything with loans"
  on public.loans for all to authenticated using (true) with check (true);

-- Schedule A's Loan Number never had its own column -- the Fix Plan's note
-- was "blocked until a Loan Info & Funding screen exists to source it from,"
-- not "wire up an existing field." Same seed-once-editable-after fallback as
-- this file's existing owner/loan coverage-amount defaults.
alter table public.commitment_sch_a add column loan_number text;
