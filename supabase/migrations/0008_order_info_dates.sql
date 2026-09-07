-- supabase/migrations/0008_order_info_dates.sql
-- Set by application logic the first time title_status/escrow_status moves off its default,
-- not entered directly by the user.
alter table public.orders
  add column title_opened_date timestamptz,
  add column escrow_opened_date timestamptz;
