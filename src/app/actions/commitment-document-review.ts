// src/app/actions/commitment-document-review.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const WRITABLE_TAG_COLUMNS: Record<string, string> = {
  commitment_number: 'commitment_number',
  revision_number: 'revision_number',
  date_issued: 'date_issued',
  title_held_as: 'title_held_as',
  owner_proposed_insured: 'owner_proposed_insured',
  owner_coverage_amount: 'owner_coverage_amount',
  loan_proposed_insured: 'loan_proposed_insured',
  loan_coverage_amount: 'loan_coverage_amount',
  issuing_agent: 'issuing_agent',
  issuing_office: 'issuing_office',
}

export async function resolveCommitmentDocumentField(
  orderId: string,
  tag: string,
  action: 'accept' | 'reject',
  currentDocValue: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (action === 'accept') {
    const column = WRITABLE_TAG_COLUMNS[tag]
    if (!column) {
      return { error: `The "${tag}" field is not editable from this review screen.` }
    }
    const { error: updateError } = await supabase
      .from('commitment_sch_a')
      .update({ [column]: currentDocValue, updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
    if (updateError) {
      console.error('resolveCommitmentDocumentField accept failed:', updateError)
      return { error: 'Could not save the accepted value.' }
    }
  }

  const { data: commitmentDocument } = await supabase
    .from('commitment_documents')
    .select('last_merged_snapshot')
    .eq('order_id', orderId)
    .maybeSingle()
  if (!commitmentDocument) return { error: 'No commitment document found for this order.' }

  const snapshot = { ...(commitmentDocument.last_merged_snapshot as Record<string, string>), [tag]: currentDocValue }
  const { error: snapshotError } = await supabase
    .from('commitment_documents')
    .update({ last_merged_snapshot: snapshot, updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
  if (snapshotError) {
    console.error('resolveCommitmentDocumentField snapshot update failed:', snapshotError)
    return { error: 'Could not update the document snapshot.' }
  }

  revalidatePath(`/orders/${orderId}/commitment-document`)
  return {}
}
