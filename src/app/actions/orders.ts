'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createOrder(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const fileNumber = formData.get('file_number') as string
  const productType = formData.get('product_type') as string
  const policyType = formData.get('policy_type') as string
  const purchasePrice = formData.get('purchase_price') as string
  const loanAmount = formData.get('loan_amount') as string
  const propertyAddress = formData.get('property_address') as string
  const parcelNumber = formData.get('parcel_number') as string
  const propertyCity = formData.get('property_city') as string
  const propertyCounty = formData.get('property_county') as string
  const propertyState = formData.get('property_state') as string
  const propertyZip = formData.get('property_zip') as string

  const { data, error } = await supabase
    .from('orders')
    .insert({
      file_number: fileNumber,
      product_type: productType,
      policy_type: policyType,
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      loan_amount: loanAmount ? Number(loanAmount) : null,
      property_address: propertyAddress || null,
      parcel_number: parcelNumber || null,
      property_city: propertyCity || null,
      property_county: propertyCounty || null,
      property_state: propertyState || null,
      property_zip: propertyZip || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('createOrder failed:', error)
    redirect(
      `/orders/new?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath('/orders')
  redirect(`/orders/${data.id}`)
}

export async function updateOrder(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const fileNumber = formData.get('file_number') as string
  const productType = formData.get('product_type') as string
  const policyType = formData.get('policy_type') as string
  const purchasePrice = formData.get('purchase_price') as string
  const loanAmount = formData.get('loan_amount') as string
  const propertyAddress = formData.get('property_address') as string
  const parcelNumber = formData.get('parcel_number') as string
  const propertyCity = formData.get('property_city') as string
  const propertyCounty = formData.get('property_county') as string
  const propertyState = formData.get('property_state') as string
  const propertyZip = formData.get('property_zip') as string
  const orderStatus = formData.get('order_status') as string
  const titleStatus = formData.get('title_status') as string
  const escrowStatus = formData.get('escrow_status') as string

  const { error } = await supabase
    .from('orders')
    .update({
      file_number: fileNumber,
      product_type: productType,
      policy_type: policyType,
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      loan_amount: loanAmount ? Number(loanAmount) : null,
      property_address: propertyAddress || null,
      parcel_number: parcelNumber || null,
      property_city: propertyCity || null,
      property_county: propertyCounty || null,
      property_state: propertyState || null,
      property_zip: propertyZip || null,
      order_status: orderStatus,
      title_status: titleStatus,
      escrow_status: escrowStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (error) {
    console.error('updateOrder failed:', error)
    redirect(
      `/orders/${orderId}?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}`)
  redirect(`/orders/${orderId}`)
}
