'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LIEN_TYPES, TAX_LIEN_TYPES } from '@/lib/constants'
import { addLien, updateLien, deleteLien } from '@/app/actions/prelim-search'
import type { Lien } from '@/lib/types'

type FieldKey =
  | 'debtor' | 'creditor' | 'docket_date' | 'case_number' | 'court' | 'amount'
  | 'taxing_authority' | 'tax_type' | 'filed_date' | 'book' | 'page' | 'instrument_number'
  | 'hoa_company' | 'materialman' | 'last_service_date' | 'dated_date' | 'recorded_date'
  | 'plaintiff' | 'defendant'
  | 'certificate_id' | 'redemption_expiration'

const LIEN_TYPE_FIELDS: Record<string, FieldKey[]> = {
  Judgment: ['debtor', 'creditor', 'docket_date', 'case_number', 'court', 'amount'],
  'Tax Lien': ['debtor', 'taxing_authority', 'tax_type', 'filed_date', 'amount', 'book', 'page', 'instrument_number'],
  'HOA/COA Lien': ['debtor', 'hoa_company', 'filed_date', 'amount', 'book', 'page', 'instrument_number'],
  'Mechanics Lien': ['debtor', 'materialman', 'last_service_date', 'recorded_date', 'amount', 'book', 'page', 'instrument_number'],
  'Lis Pendens': ['plaintiff', 'defendant', 'court', 'case_number'],
  'Tax Sale Certificate': ['certificate_id', 'dated_date', 'recorded_date', 'debtor', 'creditor', 'book', 'page', 'instrument_number', 'redemption_expiration'],
}

const LIEN_TYPE_FIELDS_DEFAULT: FieldKey[] = ['debtor', 'creditor', 'dated_date', 'recorded_date', 'court', 'case_number', 'amount']

const FIELD_LABELS: Record<FieldKey, string> = {
  debtor: 'Debtor',
  creditor: 'Creditor',
  docket_date: 'Docket Date',
  case_number: 'Case/Reference No.',
  court: 'Court',
  amount: 'Amount',
  taxing_authority: 'Taxing Authority',
  tax_type: 'Tax Type',
  filed_date: 'Filed Date',
  book: 'Book',
  page: 'Page',
  instrument_number: 'Instrument Number',
  hoa_company: 'HOA/COA Company',
  materialman: 'Materialman',
  last_service_date: 'Last Service Date',
  dated_date: 'Dated Date',
  recorded_date: 'Recorded/Filed Date',
  plaintiff: 'Plaintiff',
  defendant: 'Defendant',
  certificate_id: 'Certificate ID',
  redemption_expiration: 'Redemption Period Expiration',
}

const DATE_FIELDS: FieldKey[] = ['docket_date', 'filed_date', 'last_service_date', 'dated_date', 'recorded_date', 'redemption_expiration']

function fieldsForType(type: string | undefined): FieldKey[] {
  if (!type) return []
  return LIEN_TYPE_FIELDS[type] ?? LIEN_TYPE_FIELDS_DEFAULT
}

function LienFields({ lien, idPrefix }: { lien?: Lien; idPrefix: string }) {
  const [type, setType] = useState<string | undefined>(lien?.type)
  const fields = fieldsForType(type)

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}-type`}>Type</Label>
        <Select name="type" defaultValue={lien?.type} onValueChange={(value) => setType(value ?? undefined)}>
          <SelectTrigger id={`${idPrefix}-type`}>
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {LIEN_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {fields.map((f) => {
          const fieldId = `${idPrefix}-${f}`
          if (f === 'tax_type') {
            return (
              <div key={f}>
                <Label htmlFor={fieldId}>{FIELD_LABELS[f]}</Label>
                <Select name={f} defaultValue={(lien?.tax_type as string | undefined) ?? undefined}>
                  <SelectTrigger id={fieldId}>
                    <SelectValue placeholder="— Select —" />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_LIEN_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          }
          if (f === 'amount') {
            return (
              <div key={f}>
                <Label htmlFor={fieldId}>{FIELD_LABELS[f]}</Label>
                <Input id={fieldId} name={f} type="number" step="0.01" defaultValue={lien?.amount ?? undefined} />
              </div>
            )
          }
          const value = lien ? (lien[f as keyof Lien] as string | null | undefined) : undefined
          return (
            <div key={f}>
              <Label htmlFor={fieldId}>{FIELD_LABELS[f]}</Label>
              <Input id={fieldId} name={f} type={DATE_FIELDS.includes(f) ? 'date' : 'text'} defaultValue={value ?? undefined} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LiensSection({
  orderId,
  prelimSearchId,
  liens,
}: {
  orderId: string
  prelimSearchId: string
  liens: Lien[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <section id="liens" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-semibold">Liens</h2>

      <ul className="mb-6 space-y-4" data-testid="lien-list">
        {liens.map((lien) =>
          editingId === lien.id ? (
            <li key={lien.id} className="rounded border p-4" data-testid="lien-row-editing">
              <form
                action={async (formData) => {
                  await updateLien(lien.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-4"
              >
                <LienFields lien={lien} idPrefix={`lien-edit-${lien.id}`} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </li>
          ) : (
            <li key={lien.id} className="flex items-center justify-between rounded border p-4" data-testid="lien-row">
              <div>
                <p className="font-medium">{lien.type}</p>
                <p className="text-sm text-slate-500">{lien.debtor || lien.plaintiff || lien.certificate_id}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-sm text-slate-600 hover:underline"
                  onClick={() => setEditingId(lien.id)}
                  aria-label={`Edit ${lien.type}`}
                >
                  Edit
                </button>
                <form action={deleteLien.bind(null, orderId, lien.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {liens.length === 0 && <p className="text-sm text-slate-500">No Liens on file — Add one.</p>}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add a Lien</summary>
        <form action={addLien.bind(null, prelimSearchId, orderId)} className="mt-4 space-y-4">
          <LienFields idPrefix="lien-new" />
          <Button type="submit">Add Lien</Button>
        </form>
      </details>
    </section>
  )
}
