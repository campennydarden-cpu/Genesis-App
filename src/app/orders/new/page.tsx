import { createOrder } from '@/app/actions/orders'
import { OrderForm } from '@/components/OrderForm'

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">New Order</h1>
      {error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <OrderForm action={createOrder} />
    </div>
  )
}
