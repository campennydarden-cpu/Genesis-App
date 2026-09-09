'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CdfPage2Line } from '@/lib/types'

export async function listCdfPage2Lines(orderId: string): Promise<CdfPage2Line[]> {
  const supabase = await createClient()

  // Section A's "% of Loan Amount (Points)" line and Section G's "Aggregate
  // Adjustment" line are fixed, non-removable rows confirmed by SoftPro reference
  // screenshots — ensure they exist before returning, so every order gets them
  // automatically the first time this screen loads.
  const { data: fixedLines } = await supabase.from('cdf_page2_lines').select('section').eq('order_id', orderId).eq('is_fixed', true)
  const hasFixedA = fixedLines?.some((l) => l.section === 'A')
  const hasFixedG = fixedLines?.some((l) => l.section === 'G')
  const toSeed = []
  if (!hasFixedA) toSeed.push({ order_id: orderId, section: 'A', sort_order: 0, description: '% of Loan Amount (Points)', is_fixed: true })
  if (!hasFixedG) toSeed.push({ order_id: orderId, section: 'G', sort_order: 999, description: 'Aggregate Adjustment', is_fixed: true })
  if (toSeed.length > 0) await supabase.from('cdf_page2_lines').insert(toSeed)

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

// Shared by the "assign to CDF Page 2" Line control on Premiums & Endorsements, Additional
// Title/Escrow Charges, and Tax/Other Prorations — creates the next line in the chosen
// section (same insert as addCdfPage2Line) and returns its id so the caller can link a
// charge/proration row to it via cdf_page2_line_id.
export async function assignNextCdfPage2Line(orderId: string, section: string): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('cdf_page2_lines')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('section', section)

  const { data, error } = await supabase
    .from('cdf_page2_lines')
    .insert({ order_id: orderId, section, sort_order: (count ?? 0) + 1 })
    .select('id')
    .single()

  if (error) {
    console.error('assignNextCdfPage2Line failed:', error)
    return { error: 'Could not assign. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-2`)
  return { id: data.id }
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
      points_percent: numOrNull('points_percent'),
      points_round_whole_dollar: formData.get('points_round_whole_dollar') === 'on',
      points_adjustment: numOrNull('points_adjustment'),
      points_adjustment_for: (formData.get('points_adjustment_for') as string) || null,
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
