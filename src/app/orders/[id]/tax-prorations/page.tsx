import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listProrations, listAllContacts } from '@/app/actions/tax-prorations'
import { listCdfPage2Lines } from '@/app/actions/cdf-page2'
import { TaxProrationsPanel } from '@/components/title/TaxProrationsPanel'

export default async function TaxProrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [prorations, contacts, cdfLines] = await Promise.all([
    listProrations(orderId),
    listAllContacts(orderId),
    listCdfPage2Lines(orderId),
  ])

  return <TaxProrationsPanel orderId={orderId} prorations={prorations} contacts={contacts} cdfLines={cdfLines} />
}
