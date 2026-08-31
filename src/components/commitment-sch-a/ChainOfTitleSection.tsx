'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addChainOfTitleEntry, updateChainOfTitleEntry, deleteChainOfTitleEntry } from '@/app/actions/commitment-sch-a'
import type { ChainOfTitleEntry } from '@/lib/types'

type DerivationSeed = { instrumentType: string; grantor: string; grantee: string } | null

function ChainOfTitleFields({
  entry,
  idPrefix,
  seedValues,
}: {
  entry?: ChainOfTitleEntry
  idPrefix: string
  seedValues?: DerivationSeed
}) {
  const [instrumentType, setInstrumentType] = useState(entry?.instrument_type ?? '')
  const [grantor, setGrantor] = useState(entry?.grantor ?? '')
  const [grantee, setGrantee] = useState(entry?.grantee ?? '')

  return (
    <div className="space-y-3">
      {seedValues && (
        <button
          type="button"
          className="text-sm text-slate-600 underline"
          onClick={() => {
            setInstrumentType(seedValues.instrumentType)
            setGrantor(seedValues.grantor)
            setGrantee(seedValues.grantee)
          }}
        >
          + Copy from Derivation ({seedValues.grantor || '?'} → {seedValues.grantee || '?'})
        </button>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-instrument_type`}>Instrument Type</Label>
          <Input
            id={`${idPrefix}-instrument_type`}
            name="instrument_type"
            value={instrumentType}
            onChange={(e) => setInstrumentType(e.target.value)}
            placeholder="e.g. Warranty Deed"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-grantor`}>Grantor</Label>
          <Input id={`${idPrefix}-grantor`} name="grantor" value={grantor} onChange={(e) => setGrantor(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-grantee`}>Grantee</Label>
          <Input id={`${idPrefix}-grantee`} name="grantee" value={grantee} onChange={(e) => setGrantee(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-dated_date`}>Dated Date</Label>
          <Input id={`${idPrefix}-dated_date`} name="dated_date" type="date" defaultValue={entry?.dated_date ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-recorded_date`}>Recorded Date</Label>
          <Input id={`${idPrefix}-recorded_date`} name="recorded_date" type="date" defaultValue={entry?.recorded_date ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-book`}>Book</Label>
          <Input id={`${idPrefix}-book`} name="book" defaultValue={entry?.book ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-page`}>Page</Label>
          <Input id={`${idPrefix}-page`} name="page" defaultValue={entry?.page ?? undefined} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-instrument_number`}>Instrument Number</Label>
          <Input id={`${idPrefix}-instrument_number`} name="instrument_number" defaultValue={entry?.instrument_number ?? undefined} />
        </div>
      </div>
    </div>
  )
}

export function ChainOfTitleSection({
  orderId,
  commitmentSchAId,
  entries,
  derivationSeed,
}: {
  orderId: string
  commitmentSchAId: string
  entries: ChainOfTitleEntry[]
  derivationSeed: DerivationSeed
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  // Controlled add-form fields (instrument_type/grantor/grantee) don't reset on native
  // form submit the way this codebase's usual uncontrolled fields do — remounting via
  // this key after a successful add is the reset mechanism. See plan Global Constraints.
  const [addFormKey, setAddFormKey] = useState(0)

  return (
    <section id="chain-of-title" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-semibold">Chain of Title</h2>

      <ul className="mb-6 space-y-4" data-testid="chain-of-title-list">
        {entries.map((entry) =>
          editingId === entry.id ? (
            <li key={entry.id} className="rounded border p-4" data-testid="chain-of-title-row-editing">
              <form
                action={async (formData) => {
                  await updateChainOfTitleEntry(entry.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-4"
              >
                <ChainOfTitleFields entry={entry} idPrefix={`cot-edit-${entry.id}`} />
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
            <li key={entry.id} className="rounded border p-4" data-testid="chain-of-title-row">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    {entry.instrument_type || 'Instrument'}: {entry.grantor || '?'} → {entry.grantee || '?'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {[
                      entry.dated_date && `Dated ${entry.dated_date}`,
                      entry.recorded_date && `Recorded ${entry.recorded_date}`,
                      (entry.book || entry.page) && `Bk ${entry.book ?? ''} Pg ${entry.page ?? ''}`,
                      entry.instrument_number && `Instr# ${entry.instrument_number}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="text-sm text-slate-600 hover:underline"
                    onClick={() => setEditingId(entry.id)}
                    aria-label={`Edit ${entry.instrument_type ?? 'entry'}`}
                  >
                    Edit
                  </button>
                  <form action={deleteChainOfTitleEntry.bind(null, orderId, entry.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            </li>
          )
        )}
        {entries.length === 0 && <p className="text-sm text-slate-500">No Chain of Title entries added.</p>}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add a Chain of Title Entry</summary>
        <form
          action={async (formData) => {
            await addChainOfTitleEntry(commitmentSchAId, orderId, formData)
            setAddFormKey((k) => k + 1)
          }}
          className="mt-4 space-y-4"
        >
          <ChainOfTitleFields key={addFormKey} idPrefix="cot-new" seedValues={derivationSeed} />
          <Button type="submit">Add Chain of Title Entry</Button>
        </form>
      </details>
    </section>
  )
}
