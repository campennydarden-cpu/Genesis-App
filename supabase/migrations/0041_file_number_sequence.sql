-- The count-based file_number generation in createOrder() had a documented race/gap
-- window (see the `ponytail:` comment it carried in src/app/actions/orders.ts): once
-- any deleted order left a gap in the "2026-NNNN" sequence, count(*)+1 permanently
-- collided with an existing higher file_number, since a delete lowers the count but
-- not the max. This replaces it with an atomic per-year counter table + upsert
-- function, which Postgres guarantees is race-free under concurrent callers.
create table file_number_counters (
  year int primary key,
  last_number int not null
);

-- Seed 2026 at the current real max (2026-0029) so the next allocation starts at
-- 0030, safely past the existing gap at 0026 rather than colliding with it.
insert into file_number_counters (year, last_number) values (2026, 29);

alter table file_number_counters enable row level security;

create policy "authenticated_all_file_number_counters" on file_number_counters
  for all to authenticated using (true) with check (true);

create or replace function next_file_number(p_year int)
returns text
language sql
as $$
  insert into file_number_counters (year, last_number)
  values (p_year, 1)
  on conflict (year) do update set last_number = file_number_counters.last_number + 1
  returning p_year || '-' || lpad(last_number::text, 4, '0');
$$;
