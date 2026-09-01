'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function fail(orderId: string, message: string): never {
  redirect(`/orders/${orderId}/curative?error=${encodeURIComponent(message)}`)
}

export async function updateRequirementDisposition(orderId: string, requirementId: string, formData: FormData) {
  const supabase = await createClient()
  const disposition = (formData.get('disposition') as string) || null
  const disposition_notes = (formData.get('disposition_notes') as string) || null
  const dont_show = formData.get('dont_show') === 'on'

  const { error } = await supabase
    .from('commitment_requirements')
    .update({ disposition, disposition_notes, dont_show })
    .eq('id', requirementId)

  if (error) {
    console.error('updateRequirementDisposition failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/curative`)
}

export async function updateExceptionDisposition(orderId: string, exceptionId: string, formData: FormData) {
  const supabase = await createClient()
  const disposition = (formData.get('disposition') as string) || null
  const disposition_notes = (formData.get('disposition_notes') as string) || null
  const dont_show = formData.get('dont_show') === 'on'

  const { error } = await supabase
    .from('commitment_exceptions')
    .update({ disposition, disposition_notes, dont_show })
    .eq('id', exceptionId)

  if (error) {
    console.error('updateExceptionDisposition failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/curative`)
}

export async function finalizeCommitment(orderId: string, formData: FormData) {
  void formData
  const supabase = await createClient()

  const { error: settingsError } = await supabase.from('curative_settings').upsert(
    {
      order_id: orderId,
      commitment_status: 'final',
      finalized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  )
  if (settingsError) {
    console.error('finalizeCommitment failed:', settingsError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  const { error: orderError } = await supabase.from('orders').update({ title_status: 'Curative' }).eq('id', orderId)
  if (orderError) {
    console.error('finalizeCommitment (order update) failed:', orderError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  revalidatePath(`/orders/${orderId}/curative`)
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function revertToDraft(orderId: string, formData: FormData) {
  void formData
  const supabase = await createClient()

  const { data: settings, error: settingsFetchError } = await supabase
    .from('curative_settings')
    .select('ctc_issued_at')
    .eq('order_id', orderId)
    .maybeSingle()

  if (settingsFetchError) {
    console.error('revertToDraft failed:', settingsFetchError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  if (settings?.ctc_issued_at) {
    fail(orderId, 'Cannot revert to Draft while a Clear to Close has been issued. Rescind the CTC first.')
  }

  const { data: updated, error } = await supabase
    .from('curative_settings')
    .update({ commitment_status: 'draft', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .is('ctc_issued_at', null)
    .select('id')

  if (error) {
    console.error('revertToDraft failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  if (!updated || updated.length === 0) {
    fail(orderId, 'Cannot revert to Draft while a Clear to Close has been issued. Rescind the CTC first.')
  }

  revalidatePath(`/orders/${orderId}/curative`)
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function issueCTC(orderId: string, formData: FormData) {
  void formData
  const supabase = await createClient()

  const { data: requirements, error: reqError } = await supabase
    .from('commitment_requirements')
    .select('disposition, dont_show')
    .eq('order_id', orderId)
  if (reqError) {
    console.error('issueCTC failed:', reqError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  const { data: exceptions, error: excError } = await supabase
    .from('commitment_exceptions')
    .select('disposition, dont_show')
    .eq('order_id', orderId)
  if (excError) {
    console.error('issueCTC failed:', excError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  const allDispositioned = [...(requirements ?? []), ...(exceptions ?? [])].every(
    (r) => r.disposition || r.dont_show
  )

  if (!allDispositioned) {
    fail(orderId, "Every Requirement and Exception must have a Disposition set or Don't Show checked before issuing a CTC.")
  }

  const { data: issued, error: settingsError } = await supabase
    .from('curative_settings')
    .update({ ctc_issued_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('commitment_status', 'final')
    .is('ctc_issued_at', null)
    .select('id')

  if (settingsError) {
    console.error('issueCTC failed:', settingsError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  if (!issued || issued.length === 0) {
    fail(orderId, 'Finalize the commitment before issuing a Clear to Close.')
  }

  const { error: orderError } = await supabase.from('orders').update({ title_status: 'Cleared for Policy' }).eq('id', orderId)
  if (orderError) {
    console.error('issueCTC (order update) failed:', orderError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  revalidatePath(`/orders/${orderId}/curative`)
}

export async function deleteRequirementFromCurative(orderId: string, requirementId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('commitment_requirements').delete().eq('id', requirementId)
  if (error) {
    console.error('deleteRequirementFromCurative failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/curative`)
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function deleteExceptionFromCurative(orderId: string, exceptionId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('commitment_exceptions').delete().eq('id', exceptionId)
  if (error) {
    console.error('deleteExceptionFromCurative failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/curative`)
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function rescindCTC(orderId: string, formData: FormData) {
  void formData
  const supabase = await createClient()

  const { error: settingsError } = await supabase
    .from('curative_settings')
    .update({ ctc_issued_at: null, ctc_rescinded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
  if (settingsError) {
    console.error('rescindCTC failed:', settingsError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  const { error: orderError } = await supabase.from('orders').update({ title_status: 'Curative' }).eq('id', orderId)
  if (orderError) {
    console.error('rescindCTC (order update) failed:', orderError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  revalidatePath(`/orders/${orderId}/curative`)
}
