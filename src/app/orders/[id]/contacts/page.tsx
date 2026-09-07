import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactsSection } from '@/components/ContactsSection'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function OrderContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id').eq('id', id).single()

  if (!order) {
    notFound()
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ContactsSection orderId={id} contacts={contacts ?? []} />
    </div>
  )
}
