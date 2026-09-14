-- 0056_profiles_select_authenticated.sql
-- Final whole-branch review, Critical finding #1: migration 0018's own-row-only
-- SELECT policy on public.profiles (`id = auth.uid()`) means listStaff() and
-- listActiveStaffNames() (src/app/actions/admin-users.ts), which query profiles
-- with the user-scoped client, can never return more than the caller's own row.
-- The Users tab of /admin/users is non-functional with 2+ staff.
--
-- profiles holds only id, full_name, active, role_id, created_at (confirmed live
-- via information_schema.columns before writing this migration) -- no email, no
-- SSN/DOB, no other sensitive PII. Email lives in auth.users, which stays gated
-- behind the service-role admin client. Safe to open SELECT to all authenticated
-- users: this is a staff directory, not a place where any row needs to stay
-- hidden from other staff.
--
-- The exact live policy name was confirmed via
-- `select policyname from pg_policies where tablename = 'profiles'` before
-- writing this drop -- it matches 0018's source text unmodified (short enough
-- to not hit Postgres's 63-byte NAMEDATALEN truncation, unlike the
-- entity_directory policy names in migrations 0054/0055).

drop policy "Authenticated M&L staff can read their own profile" on public.profiles;

create policy "Authenticated M&L staff can read all profiles"
  on public.profiles for select to authenticated using (true);
