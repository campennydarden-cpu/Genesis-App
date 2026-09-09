'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TaxProration } from '@/lib/types'

export async function listAllContacts(orderId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contacts').select('id, name').eq('order_id', orderId).order('name')
  return data ?? []
}

export async function listProrations(orderId: string): Promise<TaxProration[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tax_prorations')
    .select('*')
    .eq('order_id', orderId)
    .order('sort_order')
  return data ?? []
}

export async function addProration(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('tax_prorations')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)

  const { error } = await supabase
    .from('tax_prorations')
    .insert({ order_id: orderId, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addProration failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/tax-prorations`)
  return {}
}

export async function updateProration(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tax_prorations')
    .update({
      description: (formData.get('description') as string) || null,
      category: (formData.get('category') as string) || null,
      payee_contact_id: (formData.get('payee_contact_id') as string) || null,
      account_number: (formData.get('account_number') as string) || null,
      compute_for: (formData.get('compute_for') as string) || null,
      credit_debit: (formData.get('credit_debit') as string) || null,
      share_of_amount: formData.get('share_of_amount') ? Number(formData.get('share_of_amount')) : null,
      proration_date: (formData.get('proration_date') as string) || null,
      period_from: (formData.get('period_from') as string) || null,
      period_to: (formData.get('period_to') as string) || null,
      use_30_day_months: formData.get('use_30_day_months') === 'on',
      days_in_period: formData.get('days_in_period') ? Number(formData.get('days_in_period')) : null,
      days_prorated: formData.get('days_prorated') ? Number(formData.get('days_prorated')) : null,
      per_diem: formData.get('per_diem') ? Number(formData.get('per_diem')) : null,
      prorated_amount: formData.get('prorated_amount') ? Number(formData.get('prorated_amount')) : null,
      cdf_line: (formData.get('cdf_line') as string) || null,
      bill_code: (formData.get('bill_code') as string) || null,
    })
    .eq('id', id)

  if (error) {
    console.error('updateProration failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/tax-prorations`)
  return {}
}

export async function setProrationCdfLine(orderId: string, id: string, cdfLineId: string | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('tax_prorations').update({ cdf_page2_line_id: cdfLineId }).eq('id', id)
  if (error) {
    console.error('setProrationCdfLine failed:', error)
    return { error: 'Could not save. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/tax-prorations`)
  return {}
}

export async function deleteProration(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('tax_prorations').delete().eq('id', id)
  if (error) {
    console.error('deleteProration failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/tax-prorations`)
  return {}
}
