'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  ORDER_STATUSES,
  TITLE_STATUSES,
  ESCROW_STATUSES,
  FUNCTIONAL_ROLES,
  PRODUCT_TYPES,
  TRANSACTION_TYPES,
  POLICY_TYPES,
} from '@/lib/constants'
import { copyFolderTemplateForOrder } from '@/app/actions/attachments'
import { copyChecklistTemplateForOrder } from '@/app/actions/checklist-tasks'

export async function createOrder(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const productType = formData.get('product_type') as string
  const transactionType = formData.get('transaction_type') as string
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
    transaction_type: transactionType,
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

  // Race-free: next_file_number() is a single atomic upsert-increment (migration
  // 0041) — Postgres serializes concurrent callers on the same year row, so this
  // can never hand out (or collide on) the same number twice, unlike the prior
  // count(*)+1 approach, which broke permanently the moment any order was deleted
  // and left a gap between count and the real max file_number.
  const year = new Date().getFullYear()
  const { data: fileNumber, error: fileNumberError } = await supabase.rpc('next_file_number', { p_year: year })

  if (fileNumberError) {
    console.error('createOrder failed (file number):', fileNumberError)
    redirect(`/orders/new?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`)
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({ ...orderFields, file_number: fileNumber })
    .select('id')
    .single()

  if (error || !data) {
    console.error('createOrder failed:', error)
    redirect(
      `/orders/new?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  await copyFolderTemplateForOrder(data.id)
  await copyChecklistTemplateForOrder(data.id)

  revalidatePath('/orders')
  redirect(`/orders/${data.id}/order-entry`)
}

export async function saveOrderEntry(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const fileNumber = (formData.get('file_number') as string)?.trim()
  const productType = formData.get('product_type') as string
  const transactionType = formData.get('transaction_type') as string
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

  if (!fileNumber) {
    return { error: 'File Number is required.' }
  }
  if (
    !PRODUCT_TYPES.includes(productType as (typeof PRODUCT_TYPES)[number]) ||
    !TRANSACTION_TYPES.includes(transactionType as (typeof TRANSACTION_TYPES)[number]) ||
    !POLICY_TYPES.includes(policyType as (typeof POLICY_TYPES)[number])
  ) {
    return { error: 'Invalid selection. Please choose from the provided options.' }
  }

  const { error } = await supabase
    .from('orders')
    .update({
      file_number: fileNumber,
      product_type: productType,
      transaction_type: transactionType,
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
    console.error('saveOrderEntry failed:', error)
    return { error: 'Could not save. Please check your entries and try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  return {}
}

export async function saveOrderInfo(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const orderStatus = formData.get('order_status') as string
  const titleStatus = formData.get('title_status') as string
  const escrowStatus = formData.get('escrow_status') as string

  if (
    !ORDER_STATUSES.includes(orderStatus as (typeof ORDER_STATUSES)[number]) ||
    !TITLE_STATUSES.includes(titleStatus as (typeof TITLE_STATUSES)[number]) ||
    !ESCROW_STATUSES.includes(escrowStatus as (typeof ESCROW_STATUSES)[number])
  ) {
    return { error: 'Invalid status value. Please choose from the provided options.' }
  }

  const { data: existingOrder, error: fetchError } = await supabase
    .from('orders')
    .select('title_status, title_opened_date, escrow_status, escrow_opened_date')
    .eq('id', orderId)
    .single()

  if (fetchError || !existingOrder) {
    console.error('saveOrderInfo failed to load current order:', fetchError)
    return { error: 'Could not save. Please check your entries and try again.' }
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

  if (titleStatus !== 'In Progress' && !existingOrder.title_opened_date) {
    update.title_opened_date = now
  }
  if (escrowStatus !== 'In Progress' && !existingOrder.escrow_opened_date) {
    update.escrow_opened_date = now
  }

  const { error } = await supabase.from('orders').update(update).eq('id', orderId)

  if (error) {
    console.error('saveOrderInfo failed:', error)
    return { error: 'Could not save. Please check your entries and try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  return {}
}
