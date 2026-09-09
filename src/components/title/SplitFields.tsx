'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { SPLIT_BASIS_TYPES } from '@/lib/constants'

type Contact = { id: string; name: string }
type BillCode = { id: string; code: string }

type SplitRowData = {
  id: string
  payee_contact_id: string | null
  basis: string | null
  percent: number | null
  amount: number | null
  bill_code: string | null
}

function SplitRow({
  split,
  contacts,
  billCodes,
  onUpdate,
  onDelete,
  onDeleted,
}: {
  split: SplitRowData
  contacts: Contact[]
  billCodes: BillCode[]
  onUpdate: (formData: FormData) => Promise<{ error?: string }>
  onDelete: () => Promise<unknown>
  onDeleted: () => void
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave(onUpdate)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <form ref={formRef} className="grid grid-cols-6 items-end gap-2">
      <div className="col-span-2">
        <Label htmlFor={`${split.id}-payee`}>Payee</Label>
        <select
          id={`${split.id}-payee`}
          name="payee_contact_id"
          defaultValue={split.payee_contact_id ?? ''}
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
        <Label htmlFor={`${split.id}-basis`}>Basis</Label>
        <select
          id={`${split.id}-basis`}
          name="basis"
          defaultValue={split.basis ?? ''}
          onBlur={handleSave}
          className="block w-full rounded border px-2 py-1 text-sm"
        >
          <option value="">—</option>
          {SPLIT_BASIS_TYPES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${split.id}-percent`}>%</Label>
        <Input id={`${split.id}-percent`} name="percent" type="number" step="0.01" defaultValue={split.percent ?? ''} onBlur={handleSave} />
      </div>
      <div>
        <Label htmlFor={`${split.id}-amount`}>Amount</Label>
        <Input id={`${split.id}-amount`} name="amount" type="number" step="0.01" defaultValue={split.amount ?? ''} onBlur={handleSave} />
      </div>
      <div className="col-span-2">
        <Label htmlFor={`${split.id}-bill_code`}>Bill Code</Label>
        <select
          id={`${split.id}-bill_code`}
          name="bill_code"
          defaultValue={split.bill_code ?? ''}
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
      <div className="col-span-6 flex items-center justify-between">
        <SaveIndicator state={state} errorMessage={errorMessage} />
        <button
          type="button"
          className="text-sm text-destructive hover:underline"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await onDelete()
              onDeleted()
            })
          }
        >
          Remove split
        </button>
      </div>
    </form>
  )
}

export function SplitList({
  splits,
  contacts,
  billCodes,
  onAdd,
  onUpdate,
  onDelete,
  onChanged,
}: {
  splits: SplitRowData[]
  contacts: Contact[]
  billCodes: BillCode[]
  onAdd: () => Promise<unknown>
  onUpdate: (id: string, formData: FormData) => Promise<{ error?: string }>
  onDelete: (id: string) => Promise<unknown>
  onChanged: () => void
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-3 rounded border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Split</p>
      {splits.map((s) => (
        <SplitRow
          key={s.id}
          split={s}
          contacts={contacts}
          billCodes={billCodes}
          onUpdate={(formData) => onUpdate(s.id, formData)}
          onDelete={() => onDelete(s.id)}
          onDeleted={onChanged}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          startTransition(async () => {
            await onAdd()
            onChanged()
          })
        }
        disabled={isPending}
      >
        + Add Split
      </Button>
    </div>
  )
}
