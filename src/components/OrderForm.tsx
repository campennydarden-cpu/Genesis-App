import { PRODUCT_TYPES, POLICY_TYPES } from '@/lib/constants'
import type { Order } from '@/lib/types'

export function OrderForm({
  action,
  order,
}: {
  action: (formData: FormData) => void
  order?: Order
}) {
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="file_number" className="block text-sm font-medium">
          File Number
        </label>
        <input
          id="file_number"
          name="file_number"
          defaultValue={order?.file_number}
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="product_type" className="block text-sm font-medium">
            Product Type
          </label>
          <select
            id="product_type"
            name="product_type"
            defaultValue={order?.product_type ?? 'Purchase'}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="policy_type" className="block text-sm font-medium">
            Policy Type
          </label>
          <select
            id="policy_type"
            name="policy_type"
            defaultValue={order?.policy_type ?? 'None'}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            {POLICY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="purchase_price" className="block text-sm font-medium">
            Purchase Price
          </label>
          <input
            id="purchase_price"
            name="purchase_price"
            type="number"
            step="0.01"
            defaultValue={order?.purchase_price ?? undefined}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="loan_amount" className="block text-sm font-medium">
            Loan Amount
          </label>
          <input
            id="loan_amount"
            name="loan_amount"
            type="number"
            step="0.01"
            defaultValue={order?.loan_amount ?? undefined}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="property_address" className="block text-sm font-medium">
          Property Address
        </label>
        <input
          id="property_address"
          name="property_address"
          defaultValue={order?.property_address ?? undefined}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div>
          <label htmlFor="property_city" className="block text-sm font-medium">
            City
          </label>
          <input
            id="property_city"
            name="property_city"
            defaultValue={order?.property_city ?? undefined}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="property_county" className="block text-sm font-medium">
            County
          </label>
          <input
            id="property_county"
            name="property_county"
            defaultValue={order?.property_county ?? undefined}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="property_state" className="block text-sm font-medium">
            State
          </label>
          <input
            id="property_state"
            name="property_state"
            defaultValue={order?.property_state ?? undefined}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="property_zip" className="block text-sm font-medium">
            Zip
          </label>
          <input
            id="property_zip"
            name="property_zip"
            defaultValue={order?.property_zip ?? undefined}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="parcel_number" className="block text-sm font-medium">
          Parcel Number
        </label>
        <input
          id="parcel_number"
          name="parcel_number"
          defaultValue={order?.parcel_number ?? undefined}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>

      <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
        {order ? 'Save Changes' : 'Create Order'}
      </button>
    </form>
  )
}
