-- supabase/migrations/0049_recording_fee_tax_schedules.sql
-- Recording Fee / Transfer Tax / Recordation Tax curated rate tables (Design Notes -
-- Platform.md's "three separate rate tables" concept, deferred at 0045 in favor of manual
-- entry pending E&O-risk-governed sourcing). Seeded from 6 parallel research agents
-- (2026-09-09), each citing a primary source (state statute, DOR guidance, or county
-- Register of Deeds/Clerk fee page) -- see the vault's "Recording Fee Schedules -
-- Research (NC SC GA FL VA TN).md" for the full compiled findings and citations.
--
-- None of these 6 states vary the RECORDING fee itself by county -- all set it uniformly
-- by statute. County-level variation lives almost entirely in the taxes (NC's 7-county
-- local transfer tax, FL's Miami-Dade doc stamp rate, VA's 9 Northern Virginia grantor's-
-- tax localities), so `county` is nullable throughout: null = statewide default, a value
-- = a confirmed override for that specific county/locality. No admin-management UI exists
-- yet for these tables -- when one is built, gate it the same way bill_codes (0038) is
-- gated (a profiles.can_manage_* flag), not via RLS.

create table public.recording_fee_schedules (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  county text,
  document_type text not null,
  base_fee numeric,
  base_page_count integer,
  additional_page_fee numeric,
  filed_with text,
  notes text,
  source_url text,
  verified boolean not null default true,
  verified_date date not null default '2026-09-09',
  created_at timestamptz not null default now()
);

create table public.transfer_tax_schedules (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  county text,
  label text not null,
  flat_amount numeric,
  rate_per_unit numeric not null,
  unit_amount numeric not null,
  notes text,
  source_url text,
  verified boolean not null default true,
  verified_date date not null default '2026-09-09',
  created_at timestamptz not null default now()
);

create table public.recordation_tax_schedules (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  county text,
  label text not null,
  rate_per_unit numeric not null,
  unit_amount numeric not null,
  exemption_amount numeric,
  cap_amount numeric,
  notes text,
  source_url text,
  verified boolean not null default true,
  verified_date date not null default '2026-09-09',
  created_at timestamptz not null default now()
);

alter table public.recording_fee_schedules enable row level security;
alter table public.transfer_tax_schedules enable row level security;
alter table public.recordation_tax_schedules enable row level security;

create policy "Authenticated M&L staff can do anything with recording_fee_schedules"
  on public.recording_fee_schedules for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with transfer_tax_schedules"
  on public.transfer_tax_schedules for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with recordation_tax_schedules"
  on public.recordation_tax_schedules for all to authenticated using (true) with check (true);

-- ============================================================
-- North Carolina -- N.C.G.S. § 161-10 (recording fees, statewide uniform),
-- § 105-228.30 (excise tax, statewide uniform)
-- ============================================================
insert into public.recording_fee_schedules
  (state, document_type, base_fee, base_page_count, additional_page_fee, filed_with, notes, source_url) values
  ('NC', 'Deed', 26.00, 15, 4.00, 'Register of Deeds', 'N.C.G.S. § 161-10(a)(1)', 'https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_161/GS_161-10.pdf'),
  ('NC', 'Deed of Trust/Mortgage', 64.00, 35, 4.00, 'Register of Deeds', 'N.C.G.S. § 161-10(a)(2); +$10 surcharge per additional instrument/note secured by the same DOT', 'https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_161/GS_161-10.pdf'),
  ('NC', 'Satisfaction/Release', 0.00, null, null, 'Register of Deeds', 'No fee, N.C.G.S. § 161-10', 'https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_161/GS_161-10.pdf'),
  ('NC', 'Assignment', 26.00, 15, 4.00, 'Register of Deeds', 'Billed at general-instrument rate; no dedicated line item in statute', 'https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_161/GS_161-10.pdf'),
  ('NC', 'Power of Attorney', 26.00, 15, 4.00, 'Register of Deeds', 'Billed at general-instrument rate', 'https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_161/GS_161-10.pdf'),
  ('NC', 'Plat/Map', 21.00, 1, 21.00, 'Register of Deeds', 'Flat $21 per sheet/page', 'https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_161/GS_161-10.pdf'),
  ('NC', 'UCC Financing Statement', 38.00, 2, 2.00, 'Register of Deeds (fixture/timber/mineral filings only -- standard UCC-1s file with NC Secretary of State)', '$38 flat up to 2 pages, or $45 first 10pp + $2/add''l page', 'https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_161/GS_161-10.pdf');

