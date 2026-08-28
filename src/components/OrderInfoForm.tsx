import { ORDER_STATUSES, TITLE_STATUSES, ESCROW_STATUSES } from '@/lib/constants'
import type { Order } from '@/lib/types'

export function OrderInfoForm({
  action,
  order,
}: {
  action: (formData: FormData) => void
  order: Pick<Order, 'order_status' | 'title_status' | 'escrow_status'>
}) {
  return (
    <form action={action} className="max-w-md space-y-4">
      <div>
        <label htmlFor="order_status" className="block text-sm font-medium">
          Order Status
        </label>
        <select
          id="order_status"
          name="order_status"
          defaultValue={order.order_status}
          className="mt-1 w-full rounded border px-3 py-2"
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="title_status" className="block text-sm font-medium">
          Title Status
        </label>
        <select
          id="title_status"
          name="title_status"
          defaultValue={order.title_status}
          className="mt-1 w-full rounded border px-3 py-2"
        >
          {TITLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="escrow_status" className="block text-sm font-medium">
          Escrow Status
        </label>
        <select
          id="escrow_status"
          name="escrow_status"
          defaultValue={order.escrow_status}
          className="mt-1 w-full rounded border px-3 py-2"
        >
          {ESCROW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
        Save Changes
      </button>
    </form>
  )
}
