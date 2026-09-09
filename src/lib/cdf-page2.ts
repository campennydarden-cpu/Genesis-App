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

  // D = A + B + C, Loan Costs — borrower-paid only on the real CD form even though the
  // line-item grid also captures seller/paid-by-others columns for flexibility.
  const d: CdfPage2Totals = addTotals(addTotals(bySection.A, bySection.B), bySection.C)

  // I = E + F + G + H, Other Costs — carries all four columns.
  const i: CdfPage2Totals = [bySection.E, bySection.F, bySection.G, bySection.H].reduce(addTotals, { ...ZERO })

  // J = D + I, grand total.
  const j: CdfPage2Totals = addTotals(d, i)

  return { bySection, d, i, j }
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
      seller_paid_at_closing: null,
      seller_paid_before_closing: null,
      paid_by_others: null,
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
    },
  ]

  const { d, i, j } = computeCdfPage2Totals(lines)
  console.assert(d.borrowerAtClosing === 600, `expected D borrower-at-closing 600 (500+100), got ${d.borrowerAtClosing}`)
  console.assert(i.borrowerAtClosing === 1471, `expected I borrower-at-closing 1471 (271+1200), got ${i.borrowerAtClosing}`)
  console.assert(i.sellerAtClosing === 50, `expected I seller-at-closing 50, got ${i.sellerAtClosing}`)
  console.assert(j.borrowerAtClosing === 2071, `expected J borrower-at-closing 2071 (600+1471), got ${j.borrowerAtClosing}`)
  console.assert(j.sellerAtClosing === 50, `expected J seller-at-closing 50 (0+50), got ${j.sellerAtClosing}`)
}

if (process.env.NODE_ENV === 'test') demo()
