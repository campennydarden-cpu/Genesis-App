'use client'

import { useState } from 'react'
import {
  CONTACT_ROLES,
  CONTACT_ROLES_SINGLE_ADDRESS,
  CONTACT_ROLES_WITH_ENTITY_TYPE,
  CONTACT_ROLES_WITH_LICENSE,
  CONTACT_ROLES_WITH_MORTGAGEE_CLAUSE,
  ENTITY_TYPES,
  MARITAL_STATUSES,
} from '@/lib/constants'
import type { Contact } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OrderFormSubmitButton } from '@/components/OrderFormSubmitButton'

export function AddContactForm({
  action,
  contact,
  propertyAddress,
}: {
  action: (formData: FormData) => void | Promise<void>
  contact?: Contact
  propertyAddress?: string | null
}) {
  const [role, setRole] = useState(contact?.role ?? '')
  const [entityType, setEntityType] = useState(contact?.entity_type ?? 'Individual')
  const [currentAddress, setCurrentAddress] = useState(contact?.current_address ?? '')
  const [mailingAddress, setMailingAddress] = useState(contact?.mailing_address ?? '')
  const [forwardingAddress, setForwardingAddress] = useState(contact?.forwarding_address ?? '')

  const showEntityType = CONTACT_ROLES_WITH_ENTITY_TYPE.includes(role)
  const showSsnDob = showEntityType && entityType === 'Individual'
  const showSingleAddress = CONTACT_ROLES_SINGLE_ADDRESS.includes(role)
  const showLicense = CONTACT_ROLES_WITH_LICENSE.includes(role)
  const showMortgagee = CONTACT_ROLES_WITH_MORTGAGEE_CLAUSE.includes(role)
  const showFillFromProperty = !showSingleAddress && !!propertyAddress

  return (
    <form action={action} className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="role">Role</Label>
          <Select name="role" required value={role} onValueChange={(v) => setRole(v as string)}>
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
              onValueChange={(v) => setEntityType(v as string)}
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
        <Input id="name" name="name" required className="mt-1" defaultValue={contact?.name} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox id="poa" name="poa" defaultChecked={contact?.poa ?? false} />
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
            />
            {showFillFromProperty && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  onCheckedChange={(checked) => checked && setCurrentAddress(propertyAddress ?? '')}
                />
                Same as Property Address
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
            />
            {showFillFromProperty && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  onCheckedChange={(checked) => checked && setMailingAddress(propertyAddress ?? '')}
                />
                Same as Property Address
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
            />
            {showFillFromProperty && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  onCheckedChange={(checked) => checked && setForwardingAddress(propertyAddress ?? '')}
                />
                Same as Property Address
              </label>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" className="mt-1" defaultValue={contact?.phone ?? undefined} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            className="mt-1"
            defaultValue={contact?.email ?? undefined}
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
            />
          </div>
          <div>
            <Label htmlFor="marital_status">Marital Status</Label>
            <Select name="marital_status" defaultValue={contact?.marital_status ?? undefined}>
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
            />
          </div>
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
                />
              </div>
              <div>
                <Label htmlFor="alta_id">ALTA ID</Label>
                <Input
                  id="alta_id"
                  name="alta_id"
                  className="mt-1"
                  defaultValue={contact?.alta_id ?? undefined}
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
              />
            </div>
          )}
        </div>
      )}

      <OrderFormSubmitButton label={contact ? 'Save Changes' : 'Add Contact'} />
    </form>
  )
}
