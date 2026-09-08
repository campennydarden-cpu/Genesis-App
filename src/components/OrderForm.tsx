'use client'

import { useRef, useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import { PRODUCT_TYPES, POLICY_TYPES, TRANSACTION_TYPES, PRODUCT_TYPE_TO_TRANSACTION_TYPE } from '@/lib/constants'
import type { Order } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ZipCountyField } from '@/components/ZipCountyField'
import { OrderFormSubmitButton } from '@/components/OrderFormSubmitButton'
import { SaveIndicator } from '@/components/SaveIndicator'
import { saveOrderEntry } from '@/app/actions/orders'
import { useAutosave } from '@/lib/use-autosave'

export function OrderForm({
  action,
  order,
}: {
  /** Used only when creating a new order (no `order` prop) — editing an existing
   *  order autosaves via `saveOrderEntry` instead of a submit action. */
  action?: (formData: FormData) => void
  order?: Order
}) {
  const [fileNumberUnlocked, setFileNumberUnlocked] = useState(false)
  const [transactionType, setTransactionType] = useState(
    order?.transaction_type ?? PRODUCT_TYPE_TO_TRANSACTION_TYPE[order?.product_type ?? 'Purchase'] ?? 'Purchase'
  )
  const [transactionTypeTouched, setTransactionTypeTouched] = useState(false)

  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => {
    if (!order) throw new Error('OrderForm.save called without an order to save against')
    return saveOrderEntry(order.id, formData)
  })

  function handleSave(override?: { name: string; value: string }) {
    if (!formRef.current || !order) return
    const formData = new FormData(formRef.current)
    if (override) {
      formData.set(override.name, override.value)
    }
    save(formData)
  }

  return (
    <form ref={formRef} action={order ? undefined : action} className="space-y-4">
      {order && <SaveIndicator state={state} errorMessage={errorMessage} />}
      {order && (
        <div>
          <Label htmlFor="file_number">File Number</Label>
          <div className="flex items-center gap-2">
            <Input
              id="file_number"
              name="file_number"
              defaultValue={order.file_number}
              readOnly={!fileNumberUnlocked}
              className={!fileNumberUnlocked ? 'bg-input/50 text-muted-foreground' : undefined}
              onBlur={() => handleSave()}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={fileNumberUnlocked ? 'File number unlocked' : 'Edit file number'}
              disabled={fileNumberUnlocked}
              onClick={() => setFileNumberUnlocked(true)}
            >
              <Pencil />
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="product_type">Product Type</Label>
          <Select
            name="product_type"
            defaultValue={order?.product_type ?? 'Purchase'}
            onValueChange={(v) => {
              if (!transactionTypeTouched) {
                const suggested = PRODUCT_TYPE_TO_TRANSACTION_TYPE[v as string]
                if (suggested) setTransactionType(suggested)
              }
              if (order) handleSave({ name: 'product_type', value: v as string })
            }}
          >
            <SelectTrigger id="product_type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="policy_type">Policy Type</Label>
          <Select
            name="policy_type"
            defaultValue={order?.policy_type ?? 'None'}
            onValueChange={(v) => order && handleSave({ name: 'policy_type', value: v as string })}
          >
            <SelectTrigger id="policy_type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POLICY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Transaction Type</Label>
        <RadioGroup
          name="transaction_type"
          required
          value={transactionType}
          onValueChange={(v) => {
            setTransactionType(v as string)
            setTransactionTypeTouched(true)
            if (order) handleSave({ name: 'transaction_type', value: v as string })
          }}
          className="mt-1"
        >
          {TRANSACTION_TYPES.map((t) => (
            <RadioGroupItem key={t} value={t}>
              {t}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="purchase_price">Purchase Price</Label>
          <CurrencyInput
            id="purchase_price"
            name="purchase_price"
            defaultValue={order?.purchase_price ?? undefined}
            onBlur={order ? () => handleSave() : undefined}
          />
        </div>
        <div>
          <Label htmlFor="loan_amount">Loan Amount</Label>
          <CurrencyInput
            id="loan_amount"
            name="loan_amount"
            defaultValue={order?.loan_amount ?? undefined}
            onBlur={order ? () => handleSave() : undefined}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="property_address">Property Address</Label>
        <Input
          id="property_address"
          name="property_address"
          defaultValue={order?.property_address ?? undefined}
          onBlur={() => order && handleSave()}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ZipCountyField
          defaultCity={order?.property_city}
          defaultCounty={order?.property_county}
          defaultState={order?.property_state}
          defaultZip={order?.property_zip}
          onFieldsChanged={order ? () => handleSave() : undefined}
        />
      </div>

      <div>
        <Label htmlFor="parcel_number">Parcel Number</Label>
        <Input
          id="parcel_number"
          name="parcel_number"
          defaultValue={order?.parcel_number ?? undefined}
          onBlur={() => order && handleSave()}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="settlement_date">Settlement Date</Label>
          <Input
            id="settlement_date"
            name="settlement_date"
            type="date"
            defaultValue={order?.settlement_date ?? undefined}
            onBlur={() => order && handleSave()}
          />
        </div>
        <div>
          <Label htmlFor="settlement_time">Settlement Time</Label>
          <Input
            id="settlement_time"
            name="settlement_time"
            type="time"
            defaultValue={order?.settlement_time ?? undefined}
            onBlur={() => order && handleSave()}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="rush_order"
          name="rush_order"
          defaultChecked={order?.rush_order ?? false}
          onCheckedChange={(checked) => order && handleSave({ name: 'rush_order', value: checked ? 'on' : '' })}
        />
        <Label htmlFor="rush_order">Rush Order</Label>
      </div>

      {!order && <OrderFormSubmitButton label="Create Order" />}
    </form>
  )
}
