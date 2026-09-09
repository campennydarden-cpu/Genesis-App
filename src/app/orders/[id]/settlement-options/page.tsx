import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSettlementOptions, listAllContacts } from '@/app/actions/settlement-options'
import { SettlementOptionsPanel } from '@/components/title/SettlementOptionsPanel'

export default async function SettlementOptionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [settlementOptions, contacts] = await Promise.all([getSettlementOptions(orderId), listAllContacts(orderId)])

  return <SettlementOptionsPanel orderId={orderId} settlementOptions={settlementOptions} contacts={contacts} />
}
