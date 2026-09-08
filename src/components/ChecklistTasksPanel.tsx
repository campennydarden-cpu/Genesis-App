'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  listChecklistTasks,
  addChecklistTask,
  updateChecklistTaskStatus,
  updateChecklistTaskDueDate,
  deleteChecklistTask,
} from '@/app/actions/checklist-tasks'
import { CHECKLIST_MILESTONES, CHECKLIST_TASK_STATUSES } from '@/lib/constants'
import type { ChecklistTask } from '@/lib/types'

const STATUS_CLASSES: Record<string, string> = {
  Required: 'bg-status-pending/10 text-status-pending border-status-pending/30',
  Completed: 'bg-status-cleared/10 text-status-cleared border-status-cleared/30',
  'N/A': 'bg-muted text-muted-foreground border-transparent',
}

export function ChecklistTasksPanel({ orderId }: { orderId: string }) {
  const [tasks, setTasks] = useState<ChecklistTask[]>([])
  const [addingDescription, setAddingDescription] = useState('')
  const [addingMilestone, setAddingMilestone] = useState<(typeof CHECKLIST_MILESTONES)[number]>(
    CHECKLIST_MILESTONES[0]
  )
  const [isPending, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      setTasks(await listChecklistTasks(orderId))
    })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  function handleAdd() {
    if (!addingDescription.trim()) return
    startTransition(async () => {
      await addChecklistTask(orderId, addingDescription.trim(), addingMilestone)
      setAddingDescription('')
      refresh()
    })
  }

  function handleStatusChange(id: string, status: string) {
    startTransition(async () => {
      await updateChecklistTaskStatus(id, orderId, status)
      refresh()
    })
  }

  function handleDueDateChange(id: string, dueDate: string) {
    startTransition(async () => {
      await updateChecklistTaskDueDate(id, orderId, dueDate || null)
      refresh()
    })
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this checklist task?')) return
    startTransition(async () => {
      await deleteChecklistTask(id, orderId)
      refresh()
    })
  }

  return (
    <div data-testid="checklist-tasks-panel">
      <ul className="divide-y" data-testid="checklist-task-list">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-3 py-2">
            <div className="flex-1">
              <p className="text-sm font-medium">{task.description}</p>
              <p className="text-xs text-muted-foreground">{task.milestone}</p>
            </div>
            <Input
              type="date"
              aria-label={`Due date for ${task.description}`}
              defaultValue={task.due_date ?? ''}
              className="h-8 w-36 text-xs"
              onBlur={(e) => {
                if (e.target.value !== (task.due_date ?? '')) handleDueDateChange(task.id, e.target.value)
              }}
            />
            {task.completed_date && (
              <span className="text-xs text-muted-foreground">Completed {task.completed_date}</span>
            )}
            <select
              aria-label={`Status for ${task.description}`}
              value={task.status}
              onChange={(e) => handleStatusChange(task.id, e.target.value)}
              className={`rounded-full border px-2 py-1 text-xs font-medium ${STATUS_CLASSES[task.status] ?? ''}`}
            >
              {CHECKLIST_TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleDelete(task.id)}
              className="text-xs text-destructive hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
        {tasks.length === 0 && !isPending && (
          <li className="py-2 text-sm text-muted-foreground">No checklist tasks yet.</li>
        )}
      </ul>

      <div className="mt-4 flex gap-2 border-t pt-3">
        <Input
          value={addingDescription}
          onChange={(e) => setAddingDescription(e.target.value)}
          placeholder="New task description"
          aria-label="New checklist task description"
          className="max-w-sm"
        />
        <select
          aria-label="New checklist task milestone"
          className="rounded border px-2 py-1 text-sm"
          value={addingMilestone}
          onChange={(e) => setAddingMilestone(e.target.value as (typeof CHECKLIST_MILESTONES)[number])}
        >
          {CHECKLIST_MILESTONES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <Button type="button" onClick={handleAdd} disabled={isPending}>
          + Add Task
        </Button>
      </div>
    </div>
  )
}
