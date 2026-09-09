import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listPoaContacts } from '@/app/actions/doc-prep-poa'
import { PowerOfAttorneyPanel } from '@/components/doc-prep/PowerOfAttorneyPanel'

export default async function PowerOfAttorneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const contacts = await listPoaContacts(orderId)

  return <PowerOfAttorneyPanel orderId={orderId} contacts={contacts} />
}
