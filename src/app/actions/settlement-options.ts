'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SettlementOptions } from '@/lib/types'

export async function getSettlementOptions(orderId: string): Promise<SettlementOptions | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('settlement_options').select('*').eq('order_id', orderId).maybeSingle()
  return data
}

export async function saveSettlementOptions(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const strOrNull = (key: string) => (formData.get(key) as string) || null

  const fields = {
    order_id: orderId,
    settlement_type: strOrNull('settlement_type'),
    place_of_settlement_address: strOrNull('place_of_settlement_address'),
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
