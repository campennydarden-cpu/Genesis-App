'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { DocPrepSecurityInstrument, DocPrepSiPrincipal } from '@/lib/types'

export async function getSecurityInstrument(orderId: string): Promise<DocPrepSecurityInstrument | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('doc_prep_security_instrument')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle()
  return data
}

export async function getSiPrincipals(siId: string): Promise<DocPrepSiPrincipal[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('doc_prep_si_principals').select('*').eq('si_id', siId)
  return data ?? []
}

export async function saveSecurityInstrument(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const fields = {
    order_id: orderId,
    instrument_type: (formData.get('instrument_type') as string) || null,
    trustee_name: (formData.get('trustee_name') as string) || null,
    loan_amount: formData.get('loan_amount') ? Number(formData.get('loan_amount')) : null,
    dated_date: (formData.get('dated_date') as string) || null,
    recorded_date: (formData.get('recorded_date') as string) || null,
    book: (formData.get('book') as string) || null,
    page: (formData.get('page') as string) || null,
    instrument_number: (formData.get('instrument_number') as string) || null,
    mortgagor_name: (formData.get('mortgagor_name') as string) || null,
    mortgagor_entity_type: (formData.get('mortgagor_entity_type') as string) || 'Individual',
    mortgagee_name: (formData.get('mortgagee_name') as string) || null,
    mortgagee_entity_type: (formData.get('mortgagee_entity_type') as string) || 'Individual',
    note_date: (formData.get('note_date') as string) || null,
    note_amount: formData.get('note_amount') ? Number(formData.get('note_amount')) : null,
    maturity_date: (formData.get('maturity_date') as string) || null,
    interest_rate: formData.get('interest_rate') ? Number(formData.get('interest_rate')) : null,
  }

  const { error } = await supabase.from('doc_prep_security_instrument').upsert(fields, { onConflict: 'order_id' })

  if (error) {
    console.error('saveSecurityInstrument failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/security-instrument`)
  return {}
}

async function ensureSiId(supabase: Awaited<ReturnType<typeof createClient>>, orderId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('doc_prep_security_instrument')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()
  if (existing) return existing.id
  const { data: created, error } = await supabase
    .from('doc_prep_security_instrument')
    .insert({ order_id: orderId })
    .select('id')
    .single()
  if (error || !created) throw new Error('Could not create the Security Instrument record.')
  return created.id
}

export async function copySiPartyFromContact(
  orderId: string,
  side: 'mortgagor' | 'mortgagee',
  contactId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('name, entity_type')
    .eq('id', contactId)
    .single()

  if (contactError || !contact) {
    console.error('copySiPartyFromContact failed to load contact:', contactError)
    return { error: 'Could not load that contact. Please try again.' }
  }

  const { data: principals } = await supabase
    .from('contact_principals')
    .select('name, role')
    .eq('contact_id', contactId)

  const siId = await ensureSiId(supabase, orderId)

  const nameField = side === 'mortgagor' ? 'mortgagor_name' : 'mortgagee_name'
  const entityField = side === 'mortgagor' ? 'mortgagor_entity_type' : 'mortgagee_entity_type'

  const { error } = await supabase
    .from('doc_prep_security_instrument')
    .update({ [nameField]: contact.name, [entityField]: contact.entity_type })
    .eq('id', siId)

  if (error) {
    console.error('copySiPartyFromContact failed to update SI:', error)
    return { error: 'Could not copy from that contact. Please try again.' }
  }

  await supabase.from('doc_prep_si_principals').delete().eq('si_id', siId).eq('side', side)
  if (principals && principals.length > 0) {
    await supabase
      .from('doc_prep_si_principals')
      .insert(principals.map((p) => ({ si_id: siId, side, name: p.name, role: p.role })))
  }

  revalidatePath(`/orders/${orderId}/security-instrument`)
  return {}
}

export async function addSiPrincipal(
  orderId: string,
  side: 'mortgagor' | 'mortgagee',
  name: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const siId = await ensureSiId(supabase, orderId)

  const { error } = await supabase.from('doc_prep_si_principals').insert({ si_id: siId, side, name, role: null })

  if (error) {
    console.error('addSiPrincipal failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/security-instrument`)
  return {}
}

export async function deleteSiPrincipal(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('doc_prep_si_principals').delete().eq('id', id)
  if (error) {
    console.error('deleteSiPrincipal failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/security-instrument`)
  return {}
}
