'use client'

import { useRef, useTransition } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { addCdfPage2Line, updateCdfPage2Line, deleteCdfPage2Line } from '@/app/actions/cdf-page2'
import { computeCdfPage2Totals } from '@/lib/cdf-page2'
import { CDF_PAGE2_SECTIONS } from '@/lib/constants'
import { CdfWrap, CdfBar, CdfTable, CdfRow, CdfNum, cdfInputClass, cdfAmtInputClass, cdfSelectClass } from '@/components/title/cdf-chrome'
import type { CdfPage2Line, CdfPage2Totals } from '@/lib/types'

type Contact = { id: string; name: string }

function refresh() {
  window.location.reload()
}

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const GRID = 'grid-cols-[24px_1.7fr_1.1fr_0.85fr_0.85fr_0.85fr_0.85fr_0.85fr_26px]'

function LineRow({ orderId, line, contacts, num }: { orderId: string; line: CdfPage2Line; contacts: Contact[]; num: number }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateCdfPage2Line(orderId, line.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="border-t border-border py-1.5 first:border-t-0" data-testid={`cdf-line-${line.id}`}>
      <form ref={formRef} className={`grid ${GRID} items-center gap-2`}>
        <CdfNum>{num}</CdfNum>
        <Input
          aria-label="Description"
          name="description"
          defaultValue={line.description ?? ''}
          onBlur={handleSave}
          className={cdfInputClass}
        />
        <select
          aria-label="To"
          name="to_contact_id"
          defaultValue={line.to_contact_id ?? ''}
          onBlur={handleSave}
          className={cdfSelectClass}
        >
          <option value="">—</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Input
          aria-label="Borrower-Paid At Closing"
          name="borrower_paid_at_closing"
          type="number"
          step="0.01"
          defaultValue={line.borrower_paid_at_closing ?? ''}
          onBlur={handleSave}
          className={cdfAmtInputClass}
        />
        <Input
          aria-label="Borrower-Paid Before Closing"
          name="borrower_paid_before_closing"
          type="number"
          step="0.01"
          defaultValue={line.borrower_paid_before_closing ?? ''}
          onBlur={handleSave}
          className={cdfAmtInputClass}
        />
        <Input
          aria-label="Seller-Paid At Closing"
          name="seller_paid_at_closing"
          type="number"
          step="0.01"
          defaultValue={line.seller_paid_at_closing ?? ''}
          onBlur={handleSave}
          className={cdfAmtInputClass}
        />
        <Input
          aria-label="Seller-Paid Before Closing"
          name="seller_paid_before_closing"
          type="number"
          step="0.01"
          defaultValue={line.seller_paid_before_closing ?? ''}
          onBlur={handleSave}
          className={cdfAmtInputClass}
        />
        <Input
          aria-label="Paid By Others"
          name="paid_by_others"
          type="number"
          step="0.01"
          defaultValue={line.paid_by_others ?? ''}
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
              await deleteCdfPage2Line(orderId, line.id)
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

function GroupHeaderRow() {
  return (
    <CdfRow variant="header" className={`grid ${GRID}`}>
      <div />
      <div>Description</div>
      <div>To</div>
      <div className="text-right">Borrower At Closing</div>
      <div className="text-right">Borrower Before Closing</div>
      <div className="text-right">Seller At Closing</div>
      <div className="text-right">Seller Before Closing</div>
      <div className="text-right">Paid By Others</div>
      <div />
    </CdfRow>
  )
}

function SubtotalLine({
  id,
  label,
  totals,
  showSeller = true,
  variant = 'subtotal',
}: {
  id: string
  label: string
  totals: CdfPage2Totals
  showSeller?: boolean
  variant?: 'subtotal' | 'total'
}) {
  return (
    <CdfRow variant={variant} className={`grid ${GRID}`} data-testid={`cdf-subtotal-${id}`}>
      <div />
      <div className="col-span-2">{label}</div>
      <div className="text-right font-mono">${money(totals.borrowerAtClosing)}</div>
      <div className="text-right font-mono">${money(totals.borrowerBeforeClosing)}</div>
      <div className="text-right font-mono">{showSeller ? `$${money(totals.sellerAtClosing)}` : ''}</div>
      <div className="text-right font-mono">{showSeller ? `$${money(totals.sellerBeforeClosing)}` : ''}</div>
      <div />
      <div />
    </CdfRow>
  )
}

function SectionGroup({
  title,
  codes,
  lines,
  contacts,
  orderId,
  isPending,
  addSection,
  totalRow,
}: {
  title: string
  codes: string[]
  lines: CdfPage2Line[]
  contacts: Contact[]
  orderId: string
  isPending: boolean
  addSection: (section: string) => void
  totalRow: ReactNode
}) {
  return (
    <CdfWrap>
      <CdfBar title={title} />
      <CdfTable>
        <GroupHeaderRow />
        {codes.map((code) => {
          const label = CDF_PAGE2_SECTIONS.find((s) => s.code === code)!.label
          const sectionLines = lines.filter((l) => l.section === code)
          return (
            <div key={code} data-testid={`cdf-section-${code}`}>
              <CdfRow variant="section">
                {code}. {label}
              </CdfRow>
              <div data-testid={`cdf-section-${code}-list`}>
                {sectionLines.map((line, idx) => (
                  <LineRow key={line.id} orderId={orderId} line={line} contacts={contacts} num={idx + 1} />
                ))}
                {sectionLines.length === 0 && <p className="py-1.5 pl-[26px] text-xs text-muted-foreground">No items yet.</p>}
              </div>
              <div className="pt-1.5 pl-[26px]">
                <Button type="button" variant="outline" size="sm" onClick={() => addSection(code)} disabled={isPending}>
                  + Add Item
                </Button>
              </div>
            </div>
          )
        })}
        {totalRow}
      </CdfTable>
    </CdfWrap>
  )
}

export function CdfPage2Panel({
  orderId,
  lines,
  contacts,
}: {
  orderId: string
  lines: CdfPage2Line[]
  contacts: Contact[]
}) {
  const [isPending, startTransition] = useTransition()
  const { d, i, j } = computeCdfPage2Totals(lines)

  function addSection(section: string) {
    startTransition(async () => {
      await addCdfPage2Line(orderId, section)
      refresh()
    })
  }

  const loanCostCodes = CDF_PAGE2_SECTIONS.slice(0, 3).map((s) => s.code)
  const otherCostCodes = CDF_PAGE2_SECTIONS.slice(3).map((s) => s.code)

  return (
    <div className="max-w-5xl" data-testid="cdf-page2-panel">
      <h2 className="mb-1 text-lg font-semibold">CDF Page 2 — Closing Cost Details</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Manual entry shell — line items are keyed in directly. Section subtotals and the grand total (D, I, J) compute
        automatically from these rows.
      </p>

      <div data-testid="cdf-section-list">
        <SectionGroup
          title="Loan Costs"
          codes={loanCostCodes}
          lines={lines}
          contacts={contacts}
          orderId={orderId}
          isPending={isPending}
          addSection={addSection}
          totalRow={<SubtotalLine id="d" label="D. Total Loan Costs (Borrower-Paid)" totals={d} showSeller={false} />}
        />
        <SectionGroup
          title="Other Costs"
          codes={otherCostCodes}
          lines={lines}
          contacts={contacts}
          orderId={orderId}
          isPending={isPending}
          addSection={addSection}
          totalRow={<SubtotalLine id="i" label="I. Total Other Costs" totals={i} />}
        />
        <CdfWrap>
          <CdfBar title="Total Closing Costs (J)" />
          <CdfTable>
            <SubtotalLine id="j" label="J. Total Closing Costs" totals={j} variant="total" />
          </CdfTable>
        </CdfWrap>
      </div>
    </div>
  )
}
