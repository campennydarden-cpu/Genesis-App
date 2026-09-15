'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { mergeCommitmentDocument } from '@/app/actions/commitment-document'
import { exportCommitmentDocumentPdf } from '@/app/actions/commitment-document-pdf'

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
  const [isExporting, startExport] = useTransition()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
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
        <div className="flex items-center gap-2">
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
        <button
          type="button"
          disabled={isExporting || !editorConfig}
          onClick={() =>
            startExport(async () => {
              setError(null)
              const result = await exportCommitmentDocumentPdf(orderId)
              if (result.error) setError(result.error)
              else setPdfUrl(result.downloadUrl ?? null)
            })
          }
          className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isExporting ? 'Exporting…' : 'Export PDF'}
        </button>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
            Download PDF
          </a>
        )}
        </div>
      </div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {editorConfig ? (
        // ONLYOFFICE's DocsAPI.DocEditor destroys the element passed by id and
        // replaces it with its own unstyled wrapper div(s) + iframe -- any style
        // (including our intended 80vh) put directly on #onlyoffice-editor-container
        // is discarded the moment the editor mounts, and the iframe's own
        // height="100%" attribute then has no definite ancestor height to resolve
        // against, so it collapses to the browser's ~150px default iframe size
        // (confirmed live: getComputedStyle on the mounted iframe showed
        // height: 150px). Fix: give a *surviving* wrapper the real height, then
        // force every ONLYOFFICE-injected div/iframe inside it to 100% so the
        // percentage chain has something definite to resolve against.
        <div id="onlyoffice-editor-wrapper" style={{ height: '80vh' }}>
          <style>{`#onlyoffice-editor-wrapper div, #onlyoffice-editor-wrapper iframe { height: 100%; }`}</style>
          <div id="onlyoffice-editor-container" />
        </div>
      ) : (
        <p className="text-sm text-gray-500">No document has been generated yet. Click &quot;Generate document&quot; to merge current order data into the Commitment template.</p>
      )}
    </div>
  )
}
