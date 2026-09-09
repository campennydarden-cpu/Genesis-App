import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listNotaryAcks } from '@/app/actions/doc-prep-notary-acks'
import { NotaryAcknowledgementPanel } from '@/components/doc-prep/NotaryAcknowledgementPanel'

export default async function NotaryAcknowledgementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const acks = await listNotaryAcks(orderId)

  return <NotaryAcknowledgementPanel orderId={orderId} acks={acks} />
}
