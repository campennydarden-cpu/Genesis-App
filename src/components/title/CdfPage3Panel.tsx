'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import {
  saveCdfCashToClose,
  addPayoffPayment,
  updatePayoffPayment,
  deletePayoffPayment,
  addTransactionSummaryLine,
  updateTransactionSummaryLine,
  deleteTransactionSummaryLine,
} from '@/app/actions/cdf-page3'
import { CDF_YES_NO, CDF_TRANSACTION_SUMMARY_SECTIONS, CDF_TRANSACTION_SUMMARY_PARTIES } from '@/lib/constants'
import type { CdfCashToClose, CdfPayoffPayment, CdfTransactionSummaryLine } from '@/lib/types'

type Contact = { id: string; name: string }

function refresh() {
  window.location.reload()
}

function CashToCloseForm({ orderId, cashToClose }: { orderId: string; cashToClose: CdfCashToClose | null }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => saveCdfCashToClose(orderId, formData))

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  const rows = [
    { label: 'Loan Amount', est: 'loan_amount_estimate', fin: 'loan_amount_final', changed: 'loan_amount_changed' },
    { label: 'Total Closing Costs (J)', est: 'closing_costs_j_estimate', fin: 'closing_costs_j_final', changed: 'closing_costs_changed' },
    {
      label: 'Closing Costs Paid Before Closing',
      est: 'closing_costs_paid_before_closing_estimate',
      fin: 'closing_costs_paid_before_closing_final',
      changed: null,
    },
    { label: 'Total Payoffs and Payments (K)', est: 'payoffs_k_estimate', fin: 'payoffs_k_final', changed: 'payoffs_changed' },
  ] as const

  return (
    <form ref={formRef} className="space-y-3" data-testid="cdf-cash-to-close-form">
      <SaveIndicator state={state} errorMessage={errorMessage} />
      <div className="grid grid-cols-4 gap-2 text-sm font-semibold">
        <div />
        <div>Loan Estimate</div>
        <div>Final</div>
        <div>Did this change?</div>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-4 items-center gap-2">
          <Label>{row.label}</Label>
          <Input name={row.est} type="number" step="0.01" defaultValue={(cashToClose?.[row.est] as number) ?? ''} onBlur={handleSave} />
          <Input name={row.fin} type="number" step="0.01" defaultValue={(cashToClose?.[row.fin] as number) ?? ''} onBlur={handleSave} />
          {row.changed ? (
            <select
              name={row.changed}
              defaultValue={(cashToClose?.[row.changed] as string) ?? ''}
              onBlur={handleSave}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="">—</option>
              {CDF_YES_NO.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : (
            <div />
          )}
        </div>
      ))}

      <div className="grid grid-cols-4 gap-2 pt-2">
        <Label>Cash to Close</Label>
        <Input name="cash_to_close_estimate" type="number" step="0.01" defaultValue={cashToClose?.cash_to_close_estimate ?? ''} onBlur={handleSave} />
        <Input name="cash_to_close_final" type="number" step="0.01" defaultValue={cashToClose?.cash_to_close_final ?? ''} onBlur={handleSave} />
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              name="cash_to_close_from_borrower"
              defaultChecked={cashToClose?.cash_to_close_from_borrower ?? false}
              onChange={handleSave}
            />
            From Borrower
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              name="cash_to_close_to_borrower"
              defaultChecked={cashToClose?.cash_to_close_to_borrower ?? false}
              onChange={handleSave}
            />
            To Borrower
          </label>
        </div>
      </div>
      <div className="max-w-xs">
        <Label htmlFor="closing_costs_financed">Closing Costs Financed (Paid from your Loan Amount)</Label>
        <Input
          id="closing_costs_financed"
          name="closing_costs_financed"
          type="number"
          step="0.01"
          defaultValue={cashToClose?.closing_costs_financed ?? ''}
          onBlur={handleSave}
        />
      </div>
    </form>
  )
}

