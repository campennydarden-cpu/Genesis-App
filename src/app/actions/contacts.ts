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

export async function editContact(orderId: string, contactId: string, formData: FormData) {
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
    })
    .eq('id', contactId)

  if (error) {
    console.error('editContact failed:', error)
    redirect(
      `/orders/${orderId}/contacts/${contactId}/edit?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  redirect(`/orders/${orderId}/contacts`)
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
