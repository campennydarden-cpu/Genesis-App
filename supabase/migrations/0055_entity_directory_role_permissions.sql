-- 0055_entity_directory_role_permissions.sql
-- 0053's RLS policies checked profiles.can_manage_lookup_data directly.
-- That column was dropped in 0054 -- these policies now check role-derived
-- permission instead. See 0054's migration comment for why the column was
-- dropped in the first place.
--
-- 0053's original update/delete policies on entity_directory were already
-- DROPPED by 0054 (Postgres refuses to drop a column referenced by a live
-- policy), so this migration re-creates them with `create policy` rather
-- than `alter policy`. The update policy's name is copied verbatim from
-- 0053's source but Postgres silently truncates identifiers over 63 bytes
-- (NAMEDATALEN) -- the live/original name was already truncated to 63
-- chars, confirmed via `select policyname from pg_policies where
-- tablename = 'entity_directory'` before writing this migration -- so the
-- name below matches that truncated form exactly, not 0053's full text.

create policy "Authenticated M&L staff can update entity_directory, deactivati"
  on public.entity_directory
  for update
  to authenticated
  using (true)
  with check (
    is_active = true
    or exists (
      select 1 from public.profiles p
      join public.role_permissions rp on rp.role_id = p.role_id
      where p.id = auth.uid() and rp.permission_key = 'manage_lookup_data'
    )
  );

create policy "Only permitted users can delete entity_directory"
  on public.entity_directory
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.role_permissions rp on rp.role_id = p.role_id
      where p.id = auth.uid() and rp.permission_key = 'manage_lookup_data'
    )
  );
