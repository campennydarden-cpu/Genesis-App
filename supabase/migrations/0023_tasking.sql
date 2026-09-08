-- supabase/migrations/0023_tasking.sql
-- Requested Tasks + Checklist Tasks (Design Notes.md's prototype-shipped "manual log"
-- toolbar tabs, spec detail in Design Notes - Curative & Tasking.md). Checklist Tasks
-- follows the same firm-wide-template-copied-per-order pattern as Attachments'
-- folder_templates/attachment_folders (Cam's call, 2026-09-08: auto-populate on order
-- creation, template admin-manageable). Requested Tasks stays a flat per-order log with
-- UI-level seed chips, not template-backed — it was never designed as admin-configurable,
-- unlike Checklist Tasks. The full Task Library + Automation/Rule-Definition builder in
-- Design Notes - Platform.md (due-date formulas, trigger-condition-action rules) is a
-- separate, unbuilt future system — this migration is the flat data model only.

alter table public.profiles add column can_manage_checklist_templates boolean not null default false;

create table public.checklist_task_templates (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  milestone text not null,
  sort_order integer not null
);

alter table public.checklist_task_templates enable row level security;

create policy "Authenticated M&L staff can do anything with checklist_task_templates"
  on public.checklist_task_templates for all to authenticated using (true) with check (true);

create table public.checklist_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  template_id uuid references public.checklist_task_templates(id) on delete set null,
  description text not null,
  milestone text not null,
  due_date date,
  status text not null default 'Required' check (status in ('Required', 'Completed', 'N/A')),
  completed_date date,
  sort_order integer not null
);

create index checklist_tasks_order_id_idx on public.checklist_tasks(order_id);

alter table public.checklist_tasks enable row level security;

create policy "Authenticated M&L staff can do anything with checklist_tasks"
  on public.checklist_tasks for all to authenticated using (true) with check (true);

create table public.requested_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  task_name text not null,
  requested_date date,
  requested_due_date date,
  due_date date,
  received_date date,
  notes text,
  status text not null default 'Required' check (status in ('Required', 'Requested', 'Received', 'N/A')),
  sort_order integer not null
);

create index requested_tasks_order_id_idx on public.requested_tasks(order_id);

alter table public.requested_tasks enable row level security;

create policy "Authenticated M&L staff can do anything with requested_tasks"
  on public.requested_tasks for all to authenticated using (true) with check (true);

-- Seed the firm-wide Checklist Task list (Design Notes - Curative & Tasking.md's
-- "TASKING" section), milestone labels normalized to Design Notes.md's canonical
-- ordered Milestone list (e.g. "Searching" -> "Search", "Post-Closing" -> "Post Closing",
-- "Policy" -> "Policy and Remittance" — the two docs used slightly different labels
-- for the same 9 milestones).
insert into public.checklist_task_templates (description, milestone, sort_order) values
  ('New Order/Enter Order', 'Order Entry', 1),
  ('Compile and Upload Search Package', 'Search', 2),
  ('Type Commitment', 'Typing and Exam', 3),
  ('Examine Title', 'Typing and Exam', 4),
  ('Deliver Title Package', 'Typing and Exam', 5),
  ('Initial Curative Review', 'Curative', 6),
  ('Curative Follow Up', 'Curative', 7),
  ('Clear to Close', 'Curative', 8),
  ('Scheduling Request Received', 'Closing', 9),
  ('Review Date Down', 'Closing', 10),
  ('Receive Closing Instructions', 'Closing', 11),
  ('Balance CD', 'Closing', 12),
  ('Release Docs to Notary', 'Closing', 13),
  ('Confirmed Closed', 'Closing', 14),
  ('Wrap Executed Package', 'Post Closing', 15),
  ('Submit for Funding Authorization', 'Post Closing', 16),
  ('Receive Funding Authorization', 'Post Closing', 17),
  ('Fund', 'Funding', 18),
  ('Disburse', 'Funding', 19),
  ('Submit for Recording', 'Recording', 20),
  ('Receive Recorded Docs', 'Recording', 21),
  ('Pull Jacket and Type Policy', 'Policy and Remittance', 22),
  ('Issue Final Policy', 'Policy and Remittance', 23),
  ('Remit', 'Policy and Remittance', 24),
  ('Finalize Disbursement Ledger', 'Policy and Remittance', 25);
