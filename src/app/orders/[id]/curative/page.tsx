import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { STANDARD_BI_ITEM_COUNTS } from '@/lib/constants'
import { CurativeRequirementsSection } from '@/components/curative/CurativeRequirementsSection'
import { CurativeExceptionsSection } from '@/components/curative/CurativeExceptionsSection'
import { FinalizeControl } from '@/components/curative/FinalizeControl'
import { CTCControl } from '@/components/curative/CTCControl'
import type { CurativeSettings } from '@/lib/types'

export default async function CurativePage({
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

  const { data: schBSettings } = await supabase.from('commitment_sch_b_settings').select('*').eq('order_id', id).maybeSingle()
  const beginRequirementsAt = schBSettings?.begin_requirements_at ?? standardCount + 1
  const beginExceptionsAt = schBSettings?.begin_exceptions_at ?? 1

  const { data: requirements } = await supabase.from('commitment_requirements').select('*').eq('order_id', id).order('created_at')
  const { data: exceptions } = await supabase.from('commitment_exceptions').select('*').eq('order_id', id).order('created_at')

  const { data: curativeSettings, error: curativeSettingsError } = await supabase
    .from('curative_settings')
    .select('*')
    .eq('order_id', id)
    .maybeSingle()
  const commitmentStatus: CurativeSettings['commitment_status'] = curativeSettingsError
    ? 'final'
    : (curativeSettings?.commitment_status ?? 'draft')
  const ctcIssued = curativeSettingsError ? true : !!curativeSettings?.ctc_issued_at

  const allDispositioned = [...(requirements ?? []), ...(exceptions ?? [])].every((r) => r.disposition || r.dont_show)

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mb-4 flex items-center gap-4">
        <FinalizeControl orderId={id} commitmentStatus={commitmentStatus} ctcIssued={ctcIssued} />
        <CTCControl orderId={id} ctcIssued={ctcIssued} allDispositioned={allDispositioned} />
      </div>

      <CurativeRequirementsSection
        orderId={id}
        requirements={requirements ?? []}
        beginAt={beginRequirementsAt}
        commitmentStatus={commitmentStatus}
      />
      <CurativeExceptionsSection
        orderId={id}
        exceptions={exceptions ?? []}
        beginAt={beginExceptionsAt}
        commitmentStatus={commitmentStatus}
      />
    </div>
  )
}
