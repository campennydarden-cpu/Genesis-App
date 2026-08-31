import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { upsertCommitmentScheduleA } from '@/app/actions/commitment-sch-a'
import { CommitmentScheduleAForm } from '@/components/commitment-sch-a/CommitmentScheduleAForm'

export default async function CommitmentScheduleAPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id, policy_type').eq('id', id).single()
  if (!order) {
    notFound()
  }

  const { data: commitmentSchA } = await supabase
    .from('commitment_sch_a')
    .select('*')
    .eq('order_id', id)
    .maybeSingle()

  const { data: prelimSearch } = await supabase
    .from('prelim_search')
    .select('effective_date, effective_time')
    .eq('order_id', id)
    .maybeSingle()

  const { data: contacts } = await supabase.from('contacts').select('id, name, role, mortgagee_clause').eq('order_id', id)

  const buyerBorrowerContacts = (contacts ?? []).filter(
    (c) => c.role.toLowerCase().includes('buyer') || c.role.toLowerCase().includes('borrower')
  )
  const lenderContacts = (contacts ?? []).filter((c) => c.role.toLowerCase().includes('lender'))

  const effectiveDateDisplay = prelimSearch?.effective_date
    ? `${prelimSearch.effective_date}${prelimSearch.effective_time ? ' ' + prelimSearch.effective_time : ''}`
    : '— set on Prelim Search'

  const upsertCommitmentScheduleAWithId = upsertCommitmentScheduleA.bind(null, id)

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <CommitmentScheduleAForm
        action={upsertCommitmentScheduleAWithId}
        commitmentSchA={commitmentSchA ?? null}
        policyType={order.policy_type}
        effectiveDateDisplay={effectiveDateDisplay}
        buyerBorrowerContacts={buyerBorrowerContacts}
        lenderContacts={lenderContacts}
      />
    </div>
  )
}
