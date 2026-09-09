'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
} from '@/app/actions/additional-title-charges'
import type { AdditionalTitleCharge, AdditionalTitleChargeSplit } from '@/lib/types'

type Contact = { id: string; name: string }
type Policy = { id: string; policy_type: string | null }

function refresh() {
  window.location.reload()
}

function ChargeRow({
  orderId,
  charge,
  splits,
  policies,
  contacts,
}: {
  orderId: string
  charge: AdditionalTitleCharge
  splits: AdditionalTitleChargeSplit[]
  policies: Policy[]
  contacts: Contact[]
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
          <Input
            id={`charge-${charge.id}-charge`}
            name="charge"
            type="number"
            step="0.01"
            defaultValue={charge.charge ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-fee_type`}>Fee Type</Label>
          <Input id={`charge-${charge.id}-fee_type`} name="fee_type" defaultValue={charge.fee_type ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-cdf_line`}>CDF Line</Label>
          <Input id={`charge-${charge.id}-cdf_line`} name="cdf_line" defaultValue={charge.cdf_line ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-invoice`}>Invoice</Label>
          <Input id={`charge-${charge.id}-invoice`} name="invoice" defaultValue={charge.invoice ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`charge-${charge.id}-bill_code`}>Bill Code</Label>
          <Input id={`charge-${charge.id}-bill_code`} name="bill_code" defaultValue={charge.bill_code ?? ''} onBlur={handleSave} />
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
}: {
  orderId: string
  charges: AdditionalTitleCharge[]
  splitsByCharge: Record<string, AdditionalTitleChargeSplit[]>
  policies: Policy[]
  contacts: Contact[]
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
