'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { fmtCurrency } from '@/lib/format'

/**
 * Formats as `$#,###.00` on blur; edits as plain digits. Submits the clean numeric
 * string via a hidden input under `name`, so server actions that do `Number(...)`
 * on the form field need no changes.
 */
export function CurrencyInput({
  id,
  name,
  defaultValue,
  placeholder,
}: {
  id?: string
  name: string
  defaultValue?: number | string | null
  placeholder?: string
}) {
  const initialRaw = defaultValue !== null && defaultValue !== undefined && defaultValue !== '' ? String(defaultValue) : ''
  const [raw, setRaw] = useState(initialRaw)
  const [focused, setFocused] = useState(false)

  return (
    <>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder={placeholder ?? '0.00'}
        value={focused ? raw : fmtCurrency(raw) || raw}
        onFocus={() => setFocused(true)}
        onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ''))}
        onBlur={() => setFocused(false)}
      />
      <input type="hidden" name={name} value={raw} />
    </>
  )
}
