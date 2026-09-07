-- supabase/migrations/0018_profiles_permissions.sql
-- Minimal permission primitive for Attachments' firm-level folder-template admin
-- screen (Genesis Rebuild - Attachments Core Design.md's can_manage_folder_templates
-- gate) — first permission-gated surface in the app. Not the full MFA/SSO/step-up
-- Admin system in Design Notes - Admin.md (separate, unbuilt initiative). No
-- self-service grant path exists yet — a row is inserted/flipped by direct SQL
-- until a real admin-user-management screen exists, matching the "not there yet"
-- precedent already set for the SSN/DOB access-control decision.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  can_manage_folder_templates boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Authenticated M&L staff can read their own profile"
  on public.profiles for select to authenticated using (id = auth.uid());
