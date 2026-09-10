'use client'

import { useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { saveCdfPage4 } from '@/app/actions/cdf-page4'
import { CdfWrap, CdfBar, CdfTable, CdfMeta, cdfAmtInputClass } from '@/components/title/cdf-chrome'
import type { CdfPage4 } from '@/lib/types'

export function CdfPage4Panel({ orderId, cdfPage4 }: { orderId: string; cdfPage4: CdfPage4 | null }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => saveCdfPage4(orderId, formData))

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <form ref={formRef} className="max-w-3xl" data-testid="cdf-page4-panel">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">CDF Page 4 — Additional Information About This Loan</h2>
        <p className="text-sm text-muted-foreground">Manual entry shell — fixed disclosure structure per the official form.</p>
      </div>
      <div className="mb-4">
        <SaveIndicator state={state} errorMessage={errorMessage} />
      </div>

      <CdfWrap>
        <CdfBar title="Assumption" />
        <CdfTable>
          <div className="flex items-center gap-2 border-t border-border py-1.5 first:border-t-0">
            <input id="has_assumption" type="checkbox" name="has_assumption" defaultChecked={cdfPage4?.has_assumption ?? false} onChange={handleSave} className="h-4 w-4" />
            <label htmlFor="has_assumption" className="text-[12.5px]">
              If you sell or transfer this property, does the lender have the right to a new buyer assuming the loan?
            </label>
          </div>
          <div className="flex items-center gap-2 border-t border-border py-1.5">
            <input
              id="assumption_allowed"
              type="checkbox"
              name="assumption_allowed"
              defaultChecked={cdfPage4?.assumption_allowed ?? false}
              onChange={handleSave}
              className="h-4 w-4"
            />
            <label htmlFor="assumption_allowed" className="text-[12.5px]">
              Assumption allowed (subject to lender approval)
            </label>
          </div>
        </CdfTable>
      </CdfWrap>

      <CdfWrap>
        <CdfBar title="Demand Feature" />
        <CdfTable>
          <div className="flex items-center gap-2 border-t border-border py-1.5 first:border-t-0">
            <input
              id="has_demand_feature"
              type="checkbox"
              name="has_demand_feature"
              defaultChecked={cdfPage4?.has_demand_feature ?? false}
              onChange={handleSave}
              className="h-4 w-4"
            />
            <label htmlFor="has_demand_feature" className="text-[12.5px]">
              Loan has a demand feature
            </label>
          </div>
          <div className="border-t border-border py-1.5">
            <Textarea
              name="demand_feature_explanation"
              placeholder="Explanation"
              defaultValue={cdfPage4?.demand_feature_explanation ?? ''}
              onBlur={handleSave}
              className="text-[12.5px]"
            />
          </div>
        </CdfTable>
      </CdfWrap>

      <CdfWrap>
        <CdfBar title="Late Payment" />
        <CdfTable>
          <CdfMeta label="Grace period (days)">
            <Input
              id="late_payment_grace_period_days"
              name="late_payment_grace_period_days"
              type="number"
              defaultValue={cdfPage4?.late_payment_grace_period_days ?? ''}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[120px]`}
            />
          </CdfMeta>
          <CdfMeta label="Late fee (%)">
            <Input
              id="late_payment_fee_percent"
              name="late_payment_fee_percent"
              type="number"
              step="0.01"
              defaultValue={cdfPage4?.late_payment_fee_percent ?? ''}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[120px]`}
            />
          </CdfMeta>
        </CdfTable>
      </CdfWrap>

      <CdfWrap>
        <CdfBar title="Negative Amortization" />
        <CdfTable>
          <div className="flex items-center gap-2 border-t border-border py-1.5 first:border-t-0">
            <input
              id="has_negative_amortization"
              type="checkbox"
              name="has_negative_amortization"
              defaultChecked={cdfPage4?.has_negative_amortization ?? false}
              onChange={handleSave}
              className="h-4 w-4"
            />
            <label htmlFor="has_negative_amortization" className="text-[12.5px]">
              Loan can result in negative amortization
            </label>
          </div>
          <div className="border-t border-border py-1.5">
            <Textarea
              name="negative_amortization_explanation"
              placeholder="Explanation"
              defaultValue={cdfPage4?.negative_amortization_explanation ?? ''}
              onBlur={handleSave}
              className="text-[12.5px]"
            />
          </div>
        </CdfTable>
      </CdfWrap>

      <CdfWrap>
        <CdfBar title="Partial Payments" />
        <CdfTable>
          <div className="flex items-center gap-2 border-t border-border py-1.5 first:border-t-0">
            <input
              id="partial_payments_accepted"
              type="checkbox"
              name="partial_payments_accepted"
              defaultChecked={cdfPage4?.partial_payments_accepted ?? false}
              onChange={handleSave}
              className="h-4 w-4"
            />
            <label htmlFor="partial_payments_accepted" className="text-[12.5px]">
              Lender may accept partial payments
            </label>
          </div>
          <div className="border-t border-border py-1.5">
            <Textarea
              name="partial_payments_explanation"
              placeholder="Explanation"
              defaultValue={cdfPage4?.partial_payments_explanation ?? ''}
              onBlur={handleSave}
              className="text-[12.5px]"
            />
          </div>
        </CdfTable>
      </CdfWrap>

      <CdfWrap>
        <CdfBar title="Security Interest" />
        <CdfTable>
          <div className="flex items-center gap-2 border-t border-border py-1.5 first:border-t-0">
            <input
              id="has_security_interest"
              type="checkbox"
              name="has_security_interest"
              defaultChecked={cdfPage4?.has_security_interest ?? false}
              onChange={handleSave}
              className="h-4 w-4"
            />
            <label htmlFor="has_security_interest" className="text-[12.5px]">
              You are granting a security interest in
            </label>
          </div>
          <div className="border-t border-border py-1.5">
            <Input
              name="security_interest_property_address"
              placeholder="Property address"
              defaultValue={cdfPage4?.security_interest_property_address ?? ''}
              onBlur={handleSave}
              className="h-7 px-1.5 text-[12.5px]"
            />
          </div>
        </CdfTable>
      </CdfWrap>

      <CdfWrap>
        <CdfBar title="Escrow Account" />
        <CdfTable>
          <div className="flex gap-4 border-t border-border py-1.5 first:border-t-0">
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                type="radio"
                name="escrow_type"
                value="Escrow"
                defaultChecked={cdfPage4?.escrow_type === 'Escrow'}
                onChange={handleSave}
              />
              Escrow
            </label>
            <label className="flex items-center gap-2 text-[12.5px]">
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
          <CdfMeta label="Initial Deposit">
            <CurrencyInput
              id="escrow_initial_deposit"
              name="escrow_initial_deposit"
              defaultValue={cdfPage4?.escrow_initial_deposit}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[160px]`}
            />
          </CdfMeta>
          <CdfMeta label="Monthly Escrow Payment">
            <CurrencyInput
              id="escrow_monthly_payment"
              name="escrow_monthly_payment"
              defaultValue={cdfPage4?.escrow_monthly_payment}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[160px]`}
            />
          </CdfMeta>
          <CdfMeta label="No Escrow — estimated property costs over year 1">
            <CurrencyInput
              id="no_escrow_estimated_property_costs"
              name="no_escrow_estimated_property_costs"
              defaultValue={cdfPage4?.no_escrow_estimated_property_costs}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[160px]`}
            />
          </CdfMeta>
          <div className="border-t border-border py-1.5">
            <label htmlFor="no_escrow_escrowed_note" className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">
              No Escrow note
            </label>
            <Textarea
              id="no_escrow_escrowed_note"
              name="no_escrow_escrowed_note"
              defaultValue={cdfPage4?.no_escrow_escrowed_note ?? ''}
              onBlur={handleSave}
              className="text-[12.5px]"
            />
          </div>
        </CdfTable>
      </CdfWrap>
    </form>
  )
}
