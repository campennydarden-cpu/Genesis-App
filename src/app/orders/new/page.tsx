import { createOrder } from '@/app/actions/orders'
import { OrderForm } from '@/components/OrderForm'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PendingSaveProvider } from '@/lib/pending-saves'

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <PendingSaveProvider>
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="mb-6 text-2xl font-semibold">New Order</h1>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <OrderForm action={createOrder} />
      </div>
    </PendingSaveProvider>
  )
}
