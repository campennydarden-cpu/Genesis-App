create table public.requirement_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'Mortgage', 'Judgment', 'Lien', 'HOA', 'Tax',
    'Entity-Confirmation', 'Related-Document-Release', 'General'
  )),
  label text not null,
  body text not null,
  trigger_source_type text check (trigger_source_type in ('si', 'rel', 'lien')),
  parent_template_id uuid references public.requirement_templates(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.requirement_template_variants (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.requirement_templates(id) on delete cascade,
  state text,
  body text not null,
  created_at timestamptz not null default now(),
  unique (template_id, state)
);

create table public.exception_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'Mortgage', 'Judgment', 'Lien', 'HOA', 'Tax',
    'Entity-Confirmation', 'Related-Document-Release', 'General'
  )),
  label text not null,
  body text not null,
  trigger_source_type text check (trigger_source_type in ('em', 'easement')),
  parent_template_id uuid references public.exception_templates(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exception_template_variants (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.exception_templates(id) on delete cascade,
  state text,
  body text not null,
  created_at timestamptz not null default now(),
  unique (template_id, state)
);

create index requirement_templates_category_idx on public.requirement_templates(category);
create index requirement_templates_trigger_idx on public.requirement_templates(trigger_source_type);
create index requirement_template_variants_template_id_idx on public.requirement_template_variants(template_id);
create index exception_templates_category_idx on public.exception_templates(category);
create index exception_templates_trigger_idx on public.exception_templates(trigger_source_type);
create index exception_template_variants_template_id_idx on public.exception_template_variants(template_id);

alter table public.requirement_templates enable row level security;
alter table public.requirement_template_variants enable row level security;
alter table public.exception_templates enable row level security;
alter table public.exception_template_variants enable row level security;

create policy "Authenticated M&L staff can do anything with requirement_templates"
  on public.requirement_templates for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with requirement_template_variants"
  on public.requirement_template_variants for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with exception_templates"
  on public.exception_templates for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with exception_template_variants"
  on public.exception_template_variants for all to authenticated using (true) with check (true);
