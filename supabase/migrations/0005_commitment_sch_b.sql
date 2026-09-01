-- supabase/migrations/0005_commitment_sch_b.sql
create table public.commitment_requirements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  description text not null,
  notes text,
  source_type text check (source_type in ('si', 'rel', 'lien')),
  source_id uuid,
  parent_requirement_id uuid references public.commitment_requirements(id) on delete cascade,
  disposition text,
  disposition_notes text,
  dont_show boolean not null default false,
  created_at timestamptz not null default now()
);

create index commitment_requirements_order_id_idx on public.commitment_requirements(order_id);

create table public.commitment_exceptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  description text not null,
  notes text,
  source_type text check (source_type in ('em')),
  source_id uuid,
  disposition text,
  disposition_notes text,
  dont_show boolean not null default false,
  created_at timestamptz not null default now()
);

create index commitment_exceptions_order_id_idx on public.commitment_exceptions(order_id);

create table public.commitment_sch_b_settings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  begin_requirements_at integer,
  begin_exceptions_at integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commitment_requirements enable row level security;
alter table public.commitment_exceptions enable row level security;
alter table public.commitment_sch_b_settings enable row level security;

create policy "Authenticated M&L staff can do anything with commitment_requirements"
  on public.commitment_requirements for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with commitment_exceptions"
  on public.commitment_exceptions for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with commitment_sch_b_settings"
  on public.commitment_sch_b_settings for all to authenticated using (true) with check (true);
