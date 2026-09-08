'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
} from '@/app/actions/checklist-templates'
import { CHECKLIST_MILESTONES } from '@/lib/constants'
import type { ChecklistTaskTemplate } from '@/lib/types'

export function ChecklistTemplateAdmin({ templates }: { templates: ChecklistTaskTemplate[] }) {
  const [newDescription, setNewDescription] = useState('')
  const [newMilestone, setNewMilestone] = useState<(typeof CHECKLIST_MILESTONES)[number]>(CHECKLIST_MILESTONES[0])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // ponytail: full reload keeps this simple; this screen is used rarely enough
  // that a router.refresh()-based no-flash update isn't worth the extra wiring
  function refresh() {
    window.location.reload()
  }

  function handleCreate() {
    if (!newDescription.trim()) return
    startTransition(async () => {
      const result = await createChecklistTemplate(newDescription.trim(), newMilestone)
      if (result.error) setError(result.error)
      else {
        setNewDescription('')
        refresh()
      }
    })
  }

  function handleUpdate(template: ChecklistTaskTemplate, description: string, milestone: string) {
    startTransition(async () => {
      const result = await updateChecklistTemplate(
        template.id,
        description,
        milestone as (typeof CHECKLIST_MILESTONES)[number]
      )
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteChecklistTemplate(id)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="mb-4 flex gap-2">
        <Input
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="New checklist task description"
          aria-label="New checklist task description"
          className="max-w-sm"
        />
        <select
          aria-label="New checklist task milestone"
          className="rounded border px-2 py-1 text-sm"
          value={newMilestone}
          onChange={(e) => setNewMilestone(e.target.value as (typeof CHECKLIST_MILESTONES)[number])}
        >
          {CHECKLIST_MILESTONES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <Button type="button" onClick={handleCreate} disabled={isPending}>
          Add Task
        </Button>
      </div>

      <ul className="divide-y">
        {templates.map((template) => (
          <li key={template.id} className="flex items-center gap-2 py-1">
            <Input
              defaultValue={template.description}
              aria-label={`Description for ${template.description}`}
              className="max-w-sm"
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== template.description) {
                  handleUpdate(template, e.target.value.trim(), template.milestone)
                }
              }}
            />
            <select
              aria-label={`Milestone for ${template.description}`}
              className="rounded border px-2 py-1 text-sm"
              defaultValue={template.milestone}
              onChange={(e) => handleUpdate(template, template.description, e.target.value)}
            >
              {CHECKLIST_MILESTONES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">order {template.sort_order}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    'Delete this checklist task template? It will no longer be added to future orders.'
                  )
                ) {
                  handleDelete(template.id)
                }
              }}
              disabled={isPending}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
