'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { TAX_PRORATION_CATEGORIES, PRORATION_COMPUTE_FOR, PRORATION_CREDIT_DEBIT } from '@/lib/constants'
import { calculateProration } from '@/lib/tax-proration'
import { addProration, updateProration, deleteProration, setProrationCdfLine } from '@/app/actions/tax-prorations'
import { assignNextCdfPage2Line } from '@/app/actions/cdf-page2'
import { CdfLineAssign } from '@/components/title/CdfLineAssign'
import type { TaxProration, CdfPage2Line } from '@/lib/types'

type Contact = { id: string; name: string }

function refresh() {
  window.location.reload()
}

function ProrationRow({
  orderId,
  proration,
  contacts,
  cdfLines,
}: {
  orderId: string
  proration: TaxProration
  contacts: Contact[]
  cdfLines: CdfPage2Line[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateProration(orderId, proration.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  function handleCalculate() {
    const form = formRef.current
    if (!form) return
    const shareOfAmount = Number((form.elements.namedItem('share_of_amount') as HTMLInputElement)?.value || 0)
    const periodFrom = (form.elements.namedItem('period_from') as HTMLInputElement)?.value
    const periodTo = (form.elements.namedItem('period_to') as HTMLInputElement)?.value
    const prorationDate = (form.elements.namedItem('proration_date') as HTMLInputElement)?.value
    const computeFor = (form.elements.namedItem('compute_for') as HTMLSelectElement)?.value as 'Buyer' | 'Seller'
    const use30DayMonths = (form.elements.namedItem('use_30_day_months') as HTMLInputElement)?.checked

    if (!periodFrom || !periodTo || !prorationDate || (computeFor !== 'Buyer' && computeFor !== 'Seller')) {
      return
    }

    const result = calculateProration({ shareOfAmount, periodFrom, periodTo, prorationDate, computeFor, use30DayMonths })

    ;(form.elements.namedItem('days_in_period') as HTMLInputElement).value = String(result.daysInPeriod)
    ;(form.elements.namedItem('days_prorated') as HTMLInputElement).value = String(result.daysProrated)
    ;(form.elements.namedItem('per_diem') as HTMLInputElement).value = String(result.perDiem)
    ;(form.elements.namedItem('prorated_amount') as HTMLInputElement).value = String(result.proratedAmount)

    handleSave()
  }

  return (
    <div className="space-y-3 rounded border p-4" data-testid={`proration-${proration.id}`}>
      <form ref={formRef} className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <Label htmlFor={`proration-${proration.id}-description`}>Description</Label>
          <Input
            id={`proration-${proration.id}-description`}
            name="description"
            defaultValue={proration.description ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-category`}>Category</Label>
          <select
            id={`proration-${proration.id}-category`}
            name="category"
            defaultValue={proration.category ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {TAX_PRORATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-payee`}>Payee</Label>
          <select
            id={`proration-${proration.id}-payee`}
            name="payee_contact_id"
            defaultValue={proration.payee_contact_id ?? ''}
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
          <Label htmlFor={`proration-${proration.id}-account_number`}>Account #</Label>
          <Input
            id={`proration-${proration.id}-account_number`}
            name="account_number"
            defaultValue={proration.account_number ?? ''}
            onBlur={handleSave}
          />
        </div>

        <div className="col-span-4 border-t pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Proration Calculation
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-share_of_amount`}>Share of Amount</Label>
          <Input
            id={`proration-${proration.id}-share_of_amount`}
            name="share_of_amount"
            type="number"
            step="0.01"
            defaultValue={proration.share_of_amount ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-compute_for`}>Compute For</Label>
          <select
            id={`proration-${proration.id}-compute_for`}
            name="compute_for"
            defaultValue={proration.compute_for ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {PRORATION_COMPUTE_FOR.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-credit_debit`}>Credit/Debit</Label>
          <select
            id={`proration-${proration.id}-credit_debit`}
            name="credit_debit"
            defaultValue={proration.credit_debit ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {PRORATION_CREDIT_DEBIT.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <input
            id={`proration-${proration.id}-use_30_day_months`}
            type="checkbox"
            name="use_30_day_months"
            defaultChecked={proration.use_30_day_months}
            onChange={handleSave}
          />
          <Label htmlFor={`proration-${proration.id}-use_30_day_months`}>30-day months</Label>
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-proration_date`}>Proration Date</Label>
          <Input
            id={`proration-${proration.id}-proration_date`}
            name="proration_date"
            type="date"
            defaultValue={proration.proration_date ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-period_from`}>Period From</Label>
          <Input
            id={`proration-${proration.id}-period_from`}
            name="period_from"
            type="date"
            defaultValue={proration.period_from ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-period_to`}>Period To</Label>
          <Input
            id={`proration-${proration.id}-period_to`}
            name="period_to"
            type="date"
            defaultValue={proration.period_to ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div className="col-span-1 flex items-end">
          <Button type="button" variant="outline" size="sm" onClick={handleCalculate}>
            Calculate
          </Button>
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-days_in_period`}>Days in Period</Label>
          <Input
            id={`proration-${proration.id}-days_in_period`}
            name="days_in_period"
            type="number"
            step="1"
            defaultValue={proration.days_in_period ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-days_prorated`}>Days Prorated</Label>
          <Input
            id={`proration-${proration.id}-days_prorated`}
            name="days_prorated"
            type="number"
            step="1"
            defaultValue={proration.days_prorated ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-per_diem`}>Per Diem</Label>
          <Input
            id={`proration-${proration.id}-per_diem`}
            name="per_diem"
            type="number"
            step="0.0001"
            defaultValue={proration.per_diem ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-prorated_amount`}>Prorated Amount</Label>
          <Input
            id={`proration-${proration.id}-prorated_amount`}
            name="prorated_amount"
            type="number"
            step="0.01"
            defaultValue={proration.prorated_amount ?? ''}
            onBlur={handleSave}
          />
        </div>

        <div className="col-span-2 border-t pt-3">
          <Label htmlFor={`proration-${proration.id}-cdf_line`}>CDF Line (note)</Label>
          <Input id={`proration-${proration.id}-cdf_line`} name="cdf_line" defaultValue={proration.cdf_line ?? ''} onBlur={handleSave} />
        </div>
        <div className="col-span-2 border-t pt-3">
          <Label>CDF Page 2 Assignment</Label>
          <CdfLineAssign
            cdfLineId={proration.cdf_page2_line_id}
            cdfLines={cdfLines}
            onAssign={async (section) => {
              const { id } = await assignNextCdfPage2Line(orderId, section)
              if (id) await setProrationCdfLine(orderId, proration.id, id)
              refresh()
            }}
            onUnassign={async () => {
              await setProrationCdfLine(orderId, proration.id, null)
              refresh()
            }}
          />
        </div>
        <div>
          <Label htmlFor={`proration-${proration.id}-bill_code`}>Bill Code</Label>
          <Input id={`proration-${proration.id}-bill_code`} name="bill_code" defaultValue={proration.bill_code ?? ''} onBlur={handleSave} />
        </div>
        <div className="col-span-4">
          <SaveIndicator state={state} errorMessage={errorMessage} />
        </div>
      </form>

      <button
        type="button"
        className="text-sm text-destructive hover:underline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deleteProration(orderId, proration.id)
            refresh()
          })
        }
      >
        Remove item
      </button>
    </div>
  )
}

export function TaxProrationsPanel({
  orderId,
  prorations,
  contacts,
  cdfLines,
}: {
  orderId: string
  prorations: TaxProration[]
  contacts: Contact[]
  cdfLines: CdfPage2Line[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-4xl space-y-4" data-testid="tax-prorations-panel">
      <h2 className="text-lg font-semibold">Tax / Other Prorations</h2>
      <p className="text-sm text-muted-foreground">
        Covers County Tax, City/Town Tax, Assessments, and HOA/COA — the day-count proration calculates from the dates
        below; rate lookups and escrow-reserve setup are out of scope for this shell.
      </p>

      <div className="space-y-4" data-testid="proration-list">
        {prorations.map((p) => (
          <ProrationRow key={p.id} orderId={orderId} proration={p} contacts={contacts} cdfLines={cdfLines} />
        ))}
        {prorations.length === 0 && <p className="text-sm text-muted-foreground">No tax or proration items yet.</p>}
      </div>

      <Button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await addProration(orderId)
            refresh()
          })
        }
        disabled={isPending}
      >
        + Add Item
      </Button>
    </div>
  )
}
