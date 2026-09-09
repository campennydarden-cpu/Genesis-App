-- Settlement Type & Options: combined per Cam's request into a single page/table.
-- Mirrors the ALTA Settlement Statement variant, place-of-settlement address,
-- per-CDF-page administrative data, and seller-credit election from the SoftPro
-- "Options" screen. The print/sort/logo toggles and sales-tax sub-config on that
-- screen exist to drive SoftPro's own computation+print engine, which this app
-- doesn't have, so they're dropped (same manual-entry-shell carve-out as every
-- other CDF page this session).

create table settlement_options (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade unique,
  settlement_type text,
  place_of_settlement_address text,
  admin_data_cdf1 text,
  admin_data_cdf2 text,
  admin_data_cdf3 text,
  admin_data_cdf4 text,
  admin_data_cdf5 text,
  seller_credit_method text,
  created_at timestamptz not null default now()
);

alter table settlement_options enable row level security;

create policy "authenticated_all_settlement_options" on settlement_options
  for all to authenticated using (true) with check (true);
