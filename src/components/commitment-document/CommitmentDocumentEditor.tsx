'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { mergeCommitmentDocument } from '@/app/actions/commitment-document'

declare global {
  interface Window {
    DocsAPI?: { DocEditor: new (elementId: string, config: object) => { destroyEditor: () => void } }
  }
}

export function CommitmentDocumentEditor({
  orderId,
  editorUrl,
  revisionNumber,
  documentServerUrl,
}: {
  orderId: string
  editorUrl: string | null
  revisionNumber: number | null
  documentServerUrl: string
}) {
  const [isMerging, startMerge] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const editorInstanceRef = useRef<{ destroyEditor: () => void } | null>(null)

  useEffect(() => {
    if (!editorUrl || !documentServerUrl) return

    const script = document.createElement('script')
    script.src = `${documentServerUrl}/web-apps/apps/api/documents/api.js`
    script.onload = () => {
      if (!window.DocsAPI) return
      // Config JWT signing happens server-side in a real deployment (this config
      // object would be built by a server action and passed down); left as a
      // documented follow-up wiring step here since it needs the JWT secret,
      // which must never reach the client bundle. See Global Constraints.
      editorInstanceRef.current = new window.DocsAPI.DocEditor('onlyoffice-editor-container', {
        document: {
          fileType: 'docx',
          key: `${orderId}-rev-${revisionNumber ?? 0}`,
          title: 'Commitment.docx',
          url: editorUrl,
        },
        editorConfig: {
          callbackUrl: `${window.location.origin}/api/onlyoffice/callback?orderId=${orderId}`,
        },
      })
    }
    document.body.appendChild(script)

    return () => {
      editorInstanceRef.current?.destroyEditor()
      document.body.removeChild(script)
    }
  }, [editorUrl, documentServerUrl, orderId, revisionNumber])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Commitment Document</h1>
        <button
          type="button"
          disabled={isMerging}
          onClick={() =>
            startMerge(async () => {
              setError(null)
              const result = await mergeCommitmentDocument(orderId)
              if (result.error) setError(result.error)
            })
          }
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isMerging ? 'Merging…' : editorUrl ? 'Refresh from current data' : 'Generate document'}
        </button>
      </div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {editorUrl ? (
        <div id="onlyoffice-editor-container" style={{ height: '80vh' }} />
      ) : (
        <p className="text-sm text-gray-500">No document has been generated yet. Click &quot;Generate document&quot; to merge current order data into the Commitment template.</p>
      )}
    </div>
  )
}
