'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { INVOICE_STATUSES } from '@/lib/constants'
import {
  updateInvoice,
  deleteInvoice,
  generateInvoiceLineItems,
  addInvoiceLineItem,
  updateInvoiceLineItem,
  deleteInvoiceLineItem,
} from '@/app/actions/invoices'
import type { Invoice, InvoiceLineItem } from '@/lib/types'

type Contact = { id: string; name: string }
type BillCode = { id: string; code: string }

function refresh() {
  window.location.reload()
}

function LineItemRow({ orderId, item, billCodes }: { orderId: string; item: InvoiceLineItem; billCodes: BillCode[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateInvoiceLineItem(orderId, item.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="grid grid-cols-12 items-end gap-2 border-b py-2 last:border-b-0" data-testid={`invoice-line-${item.id}`}>
      <form ref={formRef} className="col-span-11 grid grid-cols-11 items-end gap-2">
        <div>
          <Label htmlFor={`line-${item.id}-print_to_invoice`}>Print</Label>
          <input
            id={`line-${item.id}-print_to_invoice`}
            type="checkbox"
            name="print_to_invoice"
            defaultChecked={item.print_to_invoice}
            onChange={handleSave}
            className="block h-4 w-4"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor={`line-${item.id}-bill_code`}>Bill Code</Label>
          <select
            id={`line-${item.id}-bill_code`}
            name="bill_code"
            defaultValue={item.bill_code ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {billCodes.map((b) => (
              <option key={b.id} value={b.code}>
                {b.code}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-4">
          <Label htmlFor={`line-${item.id}-description`}>Description</Label>
          <Input id={`line-${item.id}-description`} name="description" defaultValue={item.description ?? ''} onBlur={handleSave} />
        </div>
        <div className="col-span-2">
          <Label htmlFor={`line-${item.id}-amount`}>Amount</Label>
          <CurrencyInput id={`line-${item.id}-amount`} name="amount" defaultValue={item.amount} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`line-${item.id}-taxable`}>Taxable</Label>
          <input
            id={`line-${item.id}-taxable`}
            type="checkbox"
            name="taxable"
            defaultChecked={item.taxable}
            onChange={handleSave}
            className="block h-4 w-4"
          />
        </div>
        <div>
          <Label htmlFor={`line-${item.id}-tax`}>Tax</Label>
          <Input id={`line-${item.id}-tax`} name="tax" type="number" step="0.01" defaultValue={item.tax ?? ''} onBlur={handleSave} />
        </div>
      </form>
      <button
        type="button"
        className="col-span-1 text-sm text-destructive hover:underline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deleteInvoiceLineItem(orderId, item.id)
            refresh()
          })
        }
      >
        Remove
      </button>
      <div className="col-span-12">
        <SaveIndicator state={state} errorMessage={errorMessage} />
      </div>
    </div>
  )
}

function InvoiceCard({
  orderId,
  invoice,
  lineItems,
  contacts,
  billCodes,
}: {
  orderId: string
  invoice: Invoice
  lineItems: InvoiceLineItem[]
  contacts: Contact[]
  billCodes: BillCode[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateInvoice(orderId, invoice.id, formData))
  const [isPending, startTransition] = useTransition()
  const [generateMessage, setGenerateMessage] = useState<string | null>(null)

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  const printedItems = lineItems.filter((i) => i.print_to_invoice)
  const subtotal = printedItems.reduce((sum, i) => sum + (i.amount ?? 0), 0)
  const tax = printedItems.reduce((sum, i) => sum + (i.tax ?? 0), 0)
  const total = subtotal + tax

  return (
    <div className="space-y-4 rounded border p-4" data-testid={`invoice-${invoice.id}`}>
      <form ref={formRef} className="grid grid-cols-4 gap-3">
        <div>
          <Label htmlFor={`invoice-${invoice.id}-invoice_number`}>Invoice Number</Label>
          <Input
            id={`invoice-${invoice.id}-invoice_number`}
            name="invoice_number"
            defaultValue={invoice.invoice_number}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`invoice-${invoice.id}-status`}>Status</Label>
          <select
            id={`invoice-${invoice.id}-status`}
            name="status"
            defaultValue={invoice.status}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`invoice-${invoice.id}-invoice_date`}>Invoice Date</Label>
          <Input
            id={`invoice-${invoice.id}-invoice_date`}
            name="invoice_date"
            type="date"
            defaultValue={invoice.invoice_date ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`invoice-${invoice.id}-due_date`}>Due Date</Label>
          <Input
            id={`invoice-${invoice.id}-due_date`}
            name="due_date"
            type="date"
            defaultValue={invoice.due_date ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`invoice-${invoice.id}-bill_to`}>Bill To</Label>
          <select
            id={`invoice-${invoice.id}-bill_to`}
            name="bill_to_contact_id"
            defaultValue={invoice.bill_to_contact_id ?? ''}
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
          <Label htmlFor={`invoice-${invoice.id}-remit_to`}>Remit To</Label>
          <select
            id={`invoice-${invoice.id}-remit_to`}
            name="remit_to_contact_id"
            defaultValue={invoice.remit_to_contact_id ?? ''}
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
        <div className="col-span-2">
          <Label htmlFor={`invoice-${invoice.id}-message`}>Invoice Message</Label>
          <Input id={`invoice-${invoice.id}-message`} name="message" defaultValue={invoice.message ?? ''} onBlur={handleSave} />
        </div>
        <div className="col-span-4">
          <SaveIndicator state={state} errorMessage={errorMessage} />
        </div>
      </form>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Line Items</p>
        {lineItems.map((item) => (
          <LineItemRow key={item.id} orderId={orderId} item={item} billCodes={billCodes} />
        ))}
        {lineItems.length === 0 && <p className="text-sm text-muted-foreground">No line items yet.</p>}

        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await addInvoiceLineItem(orderId, invoice.id)
                refresh()
              })
            }
          >
            + Add Line Item
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await generateInvoiceLineItems(orderId, invoice.id)
                if (result.error) {
                  setGenerateMessage(result.error)
                } else if (result.added === 0) {
                  setGenerateMessage('No new bill-code lines to pull in — every tagged split is already on an invoice.')
                } else {
                  refresh()
                }
              })
            }
          >
            + Add Lines from Bill Codes
          </Button>
          {generateMessage && <p className="text-sm text-muted-foreground">{generateMessage}</p>}
        </div>

        <div className="mt-3 space-y-1 text-right text-sm">
          <p>Subtotal: {subtotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
          <p>Tax: {tax.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
          <p className="font-semibold">Invoice Total: {total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
        </div>
      </div>

      <button
        type="button"
        className="text-sm text-destructive hover:underline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deleteInvoice(orderId, invoice.id)
            refresh()
          })
        }
      >
        Remove invoice
      </button>
    </div>
  )
}

export function InvoicesPanel({
  orderId,
  invoices,
  lineItemsByInvoice,
  contacts,
  billCodes,
  onAdd,
}: {
  orderId: string
  invoices: Invoice[]
  lineItemsByInvoice: Record<string, InvoiceLineItem[]>
  contacts: Contact[]
  billCodes: BillCode[]
  onAdd: () => Promise<{ error?: string; id?: string }>
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-5xl space-y-4" data-testid="invoices-panel">
      <h2 className="text-lg font-semibold">Invoices</h2>
      <p className="text-sm text-muted-foreground">
        Line items are editable snapshots pulled from Bill-Code-tagged split rows across the order — editing a line here
        doesn&apos;t change the split it came from.
      </p>

      <div className="space-y-4" data-testid="invoice-list">
        {invoices.map((inv) => (
          <InvoiceCard
            key={inv.id}
            orderId={orderId}
            invoice={inv}
            lineItems={lineItemsByInvoice[inv.id] ?? []}
            contacts={contacts}
            billCodes={billCodes}
          />
        ))}
        {invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
      </div>

      <Button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await onAdd()
            refresh()
          })
        }
        disabled={isPending}
      >
        + Add Invoice
      </Button>
    </div>
  )
}
