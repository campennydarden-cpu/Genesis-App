import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listCharges, listChargeSplits, listPoliciesForOrder, listAllContacts } from '@/app/actions/additional-title-charges'
import { listCdfPage2Lines } from '@/app/actions/cdf-page2'
import { listBillCodes } from '@/app/actions/bill-codes'
import { AdditionalChargesPanel } from '@/components/title/AdditionalChargesPanel'
import type { AdditionalTitleChargeSplit } from '@/lib/types'

export default async function AdditionalChargesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [charges, policies, contacts, billCodes, cdfLines] = await Promise.all([
    listCharges(orderId),
    listPoliciesForOrder(orderId),
    listAllContacts(orderId),
    listBillCodes(),
    listCdfPage2Lines(orderId),
  ])

  const splitsByCharge: Record<string, AdditionalTitleChargeSplit[]> = {}
  for (const c of charges) {
    splitsByCharge[c.id] = await listChargeSplits(c.id)
  }

  return (
    <AdditionalChargesPanel
      orderId={orderId}
      charges={charges}
      splitsByCharge={splitsByCharge}
      policies={policies}
      contacts={contacts}
      billCodes={billCodes}
      cdfLines={cdfLines}
    />
  )
}
