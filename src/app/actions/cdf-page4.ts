'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CdfPage4 } from '@/lib/types'

export async function getCdfPage4(orderId: string): Promise<CdfPage4 | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('cdf_page4').select('*').eq('order_id', orderId).maybeSingle()
  return data
}

export async function saveCdfPage4(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const numOrNull = (key: string) => (formData.get(key) ? Number(formData.get(key)) : null)
  const intOrNull = (key: string) => (formData.get(key) ? parseInt(formData.get(key) as string, 10) : null)
  const strOrNull = (key: string) => (formData.get(key) as string) || null

  const fields = {
    order_id: orderId,
    has_assumption: formData.get('has_assumption') === 'on',
    assumption_allowed: formData.get('assumption_allowed') === 'on',
    has_demand_feature: formData.get('has_demand_feature') === 'on',
    demand_feature_explanation: strOrNull('demand_feature_explanation'),
    late_payment_grace_period_days: intOrNull('late_payment_grace_period_days'),
    late_payment_fee_percent: numOrNull('late_payment_fee_percent'),
    has_negative_amortization: formData.get('has_negative_amortization') === 'on',
    negative_amortization_explanation: strOrNull('negative_amortization_explanation'),
    partial_payments_accepted: formData.get('partial_payments_accepted') === 'on',
    partial_payments_explanation: strOrNull('partial_payments_explanation'),
    has_security_interest: formData.get('has_security_interest') === 'on',
    security_interest_property_address: strOrNull('security_interest_property_address'),
    escrow_type: strOrNull('escrow_type'),
    escrow_initial_deposit: numOrNull('escrow_initial_deposit'),
    escrow_monthly_payment: numOrNull('escrow_monthly_payment'),
    no_escrow_estimated_property_costs: numOrNull('no_escrow_estimated_property_costs'),
    no_escrow_escrowed_note: strOrNull('no_escrow_escrowed_note'),
  }

  const { error } = await supabase.from('cdf_page4').upsert(fields, { onConflict: 'order_id' })

  if (error) {
    console.error('saveCdfPage4 failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-4`)
  return {}
}
