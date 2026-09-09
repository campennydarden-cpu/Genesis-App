'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { saveCdfPage5, addCdfPage5Contact, updateCdfPage5Contact, deleteCdfPage5Contact } from '@/app/actions/cdf-page5'
import { CDF_PAGE5_CONTACT_ROLES, CDF_LIABILITY_AFTER_FORECLOSURE } from '@/lib/constants'
import { CdfWrap, CdfBar, CdfTable, CdfRow, CdfMeta, CdfNum, cdfInputClass, cdfAmtInputClass, cdfSelectClass } from '@/components/title/cdf-chrome'
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
    <form ref={formRef}>
      <div className="mb-3">
        <SaveIndicator state={state} errorMessage={errorMessage} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CdfWrap>
          <CdfBar title="Loan Calculations" />
          <CdfTable>
            <CdfMeta label="Total of Payments">
              <Input
                id="total_of_payments"
                name="total_of_payments"
                type="number"
                step="0.01"
                defaultValue={cdfPage5?.total_of_payments ?? ''}
                onBlur={handleSave}
                className={`${cdfAmtInputClass} max-w-[150px]`}
              />
            </CdfMeta>
            <CdfMeta label="Finance Charge">
              <Input
                id="finance_charge"
                name="finance_charge"
                type="number"
                step="0.01"
                defaultValue={cdfPage5?.finance_charge ?? ''}
                onBlur={handleSave}
                className={`${cdfAmtInputClass} max-w-[150px]`}
              />
            </CdfMeta>
            <CdfMeta label="Amount Financed">
              <Input
                id="amount_financed"
                name="amount_financed"
                type="number"
                step="0.01"
                defaultValue={cdfPage5?.amount_financed ?? ''}
                onBlur={handleSave}
                className={`${cdfAmtInputClass} max-w-[150px]`}
              />
            </CdfMeta>
            <CdfMeta label="Annual Percentage Rate (APR)">
              <Input
                id="apr"
                name="apr"
                type="number"
                step="0.001"
                defaultValue={cdfPage5?.apr ?? ''}
                onBlur={handleSave}
                className={`${cdfAmtInputClass} max-w-[150px]`}
              />
            </CdfMeta>
            <CdfMeta label="Total Interest Percentage (TIP)">
              <Input
                id="total_interest_percentage"
                name="total_interest_percentage"
                type="number"
                step="0.001"
                defaultValue={cdfPage5?.total_interest_percentage ?? ''}
                onBlur={handleSave}
                className={`${cdfAmtInputClass} max-w-[150px]`}
              />
            </CdfMeta>
          </CdfTable>
        </CdfWrap>

        <CdfWrap>
          <CdfBar title="Other Disclosures" />
          <CdfTable>
            <CdfRow variant="section">Appraisal</CdfRow>
            <div className="flex items-center gap-2 border-t border-border py-1.5">
              <input
                id="print_appraisal_disclosure"
                type="checkbox"
                name="print_appraisal_disclosure"
                defaultChecked={cdfPage5?.print_appraisal_disclosure ?? true}
                onChange={handleSave}
                className="h-4 w-4"
              />
              <label htmlFor="print_appraisal_disclosure" className="text-[12.5px]">
                Print appraisal disclosure
              </label>
            </div>
            <CdfRow variant="section">Liability after Foreclosure</CdfRow>
            <p className="border-t border-border pt-1.5 text-xs text-muted-foreground">If your lender forecloses on this property</p>
            {CDF_LIABILITY_AFTER_FORECLOSURE.map((option) => (
              <label key={option} className="flex items-center gap-2 py-1 text-[12.5px]">
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
          </CdfTable>
        </CdfWrap>
      </div>
    </form>
  )
}

const CONTACT_GRID = 'grid-cols-[24px_1fr_1.2fr_0.8fr_0.8fr_1fr_0.9fr_1.2fr_0.9fr_26px]'

function ContactRow({
  orderId,
  contact,
  allContacts,
  num,
}: {
  orderId: string
  contact: CdfPage5Contact
  allContacts: Contact[]
  num: number
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateCdfPage5Contact(orderId, contact.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="border-t border-border py-1.5 first:border-t-0" data-testid={`cdf-page5-contact-${contact.id}`}>
      <form ref={formRef} className={`grid ${CONTACT_GRID} items-center gap-1.5`}>
        <CdfNum>{num}</CdfNum>
        <select name="role" defaultValue={contact.role ?? ''} onBlur={handleSave} className={cdfSelectClass}>
          <option value="">—</option>
          {CDF_PAGE5_CONTACT_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select name="contact_id" defaultValue={contact.contact_id ?? ''} onBlur={handleSave} className={cdfSelectClass}>
          <option value="">—</option>
          {allContacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Input name="nmls_id" placeholder="NMLS ID" defaultValue={contact.nmls_id ?? ''} onBlur={handleSave} className={cdfInputClass} />
        <Input name="license_id" placeholder="License ID" defaultValue={contact.license_id ?? ''} onBlur={handleSave} className={cdfInputClass} />
        <Input name="contact_person" placeholder="Contact" defaultValue={contact.contact_person ?? ''} onBlur={handleSave} className={cdfInputClass} />
        <Input
          name="contact_nmls_id"
          placeholder="Contact NMLS ID"
          defaultValue={contact.contact_nmls_id ?? ''}
          onBlur={handleSave}
          className={cdfInputClass}
        />
        <Input name="email" type="email" placeholder="Email" defaultValue={contact.email ?? ''} onBlur={handleSave} className={cdfInputClass} />
        <Input name="phone" placeholder="Phone" defaultValue={contact.phone ?? ''} onBlur={handleSave} className={cdfInputClass} />
        <button
          type="button"
          aria-label="Remove contact"
          title="Remove contact"
          disabled={isPending}
          className="text-right text-sm text-muted-foreground hover:text-destructive"
          onClick={() =>
            startTransition(async () => {
              await deleteCdfPage5Contact(orderId, contact.id)
              refresh()
            })
          }
        >
          ✕
        </button>
      </form>
      <div className="pl-[calc(24px+0.375rem)]">
        <SaveIndicator state={state} errorMessage={errorMessage} />
      </div>
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
    <div className="max-w-6xl" data-testid="cdf-page5-panel">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">CDF Page 5 — Loan Calculations, Other Disclosures, Contact Information</h2>
        <p className="text-sm text-muted-foreground">
          Manual entry shell. Confirm Receipt signature configuration is not built — Genesis doesn&apos;t generate a printable CDF
          yet.
        </p>
      </div>

      <LoanCalculationsForm orderId={orderId} cdfPage5={cdfPage5} />

      <CdfWrap>
        <CdfBar title="Contact Information" />
        <CdfTable>
          <CdfRow variant="header" className={`grid ${CONTACT_GRID}`}>
            <div />
            <div>Role</div>
            <div>Name</div>
            <div>NMLS ID</div>
            <div>License ID</div>
            <div>Contact</div>
            <div>Contact NMLS</div>
            <div>Email</div>
            <div>Phone</div>
            <div />
          </CdfRow>
          <div data-testid="cdf-page5-contact-list">
            {contacts.map((c, idx) => (
              <ContactRow key={c.id} orderId={orderId} contact={c} allContacts={allContacts} num={idx + 1} />
            ))}
            {contacts.length === 0 && <p className="py-1.5 text-sm text-muted-foreground">No contacts added yet.</p>}
          </div>
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
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
        </CdfTable>
      </CdfWrap>
    </div>
  )
}
