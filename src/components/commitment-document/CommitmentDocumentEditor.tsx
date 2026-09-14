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
  editorConfig,
  editorToken,
  documentServerUrl,
}: {
  orderId: string
  editorConfig: object | null
  editorToken: string | null
  documentServerUrl: string
}) {
  const [isMerging, startMerge] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const editorInstanceRef = useRef<{ destroyEditor: () => void } | null>(null)

  useEffect(() => {
    if (!editorConfig || !editorToken || !documentServerUrl) return

    const script = document.createElement('script')
    script.src = `${documentServerUrl}/web-apps/apps/api/documents/api.js`
    script.onload = () => {
      if (!window.DocsAPI) return
      editorInstanceRef.current = new window.DocsAPI.DocEditor('onlyoffice-editor-container', {
        ...editorConfig,
        token: editorToken,
      })
    }
    document.body.appendChild(script)

    return () => {
      editorInstanceRef.current?.destroyEditor()
      document.body.removeChild(script)
    }
  }, [editorConfig, editorToken, documentServerUrl])

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
          {isMerging ? 'Merging…' : editorConfig ? 'Refresh from current data' : 'Generate document'}
        </button>
      </div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {editorConfig ? (
        <div id="onlyoffice-editor-container" style={{ height: '80vh' }} />
      ) : (
        <p className="text-sm text-gray-500">No document has been generated yet. Click &quot;Generate document&quot; to merge current order data into the Commitment template.</p>
      )}
    </div>
  )
}