insert into public.transfer_tax_schedules
  (state, county, label, rate_per_unit, unit_amount, notes, source_url) values
  ('NC', null, 'Excise Tax (Revenue Stamps)', 1.00, 500, 'Statewide, on deeds. N.C.G.S. § 105-228.30', 'https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_105/GS_105-228.30.pdf'),
  ('NC', 'Camden', 'Local Land Transfer Tax', 1.00, 100, 'Special legislative authority (1980s); rate confirmed via NCDOR Table 59, exact session-law citation not verified', 'https://www.ncdor.gov/documents/reports/table59/open'),
  ('NC', 'Chowan', 'Local Land Transfer Tax', 1.00, 100, 'Special legislative authority (1980s); rate confirmed via NCDOR Table 59, exact session-law citation not verified', 'https://www.ncdor.gov/documents/reports/table59/open'),
  ('NC', 'Currituck', 'Local Land Transfer Tax', 1.00, 100, 'Special legislative authority (1980s); rate confirmed via NCDOR Table 59, exact session-law citation not verified', 'https://www.ncdor.gov/documents/reports/table59/open'),
  ('NC', 'Dare', 'Local Land Transfer Tax', 1.00, 100, 'Special legislative authority (1980s); rate confirmed via NCDOR Table 59, exact session-law citation not verified', 'https://www.ncdor.gov/documents/reports/table59/open'),
  ('NC', 'Pasquotank', 'Local Land Transfer Tax', 1.00, 100, 'Special legislative authority (1980s); rate confirmed via NCDOR Table 59, exact session-law citation not verified', 'https://www.ncdor.gov/documents/reports/table59/open'),
  ('NC', 'Perquimans', 'Local Land Transfer Tax', 1.00, 100, 'Special legislative authority (1980s); rate confirmed via Perquimans County''s own page', 'https://www.perquimanscountync.gov/land-transfer-tax'),
  ('NC', 'Washington', 'Local Land Transfer Tax', 1.00, 100, 'Special legislative authority (1980s); rate confirmed via NCDOR Table 59, exact session-law citation not verified', 'https://www.ncdor.gov/documents/reports/table59/open');

-- ============================================================
-- South Carolina -- S.C. Code § 8-21-310 (flat statewide fees, eff. 8/1/2019),
-- § 12-24-10 et seq. (Deed Recording Fee / transfer tax)
-- ============================================================
insert into public.recording_fee_schedules
  (state, document_type, base_fee, additional_page_fee, filed_with, notes, source_url) values
  ('SC', 'Deed', 15.00, null, 'Register of Deeds (RMC in some counties)', 'Flat, any page count. S.C. Code § 8-21-310, eff. 8/1/2019', 'http://www.yorkcountysc.gov/DocumentCenter/View/4122/SC-ROD-FEE-SHEET'),
  ('SC', 'Deed of Trust/Mortgage', 25.00, null, 'Register of Deeds', 'Flat, any page count', 'http://www.yorkcountysc.gov/DocumentCenter/View/4122/SC-ROD-FEE-SHEET'),
  ('SC', 'Satisfaction/Release', 10.00, null, 'Register of Deeds', 'Flat', 'http://www.yorkcountysc.gov/DocumentCenter/View/4122/SC-ROD-FEE-SHEET'),
  ('SC', 'Assignment', 10.00, 7.00, 'Register of Deeds', 'additional_page_fee column repurposed here: +$7.00 per additional mortgage referenced (not a per-page fee)', 'http://www.yorkcountysc.gov/DocumentCenter/View/4122/SC-ROD-FEE-SHEET'),
  ('SC', 'Power of Attorney', 25.00, null, 'Register of Deeds', 'No charge when military combat-zone deployment orders are shown', 'http://www.yorkcountysc.gov/DocumentCenter/View/4122/SC-ROD-FEE-SHEET'),
  ('SC', 'Plat/Map', 25.00, null, 'Register of Deeds', 'Flat, any size', 'http://www.yorkcountysc.gov/DocumentCenter/View/4122/SC-ROD-FEE-SHEET'),
  ('SC', 'UCC Financing Statement', 25.00, null, 'Register of Deeds (real-estate/fixture filings only -- standard UCC-1s file with SC Secretary of State)', 'Flat', 'https://sos.sc.gov/faqs-about-ucc');

