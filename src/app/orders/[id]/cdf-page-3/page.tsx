import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getCdfCashToClose,
  listPayoffsPayments,
  listAllContacts,
  listTransactionSummaryLines,
} from '@/app/actions/cdf-page3'
import { CdfPage3Panel } from '@/components/title/CdfPage3Panel'

export default async function CdfPage3Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [cashToClose, payoffs, contacts, summaryLines, { data: order }] = await Promise.all([
    getCdfCashToClose(orderId),
    listPayoffsPayments(orderId),
    listAllContacts(orderId),
    listTransactionSummaryLines(orderId),
    supabase.from('orders').select('transaction_type').eq('id', orderId).single(),
  ])

  return (
    <CdfPage3Panel
      orderId={orderId}
      cashToClose={cashToClose}
      payoffs={payoffs}
      contacts={contacts}
      summaryLines={summaryLines}
      transactionType={order?.transaction_type ?? null}
    />
  )
}
