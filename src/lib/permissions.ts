import type { createClient } from '@/lib/supabase/server'
import type { PermissionKey } from '@/lib/constants'
import type { Profile } from '@/lib/types'

export async function getCurrentProfile(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, active, role_id')
    .eq('id', user.id)
    .maybeSingle()

  return profile
}

export async function hasPermission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  key: PermissionKey
): Promise<boolean> {
  const profile = await getCurrentProfile(supabase)
  if (!profile || !profile.active) return false

  const { data } = await supabase
    .from('role_permissions')
    .select('permission_key')
    .eq('role_id', profile.role_id)
    .eq('permission_key', key)
    .maybeSingle()

  return data !== null
}
