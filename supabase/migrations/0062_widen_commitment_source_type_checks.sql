-- supabase/migrations/0062_widen_commitment_source_type_checks.sql
-- Task 12 (e2e testing) surfaced that commitment_requirements/commitment_exceptions'
-- source_type check constraints were never widened to allow 'template' (both tables)
-- and 'easement' (exceptions only), even though Task 2 already widened the
-- corresponding TypeScript unions and Tasks 7/8 already write these values.
-- Without this, every template-library add and every easement auto-chip add fails
-- server-side with a Postgres check-constraint violation. Confirmed live:
--   commitment_requirements_source_type_check: CHECK (source_type = ANY (ARRAY['si','rel','lien']))
--   commitment_exceptions_source_type_check:   CHECK (source_type = 'em')

alter table public.commitment_requirements
  drop constraint commitment_requirements_source_type_check;
alter table public.commitment_requirements
  add constraint commitment_requirements_source_type_check
  check (source_type = ANY (ARRAY['si', 'rel', 'lien', 'template']));

alter table public.commitment_exceptions
  drop constraint commitment_exceptions_source_type_check;
alter table public.commitment_exceptions
  add constraint commitment_exceptions_source_type_check
  check (source_type = ANY (ARRAY['em', 'easement', 'template']));
