-- supabase/migrations/0051_recording_tax_fields.sql
-- Recording — "combine into line 1 of Section E" (Cam, 2026-09-10): Recording Fees,
-- Recordation Tax, Transfer Tax, and Stamp Tax are now distinct per-document fields
-- (only a generic `fee` existed before), and their totals across every document on
-- the order auto-sum into 3 fixed CDF Page 2 Section E lines — see syncRecordingCdfLines
-- in src/app/actions/recording.ts. Manual entry only, no rate-table lookup (Cam's call
-- this pass — recording_fee_schedules/transfer_tax_schedules/recordation_tax_schedules
-- from migrations 0049/0050 already exist with real curated data but stay unwired for
-- now; that's separate, bigger work).
alter table public.recording_documents
  add column recordation_tax numeric,
  add column transfer_tax numeric,
  add column stamp_tax numeric;
