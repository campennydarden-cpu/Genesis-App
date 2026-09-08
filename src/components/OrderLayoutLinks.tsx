'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePendingSave } from '@/lib/pending-saves'

export function OrderLayoutLinks() {
  const router = useRouter()
  const { hasPending, waitForPendingSaves } = usePendingSave()

  function guardedNavigate(e: React.MouseEvent, href: string) {
    if (!hasPending()) return
    e.preventDefault()
    waitForPendingSaves().then(() => router.push(href))
  }

  return (
    <>
      <Link
        href="/orders"
        onClick={(e) => guardedNavigate(e, '/orders')}
        className="text-sm text-primary transition-colors duration-200 hover:underline"
      >
        ← Home
      </Link>
      <Link
        href="/orders/new"
        onClick={(e) => guardedNavigate(e, '/orders/new')}
        className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
      >
        + New Order
      </Link>
    </>
  )
}
