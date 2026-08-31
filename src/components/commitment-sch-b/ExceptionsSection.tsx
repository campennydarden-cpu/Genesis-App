'use client'

import { useState } from 'react'
import { EXCEPTION_SEEDS } from '@/lib/constants'
import { addExceptionFromChip, addExceptionManual, updateException, deleteException } from '@/app/actions/commitment-sch-b'
import type { CommitmentException, ExceptionMatter } from '@/lib/types'

export function ExceptionsSection({
  orderId,
  exceptions,
  exceptionMatters,
  beginAt,
}: {
  orderId: string
  exceptions: CommitmentException[]
  exceptionMatters: ExceptionMatter[]
  beginAt: number
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const usedSources = new Set(exceptions.filter((e) => e.source_type).map((e) => `${e.source_type}:${e.source_id}`))
  const emChips = exceptionMatters.filter((em) => !usedSources.has(`em:${em.id}`))

  return (
    <div className="mt-6 rounded border p-4">
      <p className="mb-4 text-lg font-semibold">Exceptions</p>

      {emChips.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2" data-testid="exception-chips">
          {emChips.map((em) => (
            <form key={em.id} action={addExceptionFromChip.bind(null, orderId, em.id)}>
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100" data-testid="em-exc-chip">
                + {em.description || '(no description)'}
              </button>
            </form>
          ))}
        </div>
      )}

      <ul className="mb-4 space-y-2" data-testid="exception-list">
        {exceptions.map((e, idx) =>
          editingId === e.id ? (
            <li key={e.id} className="rounded border p-4" data-testid="exception-row">
              <form
                action={async (formData: FormData) => {
                  await updateException(orderId, e.id, formData)
                  setEditingId(null)
                }}
                className="space-y-2"
              >
                <textarea name="description" defaultValue={e.description} rows={2} className="w-full rounded border px-3 py-2" />
                <input name="notes" defaultValue={e.notes ?? undefined} placeholder="Notes" className="w-full rounded border px-3 py-2" />
                <div className="flex gap-2">
                  <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded border px-3 py-1.5 text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </li>
          ) : (
            <li key={e.id} className="flex items-center justify-between rounded border p-3" data-testid="exception-row">
              <div>
                <p>
                  {beginAt + idx}. {e.description}
                </p>
                {e.notes && <p className="text-sm text-slate-500">{e.notes}</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingId(e.id)} className="text-sm text-slate-600 hover:underline">
                  Edit
                </button>
                <form action={deleteException.bind(null, orderId, e.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {exceptions.length === 0 && <p className="text-sm text-slate-500">No exceptions added yet.</p>}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add an exception</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXCEPTION_SEEDS.map((s) => (
            <form key={s} action={addExceptionManual.bind(null, orderId)}>
              <input type="hidden" name="description" value={s} />
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">
                + {s}
              </button>
            </form>
          ))}
        </div>
        <form action={addExceptionManual.bind(null, orderId)} className="mt-4 space-y-3">
          <div>
            <label htmlFor="exc-add-description" className="block text-sm font-medium">
              Description
            </label>
            <textarea id="exc-add-description" name="description" rows={2} required className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label htmlFor="exc-add-notes" className="block text-sm font-medium">
              Notes
            </label>
            <input id="exc-add-notes" name="notes" className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
            Add Exception
          </button>
        </form>
      </details>
    </div>
  )
}
