'use client'

import { useRef, useState } from 'react'
import {
  CONTACT_ROLES,
  CONTACT_ROLES_SINGLE_ADDRESS,
  CONTACT_ROLES_WITH_ENTITY_TYPE,
  CONTACT_ROLES_WITH_LICENSE,
  CONTACT_ROLES_WITH_MORTGAGEE_CLAUSE,
  ENTITY_TYPES,
  MARITAL_STATUSES,
} from '@/lib/constants'
import { saveContact } from '@/app/actions/contacts'
import type { Contact } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OrderFormSubmitButton } from '@/components/OrderFormSubmitButton'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'

type LinkCandidate = {
  id: string
  name: string
  current_address: string | null
  mailing_address: string | null
  forwarding_address: string | null
}

const UNLINKED = '__unlinked__'

export function AddContactForm({
  action,
  orderId,
  contact,
  propertyAddress,
  linkCandidates,
}: {
  /** Used only when adding a new contact (no `contact` prop) — editing an existing
   *  contact autosaves via `saveContact` instead of a submit action. */
  action?: (formData: FormData) => void | Promise<void>
  orderId?: string
  contact?: Contact
  propertyAddress?: string | null
  /** Other contacts of the same role on this file — the only valid spouse-link targets.
   *  Only present in edit mode (the edit page is the one that queries for them). */
  linkCandidates?: LinkCandidate[]
}) {
  const [role, setRole] = useState(contact?.role ?? '')
  const [entityType, setEntityType] = useState(contact?.entity_type ?? 'Individual')
  const [currentAddress, setCurrentAddress] = useState(contact?.current_address ?? '')
  const [mailingAddress, setMailingAddress] = useState(contact?.mailing_address ?? '')
  const [forwardingAddress, setForwardingAddress] = useState(contact?.forwarding_address ?? '')
  const [linkedContactId, setLinkedContactId] = useState(contact?.linked_contact_id ?? '')
  const linkedContact = (linkCandidates ?? []).find((c) => c.id === linkedContactId)

  const showEntityType = CONTACT_ROLES_WITH_ENTITY_TYPE.includes(role)
  const showSsnDob = showEntityType && entityType === 'Individual'
  const showSingleAddress = CONTACT_ROLES_SINGLE_ADDRESS.includes(role)
  const showLicense = CONTACT_ROLES_WITH_LICENSE.includes(role)
  const showMortgagee = CONTACT_ROLES_WITH_MORTGAGEE_CLAUSE.includes(role)
  const showFillFromProperty = !showSingleAddress && !!propertyAddress

  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => {
    if (!contact || !orderId) throw new Error('AddContactForm.save called without a contact to save against')
    return saveContact(orderId, contact.id, formData)
  })

  function handleSave(override?: { name: string; value: string }) {
    if (!formRef.current || !contact) return
    const formData = new FormData(formRef.current)
    if (override) {
      formData.set(override.name, override.value)
    }
    save(formData)
  }

  return (
    <form ref={formRef} action={contact ? undefined : action} className="mt-4 space-y-4">
      {contact && <SaveIndicator state={state} errorMessage={errorMessage} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="role">Role</Label>
          <Select
            name="role"
            required
            value={role}
            onValueChange={(v) => {
              setRole(v as string)
              handleSave({ name: 'role', value: v as string })
            }}
          >
            <SelectTrigger id="role" className="mt-1 w-full">
              <SelectValue placeholder="— Select —" />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showEntityType ? (
          <div>
            <Label htmlFor="entity_type">Entity Type</Label>
            <Select
              name="entity_type"
              value={entityType}
              onValueChange={(v) => {
                setEntityType(v as string)
                handleSave({ name: 'entity_type', value: v as string })
              }}
            >
              <SelectTrigger id="entity_type" className="mt-1 w-full">
                <SelectValue placeholder="— Select —" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <input type="hidden" name="entity_type" value="Individual" />
        )}
      </div>

      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          className="mt-1"
          defaultValue={contact?.name}
          onBlur={() => handleSave()}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          id="poa"
          name="poa"
          defaultChecked={contact?.poa ?? false}
          onCheckedChange={(checked) => handleSave({ name: 'poa', value: checked ? 'on' : '' })}
        />
        Power of Attorney (POA)
      </label>

      {showSingleAddress ? (
        <div>
          <Label htmlFor="current_address">Address</Label>
          <Input
            id="current_address"
            name="current_address"
            className="mt-1"
            defaultValue={contact?.current_address ?? undefined}
            onBlur={() => handleSave()}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="current_address">Current Address</Label>
            <Input
              id="current_address"
              name="current_address"
              className="mt-1"
              value={currentAddress}
              onChange={(e) => setCurrentAddress(e.target.value)}
              onBlur={() => handleSave()}
            />
            {showFillFromProperty && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  onCheckedChange={(checked) => {
                    if (!checked) return
                    setCurrentAddress(propertyAddress ?? '')
                    handleSave({ name: 'current_address', value: propertyAddress ?? '' })
                  }}
                />
                Same as Property Address
              </label>
            )}
            {linkedContact && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  onCheckedChange={(checked) => {
                    if (!checked) return
                    setCurrentAddress(linkedContact.current_address ?? '')
                    handleSave({ name: 'current_address', value: linkedContact.current_address ?? '' })
                  }}
                />
                Same as {linkedContact.name}
              </label>
            )}
          </div>
          <div>
            <Label htmlFor="mailing_address">Mailing Address</Label>
            <Input
              id="mailing_address"
              name="mailing_address"
              className="mt-1"
              value={mailingAddress}
              onChange={(e) => setMailingAddress(e.target.value)}
              onBlur={() => handleSave()}
            />
            {showFillFromProperty && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  onCheckedChange={(checked) => {
                    if (!checked) return
                    setMailingAddress(propertyAddress ?? '')
                    handleSave({ name: 'mailing_address', value: propertyAddress ?? '' })
                  }}
                />
                Same as Property Address
              </label>
            )}
            {linkedContact && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  onCheckedChange={(checked) => {
                    if (!checked) return
                    setMailingAddress(linkedContact.mailing_address ?? '')
                    handleSave({ name: 'mailing_address', value: linkedContact.mailing_address ?? '' })
                  }}
                />
                Same as {linkedContact.name}
              </label>
            )}
          </div>
          <div>
            <Label htmlFor="forwarding_address">Forwarding Address</Label>
            <Input
              id="forwarding_address"
              name="forwarding_address"
              className="mt-1"
              value={forwardingAddress}
              onChange={(e) => setForwardingAddress(e.target.value)}
              onBlur={() => handleSave()}
            />
            {showFillFromProperty && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  onCheckedChange={(checked) => {
                    if (!checked) return
                    setForwardingAddress(propertyAddress ?? '')
                    handleSave({ name: 'forwarding_address', value: propertyAddress ?? '' })
                  }}
                />
                Same as Property Address
              </label>
            )}
            {linkedContact && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  onCheckedChange={(checked) => {
                    if (!checked) return
                    setForwardingAddress(linkedContact.forwarding_address ?? '')
                    handleSave({ name: 'forwarding_address', value: linkedContact.forwarding_address ?? '' })
                  }}
                />
                Same as {linkedContact.name}
              </label>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            className="mt-1"
            defaultValue={contact?.phone ?? undefined}
            onBlur={() => handleSave()}
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            className="mt-1"
            defaultValue={contact?.email ?? undefined}
            onBlur={() => handleSave()}
          />
        </div>
      </div>

      {showSsnDob && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="ssn">SSN</Label>
            <Input
              id="ssn"
              name="ssn"
              autoComplete="off"
              className="mt-1"
              defaultValue={contact?.ssn ?? undefined}
              onBlur={() => handleSave()}
            />
          </div>
          <div>
            <Label htmlFor="marital_status">Marital Status</Label>
            <Select
              name="marital_status"
              defaultValue={contact?.marital_status ?? undefined}
              onValueChange={(v) => handleSave({ name: 'marital_status', value: v as string })}
            >
              <SelectTrigger id="marital_status" className="mt-1 w-full">
                <SelectValue placeholder="— Select —" />
              </SelectTrigger>
              <SelectContent>
                {MARITAL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="dob">Date of Birth</Label>
            <Input
              id="dob"
              name="dob"
              type="date"
              className="mt-1"
              defaultValue={contact?.dob ?? undefined}
              onBlur={() => handleSave()}
            />
          </div>
        </div>
      )}

      {showSsnDob && linkCandidates && linkCandidates.length > 0 && (
        <div>
          <Label htmlFor="linked_contact_id">Linked Spouse</Label>
          <Select
            name="linked_contact_id"
            value={linkedContactId}
            onValueChange={(v) => {
              const id = v === UNLINKED ? '' : (v as string)
              setLinkedContactId(id)
              handleSave({ name: 'linked_contact_id', value: id })
            }}
          >
            <SelectTrigger id="linked_contact_id" className="mt-1 w-full">
              <SelectValue placeholder="— Not linked —">
                {linkedContact?.name ?? '— Not linked —'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNLINKED}>— Not linked —</SelectItem>
              {linkCandidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(showLicense || showMortgagee) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {showLicense && (
            <>
              <div>
                <Label htmlFor="license_number">License Number</Label>
                <Input
                  id="license_number"
                  name="license_number"
                  className="mt-1"
                  defaultValue={contact?.license_number ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="alta_id">ALTA ID</Label>
                <Input
                  id="alta_id"
                  name="alta_id"
                  className="mt-1"
                  defaultValue={contact?.alta_id ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
            </>
          )}
          {showMortgagee && (
            <div>
              <Label htmlFor="mortgagee_clause">Mortgagee Clause</Label>
              <Input
                id="mortgagee_clause"
                name="mortgagee_clause"
                className="mt-1"
                defaultValue={contact?.mortgagee_clause ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
          )}
        </div>
      )}

      {!contact && <OrderFormSubmitButton label="Add Contact" />}
    </form>
  )
}
