'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function addContact(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const role = formData.get('role') as string
  // Entity Type is hidden in the UI for roles it doesn't apply to; the column
  // is NOT NULL, so fall back to the DB default when the field is absent.
  const entityType = (formData.get('entity_type') as string) || 'Individual'
  const name = formData.get('name') as string
  const currentAddress = formData.get('current_address') as string
  const mailingAddress = formData.get('mailing_address') as string
  const forwardingAddress = formData.get('forwarding_address') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const ssn = formData.get('ssn') as string
  const dob = formData.get('dob') as string
  const licenseNumber = formData.get('license_number') as string
  const altaId = formData.get('alta_id') as string
  const mortgageeClause = formData.get('mortgagee_clause') as string
  const poa = formData.get('poa') === 'on'
  const maritalStatus = formData.get('marital_status') as string

  const { error } = await supabase.from('contacts').insert({
    order_id: orderId,
    role,
    entity_type: entityType,
    name,
    current_address: currentAddress || null,
    mailing_address: mailingAddress || null,
    forwarding_address: forwardingAddress || null,
    phone: phone || null,
    email: email || null,
    ssn: ssn || null,
    dob: dob || null,
    license_number: licenseNumber || null,
    alta_id: altaId || null,
    mortgagee_clause: mortgageeClause || null,
    poa,
    marital_status: maritalStatus || null,
  })

  if (error) {
    console.error('addContact failed:', error)
    redirect(
      `/orders/${orderId}/contacts?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
}

export async function saveContact(
  orderId: string,
  contactId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const role = formData.get('role') as string
  const entityType = (formData.get('entity_type') as string) || 'Individual'
  const name = formData.get('name') as string
  const currentAddress = formData.get('current_address') as string
  const mailingAddress = formData.get('mailing_address') as string
  const forwardingAddress = formData.get('forwarding_address') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const ssn = formData.get('ssn') as string
  const dob = formData.get('dob') as string
  const licenseNumber = formData.get('license_number') as string
  const altaId = formData.get('alta_id') as string
  const mortgageeClause = formData.get('mortgagee_clause') as string
  const poa = formData.get('poa') === 'on'
  const maritalStatus = formData.get('marital_status') as string
  // Absent when the field isn't rendered for this role — leave the existing link alone
  // rather than reading it as "clear the link".
  const linkedContactIdRaw = formData.get('linked_contact_id')
  const linkedContactId = linkedContactIdRaw === null ? undefined : (linkedContactIdRaw as string) || null

  if (!role || !name) {
    return { error: 'Role and Name are required.' }
  }

  // Linking is symmetric — if the link is changing, clear the old counterpart's side
  // and set the new one's, so either contact's linked_contact_id always points back.
  if (linkedContactId !== undefined) {
    const { data: current } = await supabase.from('contacts').select('linked_contact_id').eq('id', contactId).single()
    const oldLinkedId = current?.linked_contact_id ?? null
    if (oldLinkedId && oldLinkedId !== linkedContactId) {
      await supabase.from('contacts').update({ linked_contact_id: null }).eq('id', oldLinkedId)
    }
    if (linkedContactId) {
      await supabase.from('contacts').update({ linked_contact_id: contactId }).eq('id', linkedContactId)
    }
  }

  const { error } = await supabase
    .from('contacts')
    .update({
      role,
      entity_type: entityType,
      name,
      current_address: currentAddress || null,
      mailing_address: mailingAddress || null,
      forwarding_address: forwardingAddress || null,
      phone: phone || null,
      email: email || null,
      ssn: ssn || null,
      dob: dob || null,
      license_number: licenseNumber || null,
      alta_id: altaId || null,
      mortgagee_clause: mortgageeClause || null,
      poa,
      marital_status: maritalStatus || null,
      ...(linkedContactId !== undefined ? { linked_contact_id: linkedContactId } : {}),
    })
    .eq('id', contactId)

  if (error) {
    console.error('saveContact failed:', error)
    return { error: 'Could not save. Please check your entries and try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  return {}
}

export async function deleteContact(orderId: string, contactId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('contacts').delete().eq('id', contactId)

  if (error) {
    console.error('deleteContact failed:', error)
    redirect(
      `/orders/${orderId}/contacts?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
}

export async function addContactPrincipal(contactId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const role = (formData.get('role') as string) || null

  const { error } = await supabase.from('contact_principals').insert({
    contact_id: contactId,
    name,
    role,
  })

  if (error) {
    console.error('addContactPrincipal failed:', error)
    redirect(
      `/orders/${orderId}/contacts?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/contacts`)
}

export async function updateContactPrincipal(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const role = (formData.get('role') as string) || null

  const { error } = await supabase.from('contact_principals').update({ name, role }).eq('id', id)

  if (error) {
    console.error('updateContactPrincipal failed:', error)
    redirect(
      `/orders/${orderId}/contacts?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/contacts`)
}

export async function deleteContactPrincipal(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('contact_principals').delete().eq('id', id)

  if (error) {
    console.error('deleteContactPrincipal failed:', error)
    redirect(
      `/orders/${orderId}/contacts?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/contacts`)
}

export async function addSignatureLine(contactId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const text = formData.get('text') as string

  const { error } = await supabase.from('contact_signature_lines').insert({ contact_id: contactId, text })

  if (error) {
    console.error('addSignatureLine failed:', error)
    redirect(
      `/orders/${orderId}/contacts?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/contacts`)
}

export async function updateSignatureLine(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const text = formData.get('text') as string

  const { error } = await supabase.from('contact_signature_lines').update({ text }).eq('id', id)

  if (error) {
    console.error('updateSignatureLine failed:', error)
    redirect(
      `/orders/${orderId}/contacts?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/contacts`)
}

export async function deleteSignatureLine(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('contact_signature_lines').delete().eq('id', id)

  if (error) {
    console.error('deleteSignatureLine failed:', error)
    redirect(
      `/orders/${orderId}/contacts?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/contacts`)
}
