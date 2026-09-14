// src/app/actions/commitment-document.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { runDocBuilderScript } from '@/lib/onlyoffice'

// One row per tag: which table/column feeds it, and how to read the value from
// the queried records. Kept as a single ordered list so the merge script, the
// snapshot object, and the future diff step (Task 7) all walk the exact same
// tag set -- adding a 12th tag later means adding one entry here, nowhere else.
type TagSource = {
  tag: string
  value: (sch_a: Record<string, unknown>, prelim: Record<string, unknown> | null) => string
}

const TAG_SOURCES: TagSource[] = [
  { tag: 'commitment_number', value: (s) => String(s.commitment_number ?? '') },
  { tag: 'revision_number', value: (s) => String(s.revision_number ?? '') },
  { tag: 'date_issued', value: (s) => String(s.date_issued ?? '') },
  { tag: 'effective_date', value: (_s, p) => String(p?.effective_date ?? '') },
  { tag: 'title_held_as', value: (s) => String(s.title_held_as ?? '') },
  { tag: 'owner_proposed_insured', value: (s) => String(s.owner_proposed_insured ?? '') },
  { tag: 'owner_coverage_amount', value: (s) => String(s.owner_coverage_amount ?? '') },
  { tag: 'loan_proposed_insured', value: (s) => String(s.loan_proposed_insured ?? '') },
  { tag: 'loan_coverage_amount', value: (s) => String(s.loan_coverage_amount ?? '') },
  { tag: 'issuing_agent', value: (s) => String(s.issuing_agent ?? '') },
  { tag: 'issuing_office', value: (s) => String(s.issuing_office ?? '') },
]

function escapeForDocBuilderString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildMergeScript(templateUrl: string, tagValues: Record<string, string>): string {
  const setCalls = Object.entries(tagValues)
    .map(
      ([tag, value]) => `
  for (var i = 0; i < aContentControls.length; i++) {
    if (aContentControls[i].GetTag() === "${escapeForDocBuilderString(tag)}") {
      aContentControls[i].RemoveAllElements();
      var oRun_${tag.replace(/[^a-zA-Z0-9]/g, '_')} = Api.CreateRun();
      oRun_${tag.replace(/[^a-zA-Z0-9]/g, '_')}.AddText("${escapeForDocBuilderString(value)}");
      aContentControls[i].AddElement(oRun_${tag.replace(/[^a-zA-Z0-9]/g, '_')}, 0);
    }
  }`
    )
    .join('\n')

  return `
builder.OpenFile("${templateUrl}");
var oDocument = Api.GetDocument();
var aContentControls = oDocument.GetAllContentControls();
${setCalls}
builder.SaveFile("docx", "merged.docx");
builder.CloseFile();
`.trim()
}

export async function mergeCommitmentDocument(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const [{ data: schA }, { data: prelim }, { data: template }] = await Promise.all([
    supabase.from('commitment_sch_a').select('*').eq('order_id', orderId).maybeSingle(),
    supabase.from('prelim_search').select('effective_date').eq('order_id', orderId).maybeSingle(),
    supabase.from('document_templates').select('id, storage_path').eq('document_type', 'commitment').single(),
  ])

  if (!schA) return { error: 'Commitment Schedule A has not been filled out for this order yet.' }
  if (!template) return { error: 'No commitment template is configured. Run scripts/upload-commitment-template.mjs first.' }

  const { data: templateUrlData, error: templateUrlError } = await supabase.storage
    .from('document-templates')
    .createSignedUrl(template.storage_path, 300)
  if (templateUrlError || !templateUrlData) {
    return { error: 'Could not access the commitment template file.' }
  }

  const tagValues: Record<string, string> = {}
  for (const source of TAG_SOURCES) {
    tagValues[source.tag] = source.value(schA, prelim ?? null)
  }

  const script = buildMergeScript(templateUrlData.signedUrl, tagValues)

  let outputUrls: Record<string, string>
  try {
    outputUrls = await runDocBuilderScript(supabase, script)
  } catch (err) {
    console.error('mergeCommitmentDocument docbuilder call failed:', err)
    return { error: 'Could not merge the commitment document. Please try again.' }
  }

  const mergedUrl = outputUrls['merged.docx']
  if (!mergedUrl) return { error: 'Merge did not produce an output file.' }

  const mergedResponse = await fetch(mergedUrl)
  const mergedBytes = new Uint8Array(await mergedResponse.arrayBuffer())
  const storagePath = `${orderId}/commitment.docx`

  const { error: uploadError } = await supabase.storage
    .from('commitment-documents')
    .upload(storagePath, mergedBytes, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    })
  if (uploadError) {
    console.error('mergeCommitmentDocument storage upload failed:', uploadError)
    return { error: 'Could not save the merged document.' }
  }

  const { data: existing } = await supabase
    .from('commitment_documents')
    .select('revision_number')
    .eq('order_id', orderId)
    .maybeSingle()

  const { error: upsertError } = await supabase.from('commitment_documents').upsert(
    {
      order_id: orderId,
      template_id: template.id,
      storage_path: storagePath,
      last_merged_snapshot: tagValues,
      revision_number: (existing?.revision_number ?? 0) + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  )
  if (upsertError) {
    console.error('mergeCommitmentDocument commitment_documents upsert failed:', upsertError)
    return { error: 'Could not record the merged document.' }
  }

  revalidatePath(`/orders/${orderId}/commitment-document`)
  return {}
}