function PayoffRow({ orderId, item, contacts }: { orderId: string; item: CdfPayoffPayment; contacts: Contact[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updatePayoffPayment(orderId, item.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="space-y-2 rounded border p-3" data-testid={`cdf-payoff-${item.id}`}>
      <form ref={formRef} className="grid grid-cols-3 gap-2">
        <Input name="description" placeholder="Description" defaultValue={item.description ?? ''} onBlur={handleSave} />
        <select
          name="payee_contact_id"
          defaultValue={item.payee_contact_id ?? ''}
          onBlur={handleSave}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">To —</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Input name="amount" type="number" step="0.01" placeholder="Amount" defaultValue={item.amount ?? ''} onBlur={handleSave} />
        <div className="col-span-3">
          <SaveIndicator state={state} errorMessage={errorMessage} />
        </div>
      </form>
      <button
        type="button"
        className="text-sm text-destructive hover:underline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deletePayoffPayment(orderId, item.id)
            refresh()
          })
        }
      >
        Remove item
      </button>
    </div>
  )
}

function SummaryLineRow({ orderId, line }: { orderId: string; line: CdfTransactionSummaryLine }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateTransactionSummaryLine(orderId, line.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="space-y-1" data-testid={`cdf-summary-line-${line.id}`}>
      <form ref={formRef} className="flex gap-2">
        <Input name="description" placeholder="Description" defaultValue={line.description ?? ''} onBlur={handleSave} className="flex-1" />
        <Input
          name="amount"
          type="number"
          step="0.01"
          placeholder="Amount"
          defaultValue={line.amount ?? ''}
          onBlur={handleSave}
          className="w-32"
        />
        <button
          type="button"
          className="text-xs text-destructive hover:underline"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await deleteTransactionSummaryLine(orderId, line.id)
              refresh()
            })
          }
        >
          Remove
        </button>
      </form>
      <SaveIndicator state={state} errorMessage={errorMessage} />
    </div>
  )
}

function TransactionSummaryColumn({
  orderId,
  party,
  lines,
}: {
  orderId: string
  party: string
  lines: CdfTransactionSummaryLine[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-4" data-testid={`cdf-summary-${party.toLowerCase()}`}>
      <h4 className="font-semibold">{party}&apos;s Transaction</h4>
      {CDF_TRANSACTION_SUMMARY_SECTIONS.map(({ code, label }) => {
        const sectionLines = lines.filter((l) => l.party === party && l.section === code)
        return (
          <div key={code} className="space-y-2" data-testid={`cdf-summary-${party.toLowerCase()}-${code}`}>
            <p className="text-sm font-medium">{label}</p>
            <div className="space-y-1" data-testid={`cdf-summary-${party.toLowerCase()}-${code}-list`}>
              {sectionLines.map((line) => (
                <SummaryLineRow key={line.id} orderId={orderId} line={line} />
              ))}
              {sectionLines.length === 0 && <p className="text-xs text-muted-foreground">No items yet.</p>}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                startTransition(async () => {
                  await addTransactionSummaryLine(orderId, party, code)
                  refresh()
                })
              }
              disabled={isPending}
            >
              + Add Item
            </Button>
          </div>
        )
      })}
    </div>
  )
}

export function CdfPage3Panel({
  orderId,
  cashToClose,
  payoffs,
  contacts,
  summaryLines,
}: {
  orderId: string
  cashToClose: CdfCashToClose | null
  payoffs: CdfPayoffPayment[]
  contacts: Contact[]
  summaryLines: CdfTransactionSummaryLine[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-6xl space-y-8" data-testid="cdf-page3-panel">
      <div>
        <h2 className="text-lg font-semibold">CDF Page 3 — Calculating Cash to Close, Payoffs, Summaries of Transactions</h2>
        <p className="text-sm text-muted-foreground">
          Manual entry shell. Per-line payoff rate/per-diem calculation is a separate feature (Payoff Calculations), not built
          here.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Calculating Cash to Close</h3>
        <CashToCloseForm orderId={orderId} cashToClose={cashToClose} />
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">K. Payoffs and Payments</h3>
        <div className="space-y-3" data-testid="cdf-payoffs-list">
          {payoffs.map((p) => (
            <PayoffRow key={p.id} orderId={orderId} item={p} contacts={contacts} />
          ))}
          {payoffs.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            startTransition(async () => {
              await addPayoffPayment(orderId)
              refresh()
            })
          }
          disabled={isPending}
        >
          + Add Item
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Summaries of Transactions</h3>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {CDF_TRANSACTION_SUMMARY_PARTIES.map((party) => (
            <TransactionSummaryColumn key={party} orderId={orderId} party={party} lines={summaryLines} />
          ))}
        </div>
      </div>
    </div>
  )
}
