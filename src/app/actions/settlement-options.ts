'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SettlementOptions } from '@/lib/types'

export async function getSettlementOptions(orderId: string): Promise<SettlementOptions | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('settlement_options').select('*').eq('order_id', orderId).maybeSingle()
  return data
}

export async function listAllContacts(orderId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contacts').select('id, name').eq('order_id', orderId).order('name')
  return data ?? []
}

export async function saveSettlementOptions(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const strOrNull = (key: string) => (formData.get(key) as string) || null

  const fields = {
    order_id: orderId,
    settlement_type: strOrNull('settlement_type'),
    place_of_settlement_address: strOrNull('place_of_settlement_address'),
    settlement_agent_contact_id: strOrNull('settlement_agent_contact_id'),
    admin_data_cdf1: strOrNull('admin_data_cdf1'),
    admin_data_cdf2: strOrNull('admin_data_cdf2'),
    admin_data_cdf3: strOrNull('admin_data_cdf3'),
    admin_data_cdf4: strOrNull('admin_data_cdf4'),
    admin_data_cdf5: strOrNull('admin_data_cdf5'),
    seller_credit_method: strOrNull('seller_credit_method'),
  }

  const { error } = await supabase.from('settlement_options').upsert(fields, { onConflict: 'order_id' })

  if (error) {
    console.error('saveSettlementOptions failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/settlement-options`)
  return {}
}

// One-time copy, not a live sync — matches every other "pull from Contacts" pattern
// already in this app (Deed's Refill from source, CDF Line assignment's initial
// description/amount copy). The address stays independently editable after.
export async function refillPlaceOfSettlementAddress(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: settlementOptions } = await supabase
    .from('settlement_options')
    .select('settlement_agent_contact_id')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!settlementOptions?.settlement_agent_contact_id) {
    return { error: 'Select a Settlement Agent first.' }
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('current_address')
    .eq('id', settlementOptions.settlement_agent_contact_id)
    .single()

  const { error } = await supabase
    .from('settlement_options')
    .update({ place_of_settlement_address: contact?.current_address ?? null })
    .eq('order_id', orderId)

  if (error) {
    console.error('refillPlaceOfSettlementAddress failed:', error)
    return { error: 'Could not refill. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/settlement-options`)
  return {}
}
