-- supabase/migrations/0016_commitment_sch_a_cleanup.sql
-- Drops fields Cam confirmed don't belong: Company's State of Org and Requirements
-- Time Period ("do not make sense" - replaced by the existing Form Type dropdown,
-- relocated into Transaction Identification Data), and the standalone Mortgagee
-- Clause field (merged into Loan Policy Proposed Insured as one box).

alter table public.commitment_sch_a
  drop column company_state_of_org,
  drop column requirements_time_period,
  drop column loan_mortgagee_clause;
