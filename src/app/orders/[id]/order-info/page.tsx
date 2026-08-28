import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateOrderInfo } from '@/app/actions/orders'
import { OrderInfoForm } from '@/components/OrderInfoForm'

export default async function OrderInfoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('order_status, title_status, escrow_status')
    .eq('id', id)
    .single()

  if (!order) {
    notFound()
  }

  const updateOrderInfoWithId = updateOrderInfo.bind(null, id)

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <OrderInfoForm action={updateOrderInfoWithId} order={order} />
    </div>
  )
}
