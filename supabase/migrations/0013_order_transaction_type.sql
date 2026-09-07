-- supabase/migrations/0013_order_transaction_type.sql
-- Dropped scope from the original Foundation Phase design (a transaction_type column
-- was planned but never carried into 0001) — Cam's ask: "static radio button config,
-- Purchase, Refinance, Equity, and Other." Distinct from product_type (a separate,
-- more detailed taxonomy used elsewhere) — the two coexist independently.
alter table public.orders
  add column transaction_type text not null default 'Purchase'
  check (transaction_type in ('Purchase', 'Refinance', 'Equity', 'Other'));
