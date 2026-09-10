-- supabase/migrations/0053_entity_directory.sql
-- Entity Directory Phase 1 (Entity Directory - Implementation Readiness.md, Cam
-- answered 2026-09-10). Corrects the 8/29 plan's drift: profiles already exists
-- (0018_profiles_permissions.sql), so this alters it rather than recreating it, and
-- the role_type list here matches the app's real CONTACT_ROLES (src/lib/constants.ts)
-- minus Buyer/Borrower and Seller -- those are transaction parties, not reusable firm
-- vendors, so they never belong in a firm-wide directory (flagged to Cam, not yet
-- explicitly confirmed).

create extension if not exists pg_trgm;

alter table public.profiles
  add column can_manage_lookup_data boolean not null default false;

-- Per-role-type Lookup Code counters (avoids 10 named Postgres sequences).
create table public.entity_directory_code_sequences (
  role_type text primary key,
  next_value integer not null default 1
);

create or replace function public.generate_entity_lookup_code(p_role_type text, p_prefix text)
returns text
language plpgsql
as $$
declare
  v_next integer;
begin
  insert into public.entity_directory_code_sequences (role_type, next_value)
  values (p_role_type, 2)
  on conflict (role_type) do update
    set next_value = entity_directory_code_sequences.next_value + 1
  returning next_value - 1 into v_next;

  return p_prefix || '-' || lpad(v_next::text, 4, '0');
end;
$$;

create table public.entity_directory (
  id uuid primary key default gen_random_uuid(),
  lookup_code text unique,
  role_type text not null check (role_type in (
    'Lender', 'Mortgage Broker', 'Underwriter', 'Settlement Agent', 'Title Company',
    'Listing Agent (Seller''s Agent)', 'Selling Agent (Buyer''s Agent)',
    'Recording Office', 'Tax Collector', 'Payoff Lender'
  )),
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  county text,
  phone text,
  fax text,
  email text,
  license_number text,
  details jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create or replace function public.set_entity_directory_lookup_code()
returns trigger
language plpgsql
as $$
declare
  v_prefix text;
begin
  if new.lookup_code is not null then
    return new;
  end if;

  v_prefix := case new.role_type
    when 'Lender' then 'LEN'
    when 'Mortgage Broker' then 'MB'
    when 'Underwriter' then 'UW'
    when 'Settlement Agent' then 'SET'
    when 'Title Company' then 'TC'
    when 'Listing Agent (Seller''s Agent)' then 'LST'
    when 'Selling Agent (Buyer''s Agent)' then 'SEL'
    when 'Recording Office' then 'REC'
    when 'Tax Collector' then 'TAX'
    when 'Payoff Lender' then 'PL'
  end;

  new.lookup_code := public.generate_entity_lookup_code(new.role_type, v_prefix);
  return new;
end;
$$;

create trigger entity_directory_set_lookup_code
  before insert on public.entity_directory
  for each row
  execute function public.set_entity_directory_lookup_code();

create index entity_directory_name_trgm_idx
  on public.entity_directory using gin (name gin_trgm_ops);
create index entity_directory_role_type_idx
  on public.entity_directory (role_type);
create index entity_directory_active_idx
  on public.entity_directory (is_active) where is_active = true;

-- Cam's "Local VIP Client Management" group (2026-09-10) gets a nested people roster;
-- the rest don't.
create table public.entity_directory_people (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entity_directory(id) on delete cascade,
  first_name text not null,
  last_name text,
  title text,
  email text,
  phone text,
  ext text,
  cell text,
  created_at timestamptz not null default now()
);

create index entity_directory_people_entity_id_idx
  on public.entity_directory_people(entity_id);

-- Search: always server-filtered by role_type, ranked by trigram similarity. Never
-- called without a role_type -- the picker never lists "all entities."
create or replace function public.search_entity_directory(p_role_type text, p_query text, p_limit integer default 10)
returns setof public.entity_directory
language sql
stable
as $$
  select *
  from public.entity_directory
  where role_type = p_role_type
    and is_active = true
    and name % p_query
  order by similarity(name, p_query) desc
  limit p_limit;
$$;

-- Dedup check used by "Save and Add New" (CSV row-insert reuse deferred to Phase 2).
create or replace function public.find_entity_directory_duplicates(p_role_type text, p_name text, p_threshold real default 0.45)
returns setof public.entity_directory
language sql
stable
as $$
  select *
  from public.entity_directory
  where role_type = p_role_type
    and is_active = true
    and similarity(name, p_name) >= p_threshold
  order by similarity(name, p_name) desc
  limit 5;
$$;

alter table public.entity_directory enable row level security;
alter table public.entity_directory_people enable row level security;

create policy "Authenticated M&L staff can view entity_directory"
  on public.entity_directory
  for select
  to authenticated
  using (true);

create policy "Authenticated M&L staff can insert entity_directory"
  on public.entity_directory
  for insert
  to authenticated
  with check (true);

-- Any authenticated user can edit a record, but only a user with
-- can_manage_lookup_data can flip is_active to false. No self-service grant path
-- exists yet -- same precedent as can_manage_folder_templates (0018).
create policy "Authenticated M&L staff can update entity_directory, deactivation gated"
  on public.entity_directory
  for update
  to authenticated
  using (true)
  with check (
    is_active = true
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and can_manage_lookup_data = true
    )
  );

create policy "Only permitted users can delete entity_directory"
  on public.entity_directory
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and can_manage_lookup_data = true
    )
  );

create policy "Authenticated M&L staff can do anything with entity_directory_people"
  on public.entity_directory_people
  for all
  to authenticated
  using (true)
  with check (true);
