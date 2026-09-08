-- supabase/migrations/0022_commitment_sch_b_sort_order.sql
-- Per Cam's note: Schedule B-I/B-II requirements and exceptions need manual reordering.
-- Ordering today is implicit (created_at, no way to reorder) — add an explicit
-- sort_order column to each table, backfilled from current created_at order.

alter table public.commitment_requirements add column sort_order integer;
alter table public.commitment_exceptions add column sort_order integer;

with numbered as (
  select id, row_number() over (partition by order_id order by created_at) - 1 as rn
  from public.commitment_requirements
)
update public.commitment_requirements cr
set sort_order = numbered.rn
from numbered
where cr.id = numbered.id;

with numbered as (
  select id, row_number() over (partition by order_id order by created_at) - 1 as rn
  from public.commitment_exceptions
)
update public.commitment_exceptions ce
set sort_order = numbered.rn
from numbered
where ce.id = numbered.id;

alter table public.commitment_requirements alter column sort_order set not null;
alter table public.commitment_exceptions alter column sort_order set not null;
