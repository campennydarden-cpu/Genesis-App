'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CdfPage1 } from '@/lib/types'

export async function getCdfPage1(orderId: string): Promise<CdfPage1 | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('cdf_page1').select('*').eq('order_id', orderId).maybeSingle()
  return data
}

export async function saveCdfPage1(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const numOrNull = (key: string) => (formData.get(key) ? Number(formData.get(key)) : null)
  const strOrNull = (key: string) => (formData.get(key) as string) || null

  const fields = {
    order_id: orderId,
    loan_amount: numOrNull('loan_amount'),
    interest_rate: numOrNull('interest_rate'),
    monthly_principal_interest: numOrNull('monthly_principal_interest'),
    principal_interest_can_increase: formData.get('principal_interest_can_increase') === 'on',
    principal_interest_increase_explanation: strOrNull('principal_interest_increase_explanation'),
    has_prepayment_penalty: formData.get('has_prepayment_penalty') === 'on',
    prepayment_penalty_max: numOrNull('prepayment_penalty_max'),
    has_balloon_payment: formData.get('has_balloon_payment') === 'on',
    balloon_payment_amount: numOrNull('balloon_payment_amount'),
    estimated_total_monthly_payment: numOrNull('estimated_total_monthly_payment'),
    estimated_escrow_monthly: numOrNull('estimated_escrow_monthly'),
    taxes_included_in_escrow: formData.get('taxes_included_in_escrow') === 'on',
    homeowners_insurance_included_in_escrow: formData.get('homeowners_insurance_included_in_escrow') === 'on',
    other_escrow_included: formData.get('other_escrow_included') === 'on',
    other_escrow_description: strOrNull('other_escrow_description'),
    closing_costs_total: numOrNull('closing_costs_total'),
    closing_costs_note: strOrNull('closing_costs_note'),
    cash_to_close_total: numOrNull('cash_to_close_total'),
    cash_to_close_note: strOrNull('cash_to_close_note'),
  }

  const { error } = await supabase.from('cdf_page1').upsert(fields, { onConflict: 'order_id' })

  if (error) {
    console.error('saveCdfPage1 failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-1`)
  return {}
}