insert into public.transfer_tax_schedules
  (state, label, rate_per_unit, unit_amount, notes, source_url) values
  ('SC', 'Deed Recording Fee', 1.85, 500, '= $1.30 state + $0.55 county portions, uniform statewide, no local add-on found. S.C. Code § 12-24-10 et seq.', 'https://dor.sc.gov/tax-index/deed-recording-fee');

-- ============================================================
-- Georgia -- O.C.G.A. § 15-6-77 as amended by HB 288 (flat statewide fees, eff. 1/1/2020),
-- § 48-6-61 (Intangible Recording Tax), § 48-6-1 (Real Estate Transfer Tax)
-- ============================================================
insert into public.recording_fee_schedules
  (state, document_type, base_fee, additional_page_fee, filed_with, notes, source_url, verified) values
  ('GA', 'Deed', 25.00, null, 'Clerk of Superior Court', 'Flat, any page count, eff. 1/1/2020 (HB 288). Possible additional $2/instrument Fulton County surcharge reported by one unconfirmed secondary source -- not applied here, verify directly with Fulton Clerk or GSCCCA before use.', 'https://www.gsccca.org', true),
  ('GA', 'Security Deed/Deed to Secure Debt', 25.00, null, 'Clerk of Superior Court', 'Flat, any page count, eff. 1/1/2020 (HB 288)', 'https://www.gsccca.org', true),
  ('GA', 'Satisfaction/Release (endorsed on original)', 10.00, null, 'Clerk of Superior Court', 'Flat', 'https://www.gsccca.org', true),
  ('GA', 'Satisfaction/Release (separate document)', 25.00, 2.00, 'Clerk of Superior Court', '+$2.00 per cross-reference entry', 'https://www.gsccca.org', true),
  ('GA', 'Assignment', 25.00, 2.00, 'Clerk of Superior Court', '+$2.00 per cross-reference entry', 'https://www.gsccca.org', true),
  ('GA', 'Power of Attorney', null, null, 'Clerk of Superior Court', 'No dedicated fee found post-HB288 (2020) restructuring -- needs confirmation directly with GSCCCA or a Clerk of Superior Court before use.', null, false),
  ('GA', 'Plat/Survey/Condo Floor Plan', 10.00, 10.00, 'Clerk of Superior Court', 'Per page, not flattened by HB 288', 'https://www.gsccca.org', true),
  ('GA', 'UCC Financing Statement', 25.00, 2.00, 'Clerk of Superior Court, centrally indexed via GSCCCA', '+$2.00 per cross-reference entry', 'https://www.gsccca.org', true);

insert into public.transfer_tax_schedules
  (state, label, flat_amount, rate_per_unit, unit_amount, notes, source_url) values
  ('GA', 'Real Estate Transfer Tax', 1.00, 0.10, 100, '$1.00 flat covers the first $1,000 of consideration; $0.10 per additional $100 above that. O.C.G.A. § 48-6-1', 'https://dor.georgia.gov');

insert into public.recordation_tax_schedules
  (state, label, rate_per_unit, unit_amount, cap_amount, notes, source_url) values
  ('GA', 'Intangible Recording Tax', 1.50, 500, 25000.00, 'O.C.G.A. § 48-6-61. Only applies to notes secured by GA real property maturing more than 62 months (raised from 36mo by HB 586, eff. 7/1/2025) -- shorter-term notes are exempt from this tax entirely, not modeled as an exemption_amount.', 'https://dor.georgia.gov');

