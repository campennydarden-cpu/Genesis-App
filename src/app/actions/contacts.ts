'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addContact(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const role = formData.get('role') as string
  const entityType = formData.get('entity_type') as string
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

  await supabase.from('contacts').insert({
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
  })

  revalidatePath(`/orders/${orderId}`)
}

export async function deleteContact(orderId: string, contactId: string) {
  const supabase = await createClient()
  await supabase.from('contacts').delete().eq('id', contactId)
  revalidatePath(`/orders/${orderId}`)
}
