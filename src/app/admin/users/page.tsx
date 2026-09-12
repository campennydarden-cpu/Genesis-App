import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import { listStaff, listRoles } from '@/app/actions/admin-users'
import { AdminUsersConsole } from '@/components/AdminUsersConsole'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!(await hasPermission(supabase, 'manage_users'))) redirect('/orders')

  const staff = await listStaff()
  const roles = await listRoles()

  if ('error' in staff || 'error' in roles) redirect('/orders')

  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Users & Roles</h1>
      <AdminUsersConsole initialStaff={staff} initialRoles={roles} />
    </main>
  )
}
