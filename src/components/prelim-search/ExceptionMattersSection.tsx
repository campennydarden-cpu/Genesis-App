'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { addExceptionMatter, updateExceptionMatter, deleteExceptionMatter } from '@/app/actions/prelim-search'
import type { ExceptionMatter } from '@/lib/types'

function ExceptionMatterFields({ matter, idPrefix }: { matter?: ExceptionMatter; idPrefix: string }) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea id={`${idPrefix}-description`} name="description" rows={2} defaultValue={matter?.description} required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-dated_date`}>Dated Date</Label>
          <Input id={`${idPrefix}-dated_date`} name="dated_date" type="date" defaultValue={matter?.dated_date ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-recorded_date`}>Recorded Date</Label>
          <Input id={`${idPrefix}-recorded_date`} name="recorded_date" type="date" defaultValue={matter?.recorded_date ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-book`}>Book</Label>
          <Input id={`${idPrefix}-book`} name="book" defaultValue={matter?.book ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-page`}>Page</Label>
          <Input id={`${idPrefix}-page`} name="page" defaultValue={matter?.page ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-instrument_number`}>Instrument Number</Label>
          <Input id={`${idPrefix}-instrument_number`} name="instrument_number" defaultValue={matter?.instrument_number ?? undefined} />
        </div>
      </div>
    </div>
  )
}

export function ExceptionMattersSection({
  orderId,
  prelimSearchId,
  matters,
}: {
  orderId: string
  prelimSearchId: string
  matters: ExceptionMatter[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <section id="exception-matters" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-semibold">Exception Matters</h2>

      <ul className="mb-6 space-y-3" data-testid="exception-matter-list">
        {matters.map((matter) =>
          editingId === matter.id ? (
            <li key={matter.id} className="rounded border p-4" data-testid="exception-matter-row-editing">
              <form
                action={async (formData) => {
                  await updateExceptionMatter(matter.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-3"
              >
                <ExceptionMatterFields matter={matter} idPrefix={`em-edit-${matter.id}`} />
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
            <li key={matter.id} className="flex items-center justify-between rounded border p-3" data-testid="exception-matter-row">
              <p className="text-sm">{matter.description}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-sm text-slate-600 hover:underline"
                  onClick={() => setEditingId(matter.id)}
                  aria-label="Edit exception matter"
                >
                  Edit
                </button>
                <form action={deleteExceptionMatter.bind(null, orderId, matter.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {matters.length === 0 && <p className="text-sm text-slate-500">No Exception Matters on file — Add one.</p>}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add an Exception Matter</summary>
        <form action={addExceptionMatter.bind(null, prelimSearchId, orderId)} className="mt-4 space-y-3">
          <ExceptionMatterFields idPrefix="em-new" />
          <Button type="submit">Add Exception Matter</Button>
        </form>
      </details>
    </section>
  )
}
