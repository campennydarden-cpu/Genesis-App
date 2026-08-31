'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RELATED_DOC_ASSIGNMENT_TYPES } from '@/lib/constants'

export async function upsertPrelimSearch(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const field = (name: string) => (formData.get(name) as string) || null
  const consideration = formData.get('derivation_consideration') as string

  const { error } = await supabase.from('prelim_search').upsert(
    {
      order_id: orderId,
      effective_date: field('effective_date'),
      effective_time: field('effective_time'),
      search_from_date: field('search_from_date'),
      search_to_date: field('search_to_date'),
      search_to_time: field('search_to_time'),
      search_type: field('search_type'),
      derivation_instrument_type: field('derivation_instrument_type'),
      derivation_dated_date: field('derivation_dated_date'),
      derivation_recorded_date: field('derivation_recorded_date'),
      derivation_book: field('derivation_book'),
      derivation_page: field('derivation_page'),
      derivation_instrument_number: field('derivation_instrument_number'),
      derivation_consideration: consideration ? Number(consideration) : null,
      derivation_grantee_name: field('derivation_grantee_name'),
      derivation_grantee_entity_type: field('derivation_grantee_entity_type'),
      derivation_grantor_name: field('derivation_grantor_name'),
      derivation_grantor_entity_type: field('derivation_grantor_entity_type'),
      derivation_is_portion: formData.get('derivation_is_portion') === 'on',
      derivation_note: field('derivation_note'),
      taxes_paid_through_year: field('taxes_paid_through_year'),
      taxes_now_due: field('taxes_now_due'),
      taxes_not_yet_due: field('taxes_not_yet_due'),
      special_levies_assessments: field('special_levies_assessments'),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  )

  if (error) {
    console.error('upsertPrelimSearch failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
  redirect(`/orders/${orderId}/prelim-search`)
}

export async function addDerivationPrincipal(
  prelimSearchId: string,
  orderId: string,
  side: 'grantee' | 'grantor',
  formData: FormData
) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const role = (formData.get('role') as string) || null

  const { error } = await supabase.from('derivation_principals').insert({
    prelim_search_id: prelimSearchId,
    side,
    name,
    role,
  })

  if (error) {
    console.error('addDerivationPrincipal failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function updateDerivationPrincipal(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const role = (formData.get('role') as string) || null

  const { error } = await supabase.from('derivation_principals').update({ name, role }).eq('id', id)

  if (error) {
    console.error('updateDerivationPrincipal failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteDerivationPrincipal(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('derivation_principals').delete().eq('id', id)

  if (error) {
    console.error('deleteDerivationPrincipal failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function addSecurityInstrument(prelimSearchId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null
  const originalAmount = formData.get('original_amount') as string

  const { error } = await supabase.from('security_instruments').insert({
    prelim_search_id: prelimSearchId,
    type: field('type'),
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
    original_amount: originalAmount ? Number(originalAmount) : null,
    mortgagor: field('mortgagor'),
    mortgagee: field('mortgagee'),
    trustee: field('trustee'),
  })

  if (error) {
    console.error('addSecurityInstrument failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function updateSecurityInstrument(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null
  const originalAmount = formData.get('original_amount') as string

  const { error } = await supabase
    .from('security_instruments')
    .update({
      type: field('type'),
      dated_date: field('dated_date'),
      recorded_date: field('recorded_date'),
      book: field('book'),
      page: field('page'),
      instrument_number: field('instrument_number'),
      original_amount: originalAmount ? Number(originalAmount) : null,
      mortgagor: field('mortgagor'),
      mortgagee: field('mortgagee'),
      trustee: field('trustee'),
    })
    .eq('id', id)

  if (error) {
    console.error('updateSecurityInstrument failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteSecurityInstrument(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('security_instruments').delete().eq('id', id)

  if (error) {
    console.error('deleteSecurityInstrument failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function addRelatedDoc(securityInstrumentId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null
  const type = field('type')
  const isAssignmentType = (RELATED_DOC_ASSIGNMENT_TYPES as readonly string[]).includes(type ?? '')

  const { error } = await supabase.from('security_instrument_related_docs').insert({
    security_instrument_id: securityInstrumentId,
    type,
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
    assignor: isAssignmentType ? field('assignor') : null,
    assignee: isAssignmentType ? field('assignee') : null,
    notes: field('notes'),
  })

  if (error) {
    console.error('addRelatedDoc failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function updateRelatedDoc(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null
  const type = field('type')
  const isAssignmentType = (RELATED_DOC_ASSIGNMENT_TYPES as readonly string[]).includes(type ?? '')

  const { error } = await supabase
    .from('security_instrument_related_docs')
    .update({
      type,
      dated_date: field('dated_date'),
      recorded_date: field('recorded_date'),
      book: field('book'),
      page: field('page'),
      instrument_number: field('instrument_number'),
      assignor: isAssignmentType ? field('assignor') : null,
      assignee: isAssignmentType ? field('assignee') : null,
      notes: field('notes'),
    })
    .eq('id', id)

  if (error) {
    console.error('updateRelatedDoc failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteRelatedDoc(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('security_instrument_related_docs').delete().eq('id', id)

  if (error) {
    console.error('deleteRelatedDoc failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

function lienFieldsFromFormData(formData: FormData) {
  const field = (name: string) => (formData.get(name) as string) || null
  const amount = formData.get('amount') as string
  return {
    type: field('type'),
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
    amount: amount ? Number(amount) : null,
    debtor: field('debtor'),
    creditor: field('creditor'),
    docket_date: field('docket_date'),
    case_number: field('case_number'),
    court: field('court'),
    taxing_authority: field('taxing_authority'),
    tax_type: field('tax_type'),
    filed_date: field('filed_date'),
    hoa_company: field('hoa_company'),
    materialman: field('materialman'),
    last_service_date: field('last_service_date'),
    plaintiff: field('plaintiff'),
    defendant: field('defendant'),
    certificate_id: field('certificate_id'),
    redemption_expiration: field('redemption_expiration'),
  }
}

export async function addLien(prelimSearchId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('liens').insert({
    prelim_search_id: prelimSearchId,
    ...lienFieldsFromFormData(formData),
  })

  if (error) {
    console.error('addLien failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function updateLien(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('liens').update(lienFieldsFromFormData(formData)).eq('id', id)

  if (error) {
    console.error('updateLien failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteLien(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('liens').delete().eq('id', id)

  if (error) {
    console.error('deleteLien failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function addExceptionMatter(prelimSearchId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase.from('exception_matters').insert({
    prelim_search_id: prelimSearchId,
    description: formData.get('description') as string,
    dated_date: field('dated_date'),
    recorded_date: field('recorded_date'),
    book: field('book'),
    page: field('page'),
    instrument_number: field('instrument_number'),
  })

  if (error) {
    console.error('addExceptionMatter failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function updateExceptionMatter(id: string, orderId: string, formData: FormData) {
  const supabase = await createClient()
  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase
    .from('exception_matters')
    .update({
      description: formData.get('description') as string,
      dated_date: field('dated_date'),
      recorded_date: field('recorded_date'),
      book: field('book'),
      page: field('page'),
      instrument_number: field('instrument_number'),
    })
    .eq('id', id)

  if (error) {
    console.error('updateExceptionMatter failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}

export async function deleteExceptionMatter(orderId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('exception_matters').delete().eq('id', id)

  if (error) {
    console.error('deleteExceptionMatter failed:', error)
    redirect(
      `/orders/${orderId}/prelim-search?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/prelim-search`)
}
