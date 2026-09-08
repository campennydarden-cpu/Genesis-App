-- supabase/migrations/0021_prelim_search_real_estate_taxes.sql
-- Per Cam's note: the old flat "paid through year / now due / not yet due" text
-- fields weren't functional. Replace with two structured records — a last-paid-bill
-- and a next-due-bill — per Cam's exact spec.

alter table public.prelim_search
  drop column taxes_paid_through_year,
  drop column taxes_now_due,
  drop column taxes_not_yet_due,
  add column tax_last_paid_year text,
  add column tax_last_paid_installment_count integer,
  add column tax_last_paid_installment_amount numeric,
  add column tax_last_paid_due_date date,
  add column tax_next_due_year text,
  add column tax_next_due_installment_number integer,
  add column tax_next_due_installment_count integer,
  add column tax_next_due_amount numeric,
  add column tax_next_due_due_date date;
