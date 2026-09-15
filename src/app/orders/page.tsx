import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import { HomeDashboard } from '@/components/HomeDashboard'
import { buttonVariants } from '@/components/ui/button'
import { hasPermission } from '@/lib/permissions'

// Every /admin/* page already redirects a caller lacking its own permission,
// so this list is only about giving a permitted user something to click —
// hasPermission() itself is still the real gate.
const ADMIN_LINKS = [
  { href: '/admin/users', label: 'Users & Roles', permission: 'manage_users' },
  { href: '/admin/bill-codes', label: 'Bill Codes', permission: 'manage_bill_codes' },
  { href: '/admin/checklist-templates', label: 'Checklist Templates', permission: 'manage_checklist_templates' },
  { href: '/admin/folder-templates', label: 'Folder Templates', permission: 'manage_folder_templates' },
  {
    href: '/admin/requirement-templates',
    label: 'Requirement/Exception Templates',
    permission: 'manage_requirement_templates',
  },
] as const

// A stale Next.js Link-prefetch of this route (from the persistent order
// layout's "Home" link) can otherwise be served back on a later hard
// navigation to this same URL, showing status values from before a save —
// revalidatePath() alone doesn't invalidate a response the browser already
// cached from that earlier prefetch. force-dynamic keeps every response
// here genuinely live, which a real-time order dashboard needs anyway.
export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select(
      'id, file_number, product_type, order_status, title_status, escrow_status, property_address, created_at'
    )
    .order('created_at', { ascending: false })

  const { data: contacts } = await supabase.from('contacts').select('order_id, role, name')

  const adminAccess = await Promise.all(ADMIN_LINKS.map((link) => hasPermission(supabase, link.permission)))
  const visibleAdminLinks = ADMIN_LINKS.filter((_, i) => adminAccess[i])

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Genesis</h1>
        <div className="flex items-center gap-4">
          {visibleAdminLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-muted-foreground hover:underline">
              {link.label}
            </Link>
          ))}
          <Link href="/orders/new" className={buttonVariants({ variant: 'default' })}>
            + New Order
          </Link>
          <form action={logout}>
            <button type="submit" className="text-sm text-muted-foreground hover:underline">
              Sign Out
            </button>
          </form>
        </div>
      </div>

      <HomeDashboard orders={orders ?? []} contacts={contacts ?? []} />
    </div>
  )
}
