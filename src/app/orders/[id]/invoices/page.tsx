import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listInvoices, listInvoiceLineItems, listAllContacts, createInvoice } from '@/app/actions/invoices'
import { listBillCodes } from '@/app/actions/bill-codes'
import { InvoicesPanel } from '@/components/title/InvoicesPanel'
import type { InvoiceLineItem } from '@/lib/types'

export default async function InvoicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [invoices, contacts, billCodes] = await Promise.all([
    listInvoices(orderId),
    listAllContacts(orderId),
    listBillCodes(),
  ])

  const lineItemsByInvoice: Record<string, InvoiceLineItem[]> = {}
  for (const inv of invoices) {
    lineItemsByInvoice[inv.id] = await listInvoiceLineItems(inv.id)
  }

  return (
    <InvoicesPanel
      orderId={orderId}
      invoices={invoices}
      lineItemsByInvoice={lineItemsByInvoice}
      contacts={contacts}
      billCodes={billCodes}
      onAdd={createInvoice.bind(null, orderId)}
    />
  )
}
