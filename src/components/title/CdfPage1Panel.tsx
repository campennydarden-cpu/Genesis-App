'use client'

import { useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { saveCdfPage1 } from '@/app/actions/cdf-page1'
import type { CdfPage1 } from '@/lib/types'

export function CdfPage1Panel({ orderId, cdfPage1 }: { orderId: string; cdfPage1: CdfPage1 | null }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => saveCdfPage1(orderId, formData))

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <form ref={formRef} className="max-w-3xl space-y-6" data-testid="cdf-page1-panel">
      <div>
        <h2 className="text-lg font-semibold">CDF Page 1 — Loan Terms, Projected Payments, Costs at Closing</h2>
        <p className="text-sm text-muted-foreground">
          Manual entry shell — simplified to the fixed-rate payment shape (one Loan Terms / Projected Payments row, not a
          multi-row adjustable-rate schedule).
        </p>
      </div>
      <SaveIndicator state={state} errorMessage={errorMessage} />

      <div className="space-y-3">
        <h3 className="font-semibold">Loan Terms</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="loan_amount">Loan Amount</Label>
            <Input
              id="loan_amount"
              name="loan_amount"
              type="number"
              step="0.01"
              defaultValue={cdfPage1?.loan_amount ?? ''}
              onBlur={handleSave}
            />
          </div>
          <div>
            <Label htmlFor="interest_rate">Interest Rate (%)</Label>
            <Input
              id="interest_rate"
              name="interest_rate"
              type="number"
              step="0.001"
              defaultValue={cdfPage1?.interest_rate ?? ''}
              onBlur={handleSave}
            />
          </div>
          <div>
            <Label htmlFor="monthly_principal_interest">Monthly Principal &amp; Interest</Label>
            <Input
              id="monthly_principal_interest"
              name="monthly_principal_interest"
              type="number"
              step="0.01"
              defaultValue={cdfPage1?.monthly_principal_interest ?? ''}
              onBlur={handleSave}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="principal_interest_can_increase"
            type="checkbox"
            name="principal_interest_can_increase"
            defaultChecked={cdfPage1?.principal_interest_can_increase ?? false}
            onChange={handleSave}
          />
          <Label htmlFor="principal_interest_can_increase">Can this amount increase after closing?</Label>
        </div>
        <div>
          <Label htmlFor="principal_interest_increase_explanation">Explanation</Label>
          <Textarea
            id="principal_interest_increase_explanation"
            name="principal_interest_increase_explanation"
            defaultValue={cdfPage1?.principal_interest_increase_explanation ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="has_prepayment_penalty"
                type="checkbox"
                name="has_prepayment_penalty"
                defaultChecked={cdfPage1?.has_prepayment_penalty ?? false}
                onChange={handleSave}
              />
              <Label htmlFor="has_prepayment_penalty">Prepayment Penalty</Label>
            </div>
            <Input
              name="prepayment_penalty_max"
              type="number"
              step="0.01"
              placeholder="Max amount"
              defaultValue={cdfPage1?.prepayment_penalty_max ?? ''}
              onBlur={handleSave}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="has_balloon_payment"
                type="checkbox"
                name="has_balloon_payment"
                defaultChecked={cdfPage1?.has_balloon_payment ?? false}
                onChange={handleSave}
              />
              <Label htmlFor="has_balloon_payment">Balloon Payment</Label>
            </div>
            <Input
              name="balloon_payment_amount"
              type="number"
              step="0.01"
              placeholder="Amount"
              defaultValue={cdfPage1?.balloon_payment_amount ?? ''}
              onBlur={handleSave}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Projected Payments</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="estimated_total_monthly_payment">Estimated Total Monthly Payment</Label>
            <Input
              id="estimated_total_monthly_payment"
              name="estimated_total_monthly_payment"
              type="number"
              step="0.01"
              defaultValue={cdfPage1?.estimated_total_monthly_payment ?? ''}
              onBlur={handleSave}
            />
          </div>
          <div>
            <Label htmlFor="estimated_escrow_monthly">Estimated Escrow (monthly)</Label>
            <Input
              id="estimated_escrow_monthly"
              name="estimated_escrow_monthly"
              type="number"
              step="0.01"
              defaultValue={cdfPage1?.estimated_escrow_monthly ?? ''}
              onBlur={handleSave}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <input
              id="taxes_included_in_escrow"
              type="checkbox"
              name="taxes_included_in_escrow"
              defaultChecked={cdfPage1?.taxes_included_in_escrow ?? false}
              onChange={handleSave}
            />
            <Label htmlFor="taxes_included_in_escrow">Property Taxes in escrow</Label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="homeowners_insurance_included_in_escrow"
              type="checkbox"
              name="homeowners_insurance_included_in_escrow"
              defaultChecked={cdfPage1?.homeowners_insurance_included_in_escrow ?? false}
              onChange={handleSave}
            />
            <Label htmlFor="homeowners_insurance_included_in_escrow">Homeowner&apos;s Insurance in escrow</Label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="other_escrow_included"
              type="checkbox"
              name="other_escrow_included"
              defaultChecked={cdfPage1?.other_escrow_included ?? false}
              onChange={handleSave}
            />
            <Label htmlFor="other_escrow_included">Other in escrow</Label>
          </div>
        </div>
        <div>
          <Label htmlFor="other_escrow_description">Other escrow description</Label>
          <Input
            id="other_escrow_description"
            name="other_escrow_description"
            defaultValue={cdfPage1?.other_escrow_description ?? ''}
            onBlur={handleSave}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Costs at Closing</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="closing_costs_total">Closing Costs</Label>
            <Input
              id="closing_costs_total"
              name="closing_costs_total"
              type="number"
              step="0.01"
              defaultValue={cdfPage1?.closing_costs_total ?? ''}
              onBlur={handleSave}
            />
          </div>
          <div>
            <Label htmlFor="cash_to_close_total">Cash to Close</Label>
            <Input
              id="cash_to_close_total"
              name="cash_to_close_total"
              type="number"
              step="0.01"
              defaultValue={cdfPage1?.cash_to_close_total ?? ''}
              onBlur={handleSave}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="closing_costs_note">Closing Costs note</Label>
          <Textarea id="closing_costs_note" name="closing_costs_note" defaultValue={cdfPage1?.closing_costs_note ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor="cash_to_close_note">Cash to Close note</Label>
          <Textarea id="cash_to_close_note" name="cash_to_close_note" defaultValue={cdfPage1?.cash_to_close_note ?? ''} onBlur={handleSave} />
        </div>
      </div>
    </form>
  )
}
