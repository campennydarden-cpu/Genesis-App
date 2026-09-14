// src/lib/onlyoffice.ts
// Talks to a self-hosted ONLYOFFICE Document Server over its HTTP /docbuilder API.
// Genesis is serverless (Vercel) and can never shell into the Document Server's
// filesystem, so every call passes files by URL, never by local path — confirmed
// against a real Document Server in the Phase 1a spike (spikes/document-assembly/
// SPIKE-RESULTS.md). The docbuilder endpoint requires a *hosted* script URL, not
// inline script text ({"script": "..."} silently fails with error -3) -- so
// runDocBuilderScript uploads the script to Storage first, signs a URL for it,
// then posts that URL.
import { randomUUID } from 'node:crypto'
import { createHmac } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function requireSecret(): string {
  const secret = process.env.ONLYOFFICE_JWT_SECRET
  if (!secret) throw new Error('ONLYOFFICE_JWT_SECRET is not set.')
  return secret
}

function requireServerUrl(): string {
  const url = process.env.ONLYOFFICE_DOCUMENT_SERVER_URL
  if (!url) throw new Error('ONLYOFFICE_DOCUMENT_SERVER_URL is not set.')
  return url.replace(/\/$/, '')
}

// HS256 JWT sign/verify via Node's built-in crypto -- ONLYOFFICE's JWT scheme is
// exactly this (verified against a real Document Server in the spike); adding the
// `jsonwebtoken` package for two dozen lines of HMAC would be a new dependency for
// no real benefit.
export function signOnlyOfficeJwt(payload: object): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerEnc = base64url(JSON.stringify(header))
  const payloadEnc = base64url(JSON.stringify({ payload }))
  const signature = base64url(
    createHmac('sha256', requireSecret()).update(`${headerEnc}.${payloadEnc}`).digest()
  )
  return `${headerEnc}.${payloadEnc}.${signature}`
}

export function verifyOnlyOfficeJwt(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerEnc, payloadEnc, signature] = parts
  const expected = base64url(
    createHmac('sha256', requireSecret()).update(`${headerEnc}.${payloadEnc}`).digest()
  )
  if (expected !== signature) return null
  try {
    const decoded = JSON.parse(Buffer.from(payloadEnc, 'base64').toString('utf8'))
    return decoded.payload ?? null
  } catch {
    return null
  }
}

const SCRIPTS_BUCKET = 'commitment-documents'
const SCRIPTS_PREFIX = '_scripts'

// Uploads scriptText as a temp object, signs a URL for it, POSTs to /docbuilder,
// and deletes the temp object afterward regardless of outcome.
export async function runDocBuilderScript(
  supabase: SupabaseClient,
  scriptText: string
): Promise<Record<string, string>> {
  const scriptPath = `${SCRIPTS_PREFIX}/${randomUUID()}.js`

  const { error: uploadError } = await supabase.storage
    .from(SCRIPTS_BUCKET)
    .upload(scriptPath, new Blob([scriptText], { type: 'application/javascript' }))
  if (uploadError) throw new Error(`Failed to upload docbuilder script: ${uploadError.message}`)

  try {
    const { data: signedUrlData, error: signError } = await supabase.storage
      .from(SCRIPTS_BUCKET)
      .createSignedUrl(scriptPath, 60)
    if (signError || !signedUrlData) throw new Error(`Failed to sign docbuilder script URL: ${signError?.message}`)

    const body = { async: false, url: signedUrlData.signedUrl }
    const token = signOnlyOfficeJwt(body)

    const response = await fetch(`${requireServerUrl()}/docbuilder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, token }),
    })
    const result = (await response.json()) as { error?: number; urls?: Record<string, string> }

    if (result.error) throw new Error(`ONLYOFFICE docbuilder returned error ${result.error}`)
    if (!result.urls) throw new Error('ONLYOFFICE docbuilder returned no output URLs.')
    return result.urls
  } finally {
    await supabase.storage.from(SCRIPTS_BUCKET).remove([scriptPath])
  }
}
