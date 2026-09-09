// CDF Page 2 subtotal/total math. Pure sums over the user's own entered rows — no
// rate-table or external data involved — so unlike Calculate/Generate buttons
// elsewhere, these are never stored and never hand-edited: they're recomputed fresh
// from live rows on every page load.

import type { CdfPage2Line, CdfPage2Totals } from './types'
import { CDF_PAGE2_SECTIONS } from './constants'

const ZERO: CdfPage2Totals = { borrowerAtClosing: 0, borrowerBeforeClosing: 0, sellerAtClosing: 0, sellerBeforeClosing: 0 }

function sumSection(lines: CdfPage2Line[], section: string): CdfPage2Totals {
  return lines
    .filter((l) => l.section === section)
    .reduce(
      (acc, l) => ({
        borrowerAtClosing: acc.borrowerAtClosing + (l.borrower_paid_at_closing ?? 0),
        borrowerBeforeClosing: acc.borrowerBeforeClosing + (l.borrower_paid_before_closing ?? 0),
        sellerAtClosing: acc.sellerAtClosing + (l.seller_paid_at_closing ?? 0),
        sellerBeforeClosing: acc.sellerBeforeClosing + (l.seller_paid_before_closing ?? 0),
      }),
      { ...ZERO }
    )
}

function addTotals(a: CdfPage2Totals, b: CdfPage2Totals): CdfPage2Totals {
  return {
    borrowerAtClosing: a.borrowerAtClosing + b.borrowerAtClosing,
    borrowerBeforeClosing: a.borrowerBeforeClosing + b.borrowerBeforeClosing,
    sellerAtClosing: a.sellerAtClosing + b.sellerAtClosing,
    sellerBeforeClosing: a.sellerBeforeClosing + b.sellerBeforeClosing,
  }
}

export function computeCdfPage2Totals(lines: CdfPage2Line[]) {
  const bySection = Object.fromEntries(CDF_PAGE2_SECTIONS.map(({ code }) => [code, sumSection(lines, code)])) as Record<
    string,
    CdfPage2Totals
  >

  // D = A + B + C, Loan Costs — borrower-paid only on the real CD form. The line-item
  // grid still captures seller/paid-by-others on A/B/C rows for flexibility (matching
  // SoftPro), but those columns must NOT flow into D (or, via D, into J) — D's own
  // definition has no seller side, so folding them in here would silently inflate J
  // with money never shown on any subtotal line.
  const abc = addTotals(addTotals(bySection.A, bySection.B), bySection.C)
  const d: CdfPage2Totals = { ...ZERO, borrowerAtClosing: abc.borrowerAtClosing, borrowerBeforeClosing: abc.borrowerBeforeClosing }

  // I = E + F + G + H, Other Costs — carries all four columns.
  const i: CdfPage2Totals = [bySection.E, bySection.F, bySection.G, bySection.H].reduce(addTotals, { ...ZERO })

  // Section J itself has one real enterable line — Lender Credits — not summed from
  // CDF_PAGE2_SECTIONS since J is a totals section, not an itemized one like A-H.
  // "J" isn't a valid `section` for the A-H line-item grid, so sumSection is safe to
  // call directly here without adding J to that constant.
  const closingCostsSubtotal = addTotals(d, i)
  const lenderCredits = sumSection(lines, 'J')
  const j: CdfPage2Totals = addTotals(closingCostsSubtotal, lenderCredits)

  return { bySection, d, i, closingCostsSubtotal, j }
}

function demo() {
  const lines: CdfPage2Line[] = [
    {
      id: '1',
      order_id: 'o',
      section: 'A',
      sort_order: 1,
      description: 'Origination Fee',
      to_contact_id: null,
      borrower_paid_at_closing: 500,
      borrower_paid_before_closing: null,
      // A seller-paid amount on a Loan Cost row (unusual but the grid allows it, matching
      // SoftPro) — must not leak into D or J, which have no seller column on the real form.
      seller_paid_at_closing: 500,
      seller_paid_before_closing: null,
      paid_by_others: null,
      is_fixed: false,
      points_percent: null,
      points_round_whole_dollar: false,
      points_adjustment: null,
      points_adjustment_for: null,
    },
    {
      id: '2',
      order_id: 'o',
      section: 'B',
      sort_order: 1,
      description: 'Credit Report Fee',
      to_contact_id: null,
      borrower_paid_at_closing: 100,
      borrower_paid_before_closing: null,
      seller_paid_at_closing: null,
      seller_paid_before_closing: null,
      paid_by_others: null,
      is_fixed: false,
      points_percent: null,
      points_round_whole_dollar: false,
      points_adjustment: null,
      points_adjustment_for: null,
    },
    {
      id: '3',
      order_id: 'o',
      section: 'E',
      sort_order: 1,
      description: 'Recording Fees',
      to_contact_id: null,
      borrower_paid_at_closing: 271,
      borrower_paid_before_closing: null,
      seller_paid_at_closing: 50,
      seller_paid_before_closing: null,
      paid_by_others: null,
      is_fixed: false,
      points_percent: null,
      points_round_whole_dollar: false,
      points_adjustment: null,
      points_adjustment_for: null,
    },
    {
      id: '4',
      order_id: 'o',
      section: 'F',
      sort_order: 1,
      description: 'Homeowner Insurance Premium',
      to_contact_id: null,
      borrower_paid_at_closing: 1200,
      borrower_paid_before_closing: null,
      seller_paid_at_closing: null,
      seller_paid_before_closing: null,
      paid_by_others: null,
      is_fixed: false,
      points_percent: null,
      points_round_whole_dollar: false,
      points_adjustment: null,
      points_adjustment_for: null,
    },
    {
      id: '5',
      order_id: 'o',
      section: 'J',
      sort_order: 0,
      description: 'Lender Credits',
      to_contact_id: null,
      // A credit reduces the borrower's total, so it's entered as a negative amount.
      borrower_paid_at_closing: -150,
      borrower_paid_before_closing: null,
      seller_paid_at_closing: null,
      seller_paid_before_closing: null,
      paid_by_others: null,
      is_fixed: true,
      points_percent: null,
      points_round_whole_dollar: false,
      points_adjustment: null,
      points_adjustment_for: null,
    },
  ]

  const { d, i, closingCostsSubtotal, j } = computeCdfPage2Totals(lines)
  console.assert(d.borrowerAtClosing === 600, `expected D borrower-at-closing 600 (500+100), got ${d.borrowerAtClosing}`)
  console.assert(i.borrowerAtClosing === 1471, `expected I borrower-at-closing 1471 (271+1200), got ${i.borrowerAtClosing}`)
  console.assert(i.sellerAtClosing === 50, `expected I seller-at-closing 50, got ${i.sellerAtClosing}`)
  console.assert(
    closingCostsSubtotal.borrowerAtClosing === 2071,
    `expected Closing Costs Subtotal (D+I) borrower-at-closing 2071 (600+1471), got ${closingCostsSubtotal.borrowerAtClosing}`
  )
  console.assert(
    j.borrowerAtClosing === 1921,
    `expected J borrower-at-closing 1921 (2071 subtotal - 150 lender credit), got ${j.borrowerAtClosing}`
  )
  console.assert(
    d.sellerAtClosing === 0,
    `expected D seller-at-closing 0 (Loan Costs has no seller column, even though section A's own row has 500), got ${d.sellerAtClosing}`
  )
  console.assert(
    j.sellerAtClosing === 50,
    `expected J seller-at-closing 50 (from section E only — section A's 500 must not leak through D), got ${j.sellerAtClosing}`
  )
}

if (process.env.NODE_ENV === 'test') demo()
