import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrderForm } from '@/components/OrderForm'

export default async function OrderEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('*').eq('id', id).single()

  if (!order) {
    notFound()
  }

  return <OrderForm order={order} />
}
