'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { saveCdfPage5, addCdfPage5Contact, updateCdfPage5Contact, deleteCdfPage5Contact } from '@/app/actions/cdf-page5'
import { CDF_PAGE5_CONTACT_ROLES, CDF_LIABILITY_AFTER_FORECLOSURE } from '@/lib/constants'
import type { CdfPage5, CdfPage5Contact } from '@/lib/types'

type Contact = { id: string; name: string }

function refresh() {
  window.location.reload()
}

function LoanCalculationsForm({ orderId, cdfPage5 }: { orderId: string; cdfPage5: CdfPage5 | null }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => saveCdfPage5(orderId, formData))

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <form ref={formRef} className="space-y-4">
      <SaveIndicator state={state} errorMessage={errorMessage} />
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="font-semibold">Loan Calculations</h3>
          <div>
            <Label htmlFor="total_of_payments">Total of Payments</Label>
            <Input id="total_of_payments" name="total_of_payments" type="number" step="0.01" defaultValue={cdfPage5?.total_of_payments ?? ''} onBlur={handleSave} />
          </div>
          <div>
            <Label htmlFor="finance_charge">Finance Charge</Label>
            <Input id="finance_charge" name="finance_charge" type="number" step="0.01" defaultValue={cdfPage5?.finance_charge ?? ''} onBlur={handleSave} />
          </div>
          <div>
            <Label htmlFor="amount_financed">Amount Financed</Label>
            <Input id="amount_financed" name="amount_financed" type="number" step="0.01" defaultValue={cdfPage5?.amount_financed ?? ''} onBlur={handleSave} />
          </div>
          <div>
            <Label htmlFor="apr">Annual Percentage Rate (APR)</Label>
            <Input id="apr" name="apr" type="number" step="0.001" defaultValue={cdfPage5?.apr ?? ''} onBlur={handleSave} />
          </div>
          <div>
            <Label htmlFor="total_interest_percentage">Total Interest Percentage (TIP)</Label>
            <Input
              id="total_interest_percentage"
              name="total_interest_percentage"
              type="number"
              step="0.001"
              defaultValue={cdfPage5?.total_interest_percentage ?? ''}
              onBlur={handleSave}
            />
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold">Other Disclosures</h3>
          <div>
            <p className="text-sm font-medium">Appraisal</p>
            <div className="flex items-center gap-2">
              <input
                id="print_appraisal_disclosure"
                type="checkbox"
                name="print_appraisal_disclosure"
                defaultChecked={cdfPage5?.print_appraisal_disclosure ?? true}
                onChange={handleSave}
              />
              <Label htmlFor="print_appraisal_disclosure">Print appraisal disclosure</Label>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Liability after Foreclosure</p>
            <p className="text-xs text-muted-foreground">If your lender forecloses on this property</p>
            {CDF_LIABILITY_AFTER_FORECLOSURE.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="liability_after_foreclosure"
                  value={option}
                  defaultChecked={cdfPage5?.liability_after_foreclosure === option}
                  onChange={handleSave}
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      </div>
    </form>
  )
}

function ContactRow({ orderId, contact, allContacts }: { orderId: string; contact: CdfPage5Contact; allContacts: Contact[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateCdfPage5Contact(orderId, contact.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="space-y-2 rounded border p-3" data-testid={`cdf-page5-contact-${contact.id}`}>
      <form ref={formRef} className="grid grid-cols-4 gap-2">
        <div>
          <Label htmlFor={`cdf-page5-contact-${contact.id}-role`}>Role</Label>
          <select
            id={`cdf-page5-contact-${contact.id}-role`}
            name="role"
            defaultValue={contact.role ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {CDF_PAGE5_CONTACT_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`cdf-page5-contact-${contact.id}-contact_id`}>Name</Label>
          <select
            id={`cdf-page5-contact-${contact.id}-contact_id`}
            name="contact_id"
            defaultValue={contact.contact_id ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {allContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`cdf-page5-contact-${contact.id}-nmls_id`}>NMLS ID</Label>
          <Input id={`cdf-page5-contact-${contact.id}-nmls_id`} name="nmls_id" defaultValue={contact.nmls_id ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`cdf-page5-contact-${contact.id}-license_id`}>License ID</Label>
          <Input id={`cdf-page5-contact-${contact.id}-license_id`} name="license_id" defaultValue={contact.license_id ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`cdf-page5-contact-${contact.id}-contact_person`}>Contact</Label>
          <Input id={`cdf-page5-contact-${contact.id}-contact_person`} name="contact_person" defaultValue={contact.contact_person ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`cdf-page5-contact-${contact.id}-contact_nmls_id`}>Contact NMLS ID</Label>
          <Input id={`cdf-page5-contact-${contact.id}-contact_nmls_id`} name="contact_nmls_id" defaultValue={contact.contact_nmls_id ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`cdf-page5-contact-${contact.id}-email`}>Email</Label>
          <Input id={`cdf-page5-contact-${contact.id}-email`} name="email" type="email" defaultValue={contact.email ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`cdf-page5-contact-${contact.id}-phone`}>Phone</Label>
          <Input id={`cdf-page5-contact-${contact.id}-phone`} name="phone" defaultValue={contact.phone ?? ''} onBlur={handleSave} />
        </div>
        <div className="col-span-4">
          <SaveIndicator state={state} errorMessage={errorMessage} />
        </div>
      </form>
      <button
        type="button"
        className="text-sm text-destructive hover:underline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deleteCdfPage5Contact(orderId, contact.id)
            refresh()
          })
        }
      >
        Remove contact
      </button>
    </div>
  )
}

export function CdfPage5Panel({
  orderId,
  cdfPage5,
  contacts,
  allContacts,
}: {
  orderId: string
  cdfPage5: CdfPage5 | null
  contacts: CdfPage5Contact[]
  allContacts: Contact[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-5xl space-y-6" data-testid="cdf-page5-panel">
      <div>
        <h2 className="text-lg font-semibold">CDF Page 5 — Loan Calculations, Other Disclosures, Contact Information</h2>
        <p className="text-sm text-muted-foreground">
          Manual entry shell. Confirm Receipt signature configuration is not built — Genesis doesn&apos;t generate a printable CDF
          yet.
        </p>
      </div>

      <LoanCalculationsForm orderId={orderId} cdfPage5={cdfPage5} />

      <div className="space-y-3">
        <h3 className="font-semibold">Contact Information</h3>
        <div className="space-y-3" data-testid="cdf-page5-contact-list">
          {contacts.map((c) => (
            <ContactRow key={c.id} orderId={orderId} contact={c} allContacts={allContacts} />
          ))}
          {contacts.length === 0 && <p className="text-sm text-muted-foreground">No contacts added yet.</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            startTransition(async () => {
              await addCdfPage5Contact(orderId)
              refresh()
            })
          }
          disabled={isPending}
        >
          + Add Contact
        </Button>
      </div>
    </div>
  )
}
