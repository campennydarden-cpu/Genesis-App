// Server-only. Never import this from a Client Component -- the service-role
// key bypasses RLS entirely. Used only for operations the Supabase Admin API
// requires it for (inviting a user) and for admin-console writes to
// roles/role_permissions, which have no authenticated-role write policy
// (see 0054's migration comment).
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
