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

// Section A's Points line is the one place on this manual-entry-shell screen with a real
// computed value — it's display-only help text, not written into the Borrower/Seller-Paid
// columns, matching every other CDF page's manual-entry discipline.
function computePointsAmount(line: CdfPage2Line, loanAmount: number | null) {
  if (line.points_percent == null) return null
  const raw = (line.points_percent / 100) * (loanAmount ?? 0)
  const base = line.points_round_whole_dollar ? Math.round(raw) : raw
  return base + (line.points_adjustment ?? 0)
}

function LineRow({
  orderId,
  line,
  contacts,
  num,
  loanAmount,
}: {
  orderId: string
  line: CdfPage2Line
  contacts: Contact[]
  num: number
  loanAmount: number | null
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateCdfPage2Line(orderId, line.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  const computedPoints = line.is_fixed && line.section === 'A' ? computePointsAmount(line, loanAmount) : null

  return (
    <div className="border-t border-border py-1.5 first:border-t-0" data-testid={`cdf-line-${line.id}`}>
      <form ref={formRef}>
        <div className={`grid ${GRID} items-center gap-2`}>
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
        {line.is_fixed ? (
          <div />
        ) : (
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
        )}
      </div>
      {line.is_fixed && line.section === 'A' && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[calc(24px+0.5rem)] text-[12px] text-muted-foreground">
          <span className="text-foreground">Percent Calculation:</span>
          <Input
            aria-label="Points Percent"
            name="points_percent"
            type="number"
            step="0.001"
            defaultValue={line.points_percent ?? ''}
            onBlur={handleSave}
            className="h-7 w-20 px-1.5 text-right"
          />
          <span>% of Loan Amount</span>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              name="points_round_whole_dollar"
              defaultChecked={line.points_round_whole_dollar}
              onChange={handleSave}
              className="h-3.5 w-3.5"
            />
            Round to nearest whole dollar
          </label>
          <span>Adjustment +/-</span>
          <Input
            aria-label="Points Adjustment"
            name="points_adjustment"
            type="number"
            step="0.01"
            defaultValue={line.points_adjustment ?? ''}
            onBlur={handleSave}
            className="h-7 w-24 px-1.5 text-right"
          />
          <span>For</span>
          <Input
            aria-label="Points Adjustment For"
            name="points_adjustment_for"
            defaultValue={line.points_adjustment_for ?? ''}
            onBlur={handleSave}
            className="h-7 w-32 px-1.5"
          />
          {computedPoints != null && <span className="ml-auto font-mono font-semibold text-foreground">= ${money(computedPoints)}</span>}
        </div>
      )}
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

// Section A's Points line and Section G's Aggregate Adjustment line are fixed rows
// (see `listCdfPage2Lines`'s auto-seed) rendered outside each section's normal
// `cdf-section-{code}-list` container — that container stays scoped to user-added
// rows so every existing e2e selector (`+ Add Item` count checks, `.first()` lookups)
// keeps working unchanged.
const FIXED_LINE_POSITION: Record<string, 'first' | 'last'> = { A: 'first', G: 'last' }

function SectionGroup({
  title,
  codes,
  lines,
  contacts,
  orderId,
  isPending,
  addSection,
  totalRow,
  loanAmount,
}: {
  title: string
  codes: string[]
  lines: CdfPage2Line[]
  contacts: Contact[]
  orderId: string
  isPending: boolean
  addSection: (section: string) => void
  totalRow: ReactNode
  loanAmount: number | null
}) {
  return (
    <CdfWrap>
      <CdfBar title={title} />
      <CdfTable>
        <GroupHeaderRow />
        {codes.map((code) => {
          const label = CDF_PAGE2_SECTIONS.find((s) => s.code === code)!.label
          const sectionLines = lines.filter((l) => l.section === code && !l.is_fixed)
          const fixedLine = lines.find((l) => l.section === code && l.is_fixed)
          const fixedPosition = FIXED_LINE_POSITION[code]
          return (
            <div key={code} data-testid={`cdf-section-${code}`}>
              <CdfRow variant="section">
                {code}. {label}
              </CdfRow>
              {fixedLine && fixedPosition === 'first' && (
                <div data-testid={`cdf-section-${code}-fixed`}>
                  <LineRow orderId={orderId} line={fixedLine} contacts={contacts} num={1} loanAmount={loanAmount} />
                </div>
              )}
              <div data-testid={`cdf-section-${code}-list`}>
                {sectionLines.map((line, idx) => (
                  <LineRow
                    key={line.id}
                    orderId={orderId}
                    line={line}
                    contacts={contacts}
                    num={fixedPosition === 'first' ? idx + 2 : idx + 1}
                    loanAmount={loanAmount}
                  />
                ))}
                {sectionLines.length === 0 && <p className="py-1.5 pl-[26px] text-xs text-muted-foreground">No items yet.</p>}
              </div>
              {fixedLine && fixedPosition === 'last' && (
                <div data-testid={`cdf-section-${code}-fixed`}>
                  <LineRow orderId={orderId} line={fixedLine} contacts={contacts} num={sectionLines.length + 1} loanAmount={loanAmount} />
                </div>
              )}
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
  loanAmount,
}: {
  orderId: string
  lines: CdfPage2Line[]
  contacts: Contact[]
  loanAmount: number | null
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
          loanAmount={loanAmount}
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
          loanAmount={loanAmount}
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
