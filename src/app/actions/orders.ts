'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ORDER_STATUSES, TITLE_STATUSES, ESCROW_STATUSES, FUNCTIONAL_ROLES } from '@/lib/constants'

export async function createOrder(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

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
  const settlementDate = formData.get('settlement_date') as string
  const settlementTime = formData.get('settlement_time') as string
  const rushOrder = formData.get('rush_order') === 'on'

  const orderFields = {
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
    settlement_date: settlementDate || null,
    settlement_time: settlementTime || null,
    rush_order: rushOrder,
    created_by: user.id,
  }

  // ponytail: count-based sequence has a race window under concurrent creates; move to a Postgres sequence if throughput ever demands it
  const year = new Date().getFullYear()
  const nextFileNumber = async () => {
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .like('file_number', `${year}-%`)
    return `${year}-${String((count ?? 0) + 1).padStart(4, '0')}`
  }

  let { data, error } = await supabase
    .from('orders')
    .insert({ ...orderFields, file_number: await nextFileNumber() })
    .select('id')
    .single()

  if (error?.code === '23505') {
    ;({ data, error } = await supabase
      .from('orders')
      .insert({ ...orderFields, file_number: await nextFileNumber() })
      .select('id')
      .single())
  }

  if (error || !data) {
    console.error('createOrder failed:', error)
    redirect(
      `/orders/new?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath('/orders')
  redirect(`/orders/${data.id}/order-entry`)
}

export async function updateOrderEntry(orderId: string, formData: FormData) {
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
  const settlementDate = formData.get('settlement_date') as string
  const settlementTime = formData.get('settlement_time') as string
  const rushOrder = formData.get('rush_order') === 'on'

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
      settlement_date: settlementDate || null,
      settlement_time: settlementTime || null,
      rush_order: rushOrder,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (error) {
    console.error('updateOrderEntry failed:', error)
    redirect(
      `/orders/${orderId}/order-entry?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  redirect(`/orders/${orderId}/order-entry?saved=1`)
}

export async function updateOrderInfo(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const orderStatus = formData.get('order_status') as string
  const titleStatus = formData.get('title_status') as string
  const escrowStatus = formData.get('escrow_status') as string

  if (
    !ORDER_STATUSES.includes(orderStatus as (typeof ORDER_STATUSES)[number]) ||
    !TITLE_STATUSES.includes(titleStatus as (typeof TITLE_STATUSES)[number]) ||
    !ESCROW_STATUSES.includes(escrowStatus as (typeof ESCROW_STATUSES)[number])
  ) {
    redirect(
      `/orders/${orderId}/order-info?error=${encodeURIComponent('Invalid status value. Please choose from the provided options.')}`
    )
  }

  const { data: existingOrder, error: fetchError } = await supabase
    .from('orders')
    .select('title_status, title_opened_date, escrow_status, escrow_opened_date')
    .eq('id', orderId)
    .single()

  if (fetchError || !existingOrder) {
    console.error('updateOrderInfo failed to load current order:', fetchError)
    redirect(
      `/orders/${orderId}/order-info?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    order_status: orderStatus,
    title_status: titleStatus,
    escrow_status: escrowStatus,
    updated_at: now,
  }

  for (const { key } of FUNCTIONAL_ROLES) {
    update[key] = (formData.get(key) as string) || null
  }

  // Auto-timestamp the first time a status leaves its default "In Progress" state.
  // Never set directly by the user - no form fields for these.
  if (titleStatus !== 'In Progress' && !existingOrder.title_opened_date) {
    update.title_opened_date = now
  }
  if (escrowStatus !== 'In Progress' && !existingOrder.escrow_opened_date) {
    update.escrow_opened_date = now
  }

  const { error } = await supabase.from('orders').update(update).eq('id', orderId)

  if (error) {
    console.error('updateOrderInfo failed:', error)
    redirect(
      `/orders/${orderId}/order-info?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  redirect(`/orders/${orderId}/order-info`)
}
