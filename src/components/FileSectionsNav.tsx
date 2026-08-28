'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { label: string; segment?: string }
type NavGroup = { heading: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'General',
    items: [
      { label: 'Order Entry', segment: 'order-entry' },
      { label: 'Order Info', segment: 'order-info' },
      { label: 'Contacts', segment: 'contacts' },
      { label: 'Property' },
    ],
  },
  {
    heading: 'Title',
    items: [
      { label: 'Prelim Title Search' },
      { label: 'Commitment Sch A' },
      { label: 'Commitment Sch B-I/B-II' },
      { label: 'Curative' },
    ],
  },
  {
    heading: 'Document Preparation',
    items: [
      { label: 'Deed' },
      { label: 'Security Instrument' },
      { label: 'Affidavits' },
      { label: 'Power of Attorney' },
      { label: 'Notary Acknowledgement' },
    ],
  },
  {
    heading: 'Escrow / Closing',
    items: [
      { label: 'Settlement Type' },
      { label: 'Options' },
      { label: 'Additional Charges' },
      { label: 'Premiums' },
      { label: 'Endorsements' },
      { label: 'Recording' },
      { label: 'Payoff Calculations' },
      { label: 'Tax/Other Prorations' },
      { label: 'CDF Pages 1-5' },
      { label: 'HUD Pages 1-3' },
    ],
  },
]

export function FileSectionsNav({ orderId }: { orderId: string }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.heading}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.heading}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              if (!item.segment) {
                return (
                  <li key={item.label}>
                    <span
                      data-testid="nav-disabled"
                      className="block cursor-not-allowed rounded p-2 text-sm text-slate-300"
                    >
                      {item.label}
                    </span>
                  </li>
                )
              }

              const href = `/orders/${orderId}/${item.segment}`
              const active = pathname === href

              return (
                <li key={item.label}>
                  <Link
                    href={href}
                    data-testid="nav-link"
                    className={`block rounded p-2 text-sm ${
                      active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
