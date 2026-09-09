'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AFFIDAVIT_TYPES } from '@/lib/constants'
import { addAffidavit, updateAffidavit, deleteAffidavit } from '@/app/actions/doc-prep-affidavits'
import type { DocPrepAffidavit } from '@/lib/types'

function AffidavitFields({
  affidavit,
  idPrefix,
  contacts,
}: {
  affidavit?: DocPrepAffidavit
  idPrefix: string
  contacts: { id: string; name: string }[]
}) {
  const [recorded, setRecorded] = useState(affidavit?.recorded ?? false)
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <div className="grid grid-cols-4 gap-3">
      <div>
        <Label htmlFor={id('type')}>Type</Label>
        <select
          id={id('type')}
          name="type"
          defaultValue={affidavit?.type ?? AFFIDAVIT_TYPES[0]}
          className="block w-full rounded border px-2 py-1 text-sm"
        >
          {AFFIDAVIT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={id('affiant')}>Affiant</Label>
        <Input id={id('affiant')} name="affiant" defaultValue={affidavit?.affiant ?? ''} placeholder="e.g. Seller" />
      </div>
      <div>
        <Label htmlFor={id('affiant_contact_id')}>Linked Contact</Label>
        <select
          id={id('affiant_contact_id')}
          name="affiant_contact_id"
          defaultValue={affidavit?.affiant_contact_id ?? ''}
          className="block w-full rounded border px-2 py-1 text-sm"
        >
          <option value="">—</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={id('dated_date')}>Dated Date</Label>
        <Input id={id('dated_date')} name="dated_date" type="date" defaultValue={affidavit?.dated_date ?? ''} />
      </div>
      <div className="flex items-end gap-2">
        <input
          id={id('recorded')}
          type="checkbox"
          name="recorded"
          defaultChecked={affidavit?.recorded ?? false}
          onChange={(e) => setRecorded(e.target.checked)}
        />
        <Label htmlFor={id('recorded')}>Recorded</Label>
      </div>
      {recorded && (
        <>
          <div>
            <Label htmlFor={id('recorded_date')}>Recorded Date</Label>
            <Input id={id('recorded_date')} name="recorded_date" type="date" defaultValue={affidavit?.recorded_date ?? ''} />
          </div>
          <div>
            <Label htmlFor={id('book')}>Book</Label>
            <Input id={id('book')} name="book" defaultValue={affidavit?.book ?? ''} />
          </div>
          <div>
            <Label htmlFor={id('page')}>Page</Label>
            <Input id={id('page')} name="page" defaultValue={affidavit?.page ?? ''} />
          </div>
          <div>
            <Label htmlFor={id('instrument_number')}>Instrument #</Label>
            <Input id={id('instrument_number')} name="instrument_number" defaultValue={affidavit?.instrument_number ?? ''} />
          </div>
        </>
      )}
      <div className="col-span-4">
        <Label htmlFor={id('notes')}>Notes</Label>
        <Input id={id('notes')} name="notes" defaultValue={affidavit?.notes ?? ''} />
      </div>
    </div>
  )
}

export function AffidavitsPanel({
  orderId,
  affidavits,
  contacts,
}: {
  orderId: string
  affidavits: DocPrepAffidavit[]
  contacts: { id: string; name: string }[]
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function refresh() {
    window.location.reload()
  }

  return (
    <div className="max-w-3xl space-y-4" data-testid="affidavits-panel">
      <h2 className="text-lg font-semibold">Affidavits</h2>
      <p className="text-sm text-muted-foreground">
        Most affidavits are executed but not recorded — check Recorded only for the ones that get recorded.
      </p>

      <ul className="divide-y" data-testid="affidavit-list">
        {affidavits.map((a) =>
          editingId === a.id ? (
            <li key={a.id} className="py-3">
              <form
                action={async (formData) => {
                  await updateAffidavit(orderId, a.id, formData)
                  setEditingId(null)
                  refresh()
                }}
                className="space-y-3"
              >
                <AffidavitFields affidavit={a} idPrefix={`edit-${a.id}`} contacts={contacts} />
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
            <li key={a.id} className="flex items-center justify-between py-3">
              <div className="text-sm">
                <p className="font-medium">{a.type}</p>
                <p className="text-muted-foreground">
                  {[a.affiant, a.dated_date ? `Dated ${a.dated_date}` : null, a.recorded ? 'Recorded' : 'Not recorded']
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" className="text-sm hover:underline" onClick={() => setEditingId(a.id)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="text-sm text-destructive hover:underline"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteAffidavit(orderId, a.id)
                      refresh()
                    })
                  }
                  disabled={isPending}
                >
                  Delete
                </button>
              </div>
            </li>
          )
        )}
        {affidavits.length === 0 && <li className="py-3 text-sm text-muted-foreground">No affidavits yet.</li>}
      </ul>

      {adding ? (
        <form
          action={async (formData) => {
            await addAffidavit(orderId, formData)
            setAdding(false)
            refresh()
          }}
          className="space-y-3 rounded border p-4"
        >
          <AffidavitFields idPrefix="new-affidavit" contacts={contacts} />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Add Affidavit
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" onClick={() => setAdding(true)}>
          + Add Affidavit
        </Button>
      )}
    </div>
  )
}
