import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateOrderEntry } from '@/app/actions/orders'
import { OrderForm } from '@/components/OrderForm'

export default async function OrderEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('*').eq('id', id).single()

  if (!order) {
    notFound()
  }

  const updateOrderEntryWithId = updateOrderEntry.bind(null, id)

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <OrderForm action={updateOrderEntryWithId} order={order} />
    </div>
  )
}
