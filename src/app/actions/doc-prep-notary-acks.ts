'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { NotaryAck } from '@/lib/types'

type SignerContact = {
  id: string
  name: string
  entity_type: string
  poa: boolean
  poa_attorney_in_fact_name: string | null
}

function notaryAckTextForContact(c: SignerContact, docLabel: string, principalNames: string[]): string {
  if (c.entity_type === 'Individual') {
    if (c.poa && c.poa_attorney_in_fact_name) {
      return (
        `State of _____, County of _____\n\nOn this ___ day of __________, 20__, before me personally appeared ${c.poa_attorney_in_fact_name}, ` +
        `known to me (or satisfactorily proven) to be the person whose name is subscribed to the foregoing ${docLabel} as Attorney-in-Fact for ${c.name} ` +
        `under a Power of Attorney, and acknowledged that they executed the same as the free act and deed of ${c.name}.\n\nNotary Public`
      )
    }
    return (
      `State of _____, County of _____\n\nOn this ___ day of __________, 20__, before me personally appeared ${c.name}, ` +
      `known to me (or satisfactorily proven) to be the person whose name is subscribed to the foregoing ${docLabel}, ` +
      `and acknowledged that they executed the same for the purposes therein contained.\n\nNotary Public`
    )
  }

  const pLine = principalNames.length > 0 ? ` (${principalNames.join(', ')})` : ''
  return (
    `State of _____, County of _____\n\nOn this ___ day of __________, 20__, before me personally appeared the person(s) signing on behalf of ${c.name}${pLine}, ` +
    `known to me (or satisfactorily proven) to have executed the foregoing ${docLabel} in such representative capacity, ` +
    `and that by their signature(s) the entity on behalf of which they acted executed the instrument.\n\nNotary Public`
  )
}

// Signer pairs match the old prototype exactly: Deed signers = Seller-role contacts
// (whoever currently holds title and conveys it away), SI signers = Buyer/Borrower-role
// contacts (whoever signs the mortgage). Syncs doc_prep_notary_acks to the live pair
// list on every read — inserts new pairs, prunes stale ones — same as the prototype's
// ensureNotaryAcksSynced().
export async function listNotaryAcks(orderId: string): Promise<
  Array<NotaryAck & { contact_name: string }>
> {
  const supabase = await createClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, role, entity_type, poa, poa_attorney_in_fact_name')
    .eq('order_id', orderId)

  const deedSigners = (contacts ?? []).filter((c) => c.role === 'Seller').map((c) => ({ c, doc: 'Deed' }))
  const siSigners = (contacts ?? []).filter((c) => c.role === 'Buyer/Borrower').map((c) => ({ c, doc: 'Security Instrument' }))
  const signers = [...deedSigners, ...siSigners]

  const { data: existingAcks } = await supabase.from('doc_prep_notary_acks').select('*').eq('order_id', orderId)
  const existing = existingAcks ?? []

  const validKeys = new Set(signers.map((s) => `${s.c.id}|${s.doc}`))
  const staleIds = existing.filter((a) => !validKeys.has(`${a.contact_id}|${a.doc_label}`)).map((a) => a.id)
  if (staleIds.length > 0) {
    await supabase.from('doc_prep_notary_acks').delete().in('id', staleIds)
  }

  const missing = signers.filter((s) => !existing.some((a) => a.contact_id === s.c.id && a.doc_label === s.doc))

  for (const s of missing) {
    const { data: principals } = await supabase.from('contact_principals').select('name').eq('contact_id', s.c.id)
    const text = notaryAckTextForContact(s.c, s.doc, (principals ?? []).map((p) => p.name))
    await supabase.from('doc_prep_notary_acks').insert({ order_id: orderId, contact_id: s.c.id, doc_label: s.doc, text })
  }

  const { data: finalAcks } = await supabase.from('doc_prep_notary_acks').select('*').eq('order_id', orderId)

  return (finalAcks ?? []).map((a) => {
    const c = (contacts ?? []).find((contact) => contact.id === a.contact_id)
    return { ...a, contact_name: c?.name ?? '(unknown contact)' }
  })
}

export async function updateNotaryAckText(orderId: string, id: string, text: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('doc_prep_notary_acks').update({ text }).eq('id', id)
  if (error) {
    console.error('updateNotaryAckText failed:', error)
    return { error: 'Could not save. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/notary-acknowledgement`)
  return {}
}

export async function regenerateNotaryAck(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: ack } = await supabase.from('doc_prep_notary_acks').select('contact_id, doc_label').eq('id', id).single()
  if (!ack) return { error: 'Not found.' }

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, entity_type, poa, poa_attorney_in_fact_name')
    .eq('id', ack.contact_id)
    .single()
  if (!contact) return { error: 'Contact not found.' }

  const { data: principals } = await supabase.from('contact_principals').select('name').eq('contact_id', contact.id)
  const text = notaryAckTextForContact(contact, ack.doc_label, (principals ?? []).map((p) => p.name))

  const { error } = await supabase.from('doc_prep_notary_acks').update({ text }).eq('id', id)
  if (error) {
    console.error('regenerateNotaryAck failed:', error)
    return { error: 'Could not regenerate. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/notary-acknowledgement`)
  return {}
}
