'use client'

import { useState } from 'react'
import { REQUIREMENT_SEEDS } from '@/lib/constants'
import { computeReqLabels, reorderForNumbering } from '@/lib/commitment-text'
import {
  addRequirementFromChip,
  addRequirementManual,
  addRequirementFromTemplate,
  updateRequirement,
  deleteRequirement,
  moveRequirement,
} from '@/app/actions/commitment-sch-b'
import { parseTemplateTags } from '@/lib/template-tags'
import type {
  CommitmentRequirement,
  SecurityInstrument,
  SecurityInstrumentRelatedDoc,
  Lien,
  RequirementTemplate,
  Contact,
} from '@/lib/types'

export function RequirementsSection({
  orderId,
  requirements,
  securityInstruments,
  relatedDocs,
  liens,
  beginAt,
  readOnly = false,
  requirementTemplates,
  contacts,
}: {
  orderId: string
  requirements: CommitmentRequirement[]
  securityInstruments: SecurityInstrument[]
  relatedDocs: SecurityInstrumentRelatedDoc[]
  liens: Lien[]
  beginAt: number
  readOnly?: boolean
  requirementTemplates: (RequirementTemplate & { variants: unknown[] })[]
  contacts: Contact[]
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
  // Sub-items move with their parent, not independently — reorder controls only apply
  // to top-level rows, so track each one's position among just its top-level siblings.
  const topLevelIds = orderedRequirements.filter((r) => !r.parent_requirement_id).map((r) => r.id)

  const [libraryPickerTemplate, setLibraryPickerTemplate] = useState<RequirementTemplate | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  const childTemplates = (parentId: string) => requirementTemplates.filter((t) => t.parent_template_id === parentId)
  const topLevelTemplates = requirementTemplates.filter((t) => !t.parent_template_id)
  const filteredTemplates = topLevelTemplates.filter(
    (t) =>
      (!categoryFilter || t.category === categoryFilter) &&
      (!search || t.label.toLowerCase().includes(search.toLowerCase()))
  )

  function candidatesFor(namespace: string) {
    if (namespace === 'security_instrument') return securityInstruments
    if (namespace === 'lien') return liens
    return []
  }

  function ambiguousNamespaces(template: RequirementTemplate) {
    const tags = [
      ...parseTemplateTags(template.body),
      ...childTemplates(template.id).flatMap((c) => parseTemplateTags(c.body)),
    ]
    const namespaces = [...new Set(tags.map((t) => t.namespace))]
    return namespaces.filter((ns) => candidatesFor(ns).length > 1)
  }

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
                <div className="flex items-center gap-3">
                  {!r.parent_requirement_id && (
                    <div className="flex flex-col">
                      <form action={moveRequirement.bind(null, orderId, r.id, 'up')}>
                        <button
                          type="submit"
                          aria-label={`Move ${labels[idx]} up`}
                          disabled={topLevelIds.indexOf(r.id) === 0}
                          className="block text-slate-500 hover:text-slate-900 disabled:opacity-30"
                        >
                          ▲
                        </button>
                      </form>
                      <form action={moveRequirement.bind(null, orderId, r.id, 'down')}>
                        <button
                          type="submit"
                          aria-label={`Move ${labels[idx]} down`}
                          disabled={topLevelIds.indexOf(r.id) === topLevelIds.length - 1}
                          className="block text-slate-500 hover:text-slate-900 disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </form>
                    </div>
                  )}
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

      {!readOnly && (
        <details className="mt-4 rounded border p-4">
          <summary className="cursor-pointer font-medium">From Library</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded border px-2 py-1 text-sm">
              <option value="">All categories</option>
              {[...new Set(topLevelTemplates.map((t) => t.category))].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="rounded border px-2 py-1 text-sm"
            />
          </div>
          <ul className="mt-3 space-y-1">
            {filteredTemplates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setLibraryPickerTemplate(t)}
                  className="w-full rounded border px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="text-xs uppercase text-slate-500">{t.category}</span> — {t.label}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {libraryPickerTemplate && (
        <LibraryPickerModal
          orderId={orderId}
          template={libraryPickerTemplate}
          children={childTemplates(libraryPickerTemplate.id)}
          ambiguousNamespaces={ambiguousNamespaces(libraryPickerTemplate)}
          candidatesFor={candidatesFor}
          onClose={() => setLibraryPickerTemplate(null)}
        />
      )}
    </div>
  )
}

function LibraryPickerModal({
  orderId,
  template,
  children,
  ambiguousNamespaces,
  candidatesFor,
  onClose,
}: {
  orderId: string
  template: RequirementTemplate
  children: RequirementTemplate[]
  ambiguousNamespaces: string[]
  candidatesFor: (namespace: string) => { id: string; [key: string]: unknown }[]
  onClose: () => void
}) {
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [checkedChildren, setCheckedChildren] = useState<string[]>([])

  const namespaceLabel = (record: { [key: string]: unknown }) =>
    (record.type as string) || (record.description as string) || 'Record'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-4">
        <p className="mb-3 font-medium">{template.label}</p>
        {ambiguousNamespaces.map((ns) => (
          <div key={ns} className="mb-3">
            <p className="mb-1 text-sm font-medium">Which {ns.replace('_', ' ')}?</p>
            {candidatesFor(ns).map((record) => (
              <label key={record.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={ns}
                  checked={choices[ns] === record.id}
                  onChange={() => setChoices((c) => ({ ...c, [ns]: record.id }))}
                />
                {namespaceLabel(record)}
              </label>
            ))}
          </div>
        ))}
        {children.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-sm font-medium">Include:</p>
            {children.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checkedChildren.includes(c.id)}
                  onChange={(e) =>
                    setCheckedChildren((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                  }
                />
                {c.label}
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <form
            action={async () => {
              await addRequirementFromTemplate(orderId, template.id, null, choices, checkedChildren)
              onClose()
            }}
          >
            <button
              type="submit"
              disabled={ambiguousNamespaces.some((ns) => !choices[ns])}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
