import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CommitmentDocumentEditor } from '@/components/commitment-document/CommitmentDocumentEditor'
import { signOnlyOfficeEditorConfig } from '@/lib/onlyoffice'
import { getCommitmentDocumentDivergence } from '@/app/actions/commitment-document-diff'
import { CommitmentDocumentReview } from '@/components/commitment-document/CommitmentDocumentReview'

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

  const divergentFields = commitmentDocument ? await getCommitmentDocumentDivergence(id) : []

  let editorConfig: object | null = null
  let editorToken: string | null = null
  if (commitmentDocument) {
    const { data: signedUrlData } = await supabase.storage
      .from('commitment-documents')
      .createSignedUrl(commitmentDocument.storage_path, 3600)
    if (signedUrlData) {
      const config = {
        document: {
          fileType: 'docx',
          key: `${id}-rev-${commitmentDocument.revision_number}`,
          title: 'Commitment.docx',
          url: signedUrlData.signedUrl,
        },
        editorConfig: {
          callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/onlyoffice/callback?orderId=${id}`,
        },
      }
      editorConfig = config
      editorToken = signOnlyOfficeEditorConfig(config)
    }
  }

  return (
    <div>
      <CommitmentDocumentReview orderId={id} divergentFields={divergentFields} />
      <CommitmentDocumentEditor
        orderId={id}
        editorConfig={editorConfig}
        editorToken={editorToken}
        documentServerUrl={process.env.NEXT_PUBLIC_ONLYOFFICE_DOCUMENT_SERVER_URL ?? ''}
      />
    </div>
  )
}
