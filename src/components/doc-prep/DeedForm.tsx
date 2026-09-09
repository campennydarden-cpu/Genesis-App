'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { DERIVATION_INSTRUMENT_TYPES, ENTITY_TYPES, PRINCIPAL_ROLES } from '@/lib/constants'
import {
  saveDeed,
  copyDeedPartyFromContact,
  addDeedPrincipal,
  deleteDeedPrincipal,
  addSignatureLine,
  generateSignatureLineFromGrantor,
  updateSignatureLine,
  deleteSignatureLine,
  generateNotaryBlockFromGrantor,
  addSubjectTo,
  deleteSubjectTo,
  refillDeedFieldFromSource,
  toggleDeedFinal,
} from '@/app/actions/doc-prep-deed'
import type { DocPrepDeed, DocPrepDeedPrincipal, DocPrepDeedSignatureLine, DocPrepDeedSubjectTo } from '@/lib/types'

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
  side: 'grantor' | 'grantee'
  name: string | null
  entityType: string | null
  principals: DocPrepDeedPrincipal[]
  contacts: ContactOption[]
  onChanged: () => void
}) {
  const [copyContactId, setCopyContactId] = useState('')
  const [newPrincipalName, setNewPrincipalName] = useState('')
  const [isPending, startTransition] = useTransition()
  const label = side === 'grantor' ? 'Grantor' : 'Grantee'
  const roles = PRINCIPAL_ROLES[entityType ?? ''] ?? []
  const showRoster = ['LLC', 'Corporation', 'Partnership', 'Trust'].includes(entityType ?? '')

  function handleCopy() {
    if (!copyContactId) return
    startTransition(async () => {
      await copyDeedPartyFromContact(orderId, side, copyContactId)
      onChanged()
    })
  }

  function handleAddPrincipal() {
    if (!newPrincipalName.trim()) return
    startTransition(async () => {
      await addDeedPrincipal(orderId, side, newPrincipalName.trim(), null)
      setNewPrincipalName('')
      onChanged()
    })
  }

  return (
    <div className="rounded border p-4" data-testid={`deed-${side}-section`}>
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
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} disabled={isPending}>
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
                <span>
                  {p.name}
                  {p.role ? ` (${p.role})` : ''}
                </span>
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteDeedPrincipal(orderId, p.id)
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
            <Button type="button" size="sm" onClick={handleAddPrincipal} disabled={isPending}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function DeedForm({
  orderId,
  deed,
  principals,
  signatureLines,
  subjectTo,
  contacts,
}: {
  orderId: string
  deed: DocPrepDeed | null
  principals: DocPrepDeedPrincipal[]
  signatureLines: DocPrepDeedSignatureLine[]
  subjectTo: DocPrepDeedSubjectTo[]
  contacts: ContactOption[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => saveDeed(orderId, formData))
  const [newSignatureLine, setNewSignatureLine] = useState('')
  const [newSubjectTo, setNewSubjectTo] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  function refresh() {
    window.location.reload()
  }

  const isFinal = deed?.final ?? false

  return (
    <div className="max-w-3xl space-y-6" data-testid="deed-form">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Deed</h2>
        <div className="flex items-center gap-3">
          <SaveIndicator state={state} errorMessage={errorMessage} />
          <Button
            type="button"
            variant={isFinal ? 'outline' : 'default'}
            size="sm"
            onClick={() =>
              startTransition(async () => {
                await toggleDeedFinal(orderId, !isFinal)
                refresh()
              })
            }
            disabled={isPending}
          >
            {isFinal ? 'Revert to Draft' : 'Finalize'}
          </Button>
        </div>
      </div>

      <form ref={formRef} className="space-y-4">
        <div>
          <Label htmlFor="instrument_type">Instrument Type</Label>
          <select
            id="instrument_type"
            name="instrument_type"
            defaultValue={deed?.instrument_type ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">— select —</option>
            {DERIVATION_INSTRUMENT_TYPES.slice(0, 11).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dated_date">Dated Date</Label>
            <Input id="dated_date" name="dated_date" type="date" defaultValue={deed?.dated_date ?? ''} onBlur={handleSave} />
          </div>
          <div>
            <Label htmlFor="consideration">Consideration</Label>
            <Input
              id="consideration"
              name="consideration"
              type="number"
              step="0.01"
              defaultValue={deed?.consideration ?? ''}
              onBlur={handleSave}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="exemption_code">Exemption Code</Label>
          <Input id="exemption_code" name="exemption_code" defaultValue={deed?.exemption_code ?? ''} onBlur={handleSave} />
        </div>

        <PartySection
          orderId={orderId}
          side="grantor"
          name={deed?.grantor_name ?? null}
          entityType={deed?.grantor_entity_type ?? null}
          principals={principals.filter((p) => p.side === 'grantor')}
          contacts={contacts}
          onChanged={refresh}
        />
        <PartySection
          orderId={orderId}
          side="grantee"
          name={deed?.grantee_name ?? null}
          entityType={deed?.grantee_entity_type ?? null}
          principals={principals.filter((p) => p.side === 'grantee')}
          contacts={contacts}
          onChanged={refresh}
        />

        {[
          { field: 'legal_text' as const, label: 'Legal Description' },
          { field: 'parcel_number' as const, label: 'Parcel Number' },
          { field: 'derivation_text' as const, label: 'Derivation' },
          { field: 'situs_address' as const, label: 'Situs Address' },
        ].map(({ field, label }) => (
          <div key={field}>
            <div className="flex items-center justify-between">
              <Label htmlFor={field}>{label}</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  startTransition(async () => {
                    await refillDeedFieldFromSource(orderId, field)
                    refresh()
                  })
                }
              >
                Refill from source
              </button>
            </div>
            <Textarea id={field} name={field} defaultValue={deed?.[field] ?? ''} onBlur={handleSave} />
          </div>
        ))}

        <div className="flex items-center gap-2">
          <input
            id="legal_as_exhibit"
            name="legal_as_exhibit"
            type="checkbox"
            defaultChecked={deed?.legal_as_exhibit ?? false}
            onChange={handleSave}
          />
          <Label htmlFor="legal_as_exhibit">See Legal Description attached hereto as Exhibit A</Label>
        </div>

        <div>
          <Label htmlFor="prepared_by_contact_id">Prepared By</Label>
          <select
            id="prepared_by_contact_id"
            name="prepared_by_contact_id"
            defaultValue={deed?.prepared_by_contact_id ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">— none —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.role})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="return_to_contact_id">Return To</Label>
          <select
            id="return_to_contact_id"
            name="return_to_contact_id"
            defaultValue={deed?.return_to_contact_id ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">— none —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.role})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="book">Book</Label>
            <Input id="book" name="book" defaultValue={deed?.book ?? ''} onBlur={handleSave} />
          </div>
          <div>
            <Label htmlFor="page">Page</Label>
            <Input id="page" name="page" defaultValue={deed?.page ?? ''} onBlur={handleSave} />
          </div>
          <div>
            <Label htmlFor="instrument_number">Instrument #</Label>
            <Input id="instrument_number" name="instrument_number" defaultValue={deed?.instrument_number ?? ''} onBlur={handleSave} />
          </div>
        </div>
        {isFinal && (
          <div>
            <Label htmlFor="recorded_date">Recorded Date</Label>
            <Input id="recorded_date" name="recorded_date" type="date" defaultValue={deed?.recorded_date ?? ''} onBlur={handleSave} />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notary_block">Notary Block</Label>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() =>
                startTransition(async () => {
                  await generateNotaryBlockFromGrantor(orderId)
                  refresh()
                })
              }
            >
              Generate from Grantor
            </button>
          </div>
          <Textarea
            id="notary_block"
            name="notary_block"
            defaultValue={deed?.notary_block ?? ''}
            className="min-h-32"
            onBlur={handleSave}
          />
        </div>
      </form>

      <div className="rounded border p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-medium">Signature Lines</p>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() =>
              startTransition(async () => {
                await generateSignatureLineFromGrantor(orderId)
                refresh()
              })
            }
          >
            Regenerate default from entity details
          </button>
        </div>
        <ul className="mb-2 space-y-1" data-testid="deed-signature-lines">
          {signatureLines.map((line) => (
            <li key={line.id} className="flex items-center gap-2">
              <Input
                defaultValue={line.text}
                className="text-sm"
                onBlur={(e) => {
                  if (e.target.value !== line.text) {
                    startTransition(async () => {
                      await updateSignatureLine(orderId, line.id, e.target.value)
                      refresh()
                    })
                  }
                }}
              />
              <button
                type="button"
                className="text-xs text-destructive hover:underline"
                onClick={() =>
                  startTransition(async () => {
                    await deleteSignatureLine(orderId, line.id)
                    refresh()
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
          {signatureLines.length === 0 && <li className="text-sm text-muted-foreground">None added yet.</li>}
        </ul>
        <div className="flex gap-2">
          <Input
            value={newSignatureLine}
            onChange={(e) => setNewSignatureLine(e.target.value)}
            placeholder="Add a signature line"
            className="h-8 text-sm"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!newSignatureLine.trim()) return
              startTransition(async () => {
                await addSignatureLine(orderId, newSignatureLine.trim())
                setNewSignatureLine('')
                refresh()
              })
            }}
            disabled={isPending}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="rounded border p-4">
        <p className="mb-2 font-medium">Subject To / Exceptions</p>
        <ul className="mb-2 space-y-1" data-testid="deed-subject-to">
          {subjectTo.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm">
              <span>{item.description}</span>
              <button
                type="button"
                className="text-xs text-destructive hover:underline"
                onClick={() =>
                  startTransition(async () => {
                    await deleteSubjectTo(orderId, item.id)
                    refresh()
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
          {subjectTo.length === 0 && <li className="text-sm text-muted-foreground">None added yet.</li>}
        </ul>
        <div className="flex gap-2">
          <Input
            value={newSubjectTo}
            onChange={(e) => setNewSubjectTo(e.target.value)}
            placeholder="Add a Subject To item"
            className="h-8 text-sm"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!newSubjectTo.trim()) return
              startTransition(async () => {
                await addSubjectTo(orderId, newSubjectTo.trim())
                setNewSubjectTo('')
                refresh()
              })
            }}
            disabled={isPending}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
