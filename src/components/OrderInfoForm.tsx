import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { ORDER_STATUSES, TITLE_STATUSES, ESCROW_STATUSES, FUNCTIONAL_ROLES } from '@/lib/constants'
import type { Order } from '@/lib/types'

function formatOpenedDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function OrderInfoForm({
  action,
  order,
}: {
  action: (formData: FormData) => void
  order: Pick<
    Order,
    | 'order_status'
    | 'title_status'
    | 'escrow_status'
    | 'title_opened_date'
    | 'escrow_opened_date'
    | 'title_officer'
    | 'curative_title_officer'
    | 'escrow_assistant'
    | 'escrow_officer'
    | 'closing_coordinator'
    | 'funder'
    | 'recording_specialist'
    | 'post_closer'
  >
}) {
  const titleOpenedDate = formatOpenedDate(order.title_opened_date)
  const escrowOpenedDate = formatOpenedDate(order.escrow_opened_date)

  return (
    <form action={action} className="max-w-2xl space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="order_status">Order Status</Label>
          <StatusBadge status={order.order_status} />
        </div>
        <Select name="order_status" defaultValue={order.order_status}>
          <SelectTrigger id="order_status" className="mt-1 w-full">
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="title_status">Title Status</Label>
          <StatusBadge status={order.title_status} />
        </div>
        <Select name="title_status" defaultValue={order.title_status}>
          <SelectTrigger id="title_status" className="mt-1 w-full">
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {TITLE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {titleOpenedDate && (
          <p className="mt-1 text-xs text-muted-foreground">Title opened {titleOpenedDate}</p>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="escrow_status">Escrow Status</Label>
          <StatusBadge status={order.escrow_status} />
        </div>
        <Select name="escrow_status" defaultValue={order.escrow_status}>
          <SelectTrigger id="escrow_status" className="mt-1 w-full">
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {ESCROW_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {escrowOpenedDate && (
          <p className="mt-1 text-xs text-muted-foreground">Escrow opened {escrowOpenedDate}</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FUNCTIONAL_ROLES.map(({ key, label }) => (
          <div key={key}>
            <Label htmlFor={key}>{label}</Label>
            <Input id={key} name={key} className="mt-1" defaultValue={order[key] ?? undefined} />
          </div>
        ))}
      </div>

      <Button type="submit">Save Changes</Button>
    </form>
  )
}
