import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactsSection } from '@/components/ContactsSection'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ContactPrincipal } from '@/lib/types'

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

  const contactIds = (contacts ?? []).map((c) => c.id)
  const { data: principals } =
    contactIds.length > 0
      ? await supabase.from('contact_principals').select('*').in('contact_id', contactIds)
      : { data: [] as ContactPrincipal[] }

  const principalsByContact = new Map<string, ContactPrincipal[]>()
  for (const p of principals ?? []) {
    const existing = principalsByContact.get(p.contact_id)
    if (existing) {
      existing.push(p)
    } else {
      principalsByContact.set(p.contact_id, [p])
    }
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ContactsSection orderId={id} contacts={contacts ?? []} principalsByContact={principalsByContact} />
    </div>
  )
}
