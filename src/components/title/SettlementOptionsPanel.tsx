'use client'

import { useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { saveSettlementOptions } from '@/app/actions/settlement-options'
import { SETTLEMENT_TYPES, SELLER_CREDIT_METHODS } from '@/lib/constants'
import type { SettlementOptions } from '@/lib/types'

export function SettlementOptionsPanel({ orderId, settlementOptions }: { orderId: string; settlementOptions: SettlementOptions | null }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => saveSettlementOptions(orderId, formData))

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <form ref={formRef} className="max-w-3xl space-y-6" data-testid="settlement-options-panel">
      <div>
        <h2 className="text-lg font-semibold">Settlement Type &amp; Options</h2>
        <p className="text-sm text-muted-foreground">Manual entry shell — the calculation/print-behavior toggles SoftPro exposes here aren&apos;t applicable.</p>
      </div>
      <SaveIndicator state={state} errorMessage={errorMessage} />

      <div className="space-y-2">
        <h3 className="font-semibold">Settlement Type</h3>
        <div>
          <Label htmlFor="settlement_type">ALTA Settlement Statement</Label>
          <select
            id="settlement_type"
            name="settlement_type"
            defaultValue={settlementOptions?.settlement_type ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {SETTLEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Place of Settlement</h3>
        <div>
          <Label htmlFor="place_of_settlement_address">Address</Label>
          <Textarea
            id="place_of_settlement_address"
            name="place_of_settlement_address"
            defaultValue={settlementOptions?.place_of_settlement_address ?? ''}
            onBlur={handleSave}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Credit for Seller-Paid Premium(s)</h3>
        <div className="space-y-2">
          {SELLER_CREDIT_METHODS.map((option) => (
            <label key={option} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="seller_credit_method"
                value={option}
                defaultChecked={settlementOptions?.seller_credit_method === option}
                onChange={handleSave}
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Administrative Data</h3>
        <div className="grid grid-cols-2 gap-3">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <div key={n}>
              <Label htmlFor={`admin_data_cdf${n}`}>CDF Page {n}</Label>
              <Input
                id={`admin_data_cdf${n}`}
                name={`admin_data_cdf${n}`}
                defaultValue={settlementOptions?.[`admin_data_cdf${n}` as keyof SettlementOptions] ?? ''}
                onBlur={handleSave}
              />
            </div>
          ))}
        </div>
      </div>
    </form>
  )
}
