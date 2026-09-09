'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { RECORDING_STATUSES } from '@/lib/constants'
import type { RecordingDocument } from '@/lib/types'

export async function listRecordingDocuments(orderId: string): Promise<RecordingDocument[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('recording_documents').select('*').eq('order_id', orderId).order('sort_order')
  return data ?? []
}

export async function addRecordingDocument(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('recording_documents')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)

  const { data: order } = await supabase.from('orders').select('property_county').eq('id', orderId).single()

  const { error } = await supabase
    .from('recording_documents')
    .insert({ order_id: orderId, sort_order: (count ?? 0) + 1, county: order?.property_county ?? null })

  if (error) {
    console.error('addRecordingDocument failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/recording`)
  return {}
}

export async function updateRecordingDocument(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const strOrNull = (key: string) => (formData.get(key) as string) || null

  // Server Actions are directly invocable endpoints, not gated by the React tree that
  // only ever passes one of RECORDING_STATUSES — validate here too, since an arbitrary
  // status string would persist but never match the fixed <select> the UI renders.
  const status = (formData.get('status') as string) || 'Not Submitted'
  if (!(RECORDING_STATUSES as readonly string[]).includes(status)) {
    return { error: 'Invalid status.' }
  }

  const { error } = await supabase
    .from('recording_documents')
    .update({
      document_description: strOrNull('document_description'),
      county: strOrNull('county'),
      status,
      date_submitted: strOrNull('date_submitted'),
      date_recorded: strOrNull('date_recorded'),
      instrument_number: strOrNull('instrument_number'),
      book: strOrNull('book'),
      page: strOrNull('page'),
      number_of_pages: formData.get('number_of_pages') ? Number(formData.get('number_of_pages')) : null,
      e_recording_reference: strOrNull('e_recording_reference'),
    })
    .eq('id', id)

  if (error) {
    console.error('updateRecordingDocument failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/recording`)
  return {}
}

export async function deleteRecordingDocument(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('recording_documents').delete().eq('id', id)
  if (error) {
    console.error('deleteRecordingDocument failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/recording`)
  return {}
}
