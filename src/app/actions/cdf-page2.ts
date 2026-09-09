'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CdfPage2Line } from '@/lib/types'

export async function listCdfPage2Lines(orderId: string): Promise<CdfPage2Line[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('cdf_page2_lines')
    .select('*')
    .eq('order_id', orderId)
    .order('section')
    .order('sort_order')
  return data ?? []
}

export async function listAllContacts(orderId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contacts').select('id, name').eq('order_id', orderId).order('name')
  return data ?? []
}

export async function addCdfPage2Line(orderId: string, section: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('cdf_page2_lines')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('section', section)

  const { error } = await supabase
    .from('cdf_page2_lines')
    .insert({ order_id: orderId, section, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addCdfPage2Line failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-2`)
  return {}
}

export async function updateCdfPage2Line(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const numOrNull = (key: string) => (formData.get(key) ? Number(formData.get(key)) : null)

  const { error } = await supabase
    .from('cdf_page2_lines')
    .update({
      description: (formData.get('description') as string) || null,
      to_contact_id: (formData.get('to_contact_id') as string) || null,
      borrower_paid_at_closing: numOrNull('borrower_paid_at_closing'),
      borrower_paid_before_closing: numOrNull('borrower_paid_before_closing'),
      seller_paid_at_closing: numOrNull('seller_paid_at_closing'),
      seller_paid_before_closing: numOrNull('seller_paid_before_closing'),
      paid_by_others: numOrNull('paid_by_others'),
    })
    .eq('id', id)

  if (error) {
    console.error('updateCdfPage2Line failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-2`)
  return {}
}

export async function deleteCdfPage2Line(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('cdf_page2_lines').delete().eq('id', id)
  if (error) {
    console.error('deleteCdfPage2Line failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/cdf-page-2`)
  return {}
}