-- ============================================================
-- Florida -- Fla. Stat. § 28.24 (statewide uniform recording fees),
-- § 201.02/201.031 (doc stamp tax on deeds), § 201.08 (doc stamp on notes/mortgages),
-- § 199.133 (nonrecurring intangible tax)
-- ============================================================
insert into public.recording_fee_schedules
  (state, document_type, base_fee, base_page_count, additional_page_fee, filed_with, notes, source_url, verified) values
  ('FL', 'Deed/General Instrument', 10.00, 1, 8.50, 'Clerk of Court', 'Fla. Stat. § 28.24(12)-(13); +$1.00 per name indexed beyond the first 4', 'https://www.sarasotaclerk.com/Records/Recording-Services/Recording-Requirements/Recording-Fees-and-Taxes-Required', true),
  ('FL', 'Mortgage', 10.00, 1, 8.50, 'Clerk of Court', 'Same general-instrument schedule as deeds -- FL has no separate mortgage fee line', 'https://www.sarasotaclerk.com/Records/Recording-Services/Recording-Requirements/Recording-Fees-and-Taxes-Required', true),
  ('FL', 'Satisfaction/Release', 10.00, 1, 8.50, 'Clerk of Court', 'General-instrument schedule', 'https://www.sarasotaclerk.com/Records/Recording-Services/Recording-Requirements/Recording-Fees-and-Taxes-Required', true),
  ('FL', 'Assignment', 10.00, 1, 8.50, 'Clerk of Court', 'General-instrument schedule', 'https://www.sarasotaclerk.com/Records/Recording-Services/Recording-Requirements/Recording-Fees-and-Taxes-Required', true),
  ('FL', 'Power of Attorney', 10.00, 1, 8.50, 'Clerk of Court', 'General-instrument schedule', 'https://www.sarasotaclerk.com/Records/Recording-Services/Recording-Requirements/Recording-Fees-and-Taxes-Required', true),
  ('FL', 'Plat/Map', 30.00, 1, 15.00, 'Clerk of Court', 'Fla. Stat. § 177 -- distinct, higher schedule than ordinary instruments', 'https://www.sarasotaclerk.com/Records/Recording-Services/Recording-Requirements/Recording-Fees-and-Taxes-Required', true),
  ('FL', 'UCC Financing Statement', 20.00, null, null, 'FL Secured Transaction Registry / Dept. of State (NOT the county Clerk)', 'Range $20-25 found across secondary sources; exact current fee could not be confirmed against the live floridaucc.com/fees page (JS-rendered) -- verify before use.', 'https://dos.fl.gov/sunbiz/other-services/ucc-information/', false);

insert into public.transfer_tax_schedules
  (state, county, label, rate_per_unit, unit_amount, notes, source_url) values
  ('FL', null, 'Documentary Stamp Tax on Deeds', 0.70, 100, 'Statewide default. Fla. Stat. § 201.02(1)(a)', 'https://floridarevenue.com/Forms_library/current/gt800014.pdf'),
  ('FL', 'Miami-Dade', 'Documentary Stamp Tax on Deeds', 0.60, 100, 'Single-family-residence rate. Non-single-family transfers also carry a 0.45% surtax under § 201.031, not modeled as a separate row here.', 'https://floridarevenue.com/Forms_library/current/gt800014.pdf');

insert into public.recordation_tax_schedules
  (state, label, rate_per_unit, unit_amount, notes, source_url) values
  ('FL', 'Documentary Stamp Tax on Notes/Mortgages', 0.35, 100, 'Fla. Stat. § 201.08. The $2,450 cap applies only to unsecured notes, not mortgages -- do not cap mortgage doc stamps.', 'https://floridarevenue.com/Forms_library/current/gt800014.pdf'),
  ('FL', 'Nonrecurring Intangible Tax', 0.20, 100, '= 0.2% of the amount secured. Fla. Stat. § 199.133. Separate from and in addition to the doc stamp tax above -- both are due on the same mortgage, do not net them together.', 'https://floridarevenue.com/Forms_library/current/gt800014.pdf');

