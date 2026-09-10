'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { SplitList } from '@/components/title/SplitFields'
import {
  addCharge,
  updateCharge,
  deleteCharge,
  addChargeSplit,
  updateChargeSplit,
  deleteChargeSplit,
  setChargeCdfLine,
} from '@/app/actions/additional-title-charges'
import { assignNextCdfPage2Line } from '@/app/actions/cdf-page2'
import { CdfLineAssign } from '@/components/title/CdfLineAssign'
import type { AdditionalTitleCharge, AdditionalTitleChargeSplit, CdfPage2Line } from '@/lib/types'

type Contact = { id: string; name: string }
type Policy = { id: string; policy_type: string | null }
type BillCode = { id: string; code: string }

function refresh() {
  window.location.reload()
}

function ChargeRow({
  orderId,
  charge,
  splits,
  policies,
  contacts,
  billCodes,
  cdfLines,
}: {
  orderId: string
  charge: AdditionalTitleCharge
  splits: AdditionalTitleChargeSplit[]
  policies: Policy[]
  contacts: Contact[]
  billCodes: BillCode[]
  cdfLines: CdfPage2Line[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateCharge(orderId, charge.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="space-y-3 rounded border p-4" data-testid={`charge-${charge.id}`}>
      <form ref={formRef} className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <Label htmlFor={`charge-${charge.id}-description`}>Description</Label>
          <Input
            id={`charge-${charge.id}-description`}
            name="description"
            defaultValue={charge.description ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-policy_id`}>Policy</Label>
          <select
            id={`charge-${charge.id}-policy_id`}
            name="policy_id"
            defaultValue={charge.policy_id ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.policy_type ?? 'Policy'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-charge`}>Charge</Label>
          <CurrencyInput id={`charge-${charge.id}-charge`} name="charge" defaultValue={charge.charge} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-fee_type`}>Fee Type</Label>
          <Input id={`charge-${charge.id}-fee_type`} name="fee_type" defaultValue={charge.fee_type ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-payee_contact_id`}>Payee (no split)</Label>
          <select
            id={`charge-${charge.id}-payee_contact_id`}
            name="payee_contact_id"
            defaultValue={charge.payee_contact_id ?? ''}
            onBlur={handleSave}
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
          <Label htmlFor={`charge-${charge.id}-cdf_line`}>CDF Line (note)</Label>
          <Input id={`charge-${charge.id}-cdf_line`} name="cdf_line" defaultValue={charge.cdf_line ?? ''} onBlur={handleSave} />
        </div>
        <div className="col-span-2">
          <Label>CDF Page 2 Assignment</Label>
          <CdfLineAssign
            orderId={orderId}
            cdfLineId={charge.cdf_page2_line_id}
            cdfLines={cdfLines}
            onAssign={async (section) => {
              const { id } = await assignNextCdfPage2Line(orderId, section, charge.description, charge.charge, charge.seller_pay_percent)
              if (id) await setChargeCdfLine(orderId, charge.id, id)
              refresh()
            }}
            onUnassign={async () => {
              await setChargeCdfLine(orderId, charge.id, null)
              refresh()
            }}
          />
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-invoice`}>Invoice</Label>
          <Input id={`charge-${charge.id}-invoice`} name="invoice" defaultValue={charge.invoice ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-bill_code`}>Bill Code</Label>
          <select
            id={`charge-${charge.id}-bill_code`}
            name="bill_code"
            defaultValue={charge.bill_code ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {billCodes.map((b) => (
              <option key={b.id} value={b.code}>
                {b.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-seller_pay_percent`}>Seller Pay %</Label>
          <Input
            id={`charge-${charge.id}-seller_pay_percent`}
            name="seller_pay_percent"
            type="number"
            step="0.01"
            defaultValue={charge.seller_pay_percent ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-issued_date`}>Issued Date</Label>
          <Input
            id={`charge-${charge.id}-issued_date`}
            name="issued_date"
            type="date"
            defaultValue={charge.issued_date ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-effective_date`}>Effective Date</Label>
          <Input
            id={`charge-${charge.id}-effective_date`}
            name="effective_date"
            type="date"
            defaultValue={charge.effective_date ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div className="flex items-end gap-2">
          <input
            id={`charge-${charge.id}-taxable`}
            type="checkbox"
            name="taxable"
            defaultChecked={charge.taxable}
            onChange={handleSave}
          />
          <Label htmlFor={`charge-${charge.id}-taxable`}>Taxable</Label>
        </div>
        <div className="col-span-4">
          <SaveIndicator state={state} errorMessage={errorMessage} />
        </div>
      </form>

      <SplitList
        splits={splits}
        contacts={contacts}
        billCodes={billCodes}
        onAdd={() => addChargeSplit(orderId, charge.id)}
        onUpdate={(id, formData) => updateChargeSplit(orderId, id, formData)}
        onDelete={(id) => deleteChargeSplit(orderId, id)}
        onChanged={refresh}
      />

      <button
        type="button"
        className="text-sm text-destructive hover:underline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deleteCharge(orderId, charge.id)
            refresh()
          })
        }
      >
        Remove charge
      </button>
    </div>
  )
}

export function AdditionalChargesPanel({
  orderId,
  charges,
  splitsByCharge,
  policies,
  contacts,
  billCodes,
  cdfLines,
}: {
  orderId: string
  charges: AdditionalTitleCharge[]
  splitsByCharge: Record<string, AdditionalTitleChargeSplit[]>
  policies: Policy[]
  contacts: Contact[]
  billCodes: BillCode[]
  cdfLines: CdfPage2Line[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-4xl space-y-4" data-testid="additional-charges-panel">
      <h2 className="text-lg font-semibold">Additional Title/Escrow Charges</h2>
      <p className="text-sm text-muted-foreground">
        Manual entry shell — charges are keyed in directly, not calculated from a rate table.
      </p>

      <div className="space-y-4" data-testid="charge-list">
        {charges.map((c) => (
          <ChargeRow
            key={c.id}
            orderId={orderId}
            charge={c}
            splits={splitsByCharge[c.id] ?? []}
            policies={policies}
            contacts={contacts}
            billCodes={billCodes}
            cdfLines={cdfLines}
          />
        ))}
        {charges.length === 0 && <p className="text-sm text-muted-foreground">No charges yet.</p>}
      </div>

      <Button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await addCharge(orderId)
            refresh()
          })
        }
        disabled={isPending}
      >
        + Add Charge
      </Button>
    </div>
  )
}
