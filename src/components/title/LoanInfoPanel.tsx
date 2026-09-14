'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SaveIndicator } from '@/components/SaveIndicator'
import { addLoan, updateLoan, deleteLoan } from '@/app/actions/loans'
import { useAutosave } from '@/lib/use-autosave'
import { LOAN_TYPES } from '@/lib/constants'
import type { Loan } from '@/lib/types'

function refresh() {
  window.location.reload()
}

function LoanRow({
  orderId,
  loan,
  lenderContacts,
}: {
  orderId: string
  loan: Loan
  lenderContacts: { id: string; name: string }[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateLoan(orderId, loan.id, formData))

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="space-y-2 rounded border p-3" data-testid={`loan-row-${loan.id}`}>
      <form ref={formRef} className="grid grid-cols-4 gap-2">
        <div>
          <Label htmlFor={`loan-${loan.id}-lender_contact_id`}>Lender</Label>
          <select
            id={`loan-${loan.id}-lender_contact_id`}
            name="lender_contact_id"
            defaultValue={loan.lender_contact_id ?? ''}
            onChange={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">— Select —</option>
            {lenderContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`loan-${loan.id}-principal_amount`}>Principal Amount</Label>
          <CurrencyInput
            id={`loan-${loan.id}-principal_amount`}
            name="principal_amount"
            defaultValue={loan.principal_amount ?? undefined}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`loan-${loan.id}-annual_interest_rate`}>Interest Rate (%)</Label>
          <Input
            id={`loan-${loan.id}-annual_interest_rate`}
            name="annual_interest_rate"
            type="number"
            step="0.001"
            defaultValue={loan.annual_interest_rate ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`loan-${loan.id}-loan_number`}>Loan Number</Label>
          <Input
            id={`loan-${loan.id}-loan_number`}
            name="loan_number"
            defaultValue={loan.loan_number ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`loan-${loan.id}-loan_type`}>Loan Type</Label>
          <select
            id={`loan-${loan.id}-loan_type`}
            name="loan_type"
            defaultValue={loan.loan_type ?? ''}
            onChange={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">— Select —</option>
            {LOAN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`loan-${loan.id}-construction_equity_draw_amount`}>Construction/Equity First Draw Amount</Label>
          <CurrencyInput
            id={`loan-${loan.id}-construction_equity_draw_amount`}
            name="construction_equity_draw_amount"
            defaultValue={loan.construction_equity_draw_amount ?? undefined}
            onBlur={handleSave}
          />
        </div>
      </form>
      <div className="flex items-center justify-between">
        <SaveIndicator state={state} errorMessage={errorMessage} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm('Remove this loan?')) {
              deleteLoan(orderId, loan.id).then(refresh)
            }
          }}
        >
          Remove
        </Button>
      </div>
    </div>
  )
}

export function LoanInfoPanel({
  orderId,
  loans,
  lenderContacts,
}: {
  orderId: string
  loans: Loan[]
  lenderContacts: { id: string; name: string }[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-5xl space-y-4" data-testid="loan-info-panel">
      <h2 className="text-lg font-semibold">Loan Information & Funding</h2>

      <div className="space-y-3">
        {loans.map((loan) => (
          <LoanRow key={loan.id} orderId={orderId} loan={loan} lenderContacts={lenderContacts} />
        ))}
        {loans.length === 0 && <p className="text-sm text-muted-foreground">No loans yet.</p>}
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await addLoan(orderId)
            refresh()
          })
        }}
      >
        + Add Loan
      </Button>
    </div>
  )
}
