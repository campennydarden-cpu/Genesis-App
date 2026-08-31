import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { upsertCommitmentScheduleA } from '@/app/actions/commitment-sch-a'
import { CommitmentScheduleAForm } from '@/components/commitment-sch-a/CommitmentScheduleAForm'
import { ChainOfTitleSection } from '@/components/commitment-sch-a/ChainOfTitleSection'

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
    .select('effective_date, effective_time, derivation_instrument_type, derivation_grantor_name, derivation_grantee_name')
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

  const { data: chainOfTitle } = commitmentSchA
    ? await supabase
        .from('chain_of_title')
        .select('*')
        .eq('commitment_sch_a_id', commitmentSchA.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  const derivationSeed =
    prelimSearch && (prelimSearch.derivation_grantee_name || prelimSearch.derivation_grantor_name)
      ? {
          instrumentType: prelimSearch.derivation_instrument_type ?? '',
          grantor: prelimSearch.derivation_grantor_name ?? '',
          grantee: prelimSearch.derivation_grantee_name ?? '',
        }
      : null

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
      {commitmentSchA && (
        <div className="mt-10">
          <ChainOfTitleSection
            orderId={id}
            commitmentSchAId={commitmentSchA.id}
            entries={chainOfTitle ?? []}
            derivationSeed={derivationSeed}
          />
        </div>
      )}
    </div>
  )
}
