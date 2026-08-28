import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateOrder } from '@/app/actions/orders'
import { OrderForm } from '@/components/OrderForm'
import { ContactsSection } from '@/components/ContactsSection'

export default async function OrderDetailPage({
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

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  const updateOrderWithId = updateOrder.bind(null, id)

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Order {order.file_number}</h1>
      {error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <OrderForm action={updateOrderWithId} order={order} />
      <ContactsSection orderId={id} contacts={contacts ?? []} />
    </div>
  )
}
