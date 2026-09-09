'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TitleInsurancePremium, PremiumSplit } from '@/lib/types'

export async function listUnderwriterContacts(orderId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('order_id', orderId)
    .eq('role', 'Underwriter')
    .order('name')
  return data ?? []
}

export async function listAllContacts(orderId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contacts').select('id, name').eq('order_id', orderId).order('name')
  return data ?? []
}

export async function listPremiums(orderId: string): Promise<TitleInsurancePremium[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('title_insurance_premiums')
    .select('*')
    .eq('order_id', orderId)
    .order('sort_order')
  return data ?? []
}

export async function addPremium(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('title_insurance_premiums')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)

  const { error } = await supabase
    .from('title_insurance_premiums')
    .insert({ order_id: orderId, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addPremium failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}

export async function updatePremium(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('title_insurance_premiums')
    .update({
      policy_type: (formData.get('policy_type') as string) || null,
      underwriter_contact_id: (formData.get('underwriter_contact_id') as string) || null,
      coverage_amount: formData.get('coverage_amount') ? Number(formData.get('coverage_amount')) : null,
      base_premium: formData.get('base_premium') ? Number(formData.get('base_premium')) : null,
      final_premium: formData.get('final_premium') ? Number(formData.get('final_premium')) : null,
      bill_code: (formData.get('bill_code') as string) || null,
    })
    .eq('id', id)

  if (error) {
    console.error('updatePremium failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}

export async function deletePremium(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('title_insurance_premiums').delete().eq('id', id)
  if (error) {
    console.error('deletePremium failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}

export async function listPremiumSplits(premiumId: string): Promise<PremiumSplit[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('title_insurance_premium_splits')
    .select('*')
    .eq('premium_id', premiumId)
    .order('sort_order')
  return data ?? []
}

export async function addPremiumSplit(orderId: string, premiumId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('title_insurance_premium_splits')
    .select('*', { count: 'exact', head: true })
    .eq('premium_id', premiumId)

  const { error } = await supabase
    .from('title_insurance_premium_splits')
    .insert({ premium_id: premiumId, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addPremiumSplit failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}

export async function updatePremiumSplit(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('title_insurance_premium_splits')
    .update({
      payee_contact_id: (formData.get('payee_contact_id') as string) || null,
      basis: (formData.get('basis') as string) || null,
      percent: formData.get('percent') ? Number(formData.get('percent')) : null,
      amount: formData.get('amount') ? Number(formData.get('amount')) : null,
      bill_code: (formData.get('bill_code') as string) || null,
    })
    .eq('id', id)

  if (error) {
    console.error('updatePremiumSplit failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}

export async function deletePremiumSplit(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('title_insurance_premium_splits').delete().eq('id', id)
  if (error) {
    console.error('deletePremiumSplit failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}
