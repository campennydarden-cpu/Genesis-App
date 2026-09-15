'use server'

import { createClient } from '@/lib/supabase/server'
import { runDocBuilderScript } from '@/lib/onlyoffice'

// Reuses the same proven docbuilder mechanism as merge/read-back -- Document
// Builder can save a file it opened as any supported format, including pdf,
// via builder.SaveFile("pdf", ...). This avoids introducing ONLYOFFICE's
// separate Conversion API (a second, untested-by-the-spike integration) for
// something the already-proven mechanism does in one line.
function buildPdfExportScript(documentUrl: string): string {
  return `
builder.OpenFile("${documentUrl}");
builder.SaveFile("pdf", "commitment.pdf");
builder.CloseFile();
`.trim()
}

export async function exportCommitmentDocumentPdf(orderId: string): Promise<{ error?: string; downloadUrl?: string }> {
  const supabase = await createClient()

  const { data: commitmentDocument } = await supabase
    .from('commitment_documents')
    .select('storage_path')
    .eq('order_id', orderId)
    .maybeSingle()
  if (!commitmentDocument) return { error: 'No commitment document has been generated for this order yet.' }

  const { data: signedUrlData, error: signError } = await supabase.storage
    .from('commitment-documents')
    .createSignedUrl(commitmentDocument.storage_path, 300)
  if (signError || !signedUrlData) return { error: 'Could not access the commitment document.' }

  let outputUrls: Record<string, string>
  try {
    outputUrls = await runDocBuilderScript(supabase, buildPdfExportScript(signedUrlData.signedUrl))
  } catch (err) {
    console.error('exportCommitmentDocumentPdf docbuilder call failed:', err)
    return { error: 'Could not export the document as PDF.' }
  }

  const pdfUrl = outputUrls['commitment.pdf']
  if (!pdfUrl) return { error: 'PDF export did not produce an output file.' }

  const pdfResponse = await fetch(pdfUrl)
  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer())
  const pdfStoragePath = `${orderId}/commitment.pdf`

  const { error: uploadError } = await supabase.storage
    .from('commitment-documents')
    .upload(pdfStoragePath, pdfBytes, { contentType: 'application/pdf', upsert: true })
  if (uploadError) {
    console.error('exportCommitmentDocumentPdf storage upload failed:', uploadError)
    return { error: 'Could not save the exported PDF.' }
  }

  await supabase.from('commitment_documents').update({ pdf_storage_path: pdfStoragePath }).eq('order_id', orderId)

  const { data: downloadUrlData } = await supabase.storage
    .from('commitment-documents')
    .createSignedUrl(pdfStoragePath, 300)

  return { downloadUrl: downloadUrlData?.signedUrl }
}
