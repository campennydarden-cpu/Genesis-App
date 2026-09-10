'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
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
import {
  CdfWrap,
  CdfBar,
  CdfTable,
  CdfRow,
  CdfNum,
  cdfInputClass,
  cdfAmtInputClass,
  cdfSelectClass,
} from '@/components/title/cdf-chrome'
import type { CdfCashToClose, CdfPayoffPayment, CdfTransactionSummaryLine } from '@/lib/types'

type Contact = { id: string; name: string }

function refresh() {
  window.location.reload()
}

const CASH_GRID = 'grid-cols-[1.8fr_0.85fr_0.85fr_0.85fr]'

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
    <form ref={formRef} data-testid="cdf-cash-to-close-form">
      <div className="mb-3">
        <SaveIndicator state={state} errorMessage={errorMessage} />
      </div>
      <CdfWrap>
        <CdfBar title="Calculating Cash to Close" />
        <CdfTable>
          <CdfRow variant="header" className={`grid ${CASH_GRID}`}>
            <div />
            <div className="text-right">Loan Estimate</div>
            <div className="text-right">Final</div>
            <div>Did this change?</div>
          </CdfRow>
          {rows.map((row) => (
            <CdfRow key={row.label} className={`grid ${CASH_GRID}`}>
              <div className="text-[12.5px]">{row.label}</div>
              <CurrencyInput
                id={row.est}
                name={row.est}
                defaultValue={(cashToClose?.[row.est] as number) ?? null}
                onBlur={handleSave}
                className={cdfAmtInputClass}
              />
              <CurrencyInput
                id={row.fin}
                name={row.fin}
                defaultValue={(cashToClose?.[row.fin] as number) ?? null}
                onBlur={handleSave}
                className={cdfAmtInputClass}
              />
              {row.changed ? (
                <select
                  name={row.changed}
                  defaultValue={(cashToClose?.[row.changed] as string) ?? ''}
                  onBlur={handleSave}
                  className={cdfSelectClass}
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
            </CdfRow>
          ))}

          <CdfRow variant="total" className={`grid ${CASH_GRID}`}>
            <div className="text-[13px]">Cash to Close</div>
            <CurrencyInput
              id="cash_to_close_estimate"
              name="cash_to_close_estimate"
              defaultValue={cashToClose?.cash_to_close_estimate}
              onBlur={handleSave}
              className={cdfAmtInputClass}
            />
            <CurrencyInput
              id="cash_to_close_final"
              name="cash_to_close_final"
              defaultValue={cashToClose?.cash_to_close_final}
              onBlur={handleSave}
              className={cdfAmtInputClass}
            />
            <div className="flex items-center gap-3 text-[11.5px] font-normal">
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
          </CdfRow>

          <div className="border-t border-border py-1.5">
            <label htmlFor="closing_costs_financed" className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">
              Closing Costs Financed (Paid from your Loan Amount)
            </label>
            <CurrencyInput
              id="closing_costs_financed"
              name="closing_costs_financed"
              defaultValue={cashToClose?.closing_costs_financed}
              onBlur={handleSave}
              className={`${cdfAmtInputClass} max-w-[180px]`}
            />
          </div>
        </CdfTable>
      </CdfWrap>
    </form>
  )
}

const PAYOFF_GRID = 'grid-cols-[24px_2fr_1.2fr_0.9fr_26px]'

function PayoffRow({ orderId, item, contacts, num }: { orderId: string; item: CdfPayoffPayment; contacts: Contact[]; num: number }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updatePayoffPayment(orderId, item.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="border-t border-border py-1.5 first:border-t-0" data-testid={`cdf-payoff-${item.id}`}>
      <form ref={formRef} className={`grid ${PAYOFF_GRID} items-center gap-2`}>
        <CdfNum>{num}</CdfNum>
        <Input name="description" placeholder="Description" defaultValue={item.description ?? ''} onBlur={handleSave} className={cdfInputClass} />
        <select name="payee_contact_id" defaultValue={item.payee_contact_id ?? ''} onBlur={handleSave} className={cdfSelectClass}>
          <option value="">To —</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <CurrencyInput
          aria-label="Amount"
          name="amount"
          placeholder="Amount"
          defaultValue={item.amount}
          onBlur={handleSave}
          className={cdfAmtInputClass}
        />
        <button
          type="button"
          aria-label="Remove item"
          title="Remove item"
          disabled={isPending}
          className="text-right text-sm text-muted-foreground hover:text-destructive"
          onClick={() =>
            startTransition(async () => {
              await deletePayoffPayment(orderId, item.id)
              refresh()
            })
          }
        >
          ✕
        </button>
      </form>
      <div className="pl-[calc(24px+0.5rem)]">
        <SaveIndicator state={state} errorMessage={errorMessage} />
      </div>
    </div>
  )
}

