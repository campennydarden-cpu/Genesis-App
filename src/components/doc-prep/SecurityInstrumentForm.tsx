'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { SECURITY_INSTRUMENT_TYPES, ENTITY_TYPES, PRINCIPAL_ROLES } from '@/lib/constants'
import {
  saveSecurityInstrument,
  copySiPartyFromContact,
  addSiPrincipal,
  deleteSiPrincipal,
} from '@/app/actions/doc-prep-security-instrument'
import type { DocPrepSecurityInstrument, DocPrepSiPrincipal } from '@/lib/types'

type ContactOption = { id: string; name: string; role: string }

function PartySection({
  orderId,
  side,
  name,
  entityType,
  principals,
  contacts,
  onChanged,
}: {
  orderId: string
  side: 'mortgagor' | 'mortgagee'
  name: string | null
  entityType: string | null
  principals: DocPrepSiPrincipal[]
  contacts: ContactOption[]
  onChanged: () => void
}) {
  const [copyContactId, setCopyContactId] = useState('')
  const [newPrincipalName, setNewPrincipalName] = useState('')
  const [isPending, startTransition] = useTransition()
  const label = side === 'mortgagor' ? 'Mortgagor' : 'Mortgagee'
  const roles = PRINCIPAL_ROLES[entityType ?? ''] ?? []
  const showRoster = ['LLC', 'Corporation', 'Partnership', 'Trust'].includes(entityType ?? '')

  return (
    <div className="rounded border p-4" data-testid={`si-${side}-section`}>
      <p className="mb-3 font-medium">{label}</p>
      <div className="mb-3 flex gap-2">
        <select
          aria-label={`Copy ${label} from contact`}
          className="rounded border px-2 py-1 text-sm"
          value={copyContactId}
          onChange={(e) => setCopyContactId(e.target.value)}
        >
          <option value="">Copy from a file contact...</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.role})
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || !copyContactId}
          onClick={() =>
            startTransition(async () => {
              await copySiPartyFromContact(orderId, side, copyContactId)
              onChanged()
            })
          }
        >
          Copy
        </Button>
      </div>
      <div>
        <Label htmlFor={`${side}-name`}>{label} Name</Label>
        <Input id={`${side}-name`} name={`${side}_name`} defaultValue={name ?? ''} />
      </div>
      <div className="mt-2">
        <Label htmlFor={`${side}-entity-type`}>Entity Type</Label>
        <select
          id={`${side}-entity-type`}
          name={`${side}_entity_type`}
          defaultValue={entityType ?? 'Individual'}
          className="block w-full rounded border px-2 py-1 text-sm"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {showRoster && (
        <div className="mt-3 border-t pt-3">
          <p className="mb-2 text-sm font-medium">Principals</p>
          <ul className="mb-2 space-y-1">
            {principals.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteSiPrincipal(orderId, p.id)
                      onChanged()
                    })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
            {principals.length === 0 && <li className="text-sm text-muted-foreground">None added yet.</li>}
          </ul>
          <div className="flex gap-2">
            <Input
              value={newPrincipalName}
              onChange={(e) => setNewPrincipalName(e.target.value)}
              placeholder={`Add ${roles[0] ?? 'principal'} name`}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => {
                if (!newPrincipalName.trim()) return
                startTransition(async () => {
                  await addSiPrincipal(orderId, side, newPrincipalName.trim())
                  setNewPrincipalName('')
                  onChanged()
                })
              }}
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function SecurityInstrumentForm({
  orderId,
  si,
  principals,
  contacts,
}: {
  orderId: string
  si: DocPrepSecurityInstrument | null
  principals: DocPrepSiPrincipal[]
  contacts: ContactOption[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => saveSecurityInstrument(orderId, formData))

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="max-w-3xl space-y-6" data-testid="security-instrument-form">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Security Instrument</h2>
        <SaveIndicator state={state} errorMessage={errorMessage} />
      </div>

      <form ref={formRef} className="space-y-4">
        <div>
          <Label htmlFor="instrument_type">Instrument Type</Label>
          <select
            id="instrument_type"
            name="instrument_type"
            defaultValue={si?.instrument_type ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">— select —</option>
            {SECURITY_INSTRUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="trustee_name">Trustee Name</Label>
          <Input id="trustee_name" name="trustee_name" defaultValue={si?.trustee_name ?? ''} onBlur={handleSave} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="loan_amount">Loan Amount</Label>
            <Input id="loan_amount" name="loan_amount" type="number" step="0.01" defaultValue={si?.loan_amount ?? ''} onBlur={handleSave} />
          </div>
          <div>
            <Label htmlFor="dated_date">Dated Date</Label>
            <Input id="dated_date" name="dated_date" type="date" defaultValue={si?.dated_date ?? ''} onBlur={handleSave} />
          </div>
        </div>

        <PartySection
          orderId={orderId}
          side="mortgagor"
          name={si?.mortgagor_name ?? null}
          entityType={si?.mortgagor_entity_type ?? null}
          principals={principals.filter((p) => p.side === 'mortgagor')}
          contacts={contacts}
          onChanged={() => window.location.reload()}
        />
        <PartySection
          orderId={orderId}
          side="mortgagee"
          name={si?.mortgagee_name ?? null}
          entityType={si?.mortgagee_entity_type ?? null}
          principals={principals.filter((p) => p.side === 'mortgagee')}
          contacts={contacts}
          onChanged={() => window.location.reload()}
        />

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="book">Book</Label>
            <Input id="book" name="book" defaultValue={si?.book ?? ''} onBlur={handleSave} />
          </div>
          <div>
            <Label htmlFor="page">Page</Label>
            <Input id="page" name="page" defaultValue={si?.page ?? ''} onBlur={handleSave} />
          </div>
          <div>
            <Label htmlFor="instrument_number">Instrument #</Label>
            <Input id="instrument_number" name="instrument_number" defaultValue={si?.instrument_number ?? ''} onBlur={handleSave} />
          </div>
        </div>

        <div>
          <Label htmlFor="recorded_date">Recorded Date</Label>
          <Input id="recorded_date" name="recorded_date" type="date" defaultValue={si?.recorded_date ?? ''} onBlur={handleSave} />
        </div>

        <div className="rounded border p-4">
          <p className="mb-3 font-medium">Note</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="note_date">Note Date</Label>
              <Input id="note_date" name="note_date" type="date" defaultValue={si?.note_date ?? ''} onBlur={handleSave} />
            </div>
            <div>
              <Label htmlFor="note_amount">Note Amount</Label>
              <Input id="note_amount" name="note_amount" type="number" step="0.01" defaultValue={si?.note_amount ?? ''} onBlur={handleSave} />
            </div>
            <div>
              <Label htmlFor="maturity_date">Maturity Date</Label>
              <Input id="maturity_date" name="maturity_date" type="date" defaultValue={si?.maturity_date ?? ''} onBlur={handleSave} />
            </div>
            <div>
              <Label htmlFor="interest_rate">Interest Rate (%)</Label>
              <Input id="interest_rate" name="interest_rate" type="number" step="0.001" defaultValue={si?.interest_rate ?? ''} onBlur={handleSave} />
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
