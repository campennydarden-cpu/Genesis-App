'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CdfCashToClose, CdfPayoffPayment, CdfTransactionSummaryLine } from '@/lib/types'

export async function getCdfCashToClose(orderId: string): Promise<CdfCashToClose | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('cdf_cash_to_close').select('*').eq('order_id', orderId).maybeSingle()
  return data
}

export async function saveCdfCashToClose(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const numOrNull = (key: string) => (formData.get(key) ? Number(formData.get(key)) : null)
  const strOrNull = (key: string) => (formData.get(key) as string) || null

  const fields = {
    order_id: orderId,
    loan_amount_estimate: numOrNull('loan_amount_estimate'),
    loan_amount_final: numOrNull('loan_amount_final'),
    loan_amount_changed: strOrNull('loan_amount_changed'),
    closing_costs_j_estimate: numOrNull('closing_costs_j_estimate'),
    closing_costs_j_final: numOrNull('closing_costs_j_final'),
    closing_costs_changed: strOrNull('closing_costs_changed'),
    closing_costs_paid_before_closing_estimate: numOrNull('closing_costs_paid_before_closing_estimate'),
    closing_costs_paid_before_closing_final: numOrNull('closing_costs_paid_before_closing_final'),
    payoffs_k_estimate: numOrNull('payoffs_k_estimate'),
    payoffs_k_final: numOrNull('payoffs_k_final'),
    payoffs_changed: strOrNull('payoffs_changed'),
    cash_to_close_estimate: numOrNull('cash_to_close_estimate'),
    cash_to_close_final: numOrNull('cash_to_close_final'),
    cash_to_close_from_borrower: formData.get('cash_to_close_from_borrower') === 'on',
    cash_to_close_to_borrower: formData.get('cash_to_close_to_borrower') === 'on',
    closing_costs_financed: numOrNull('closing_costs_financed'),
  }

  const { error } = await supabase.from('cdf_cash_to_close').upsert(fields, { onConflict: 'order_id' })

  if (error) {
    console.error('saveCdfCashToClose failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-3`)
  return {}
}

export async function listAllContacts(orderId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contacts').select('id, name').eq('order_id', orderId).order('name')
  return data ?? []
}

export async function listPayoffsPayments(orderId: string): Promise<CdfPayoffPayment[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('cdf_payoffs_payments').select('*').eq('order_id', orderId).order('sort_order')
  return data ?? []
}

export async function addPayoffPayment(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('cdf_payoffs_payments')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)

  const { error } = await supabase.from('cdf_payoffs_payments').insert({ order_id: orderId, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addPayoffPayment failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-3`)
  return {}
}

export async function updatePayoffPayment(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
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
    console.error('updatePayoffPayment failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-3`)
  return {}
}

export async function deletePayoffPayment(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('cdf_payoffs_payments').delete().eq('id', id)
  if (error) {
    console.error('deletePayoffPayment failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/cdf-page-3`)
  return {}
}

export async function listTransactionSummaryLines(orderId: string): Promise<CdfTransactionSummaryLine[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('cdf_transaction_summary_lines')
    .select('*')
    .eq('order_id', orderId)
    .order('party')
    .order('section')
    .order('sort_order')
  return data ?? []
}

export async function addTransactionSummaryLine(orderId: string, party: string, section: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('cdf_transaction_summary_lines')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('party', party)
    .eq('section', section)

  const { error } = await supabase
    .from('cdf_transaction_summary_lines')
    .insert({ order_id: orderId, party, section, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addTransactionSummaryLine failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-3`)
  return {}
}

export async function updateTransactionSummaryLine(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cdf_transaction_summary_lines')
    .update({
      description: (formData.get('description') as string) || null,
      amount: formData.get('amount') ? Number(formData.get('amount')) : null,
    })
    .eq('id', id)

  if (error) {
    console.error('updateTransactionSummaryLine failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-3`)
  return {}
}

export async function deleteTransactionSummaryLine(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('cdf_transaction_summary_lines').delete().eq('id', id)
  if (error) {
    console.error('deleteTransactionSummaryLine failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/cdf-page-3`)
  return {}
}
