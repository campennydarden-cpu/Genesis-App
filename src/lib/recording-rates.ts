// Recording rate matching against the curated tables from migrations 0049/0050/0052
// (readiness doc "Recording Rate-Table Wiring", Cam answered 2026-09-10). Base-rate
// lookup only -- refinance exemptions (Fee Schedules & Loan-Amount Tax Exemptions -
// Design.md) are a deliberate fast-follow, not built here (Cam's call, Q3).
//
// Pure function over already-fetched rows so it stays testable without a DB round trip
// -- the caller (autofillRecordingRates in app/actions/recording.ts) does the fetching.

export type RecordingFeeScheduleRow = {
  state: string
  county: string | null
  document_type: string
  base_fee: number | null
  base_page_count: number | null
  additional_page_fee: number | null
  applies_to: string[] | null
  verified: boolean
}

export type TransferTaxScheduleRow = {
  state: string
  county: string | null
  label: string
  flat_amount: number | null
  rate_per_unit: number
  unit_amount: number
}

export type RecordationTaxScheduleRow = {
  state: string
  county: string | null
  label: string
  rate_per_unit: number
  unit_amount: number
  exemption_amount: number | null
  cap_amount: number | null
}

export type RecordingRateMatch = {
  fee: number | null
  feeStatus: 'matched' | 'no_rate' | 'not_applicable'
  transferTax: number | null
  transferTaxStatus: 'matched' | 'no_rate' | 'not_applicable'
  recordationTax: number | null
  recordationTaxStatus: 'matched' | 'no_rate' | 'not_applicable'
}

function matchFee(
  rows: RecordingFeeScheduleRow[],
  documentDescription: string,
  numberOfPages: number | null
): { fee: number | null; status: 'matched' | 'no_rate' } {
  const stateRows = rows.filter((r) => r.applies_to !== null && r.applies_to.includes(documentDescription))
  const tieredRows = rows.filter((r) => r.applies_to === null)

  let row: RecordingFeeScheduleRow | undefined
  if (stateRows.length > 0) {
    row = stateRows[0]
  } else if (tieredRows.length > 0) {
    const pages = numberOfPages ?? 0
    const sorted = [...tieredRows].sort((a, b) => (a.base_page_count ?? Infinity) - (b.base_page_count ?? Infinity))
    row = sorted.find((r) => r.base_page_count === null || pages <= r.base_page_count) ?? sorted[sorted.length - 1]
  }

  if (!row || row.base_fee === null || !row.verified) return { fee: null, status: 'no_rate' }
  return { fee: row.base_fee, status: 'matched' }
}

// Same "exact county match wins, else the statewide (county IS NULL) row, distinct labels
// stack" rule for both transfer and recordation tax -- e.g. NC's statewide Excise Tax plus
// a county's Local Land Transfer Tax both apply; FL's Miami-Dade row replaces (not adds to)
// the statewide Documentary Stamp Tax on Deeds because they share a label.
function sumTaxRows<T extends { county: string | null; label: string; rate_per_unit: number; unit_amount: number }>(
  rows: T[],
  county: string | null,
  base: number,
  extra: (row: T, taxable: number) => number
): { total: number; matchedAny: boolean } {
  const byLabel = new Map<string, T>()
  for (const row of rows) {
    if (row.county !== null && row.county !== county) continue
    const existing = byLabel.get(row.label)
    if (!existing || row.county !== null) byLabel.set(row.label, row)
  }
  let total = 0
  for (const row of byLabel.values()) {
    total += extra(row, base)
  }
  return { total, matchedAny: byLabel.size > 0 }
}

export function matchRecordingRate(params: {
  state: string | null
  county: string | null
  documentDescription: string | null
  numberOfPages: number | null
  purchasePrice: number | null
  loanAmount: number | null
  feeRows: RecordingFeeScheduleRow[]
  transferTaxRows: TransferTaxScheduleRow[]
  recordationTaxRows: RecordationTaxScheduleRow[]
}): RecordingRateMatch {
  const { state, county, documentDescription, numberOfPages, purchasePrice, loanAmount, feeRows, transferTaxRows, recordationTaxRows } =
    params

  if (!state || !documentDescription) {
    return {
      fee: null,
      feeStatus: 'no_rate',
      transferTax: null,
      transferTaxStatus: 'not_applicable',
      recordationTax: null,
      recordationTaxStatus: 'not_applicable',
    }
  }

  const stateFeeRows = feeRows.filter((r) => r.state === state)
  const { fee, status: feeStatus } = matchFee(stateFeeRows, documentDescription, numberOfPages)

  // Transfer tax (conveyance tax) only applies to Deeds; recordation tax (mortgage/note
  // tax) only applies to Mortgages -- neither applies to Release/POA/Affidavit/Other.
  let transferTax: number | null = null
  let transferTaxStatus: RecordingRateMatch['transferTaxStatus'] = 'not_applicable'
  if (documentDescription === 'Deed') {
    const rows = transferTaxRows.filter((r) => r.state === state)
    const { total, matchedAny } = sumTaxRows(rows, county, purchasePrice ?? 0, (row, base) => {
      const rate = (base / row.unit_amount) * row.rate_per_unit
      // GA's Real Estate Transfer Tax: flat_amount is a minimum floor for tiny considerations
      // ("$1.00 flat covers the first $1,000... $0.10 per additional $100 above that" is
      // algebraically just a flat 0.10/100 rate once base clears $1,000), not an add-on.
      return row.flat_amount ? Math.max(row.flat_amount, rate) : rate
    })
    transferTax = matchedAny ? total : null
    transferTaxStatus = matchedAny ? 'matched' : 'no_rate'
  }

  let recordationTax: number | null = null
  let recordationTaxStatus: RecordingRateMatch['recordationTaxStatus'] = 'not_applicable'
  if (documentDescription === 'Mortgage') {
    const rows = recordationTaxRows.filter((r) => r.state === state)
    const { total, matchedAny } = sumTaxRows(rows, county, loanAmount ?? 0, (row, base) => {
      const taxable = Math.max(0, base - (row.exemption_amount ?? 0))
      const tax = (taxable / row.unit_amount) * row.rate_per_unit
      return row.cap_amount ? Math.min(tax, row.cap_amount) : tax
    })
    recordationTax = matchedAny ? total : null
    recordationTaxStatus = matchedAny ? 'matched' : 'no_rate'
  }

  return { fee, feeStatus, transferTax, transferTaxStatus, recordationTax, recordationTaxStatus }
}
