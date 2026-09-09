'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { DocPrepAffidavit } from '@/lib/types'

export async function listAffidavits(orderId: string): Promise<DocPrepAffidavit[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('doc_prep_affidavits')
    .select('*')
    .eq('order_id', orderId)
    .order('sort_order')
  return data ?? []
}

export async function addAffidavit(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('doc_prep_affidavits')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)

  const { error } = await supabase.from('doc_prep_affidavits').insert({
    order_id: orderId,
    type: formData.get('type') as string,
    affiant: (formData.get('affiant') as string) || null,
    dated_date: (formData.get('dated_date') as string) || null,
    recorded: formData.get('recorded') === 'on',
    recorded_date: (formData.get('recorded_date') as string) || null,
    book: (formData.get('book') as string) || null,
    page: (formData.get('page') as string) || null,
    instrument_number: (formData.get('instrument_number') as string) || null,
    notes: (formData.get('notes') as string) || null,
    sort_order: (count ?? 0) + 1,
  })

  if (error) {
    console.error('addAffidavit failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/affidavits`)
  return {}
}

export async function updateAffidavit(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('doc_prep_affidavits')
    .update({
      type: formData.get('type') as string,
      affiant: (formData.get('affiant') as string) || null,
      dated_date: (formData.get('dated_date') as string) || null,
      recorded: formData.get('recorded') === 'on',
      recorded_date: (formData.get('recorded_date') as string) || null,
      book: (formData.get('book') as string) || null,
      page: (formData.get('page') as string) || null,
      instrument_number: (formData.get('instrument_number') as string) || null,
      notes: (formData.get('notes') as string) || null,
    })
    .eq('id', id)

  if (error) {
    console.error('updateAffidavit failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/affidavits`)
  return {}
}

export async function deleteAffidavit(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('doc_prep_affidavits').delete().eq('id', id)
  if (error) {
    console.error('deleteAffidavit failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/affidavits`)
  return {}
}
