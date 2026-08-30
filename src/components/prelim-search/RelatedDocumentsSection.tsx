'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RELATED_DOC_TYPES, RELATED_DOC_ASSIGNMENT_TYPES } from '@/lib/constants'
import { addRelatedDoc, updateRelatedDoc, deleteRelatedDoc } from '@/app/actions/prelim-search'
import type { SecurityInstrumentRelatedDoc } from '@/lib/types'

function isAssignmentType(type: string | undefined) {
  return !!type && (RELATED_DOC_ASSIGNMENT_TYPES as readonly string[]).includes(type)
}

function RelatedDocFields({ doc, idPrefix }: { doc?: SecurityInstrumentRelatedDoc; idPrefix: string }) {
  const [type, setType] = useState<string | undefined>(doc?.type)

  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <Label htmlFor={`${idPrefix}-type`}>Type</Label>
        <Select name="type" defaultValue={doc?.type} onValueChange={(value) => setType(value ?? undefined)}>
          <SelectTrigger id={`${idPrefix}-type`}>
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {RELATED_DOC_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-dated_date`}>Dated Date</Label>
        <Input id={`${idPrefix}-dated_date`} name="dated_date" type="date" defaultValue={doc?.dated_date ?? undefined} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-recorded_date`}>Recorded Date</Label>
        <Input id={`${idPrefix}-recorded_date`} name="recorded_date" type="date" defaultValue={doc?.recorded_date ?? undefined} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-book`}>Book</Label>
        <Input id={`${idPrefix}-book`} name="book" defaultValue={doc?.book ?? undefined} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-page`}>Page</Label>
        <Input id={`${idPrefix}-page`} name="page" defaultValue={doc?.page ?? undefined} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-instrument_number`}>Instrument Number</Label>
        <Input id={`${idPrefix}-instrument_number`} name="instrument_number" defaultValue={doc?.instrument_number ?? undefined} />
      </div>
      {isAssignmentType(type) && (
        <>
          <div>
            <Label htmlFor={`${idPrefix}-assignor`}>Assignor</Label>
            <Input id={`${idPrefix}-assignor`} name="assignor" defaultValue={doc?.assignor ?? undefined} />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-assignee`}>Assignee</Label>
            <Input id={`${idPrefix}-assignee`} name="assignee" defaultValue={doc?.assignee ?? undefined} />
          </div>
        </>
      )}
      <div className="col-span-3">
        <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
        <Textarea id={`${idPrefix}-notes`} name="notes" rows={2} defaultValue={doc?.notes ?? undefined} />
      </div>
    </div>
  )
}

export function RelatedDocumentsSection({
  orderId,
  securityInstrumentId,
  docs,
}: {
  orderId: string
  securityInstrumentId: string
  docs: SecurityInstrumentRelatedDoc[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="mt-3 border-t pt-3" data-testid="related-docs-section">
      <p className="mb-2 text-sm font-medium">Related Documents</p>
      <ul className="mb-3 space-y-3">
        {docs.map((doc) =>
          editingId === doc.id ? (
            <li key={doc.id} className="rounded border p-3" data-testid="related-doc-row-editing">
              <form
                action={async (formData) => {
                  await updateRelatedDoc(doc.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-3"
              >
                <RelatedDocFields doc={doc} idPrefix={`rd-edit-${doc.id}`} />
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
            <li key={doc.id} className="flex items-center justify-between rounded border p-3" data-testid="related-doc-row">
              <div>
                <p className="text-sm font-medium">{doc.type}</p>
                {isAssignmentType(doc.type) && (
                  <p className="text-xs text-slate-500">
                    {doc.assignor} → {doc.assignee}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-sm text-slate-600 hover:underline"
                  onClick={() => setEditingId(doc.id)}
                  aria-label={`Edit ${doc.type}`}
                >
                  Edit
                </button>
                <form action={deleteRelatedDoc.bind(null, orderId, doc.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {docs.length === 0 && <p className="text-sm text-slate-500">No Related Documents on file.</p>}
      </ul>

      <details className="rounded border p-3">
        <summary className="cursor-pointer text-sm font-medium">Add a Related Document</summary>
        <form action={addRelatedDoc.bind(null, securityInstrumentId, orderId)} className="mt-3 space-y-3">
          <RelatedDocFields idPrefix={`rd-new-${securityInstrumentId}`} />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      </details>
    </div>
  )
}
