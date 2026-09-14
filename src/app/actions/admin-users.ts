'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPermission } from '@/lib/permissions'
import type { Role, Profile } from '@/lib/types'

async function requireManageUsers() {
  const supabase = await createClient()
  const allowed = await hasPermission(supabase, 'manage_users')
  return { supabase, allowed }
}

// Would this change leave zero active users able to manage users? Checked
// before revoking manage_users from a role, deleting a role that holds it,
// or deactivating a profile -- the lockout guard from the spec.
async function countOtherActiveManageUsersHolders(
  admin: ReturnType<typeof createAdminClient>,
  excludingProfileId?: string
): Promise<number> {
  let query = admin
    .from('profiles')
    .select('id, active, role_id, roles:role_id(role_permissions(permission_key))')
    .eq('active', true)
  if (excludingProfileId) {
    query = query.neq('id', excludingProfileId)
  }
  const { data, error } = await query
  // Fail safe: treat an unreadable count as "no other holders confirmed" so
  // the caller still blocks rather than silently allowing a lockout.
  if (error) return 0

  // role_id is a FK to roles, not role_permissions -- embed through roles one
  // level deeper, then filter client-side since the permission_key check
  // can't be expressed as a simple column filter here.
  return (data ?? []).filter((p) =>
    (
      p.roles as unknown as { role_permissions: { permission_key: string }[] } | null
    )?.role_permissions?.some((rp) => rp.permission_key === 'manage_users')
  ).length
}

export async function listStaff(): Promise<
  (Profile & { email: string; role_name: string })[] | { error: string }
> {
  const { supabase, allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }

  const admin = createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, active, role_id, roles:role_id(name)')
    .order('full_name')

  if (!profiles) return { error: 'Could not load staff.' }

  const results = await Promise.all(
    profiles.map(async (p) => {
      const { data: authUser } = await admin.auth.admin.getUserById(p.id)
      return {
        id: p.id,
        full_name: p.full_name,
        active: p.active,
        role_id: p.role_id,
        role_name: (p.roles as unknown as { name: string } | null)?.name ?? 'Staff',
        email: authUser.user?.email ?? '',
      }
    })
  )
  return results
}

export async function listRoles(): Promise<
  (Role & { permission_keys: string[] })[] | { error: string }
> {
  const { supabase, allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }

  const { data } = await supabase
    .from('roles')
    .select('id, name, created_at, role_permissions(permission_key)')
    .order('name')

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    permission_keys: (r.role_permissions as { permission_key: string }[]).map(
      (rp) => rp.permission_key
    ),
  }))
}

export async function inviteUser(
  email: string,
  fullName: string,
  roleId: string
): Promise<{ error?: string }> {
  const { allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }
  if (!email.trim() || !fullName.trim() || !roleId) {
    return { error: 'Email, name, and role are all required.' }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    return { error: 'NEXT_PUBLIC_SITE_URL is not configured — invites cannot be sent.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    redirectTo: `${siteUrl}/invite/complete`,
  })

  if (error || !data.user) {
    return { error: error?.message ?? 'Could not send invite.' }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: data.user.id, full_name: fullName.trim(), role_id: roleId, active: true })

  if (profileError) {
    // Don't leave an orphaned auth.users row with no profile -- middleware
    // treats "no profile" as blocked, but listStaff() has no way to surface
    // or deactivate an account it can't see, since it joins through profiles.
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: profileError.message }
  }

  revalidatePath('/', 'layout')
  return {}
}

export async function setUserActive(
  profileId: string,
  active: boolean
): Promise<{ error?: string }> {
  const { allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }

  const admin = createAdminClient()

  if (!active) {
    const remaining = await countOtherActiveManageUsersHolders(admin, profileId)
    if (remaining === 0) {
      return { error: 'Deactivating this person would leave nobody able to manage users.' }
    }
  }

  const { error } = await admin.from('profiles').update({ active }).eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function updateFullName(
  profileId: string,
  fullName: string
): Promise<{ error?: string }> {
  const { allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }
  if (!fullName.trim()) return { error: 'Name is required.' }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ full_name: fullName.trim() }).eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function createRole(name: string): Promise<{ error?: string }> {
  const { allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }
  if (!name.trim()) return { error: 'Role name is required.' }

  const admin = createAdminClient()
  const { error } = await admin.from('roles').insert({ name: name.trim() })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function setRolePermission(
  roleId: string,
  permissionKey: string,
  granted: boolean
): Promise<{ error?: string }> {
  const { allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }

  const admin = createAdminClient()

  if (!granted && permissionKey === 'manage_users') {
    const { data: holders } = await admin
      .from('profiles')
      .select('id')
      .eq('role_id', roleId)
      .eq('active', true)
    const otherHoldersOutsideThisRole = await countOtherActiveManageUsersHolders(admin)
    const affectedActiveUsersInThisRole = holders?.length ?? 0
    if (otherHoldersOutsideThisRole - affectedActiveUsersInThisRole <= 0 && affectedActiveUsersInThisRole > 0) {
      return { error: 'Removing this would leave nobody able to manage users.' }
    }
  }

  if (granted) {
    const { error } = await admin
      .from('role_permissions')
      .insert({ role_id: roleId, permission_key: permissionKey })
    if (error) return { error: error.message }
  } else {
    const { error } = await admin
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('permission_key', permissionKey)
    if (error) return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return {}
}

export async function deleteRole(roleId: string): Promise<{ error?: string }> {
  const { allowed } = await requireManageUsers()
  if (!allowed) return { error: 'Not permitted.' }

  const admin = createAdminClient()
  // profiles.role_id -> roles(id) has no `on delete` clause (defaults to NO
  // ACTION), so Postgres blocks the delete if ANY row references this role,
  // active or not -- count all holders here to match that real constraint,
  // not just active ones.
  const { count, error: countError } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role_id', roleId)

  if (countError) return { error: 'Could not verify holders. Please try again.' }
  if ((count ?? 0) > 0) {
    return { error: 'Cannot delete a role while any user, active or not, still holds it.' }
  }

  const { error } = await admin.from('roles').delete().eq('id', roleId)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

// Used by pickers elsewhere in the app (Order Info's functional-role
// fields) -- any authenticated user can read this, not gated on
// manage_users, since assigning a coworker to a file is a normal-staff
// action, not an admin one.
export async function listActiveStaffNames(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('active', true)
    .not('full_name', 'is', null)
    .order('full_name')

  return (data ?? []).map((p) => p.full_name as string)
}
