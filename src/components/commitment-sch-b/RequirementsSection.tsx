'use client'

import { useState } from 'react'
import { REQUIREMENT_SEEDS } from '@/lib/constants'
import { computeReqLabels, reorderForNumbering } from '@/lib/commitment-text'
import { addRequirementFromChip, addRequirementManual, updateRequirement, deleteRequirement } from '@/app/actions/commitment-sch-b'
import type { CommitmentRequirement, SecurityInstrument, SecurityInstrumentRelatedDoc, Lien } from '@/lib/types'

export function RequirementsSection({
  orderId,
  requirements,
  securityInstruments,
  relatedDocs,
  liens,
  beginAt,
  readOnly = false,
}: {
  orderId: string
  requirements: CommitmentRequirement[]
  securityInstruments: SecurityInstrument[]
  relatedDocs: SecurityInstrumentRelatedDoc[]
  liens: Lien[]
  beginAt: number
  readOnly?: boolean
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const usedSources = new Set(
    requirements.filter((r) => r.source_type).map((r) => `${r.source_type}:${r.source_id}`)
  )

  const siChips = securityInstruments.filter((si) => !usedSources.has(`si:${si.id}`))

  const relChips: { rel: SecurityInstrumentRelatedDoc; si: SecurityInstrument; parentReqId: string }[] = []
  securityInstruments.forEach((si) => {
    const parentReq = requirements.find((r) => r.source_type === 'si' && r.source_id === si.id)
    if (!parentReq) return
    relatedDocs
      .filter((rd) => rd.security_instrument_id === si.id && !usedSources.has(`rel:${rd.id}`))
      .forEach((rd) => relChips.push({ rel: rd, si, parentReqId: parentReq.id }))
  })

  const lienChips = liens.filter((l) => !usedSources.has(`lien:${l.id}`))

  // Group each parent with its own sub-items before numbering, and render in that same
  // order so a sub-item is displayed under the parent whose number it carries.
  const orderedRequirements = reorderForNumbering(requirements)
  const labels = computeReqLabels(orderedRequirements, beginAt)

  return (
    <div className="rounded border p-4">
      <p className="mb-4 text-lg font-semibold">Requirements</p>

      {!readOnly && (siChips.length > 0 || relChips.length > 0 || lienChips.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2" data-testid="requirement-chips">
          {siChips.map((si) => (
            <form key={si.id} action={addRequirementFromChip.bind(null, orderId, 'si', si.id, null)}>
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100" data-testid="si-req-chip">
                + {si.type || 'Security Instrument'}: {si.mortgagor || '?'} → {si.mortgagee || '?'}
              </button>
            </form>
          ))}
          {relChips.map(({ rel, parentReqId }) => (
            <form key={rel.id} action={addRequirementFromChip.bind(null, orderId, 'rel', rel.id, parentReqId)}>
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100" data-testid="rel-req-chip">
                + {rel.type || 'Related Document'} (sub-item)
              </button>
            </form>
          ))}
          {lienChips.map((l) => (
            <form key={l.id} action={addRequirementFromChip.bind(null, orderId, 'lien', l.id, null)}>
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100" data-testid="lien-req-chip">
                + {l.type}: {l.creditor || l.debtor || '(no description)'}
              </button>
            </form>
          ))}
        </div>
      )}

      <ul className="mb-4 space-y-2" data-testid="requirement-list">
        {orderedRequirements.map((r, idx) =>
          !readOnly && editingId === r.id ? (
            <li key={r.id} className="rounded border p-4" data-testid="requirement-row">
              <form
                action={async (formData: FormData) => {
                  await updateRequirement(orderId, r.id, formData)
                  setEditingId(null)
                }}
                className="space-y-2"
              >
                <textarea aria-label="Description" name="description" defaultValue={r.description} rows={2} className="w-full rounded border px-3 py-2" />
                <input aria-label="Notes" name="notes" defaultValue={r.notes ?? undefined} placeholder="Notes" className="w-full rounded border px-3 py-2" />
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
            <li
              key={r.id}
              className={`flex items-center justify-between rounded border p-3 ${r.parent_requirement_id ? 'ml-6' : ''}`}
              data-testid="requirement-row"
            >
              <div>
                <p>
                  {labels[idx]}. {r.description}
                </p>
                {r.notes && <p className="text-sm text-slate-500">{r.notes}</p>}
              </div>
              {!readOnly && (
                <div className="flex gap-3">
                  <button type="button" onClick={() => setEditingId(r.id)} className="text-sm text-slate-600 hover:underline">
                    Edit
                  </button>
                  <form action={deleteRequirement.bind(null, orderId, r.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              )}
            </li>
          )
        )}
        {requirements.length === 0 && <p className="text-sm text-slate-500">No requirements added yet.</p>}
      </ul>

      {!readOnly && (
        <details className="rounded border p-4">
          <summary className="cursor-pointer font-medium">Add a requirement</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {REQUIREMENT_SEEDS.map((s) => (
              <form key={s} action={addRequirementManual.bind(null, orderId)}>
                <input type="hidden" name="description" value={s} />
                <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">
                  + {s}
                </button>
              </form>
            ))}
          </div>
          <form action={addRequirementManual.bind(null, orderId)} className="mt-4 space-y-3">
            <div>
              <label htmlFor="req-add-description" className="block text-sm font-medium">
                Description
              </label>
              <textarea id="req-add-description" name="description" rows={2} required className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div>
              <label htmlFor="req-add-notes" className="block text-sm font-medium">
                Notes
              </label>
              <input id="req-add-notes" name="notes" className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
              Add Requirement
            </button>
          </form>
        </details>
      )}
    </div>
  )
}
