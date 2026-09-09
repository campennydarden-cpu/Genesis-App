'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { AdditionalTitleCharge, AdditionalTitleChargeSplit } from '@/lib/types'

export async function listPoliciesForOrder(orderId: string): Promise<{ id: string; policy_type: string | null }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('title_insurance_premiums')
    .select('id, policy_type')
    .eq('order_id', orderId)
    .order('sort_order')
  return data ?? []
}

export async function listAllContacts(orderId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contacts').select('id, name').eq('order_id', orderId).order('name')
  return data ?? []
}

export async function listCharges(orderId: string): Promise<AdditionalTitleCharge[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('additional_title_charges')
    .select('*')
    .eq('order_id', orderId)
    .order('sort_order')
  return data ?? []
}

export async function addCharge(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('additional_title_charges')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)

  const { error } = await supabase
    .from('additional_title_charges')
    .insert({ order_id: orderId, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addCharge failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/additional-charges`)
  return {}
}

export async function updateCharge(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('additional_title_charges')
    .update({
      description: (formData.get('description') as string) || null,
      policy_id: (formData.get('policy_id') as string) || null,
      charge: formData.get('charge') ? Number(formData.get('charge')) : null,
      taxable: formData.get('taxable') === 'on',
      fee_type: (formData.get('fee_type') as string) || null,
      cdf_line: (formData.get('cdf_line') as string) || null,
      invoice: (formData.get('invoice') as string) || null,
      bill_code: (formData.get('bill_code') as string) || null,
      seller_pay_percent: formData.get('seller_pay_percent') ? Number(formData.get('seller_pay_percent')) : null,
      issued_date: (formData.get('issued_date') as string) || null,
      effective_date: (formData.get('effective_date') as string) || null,
    })
    .eq('id', id)

  if (error) {
    console.error('updateCharge failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/additional-charges`)
  return {}
}

export async function setChargeCdfLine(orderId: string, id: string, cdfLineId: string | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('additional_title_charges').update({ cdf_page2_line_id: cdfLineId }).eq('id', id)
  if (error) {
    console.error('setChargeCdfLine failed:', error)
    return { error: 'Could not save. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/additional-charges`)
  return {}
}

export async function deleteCharge(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('additional_title_charges').delete().eq('id', id)
  if (error) {
    console.error('deleteCharge failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/additional-charges`)
  return {}
}

export async function listChargeSplits(chargeId: string): Promise<AdditionalTitleChargeSplit[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('additional_title_charge_splits')
    .select('*')
    .eq('charge_id', chargeId)
    .order('sort_order')
  return data ?? []
}

export async function addChargeSplit(orderId: string, chargeId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('additional_title_charge_splits')
    .select('*', { count: 'exact', head: true })
    .eq('charge_id', chargeId)

  const { error } = await supabase
    .from('additional_title_charge_splits')
    .insert({ charge_id: chargeId, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addChargeSplit failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/additional-charges`)
  return {}
}

export async function updateChargeSplit(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('additional_title_charge_splits')
    .update({
      payee_contact_id: (formData.get('payee_contact_id') as string) || null,
      basis: (formData.get('basis') as string) || null,
      percent: formData.get('percent') ? Number(formData.get('percent')) : null,
      amount: formData.get('amount') ? Number(formData.get('amount')) : null,
      bill_code: (formData.get('bill_code') as string) || null,
    })
    .eq('id', id)

  if (error) {
    console.error('updateChargeSplit failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/additional-charges`)
  return {}
}

export async function deleteChargeSplit(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('additional_title_charge_splits').delete().eq('id', id)
  if (error) {
    console.error('deleteChargeSplit failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/additional-charges`)
  return {}
}
