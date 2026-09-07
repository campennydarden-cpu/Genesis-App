'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getAttachmentDownloadUrl } from '@/app/actions/attachments'
import type { Attachment } from '@/lib/types'

export function AttachmentPreview({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    getAttachmentDownloadUrl(attachment.storage_path).then(setUrl)
  }, [attachment.storage_path])

  useEffect(() => {
    if (!url || attachment.mime_type !== 'application/pdf' || !canvasRef.current) return

    let cancelled = false
    let renderTask: ReturnType<import('pdfjs-dist').PDFPageProxy['render']> | null = null

    async function renderPdf() {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()

      const doc = await pdfjsLib.getDocument({ url: url as string }).promise
      if (cancelled) return
      const page = await doc.getPage(1)
      if (cancelled) return
      const viewport = page.getViewport({ scale: 1.2 })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const context = canvas.getContext('2d')
      if (!context) return
      renderTask = page.render({ canvas, canvasContext: context, viewport })
      try {
        await renderTask.promise
      } catch (err) {
        // RenderingCancelledException is expected when cleanup cancels an in-flight render
        if (!cancelled) console.error('PDF render failed:', err)
      }
    }

    renderPdf()

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [url, attachment.mime_type])

  const isImage = attachment.mime_type.startsWith('image/')
  const isPdf = attachment.mime_type === 'application/pdf'

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{attachment.name}</DialogTitle>
        </DialogHeader>

        {!url && <p className="text-sm text-muted-foreground">Loading preview...</p>}
        {url && isPdf && <canvas ref={canvasRef} data-testid="pdf-preview-canvas" />}
        {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static asset Next can optimize */}
        {url && isImage && <img src={url} alt={attachment.name} className="max-h-[70vh] max-w-full" />}
        {url && !isPdf && !isImage && (
          <a href={url} download={attachment.name} className="text-sm text-primary hover:underline">
            Download {attachment.name}
          </a>
        )}
      </DialogContent>
    </Dialog>
  )
}
