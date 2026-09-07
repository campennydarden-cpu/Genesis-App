-- supabase/migrations/0007_order_entry_settlement_rush.sql
alter table public.orders
  add column settlement_date date,
  add column settlement_time time,
  add column rush_order boolean not null default false;
