import { EXCEPTION_DISPOSITIONS } from '@/lib/constants'
import { deleteException } from '@/app/actions/commitment-sch-b'
import { updateExceptionDisposition } from '@/app/actions/curative'
import type { CommitmentException } from '@/lib/types'

export function CurativeExceptionsSection({
  orderId,
  exceptions,
  beginAt,
  commitmentStatus,
}: {
  orderId: string
  exceptions: CommitmentException[]
  beginAt: number
  commitmentStatus: 'draft' | 'final'
}) {
  return (
    <div className="mt-6 rounded border p-4">
      <p className="mb-4 text-lg font-semibold">Exceptions</p>
      <ul className="space-y-2" data-testid="curative-exception-list">
        {exceptions.map((e, idx) => (
          <li key={e.id} className="rounded border p-3" data-testid="curative-exception-row">
            <p>
              {beginAt + idx}. {e.description}
            </p>
            {e.notes && <p className="text-sm text-slate-500">{e.notes}</p>}

            {commitmentStatus === 'draft' ? (
              <form action={deleteException.bind(null, orderId, e.id)} className="mt-2">
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  Remove
                </button>
              </form>
            ) : (
              <form action={updateExceptionDisposition.bind(null, orderId, e.id)} className="mt-2 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor={`exc-disposition-${e.id}`} className="block text-xs font-medium">
                    Disposition
                  </label>
                  <select
                    id={`exc-disposition-${e.id}`}
                    name="disposition"
                    defaultValue={e.disposition ?? ''}
                    className="mt-1 rounded border px-2 py-1 text-sm"
                  >
                    <option value="">— Select —</option>
                    {EXCEPTION_DISPOSITIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`exc-disposition-notes-${e.id}`} className="block text-xs font-medium">
                    Disposition Notes
                  </label>
                  <input
                    id={`exc-disposition-notes-${e.id}`}
                    name="disposition_notes"
                    defaultValue={e.disposition_notes ?? ''}
                    className="mt-1 rounded border px-2 py-1 text-sm"
                  />
                </div>
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="dont_show" defaultChecked={e.dont_show} />
                  Don&apos;t Show
                </label>
                <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                  Save
                </button>
              </form>
            )}
          </li>
        ))}
        {exceptions.length === 0 && <p className="text-sm text-slate-500">No exceptions on file.</p>}
      </ul>
    </div>
  )
}
