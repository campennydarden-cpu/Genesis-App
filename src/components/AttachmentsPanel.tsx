'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FolderTree } from '@/components/FolderTree'
import {
  listAttachments,
  searchAttachments,
  moveAttachment,
  deleteAttachmentPermanently,
} from '@/app/actions/attachments'
import type { Attachment, AttachmentFolder } from '@/lib/types'

type SearchResult = Attachment & { folderPath: string }

export function AttachmentsPanel({ orderId }: { orderId: string }) {
  const [folders, setFolders] = useState<AttachmentFolder[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      const data = await listAttachments(orderId)
      setFolders(data.folders)
      setAttachments(data.attachments)
      setSelectedFolderId((current) => current ?? data.folders.find((f) => !f.parent_folder_id)?.id ?? null)
    })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    const timeout = setTimeout(() => {
      searchAttachments(orderId, searchQuery.trim()).then(setSearchResults)
    }, 300)
    return () => clearTimeout(timeout)
  }, [orderId, searchQuery])

  const visibleAttachments: Array<Attachment | SearchResult> =
    searchResults ?? attachments.filter((a) => a.folder_id === selectedFolderId)

  function handleMove(attachmentId: string, folderId: string) {
    startTransition(async () => {
      await moveAttachment(attachmentId, folderId)
      refresh()
    })
  }

  function handleDelete(attachmentId: string) {
    startTransition(async () => {
      await deleteAttachmentPermanently(attachmentId)
      refresh()
    })
  }

  return (
    <div data-testid="attachments-panel" className="flex gap-6">
      <div className="w-56 shrink-0">
        <FolderTree
          orderId={orderId}
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelect={(id) => {
            setSelectedFolderId(id)
            setSearchQuery('')
          }}
          onFoldersChanged={refresh}
        />
      </div>

      <div className="flex-1">
        <div className="mb-3 flex items-center gap-2">
          <Input
            placeholder="Search this file's attachments..."
            aria-label="Search attachments"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button type="button" onClick={() => setUploadOpen(true)} disabled={!selectedFolderId}>
            Upload
          </Button>
        </div>

        <ul className="divide-y" data-testid="attachment-list">
          {visibleAttachments.map((attachment) => (
            <li key={attachment.id} className="flex items-center justify-between py-2">
              <div>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(attachment)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {attachment.name}
                </button>
                {'folderPath' in attachment && (
                  <p className="text-xs text-muted-foreground">{(attachment as SearchResult).folderPath}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Move ${attachment.name}`}
                  className="rounded border px-2 py-1 text-xs"
                  value=""
                  onChange={(e) => e.target.value && handleMove(attachment.id, e.target.value)}
                >
                  <option value="">Move to...</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleDelete(attachment.id)}
                  className="text-xs text-destructive hover:underline"
                >
                  Delete Permanently
                </button>
              </div>
            </li>
          ))}
          {visibleAttachments.length === 0 && !isPending && (
            <li className="py-2 text-sm text-muted-foreground">No attachments here yet.</li>
          )}
        </ul>
      </div>

      {uploadOpen && selectedFolderId && (
        <p className="text-sm text-muted-foreground" data-testid="upload-dialog-placeholder">
          Upload dialog not wired yet — see Task 7.
        </p>
      )}

      {previewAttachment && (
        <p className="text-sm text-muted-foreground" data-testid="preview-placeholder">
          Preview not wired yet — see Task 8.
        </p>
      )}
    </div>
  )
}
