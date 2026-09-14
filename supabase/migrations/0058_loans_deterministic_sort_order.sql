-- 0058_loans_deterministic_sort_order.sql
-- Fix wave 1, Fix 1 (Critical): addLoan derived sort_order from a `count` of
-- existing loans, so a delete-then-add could re-collide with a live loan's
-- sort_order and make "the primary loan" (lowest sort_order) nondeterministic.
-- created_at gives a stable tiebreaker sort; the unique index turns a future
-- collision into a loud insert failure instead of silent primary-loan drift.

alter table public.loans add column created_at timestamptz not null default now();
create index loans_order_id_idx on public.loans(order_id);
create unique index loans_order_id_sort_order_key on public.loans(order_id, sort_order);
