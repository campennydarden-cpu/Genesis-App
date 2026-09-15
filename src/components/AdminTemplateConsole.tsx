'use client'

import { useState } from 'react'
import { TEMPLATE_CATEGORIES } from '@/lib/constants'
import {
  createRequirementTemplate,
  updateRequirementTemplate,
  setRequirementTemplateActive,
  upsertRequirementTemplateVariant,
  deleteRequirementTemplateVariant,
} from '@/app/actions/requirement-templates'
import {
  createExceptionTemplate,
  updateExceptionTemplate,
  setExceptionTemplateActive,
  upsertExceptionTemplateVariant,
  deleteExceptionTemplateVariant,
} from '@/app/actions/exception-templates'
import type {
  RequirementTemplate,
  RequirementTemplateVariant,
  ExceptionTemplate,
  ExceptionTemplateVariant,
} from '@/lib/types'

type TemplateWithVariants<T> = T & { variants: (RequirementTemplateVariant | ExceptionTemplateVariant)[] }

function TemplateList<T extends { id: string; category: string; label: string; body: string; active: boolean }>({
  templates,
  create,
  update,
  setActive,
  upsertVariant,
  deleteVariant,
}: {
  templates: TemplateWithVariants<T>[]
  create: (formData: FormData) => Promise<void>
  update: (templateId: string, formData: FormData) => Promise<void>
  setActive: (templateId: string, active: boolean) => Promise<void>
  upsertVariant: (templateId: string, formData: FormData) => Promise<void>
  deleteVariant: (variantId: string) => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {templates.map((t) => (
        <div key={t.id} className="rounded border p-4">
          {editingId === t.id ? (
            <form
              action={async (formData: FormData) => {
                await update(t.id, formData)
                setEditingId(null)
              }}
              className="space-y-2"
            >
              <select name="category" defaultValue={t.category} className="rounded border px-2 py-1">
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input name="label" defaultValue={t.label} className="w-full rounded border px-3 py-2" />
              <textarea name="body" defaultValue={t.body} rows={3} className="w-full rounded border px-3 py-2 font-mono text-sm" />
              <div className="flex gap-2">
                <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                  Save
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="rounded border px-3 py-1.5 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500">{t.category}</p>
                <p className="font-medium">{t.label}</p>
                <p className="mt-1 whitespace-pre-wrap font-mono text-sm text-slate-600">{t.body}</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingId(t.id)} className="text-sm text-slate-600 hover:underline">
                  Edit
                </button>
                <form action={setActive.bind(null, t.id, !t.active)}>
                  <button type="submit" className="text-sm text-slate-600 hover:underline">
                    {t.active ? 'Deactivate' : 'Activate'}
                  </button>
                </form>
              </div>
            </div>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-slate-500">
              State variants ({t.variants.filter((v) => v.state !== null).length})
            </summary>
            <ul className="mt-2 space-y-2">
              {t.variants
                .filter((v) => v.state !== null)
                .map((v) => (
                  <li key={v.id} className="rounded border p-2 text-sm">
                    <p className="font-medium">{v.state}</p>
                    <p className="whitespace-pre-wrap font-mono">{v.body}</p>
                    <form action={deleteVariant.bind(null, v.id)}>
                      <button type="submit" className="text-red-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
            </ul>
            <form action={upsertVariant.bind(null, t.id)} className="mt-2 space-y-2">
              <input name="state" placeholder="State (e.g. TX)" required className="rounded border px-2 py-1" />
              <textarea name="body" placeholder="State-specific wording" rows={2} required className="w-full rounded border px-3 py-2 font-mono text-sm" />
              <button type="submit" className="rounded border px-3 py-1.5 text-sm">
                Add/Update Variant
              </button>
            </form>
          </details>
        </div>
      ))}

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add a template</summary>
        <form action={create} className="mt-3 space-y-2">
          <select name="category" className="rounded border px-2 py-1">
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input name="label" placeholder="Label" required className="w-full rounded border px-3 py-2" />
          <textarea name="body" placeholder="Body (use {{namespace.field}} for smart tags)" rows={3} required className="w-full rounded border px-3 py-2 font-mono text-sm" />
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
            Add Template
          </button>
        </form>
      </details>
    </div>
  )
}

export function AdminTemplateConsole({
  requirementTemplates,
  exceptionTemplates,
}: {
  requirementTemplates: TemplateWithVariants<RequirementTemplate>[]
  exceptionTemplates: TemplateWithVariants<ExceptionTemplate>[]
}) {
  const [tab, setTab] = useState<'requirements' | 'exceptions'>('requirements')

  return (
    <div>
      <div className="mb-4 flex gap-4 border-b">
        <button
          type="button"
          onClick={() => setTab('requirements')}
          className={`pb-2 ${tab === 'requirements' ? 'border-b-2 border-slate-900 font-medium' : 'text-slate-500'}`}
        >
          Requirements
        </button>
        <button
          type="button"
          onClick={() => setTab('exceptions')}
          className={`pb-2 ${tab === 'exceptions' ? 'border-b-2 border-slate-900 font-medium' : 'text-slate-500'}`}
        >
          Exceptions
        </button>
      </div>

      {tab === 'requirements' ? (
        <TemplateList
          templates={requirementTemplates}
          create={createRequirementTemplate}
          update={updateRequirementTemplate}
          setActive={setRequirementTemplateActive}
          upsertVariant={upsertRequirementTemplateVariant}
          deleteVariant={deleteRequirementTemplateVariant}
        />
      ) : (
        <TemplateList
          templates={exceptionTemplates}
          create={createExceptionTemplate}
          update={updateExceptionTemplate}
          setActive={setExceptionTemplateActive}
          upsertVariant={upsertExceptionTemplateVariant}
          deleteVariant={deleteExceptionTemplateVariant}
        />
      )}
    </div>
  )
}
