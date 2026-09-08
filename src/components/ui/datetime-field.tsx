'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * One combined date+time picker. Submits `YYYY-MM-DD` and `HH:MM` via two hidden
 * inputs, so server actions that read separate date/time fields need no changes.
 */
export function DateTimeField({
  id,
  label,
  dateName,
  timeName,
  defaultDate,
  defaultTime,
  onBlur,
}: {
  id: string
  label: string
  dateName: string
  timeName: string
  defaultDate?: string | null
  defaultTime?: string | null
  onBlur?: () => void
}) {
  const [value, setValue] = useState(defaultDate ? `${defaultDate}T${defaultTime || '00:00'}` : '')
  const [date, time] = value ? value.split('T') : ['', '']

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} onBlur={onBlur} />
      <input type="hidden" name={dateName} value={date} />
      <input type="hidden" name={timeName} value={time} />
    </div>
  )
}
