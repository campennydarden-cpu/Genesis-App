'use client'

import { useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { saveCdfPage4 } from '@/app/actions/cdf-page4'
import type { CdfPage4 } from '@/lib/types'

export function CdfPage4Panel({ orderId, cdfPage4 }: { orderId: string; cdfPage4: CdfPage4 | null }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => saveCdfPage4(orderId, formData))

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <form ref={formRef} className="max-w-3xl space-y-6" data-testid="cdf-page4-panel">
      <div>
        <h2 className="text-lg font-semibold">CDF Page 4 — Additional Information About This Loan</h2>
        <p className="text-sm text-muted-foreground">Manual entry shell — fixed disclosure structure per the official form.</p>
      </div>
      <SaveIndicator state={state} errorMessage={errorMessage} />

      <div className="space-y-2">
        <h3 className="font-semibold">Assumption</h3>
        <div className="flex items-center gap-2">
          <input id="has_assumption" type="checkbox" name="has_assumption" defaultChecked={cdfPage4?.has_assumption ?? false} onChange={handleSave} />
          <Label htmlFor="has_assumption">If you sell or transfer this property, does the lender have the right to a new buyer assuming the loan?</Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="assumption_allowed"
            type="checkbox"
            name="assumption_allowed"
            defaultChecked={cdfPage4?.assumption_allowed ?? false}
            onChange={handleSave}
          />
          <Label htmlFor="assumption_allowed">Assumption allowed (subject to lender approval)</Label>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Demand Feature</h3>
        <div className="flex items-center gap-2">
          <input
            id="has_demand_feature"
            type="checkbox"
            name="has_demand_feature"
            defaultChecked={cdfPage4?.has_demand_feature ?? false}
            onChange={handleSave}
          />
          <Label htmlFor="has_demand_feature">Loan has a demand feature</Label>
        </div>
        <Textarea
          name="demand_feature_explanation"
          placeholder="Explanation"
          defaultValue={cdfPage4?.demand_feature_explanation ?? ''}
          onBlur={handleSave}
        />
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Late Payment</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="late_payment_grace_period_days">Grace period (days)</Label>
            <Input
              id="late_payment_grace_period_days"
              name="late_payment_grace_period_days"
              type="number"
              defaultValue={cdfPage4?.late_payment_grace_period_days ?? ''}
              onBlur={handleSave}
            />
          </div>
          <div>
            <Label htmlFor="late_payment_fee_percent">Late fee (%)</Label>
            <Input
              id="late_payment_fee_percent"
              name="late_payment_fee_percent"
              type="number"
              step="0.01"
              defaultValue={cdfPage4?.late_payment_fee_percent ?? ''}
              onBlur={handleSave}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Negative Amortization</h3>
        <div className="flex items-center gap-2">
          <input
            id="has_negative_amortization"
            type="checkbox"
            name="has_negative_amortization"
            defaultChecked={cdfPage4?.has_negative_amortization ?? false}
            onChange={handleSave}
          />
          <Label htmlFor="has_negative_amortization">Loan can result in negative amortization</Label>
        </div>
        <Textarea
          name="negative_amortization_explanation"
          placeholder="Explanation"
          defaultValue={cdfPage4?.negative_amortization_explanation ?? ''}
          onBlur={handleSave}
        />
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Partial Payments</h3>
        <div className="flex items-center gap-2">
          <input
            id="partial_payments_accepted"
            type="checkbox"
            name="partial_payments_accepted"
            defaultChecked={cdfPage4?.partial_payments_accepted ?? false}
            onChange={handleSave}
          />
          <Label htmlFor="partial_payments_accepted">Lender may accept partial payments</Label>
        </div>
        <Textarea
          name="partial_payments_explanation"
          placeholder="Explanation"
          defaultValue={cdfPage4?.partial_payments_explanation ?? ''}
          onBlur={handleSave}
        />
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Security Interest</h3>
        <div className="flex items-center gap-2">
          <input
            id="has_security_interest"
            type="checkbox"
            name="has_security_interest"
            defaultChecked={cdfPage4?.has_security_interest ?? false}
            onChange={handleSave}
          />
          <Label htmlFor="has_security_interest">You are granting a security interest in</Label>
        </div>
        <Input
          name="security_interest_property_address"
          placeholder="Property address"
          defaultValue={cdfPage4?.security_interest_property_address ?? ''}
          onBlur={handleSave}
        />
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Escrow Account</h3>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="escrow_type"
              value="Escrow"
              defaultChecked={cdfPage4?.escrow_type === 'Escrow'}
              onChange={handleSave}
            />
            Escrow
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="escrow_type"
              value="No Escrow"
              defaultChecked={cdfPage4?.escrow_type === 'No Escrow'}
              onChange={handleSave}
            />
            No Escrow
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="escrow_initial_deposit">Initial Deposit</Label>
            <Input
              id="escrow_initial_deposit"
              name="escrow_initial_deposit"
              type="number"
              step="0.01"
              defaultValue={cdfPage4?.escrow_initial_deposit ?? ''}
              onBlur={handleSave}
            />
          </div>
          <div>
            <Label htmlFor="escrow_monthly_payment">Monthly Escrow Payment</Label>
            <Input
              id="escrow_monthly_payment"
              name="escrow_monthly_payment"
              type="number"
              step="0.01"
              defaultValue={cdfPage4?.escrow_monthly_payment ?? ''}
              onBlur={handleSave}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="no_escrow_estimated_property_costs">No Escrow — estimated property costs over year 1</Label>
          <Input
            id="no_escrow_estimated_property_costs"
            name="no_escrow_estimated_property_costs"
            type="number"
            step="0.01"
            defaultValue={cdfPage4?.no_escrow_estimated_property_costs ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor="no_escrow_escrowed_note">No Escrow note</Label>
          <Textarea id="no_escrow_escrowed_note" name="no_escrow_escrowed_note" defaultValue={cdfPage4?.no_escrow_escrowed_note ?? ''} onBlur={handleSave} />
        </div>
      </div>
    </form>
  )
}
