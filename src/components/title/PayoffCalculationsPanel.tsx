'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import {
  updatePayoffCalculation,
  addPayoffAdditionalCharge,
  updatePayoffAdditionalCharge,
  deletePayoffAdditionalCharge,
} from '@/app/actions/payoff-calculations'
import type { CdfPayoffPayment, CdfPayoffAdditionalCharge } from '@/lib/types'

function refresh() {
  window.location.reload()
}

function AdditionalChargeRow({ orderId, charge }: { orderId: string; charge: CdfPayoffAdditionalCharge }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updatePayoffAdditionalCharge(orderId, charge.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="flex items-end gap-2" data-testid={`payoff-charge-${charge.id}`}>
      <form ref={formRef} className="flex flex-1 items-end gap-2">
        <div className="flex-1">
          <Label htmlFor={`payoff-charge-${charge.id}-description`}>Description</Label>
          <Input id={`payoff-charge-${charge.id}-description`} name="description" defaultValue={charge.description ?? ''} onBlur={handleSave} />
        </div>
        <div className="w-32">
          <Label htmlFor={`payoff-charge-${charge.id}-fee`}>Fee</Label>
          <Input id={`payoff-charge-${charge.id}-fee`} name="fee" type="number" step="0.01" defaultValue={charge.fee ?? ''} onBlur={handleSave} />
        </div>
        <SaveIndicator state={state} errorMessage={errorMessage} />
      </form>
      <button
        type="button"
        className="text-sm text-destructive hover:underline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deletePayoffAdditionalCharge(orderId, charge.id)
            refresh()
          })
        }
      >
        Remove
      </button>
    </div>
  )
}

function PayoffCalculationCard({
  orderId,
  payoff,
  charges,
}: {
  orderId: string
  payoff: CdfPayoffPayment
  charges: CdfPayoffAdditionalCharge[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updatePayoffCalculation(orderId, payoff.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="space-y-3 rounded border p-4" data-testid={`payoff-calc-${payoff.id}`}>
      <h3 className="font-semibold">{payoff.description || 'Untitled payoff'}</h3>
      <form ref={formRef} className="grid grid-cols-4 gap-2">
        <div>
          <Label htmlFor={`payoff-calc-${payoff.id}-principal_balance`}>Principal Balance</Label>
          <Input
            id={`payoff-calc-${payoff.id}-principal_balance`}
            name="principal_balance"
            type="number"
            step="0.01"
            defaultValue={payoff.principal_balance ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`payoff-calc-${payoff.id}-interest_rate`}>Interest Rate (%)</Label>
          <Input
            id={`payoff-calc-${payoff.id}-interest_rate`}
            name="interest_rate"
            type="number"
            step="0.001"
            defaultValue={payoff.interest_rate ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`payoff-calc-${payoff.id}-per_diem`}>Per Diem</Label>
          <Input
            id={`payoff-calc-${payoff.id}-per_diem`}
            name="per_diem"
            type="number"
            step="0.01"
            defaultValue={payoff.per_diem ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`payoff-calc-${payoff.id}-payoff_expires_on`}>Payoff Expires On</Label>
          <Input
            id={`payoff-calc-${payoff.id}-payoff_expires_on`}
            name="payoff_expires_on"
            type="date"
            defaultValue={payoff.payoff_expires_on ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`payoff-calc-${payoff.id}-interest_from`}>Interest From</Label>
          <Input
            id={`payoff-calc-${payoff.id}-interest_from`}
            name="interest_from"
            type="date"
            defaultValue={payoff.interest_from ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`payoff-calc-${payoff.id}-interest_to`}>Interest To</Label>
          <Input
            id={`payoff-calc-${payoff.id}-interest_to`}
            name="interest_to"
            type="date"
            defaultValue={payoff.interest_to ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`payoff-calc-${payoff.id}-additional_interest`}>Additional Interest</Label>
          <Input
            id={`payoff-calc-${payoff.id}-additional_interest`}
            name="additional_interest"
            type="number"
            step="0.01"
            defaultValue={payoff.additional_interest ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`payoff-calc-${payoff.id}-late_fee`}>Late Fee</Label>
          <Input
            id={`payoff-calc-${payoff.id}-late_fee`}
            name="late_fee"
            type="number"
            step="0.01"
            defaultValue={payoff.late_fee ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div className="col-span-4">
          <SaveIndicator state={state} errorMessage={errorMessage} />
        </div>
      </form>

      <div className="space-y-2">
        <p className="text-sm font-medium">Additional Payoff Charges</p>
        <div className="space-y-2" data-testid={`payoff-charges-list-${payoff.id}`}>
          {charges.map((c) => (
            <AdditionalChargeRow key={c.id} orderId={orderId} charge={c} />
          ))}
          {charges.length === 0 && <p className="text-sm text-muted-foreground">No additional charges.</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await addPayoffAdditionalCharge(orderId, payoff.id)
              refresh()
            })
          }
        >
          + Add Charge
        </Button>
      </div>
    </div>
  )
}

export function PayoffCalculationsPanel({
  orderId,
  payoffs,
  chargesByPayoff,
}: {
  orderId: string
  payoffs: CdfPayoffPayment[]
  chargesByPayoff: Record<string, CdfPayoffAdditionalCharge[]>
}) {
  return (
    <div className="max-w-5xl space-y-6" data-testid="payoff-calculations-panel">
      <div>
        <h2 className="text-lg font-semibold">Payoff Calculations</h2>
        <p className="text-sm text-muted-foreground">
          Detail behind each K. Payoffs and Payments line on CDF Page 3. Add or remove payoff line items on CDF Page 3 — this page
          only adds supporting detail to existing lines.
        </p>
      </div>

      {payoffs.map((p) => (
        <PayoffCalculationCard key={p.id} orderId={orderId} payoff={p} charges={chargesByPayoff[p.id] ?? []} />
      ))}
      {payoffs.length === 0 && <p className="text-sm text-muted-foreground">No payoffs yet. Add one on CDF Page 3.</p>}
    </div>
  )
}
