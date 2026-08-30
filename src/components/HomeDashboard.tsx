'use client'

export type OrderSummary = {
  id: string
  file_number: string
  product_type: string
  order_status: string
  title_status: string
  escrow_status: string
  property_address: string | null
  created_at: string
}

export type ContactSummary = {
  order_id: string
  role: string
  name: string
}

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

const PARTY_ROLE_PATTERN = /buyer|borrower|seller/i

function matchesSearch(
  order: OrderSummary,
  contactsByOrder: Map<string, ContactSummary[]>,
  query: string
): boolean {
  if (!query) return true
  const q = query.toLowerCase()

  if (order.file_number.toLowerCase().includes(q)) return true
  if (order.property_address?.toLowerCase().includes(q)) return true

  const contacts = contactsByOrder.get(order.id) ?? []
  return contacts.some(
    (c) => PARTY_ROLE_PATTERN.test(c.role) && c.name.toLowerCase().includes(q)
  )
}

export function HomeDashboard({
  orders,
  contacts,
}: {
  orders: OrderSummary[]
  contacts: ContactSummary[]
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const contactsByOrder = useMemo(() => {
    const map = new Map<string, ContactSummary[]>()
    for (const c of contacts) {
      const existing = map.get(c.order_id)
      if (existing) {
        existing.push(c)
      } else {
        map.set(c.order_id, [c])
      }
    }
    return map
  }, [contacts])

  const filteredOrders = useMemo(
    () => orders.filter((o) => matchesSearch(o, contactsByOrder, searchQuery)),
    [orders, contactsByOrder, searchQuery]
  )

  return (
    <div className="space-y-6">
      <Input
        placeholder="Search by file number, property address, or buyer/seller name"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        data-testid="dashboard-search"
      />

      <ul className="space-y-2" data-testid="order-list">
        {filteredOrders.map((o) => (
          <li key={o.id} data-testid="order-row">
            <Link href={`/orders/${o.id}/order-entry`}>
              <Card className="p-4 transition-colors hover:bg-muted">
                <p className="font-medium">{o.file_number}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{o.product_type}</span>
                  <Badge variant="outline">{o.order_status}</Badge>
                  <Badge variant="outline">{o.title_status}</Badge>
                  <Badge variant="outline">{o.escrow_status}</Badge>
                </div>
              </Card>
            </Link>
          </li>
        ))}
        {filteredOrders.length === 0 && (
          <p className="text-sm text-muted-foreground">No orders match.</p>
        )}
      </ul>
    </div>
  )
}
