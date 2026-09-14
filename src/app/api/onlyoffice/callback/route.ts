// src/app/api/onlyoffice/callback/route.ts
// ONLYOFFICE's save-callback webhook -- the Document Server POSTs here when a
// user saves inside the embedded editor. This is the app's first real API route
// (everything else is a Server Action): an external service can't invoke a
// Server Action, so this deliberately deviates from that pattern (Global
// Constraints). Must validate the request's JWT -- this endpoint accepts
// externally-triggered writes to Storage, a real security boundary.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyOnlyOfficeJwt } from '@/lib/onlyoffice'

// ONLYOFFICE callback status codes relevant here: 2 = "ready for saving" (a user
// closed the editor after editing), 6 = "being edited, force-saved." Everything
// else (0, 1, 3, 4, 7) does not carry a file to save.
const SAVEABLE_STATUSES = new Set([2, 6])

export async function POST(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('orderId')
  if (!orderId) {
    return NextResponse.json({ error: 1, message: 'Missing orderId' }, { status: 400 })
  }

  const body = (await request.json()) as { status?: number; url?: string; token?: string }

  if (!body.token || !verifyOnlyOfficeJwt(body.token)) {
    return NextResponse.json({ error: 1, message: 'Invalid or missing token' }, { status: 403 })
  }

  if (body.status === undefined || !SAVEABLE_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 0 })
  }

  if (!body.url) {
    return NextResponse.json({ error: 1, message: 'Missing document url' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: commitmentDocument } = await supabase
    .from('commitment_documents')
    .select('storage_path')
    .eq('order_id', orderId)
    .maybeSingle()
  if (!commitmentDocument) {
    return NextResponse.json({ error: 1, message: 'No commitment_documents row for this order' }, { status: 404 })
  }

  const fileResponse = await fetch(body.url)
  if (!fileResponse.ok) {
    return NextResponse.json({ error: 1, message: 'Could not download saved document from ONLYOFFICE' }, { status: 502 })
  }
  const fileBytes = new Uint8Array(await fileResponse.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('commitment-documents')
    .upload(commitmentDocument.storage_path, fileBytes, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    })
  if (uploadError) {
    console.error('ONLYOFFICE callback storage upload failed:', uploadError)
    return NextResponse.json({ error: 1, message: 'Could not save document' }, { status: 500 })
  }

  await supabase
    .from('commitment_documents')
    .update({ updated_at: new Date().toISOString() })
    .eq('order_id', orderId)

  return NextResponse.json({ error: 0 })
}
