'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { entityQualifiedName, fullDerivationClause } from '@/lib/derivation-clause'
import type { DocPrepDeed, DocPrepDeedPrincipal, DocPrepDeedSignatureLine, DocPrepDeedSubjectTo } from '@/lib/types'

export async function getOrderContactsForDeed(
  orderId: string
): Promise<{ id: string; name: string; role: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contacts').select('id, name, role').eq('order_id', orderId).order('name')
  return data ?? []
}

export async function getDeed(orderId: string): Promise<DocPrepDeed | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('doc_prep_deed').select('*').eq('order_id', orderId).maybeSingle()
  return data
}

export async function getDeedPrincipals(deedId: string): Promise<DocPrepDeedPrincipal[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('doc_prep_deed_principals').select('*').eq('deed_id', deedId)
  return data ?? []
}

export async function getDeedSignatureLines(deedId: string): Promise<DocPrepDeedSignatureLine[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('doc_prep_deed_signature_lines').select('*').eq('deed_id', deedId)
  return data ?? []
}

export async function getDeedSubjectTo(deedId: string): Promise<DocPrepDeedSubjectTo[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('doc_prep_deed_subject_to')
    .select('*')
    .eq('deed_id', deedId)
    .order('sort_order')
  return data ?? []
}

// Whole-row autosave-on-blur, matching OrderInfoForm/PropertyForm's useAutosave convention —
// the client resends every scalar field on each save, not per-field patches.
export async function saveDeed(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const fields = {
    order_id: orderId,
    instrument_type: (formData.get('instrument_type') as string) || null,
    consideration: formData.get('consideration') ? Number(formData.get('consideration')) : null,
    dated_date: (formData.get('dated_date') as string) || null,
    recorded_date: (formData.get('recorded_date') as string) || null,
    book: (formData.get('book') as string) || null,
    page: (formData.get('page') as string) || null,
    instrument_number: (formData.get('instrument_number') as string) || null,
    prepared_by_contact_id: (formData.get('prepared_by_contact_id') as string) || null,
    return_to_contact_id: (formData.get('return_to_contact_id') as string) || null,
    exemption_code: (formData.get('exemption_code') as string) || null,
    legal_as_exhibit: formData.get('legal_as_exhibit') === 'on',
    grantor_name: (formData.get('grantor_name') as string) || null,
    grantor_entity_type: (formData.get('grantor_entity_type') as string) || 'Individual',
    grantee_name: (formData.get('grantee_name') as string) || null,
    grantee_entity_type: (formData.get('grantee_entity_type') as string) || 'Individual',
    notary_block: (formData.get('notary_block') as string) || null,
    legal_text: (formData.get('legal_text') as string) || null,
    parcel_number: (formData.get('parcel_number') as string) || null,
    derivation_text: (formData.get('derivation_text') as string) || null,
    situs_address: (formData.get('situs_address') as string) || null,
  }

  const { error } = await supabase.from('doc_prep_deed').upsert(fields, { onConflict: 'order_id' })

  if (error) {
    console.error('saveDeed failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}

// Atomic get-or-create, matching saveDeed's own upsert(onConflict: 'order_id') pattern
// (also used by curative_settings/property_details elsewhere in this codebase) — a
// select-then-insert here would race two concurrent first-time actions (e.g. clicking
// "Copy" for Grantor and Grantee back-to-back) into a unique-constraint violation.
async function ensureDeedId(supabase: Awaited<ReturnType<typeof createClient>>, orderId: string): Promise<string> {
  const { data, error } = await supabase
    .from('doc_prep_deed')
    .upsert({ order_id: orderId }, { onConflict: 'order_id', ignoreDuplicates: true })
    .select('id')
    .single()
  if (!error && data) return data.id

  const { data: existing, error: fetchError } = await supabase
    .from('doc_prep_deed')
    .select('id')
    .eq('order_id', orderId)
    .single()
  if (fetchError || !existing) throw new Error('Could not create the Deed record.')
  return existing.id
}

// Copies one Contact's name/entity type/principals onto the Deed's Grantor or Grantee —
// a one-time convenience, not a live link (Cam's standing "every Doc Prep field is
// independently editable" direction). Single-contact only; the prototype's married-pair
// "Both" grouping convenience is a deliberate trim for this pass.
export async function copyDeedPartyFromContact(
  orderId: string,
  side: 'grantor' | 'grantee',
  contactId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('name, entity_type')
    .eq('id', contactId)
    .single()

  if (contactError || !contact) {
    console.error('copyDeedPartyFromContact failed to load contact:', contactError)
    return { error: 'Could not load that contact. Please try again.' }
  }

  const { data: principals } = await supabase
    .from('contact_principals')
    .select('name, role')
    .eq('contact_id', contactId)

  const deedId = await ensureDeedId(supabase, orderId)

  const nameField = side === 'grantor' ? 'grantor_name' : 'grantee_name'
  const entityField = side === 'grantor' ? 'grantor_entity_type' : 'grantee_entity_type'

  const { error } = await supabase
    .from('doc_prep_deed')
    .update({ [nameField]: contact.name, [entityField]: contact.entity_type })
    .eq('id', deedId)

  if (error) {
    console.error('copyDeedPartyFromContact failed to update deed:', error)
    return { error: 'Could not copy from that contact. Please try again.' }
  }

  await supabase.from('doc_prep_deed_principals').delete().eq('deed_id', deedId).eq('side', side)
  if (principals && principals.length > 0) {
    await supabase
      .from('doc_prep_deed_principals')
      .insert(principals.map((p) => ({ deed_id: deedId, side, name: p.name, role: p.role })))
  }

  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}

export async function addDeedPrincipal(
  orderId: string,
  side: 'grantor' | 'grantee',
  name: string,
  role: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const deedId = await ensureDeedId(supabase, orderId)

  const { error } = await supabase.from('doc_prep_deed_principals').insert({ deed_id: deedId, side, name, role })

  if (error) {
    console.error('addDeedPrincipal failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}

export async function deleteDeedPrincipal(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('doc_prep_deed_principals').delete().eq('id', id)
  if (error) {
    console.error('deleteDeedPrincipal failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}

export async function addSignatureLine(orderId: string, text: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const deedId = await ensureDeedId(supabase, orderId)

  const { error } = await supabase.from('doc_prep_deed_signature_lines').insert({ deed_id: deedId, text })

  if (error) {
    console.error('addSignatureLine failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}

export async function generateSignatureLineFromGrantor(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const deedId = await ensureDeedId(supabase, orderId)

  const { data: deed } = await supabase
    .from('doc_prep_deed')
    .select('grantor_name, grantor_entity_type')
    .eq('id', deedId)
    .single()

  if (!deed?.grantor_name) return { error: 'Add a Grantor before generating a signature line.' }

  const { data: principals } = await supabase
    .from('doc_prep_deed_principals')
    .select('name, role')
    .eq('deed_id', deedId)
    .eq('side', 'grantor')

  const text = entityQualifiedName(deed.grantor_name, deed.grantor_entity_type as never, principals ?? [])

  const { error } = await supabase.from('doc_prep_deed_signature_lines').insert({ deed_id: deedId, text })

  if (error) {
    console.error('generateSignatureLineFromGrantor failed:', error)
    return { error: 'Could not generate. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}

export async function updateSignatureLine(orderId: string, id: string, text: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('doc_prep_deed_signature_lines').update({ text }).eq('id', id)
  if (error) {
    console.error('updateSignatureLine failed:', error)
    return { error: 'Could not save. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}

export async function deleteSignatureLine(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('doc_prep_deed_signature_lines').delete().eq('id', id)
  if (error) {
    console.error('deleteSignatureLine failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}

export async function generateNotaryBlockFromGrantor(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const deedId = await ensureDeedId(supabase, orderId)

  const { data: deed } = await supabase
    .from('doc_prep_deed')
    .select('grantor_name, grantor_entity_type')
    .eq('id', deedId)
    .single()

  if (!deed?.grantor_name) return { error: 'Add a Grantor before generating a notary block.' }

  const { data: principals } = await supabase
    .from('doc_prep_deed_principals')
    .select('name, role')
    .eq('deed_id', deedId)
    .eq('side', 'grantor')

  const qualified = entityQualifiedName(deed.grantor_name, deed.grantor_entity_type as never, principals ?? [])
  const notaryBlock =
    `State of _____, County of _____\n\nOn this ___ day of __________, 20__, before me personally appeared ${qualified}, ` +
    `known to me (or satisfactorily proven) to be the person whose name is subscribed to the foregoing instrument, ` +
    `and acknowledged that they executed the same for the purposes therein contained.\n\nNotary Public`

  const { error } = await supabase.from('doc_prep_deed').update({ notary_block: notaryBlock }).eq('id', deedId)

  if (error) {
    console.error('generateNotaryBlockFromGrantor failed:', error)
    return { error: 'Could not generate. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}

export async function addSubjectTo(orderId: string, description: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const deedId = await ensureDeedId(supabase, orderId)

  const { count } = await supabase
    .from('doc_prep_deed_subject_to')
    .select('*', { count: 'exact', head: true })
    .eq('deed_id', deedId)

  const { error } = await supabase
    .from('doc_prep_deed_subject_to')
    .insert({ deed_id: deedId, description, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addSubjectTo failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}

export async function deleteSubjectTo(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('doc_prep_deed_subject_to').delete().eq('id', id)
  if (error) {
    console.error('deleteSubjectTo failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}

// Refills one independently-editable field from its live source, matching the
// "Refill from source" convenience Cam asked for on Legal Description/Parcel/
// Derivation/Situs Address (2026-08-24 full-editability pass).
export async function refillDeedFieldFromSource(
  orderId: string,
  field: 'legal_text' | 'parcel_number' | 'derivation_text' | 'situs_address'
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const deedId = await ensureDeedId(supabase, orderId)

  const { data: property } = await supabase
    .from('property_details')
    .select('full_legal_description, parcel_number, property_address')
    .eq('order_id', orderId)
    .maybeSingle()

  let value: string | null = null
  if (field === 'legal_text') value = property?.full_legal_description ?? null
  if (field === 'parcel_number') value = property?.parcel_number ?? null
  if (field === 'situs_address') value = property?.property_address ?? null

  if (field === 'derivation_text') {
    const { data: prelim } = await supabase.from('prelim_search').select('*').eq('order_id', orderId).maybeSingle()
    if (prelim) {
      const { data: granteePrincipals } = await supabase
        .from('derivation_principals')
        .select('name, role')
        .eq('prelim_search_id', prelim.id)
        .eq('side', 'grantee')
      const { data: grantorPrincipals } = await supabase
        .from('derivation_principals')
        .select('name, role')
        .eq('prelim_search_id', prelim.id)
        .eq('side', 'grantor')
      const { data: property2 } = await supabase
        .from('property_details')
        .select('county')
        .eq('order_id', orderId)
        .maybeSingle()

      value = fullDerivationClause(
        {
          granteeName: prelim.derivation_grantee_name,
          granteeEntityType: prelim.derivation_grantee_entity_type,
          grantorName: prelim.derivation_grantor_name,
          grantorEntityType: prelim.derivation_grantor_entity_type,
          instrumentType: prelim.derivation_instrument_type,
          recordedDate: prelim.derivation_recorded_date,
          book: prelim.derivation_book,
          page: prelim.derivation_page,
          instrumentNumber: prelim.derivation_instrument_number,
          isPortion: prelim.derivation_is_portion,
          county: property2?.county ?? null,
        },
        granteePrincipals ?? [],
        grantorPrincipals ?? []
      )
    }
  }

  const { error } = await supabase.from('doc_prep_deed').update({ [field]: value }).eq('id', deedId)

  if (error) {
    console.error('refillDeedFieldFromSource failed:', error)
    return { error: 'Could not refill. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}

export async function toggleDeedFinal(orderId: string, final: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const deedId = await ensureDeedId(supabase, orderId)

  const { error } = await supabase
    .from('doc_prep_deed')
    .update({ final, finalized_at: final ? new Date().toISOString() : null })
    .eq('id', deedId)

  if (error) {
    console.error('toggleDeedFinal failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/deed`)
  return {}
}
