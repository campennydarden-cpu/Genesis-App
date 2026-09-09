-- supabase/migrations/0038_bill_codes.sql
-- Bill Codes lookup table (Fix Plan's "Navigation shell — Bill Codes" item, 2026-09-09
-- evening pass). Reference screenshots (Recording/Payoff/CDF Page 2 Section A payee tabs)
-- confirm Bill Code lives on the split/payee row, system-wide, and is a real lookup rather
-- than free text -- `SplitFields.tsx`'s shared split row already has a `bill_code` field,
-- it just needs a real backing table. Admin-editable, same pattern as
-- `checklist_task_templates` (0023_tasking.sql): a firm-wide table gated by its own
-- `profiles.can_manage_*` flag, no per-row RLS beyond "any authenticated user can read/write".

alter table public.profiles add column can_manage_bill_codes boolean not null default false;

create table public.bill_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  sort_order integer not null
);

alter table public.bill_codes enable row level security;

create policy "Authenticated M&L staff can do anything with bill_codes"
  on public.bill_codes for all to authenticated using (true) with check (true);

-- Cam's known firm-wide list (2026-09-09 evening pass, Navigation shell — Bill Codes note).
insert into public.bill_codes (code, description, sort_order) values
  ('CLOSE', 'Closing', 1),
  ('SEARCH', 'Search', 2),
  ('PREMIUMS', 'Premiums', 3),
  ('UW SPLIT', 'Underwriter Split', 4),
  ('REC', 'Recording', 5),
  ('REIMBURSE', 'Reimbursement', 6),
  ('ATTY', 'Attorney', 7);

-- Single-operator system today (one profiles row) -- grant the new admin screen the same
-- way `can_manage_folder_templates` was already granted, so Cam doesn't need a manual flip.
update public.profiles set can_manage_bill_codes = true;
