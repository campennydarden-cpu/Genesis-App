create table public.orders (
  id uuid primary key default gen_random_uuid(),
  file_number text not null unique,
  product_type text not null default 'Purchase' check (product_type in (
    'Purchase', 'Refinance', 'HELOC', 'HELOAN', 'Reverse Mortgage (Refi)',
    'Cash Purchase', 'Reverse Mortgage (Purchase)', 'Tract Search'
  )),
  policy_type text not null default 'None' check (policy_type in (
    'None', 'Owner''s', 'Loan', 'Simultaneous'
  )),
  purchase_price numeric(14,2),
  loan_amount numeric(14,2),
  property_address text,
  parcel_number text,
  property_city text,
  property_county text,
  property_state text,
  property_zip text,
  order_status text not null default 'In Progress' check (order_status in (
    'In Progress', 'Canceled', 'Retain', 'Hold', 'Completed', 'Duplicate'
  )),
  title_status text not null default 'In Progress' check (title_status in (
    'In Progress', 'Searching', 'Exam', 'Curative', 'Cleared for Policy',
    'Policy Issued', 'Policy Remitted', 'Hold - Title Only'
  )),
  escrow_status text not null default 'In Progress' check (escrow_status in (
    'In Progress', 'Balancing', 'Docs Out', 'Canceled', 'Closed'
  )),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  role text not null,
  entity_type text not null default 'Individual' check (entity_type in (
    'Individual', 'LLC', 'Corporation', 'Partnership', 'Trust', 'Estate'
  )),
  name text not null,
  current_address text,
  mailing_address text,
  forwarding_address text,
  phone text,
  email text,
  ssn text,
  dob date,
  license_number text,
  alta_id text,
  mortgagee_clause text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_order_id_idx on public.contacts(order_id);

alter table public.orders enable row level security;
alter table public.contacts enable row level security;

create policy "Authenticated M&L staff can do anything with orders"
  on public.orders
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated M&L staff can do anything with contacts"
  on public.contacts
  for all
  to authenticated
  using (true)
  with check (true);
