'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CdfPayoffPayment, CdfPayoffAdditionalCharge } from '@/lib/types'

export async function listPayoffsForCalculation(orderId: string): Promise<CdfPayoffPayment[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('cdf_payoffs_payments').select('*').eq('order_id', orderId).order('sort_order')
  return data ?? []
}

export async function updatePayoffCalculation(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const numOrNull = (key: string) => (formData.get(key) ? Number(formData.get(key)) : null)
  const strOrNull = (key: string) => (formData.get(key) as string) || null

  const { error } = await supabase
    .from('cdf_payoffs_payments')
    .update({
      principal_balance: numOrNull('principal_balance'),
      interest_rate: numOrNull('interest_rate'),
      per_diem: numOrNull('per_diem'),
      interest_from: strOrNull('interest_from'),
      interest_to: strOrNull('interest_to'),
      additional_interest: numOrNull('additional_interest'),
      late_fee: numOrNull('late_fee'),
      payoff_expires_on: strOrNull('payoff_expires_on'),
    })
    .eq('id', id)

  if (error) {
    console.error('updatePayoffCalculation failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/payoff-calculations`)
  return {}
}

export async function listPayoffAdditionalCharges(payoffId: string): Promise<CdfPayoffAdditionalCharge[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('cdf_payoff_additional_charges').select('*').eq('payoff_id', payoffId).order('sort_order')
  return data ?? []
}

export async function addPayoffAdditionalCharge(orderId: string, payoffId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('cdf_payoff_additional_charges')
    .select('*', { count: 'exact', head: true })
    .eq('payoff_id', payoffId)

  const { error } = await supabase
    .from('cdf_payoff_additional_charges')
    .insert({ payoff_id: payoffId, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addPayoffAdditionalCharge failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/payoff-calculations`)
  return {}
}

export async function updatePayoffAdditionalCharge(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cdf_payoff_additional_charges')
    .update({
      description: (formData.get('description') as string) || null,
      fee: formData.get('fee') ? Number(formData.get('fee')) : null,
    })
    .eq('id', id)

  if (error) {
    console.error('updatePayoffAdditionalCharge failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/payoff-calculations`)
  return {}
}

export async function deletePayoffAdditionalCharge(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('cdf_payoff_additional_charges').delete().eq('id', id)
  if (error) {
    console.error('deletePayoffAdditionalCharge failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/payoff-calculations`)
  return {}
}
