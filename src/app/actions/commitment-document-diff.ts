// src/app/actions/commitment-document-diff.ts
'use server'

import JSZip from 'jszip'
import { createClient } from '@/lib/supabase/server'

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

// ONLYOFFICE's Document Builder /docbuilder API can merge into and overwrite
// Content Controls (proven in Task 4), but this project's own testing found
// Api.CreateDocument() -- needed to emit a JSON summary of read-back values --
// fails unconditionally against this Document Server (error -3, independent of
// any other open document). Rather than force Document Builder into a role it
// doesn't support here, read-back parses the saved .docx's raw OOXML directly:
// a closed set of 11 known tag names makes this a bounded, well-understood
// problem, not general arbitrary-document parsing. This is the exact technique
// already verified by hand throughout this project (unzip + grep the XML).
function unescapeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

async function extractContentControlValues(docxBytes: ArrayBuffer, tags: string[]): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(docxBytes)
  const documentXmlFile = zip.file('word/document.xml')
  if (!documentXmlFile) return {}
  const xml = await documentXmlFile.async('string')

  const values: Record<string, string> = {}
  for (const tag of tags) {
    const tagMatch = new RegExp(`<w:tag w:val="${tag}"\\s*/>`).exec(xml)
    if (!tagMatch) continue

    const afterTag = xml.slice(tagMatch.index)
    const contentStart = afterTag.indexOf('<w:sdtContent')
    if (contentStart === -1) continue
    const contentOpenEnd = afterTag.indexOf('>', contentStart) + 1
    const contentEnd = afterTag.indexOf('</w:sdtContent>', contentOpenEnd)
    if (contentEnd === -1) continue
    const contentXml = afterTag.slice(contentOpenEnd, contentEnd)

    const textMatches = [...contentXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    values[tag] = unescapeXmlEntities(textMatches.map((m) => m[1]).join(''))
  }
  return values
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

  let currentValues: Record<string, string>
  try {
    const fileResponse = await fetch(signedUrlData.signedUrl)
    if (!fileResponse.ok) return []
    const docxBytes = await fileResponse.arrayBuffer()
    currentValues = await extractContentControlValues(docxBytes, KNOWN_TAGS)
  } catch (err) {
    console.error('getCommitmentDocumentDivergence failed to read document content controls:', err)
    return []
  }

  const snapshot = (commitmentDocument.last_merged_snapshot ?? {}) as Record<string, string>

  const divergent: DivergentField[] = []
  for (const tag of KNOWN_TAGS) {
    if (!(tag in currentValues)) continue // tag missing from the document entirely (template defect) -- never treat as "cleared to empty"
    const snapshotValue = snapshot[tag] ?? ''
    const currentDocValue = currentValues[tag]
    if (snapshotValue !== currentDocValue) {
      divergent.push({ tag, snapshotValue, currentDocValue })
    }
  }
  return divergent
}
