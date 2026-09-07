function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

/** Formats a `YYYY-MM-DD` date string as "September 7th, 2026". Returns '' for falsy input. */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  const month = d.toLocaleDateString('en-US', { month: 'long' })
  const day = d.getDate()
  return `${month} ${day}${ordinalSuffix(day)}, ${d.getFullYear()}`
}

/** Formats a number as "$#,###.00". Returns '' for null/empty input. */
export function fmtCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return ''
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
