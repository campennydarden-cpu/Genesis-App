# Document Assembly Engine (Phase 1a: Commitment Schedule A Header Fields) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working slice of the Document Assembly Engine — a self-hosted ONLYOFFICE-backed pipeline that merges Commitment Schedule A's header fields into a tagged Word template, lets staff review/edit it inside Genesis via an embedded editor, detects hand-edits against the database, and exports a PDF.

**Architecture:** A self-hosted ONLYOFFICE Document Server (Docker locally, DigitalOcean Marketplace app in production) holds no data of its own — Genesis calls its HTTP `/docbuilder` API (JWT-signed) to create, merge, and read back Word Content Controls in `.docx` files that live in Supabase Storage. Genesis never shells into the Document Server; every call passes files by signed URL, matching how a serverless Next.js app on Vercel must talk to a separate persistent service. The merged document is edited by staff inside Genesis via ONLYOFFICE's embedded editor iframe; on save, the Document Server POSTs the updated file to a new Genesis API route (the app's first, since ONLYOFFICE can't call a Server Action). A second `/docbuilder` call reads the saved document's Content Controls back out and diffs them against a snapshot taken at the last merge, surfacing only genuinely hand-edited fields for per-field accept/reject.

**Tech Stack:** Next.js 16 / React 19 App Router, Supabase (Postgres + Storage) via `@supabase/ssr` and `@supabase/supabase-js`, self-hosted ONLYOFFICE Document Server (Community Edition, `onlyoffice/documentserver` Docker image), Node's built-in `crypto` for JWT signing/verification (no new JWT dependency — see Task 2), Playwright for what's actually assertable in E2E.

**Spec:** `genesis-app/docs/superpowers/specs/2026-09-10-document-assembly-engine-design.md`, mirrored at `M&L Title - Obsidian Vault/Genesis Rebuild - Document Assembly Engine Design.md`. Spike results (the architecture facts this plan is built from) at `genesis-app/spikes/document-assembly/SPIKE-RESULTS.md`.

## Global Constraints

