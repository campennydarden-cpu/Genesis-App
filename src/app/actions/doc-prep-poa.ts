'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type PoaContact = {
  id: string
  name: string
  role: string
  poa_attorney_in_fact_name: string | null
  poa_dated_date: string | null
  poa_recorded_date: string | null
  poa_book: string | null
  poa_page: string | null
  poa_instrument_number: string | null
}

export async function listPoaContacts(orderId: string): Promise<PoaContact[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contacts')
    .select(
      'id, name, role, poa_attorney_in_fact_name, poa_dated_date, poa_recorded_date, poa_book, poa_page, poa_instrument_number'
    )
    .eq('order_id', orderId)
    .eq('poa', true)
    .order('name')
  return data ?? []
}

export async function savePoaFields(orderId: string, contactId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('contacts')
    .update({
      poa_attorney_in_fact_name: (formData.get('poa_attorney_in_fact_name') as string) || null,
      poa_dated_date: (formData.get('poa_dated_date') as string) || null,
      poa_recorded_date: (formData.get('poa_recorded_date') as string) || null,
      poa_book: (formData.get('poa_book') as string) || null,
      poa_page: (formData.get('poa_page') as string) || null,
      poa_instrument_number: (formData.get('poa_instrument_number') as string) || null,
    })
    .eq('id', contactId)

  if (error) {
    console.error('savePoaFields failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/power-of-attorney`)
  return {}
}
