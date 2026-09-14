import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSecurityInstrument, getSiPrincipals } from '@/app/actions/doc-prep-security-instrument'
import { getOrderContactsForDeed } from '@/app/actions/doc-prep-deed'
import { getPrimaryLoan } from '@/app/actions/loans'
import { SecurityInstrumentForm } from '@/components/doc-prep/SecurityInstrumentForm'

export default async function SecurityInstrumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const si = await getSecurityInstrument(orderId)
  const [principals, contacts, primaryLoan] = await Promise.all([
    si ? getSiPrincipals(si.id) : Promise.resolve([]),
    getOrderContactsForDeed(orderId),
    getPrimaryLoan(orderId),
  ])

  return (
    <SecurityInstrumentForm orderId={orderId} si={si} principals={principals} contacts={contacts} primaryLoan={primaryLoan} />
  )
}
