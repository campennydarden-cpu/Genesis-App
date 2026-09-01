import { REQUIREMENT_DISPOSITIONS } from '@/lib/constants'
import { computeReqLabels, reorderForNumbering } from '@/lib/commitment-text'
import { deleteRequirement } from '@/app/actions/commitment-sch-b'
import { updateRequirementDisposition } from '@/app/actions/curative'
import type { CommitmentRequirement } from '@/lib/types'

export function CurativeRequirementsSection({
  orderId,
  requirements,
  beginAt,
  commitmentStatus,
}: {
  orderId: string
  requirements: CommitmentRequirement[]
  beginAt: number
  commitmentStatus: 'draft' | 'final'
}) {
  const orderedRequirements = reorderForNumbering(requirements)
  const labels = computeReqLabels(orderedRequirements, beginAt)

  return (
    <div className="rounded border p-4">
      <p className="mb-4 text-lg font-semibold">Requirements</p>
      <ul className="space-y-2" data-testid="curative-requirement-list">
        {orderedRequirements.map((r, idx) => (
          <li
            key={r.id}
            className={`rounded border p-3 ${r.parent_requirement_id ? 'ml-6' : ''}`}
            data-testid="curative-requirement-row"
          >
            <p>
              {labels[idx]}. {r.description}
            </p>
            {r.notes && <p className="text-sm text-slate-500">{r.notes}</p>}

            {commitmentStatus === 'draft' ? (
              <form action={deleteRequirement.bind(null, orderId, r.id)} className="mt-2">
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  Remove
                </button>
              </form>
            ) : (
              <form action={updateRequirementDisposition.bind(null, orderId, r.id)} className="mt-2 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor={`req-disposition-${r.id}`} className="block text-xs font-medium">
                    Disposition
                  </label>
                  <select
                    id={`req-disposition-${r.id}`}
                    name="disposition"
                    defaultValue={r.disposition ?? ''}
                    className="mt-1 rounded border px-2 py-1 text-sm"
                  >
                    <option value="">— Select —</option>
                    {REQUIREMENT_DISPOSITIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`req-disposition-notes-${r.id}`} className="block text-xs font-medium">
                    Disposition Notes
                  </label>
                  <input
                    id={`req-disposition-notes-${r.id}`}
                    name="disposition_notes"
                    defaultValue={r.disposition_notes ?? ''}
                    className="mt-1 rounded border px-2 py-1 text-sm"
                  />
                </div>
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="dont_show" defaultChecked={r.dont_show} />
                  Don&apos;t Show
                </label>
                <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                  Save
                </button>
              </form>
            )}
          </li>
        ))}
        {requirements.length === 0 && <p className="text-sm text-slate-500">No requirements on file.</p>}
      </ul>
    </div>
  )
}
