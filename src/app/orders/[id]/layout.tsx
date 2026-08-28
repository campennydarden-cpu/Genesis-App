import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import { FileSectionsNav } from '@/components/FileSectionsNav'
import { OrderToolbar } from '@/components/OrderToolbar'

export default async function OrderLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, file_number, product_type, order_status')
    .order('created_at', { ascending: false })

  const order = orders?.find((o) => o.id === id)

  if (!order) {
    notFound()
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r bg-slate-50 p-4" data-testid="order-sidebar">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/orders/new" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
            + New Order
          </Link>
          <form action={logout}>
            <button type="submit" className="text-xs text-slate-500 hover:underline">
              Sign Out
            </button>
          </form>
        </div>
        <ul className="space-y-1">
          {(orders ?? []).map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}/order-entry`}
                data-testid="sidebar-order-row"
                data-order-id={o.id}
                className={`block rounded p-2 text-sm ${
                  o.id === id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                }`}
              >
                <p className="font-medium">{o.file_number}</p>
                <p className={o.id === id ? 'text-slate-300' : 'text-slate-500'}>
                  {o.product_type} · {o.order_status}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <nav className="w-56 shrink-0 border-r p-4" data-testid="file-section-nav">
        <FileSectionsNav orderId={id} />
      </nav>

      <main className="flex-1 p-8">
        <h1 className="mb-4 text-2xl font-semibold">Order {order.file_number}</h1>
        <OrderToolbar>{children}</OrderToolbar>
      </main>
    </div>
  )
}
