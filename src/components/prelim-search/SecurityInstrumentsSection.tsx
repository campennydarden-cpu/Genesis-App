'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SECURITY_INSTRUMENT_TYPES } from '@/lib/constants'
import {
  addSecurityInstrument,
  updateSecurityInstrument,
  deleteSecurityInstrument,
} from '@/app/actions/prelim-search'
import type { SecurityInstrument } from '@/lib/types'

function SecurityInstrumentFields({ instrument }: { instrument?: SecurityInstrument }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <Label htmlFor="si-type">Type</Label>
        <Select name="type" defaultValue={instrument?.type}>
          <SelectTrigger id="si-type">
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {SECURITY_INSTRUMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="si-dated_date">Dated Date</Label>
        <Input id="si-dated_date" name="dated_date" type="date" defaultValue={instrument?.dated_date ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-recorded_date">Recorded Date</Label>
        <Input id="si-recorded_date" name="recorded_date" type="date" defaultValue={instrument?.recorded_date ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-book">Book</Label>
        <Input id="si-book" name="book" defaultValue={instrument?.book ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-page">Page</Label>
        <Input id="si-page" name="page" defaultValue={instrument?.page ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-instrument_number">Instrument Number</Label>
        <Input id="si-instrument_number" name="instrument_number" defaultValue={instrument?.instrument_number ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-original_amount">Original Amount</Label>
        <Input id="si-original_amount" name="original_amount" type="number" step="0.01" defaultValue={instrument?.original_amount ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-mortgagor">Mortgagor</Label>
        <Input id="si-mortgagor" name="mortgagor" defaultValue={instrument?.mortgagor ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-mortgagee">Mortgagee</Label>
        <Input id="si-mortgagee" name="mortgagee" defaultValue={instrument?.mortgagee ?? undefined} />
      </div>
      <div>
        <Label htmlFor="si-trustee">Trustee</Label>
        <Input id="si-trustee" name="trustee" defaultValue={instrument?.trustee ?? undefined} />
      </div>
    </div>
  )
}

export function SecurityInstrumentsSection({
  orderId,
  prelimSearchId,
  instruments,
  relatedDocsSlots,
}: {
  orderId: string
  prelimSearchId: string
  instruments: SecurityInstrument[]
  // Keyed by instrument id. Note: this is pre-rendered ReactNode per instrument, not a
  // callback — a Server Component (page.tsx) cannot pass a plain function prop across
  // the RSC boundary into this Client Component, only serializable data/JSX elements.
  relatedDocsSlots?: Record<string, React.ReactNode>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <section id="security-instruments" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-semibold">Security Instruments</h2>

      <ul className="mb-6 space-y-4" data-testid="security-instrument-list">
        {instruments.map((instrument) =>
          editingId === instrument.id ? (
            <li key={instrument.id} className="rounded border p-4" data-testid="security-instrument-row-editing">
              <form
                action={async (formData) => {
                  await updateSecurityInstrument(instrument.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-4"
              >
                <SecurityInstrumentFields instrument={instrument} />
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
            <li key={instrument.id} className="rounded border p-4" data-testid="security-instrument-row">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{instrument.type}</p>
                  <p className="text-sm text-slate-500">
                    {instrument.mortgagor} → {instrument.mortgagee}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="text-sm text-slate-600 hover:underline"
                    onClick={() => setEditingId(instrument.id)}
                    aria-label={`Edit ${instrument.type}`}
                  >
                    Edit
                  </button>
                  <form action={deleteSecurityInstrument.bind(null, orderId, instrument.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
              {relatedDocsSlots?.[instrument.id]}
            </li>
          )
        )}
        {instruments.length === 0 && <p className="text-sm text-slate-500">No Security Instruments on file — Add one.</p>}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add a Security Instrument</summary>
        <form action={addSecurityInstrument.bind(null, prelimSearchId, orderId)} className="mt-4 space-y-4">
          <SecurityInstrumentFields />
          <Button type="submit">Add Security Instrument</Button>
        </form>
      </details>
    </section>
  )
}
