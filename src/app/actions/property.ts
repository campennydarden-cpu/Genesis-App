'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function upsertPropertyDetails(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase.from('property_details').upsert(
    {
      order_id: orderId,
      house_number: field('house_number'),
      street_name: field('street_name'),
      street_suffix: field('street_suffix'),
      directional: field('directional'),
      city: field('city'),
      county: field('county'),
      state: field('state'),
      zip: field('zip'),
      section_township_range: field('section_township_range'),
      brief_legal: field('brief_legal'),
      lot: field('lot'),
      block: field('block'),
      subdivision_tract: field('subdivision_tract'),
      use_type: field('use_type'),
      full_legal_description: field('full_legal_description'),
      parcel_number: field('parcel_number'),
      parcel_number_type: field('parcel_number_type'),
      ccrs_dated: field('ccrs_dated'),
      ccrs_book: field('ccrs_book'),
      ccrs_page: field('ccrs_page'),
      ccrs_instrument_number: field('ccrs_instrument_number'),
      ccrs_notes: field('ccrs_notes'),
      plat_survey_reference: field('plat_survey_reference'),
      setback_front: field('setback_front'),
      setback_side: field('setback_side'),
      setback_side_street: field('setback_side_street'),
      setback_rear: field('setback_rear'),
      lot_dimension_frontage: field('lot_dimension_frontage'),
      lot_dimension_depth: field('lot_dimension_depth'),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  )

  if (error) {
    console.error('upsertPropertyDetails failed:', error)
    redirect(
      `/orders/${orderId}/property?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/property`)
  redirect(`/orders/${orderId}/property`)
}

export async function addEasement(propertyId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()

  const type = formData.get('type') as string
  const otherTypeText = formData.get('other_type_text') as string
  const description = formData.get('description') as string

  const { error } = await supabase.from('property_easements').insert({
    property_id: propertyId,
    type,
    other_type_text: type === 'Other' ? otherTypeText || null : null,
    description: description || null,
  })

  if (error) {
    console.error('addEasement failed:', error)
    redirect(
      `/orders/${orderId}/property?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/property`)
}

export async function deleteEasement(orderId: string, easementId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('property_easements').delete().eq('id', easementId)

  if (error) {
    console.error('deleteEasement failed:', error)
    redirect(
      `/orders/${orderId}/property?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/property`)
}
