'use client'

import { useRef, useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { SaveIndicator, type SaveState } from '@/components/SaveIndicator'
import { saveOrderInfo } from '@/app/actions/orders'
import { usePendingSave, startTransitionAsPromise } from '@/lib/pending-saves'
import { ORDER_STATUSES, TITLE_STATUSES, ESCROW_STATUSES, FUNCTIONAL_ROLES } from '@/lib/constants'
import type { Order } from '@/lib/types'

function formatOpenedDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

type OrderInfoFields = Pick<
  Order,
  | 'order_status'
  | 'title_status'
  | 'escrow_status'
  | 'title_opened_date'
  | 'escrow_opened_date'
  | 'title_officer'
  | 'curative_title_officer'
  | 'escrow_assistant'
  | 'escrow_officer'
  | 'closing_coordinator'
  | 'funder'
  | 'recording_specialist'
  | 'post_closer'
>

export function OrderInfoForm({ orderId, order }: { orderId: string; order: OrderInfoFields }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()
  const { register } = usePendingSave()
  // ponytail: serializes saves with a promise chain (global, not per-field) — fine at
  // this form's scale; swap for per-field chains if saves ever need to run concurrently.
  const saveChain = useRef<Promise<unknown>>(Promise.resolve())

  const titleOpenedDate = formatOpenedDate(order.title_opened_date)
  const escrowOpenedDate = formatOpenedDate(order.escrow_opened_date)

  function handleSave(override?: { name: string; value: string }) {
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    if (override) {
      formData.set(override.name, override.value)
    }
    setSaveState('saving')
    const promise = startTransitionAsPromise(startTransition, () =>
      saveChain.current.then(() => saveOrderInfo(orderId, formData))
    )
    saveChain.current = promise.catch(() => {})
    register(promise)
    promise
      .then((result) => {
        if (result.error) {
          setErrorMessage(result.error)
          setSaveState('error')
        } else {
          setSaveState('saved')
          setErrorMessage(undefined)
          setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000)
        }
      })
      .catch(() => {
        setErrorMessage(undefined)
        setSaveState('error')
      })
  }

  return (
    <form ref={formRef} className="max-w-2xl space-y-4">
      <SaveIndicator state={isPending ? 'saving' : saveState} errorMessage={errorMessage} />
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="order_status">Order Status</Label>
          <StatusBadge status={order.order_status} />
        </div>
        <Select
          name="order_status"
          defaultValue={order.order_status}
          onValueChange={(value) => value !== null && handleSave({ name: 'order_status', value })}
        >
          <SelectTrigger id="order_status" className="mt-1 w-full">
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="title_status">Title Status</Label>
          <StatusBadge status={order.title_status} />
        </div>
        <Select
          name="title_status"
          defaultValue={order.title_status}
          onValueChange={(value) => value !== null && handleSave({ name: 'title_status', value })}
        >
          <SelectTrigger id="title_status" className="mt-1 w-full">
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {TITLE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {titleOpenedDate && <p className="mt-1 text-xs text-muted-foreground">Title opened {titleOpenedDate}</p>}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="escrow_status">Escrow Status</Label>
          <StatusBadge status={order.escrow_status} />
        </div>
        <Select
          name="escrow_status"
          defaultValue={order.escrow_status}
          onValueChange={(value) => value !== null && handleSave({ name: 'escrow_status', value })}
        >
          <SelectTrigger id="escrow_status" className="mt-1 w-full">
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {ESCROW_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {escrowOpenedDate && <p className="mt-1 text-xs text-muted-foreground">Escrow opened {escrowOpenedDate}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FUNCTIONAL_ROLES.map(({ key, label }) => (
          <div key={key}>
            <Label htmlFor={key}>{label}</Label>
            <Input id={key} name={key} className="mt-1" defaultValue={order[key] ?? undefined} onBlur={() => handleSave()} />
          </div>
        ))}
      </div>
    </form>
  )
}
