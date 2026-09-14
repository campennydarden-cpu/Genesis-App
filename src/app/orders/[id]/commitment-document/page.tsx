import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CommitmentDocumentEditor } from '@/components/commitment-document/CommitmentDocumentEditor'

export default async function CommitmentDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id').eq('id', id).single()
  if (!order) notFound()

  const { data: commitmentDocument } = await supabase
    .from('commitment_documents')
    .select('storage_path, revision_number, updated_at')
    .eq('order_id', id)
    .maybeSingle()

  let editorUrl: string | null = null
  if (commitmentDocument) {
    const { data: signedUrlData } = await supabase.storage
      .from('commitment-documents')
      .createSignedUrl(commitmentDocument.storage_path, 3600)
    editorUrl = signedUrlData?.signedUrl ?? null
  }

  return (
    <div>
      <CommitmentDocumentEditor
        orderId={id}
        editorUrl={editorUrl}
        revisionNumber={commitmentDocument?.revision_number ?? null}
        documentServerUrl={process.env.NEXT_PUBLIC_ONLYOFFICE_DOCUMENT_SERVER_URL ?? ''}
      />
    </div>
  )
}
