import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import { HomeDashboard } from '@/components/HomeDashboard'
import { buttonVariants } from '@/components/ui/button'

export default async function OrdersPage() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select(
      'id, file_number, product_type, order_status, title_status, escrow_status, property_address, created_at'
    )
    .order('created_at', { ascending: false })

  const { data: contacts } = await supabase.from('contacts').select('order_id, role, name')

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Genesis</h1>
        <div className="flex items-center gap-4">
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
