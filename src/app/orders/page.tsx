import Link from 'next/link'

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Link href="/orders/new" className="rounded bg-slate-900 px-4 py-2 text-white">
          + New Order
        </Link>
      </div>
    </div>
  )
}
