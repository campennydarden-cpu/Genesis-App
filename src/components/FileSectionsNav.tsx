'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { usePendingSave } from '@/lib/pending-saves'

type NavItem = { label: string; segment?: string }
type NavGroup = { heading: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'General',
    items: [
      { label: 'Order Entry', segment: 'order-entry' },
      { label: 'Order Info', segment: 'order-info' },
      { label: 'Contacts', segment: 'contacts' },
      { label: 'Property', segment: 'property' },
    ],
  },
  {
    heading: 'Title',
    items: [
      { label: 'Prelim Title Search', segment: 'prelim-search' },
      { label: 'Commitment Sch A', segment: 'commitment-sch-a' },
      { label: 'Commitment Sch B-I/B-II', segment: 'commitment-sch-b' },
      { label: 'Curative', segment: 'curative' },
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

function slugify(heading: string) {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export function FileSectionsNav({ orderId }: { orderId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { hasPending, waitForPendingSaves } = usePendingSave()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((group) => [group.heading, true]))
  )

  function guardedNavigate(e: React.MouseEvent, href: string) {
    if (!hasPending()) return
    e.preventDefault()
    waitForPendingSaves().then(() => router.push(href))
  }

  return (
    <div className="space-y-6">
      {NAV_GROUPS.map((group) => {
        const open = openGroups[group.heading]
        const listId = `nav-group-${slugify(group.heading)}`

        return (
        <div key={group.heading}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() =>
              setOpenGroups((prev) => ({ ...prev, [group.heading]: !prev[group.heading] }))
            }
            className="mb-2 flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <ChevronDown
              className={`size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                open ? 'rotate-0' : '-rotate-90'
              }`}
              aria-hidden="true"
            />
            {group.heading}
          </button>
          <ul
            id={listId}
            hidden={!open}
            className="space-y-1"
          >
            {group.items.map((item) => {
              if (!item.segment) {
                return (
                  <li key={item.label}>
                    <span
                      data-testid="nav-disabled"
                      className="block cursor-not-allowed rounded p-2.5 text-sm text-muted-foreground"
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
                    aria-current={active ? 'page' : undefined}
                    onClick={(e) => guardedNavigate(e, href)}
                    className={`block rounded p-2.5 text-sm transition-colors duration-200 ${
                      active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
        )
      })}
    </div>
  )
}
