import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listAffidavits } from '@/app/actions/doc-prep-affidavits'
import { AffidavitsPanel } from '@/components/doc-prep/AffidavitsPanel'

export default async function AffidavitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const affidavits = await listAffidavits(orderId)

  return <AffidavitsPanel orderId={orderId} affidavits={affidavits} />
}
