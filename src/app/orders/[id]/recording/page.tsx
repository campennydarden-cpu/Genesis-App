import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listRecordingDocuments } from '@/app/actions/recording'
import { listCdfPage2Lines } from '@/app/actions/cdf-page2'
import { RecordingPanel } from '@/components/title/RecordingPanel'

export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [documents, cdfLines] = await Promise.all([listRecordingDocuments(orderId), listCdfPage2Lines(orderId)])

  return <RecordingPanel orderId={orderId} documents={documents} cdfLines={cdfLines} />
}
