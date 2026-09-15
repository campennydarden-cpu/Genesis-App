// src/app/actions/commitment-document-diff.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { runDocBuilderScript } from '@/lib/onlyoffice'

// Mirrors Task 4's TAG_SOURCES tag list (not the value-resolver functions, which
// are merge-only) -- the read-back step only needs to know which tags exist, not
// how they were computed. If Task 4's tag list changes, update this list too;
// a shared constant isn't worth the indirection for one string array reused in
// exactly two places.
const KNOWN_TAGS = [
  'commitment_number',
  'revision_number',
  'date_issued',
  'effective_date',
  'title_held_as',
  'owner_proposed_insured',
  'owner_coverage_amount',
  'loan_proposed_insured',
  'loan_coverage_amount',
  'issuing_agent',
  'issuing_office',
]

function buildReadBackScript(documentUrl: string): string {
  return `
builder.OpenFile("${documentUrl}");
var oDocument = Api.GetDocument();
var aContentControls = oDocument.GetAllContentControls();
var oResult = {};
for (var i = 0; i < aContentControls.length; i++) {
  var oCC = aContentControls[i];
  oResult[oCC.GetTag()] = oCC.GetElement(0).GetText();
}
var oResultDoc = Api.CreateDocument();
oResultDoc.GetElement(0).AddText(JSON.stringify(oResult));
oResultDoc.SaveFile("txt", "readback.txt");
`.trim()
}

export type DivergentField = { tag: string; snapshotValue: string; currentDocValue: string }

export async function getCommitmentDocumentDivergence(orderId: string): Promise<DivergentField[]> {
  const supabase = await createClient()

  const { data: commitmentDocument } = await supabase
    .from('commitment_documents')
    .select('storage_path, last_merged_snapshot')
    .eq('order_id', orderId)
    .maybeSingle()
  if (!commitmentDocument) return []

  const { data: signedUrlData, error: signError } = await supabase.storage
    .from('commitment-documents')
    .createSignedUrl(commitmentDocument.storage_path, 300)
  if (signError || !signedUrlData) return []

  const script = buildReadBackScript(signedUrlData.signedUrl)

  let outputUrls: Record<string, string>
  try {
    outputUrls = await runDocBuilderScript(supabase, script)
  } catch (err) {
    console.error('getCommitmentDocumentDivergence docbuilder call failed:', err)
    return []
  }

  const readbackUrl = outputUrls['readback.txt']
  if (!readbackUrl) return []

  const readbackResponse = await fetch(readbackUrl)
  const currentValues = JSON.parse(await readbackResponse.text()) as Record<string, string>
  const snapshot = (commitmentDocument.last_merged_snapshot ?? {}) as Record<string, string>

  const divergent: DivergentField[] = []
  for (const tag of KNOWN_TAGS) {
    const snapshotValue = snapshot[tag] ?? ''
    const currentDocValue = currentValues[tag] ?? ''
    if (snapshotValue !== currentDocValue) {
      divergent.push({ tag, snapshotValue, currentDocValue })
    }
  }
  return divergent
}
