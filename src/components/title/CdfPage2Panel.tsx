'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { addCdfPage2Line, updateCdfPage2Line, deleteCdfPage2Line } from '@/app/actions/cdf-page2'
import { computeCdfPage2Totals } from '@/lib/cdf-page2'
import { CDF_PAGE2_SECTIONS } from '@/lib/constants'
import type { CdfPage2Line, CdfPage2Totals } from '@/lib/types'

type Contact = { id: string; name: string }

function refresh() {
  window.location.reload()
}

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function LineRow({ orderId, line, contacts }: { orderId: string; line: CdfPage2Line; contacts: Contact[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateCdfPage2Line(orderId, line.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="space-y-2 rounded border p-3" data-testid={`cdf-line-${line.id}`}>
      <form ref={formRef} className="grid grid-cols-6 gap-2">
        <div className="col-span-2">
          <Label htmlFor={`cdf-line-${line.id}-description`}>Description</Label>
          <Input
            id={`cdf-line-${line.id}-description`}
            name="description"
            defaultValue={line.description ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`cdf-line-${line.id}-to_contact_id`}>To</Label>
          <select
            id={`cdf-line-${line.id}-to_contact_id`}
            name="to_contact_id"
            defaultValue={line.to_contact_id ?? ''}
            onBlur={handleSave}
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
          <Label htmlFor={`cdf-line-${line.id}-borrower_paid_at_closing`}>Borrower-Paid At Closing</Label>
          <Input
            id={`cdf-line-${line.id}-borrower_paid_at_closing`}
            name="borrower_paid_at_closing"
            type="number"
            step="0.01"
            defaultValue={line.borrower_paid_at_closing ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`cdf-line-${line.id}-borrower_paid_before_closing`}>Borrower-Paid Before Closing</Label>
          <Input
            id={`cdf-line-${line.id}-borrower_paid_before_closing`}
            name="borrower_paid_before_closing"
            type="number"
            step="0.01"
            defaultValue={line.borrower_paid_before_closing ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`cdf-line-${line.id}-seller_paid_at_closing`}>Seller-Paid At Closing</Label>
          <Input
            id={`cdf-line-${line.id}-seller_paid_at_closing`}
            name="seller_paid_at_closing"
            type="number"
            step="0.01"
            defaultValue={line.seller_paid_at_closing ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`cdf-line-${line.id}-seller_paid_before_closing`}>Seller-Paid Before Closing</Label>
          <Input
            id={`cdf-line-${line.id}-seller_paid_before_closing`}
            name="seller_paid_before_closing"
            type="number"
            step="0.01"
            defaultValue={line.seller_paid_before_closing ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`cdf-line-${line.id}-paid_by_others`}>Paid By Others</Label>
          <Input
            id={`cdf-line-${line.id}-paid_by_others`}
            name="paid_by_others"
            type="number"
            step="0.01"
            defaultValue={line.paid_by_others ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div className="col-span-6">
          <SaveIndicator state={state} errorMessage={errorMessage} />
        </div>
      </form>
      <button
        type="button"
        className="text-sm text-destructive hover:underline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deleteCdfPage2Line(orderId, line.id)
            refresh()
          })
        }
      >
        Remove item
      </button>
    </div>
  )
}

function SubtotalRow({ label, totals, showSeller = true }: { label: string; totals: CdfPage2Totals; showSeller?: boolean }) {
  return (
    <div className="grid grid-cols-6 gap-2 rounded bg-muted p-3 text-sm font-semibold" data-testid={`cdf-subtotal-${label}`}>
      <div className="col-span-2">{label}</div>
      <div />
      <div>${money(totals.borrowerAtClosing)}</div>
      <div>${money(totals.borrowerBeforeClosing)}</div>
      <div>{showSeller ? `$${money(totals.sellerAtClosing)}` : ''}</div>
      <div>{showSeller ? `$${money(totals.sellerBeforeClosing)}` : ''}</div>
    </div>
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
  const { bySection, d, i, j } = computeCdfPage2Totals(lines)

  function addSection(section: string) {
    startTransition(async () => {
      await addCdfPage2Line(orderId, section)
      refresh()
    })
  }

  return (
    <div className="max-w-5xl space-y-6" data-testid="cdf-page2-panel">
      <h2 className="text-lg font-semibold">CDF Page 2 — Closing Cost Details</h2>
      <p className="text-sm text-muted-foreground">
        Manual entry shell — line items are keyed in directly. Section subtotals and the grand total (D, I, J) compute
        automatically from these rows.
      </p>

      <div className="space-y-8" data-testid="cdf-section-list">
        {CDF_PAGE2_SECTIONS.map(({ code, label }) => {
          const sectionLines = lines.filter((l) => l.section === code)
          return (
            <div key={code} className="space-y-3" data-testid={`cdf-section-${code}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {code}. {label}
                </h3>
                <span className="text-sm text-muted-foreground">${money(bySection[code].borrowerAtClosing)}</span>
              </div>
              <div className="space-y-3" data-testid={`cdf-section-${code}-list`}>
                {sectionLines.map((line) => (
                  <LineRow key={line.id} orderId={orderId} line={line} contacts={contacts} />
                ))}
                {sectionLines.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
              </div>
              <Button type="button" variant="outline" onClick={() => addSection(code)} disabled={isPending}>
                + Add Item
              </Button>
              {code === 'C' && <SubtotalRow label="D. Total Loan Costs (Borrower-Paid)" totals={d} showSeller={false} />}
              {code === 'H' && (
                <>
                  <SubtotalRow label="I. Total Other Costs" totals={i} />
                  <SubtotalRow label="J. Total Closing Costs" totals={j} />
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
