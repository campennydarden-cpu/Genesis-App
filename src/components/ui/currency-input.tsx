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
  onBlur,
  allowNegative = false,
  className,
  'aria-label': ariaLabel,
}: {
  id?: string
  name: string
  defaultValue?: number | string | null
  placeholder?: string
  onBlur?: () => void
  /** Credits/adjustments (Aggregate Adjustment, Lender Credits, etc.) need a leading "-". Off by default. */
  allowNegative?: boolean
  className?: string
  'aria-label'?: string
}) {
  const initialRaw = defaultValue !== null && defaultValue !== undefined && defaultValue !== '' ? String(defaultValue) : ''
  const [raw, setRaw] = useState(initialRaw)
  const [focused, setFocused] = useState(false)

  const sanitize = (v: string) => {
    const cleaned = v.replace(allowNegative ? /[^0-9.-]/g : /[^0-9.]/g, '')
    if (!allowNegative) return cleaned
    // Only a single leading "-" counts as negative; strip any other stray "-" characters.
    const negative = cleaned.startsWith('-')
    const digits = cleaned.replace(/-/g, '')
    return negative ? `-${digits}` : digits
  }

  return (
    <>
      <Input
        id={id}
        aria-label={ariaLabel}
        type="text"
        inputMode="decimal"
        placeholder={placeholder ?? '0.00'}
        value={focused ? raw : fmtCurrency(raw) || raw}
        onFocus={() => setFocused(true)}
        onChange={(e) => setRaw(sanitize(e.target.value))}
        onBlur={() => {
          setFocused(false)
          onBlur?.()
        }}
        className={className}
      />
      <input type="hidden" name={name} value={raw} />
    </>
  )
}
