import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listLoans } from '@/app/actions/loans'
import { LoanInfoPanel } from '@/components/title/LoanInfoPanel'

export default async function LoanInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id').eq('id', id).single()
  if (!order) notFound()

  const { data: contacts } = await supabase.from('contacts').select('id, name, role').eq('order_id', id)
  const lenderContacts = (contacts ?? []).filter((c) => c.role.toLowerCase().includes('lender'))

  const loans = await listLoans(id)

  return <LoanInfoPanel orderId={id} loans={loans} lenderContacts={lenderContacts} />
}
