'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CdfPayoffPayment, CdfPayoffAdditionalCharge } from '@/lib/types'

export async function listPayoffsForCalculation(orderId: string): Promise<CdfPayoffPayment[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('cdf_payoffs_payments').select('*').eq('order_id', orderId).order('sort_order')
  return data ?? []
}

export async function listAllContacts(orderId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contacts').select('id, name').eq('order_id', orderId).order('name')
  return data ?? []
}

// This screen and CDF Page 3 both own cdf_payoffs_payments rows now — a payoff can be added,
// described, or removed from either screen, matching the real system where Payoff Calculation
// is one tab on the same K. Payoffs And Payments row CDF Page 3 shows, not a separate table.
export async function addPayoff(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('cdf_payoffs_payments')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)

  const { error } = await supabase.from('cdf_payoffs_payments').insert({ order_id: orderId, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addPayoff failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/payoff-calculations`)
  revalidatePath(`/orders/${orderId}/cdf-page-3`)
  return {}
}

export async function updatePayoffBase(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cdf_payoffs_payments')
    .update({
      description: (formData.get('description') as string) || null,
      payee_contact_id: (formData.get('payee_contact_id') as string) || null,
      amount: formData.get('amount') ? Number(formData.get('amount')) : null,
    })
    .eq('id', id)

  if (error) {
    console.error('updatePayoffBase failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/payoff-calculations`)
  revalidatePath(`/orders/${orderId}/cdf-page-3`)
  return {}
}

export async function deletePayoff(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('cdf_payoffs_payments').delete().eq('id', id)
  if (error) {
    console.error('deletePayoff failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/payoff-calculations`)
  revalidatePath(`/orders/${orderId}/cdf-page-3`)
  return {}
}

export async function updatePayoffCalculation(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const numOrNull = (key: string) => (formData.get(key) ? Number(formData.get(key)) : null)
  const strOrNull = (key: string) => (formData.get(key) as string) || null

  const payoffMethod = (formData.get('payoff_method') as string) || 'principal_balance'
  if (payoffMethod !== 'principal_balance' && payoffMethod !== 'payoff_amount') {
    return { error: 'Invalid payoff method.' }
  }

  const { error } = await supabase
    .from('cdf_payoffs_payments')
    .update({
      payoff_method: payoffMethod,
      principal_balance: numOrNull('principal_balance'),
      interest_charged: numOrNull('interest_charged'),
      interest_rate: numOrNull('interest_rate'),
      per_diem: numOrNull('per_diem'),
      interest_from: strOrNull('interest_from'),
      interest_to: strOrNull('interest_to'),
      additional_interest: numOrNull('additional_interest'),
      late_fee: numOrNull('late_fee'),
      late_fee_after: strOrNull('late_fee_after'),
      payoff_expires_on: strOrNull('payoff_expires_on'),
      payoff_amount: numOrNull('payoff_amount'),
      per_diem_days_basis: (formData.get('per_diem_days_basis') as string) || '365',
      payoff_date_basis: strOrNull('payoff_date_basis'),
      payoff_date_basis_from: strOrNull('payoff_date_basis_from'),
      payoff_date_basis_to: strOrNull('payoff_date_basis_to'),
      extra_days: numOrNull('extra_days'),
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
