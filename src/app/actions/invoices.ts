'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { listPremiums, listPremiumSplits } from '@/app/actions/title-premiums'
import { listEndorsements, listEndorsementSplits } from '@/app/actions/endorsements'
import { listCharges, listChargeSplits } from '@/app/actions/additional-title-charges'
import type { Invoice, InvoiceLineItem } from '@/lib/types'

export async function listAllContacts(orderId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contacts').select('id, name').eq('order_id', orderId).order('name')
  return data ?? []
}

export async function listInvoices(orderId: string): Promise<Invoice[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('invoices').select('*').eq('order_id', orderId).order('sort_order')
  return data ?? []
}

export async function listInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order')
  return data ?? []
}

export async function createInvoice(orderId: string): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()

  const [{ data: order }, { count }] = await Promise.all([
    supabase.from('orders').select('file_number').eq('id', orderId).single(),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('order_id', orderId),
  ])

  const sortOrder = (count ?? 0) + 1
  const invoiceNumber = `${order?.file_number ?? orderId}-${sortOrder}`

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      order_id: orderId,
      sort_order: sortOrder,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single()

  if (error) {
    console.error('createInvoice failed:', error)
    return { error: 'Could not create invoice. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/invoices`)
  return { id: data.id }
}

export async function updateInvoice(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invoices')
    .update({
      invoice_number: (formData.get('invoice_number') as string) || '',
      status: (formData.get('status') as string) || 'Pending',
      invoice_date: (formData.get('invoice_date') as string) || null,
      due_date: (formData.get('due_date') as string) || null,
      bill_to_contact_id: (formData.get('bill_to_contact_id') as string) || null,
      remit_to_contact_id: (formData.get('remit_to_contact_id') as string) || null,
      message: (formData.get('message') as string) || null,
    })
    .eq('id', id)

  if (error) {
    console.error('updateInvoice failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/invoices`)
  return {}
}

export async function deleteInvoice(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) {
    console.error('deleteInvoice failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/invoices`)
  return {}
}

type NewLineItem = {
  invoice_id: string
  sort_order: number
  source_table: string
  source_split_id: string
  bill_code: string | null
  description: string | null
  amount: number | null
}

export async function generateInvoiceLineItems(orderId: string, invoiceId: string): Promise<{ error?: string; added?: number }> {
  const supabase = await createClient()

  const { data: existing } = await supabase.from('invoice_line_items').select('source_split_id').not('source_split_id', 'is', null)
  const excluded = new Set((existing ?? []).map((r) => r.source_split_id))

  const { count: existingCount } = await supabase
    .from('invoice_line_items')
    .select('*', { count: 'exact', head: true })
    .eq('invoice_id', invoiceId)
  let sortOrder = existingCount ?? 0

  const rows: NewLineItem[] = []

  const premiums = await listPremiums(orderId)
  for (const p of premiums) {
    const splits = await listPremiumSplits(p.id)
    for (const s of splits) {
      if (!s.bill_code || excluded.has(s.id)) continue
      sortOrder += 1
      rows.push({
        invoice_id: invoiceId,
        sort_order: sortOrder,
        source_table: 'title_insurance_premium_splits',
        source_split_id: s.id,
        bill_code: s.bill_code,
        description: `${p.policy_type ?? 'Policy'}${p.coverage_amount ? ` (Coverage $${p.coverage_amount})` : ''}`,
        amount: s.amount,
      })
    }

    const endorsements = await listEndorsements(p.id)
    for (const e of endorsements) {
      const eSplits = await listEndorsementSplits(e.id)
      for (const s of eSplits) {
        if (!s.bill_code || excluded.has(s.id)) continue
        sortOrder += 1
        rows.push({
          invoice_id: invoiceId,
          sort_order: sortOrder,
          source_table: 'endorsement_splits',
          source_split_id: s.id,
          bill_code: s.bill_code,
          description: e.description || e.code || 'Endorsement',
          amount: s.amount,
        })
      }
    }
  }

  const charges = await listCharges(orderId)
  for (const c of charges) {
    const cSplits = await listChargeSplits(c.id)
    for (const s of cSplits) {
      if (!s.bill_code || excluded.has(s.id)) continue
      sortOrder += 1
      rows.push({
        invoice_id: invoiceId,
        sort_order: sortOrder,
        source_table: 'additional_title_charge_splits',
        source_split_id: s.id,
        bill_code: s.bill_code,
        description: c.description || 'Charge',
        amount: s.amount,
      })
    }
  }

  if (rows.length === 0) return { added: 0 }

  const { error } = await supabase.from('invoice_line_items').insert(rows)
  if (error) {
    console.error('generateInvoiceLineItems failed:', error)
    return { error: 'Could not pull in bill-code lines. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/invoices`)
  return { added: rows.length }
}

export async function addInvoiceLineItem(orderId: string, invoiceId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('invoice_line_items')
    .select('*', { count: 'exact', head: true })
    .eq('invoice_id', invoiceId)

  const { error } = await supabase
    .from('invoice_line_items')
    .insert({ invoice_id: invoiceId, sort_order: (count ?? 0) + 1 })

  if (error) {
    console.error('addInvoiceLineItem failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/invoices`)
  return {}
}

export async function updateInvoiceLineItem(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invoice_line_items')
    .update({
      print_to_invoice: formData.get('print_to_invoice') === 'on',
      bill_code: (formData.get('bill_code') as string) || null,
      description: (formData.get('description') as string) || null,
      amount: formData.get('amount') ? Number(formData.get('amount')) : null,
      taxable: formData.get('taxable') === 'on',
      tax: formData.get('tax') ? Number(formData.get('tax')) : null,
    })
    .eq('id', id)

  if (error) {
    console.error('updateInvoiceLineItem failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}/invoices`)
  return {}
}

export async function deleteInvoiceLineItem(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('invoice_line_items').delete().eq('id', id)
  if (error) {
    console.error('deleteInvoiceLineItem failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  revalidatePath(`/orders/${orderId}/invoices`)
  return {}
}
