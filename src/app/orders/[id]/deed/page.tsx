import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getDeed,
  getDeedPrincipals,
  getDeedSignatureLines,
  getDeedSubjectTo,
  getOrderContactsForDeed,
} from '@/app/actions/doc-prep-deed'
import { DeedForm } from '@/components/doc-prep/DeedForm'

export default async function DeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const deed = await getDeed(orderId)
  const [principals, signatureLines, subjectTo, contacts] = await Promise.all([
    deed ? getDeedPrincipals(deed.id) : Promise.resolve([]),
    deed ? getDeedSignatureLines(deed.id) : Promise.resolve([]),
    deed ? getDeedSubjectTo(deed.id) : Promise.resolve([]),
    getOrderContactsForDeed(orderId),
  ])

  return (
    <DeedForm
      orderId={orderId}
      deed={deed}
      principals={principals}
      signatureLines={signatureLines}
      subjectTo={subjectTo}
      contacts={contacts}
    />
  )
}
