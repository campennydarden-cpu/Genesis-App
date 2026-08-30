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

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function HomeDashboard({
  orders,
  contacts,
}: {
  orders: OrderSummary[]
  contacts: ContactSummary[]
}) {
  void contacts // consumed starting Task 4

  return (
    <div className="space-y-6">
      <ul className="space-y-2" data-testid="order-list">
        {orders.map((o) => (
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
        {orders.length === 0 && (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        )}
      </ul>
    </div>
  )
}
