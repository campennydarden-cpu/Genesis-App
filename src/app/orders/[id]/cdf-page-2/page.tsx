import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listCdfPage2Lines, listAllContacts } from '@/app/actions/cdf-page2'
import { CdfPage2Panel } from '@/components/title/CdfPage2Panel'

export default async function CdfPage2Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [lines, contacts, { data: order }] = await Promise.all([
    listCdfPage2Lines(orderId),
    listAllContacts(orderId),
    supabase.from('orders').select('loan_amount, transaction_type').eq('id', orderId).single(),
  ])

  return (
    <CdfPage2Panel
      orderId={orderId}
      lines={lines}
      contacts={contacts}
      loanAmount={order?.loan_amount ?? null}
      transactionType={order?.transaction_type ?? null}
    />
  )
}
