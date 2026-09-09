// Day-count proration for Tax/Other Prorations. Convention: the day of closing
// (prorationDate) belongs to the Buyer — the common title/escrow default. This is a
// documented default, not a hard rule: every computed field this feeds into stays a
// normal editable input, so a firm using a different convention just edits the number.

export type ProrationInput = {
  shareOfAmount: number
  periodFrom: string // 'YYYY-MM-DD'
  periodTo: string
  prorationDate: string
  computeFor: 'Buyer' | 'Seller'
  use30DayMonths: boolean
}

export type ProrationResult = {
  daysInPeriod: number
  daysProrated: number
  perDiem: number
  proratedAmount: number
}

function parseDate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

function actualDaysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime()
  const db = new Date(`${b}T00:00:00Z`).getTime()
  return Math.round((db - da) / 86400000)
}

// US (NASD) 30/360 day-count convention.
function days360Between(a: string, b: string): number {
  const pa = parseDate(a)
  const pb = parseDate(b)
  let d1 = pa.d
  let d2 = pb.d
  if (d1 === 31) d1 = 30
  if (d2 === 31 && d1 === 30) d2 = 30
  return (pb.y - pa.y) * 360 + (pb.m - pa.m) * 30 + (d2 - d1)
}

export function calculateProration(input: ProrationInput): ProrationResult {
  const { shareOfAmount, periodFrom, periodTo, prorationDate, computeFor, use30DayMonths } = input

  const daysInPeriod = use30DayMonths
    ? days360Between(periodFrom, periodTo)
    : actualDaysBetween(periodFrom, periodTo) + 1

  let daysProrated: number
  if (computeFor === 'Buyer') {
    daysProrated = use30DayMonths
      ? days360Between(prorationDate, periodTo) + 1
      : actualDaysBetween(prorationDate, periodTo) + 1
  } else {
    daysProrated = use30DayMonths ? days360Between(periodFrom, prorationDate) : actualDaysBetween(periodFrom, prorationDate)
  }

  const perDiem = daysInPeriod > 0 ? shareOfAmount / daysInPeriod : 0
  const proratedAmount = Math.round(perDiem * daysProrated * 100) / 100

  return {
    daysInPeriod,
    daysProrated,
    perDiem: Math.round(perDiem * 10000) / 10000,
    proratedAmount,
  }
}

function demo() {
  // Full calendar year, actual days: Jan 1 - Dec 31 = 365 days, closing July 1.
  const buyer = calculateProration({
    shareOfAmount: 3650,
    periodFrom: '2026-01-01',
    periodTo: '2026-12-31',
    prorationDate: '2026-07-01',
    computeFor: 'Buyer',
    use30DayMonths: false,
  })
  console.assert(buyer.daysInPeriod === 365, `expected 365 days in period, got ${buyer.daysInPeriod}`)
  console.assert(buyer.daysProrated === 184, `expected buyer 184 days (Jul1-Dec31 incl.), got ${buyer.daysProrated}`)
  console.assert(Math.abs(buyer.perDiem - 10) < 0.01, `expected perDiem ~10, got ${buyer.perDiem}`)

  const seller = calculateProration({
    shareOfAmount: 3650,
    periodFrom: '2026-01-01',
    periodTo: '2026-12-31',
    prorationDate: '2026-07-01',
    computeFor: 'Seller',
    use30DayMonths: false,
  })
  console.assert(seller.daysProrated === 181, `expected seller 181 days (Jan1-Jun30), got ${seller.daysProrated}`)
  console.assert(buyer.daysProrated + seller.daysProrated === buyer.daysInPeriod, 'buyer+seller days should equal period days')

  // 30-day-months convention over the same full year.
  const buyer30 = calculateProration({
    shareOfAmount: 3600,
    periodFrom: '2026-01-01',
    periodTo: '2026-12-31',
    prorationDate: '2026-07-01',
    computeFor: 'Buyer',
    use30DayMonths: true,
  })
  console.assert(buyer30.daysInPeriod === 360, `expected 360 days (30-day convention), got ${buyer30.daysInPeriod}`)
  console.assert(Math.abs(buyer30.perDiem - 10) < 0.01, `expected 30-day perDiem ~10, got ${buyer30.perDiem}`)
}

if (process.env.NODE_ENV === 'test') demo()
