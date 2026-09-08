import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import { FileSectionsNav } from '@/components/FileSectionsNav'
import { OrderToolbar } from '@/components/OrderToolbar'
import { PendingSaveProvider } from '@/lib/pending-saves'
import { OrderLayoutLinks } from '@/components/OrderLayoutLinks'

export default async function OrderLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id, file_number').eq('id', id).single()

  if (!order) {
    notFound()
  }

  return (
    <PendingSaveProvider>
      <div className="flex min-h-screen">
        <nav
          className="w-56 shrink-0 border-r p-4"
          data-testid="file-section-nav"
          aria-label="File sections"
        >
          <FileSectionsNav orderId={id} />
        </nav>

        <main className="flex-1 p-8">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Order {order.file_number}</h1>
            <div className="flex items-center gap-4">
              <OrderLayoutLinks />
              <form action={logout}>
                <button
                  type="submit"
                  className="cursor-pointer text-xs text-muted-foreground transition-colors duration-200 hover:underline"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
          <OrderToolbar orderId={id}>{children}</OrderToolbar>
        </main>
      </div>
    </PendingSaveProvider>
  )
}
