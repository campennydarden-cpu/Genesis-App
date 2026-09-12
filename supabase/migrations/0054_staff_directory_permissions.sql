-- 0054_staff_directory_permissions.sql
-- Replaces the four SQL-only profiles.can_manage_* flags with role-based
-- permissions, and adds the columns an invite-only staff directory needs.
-- See docs/superpowers/specs/2026-09-10-staff-directory-permissions-design.md.

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null,
  primary key (role_id, permission_key)
);

insert into public.roles (name) values ('Admin'), ('Staff');

-- Admin gets every permission that exists today. New permissions added later
-- (in src/lib/constants.ts's PERMISSIONS list) are NOT auto-granted to
-- existing roles -- an admin grants them explicitly from the console.
insert into public.role_permissions (role_id, permission_key)
select (select id from public.roles where name = 'Admin'), key
from unnest(array[
  'manage_users',
  'manage_bill_codes',
  'manage_checklist_templates',
  'manage_folder_templates',
  'manage_lookup_data'
]) as key;

alter table public.profiles
  add column full_name text,
  add column active boolean not null default true,
  add column role_id uuid references public.roles(id);

-- Backfill full_name for pre-existing profiles from their auth.users email
-- local-part, so nothing ships with a null name for a later staff picker to
-- silently drop. Placeholder, not a real name -- fine, since this migration
-- also builds the admin console's ability to fix it later.
update public.profiles p
set full_name = coalesce(split_part(u.email, '@', 1), 'Staff')
from auth.users u
where u.id = p.id and p.full_name is null;

-- Backfill BEFORE dropping the old columns and BEFORE making role_id
-- not-null, so every existing row (including Cam's) gets a real role from
-- data that's about to disappear, and no row is ever left with a null role.
update public.profiles
set role_id = (select id from public.roles where name = 'Admin')
where can_manage_folder_templates = true
   or can_manage_checklist_templates = true
   or can_manage_bill_codes = true
   or can_manage_lookup_data = true;

update public.profiles
set role_id = (select id from public.roles where name = 'Staff')
where role_id is null;

-- Drop policies on entity_directory that depend on can_manage_lookup_data
-- before we drop the column. These will be recreated in a later task using
-- role-based permissions instead.
drop policy "Only permitted users can delete entity_directory" on public.entity_directory;
drop policy "Authenticated M&L staff can update entity_directory, deactivati" on public.entity_directory;

alter table public.profiles
  alter column role_id set not null,
  drop column can_manage_folder_templates,
  drop column can_manage_checklist_templates,
  drop column can_manage_bill_codes,
  drop column can_manage_lookup_data;

alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;

create policy "Authenticated M&L staff can view roles"
  on public.roles for select to authenticated using (true);

create policy "Authenticated M&L staff can view role_permissions"
  on public.role_permissions for select to authenticated using (true);

-- Insert/update/delete on roles and role_permissions happen only through
-- the service-role admin client (Task 4), which bypasses RLS entirely --
-- no authenticated-role write policy is needed or created here.
