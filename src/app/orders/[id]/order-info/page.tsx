import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrderInfoForm } from '@/components/OrderInfoForm'

export default async function OrderInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select(
      'order_status, title_status, escrow_status, title_opened_date, escrow_opened_date, title_officer, curative_title_officer, escrow_assistant, escrow_officer, closing_coordinator, funder, recording_specialist, post_closer'
    )
    .eq('id', id)
    .single()

  if (!order) {
    notFound()
  }

  return <OrderInfoForm orderId={id} order={order} />
}
