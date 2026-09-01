-- supabase/migrations/0006_curative.sql
create table public.curative_settings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  commitment_status text not null default 'draft' check (commitment_status in ('draft', 'final')),
  finalized_at timestamptz,
  ctc_issued_at timestamptz,
  ctc_rescinded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.curative_settings enable row level security;

create policy "Authenticated M&L staff can do anything with curative_settings"
  on public.curative_settings for all to authenticated using (true) with check (true);
