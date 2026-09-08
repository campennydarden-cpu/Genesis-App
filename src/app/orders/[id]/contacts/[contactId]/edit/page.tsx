import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AddContactForm } from '@/components/AddContactForm'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string; contactId: string }>
}) {
  const { id, contactId } = await params
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('order_id', id)
    .single()

  if (!contact) {
    notFound()
  }

  const { data: order } = await supabase.from('orders').select('property_address').eq('id', id).single()
  const { data: property } = await supabase
    .from('property_details')
    .select('property_address')
    .eq('order_id', id)
    .maybeSingle()
  const propertyAddress = property?.property_address ?? order?.property_address ?? null

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Edit Contact</h2>
      <AddContactForm orderId={id} contact={contact} propertyAddress={propertyAddress} />
      <Button
        variant="ghost"
        size="sm"
        className="mt-4"
        render={<Link href={`/orders/${id}/contacts`}>Back to Contacts</Link>}
      />
    </div>
  )
}
