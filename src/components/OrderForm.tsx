'use client'

import { useState } from 'react'
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

export function OrderForm({
  action,
  order,
}: {
  action: (formData: FormData) => void
  order?: Order
}) {
  const [fileNumberUnlocked, setFileNumberUnlocked] = useState(false)
  const [transactionType, setTransactionType] = useState(
    order?.transaction_type ?? PRODUCT_TYPE_TO_TRANSACTION_TYPE[order?.product_type ?? 'Purchase'] ?? 'Purchase'
  )
  const [transactionTypeTouched, setTransactionTypeTouched] = useState(false)

  return (
    <form action={action} className="space-y-4">
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
          <Select name="policy_type" defaultValue={order?.policy_type ?? 'None'}>
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
          <CurrencyInput id="purchase_price" name="purchase_price" defaultValue={order?.purchase_price ?? undefined} />
        </div>
        <div>
          <Label htmlFor="loan_amount">Loan Amount</Label>
          <CurrencyInput id="loan_amount" name="loan_amount" defaultValue={order?.loan_amount ?? undefined} />
        </div>
      </div>

      <div>
        <Label htmlFor="property_address">Property Address</Label>
        <Input
          id="property_address"
          name="property_address"
          defaultValue={order?.property_address ?? undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ZipCountyField
          defaultCity={order?.property_city}
          defaultCounty={order?.property_county}
          defaultState={order?.property_state}
          defaultZip={order?.property_zip}
        />
      </div>

      <div>
        <Label htmlFor="parcel_number">Parcel Number</Label>
        <Input id="parcel_number" name="parcel_number" defaultValue={order?.parcel_number ?? undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="settlement_date">Settlement Date</Label>
          <Input
            id="settlement_date"
            name="settlement_date"
            type="date"
            defaultValue={order?.settlement_date ?? undefined}
          />
        </div>
        <div>
          <Label htmlFor="settlement_time">Settlement Time</Label>
          <Input
            id="settlement_time"
            name="settlement_time"
            type="time"
            defaultValue={order?.settlement_time ?? undefined}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="rush_order" name="rush_order" defaultChecked={order?.rush_order ?? false} />
        <Label htmlFor="rush_order">Rush Order</Label>
      </div>

      <OrderFormSubmitButton label={order ? 'Save Changes' : 'Create Order'} />
    </form>
  )
}
