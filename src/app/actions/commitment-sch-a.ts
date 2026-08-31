'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function upsertCommitmentScheduleA(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const field = (name: string) => (formData.get(name) as string) || null
  const numField = (name: string) => {
    const v = formData.get(name) as string
    return v ? Number(v) : null
  }

  const { error } = await supabase.from('commitment_sch_a').upsert(
    {
      order_id: orderId,
      form_type: field('form_type') ?? 'Standard',
      company_state_of_org: field('company_state_of_org'),
      requirements_time_period: field('requirements_time_period'),
      env_protection_lien_statutes: field('env_protection_lien_statutes'),
      issuing_agent: field('issuing_agent'),
      issuing_office: field('issuing_office'),
      alta_universal_id: field('alta_universal_id'),
      loan_id_number: field('loan_id_number'),
      commitment_number: field('commitment_number'),
      revision_number: field('revision_number'),
      date_issued: field('date_issued'),
      time_issued: field('time_issued'),
      title_held_as: field('title_held_as'),
      owner_policy_type: field('owner_policy_type'),
      owner_coverage_amount: numField('owner_coverage_amount'),
      owner_coverage_tbd: formData.get('owner_coverage_tbd') === 'on',
      owner_proposed_insured: field('owner_proposed_insured'),
      loan_policy_type: field('loan_policy_type'),
      loan_coverage_amount: numField('loan_coverage_amount'),
      loan_coverage_tbd: formData.get('loan_coverage_tbd') === 'on',
      loan_proposed_insured: field('loan_proposed_insured'),
      loan_mortgagee_clause: field('loan_mortgagee_clause'),
      counter_signature: field('counter_signature'),
      counter_signature_date: field('counter_signature_date'),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  )

  if (error) {
    console.error('upsertCommitmentScheduleA failed:', error)
    redirect(
      `/orders/${orderId}/commitment-sch-a?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/commitment-sch-a`)
  redirect(`/orders/${orderId}/commitment-sch-a`)
}
