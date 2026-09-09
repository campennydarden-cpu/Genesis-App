'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Endorsement, EndorsementSplit } from '@/lib/types'

export async function listEndorsements(premiumId: string): Promise<Endorsement[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('endorsements')
    .select('*')
    .eq('premium_id', premiumId)
    .order('sort_order')
  return data ?? []
}

export async function addEndorsement(orderId: string, premiumId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('endorsements')
    .select('*', { count: 'exact', head: true })
    .eq('premium_id', premiumId)

  const { error } = await supabase.from('endorsements').insert({ premium_id: premiumId, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addEndorsement failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}

export async function updateEndorsement(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('endorsements')
    .update({
      code: (formData.get('code') as string) || null,
      description: (formData.get('description') as string) || null,
      charge: formData.get('charge') ? Number(formData.get('charge')) : null,
      bill_code: (formData.get('bill_code') as string) || null,
    })
    .eq('id', id)

  if (error) {
    console.error('updateEndorsement failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}

export async function deleteEndorsement(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('endorsements').delete().eq('id', id)
  if (error) {
    console.error('deleteEndorsement failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}

export async function listEndorsementSplits(endorsementId: string): Promise<EndorsementSplit[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('endorsement_splits')
    .select('*')
    .eq('endorsement_id', endorsementId)
    .order('sort_order')
  return data ?? []
}

export async function addEndorsementSplit(orderId: string, endorsementId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('endorsement_splits')
    .select('*', { count: 'exact', head: true })
    .eq('endorsement_id', endorsementId)

  const { error } = await supabase
    .from('endorsement_splits')
    .insert({ endorsement_id: endorsementId, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addEndorsementSplit failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}

export async function updateEndorsementSplit(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('endorsement_splits')
    .update({
      payee_contact_id: (formData.get('payee_contact_id') as string) || null,
      basis: (formData.get('basis') as string) || null,
      percent: formData.get('percent') ? Number(formData.get('percent')) : null,
      amount: formData.get('amount') ? Number(formData.get('amount')) : null,
      bill_code: (formData.get('bill_code') as string) || null,
    })
    .eq('id', id)

  if (error) {
    console.error('updateEndorsementSplit failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}

export async function deleteEndorsementSplit(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('endorsement_splits').delete().eq('id', id)
  if (error) {
    console.error('deleteEndorsementSplit failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/premiums`)
  return {}
}
