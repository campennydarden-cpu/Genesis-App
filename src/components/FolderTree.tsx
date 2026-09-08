'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createFolder, renameFolder } from '@/app/actions/attachments'
import type { AttachmentFolder } from '@/lib/types'

export function FolderTree({
  orderId,
  folders,
  selectedFolderId,
  onSelect,
  onFoldersChanged,
}: {
  orderId: string
  folders: AttachmentFolder[]
  selectedFolderId: string | null
  onSelect: (folderId: string) => void
  onFoldersChanged: () => void
}) {
  const [addingUnder, setAddingUnder] = useState<string | null>(null)
  const [addingRoot, setAddingRoot] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isPending, startTransition] = useTransition()

  const topLevel = folders.filter((f) => !f.parent_folder_id).sort((a, b) => a.sort_order - b.sort_order)
  const childrenOf = (id: string) =>
    folders.filter((f) => f.parent_folder_id === id).sort((a, b) => a.sort_order - b.sort_order)

  function handleAdd(parentFolderId: string | null) {
    if (!newName.trim()) return
    startTransition(async () => {
      await createFolder(orderId, parentFolderId, newName.trim())
      setNewName('')
      setAddingUnder(null)
      setAddingRoot(false)
      onFoldersChanged()
    })
  }

  function startRename(folder: AttachmentFolder) {
    setRenamingId(folder.id)
    setRenameValue(folder.name)
  }

  function handleRename() {
    if (!renamingId || !renameValue.trim()) return
    startTransition(async () => {
      await renameFolder(renamingId, renameValue.trim())
      setRenamingId(null)
      onFoldersChanged()
    })
  }

  function renderFolder(folder: AttachmentFolder, depth: number) {
    return (
      <li key={folder.id}>
        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
          {renamingId === folder.id ? (
            <>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                aria-label={`Rename ${folder.name}`}
                className="h-7 flex-1 text-sm"
                autoFocus
              />
              <Button type="button" size="sm" onClick={handleRename} disabled={isPending}>
                Save
              </Button>
              <button
                type="button"
                onClick={() => setRenamingId(null)}
                className="px-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                data-testid={`folder-${folder.id}`}
                onClick={() => onSelect(folder.id)}
                className={`flex-1 rounded px-2 py-1 text-left text-sm ${
                  selectedFolderId === folder.id ? 'bg-accent font-medium' : 'hover:bg-accent/50'
                }`}
              >
                {folder.name}
              </button>
              <button
                type="button"
                aria-label={`Rename ${folder.name}`}
                onClick={() => startRename(folder)}
                className="px-1 text-xs text-muted-foreground hover:text-foreground"
              >
                ✎
              </button>
              <button
                type="button"
                aria-label={`Add sub-folder to ${folder.name}`}
                onClick={() => setAddingUnder(folder.id)}
                className="px-1 text-xs text-muted-foreground hover:text-foreground"
              >
                +
              </button>
            </>
          )}
        </div>
        {addingUnder === folder.id && (
          <div className="flex gap-1 py-1" style={{ paddingLeft: (depth + 1) * 16 }}>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="New sub-folder name"
              className="h-7 text-sm"
            />
            <Button type="button" size="sm" onClick={() => handleAdd(folder.id)} disabled={isPending}>
              Add
            </Button>
          </div>
        )}
        {childrenOf(folder.id).length > 0 && (
          <ul>{childrenOf(folder.id).map((child) => renderFolder(child, depth + 1))}</ul>
        )}
      </li>
    )
  }

  return (
    <div>
      <ul data-testid="folder-tree" className="space-y-0.5">
        {topLevel.map((folder) => renderFolder(folder, 0))}
      </ul>
      {addingRoot ? (
        <div className="flex gap-1 py-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="New folder name"
            className="h-7 text-sm"
            autoFocus
          />
          <Button type="button" size="sm" onClick={() => handleAdd(null)} disabled={isPending}>
            Add
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAddingRoot(true)}
          className="mt-1 text-xs text-muted-foreground"
        >
          + Add Folder
        </Button>
      )}
    </div>
  )
}
