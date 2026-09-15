'use client'

import { useState } from 'react'
import { EXCEPTION_SEEDS } from '@/lib/constants'
import {
  addExceptionFromChip,
  addExceptionManual,
  addExceptionFromTemplate,
  updateException,
  deleteException,
  moveException,
} from '@/app/actions/commitment-sch-b'
import { parseTemplateTags } from '@/lib/template-tags'
import type { CommitmentException, ExceptionMatter, PropertyEasement, ExceptionTemplate, Contact } from '@/lib/types'

export function ExceptionsSection({
  orderId,
  exceptions,
  exceptionMatters,
  beginAt,
  readOnly = false,
  propertyEasements,
  exceptionTemplates,
  contacts,
}: {
  orderId: string
  exceptions: CommitmentException[]
  exceptionMatters: ExceptionMatter[]
  beginAt: number
  readOnly?: boolean
  propertyEasements: PropertyEasement[]
  exceptionTemplates: (ExceptionTemplate & { variants: unknown[] })[]
  contacts: Contact[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const usedSources = new Set(exceptions.filter((e) => e.source_type).map((e) => `${e.source_type}:${e.source_id}`))
  const emChips = exceptionMatters.filter((em) => !usedSources.has(`em:${em.id}`))
  const easementChips = propertyEasements.filter((pe) => !usedSources.has(`easement:${pe.id}`))

  const [libraryPickerTemplate, setLibraryPickerTemplate] = useState<ExceptionTemplate | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  const topLevelTemplates = exceptionTemplates.filter((t) => !t.parent_template_id && !t.trigger_source_type)
  const filteredTemplates = topLevelTemplates.filter(
    (t) =>
      (!categoryFilter || t.category === categoryFilter) &&
      (!search || t.label.toLowerCase().includes(search.toLowerCase()))
  )

  function candidatesFor(namespace: string) {
    if (namespace === 'exception_matter') return exceptionMatters
    if (namespace === 'easement') return propertyEasements
    return []
  }

  function ambiguousNamespaces(template: ExceptionTemplate) {
    const tags = parseTemplateTags(template.body)
    const namespaces = [...new Set(tags.map((t) => t.namespace))]
    return namespaces.filter((ns) => candidatesFor(ns).length > 1)
  }

  const nonIndividualParty = contacts.some(
    (c) => (c.role === 'Buyer/Borrower' || c.role === 'Seller') && c.entity_type !== 'Individual'
  )
  const suggestedTemplates = nonIndividualParty
    ? exceptionTemplates.filter((t) => t.category === 'Entity-Confirmation' && !t.parent_template_id)
    : []

  return (
    <div className="mt-6 rounded border p-4">
      <p className="mb-4 text-lg font-semibold">Exceptions</p>

      {!readOnly && (emChips.length > 0 || easementChips.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2" data-testid="exception-chips">
          {emChips.map((em) => (
            <form key={em.id} action={addExceptionFromChip.bind(null, orderId, 'em', em.id)}>
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100" data-testid="em-exc-chip">
                + {em.description || '(no description)'}
              </button>
            </form>
          ))}
          {easementChips.map((pe) => (
            <form key={pe.id} action={addExceptionFromChip.bind(null, orderId, 'easement', pe.id)}>
              <button type="submit" className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100" data-testid="easement-exc-chip">
                + {pe.type === 'Other' && pe.other_type_text ? pe.other_type_text : pe.type}
              </button>
            </form>
          ))}
        </div>
      )}

      <ul className="mb-4 space-y-2" data-testid="exception-list">
        {exceptions.map((e, idx) =>
          !readOnly && editingId === e.id ? (
            <li key={e.id} className="rounded border p-4" data-testid="exception-row">
              <form
                action={async (formData: FormData) => {
                  await updateException(orderId, e.id, formData)
                  setEditingId(null)
                }}
                className="space-y-2"
              >
                <textarea aria-label="Description" name="description" defaultValue={e.description} rows={2} className="w-full rounded border px-3 py-2" />
                <input aria-label="Notes" name="notes" defaultValue={e.notes ?? undefined} placeholder="Notes" className="w-full rounded border px-3 py-2" />
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
              {!readOnly && (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <form action={moveException.bind(null, orderId, e.id, 'up')}>
                      <button
                        type="submit"
                        aria-label={`Move exception ${idx + 1} up`}
                        disabled={idx === 0}
                        className="block text-slate-500 hover:text-slate-900 disabled:opacity-30"
                      >
                        ▲
                      </button>
                    </form>
                    <form action={moveException.bind(null, orderId, e.id, 'down')}>
                      <button
                        type="submit"
                        aria-label={`Move exception ${idx + 1} down`}
                        disabled={idx === exceptions.length - 1}
                        className="block text-slate-500 hover:text-slate-900 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </form>
                  </div>
                  <button type="button" onClick={() => setEditingId(e.id)} className="text-sm text-slate-600 hover:underline">
                    Edit
                  </button>
                  <form action={deleteException.bind(null, orderId, e.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              )}
            </li>
          )
        )}
        {exceptions.length === 0 && <p className="text-sm text-slate-500">No exceptions added yet.</p>}
      </ul>

      {!readOnly && (
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
      )}

      {!readOnly && suggestedTemplates.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2" data-testid="entity-confirmation-suggestions">
          <p className="w-full text-xs text-slate-500">Suggested — a party&apos;s Entity Type isn&apos;t Individual:</p>
          {suggestedTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setLibraryPickerTemplate(t)}
              className="rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-xs text-amber-800 hover:bg-amber-100"
            >
              + {t.label}
            </button>
          ))}
        </div>
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
        <ExceptionLibraryPickerModal
          orderId={orderId}
          template={libraryPickerTemplate}
          ambiguousNamespaces={ambiguousNamespaces(libraryPickerTemplate)}
          candidatesFor={candidatesFor}
          onClose={() => setLibraryPickerTemplate(null)}
        />
      )}
    </div>
  )
}

function ExceptionLibraryPickerModal({
  orderId,
  template,
  ambiguousNamespaces,
  candidatesFor,
  onClose,
}: {
  orderId: string
  template: ExceptionTemplate
  ambiguousNamespaces: string[]
  candidatesFor: (namespace: string) => { id: string; [key: string]: unknown }[]
  onClose: () => void
}) {
  const [choices, setChoices] = useState<Record<string, string>>({})

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
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <form
            action={async () => {
              await addExceptionFromTemplate(orderId, template.id, choices)
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
