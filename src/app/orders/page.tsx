import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'

export default async function OrdersPage() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select(
      'id, file_number, product_type, order_status, title_status, escrow_status, created_at'
    )
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <div className="flex items-center gap-4">
          <Link href="/orders/new" className="rounded bg-slate-900 px-4 py-2 text-white">
            + New Order
          </Link>
          <form action={logout}>
            <button type="submit" className="text-sm text-slate-500 hover:underline">
              Sign Out
            </button>
          </form>
        </div>
      </div>

      <ul className="space-y-2" data-testid="order-list">
        {(orders ?? []).map((o) => (
          <li key={o.id} data-testid="order-row">
            <Link
              href={`/orders/${o.id}`}
              className="block rounded border p-4 hover:bg-slate-50"
            >
              <p className="font-medium">{o.file_number}</p>
              <p className="text-sm text-slate-500">
                {o.product_type} · {o.order_status} / {o.title_status} / {o.escrow_status}
              </p>
            </Link>
          </li>
        ))}
        {(orders ?? []).length === 0 && (
          <p className="text-sm text-slate-500">No orders yet.</p>
        )}
      </ul>
    </div>
  )
}