-- ============================================================
-- Virginia -- Va. Code § 17.1-275 (Circuit Court Clerk's fee, flat tier by page count,
-- NOT first-page/additional-page), § 58.1-801/803 (state recordation tax),
-- § 58.1-814 (local recordation tax), § 58.1-802/802.3/802.4 (grantor's tax + NoVA add-ons)
-- ============================================================
insert into public.recording_fee_schedules
  (state, document_type, base_fee, base_page_count, filed_with, notes, source_url) values
  ('VA', 'Any Instrument (Deed, DOT, Release, Assignment, POA -- ≤10 pages)', 18.00, 10, 'Circuit Court Clerk', 'Va. Code § 17.1-275. VA bills a flat tiered fee by page count for every instrument type, not a per-type schedule. +$8.00 Technology Trust Fund fee (§17.1-279, raised from $5 eff. 7/1/2026) applies on top of this for every instrument.', 'https://law.lis.virginia.gov/vacode/title17.1/chapter2/section17.1-275/'),
  ('VA', 'Any Instrument (11-30 pages)', 32.00, 30, 'Circuit Court Clerk', 'Va. Code § 17.1-275; +$8.00 Technology Trust Fund fee applies on top', 'https://law.lis.virginia.gov/vacode/title17.1/chapter2/section17.1-275/'),
  ('VA', 'Any Instrument (31+ pages)', 52.00, null, 'Circuit Court Clerk', 'Va. Code § 17.1-275; +$8.00 Technology Trust Fund fee applies on top', 'https://law.lis.virginia.gov/vacode/title17.1/chapter2/section17.1-275/'),
  ('VA', 'Plat/Map (oversized sheet, >8.5x14in)', 17.00, null, 'Circuit Court Clerk', 'Per sheet, added on top of the instrument fee above', 'https://law.lis.virginia.gov/vacode/title17.1/chapter2/section17.1-275/'),
  ('VA', 'UCC Financing Statement', 20.00, null, 'VA State Corporation Commission (NOT the Circuit Court Clerk)', null, 'https://www.scc.virginia.gov/businesses/ucc/ucc-forms-fees/');

insert into public.transfer_tax_schedules
  (state, county, label, rate_per_unit, unit_amount, notes, source_url) values
  ('VA', null, 'State Recordation Tax - Deed', 0.25, 100, 'Va. Code § 58.1-801; applies to the greater of consideration or assessed value', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-801/'),
  ('VA', null, 'Local Recordation Tax (on Deed)', 0.0833, 100, 'Up to 1/3 of the state rate under § 58.1-814; near-universally adopted statewide (no locality confirmed to exceed it, though not every one of 133 localities was individually checked). A "Fairfax County doubles this rate" claim circulates online but could not be confirmed against the statute or a live fee sheet -- treat as likely incorrect until verified directly with the Fairfax Circuit Court Clerk.', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-814/'),
  ('VA', null, 'Grantor''s Tax', 0.10, 100, '= $0.50 per $500, split 50/50 state/locality. Va. Code § 58.1-802', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-802/'),
  ('VA', 'Alexandria', 'NoVA Regional Grantor''s Tax Surcharge (WMATA + Congestion Relief)', 0.20, 100, '= $0.10/100 WMATA fee (§58.1-802.3) + $0.10/100 congestion-relief fee (§58.1-802.4), on top of the base Grantor''s Tax row above', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-802.3/'),
  ('VA', 'Arlington', 'NoVA Regional Grantor''s Tax Surcharge (WMATA + Congestion Relief)', 0.20, 100, 'Same as above', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-802.3/'),
  ('VA', 'Fairfax City', 'NoVA Regional Grantor''s Tax Surcharge (WMATA + Congestion Relief)', 0.20, 100, 'Same as above', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-802.3/'),
  ('VA', 'Fairfax County', 'NoVA Regional Grantor''s Tax Surcharge (WMATA + Congestion Relief)', 0.20, 100, 'Same as above', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-802.3/'),
  ('VA', 'Falls Church', 'NoVA Regional Grantor''s Tax Surcharge (WMATA + Congestion Relief)', 0.20, 100, 'Same as above', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-802.3/'),
  ('VA', 'Loudoun', 'NoVA Regional Grantor''s Tax Surcharge (WMATA + Congestion Relief)', 0.20, 100, 'Same as above', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-802.3/'),
  ('VA', 'Manassas', 'NoVA Regional Grantor''s Tax Surcharge (WMATA + Congestion Relief)', 0.20, 100, 'Same as above', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-802.3/'),
  ('VA', 'Manassas Park', 'NoVA Regional Grantor''s Tax Surcharge (WMATA + Congestion Relief)', 0.20, 100, 'Same as above', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-802.3/'),
  ('VA', 'Prince William', 'NoVA Regional Grantor''s Tax Surcharge (WMATA + Congestion Relief)', 0.20, 100, 'Same as above', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-802.3/');

insert into public.recordation_tax_schedules
  (state, label, rate_per_unit, unit_amount, notes, source_url) values
  ('VA', 'State Recordation Tax - Deed of Trust/Mortgage', 0.25, 100, 'Va. Code § 58.1-803. Tiers down for very large loans (0.22/100 next $10M, 0.19/100 next $10M, 0.16/100 next $10M, 0.13/100 above $40M) and reduced rates apply to refinance DOTs under §58.1-803(E) -- neither tiering is modeled here, both are rare in residential closings.', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-803/'),
  ('VA', 'Local Recordation Tax (on DOT)', 0.0833, 100, 'Same 1/3-of-state-rate local tax as on deeds (§ 58.1-814), applied separately to deeds of trust', 'https://law.lis.virginia.gov/vacode/title58.1/chapter8/section58.1-814/');

-- ============================================================
-- Tennessee -- T.C.A. § 8-21-1001 (statewide uniform recording fees + $2 data-processing
-- fee), § 67-4-409 (realty transfer tax on deeds + recordation/"mortgage" tax on DOTs)
-- ============================================================
insert into public.recording_fee_schedules
  (state, document_type, base_fee, base_page_count, additional_page_fee, filed_with, notes, source_url) values
  ('TN', 'Deed', 12.00, 2, 5.00, 'Register of Deeds', '$10 base (T.C.A. § 8-21-1001) + $2 statewide data-processing fee, shown combined; covers first 1-2 pages', 'https://www.ctas.tennessee.edu/eli/proper-fees-recording-or-filing'),
  ('TN', 'Deed of Trust/Mortgage', 12.00, 2, 5.00, 'Register of Deeds', 'Same combined $10+$2 base as deeds', 'https://www.ctas.tennessee.edu/eli/proper-fees-recording-or-filing'),
  ('TN', 'Satisfaction/Release', 12.00, 2, 5.00, 'Register of Deeds', '+$5.00 per additional lien referenced', 'https://www.ctas.tennessee.edu/eli/proper-fees-recording-or-filing'),
  ('TN', 'Assignment', 12.00, 2, 5.00, 'Register of Deeds', '+$5.00 per additional instrument referenced', 'https://www.ctas.tennessee.edu/eli/proper-fees-recording-or-filing'),
  ('TN', 'Power of Attorney', 12.00, 2, 5.00, 'Register of Deeds', 'Billed at general document rate -- no dedicated line item found', 'https://www.ctas.tennessee.edu/eli/proper-fees-recording-or-filing'),
  ('TN', 'Plat/Map', 15.00, null, null, 'Register of Deeds', 'Flat per plat/document, not per lot. Shelby Co. quotes $15; Knox Co. quotes $17 for the same document (incl. the $2 DP fee already itemized separately elsewhere in this table -- treat as presentation difference, not a real rate conflict)', 'https://register.shelby.tn.us/filing-guidelines'),
  ('TN', 'UCC Financing Statement', 13.00, 10, 0.50, 'Register of Deeds (fixture/timber/mineral filings only -- general-collateral UCCs file with TN Secretary of State, ~$15)', '+$15.00 per additional debtor', 'https://www.ctas.tennessee.edu/new-ucc-law-and-new-fee-schedule-pdf');

insert into public.transfer_tax_schedules
  (state, label, rate_per_unit, unit_amount, notes, source_url) values
  ('TN', 'Realty Transfer Tax', 0.37, 100, 'T.C.A. § 67-4-409. Applies to deeds only, not deeds of trust.', 'https://www.ctas.tennessee.edu/eli/transfer-tax');

insert into public.recordation_tax_schedules
  (state, label, rate_per_unit, unit_amount, exemption_amount, notes, source_url) values
  ('TN', 'Recordation/Mortgage Tax', 0.115, 100, 2000.00, 'T.C.A. § 67-4-409, commonly called "mortgage tax." First $2,000 of indebtedness is exempt.', 'https://www.ctas.tennessee.edu/eli/mortgage-tax');