- **RLS on every new table is the blanket `for all to authenticated using (true) with check (true)` pattern** used by all 58 existing migrations — no new access-control model invented here (tracked separately in `Security Concerns.md`).
- **Migration numbering continues from `0058` (the current latest) → `0059`.**
- **No unit-test runner exists in this codebase** (only `@playwright/test`). Matching the project's established rhythm (see the Attachments Core plan's own Global Constraints), each task verifies with `npm run build` (TypeScript compiles) and, for schema tasks, a direct SQL check via the Supabase MCP (`apply_migration` / `execute_sql`). Tasks that call the real Document Server are verified with a manual one-off script run against the local Docker container (matching the spike's own `.docbuilder` scripts) — there is no CI-reachable ONLYOFFICE instance, and standing one up in CI is an ops decision for Cam, not assumed here.
- **This plan's first API route.** Every existing feature in this codebase is a Server Action; ONLYOFFICE's save callback is an external service POSTing a webhook, which cannot invoke a Server Action (no CSRF token, no same-origin form encoding). Task 6 is a deliberate, called-out deviation: a real `route.ts` under `src/app/api/`.
- **Proven-correct ONLYOFFICE API surface (from the spike — do not deviate):**
  - Create a Content Control: `Api.CreateInlineLvlSdt()`, `.SetTag(tag)`, `.AddElement(oRun, 0)` with `Api.CreateRun().AddText(value)`, then `oParagraph.AddElement(oInlineSdt)`.
  - Find + overwrite one: `oDocument.GetAllContentControls()` → `.GetTag()` to identify → `.RemoveAllElements()` then `.AddElement(oRun, 0)` with a fresh run to overwrite.
  - Read one back: `oCC.GetElement(0).GetText()` — **not** `.GetText()` or `.GetContent()` directly; both throw.
  - The HTTP API (`POST {server}/docbuilder`) takes `{"async": false, "url": "<hosted .js script>", "token": "<jwt>"}` — **inline `"script"` text is not a real field** and silently fails with `{"error":-3}`. The script itself must be hosted at a fetchable URL; `builder.OpenFile(url)` accepts a remote URL directly.
  - JWT: HS256, header `{"alg":"HS256","typ":"JWT"}`, payload `{"payload": <request body minus token>}`, signed with the Document Server's configured secret.
- **Explicitly out of scope for this plan** (fast-follow, not forgotten): Commitment Requirements/Exceptions dynamic-length list merging. The spike proved single-value Content Control round trips; a variable-length list (arbitrary row count per order) needs either Word's native Repeating Section Content Control (unverified — ONLYOFFICE's scripting support for it wasn't tested) or programmatic per-row Content Control generation at merge time (plausible given the proven `CreateInlineLvlSdt`/loop pattern, but the exact paragraph-insertion-at-a-specific-document-location API needed for it was not exercised by the spike). Writing that task now would mean inventing unverified API calls, which this plan's own no-placeholder rule forbids — it needs its own short spike first, tracked as follow-up work, not a task below. Also out of scope: reuse for Deed/Security Instrument/Affidavits/POA/Notary Ack (per spec); DigitalOcean production hosting, nginx/Let's Encrypt, and JWT secret rotation (ops work, not application code — tracked as a deployment checklist, not a coding task).

---

### Task 1: Schema — `document_templates`, `commitment_documents`, two Storage buckets

**Files:**
- Create: `supabase/migrations/0059_document_assembly_engine.sql`

**Interfaces:**
- Produces: tables `public.document_templates(id, document_type, storage_path, created_at)`, `public.commitment_documents(id, order_id, template_id, storage_path, last_merged_snapshot, pdf_storage_path, revision_number, created_at, updated_at)`; Storage buckets `document-templates` (private) and `commitment-documents` (private, also holds temp docbuilder script uploads under a `_scripts/` prefix and PDFs under a `pdf/` prefix).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0059_document_assembly_engine.sql
-- Document Assembly Engine, Phase 1a (Genesis Rebuild - Document Assembly Engine
-- Design.md): one template per document type (just 'commitment' for now), one
-- merged-document instance per order, tracking the last-merged snapshot of each
-- Content Control's value so the read-back step can tell "hand-edited" from
-- "nothing changed." Storage buckets for the template file and the per-order
-- merged .docx/PDF/temp docbuilder scripts, matching the Attachments bucket pattern.

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  document_type text not null unique check (document_type in ('commitment')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table public.commitment_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  template_id uuid not null references public.document_templates(id),
  storage_path text not null,
  last_merged_snapshot jsonb not null default '{}'::jsonb,
  pdf_storage_path text,
  revision_number integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index commitment_documents_order_id_idx on public.commitment_documents(order_id);

alter table public.document_templates enable row level security;
alter table public.commitment_documents enable row level security;

create policy "Authenticated M&L staff can do anything with document_templates"
  on public.document_templates for all to authenticated using (true) with check (true);
create policy "Authenticated M&L staff can do anything with commitment_documents"
  on public.commitment_documents for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values
  ('document-templates', 'document-templates', false),
  ('commitment-documents', 'commitment-documents', false);

create policy "Authenticated M&L staff can do anything with document-templates bucket objects"
  on storage.objects for all to authenticated
  using (bucket_id = 'document-templates')
  with check (bucket_id = 'document-templates');

create policy "Authenticated M&L staff can do anything with commitment-documents bucket objects"
  on storage.objects for all to authenticated
  using (bucket_id = 'commitment-documents')
  with check (bucket_id = 'commitment-documents');
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Run: `mcp__supabase__apply_migration` with `name: "document_assembly_engine"` and the SQL above (or `npx supabase migration up` if working against a local Supabase instance).

- [ ] **Step 3: Verify the schema landed**

Run via `mcp__supabase__execute_sql`:
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('document_templates', 'commitment_documents');

select id, name, public from storage.buckets
where id in ('document-templates', 'commitment-documents');
```
Expected: both tables listed, both buckets listed with `public = false`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0059_document_assembly_engine.sql
git commit -m "feat: add document_templates and commitment_documents schema"
```

---

### Task 2: ONLYOFFICE client library

**Files:**
- Create: `src/lib/onlyoffice.ts`
- Modify: none (new env vars documented in Step 1, no `.env.example` file exists in this repo to update)

**Interfaces:**
- Consumes: `ONLYOFFICE_DOCUMENT_SERVER_URL`, `ONLYOFFICE_JWT_SECRET` env vars; a Supabase server client (from `@/lib/supabase/server` for request-scoped callers, or a service-role `@supabase/supabase-js` client for the Task 3 script).
- Produces: `signOnlyOfficeJwt(payload: object): string`, `verifyOnlyOfficeJwt(token: string): unknown | null`, `runDocBuilderScript(supabase: SupabaseClient, scriptText: string): Promise<Record<string, string>>` (returns the `urls` map from a successful response, throws on `{error: N}`).

- [ ] **Step 1: Write the client**

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Set local dev env vars**

Add to `.env.local` (not committed):
```
ONLYOFFICE_DOCUMENT_SERVER_URL=http://localhost:8082
ONLYOFFICE_JWT_SECRET=<the local container's secret — see spikes/document-assembly/SPIKE-RESULTS.md for how to read it out of local.json, or set your own via the container's JWT_SECRET env var on next run>
```

- [ ] **Step 4: Manual verification against the local Document Server**

Since there's no unit-test runner and CI has no ONLYOFFICE instance, verify this by hand once, the same way the spike did — write a throwaway script that calls `runDocBuilderScript` with a minimal create-and-save script, using a real Supabase client, and confirm it returns a `urls` map with no thrown error. Delete the throwaway script after confirming (it's not part of the plan's deliverable, just a manual check).

- [ ] **Step 5: Commit**

```bash
git add src/lib/onlyoffice.ts
git commit -m "feat: add ONLYOFFICE Document Builder HTTP client with JWT signing"
```

---

### Task 3: Commitment template upload script + seed row

**Files:**
- Create: `scripts/upload-commitment-template.mjs`

**Interfaces:**
- Consumes: a local `.docx` file path (CLI argument), `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` env vars.
- Produces: one row in `document_templates` with `document_type = 'commitment'`, one object in the `document-templates` bucket.

**Content Control tags this template must contain** (author the `.docx` in Word or LibreOffice with Developer-mode Content Controls, one per row below — this is a one-time manual authoring step, not code):

| Tag | Source |
|---|---|
| `commitment_number` | `commitment_sch_a.commitment_number` |
| `revision_number` | `commitment_sch_a.revision_number` |
| `date_issued` | `commitment_sch_a.date_issued` |
| `effective_date` | `prelim_search.effective_date` |
| `title_held_as` | `commitment_sch_a.title_held_as` |
| `owner_proposed_insured` | `commitment_sch_a.owner_proposed_insured` |
| `owner_coverage_amount` | `commitment_sch_a.owner_coverage_amount` |
| `loan_proposed_insured` | `commitment_sch_a.loan_proposed_insured` |
| `loan_coverage_amount` | `commitment_sch_a.loan_coverage_amount` |
| `issuing_agent` | `commitment_sch_a.issuing_agent` |
| `issuing_office` | `commitment_sch_a.issuing_office` |

- [ ] **Step 1: Write the upload script**

```javascript
// scripts/upload-commitment-template.mjs
// One-time upload of the Commitment template .docx into Storage and its
// document_templates row. Run manually after authoring the template with the
// 11 tagged Content Controls listed in the Phase 1a plan:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/upload-commitment-template.mjs /path/to/commitment-template.docx
//
// Uses the service-role key (bypasses RLS), matching scripts/import-zip-lookup.mjs's
// established pattern for one-off admin/operator scripts in this codebase.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node scripts/upload-commitment-template.mjs <path-to-template.docx>')
  process.exit(1)
}

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)
const fileBytes = readFileSync(filePath)
const storagePath = 'commitment/template.docx'

const { error: uploadError } = await supabase.storage
  .from('document-templates')
  .upload(storagePath, fileBytes, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    upsert: true,
  })
if (uploadError) {
  console.error('Upload failed:', uploadError.message)
  process.exit(1)
}

const { error: upsertError } = await supabase
  .from('document_templates')
  .upsert({ document_type: 'commitment', storage_path: storagePath }, { onConflict: 'document_type' })
if (upsertError) {
  console.error('document_templates upsert failed:', upsertError.message)
  process.exit(1)
}

console.log(`Uploaded ${filePath} -> document-templates/${storagePath}, document_templates row upserted.`)
```

- [ ] **Step 2: Run it against a real template file**

Run: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-commitment-template.mjs ./commitment-template.docx`
Expected: prints the success line above with no error.

- [ ] **Step 3: Verify via Supabase MCP**

Run via `mcp__supabase__execute_sql`:
```sql
select document_type, storage_path from public.document_templates where document_type = 'commitment';
```
Expected: one row, `storage_path = 'commitment/template.docx'`.

- [ ] **Step 4: Commit**

```bash
git add scripts/upload-commitment-template.mjs
git commit -m "feat: add commitment template upload script"
```

---

### Task 4: Merge server action

**Files:**
- Create: `src/app/actions/commitment-document.ts`

**Interfaces:**
- Consumes: `runDocBuilderScript`, `signOnlyOfficeJwt` from `src/lib/onlyoffice.ts` (Task 2); `commitment_sch_a`, `prelim_search`, `document_templates`, `commitment_documents` tables (Task 1).
- Produces: `mergeCommitmentDocument(orderId: string): Promise<{ error?: string }>` — later tasks (5, 7) call this by name.

- [ ] **Step 1: Write the merge action**

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Manual verification against the local Document Server**

With the local ONLYOFFICE container running and a template uploaded (Task 3) and a real `commitment_sch_a` row for a test order, call `mergeCommitmentDocument(testOrderId)` from a throwaway script or a temporary button, and confirm: no error returned, a `commitment_documents` row exists with `revision_number = 1`, and downloading the object at its `storage_path` shows the tagged values filled in (same XML-grep technique as the spike).

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/commitment-document.ts
git commit -m "feat: add commitment document merge server action"
```

---

### Task 5: Commitment Document page + embedded editor component

**Files:**
- Create: `src/app/orders/[id]/commitment-document/page.tsx`
- Create: `src/components/commitment-document/CommitmentDocumentEditor.tsx`

**Interfaces:**
- Consumes: `mergeCommitmentDocument` (Task 4); `signOnlyOfficeJwt` (Task 2); `commitment_documents` table.
- Produces: the `/orders/[id]/commitment-document` route; `CommitmentDocumentEditor` client component, reused as-is by Task 8's review screen (same page).

- [ ] **Step 1: Write the page**

```typescript
// src/app/orders/[id]/commitment-document/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CommitmentDocumentEditor } from '@/components/commitment-document/CommitmentDocumentEditor'

export default async function CommitmentDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id').eq('id', id).single()
  if (!order) notFound()

  const { data: commitmentDocument } = await supabase
    .from('commitment_documents')
    .select('storage_path, revision_number, updated_at')
    .eq('order_id', id)
    .maybeSingle()

  let editorUrl: string | null = null
  if (commitmentDocument) {
    const { data: signedUrlData } = await supabase.storage
      .from('commitment-documents')
      .createSignedUrl(commitmentDocument.storage_path, 3600)
    editorUrl = signedUrlData?.signedUrl ?? null
  }

  return (
    <div>
      <CommitmentDocumentEditor
        orderId={id}
        editorUrl={editorUrl}
        revisionNumber={commitmentDocument?.revision_number ?? null}
        documentServerUrl={process.env.NEXT_PUBLIC_ONLYOFFICE_DOCUMENT_SERVER_URL ?? ''}
      />
    </div>
  )
}
```

- [ ] **Step 2: Write the editor component**

```typescript
// src/components/commitment-document/CommitmentDocumentEditor.tsx
'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { mergeCommitmentDocument } from '@/app/actions/commitment-document'

declare global {
  interface Window {
    DocsAPI?: { DocEditor: new (elementId: string, config: object) => { destroyEditor: () => void } }
  }
}

export function CommitmentDocumentEditor({
  orderId,
  editorUrl,
  revisionNumber,
  documentServerUrl,
}: {
  orderId: string
  editorUrl: string | null
  revisionNumber: number | null
  documentServerUrl: string
}) {
  const [isMerging, startMerge] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const editorInstanceRef = useRef<{ destroyEditor: () => void } | null>(null)

  useEffect(() => {
    if (!editorUrl || !documentServerUrl) return

    const script = document.createElement('script')
    script.src = `${documentServerUrl}/web-apps/apps/api/documents/api.js`
    script.onload = () => {
      if (!window.DocsAPI) return
      // Config JWT signing happens server-side in a real deployment (this config
      // object would be built by a server action and passed down); left as a
      // documented follow-up wiring step here since it needs the JWT secret,
      // which must never reach the client bundle. See Global Constraints.
      editorInstanceRef.current = new window.DocsAPI.DocEditor('onlyoffice-editor-container', {
        document: {
          fileType: 'docx',
          key: `${orderId}-rev-${revisionNumber ?? 0}`,
          title: 'Commitment.docx',
          url: editorUrl,
        },
        editorConfig: {
          callbackUrl: `${window.location.origin}/api/onlyoffice/callback?orderId=${orderId}`,
        },
      })
    }
    document.body.appendChild(script)

    return () => {
      editorInstanceRef.current?.destroyEditor()
      document.body.removeChild(script)
    }
  }, [editorUrl, documentServerUrl, orderId, revisionNumber])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Commitment Document</h1>
        <button
          type="button"
          disabled={isMerging}
          onClick={() =>
            startMerge(async () => {
              setError(null)
              const result = await mergeCommitmentDocument(orderId)
              if (result.error) setError(result.error)
            })
          }
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isMerging ? 'Merging…' : editorUrl ? 'Refresh from current data' : 'Generate document'}
        </button>
      </div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {editorUrl ? (
        <div id="onlyoffice-editor-container" style={{ height: '80vh' }} />
      ) : (
        <p className="text-sm text-gray-500">No document has been generated yet. Click &quot;Generate document&quot; to merge current order data into the Commitment template.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 4: Manual verification in the browser**

With the local Document Server running and `NEXT_PUBLIC_ONLYOFFICE_DOCUMENT_SERVER_URL=http://localhost:8082` set, `npm run dev`, navigate to `/orders/<test-order-id>/commitment-document`, click "Generate document," and confirm the ONLYOFFICE embedded editor loads and shows the merged content. This part is not Playwright-assertable (see Task 10) — it's a manual check.

- [ ] **Step 5: Commit**

```bash
git add "src/app/orders/[id]/commitment-document/page.tsx" src/components/commitment-document/CommitmentDocumentEditor.tsx
git commit -m "feat: add Commitment Document page with embedded ONLYOFFICE editor"
```

---

### Task 6: Save-callback API route

**Files:**
- Create: `src/app/api/onlyoffice/callback/route.ts`

**Interfaces:**
- Consumes: `verifyOnlyOfficeJwt` (Task 2); `commitment_documents` table.
- Produces: `POST /api/onlyoffice/callback?orderId=<id>` — ONLYOFFICE's documented save-callback contract (must respond `{"error": 0}` on success).

- [ ] **Step 1: Write the route**

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Manual verification with curl**

With `npm run dev` running and a `commitment_documents` row for a test order already created (Task 4), simulate a callback using the same JWT-signing technique from `spikes/document-assembly/SPIKE-RESULTS.md`'s addendum: sign `{status: 2, url: "<any small test docx URL>"}`, then `curl -X POST "http://localhost:3000/api/onlyoffice/callback?orderId=<test-order-id>" -d '<signed body>'`.
Expected: `{"error":0}` response, and the `commitment-documents` bucket object at that order's `storage_path` is updated to the test file's bytes.

- [ ] **Step 4: Verify JWT rejection**

Run the same curl without a valid `token` field.
Expected: HTTP 403, `{"error":1,...}` — confirms the endpoint actually rejects unsigned requests rather than trusting any POST body.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/onlyoffice/callback/route.ts
git commit -m "feat: add ONLYOFFICE save-callback API route with JWT verification"
```

---

### Task 7: Read-back / diff server action

**Files:**
- Create: `src/app/actions/commitment-document-diff.ts`

**Interfaces:**
- Consumes: `runDocBuilderScript` (Task 2); `commitment_documents.last_merged_snapshot` (Task 1); the same tag list as Task 4's `TAG_SOURCES` (re-declared here rather than imported, since Task 4's list is server-action-local — see Step 1's comment).
- Produces: `getCommitmentDocumentDivergence(orderId: string): Promise<{ tag: string; snapshotValue: string; currentDocValue: string }[]>` — consumed by Task 8's review screen.

- [ ] **Step 1: Write the diff action**

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Manual verification against the local Document Server**

Merge a test order's document (Task 4), then use the local ONLYOFFICE editor (or a throwaway docbuilder script, same technique as the spike's `02-merge.docbuilder`) to change one tagged value directly in the saved `.docx`, saving it back to the same storage path (simulating what the save-callback in Task 6 would do). Call `getCommitmentDocumentDivergence(testOrderId)` and confirm exactly one entry comes back, with the correct `snapshotValue`/`currentDocValue` pair — and confirm untouched tags produce zero entries.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/commitment-document-diff.ts
git commit -m "feat: add commitment document read-back/divergence server action"
```

---

### Task 8: Review screen (per-field accept/reject)

**Files:**
- Create: `src/components/commitment-document/CommitmentDocumentReview.tsx`
- Create: `src/app/actions/commitment-document-review.ts`
- Modify: `src/app/orders/[id]/commitment-document/page.tsx` (render the review panel when divergence exists)

**Interfaces:**
- Consumes: `getCommitmentDocumentDivergence`, `DivergentField` (Task 7).
- Produces: `resolveCommitmentDocumentField(orderId: string, tag: string, action: 'accept' | 'reject', currentDocValue: string): Promise<{ error?: string }>`.

**Semantics (per spec: never silent overwrite, never all-or-nothing):** "Accept" means the hand-edited document value is correct — it gets written back into the underlying `commitment_sch_a` column that tag came from, and the snapshot for that tag updates to match (so it stops showing as diverged). "Reject" means the hand-edit was a mistake — the database is left untouched, but the snapshot still updates to match the current document value, because the alternative (leaving the snapshot stale) would just re-report the same "divergence" forever with no way to dismiss it; the next merge will overwrite the document's value back to the real database value regardless. `effective_date` (sourced from `prelim_search`, not `commitment_sch_a`) is deliberately not in the writable map below — Cam's process treats it as upstream-owned, set once from the search, matching how the Commitment Schedule A page itself only ever displays it, never edits it.

- [ ] **Step 1: Write the resolve action**

```typescript
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
```

- [ ] **Step 2: Write the review component**

```typescript
// src/components/commitment-document/CommitmentDocumentReview.tsx
'use client'

import { useTransition } from 'react'
import { resolveCommitmentDocumentField } from '@/app/actions/commitment-document-review'
import type { DivergentField } from '@/app/actions/commitment-document-diff'

export function CommitmentDocumentReview({ orderId, divergentFields }: { orderId: string; divergentFields: DivergentField[] }) {
  const [isPending, startTransition] = useTransition()

  if (divergentFields.length === 0) return null

  return (
    <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-4">
      <h2 className="mb-2 text-sm font-semibold text-amber-900">
        {divergentFields.length} field{divergentFields.length === 1 ? '' : 's'} changed inside the document
      </h2>
      <ul className="space-y-2">
        {divergentFields.map((field) => (
          <li key={field.tag} className="flex items-center justify-between gap-4 rounded bg-white p-2 text-sm">
            <div>
              <div className="font-medium">{field.tag}</div>
              <div className="text-gray-500">
                Database: <span className="line-through">{field.snapshotValue || '(empty)'}</span> → Document: {field.currentDocValue || '(empty)'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(() => resolveCommitmentDocumentField(orderId, field.tag, 'accept', field.currentDocValue))
                }
                className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(() => resolveCommitmentDocumentField(orderId, field.tag, 'reject', field.currentDocValue))
                }
                className="rounded bg-gray-300 px-3 py-1 text-xs font-medium text-gray-800 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Wire the review panel into the page**

Modify `src/app/orders/[id]/commitment-document/page.tsx`: add imports
```typescript
import { getCommitmentDocumentDivergence } from '@/app/actions/commitment-document-diff'
import { CommitmentDocumentReview } from '@/components/commitment-document/CommitmentDocumentReview'
```
after fetching `commitmentDocument`, add
```typescript
  const divergentFields = commitmentDocument ? await getCommitmentDocumentDivergence(id) : []
```
and render `<CommitmentDocumentReview orderId={id} divergentFields={divergentFields} />` immediately above `<CommitmentDocumentEditor ... />`.

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 5: Manual verification**

Repeat Task 7 Step 3's hand-edit setup, then load `/orders/<id>/commitment-document` in the browser and confirm the amber divergence panel shows the changed field with correct old/new values. Click Accept on one and confirm `commitment_sch_a`'s column updated. Click Reject on another (with a fresh divergence created the same way) and confirm `commitment_sch_a` is untouched but the panel entry disappears on reload.

- [ ] **Step 6: Commit**

```bash
git add src/components/commitment-document/CommitmentDocumentReview.tsx src/app/actions/commitment-document-review.ts "src/app/orders/[id]/commitment-document/page.tsx"
git commit -m "feat: add commitment document review screen with per-field accept/reject"
```

---

### Task 9: PDF export

**Files:**
- Create: `src/app/actions/commitment-document-pdf.ts`
- Modify: `src/components/commitment-document/CommitmentDocumentEditor.tsx` (add an "Export PDF" button + download link)

**Interfaces:**
- Consumes: `runDocBuilderScript` (Task 2); `commitment_documents` table.
- Produces: `exportCommitmentDocumentPdf(orderId: string): Promise<{ error?: string; downloadUrl?: string }>`.

- [ ] **Step 1: Write the export action**

```typescript
// src/app/actions/commitment-document-pdf.ts
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
```

- [ ] **Step 2: Add the export button to the editor component**

Modify `src/components/commitment-document/CommitmentDocumentEditor.tsx`: add the import
```typescript
import { exportCommitmentDocumentPdf } from '@/app/actions/commitment-document-pdf'
```
add state alongside the existing `isMerging`/`error` state
```typescript
  const [isExporting, startExport] = useTransition()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
```
and render, next to the existing merge button:
```typescript
  <button
    type="button"
    disabled={isExporting || !editorUrl}
    onClick={() =>
      startExport(async () => {
        setError(null)
        const result = await exportCommitmentDocumentPdf(orderId)
        if (result.error) setError(result.error)
        else setPdfUrl(result.downloadUrl ?? null)
      })
    }
    className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
  >
    {isExporting ? 'Exporting…' : 'Export PDF'}
  </button>
  {pdfUrl && (
    <a href={pdfUrl} target="_blank" rel="noreferrer" className="ml-2 text-sm text-blue-600 underline">
      Download PDF
    </a>
  )}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 4: Manual verification**

With a merged document already present for a test order, click "Export PDF" in the browser and confirm a download link appears; open it and confirm it's a real, readable PDF containing the merged field values.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/commitment-document-pdf.ts src/components/commitment-document/CommitmentDocumentEditor.tsx
git commit -m "feat: add commitment document PDF export"
```

---

### Task 10: Playwright coverage (what's actually assertable)

**Files:**
- Create: `tests/commitment-document.spec.ts`

**Interfaces:**
- Consumes: the full pipeline (Tasks 4-9) against a real local Document Server — this test suite requires `ONLYOFFICE_DOCUMENT_SERVER_URL` pointed at a running instance (documented at the top of the spec file) and is not expected to run in a CI environment without one.

**What Playwright can and cannot verify here:** ONLYOFFICE's embedded editor renders its document content to canvas inside a cross-origin iframe — there is no real DOM text for Playwright to read, and no framework-level way to assert "the editor shows the merged Commitment Number." What Playwright *can* verify: the merge button triggers a real network request and the page reflects success/failure; the review panel appears/disappears based on real divergence; the PDF export produces a real downloadable file. This test does not attempt to assert on rendered editor content — doing so would be exactly the kind of fake-passing test the writing-plans process forbids.

- [ ] **Step 1: Write the test**

```typescript
// tests/commitment-document.spec.ts
// Requires a running local ONLYOFFICE Document Server (ONLYOFFICE_DOCUMENT_SERVER_URL)
// and a seeded commitment template (scripts/upload-commitment-template.mjs) —
// this suite talks to the real Document Server, not a mock, matching this
// codebase's existing preference for full Playwright user-flow coverage over
// unit tests (see Attachments Core plan's Global Constraints).
import { test, expect } from '@playwright/test'

test.describe('Commitment Document', () => {
  test('generating a document shows the embedded editor and no error', async ({ page }) => {
    // Assumes a seeded test order with commitment_sch_a filled in — reuse this
    // codebase's existing test-order seeding convention (see any sibling
    // *.spec.ts under tests/ for the exact fixture/seed call used elsewhere).
    const testOrderId = process.env.TEST_ORDER_ID
    test.skip(!testOrderId, 'TEST_ORDER_ID not set — see tests/ setup docs')

    await page.goto(`/orders/${testOrderId}/commitment-document`)
    await page.getByRole('button', { name: 'Generate document' }).click()
    await expect(page.locator('#onlyoffice-editor-container iframe')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/could not merge/i)).not.toBeVisible()
  })

  test('divergent fields surface in the review panel with accept/reject controls', async ({ page }) => {
    const testOrderId = process.env.TEST_ORDER_ID_WITH_DIVERGENCE
    test.skip(!testOrderId, 'TEST_ORDER_ID_WITH_DIVERGENCE not set — see tests/ setup docs')

    await page.goto(`/orders/${testOrderId}/commitment-document`)
    await expect(page.getByText(/field.*changed inside the document/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Accept' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reject' }).first()).toBeVisible()
  })

  test('exporting produces a downloadable PDF', async ({ page }) => {
    const testOrderId = process.env.TEST_ORDER_ID
    test.skip(!testOrderId, 'TEST_ORDER_ID not set — see tests/ setup docs')

    await page.goto(`/orders/${testOrderId}/commitment-document`)
    await page.getByRole('button', { name: 'Generate document' }).click()
    await expect(page.locator('#onlyoffice-editor-container iframe')).toBeVisible({ timeout: 15000 })

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export PDF' }).click().then(() => page.getByRole('link', { name: 'Download PDF' }).click()),
    ])
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })
})
```

- [ ] **Step 2: Run it against the local Document Server**

Run: `TEST_ORDER_ID=<a real seeded order id> npm run test:e2e -- tests/commitment-document.spec.ts`
Expected: the first and third tests pass (with `TEST_ORDER_ID` set); the divergence test is skipped unless `TEST_ORDER_ID_WITH_DIVERGENCE` is also set up per Task 7/8's manual verification steps.

- [ ] **Step 3: Commit**

```bash
git add tests/commitment-document.spec.ts
git commit -m "test: add Playwright coverage for commitment document generation, review, and PDF export"
```

---

## Self-Review

**Spec coverage:** Template authoring (Task 3) ✓. Merge (Task 4) ✓ for the 11 header fields; Requirements/Exceptions dynamic list explicitly descoped with a stated reason (Global Constraints). Embedded review/edit (Task 5) ✓. Save callback (Task 6) ✓, with JWT verification the original spec didn't spell out but the "required production hardening" section demanded. Read-back/diff (Task 7) ✓, using the corrected `GetElement(0).GetText()` API the spike found. Review screen (Task 8) ✓, per-field accept/reject, never all-or-nothing. PDF export (Task 9) ✓, via the already-proven docbuilder mechanism rather than a second untested API. Revision Number: incremented on every full merge (Task 4) — the spec left the exact trigger point open; this plan picks "every merge," documented in Task 4's code comment, rather than leaving it unresolved.

**Placeholder scan:** No TBD/TODO/"add appropriate error handling" left in any task. Task 9 Step 2's edit is given as exact code to add to a file two tasks already wrote in full (Task 5), not summarized.

**Type consistency:** `mergeCommitmentDocument(orderId: string): Promise<{ error?: string }>` (Task 4) matches its call sites in Task 5's button and Task 10's test. `DivergentField` (Task 7) is imported by exact name into Task 8. `resolveCommitmentDocumentField(orderId, tag, action, currentDocValue)` (Task 8) matches both call sites in `CommitmentDocumentReview.tsx`. `runDocBuilderScript(supabase, scriptText): Promise<Record<string, string>>` (Task 2) is called identically in Tasks 4, 7, and 9.
