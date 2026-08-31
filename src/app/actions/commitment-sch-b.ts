'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { siRequirementText, relRequirementText, lienRequirementText, emExceptionText } from '@/lib/commitment-text'

function fail(orderId: string, message: string): never {
  redirect(`/orders/${orderId}/commitment-sch-b?error=${encodeURIComponent(message)}`)
}

export async function addRequirementFromChip(
  orderId: string,
  sourceType: 'si' | 'rel' | 'lien',
  sourceId: string,
  parentRequirementId: string | null,
  formData: FormData
) {
  void formData
  const supabase = await createClient()
  let description = ''

  if (sourceType === 'si') {
    const { data: si } = await supabase.from('security_instruments').select('*').eq('id', sourceId).single()
    if (si) description = siRequirementText(si)
  } else if (sourceType === 'rel') {
    const { data: rel } = await supabase.from('security_instrument_related_docs').select('*').eq('id', sourceId).single()
    if (rel) {
      const { data: si } = await supabase.from('security_instruments').select('*').eq('id', rel.security_instrument_id).single()
      if (si) description = relRequirementText(rel, si)
    }
  } else if (sourceType === 'lien') {
    const { data: lien } = await supabase.from('liens').select('*').eq('id', sourceId).single()
    if (lien) description = lienRequirementText(lien)
  }

  if (!description) fail(orderId, 'Could not generate requirement text from that source.')

  const { error } = await supabase.from('commitment_requirements').insert({
    order_id: orderId,
    description,
    source_type: sourceType,
    source_id: sourceId,
    parent_requirement_id: parentRequirementId,
  })

  if (error) {
    console.error('addRequirementFromChip failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function addRequirementManual(orderId: string, formData: FormData) {
  const supabase = await createClient()
  const description = formData.get('description') as string
  const notes = (formData.get('notes') as string) || null

  const { error } = await supabase.from('commitment_requirements').insert({
    order_id: orderId,
    description,
    notes,
    source_type: null,
    source_id: null,
    parent_requirement_id: null,
  })

  if (error) {
    console.error('addRequirementManual failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function updateRequirement(orderId: string, requirementId: string, formData: FormData) {
  const supabase = await createClient()
  const description = formData.get('description') as string
  const notes = (formData.get('notes') as string) || null

  const { error } = await supabase.from('commitment_requirements').update({ description, notes }).eq('id', requirementId)

  if (error) {
    console.error('updateRequirement failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function deleteRequirement(orderId: string, requirementId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('commitment_requirements').delete().eq('id', requirementId)

  if (error) {
    console.error('deleteRequirement failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function addExceptionFromChip(orderId: string, sourceId: string, formData: FormData) {
  void formData
  const supabase = await createClient()
  const { data: em } = await supabase.from('exception_matters').select('*').eq('id', sourceId).single()

  if (!em) fail(orderId, 'Could not generate exception text from that source.')

  const description = emExceptionText(em)
  const { error } = await supabase.from('commitment_exceptions').insert({
    order_id: orderId,
    description,
    source_type: 'em',
    source_id: sourceId,
  })

  if (error) {
    console.error('addExceptionFromChip failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function addExceptionManual(orderId: string, formData: FormData) {
  const supabase = await createClient()
  const description = formData.get('description') as string
  const notes = (formData.get('notes') as string) || null

  const { error } = await supabase.from('commitment_exceptions').insert({
    order_id: orderId,
    description,
    notes,
    source_type: null,
    source_id: null,
  })

  if (error) {
    console.error('addExceptionManual failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function updateException(orderId: string, exceptionId: string, formData: FormData) {
  const supabase = await createClient()
  const description = formData.get('description') as string
  const notes = (formData.get('notes') as string) || null

  const { error } = await supabase.from('commitment_exceptions').update({ description, notes }).eq('id', exceptionId)

  if (error) {
    console.error('updateException failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function deleteException(orderId: string, exceptionId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('commitment_exceptions').delete().eq('id', exceptionId)

  if (error) {
    console.error('deleteException failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function upsertSchBSettings(orderId: string, formData: FormData) {
  const supabase = await createClient()
  const beginReq = formData.get('begin_requirements_at') as string
  const beginExc = formData.get('begin_exceptions_at') as string

  const { error } = await supabase.from('commitment_sch_b_settings').upsert(
    {
      order_id: orderId,
      begin_requirements_at: beginReq ? Number(beginReq) : null,
      begin_exceptions_at: beginExc ? Number(beginExc) : 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  )

  if (error) {
    console.error('upsertSchBSettings failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
  redirect(`/orders/${orderId}/commitment-sch-b`)
}
