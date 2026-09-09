'use client'

import { useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { saveCdfPage1 } from '@/app/actions/cdf-page1'
import { CdfWrap, CdfBar, CdfTable, CdfMeta, cdfAmtInputClass } from '@/components/title/cdf-chrome'
import type { CdfPage1 } from '@/lib/types'

export function CdfPage1Panel({ orderId, cdfPage1 }: { orderId: string; cdfPage1: CdfPage1 | null }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => saveCdfPage1(orderId, formData))

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <form ref={formRef} className="max-w-3xl" data-testid="cdf-page1-panel">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">CDF Page 1 — Loan Terms, Projected Payments, Costs at Closing</h2>
        <p className="text-sm text-muted-foreground">
          Manual entry shell — simplified to the fixed-rate payment shape (one Loan Terms / Projected Payments row, not a
          multi-row adjustable-rate schedule).
        </p>
      </div>
      <div className="mb-4">
        <SaveIndicator state={state} errorMessage={errorMessage} />
      </div>

      <CdfWrap>
        <CdfBar title="Loan Terms" />
        <CdfTable>
          <CdfMeta label="Loan Amount">
            <Input
              name="loan_amount"
              type="number"
              step="0.01"
              defaultValue={cdfPage1?.loan_amount ?? ''}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[160px]`}
            />
          </CdfMeta>
          <CdfMeta label="Interest Rate (%)">
            <Input
              name="interest_rate"
              type="number"
              step="0.001"
              defaultValue={cdfPage1?.interest_rate ?? ''}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[160px]`}
            />
          </CdfMeta>
          <CdfMeta label="Monthly Principal & Interest">
            <Input
              name="monthly_principal_interest"
              type="number"
              step="0.01"
              defaultValue={cdfPage1?.monthly_principal_interest ?? ''}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[160px]`}
            />
          </CdfMeta>
          <CdfMeta label="Can this amount increase after closing?">
            <input
              id="principal_interest_can_increase"
              type="checkbox"
              name="principal_interest_can_increase"
              defaultChecked={cdfPage1?.principal_interest_can_increase ?? false}
              onChange={handleSave}
              className="h-4 w-4"
            />
          </CdfMeta>
          <div className="border-t border-border py-1.5">
            <label htmlFor="principal_interest_increase_explanation" className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">
              Explanation
            </label>
            <Textarea
              id="principal_interest_increase_explanation"
              name="principal_interest_increase_explanation"
              defaultValue={cdfPage1?.principal_interest_increase_explanation ?? ''}
              onBlur={handleSave}
              className="text-[12.5px]"
            />
          </div>
          <CdfMeta label="Prepayment Penalty">
            <div className="flex items-center gap-2">
              <input
                id="has_prepayment_penalty"
                type="checkbox"
                name="has_prepayment_penalty"
                defaultChecked={cdfPage1?.has_prepayment_penalty ?? false}
                onChange={handleSave}
                className="h-4 w-4"
              />
              <Input
                name="prepayment_penalty_max"
                type="number"
                step="0.01"
                placeholder="Max amount"
                defaultValue={cdfPage1?.prepayment_penalty_max ?? ''}
                onBlur={handleSave}
                className={`${cdfAmtInputClass} max-w-[140px]`}
              />
            </div>
          </CdfMeta>
          <CdfMeta label="Balloon Payment">
            <div className="flex items-center gap-2">
              <input
                id="has_balloon_payment"
                type="checkbox"
                name="has_balloon_payment"
                defaultChecked={cdfPage1?.has_balloon_payment ?? false}
                onChange={handleSave}
                className="h-4 w-4"
              />
              <Input
                name="balloon_payment_amount"
                type="number"
                step="0.01"
                placeholder="Amount"
                defaultValue={cdfPage1?.balloon_payment_amount ?? ''}
                onBlur={handleSave}
                className={`${cdfAmtInputClass} max-w-[140px]`}
              />
            </div>
          </CdfMeta>
        </CdfTable>
      </CdfWrap>

      <CdfWrap>
        <CdfBar title="Projected Payments" />
        <CdfTable>
          <CdfMeta label="Estimated Total Monthly Payment">
            <Input
              id="estimated_total_monthly_payment"
              name="estimated_total_monthly_payment"
              type="number"
              step="0.01"
              defaultValue={cdfPage1?.estimated_total_monthly_payment ?? ''}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[160px]`}
            />
          </CdfMeta>
          <CdfMeta label="Estimated Escrow (monthly)">
            <Input
              id="estimated_escrow_monthly"
              name="estimated_escrow_monthly"
              type="number"
              step="0.01"
              defaultValue={cdfPage1?.estimated_escrow_monthly ?? ''}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[160px]`}
            />
          </CdfMeta>
          <div className="flex flex-wrap gap-4 border-t border-border py-1.5">
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                id="taxes_included_in_escrow"
                type="checkbox"
                name="taxes_included_in_escrow"
                defaultChecked={cdfPage1?.taxes_included_in_escrow ?? false}
                onChange={handleSave}
                className="h-4 w-4"
              />
              Property Taxes in escrow
            </label>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                id="homeowners_insurance_included_in_escrow"
                type="checkbox"
                name="homeowners_insurance_included_in_escrow"
                defaultChecked={cdfPage1?.homeowners_insurance_included_in_escrow ?? false}
                onChange={handleSave}
                className="h-4 w-4"
              />
              Homeowner&apos;s Insurance in escrow
            </label>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                id="other_escrow_included"
                type="checkbox"
                name="other_escrow_included"
                defaultChecked={cdfPage1?.other_escrow_included ?? false}
                onChange={handleSave}
                className="h-4 w-4"
              />
              Other in escrow
            </label>
          </div>
          <CdfMeta label="Other escrow description">
            <Input
              id="other_escrow_description"
              name="other_escrow_description"
              defaultValue={cdfPage1?.other_escrow_description ?? ''}
              onBlur={handleSave}
              className="h-7 max-w-[220px] px-1.5 text-[12.5px]"
            />
          </CdfMeta>
        </CdfTable>
      </CdfWrap>

      <CdfWrap>
        <CdfBar title="Costs at Closing" />
        <CdfTable>
          <CdfMeta label="Closing Costs">
            <Input
              id="closing_costs_total"
              name="closing_costs_total"
              type="number"
              step="0.01"
              defaultValue={cdfPage1?.closing_costs_total ?? ''}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[160px]`}
            />
          </CdfMeta>
          <CdfMeta label="Cash to Close">
            <Input
              id="cash_to_close_total"
              name="cash_to_close_total"
              type="number"
              step="0.01"
              defaultValue={cdfPage1?.cash_to_close_total ?? ''}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[160px]`}
            />
          </CdfMeta>
          <div className="border-t border-border py-1.5">
            <label htmlFor="closing_costs_note" className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">
              Closing Costs note
            </label>
            <Textarea
              id="closing_costs_note"
              name="closing_costs_note"
              defaultValue={cdfPage1?.closing_costs_note ?? ''}
              onBlur={handleSave}
              className="text-[12.5px]"
            />
          </div>
          <div className="border-t border-border py-1.5">
            <label htmlFor="cash_to_close_note" className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">
              Cash to Close note
            </label>
            <Textarea
              id="cash_to_close_note"
              name="cash_to_close_note"
              defaultValue={cdfPage1?.cash_to_close_note ?? ''}
              onBlur={handleSave}
              className="text-[12.5px]"
            />
          </div>
        </CdfTable>
      </CdfWrap>
    </form>
  )
}
