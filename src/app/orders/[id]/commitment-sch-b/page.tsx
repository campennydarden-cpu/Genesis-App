import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { STANDARD_BI_ITEM_COUNTS } from '@/lib/constants'
import { RequirementsSection } from '@/components/commitment-sch-b/RequirementsSection'
import { ExceptionsSection } from '@/components/commitment-sch-b/ExceptionsSection'

export default async function CommitmentScheduleBPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id').eq('id', id).single()
  if (!order) {
    notFound()
  }

  const { data: schA } = await supabase.from('commitment_sch_a').select('form_type').eq('order_id', id).maybeSingle()
  const formType = schA?.form_type ?? 'Standard'
  const standardCount = STANDARD_BI_ITEM_COUNTS[formType] ?? STANDARD_BI_ITEM_COUNTS.Standard

  const { data: prelim } = await supabase.from('prelim_search').select('id').eq('order_id', id).maybeSingle()
  const prelimId = prelim?.id ?? null

  const { data: securityInstruments } = prelimId
    ? await supabase.from('security_instruments').select('*').eq('prelim_search_id', prelimId).order('created_at')
    : { data: [] }
  const siIds = (securityInstruments ?? []).map((si) => si.id)
  const { data: relatedDocs } = siIds.length
    ? await supabase.from('security_instrument_related_docs').select('*').in('security_instrument_id', siIds).order('created_at')
    : { data: [] }
  const { data: liens } = prelimId
    ? await supabase.from('liens').select('*').eq('prelim_search_id', prelimId).order('created_at')
    : { data: [] }
  const { data: exceptionMatters } = prelimId
    ? await supabase.from('exception_matters').select('*').eq('prelim_search_id', prelimId).order('created_at')
    : { data: [] }

  const { data: requirements } = await supabase.from('commitment_requirements').select('*').eq('order_id', id).order('created_at')
  const { data: exceptions } = await supabase.from('commitment_exceptions').select('*').eq('order_id', id).order('created_at')
  const { data: settings } = await supabase.from('commitment_sch_b_settings').select('*').eq('order_id', id).maybeSingle()

  // beginAt is inclusive (the first requirement renders as exactly this number), while
  // STANDARD_BI_ITEM_COUNTS counts the pre-printed boilerplate items the form already has -
  // so numbering starts at the item after them. A saved setting is already inclusive.
  const beginRequirementsAt = settings?.begin_requirements_at ?? standardCount + 1
  const beginExceptionsAt = settings?.begin_exceptions_at ?? 1

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <RequirementsSection
        orderId={id}
        requirements={requirements ?? []}
        securityInstruments={securityInstruments ?? []}
        relatedDocs={relatedDocs ?? []}
        liens={liens ?? []}
        beginAt={beginRequirementsAt}
      />
      <ExceptionsSection
        orderId={id}
        exceptions={exceptions ?? []}
        exceptionMatters={exceptionMatters ?? []}
        beginAt={beginExceptionsAt}
      />
    </div>
  )
}