const SUMMARY_GRID = 'grid-cols-[1fr_0.7fr_22px]'

function SummaryLineRow({ orderId, line }: { orderId: string; line: CdfTransactionSummaryLine }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateTransactionSummaryLine(orderId, line.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="border-t border-border py-1 first:border-t-0" data-testid={`cdf-summary-line-${line.id}`}>
      <form ref={formRef} className={`grid ${SUMMARY_GRID} items-center gap-1.5`}>
        <Input
          name="description"
          placeholder="Description"
          defaultValue={line.description ?? ''}
          onBlur={handleSave}
          className={cdfInputClass}
        />
        <CurrencyInput
          aria-label="Amount"
          name="amount"
          placeholder="Amount"
          defaultValue={line.amount}
          onBlur={handleSave}
          allowNegative
          className={cdfAmtInputClass}
        />
        <button
          type="button"
          aria-label="Remove"
          title="Remove"
          disabled={isPending}
          className="text-right text-xs text-muted-foreground hover:text-destructive"
          onClick={() =>
            startTransition(async () => {
              await deleteTransactionSummaryLine(orderId, line.id)
              refresh()
            })
          }
        >
          ✕
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
    <CdfWrap>
      <CdfBar title={`${party}'s Transaction`} />
      <CdfTable>
        <div data-testid={`cdf-summary-${party.toLowerCase()}`}>
          {CDF_TRANSACTION_SUMMARY_SECTIONS.map(({ code, label }) => {
            const sectionLines = lines.filter((l) => l.party === party && l.section === code)
            return (
              <div key={code} data-testid={`cdf-summary-${party.toLowerCase()}-${code}`}>
                <CdfRow variant="section">{label}</CdfRow>
                <div data-testid={`cdf-summary-${party.toLowerCase()}-${code}-list`}>
                  {sectionLines.map((line) => (
                    <SummaryLineRow key={line.id} orderId={orderId} line={line} />
                  ))}
                  {sectionLines.length === 0 && <p className="py-1 text-xs text-muted-foreground">No items yet.</p>}
                </div>
                <div className="pt-1.5">
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
              </div>
            )
          })}
        </div>
      </CdfTable>
    </CdfWrap>
  )
}

export function CdfPage3Panel({
  orderId,
  cashToClose,
  payoffs,
  contacts,
  summaryLines,
  transactionType,
}: {
  orderId: string
  cashToClose: CdfCashToClose | null
  payoffs: CdfPayoffPayment[]
  contacts: Contact[]
  summaryLines: CdfTransactionSummaryLine[]
  transactionType: string | null
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-6xl" data-testid="cdf-page3-panel">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">CDF Page 3 — Calculating Cash to Close, Payoffs, Summaries of Transactions</h2>
        <p className="text-sm text-muted-foreground">
          Manual entry shell. Per-line payoff rate/per-diem calculation is a separate feature (Payoff Calculations), not built
          here.
        </p>
      </div>

      <CashToCloseForm orderId={orderId} cashToClose={cashToClose} />

      <CdfWrap>
        <CdfBar title="K. Payoffs and Payments" />
        <CdfTable>
          <div data-testid="cdf-payoffs-list">
            {payoffs.map((p, idx) => (
              <PayoffRow key={p.id} orderId={orderId} item={p} contacts={contacts} num={idx + 1} />
            ))}
            {payoffs.length === 0 && <p className="py-1.5 text-sm text-muted-foreground">No items yet.</p>}
          </div>
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
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
        </CdfTable>
      </CdfWrap>

      {transactionType === 'Purchase' && (
        <div className="mt-2">
          <h3 className="mb-2 font-semibold">Summaries of Transactions</h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {CDF_TRANSACTION_SUMMARY_PARTIES.map((party) => (
              <TransactionSummaryColumn key={party} orderId={orderId} party={party} lines={summaryLines} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
