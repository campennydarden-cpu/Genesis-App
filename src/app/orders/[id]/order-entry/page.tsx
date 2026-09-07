import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateOrderEntry } from '@/app/actions/orders'
import { OrderForm } from '@/components/OrderForm'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function OrderEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { id } = await params
  const { error, saved } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('*').eq('id', id).single()

  if (!order) {
    notFound()
  }

  const updateOrderEntryWithId = updateOrderEntry.bind(null, id)

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!error && saved && (
        <Alert className="mb-4">
          <AlertDescription>Changes saved.</AlertDescription>
        </Alert>
      )}
      <OrderForm action={updateOrderEntryWithId} order={order} />
    </div>
  )
}
