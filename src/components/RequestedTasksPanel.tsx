'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  listRequestedTasks,
  addRequestedTask,
  updateRequestedTaskStatus,
  updateRequestedTask,
  deleteRequestedTask,
} from '@/app/actions/requested-tasks'
import { REQUESTED_TASK_SEEDS, REQUESTED_TASK_STATUSES } from '@/lib/constants'
import type { RequestedTask } from '@/lib/types'

const STATUS_CLASSES: Record<string, string> = {
  Required: 'bg-status-pending/10 text-status-pending border-status-pending/30',
  Requested: 'bg-status-pending/10 text-status-pending border-status-pending/30',
  Received: 'bg-status-cleared/10 text-status-cleared border-status-cleared/30',
  'N/A': 'bg-muted text-muted-foreground border-transparent',
}

function DateField({
  shortLabel,
  label,
  value,
  onCommit,
}: {
  shortLabel: string
  label: string
  value: string | null
  onCommit: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-muted-foreground">{shortLabel}</span>
      <Input
        type="date"
        aria-label={label}
        defaultValue={value ?? ''}
        className="h-8 w-32 text-xs"
        onBlur={(e) => {
          if (e.target.value !== (value ?? '')) onCommit(e.target.value)
        }}
      />
    </div>
  )
}

export function RequestedTasksPanel({ orderId }: { orderId: string }) {
  const [tasks, setTasks] = useState<RequestedTask[]>([])
  const [newTaskName, setNewTaskName] = useState('')
  const [isPending, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      setTasks(await listRequestedTasks(orderId))
    })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  function handleAdd(taskName: string) {
    if (!taskName.trim()) return
    startTransition(async () => {
      await addRequestedTask(orderId, taskName.trim())
      setNewTaskName('')
      refresh()
    })
  }

  function handleStatusChange(id: string, status: string) {
    startTransition(async () => {
      await updateRequestedTaskStatus(id, orderId, status)
      refresh()
    })
  }

  function handleFieldChange(id: string, field: 'requested_date' | 'requested_due_date' | 'due_date' | 'received_date', value: string) {
    startTransition(async () => {
      await updateRequestedTask(id, orderId, { [field]: value || null })
      refresh()
    })
  }

  function handleNotesChange(id: string, notes: string) {
    startTransition(async () => {
      await updateRequestedTask(id, orderId, { notes: notes || null })
      refresh()
    })
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this requested task?')) return
    startTransition(async () => {
      await deleteRequestedTask(id, orderId)
      refresh()
    })
  }

  return (
    <div data-testid="requested-tasks-panel">
      <ul className="divide-y" data-testid="requested-task-list">
        {tasks.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center gap-3 py-2">
            <p className="w-48 shrink-0 text-sm font-medium">{task.task_name}</p>
            <DateField
              shortLabel="Requested"
              label={`Requested date for ${task.task_name}`}
              value={task.requested_date}
              onCommit={(v) => handleFieldChange(task.id, 'requested_date', v)}
            />
            <DateField
              shortLabel="Req. Due"
              label={`Requested due date for ${task.task_name}`}
              value={task.requested_due_date}
              onCommit={(v) => handleFieldChange(task.id, 'requested_due_date', v)}
            />
            <DateField
              shortLabel="Due"
              label={`Due date for ${task.task_name}`}
              value={task.due_date}
              onCommit={(v) => handleFieldChange(task.id, 'due_date', v)}
            />
            <DateField
              shortLabel="Received"
              label={`Received date for ${task.task_name}`}
              value={task.received_date}
              onCommit={(v) => handleFieldChange(task.id, 'received_date', v)}
            />
            <Input
              defaultValue={task.notes ?? ''}
              aria-label={`Notes for ${task.task_name}`}
              placeholder="Notes"
              className="h-8 w-40 text-xs"
              onBlur={(e) => {
                if (e.target.value !== (task.notes ?? '')) handleNotesChange(task.id, e.target.value)
              }}
            />
            <select
              aria-label={`Status for ${task.task_name}`}
              value={task.status}
              onChange={(e) => handleStatusChange(task.id, e.target.value)}
              className={`rounded-full border px-2 py-1 text-xs font-medium ${STATUS_CLASSES[task.status] ?? ''}`}
            >
              {REQUESTED_TASK_STATUSES.map((s) => (
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
          <li className="py-2 text-sm text-muted-foreground">No requested tasks yet.</li>
        )}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
        {REQUESTED_TASK_SEEDS.map((seed) => (
          <Button key={seed} type="button" variant="outline" size="sm" onClick={() => handleAdd(seed)} disabled={isPending}>
            + {seed}
          </Button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
          placeholder="Custom task name"
          aria-label="New requested task name"
          className="max-w-sm"
        />
        <Button type="button" onClick={() => handleAdd(newTaskName)} disabled={isPending}>
          + Add Task
        </Button>
      </div>
    </div>
  )
}
