'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createFolderTemplate, renameFolderTemplate, deleteFolderTemplate } from '@/app/actions/folder-templates'
import type { FolderTemplate } from '@/lib/types'

export function FolderTemplateAdmin({ templates }: { templates: FolderTemplate[] }) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const topLevel = templates.filter((t) => !t.parent_folder_template_id)
  const childrenOf = (id: string) => templates.filter((t) => t.parent_folder_template_id === id)

  function refresh() {
    // ponytail: full reload keeps this simple; this screen is used rarely enough
    // that a router.refresh()-based no-flash update isn't worth the extra wiring
    window.location.reload()
  }

  function handleCreate() {
    if (!newName.trim()) return
    startTransition(async () => {
      const result = await createFolderTemplate(null, newName.trim())
      if (result.error) setError(result.error)
      else {
        setNewName('')
        refresh()
      }
    })
  }

  function handleRename(id: string, name: string) {
    startTransition(async () => {
      const result = await renameFolderTemplate(id, name)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteFolderTemplate(id)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function renderRow(template: FolderTemplate, depth: number) {
    return (
      <li key={template.id} className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 24 }}>
        <Input
          defaultValue={template.name}
          aria-label={`Rename ${template.name}`}
          className="max-w-xs"
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== template.name) {
              handleRename(template.id, e.target.value.trim())
            }
          }}
        />
        <span className="text-xs text-muted-foreground">order {template.sort_order}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(template.id)} disabled={isPending}>
          Delete
        </Button>
      </li>
    )
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="mb-4 flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New top-level folder name"
          aria-label="New folder name"
          className="max-w-xs"
        />
        <Button type="button" onClick={handleCreate} disabled={isPending}>
          Add Folder
        </Button>
      </div>

      <ul>
        {topLevel.map((template) => (
          <li key={template.id}>
            {renderRow(template, 0)}
            <ul>{childrenOf(template.id).map((child) => renderRow(child, 1))}</ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
