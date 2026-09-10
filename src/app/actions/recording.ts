'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { RECORDING_STATUSES, CDF_PAGE2_SECTION_E_RECORDING_LINES } from '@/lib/constants'
import type { RecordingDocument } from '@/lib/types'

export async function listRecordingDocuments(orderId: string): Promise<RecordingDocument[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('recording_documents').select('*').eq('order_id', orderId).order('sort_order')
  return data ?? []
}

// "I need all the Recording Fees to combine into line 1 of Section E... Same thing with
// Recordation/Transfer Taxes and Stamp Taxes" (Cam, 2026-09-10). Unlike every other CDF
// Page 2 fixed line (Section A/F/G/J), these 3 are computed, not manually entered — they
// re-sum across every Recording document on the order and overwrite the 3 fixed Section E
// lines every time a document is added, edited, or removed, split Borrower/Seller by each
// document's own seller_pay_percent (same split math as assignNextCdfPage2Line).
async function syncRecordingCdfLines(orderId: string) {
  const supabase = await createClient()
  const { data: docs } = await supabase.from('recording_documents').select('*').eq('order_id', orderId)
  const documents = (docs ?? []) as RecordingDocument[]

  function sumCategory(getAmount: (doc: RecordingDocument) => number | null) {
    return documents.reduce(
      (acc, doc) => {
        const amount = getAmount(doc)
        if (!amount) return acc
        const pct = doc.seller_pay_percent ? Math.min(Math.max(doc.seller_pay_percent, 0), 100) / 100 : 0
        const seller = amount * pct
        return { borrower: acc.borrower + (amount - seller), seller: acc.seller + seller }
      },
      { borrower: 0, seller: 0 }
    )
  }

  const categories = [
    { description: CDF_PAGE2_SECTION_E_RECORDING_LINES[0], totals: sumCategory((d) => d.fee) },
    {
      description: CDF_PAGE2_SECTION_E_RECORDING_LINES[1],
      totals: sumCategory((d) => (d.recordation_tax ?? 0) + (d.transfer_tax ?? 0) || null),
    },
    { description: CDF_PAGE2_SECTION_E_RECORDING_LINES[2], totals: sumCategory((d) => d.stamp_tax) },
  ]

  const { data: existingLines } = await supabase
    .from('cdf_page2_lines')
    .select('id, description')
    .eq('order_id', orderId)
    .eq('section', 'E')
    .eq('is_fixed', true)

  for (const [idx, category] of categories.entries()) {
    const existing = existingLines?.find((l) => l.description === category.description)
    const row = {
      order_id: orderId,
      section: 'E',
      sort_order: idx,
      description: category.description,
      is_fixed: true,
      borrower_paid_at_closing: category.totals.borrower || null,
      seller_paid_at_closing: category.totals.seller || null,
    }
    if (existing) {
      await supabase.from('cdf_page2_lines').update(row).eq('id', existing.id)
    } else {
      await supabase.from('cdf_page2_lines').insert(row)
    }
  }

  revalidatePath(`/orders/${orderId}/cdf-page-2`)
}

export async function addRecordingDocument(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('recording_documents')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)

  const { data: order } = await supabase.from('orders').select('property_county').eq('id', orderId).single()

  const { error } = await supabase
    .from('recording_documents')
    .insert({ order_id: orderId, sort_order: (count ?? 0) + 1, county: order?.property_county ?? null })

  if (error) {
    console.error('addRecordingDocument failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  await syncRecordingCdfLines(orderId)
  revalidatePath(`/orders/${orderId}/recording`)
  return {}
}

export async function updateRecordingDocument(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const strOrNull = (key: string) => (formData.get(key) as string) || null

  // Server Actions are directly invocable endpoints, not gated by the React tree that
  // only ever passes one of RECORDING_STATUSES — validate here too, since an arbitrary
  // status string would persist but never match the fixed <select> the UI renders.
  const status = (formData.get('status') as string) || 'Not Submitted'
  if (!(RECORDING_STATUSES as readonly string[]).includes(status)) {
    return { error: 'Invalid status.' }
  }

  const { error } = await supabase
    .from('recording_documents')
    .update({
      document_description: strOrNull('document_description'),
      county: strOrNull('county'),
      status,
      date_submitted: strOrNull('date_submitted'),
      date_recorded: strOrNull('date_recorded'),
      instrument_number: strOrNull('instrument_number'),
      book: strOrNull('book'),
      page: strOrNull('page'),
      number_of_pages: formData.get('number_of_pages') ? Number(formData.get('number_of_pages')) : null,
      e_recording_reference: strOrNull('e_recording_reference'),
      fee: formData.get('fee') ? Number(formData.get('fee')) : null,
      recordation_tax: formData.get('recordation_tax') ? Number(formData.get('recordation_tax')) : null,
      transfer_tax: formData.get('transfer_tax') ? Number(formData.get('transfer_tax')) : null,
      stamp_tax: formData.get('stamp_tax') ? Number(formData.get('stamp_tax')) : null,
      seller_pay_percent: formData.get('seller_pay_percent') ? Number(formData.get('seller_pay_percent')) : null,
    })
    .eq('id', id)

  if (error) {
    console.error('updateRecordingDocument failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  await syncRecordingCdfLines(orderId)
  revalidatePath(`/orders/${orderId}/recording`)
  return {}
}

export async function deleteRecordingDocument(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('recording_documents').delete().eq('id', id)
  if (error) {
    console.error('deleteRecordingDocument failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }
  await syncRecordingCdfLines(orderId)
  revalidatePath(`/orders/${orderId}/recording`)
  return {}
}
