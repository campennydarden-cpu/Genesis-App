'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CdfPage5, CdfPage5Contact } from '@/lib/types'

export async function getCdfPage5(orderId: string): Promise<CdfPage5 | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('cdf_page5').select('*').eq('order_id', orderId).maybeSingle()
  return data
}

export async function saveCdfPage5(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const numOrNull = (key: string) => (formData.get(key) ? Number(formData.get(key)) : null)

  const fields = {
    order_id: orderId,
    total_of_payments: numOrNull('total_of_payments'),
    finance_charge: numOrNull('finance_charge'),
    amount_financed: numOrNull('amount_financed'),
    apr: numOrNull('apr'),
    total_interest_percentage: numOrNull('total_interest_percentage'),
    print_appraisal_disclosure: formData.get('print_appraisal_disclosure') === 'on',
    liability_after_foreclosure: (formData.get('liability_after_foreclosure') as string) || null,
  }

  const { error } = await supabase.from('cdf_page5').upsert(fields, { onConflict: 'order_id' })

  if (error) {
    console.error('saveCdfPage5 failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-5`)
  return {}
}

export async function listCdfPage5Contacts(orderId: string): Promise<CdfPage5Contact[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('cdf_page5_contacts').select('*').eq('order_id', orderId).order('sort_order')
  return data ?? []
}

export async function listAllContacts(orderId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contacts').select('id, name').eq('order_id', orderId).order('name')
  return data ?? []
}

export async function addCdfPage5Contact(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('cdf_page5_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)

  const { error } = await supabase.from('cdf_page5_contacts').insert({ order_id: orderId, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addCdfPage5Contact failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-5`)
  return {}
}

export async function updateCdfPage5Contact(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cdf_page5_contacts')
    .update({
      role: (formData.get('role') as string) || null,
      contact_id: (formData.get('contact_id') as string) || null,
      nmls_id: (formData.get('nmls_id') as string) || null,
      license_id: (formData.get('license_id') as string) || null,
      contact_person: (formData.get('contact_person') as string) || null,
      contact_nmls_id: (formData.get('contact_nmls_id') as string) || null,
      contact_license_id: (formData.get('contact_license_id') as string) || null,
      email: (formData.get('email') as string) || null,
      phone: (formData.get('phone') as string) || null,
    })
    .eq('id', id)

  if (error) {
    console.error('updateCdfPage5Contact failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-5`)
  return {}
}

export async function deleteCdfPage5Contact(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('cdf_page5_contacts').delete().eq('id', id)
  if (error) {
    console.error('deleteCdfPage5Contact failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/cdf-page-5`)
  return {}
}
