import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listPayoffsForCalculation, listPayoffAdditionalCharges } from '@/app/actions/payoff-calculations'
import { PayoffCalculationsPanel } from '@/components/title/PayoffCalculationsPanel'

export default async function PayoffCalculationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const payoffs = await listPayoffsForCalculation(orderId)
  const chargesByPayoff = Object.fromEntries(
    await Promise.all(payoffs.map(async (p) => [p.id, await listPayoffAdditionalCharges(p.id)] as const))
  )

  return <PayoffCalculationsPanel orderId={orderId} payoffs={payoffs} chargesByPayoff={chargesByPayoff} />
}
