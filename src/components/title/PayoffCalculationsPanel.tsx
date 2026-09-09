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
  addPayoff,
  updatePayoffBase,
  deletePayoff,
} from '@/app/actions/payoff-calculations'
import type { CdfPayoffPayment, CdfPayoffAdditionalCharge } from '@/lib/types'

type Contact = { id: string; name: string }

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
  contacts,
}: {
  orderId: string
  payoff: CdfPayoffPayment
  charges: CdfPayoffAdditionalCharge[]
  contacts: Contact[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updatePayoffCalculation(orderId, payoff.id, formData))
  const baseFormRef = useRef<HTMLFormElement>(null)
  const { state: baseState, errorMessage: baseErrorMessage, save: saveBase } = useAutosave((formData: FormData) =>
    updatePayoffBase(orderId, payoff.id, formData)
  )
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  function handleSaveBase() {
    if (!baseFormRef.current) return
    saveBase(new FormData(baseFormRef.current))
  }

  return (
    <div className="space-y-3 rounded border p-4" data-testid={`payoff-calc-${payoff.id}`}>
      <form ref={baseFormRef} className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor={`payoff-calc-${payoff.id}-description`}>Description</Label>
          <Input
            id={`payoff-calc-${payoff.id}-description`}
            name="description"
            placeholder="e.g. Payoff of First Mortgage Loan"
            defaultValue={payoff.description ?? ''}
            onBlur={handleSaveBase}
          />
        </div>
        <div>
          <Label htmlFor={`payoff-calc-${payoff.id}-payee`}>To</Label>
          <select
            id={`payoff-calc-${payoff.id}-payee`}
            name="payee_contact_id"
            defaultValue={payoff.payee_contact_id ?? ''}
            onBlur={handleSaveBase}
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
          <Label htmlFor={`payoff-calc-${payoff.id}-amount`}>Amount</Label>
          <Input
            id={`payoff-calc-${payoff.id}-amount`}
            name="amount"
            type="number"
            step="0.01"
            defaultValue={payoff.amount ?? ''}
            onBlur={handleSaveBase}
          />
        </div>
        <div className="col-span-3">
          <SaveIndicator state={baseState} errorMessage={baseErrorMessage} />
        </div>
      </form>

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

      <button
        type="button"
        className="text-sm text-destructive hover:underline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deletePayoff(orderId, payoff.id)
            refresh()
          })
        }
      >
        Remove payoff
      </button>
    </div>
  )
}

export function PayoffCalculationsPanel({
  orderId,
  payoffs,
  chargesByPayoff,
  contacts,
}: {
  orderId: string
  payoffs: CdfPayoffPayment[]
  chargesByPayoff: Record<string, CdfPayoffAdditionalCharge[]>
  contacts: Contact[]
}) {
  const [isPending, startTransition] = useTransition()
  return (
    <div className="max-w-5xl space-y-6" data-testid="payoff-calculations-panel">
      <div>
        <h2 className="text-lg font-semibold">Payoff Calculations</h2>
        <p className="text-sm text-muted-foreground">
          Each payoff here is the same K. Payoffs and Payments line shown on CDF Page 3 — add, describe, or remove it from
          either screen.
        </p>
      </div>

      {payoffs.map((p) => (
        <PayoffCalculationCard key={p.id} orderId={orderId} payoff={p} charges={chargesByPayoff[p.id] ?? []} contacts={contacts} />
      ))}
      {payoffs.length === 0 && <p className="text-sm text-muted-foreground">No payoffs yet.</p>}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          startTransition(async () => {
            await addPayoff(orderId)
            refresh()
          })
        }
        disabled={isPending}
      >
        + Add Payoff
      </Button>
    </div>
  )
}
