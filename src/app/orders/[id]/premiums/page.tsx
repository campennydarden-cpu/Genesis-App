import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  listPremiums,
  listPremiumSplits,
  listUnderwriterContacts,
  listAllContacts,
} from '@/app/actions/title-premiums'
import { listEndorsements, listEndorsementSplits } from '@/app/actions/endorsements'
import { PremiumsPanel } from '@/components/title/PremiumsPanel'
import type { PremiumSplit, Endorsement, EndorsementSplit } from '@/lib/types'

export default async function PremiumsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [premiums, underwriterContacts, allContacts] = await Promise.all([
    listPremiums(orderId),
    listUnderwriterContacts(orderId),
    listAllContacts(orderId),
  ])

  const splitsByPremium: Record<string, PremiumSplit[]> = {}
  const endorsementsByPremium: Record<string, Endorsement[]> = {}
  const endorsementSplits: Record<string, EndorsementSplit[]> = {}

  for (const p of premiums) {
    const [splits, endorsements] = await Promise.all([listPremiumSplits(p.id), listEndorsements(p.id)])
    splitsByPremium[p.id] = splits
    endorsementsByPremium[p.id] = endorsements
    for (const e of endorsements) {
      endorsementSplits[e.id] = await listEndorsementSplits(e.id)
    }
  }

  return (
    <PremiumsPanel
      orderId={orderId}
      premiums={premiums}
      splitsByPremium={splitsByPremium}
      endorsementsByPremium={endorsementsByPremium}
      endorsementSplits={endorsementSplits}
      underwriterContacts={underwriterContacts}
      allContacts={allContacts}
    />
  )
}
