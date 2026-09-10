'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { RECORDING_STATUSES, CDF_PAGE2_SECTION_E_RECORDING_LINES } from '@/lib/constants'
import type { RecordingDocument } from '@/lib/types'
import { matchRecordingRate } from '@/lib/recording-rates'

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

// Recording Rate-Table Wiring (Cam answered 2026-09-10): base-rate lookup only, auto-filled
// directly into Fee/Recordation Tax/Transfer Tax on document-type/county/page-count change
// (Q5 -- "Auto fill the Fee/Tax field directly"). Never overwrites a field we have no
// confirmed rate for -- Stamp Tax has no corresponding schedule table today and Release/
// Power of Attorney/Affidavit/Other never carry a transfer or recordation tax, so those are
// simply left alone rather than cleared. Returns which fields had no confirmed rate so the
// UI can surface Q4's "No Available Rates" state.
export async function autofillRecordingRates(
  orderId: string,
  id: string
): Promise<{ error?: string; noRateFor?: string[]; updated?: boolean }> {
  const supabase = await createClient()

  const { data: doc } = await supabase.from('recording_documents').select('*').eq('id', id).single()
  if (!doc) return { error: 'Document not found.' }

  const { data: order } = await supabase.from('orders').select('property_state, purchase_price, loan_amount').eq('id', orderId).single()
  if (!order?.property_state) return { noRateFor: [], updated: false }

  const [{ data: feeRows }, { data: transferTaxRows }, { data: recordationTaxRows }] = await Promise.all([
    supabase.from('recording_fee_schedules').select('*').eq('state', order.property_state),
    supabase.from('transfer_tax_schedules').select('*').eq('state', order.property_state),
    supabase.from('recordation_tax_schedules').select('*').eq('state', order.property_state),
  ])

  const match = matchRecordingRate({
    state: order.property_state,
    county: doc.county,
    documentDescription: doc.document_description,
    numberOfPages: doc.number_of_pages,
    purchasePrice: order.purchase_price,
    loanAmount: order.loan_amount,
    feeRows: feeRows ?? [],
    transferTaxRows: transferTaxRows ?? [],
    recordationTaxRows: recordationTaxRows ?? [],
  })

  const update: Record<string, number> = {}
  if (match.feeStatus === 'matched' && match.fee !== null) update.fee = match.fee
  if (match.transferTaxStatus === 'matched' && match.transferTax !== null) update.transferTax = match.transferTax
  if (match.recordationTaxStatus === 'matched' && match.recordationTax !== null) update.recordationTax = match.recordationTax

  if (Object.keys(update).length > 0) {
    await supabase
      .from('recording_documents')
      .update({
        fee: match.feeStatus === 'matched' ? match.fee : doc.fee,
        transfer_tax: match.transferTaxStatus === 'matched' ? match.transferTax : doc.transfer_tax,
        recordation_tax: match.recordationTaxStatus === 'matched' ? match.recordationTax : doc.recordation_tax,
      })
      .eq('id', id)
    await syncRecordingCdfLines(orderId)
    revalidatePath(`/orders/${orderId}/recording`)
  }

  const noRateFor: string[] = []
  if (match.feeStatus === 'no_rate') noRateFor.push('Recording Fee')
  if (match.transferTaxStatus === 'no_rate') noRateFor.push('Transfer Tax')
  if (match.recordationTaxStatus === 'no_rate') noRateFor.push('Recordation Tax')

  return { noRateFor, updated: Object.keys(update).length > 0 }
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
