-- supabase/migrations/0010_order_info_functional_roles.sql
-- Free-text name per functional role, per Genesis Screen Notes - Fix Plan's 2026-09-01
-- decision: merged role list (Abstractor auto-assigned elsewhere, not here; +Post-Closer;
-- Recorder renamed Recording Specialist). Free text, not a picker, since no active-user
-- roster exists yet (also decided 9/1 — deferred as its own future scope).
alter table public.orders
  add column title_officer text,
  add column curative_title_officer text,
  add column escrow_assistant text,
  add column escrow_officer text,
  add column closing_coordinator text,
  add column funder text,
  add column recording_specialist text,
  add column post_closer text;
