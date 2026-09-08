# Attachments Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Attachments Core feature — firm-wide folder taxonomy, per-order folder tree, file upload/organize/search/preview — replacing the `OrderToolbar`'s "Not built yet" placeholder for the Attachments tab.

**Architecture:** New Postgres tables (`folder_templates`, `attachment_folders`, `attachments`) plus a Supabase Storage bucket for file bytes. A new `profiles` table adds the app's first permission gate (`can_manage_folder_templates`), reused from the unbuilt Entity Directory plan's precedent since no permission infrastructure exists yet. The UI is a client-side panel (`AttachmentsPanel`) rendered inside the existing toolbar-tab architecture (not a routed page) — `OrderToolbar` already owns tab-switching via local state, and the design doc explicitly frames this as replacing that tab's placeholder content.

**Tech Stack:** Next.js 16 / React 19 App Router, Supabase (Postgres + Storage) via `@supabase/ssr`, shadcn/ui (`@base-ui/react` primitives), `pdfjs-dist` (new dependency) for in-browser PDF preview, Playwright for E2E.

**Spec:** [[Genesis Rebuild - Attachments Core Design]] (`M&L Title - Obsidian Vault/Genesis Rebuild - Attachments Core Design.md`)

## Global Constraints

- RLS on every new table is the blanket `for all to authenticated using (true) with check (true)` pattern used by all 16 existing migrations — no exceptions, no new access-control model invented here (tracked separately as a known gap in `Security Concerns.md`).
- Server actions that back a full-page form (redirect-driven) follow `contacts.ts`'s pattern exactly. Server actions that back the new in-page `AttachmentsPanel` **deviate deliberately**: they return `{ error?: string }` (or data directly) instead of redirecting, because redirecting would navigate away from the order page and break the toolbar-tab UX. This divergence is called out again at the point it first appears (Task 4).
- Migration numbering continues from `0016` (the current latest) → `0017`, `0018`.
- File-size cap: 25 MB (`ATTACHMENT_MAX_SIZE_BYTES`). Type allowlist: PDF, DOC/DOCX, XLS/XLSX, PNG, JPEG (`ATTACHMENT_ALLOWED_MIME_TYPES`). Both are real, adjustable constants in `src/lib/constants.ts`, not placeholders — the spec left the exact cap/list as an implementation decision.
- **No unit-test runner exists in this codebase** (`package.json` has no jest/vitest — only `@playwright/test`). Matching the project's own established rhythm (see `Genesis Build Log.md`, where `npm run build`/`npm run lint` clean is the per-task bar and Playwright covers full user flows), each task below verifies with `npm run build` (TypeScript compiles) and, for schema tasks, a direct SQL check via the Supabase MCP (`apply_migration` / `execute_sql` against the linked project). Full behavioral coverage lands in the final Playwright task (Task 9).
- Out of scope (per spec): Merge & Refresh engine, Annotation, malware/AV scanning mechanism, live email ingestion. Do not build any of these.

---

### Task 1: Core schema — folder_templates, attachment_folders, attachments, Storage bucket

**Files:**
- Create: `supabase/migrations/0017_attachments_core.sql`

**Interfaces:**
- Produces: tables `public.folder_templates(id, name, sort_order, parent_folder_template_id)`, `public.attachment_folders(id, order_id, name, sort_order, parent_folder_id, source_template_id)`, `public.attachments(id, order_id, folder_id, name, description, storage_path, mime_type, size_bytes, source, uploaded_by, created_at, updated_at)`; Storage bucket `attachments` (private).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0017_attachments_core.sql
-- Attachments Core (Genesis Rebuild - Attachments Core Design.md): firm-wide folder
-- taxonomy template, per-order folder tree copied from it, and the attachments that
-- live in those folders. Storage bucket + RLS policy for the actual file bytes.

create table public.folder_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null,
  parent_folder_template_id uuid references public.folder_templates(id) on delete cascade
);

create index folder_templates_parent_idx on public.folder_templates(parent_folder_template_id);

alter table public.folder_templates enable row level security;

create policy "Authenticated M&L staff can do anything with folder_templates"
  on public.folder_templates for all to authenticated using (true) with check (true);

create table public.attachment_folders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  name text not null,
  sort_order integer not null,
  parent_folder_id uuid references public.attachment_folders(id) on delete cascade,
  source_template_id uuid references public.folder_templates(id) on delete set null
);

create index attachment_folders_order_id_idx on public.attachment_folders(order_id);
create index attachment_folders_parent_idx on public.attachment_folders(parent_folder_id);

alter table public.attachment_folders enable row level security;

create policy "Authenticated M&L staff can do anything with attachment_folders"
  on public.attachment_folders for all to authenticated using (true) with check (true);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  folder_id uuid not null references public.attachment_folders(id) on delete cascade,
  name text not null,
  description text,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  source text not null default 'Attached' check (source in ('Attached', 'Merged')),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index attachments_order_id_idx on public.attachments(order_id);
create index attachments_folder_id_idx on public.attachments(folder_id);

alter table public.attachments enable row level security;

create policy "Authenticated M&L staff can do anything with attachments"
  on public.attachments for all to authenticated using (true) with check (true);

-- Seed the firm-wide 11-folder taxonomy (10 top-level + Trash), with "1. Title Docs"
-- carrying one nested sub-folder "1.a Title Work" per the design doc.
do $$
declare
  title_docs_id uuid;
begin
  insert into public.folder_templates (name, sort_order) values ('Title Docs', 1) returning id into title_docs_id;
  insert into public.folder_templates (name, sort_order, parent_folder_template_id) values ('Title Work', 1, title_docs_id);
  insert into public.folder_templates (name, sort_order) values
    ('Contracts', 2),
    ('Pre-Closing/Invoice', 3),
    ('Date Down/Bring Down', 4),
    ('Unsigned Closing Docs', 5),
    ('Signed Closing Docs', 6),
    ('Post-Closing', 7),
    ('Funding', 8),
    ('Recording and Policy', 9),
    ('Email Communication', 10),
    ('Trash', 11);
end $$;

-- Storage bucket for the actual file bytes. Private (not public) — access goes
-- through the app's own RLS-backed queries, matching how every other table here
-- enforces "authenticated M&L staff, no finer-grained scoping yet" (Security
-- Concerns.md item 1 tracks tightening this app-wide later, not just here).
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);

create policy "Authenticated M&L staff can do anything with attachments bucket objects"
  on storage.objects for all to authenticated
  using (bucket_id = 'attachments')
  with check (bucket_id = 'attachments');
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool (name: `attachments_core`, matching this file's content), or `supabase db push` if working from the CLI against the linked project.

- [ ] **Step 3: Verify — folder taxonomy seeded correctly**

Run via the Supabase MCP `execute_sql`:

```sql
select name, sort_order, parent_folder_template_id from public.folder_templates order by sort_order, name;
```

Expected: 12 rows — 10 top-level folders with `parent_folder_template_id` null, "Trash" last (`sort_order = 11`), and exactly one row named "Title Work" with a non-null `parent_folder_template_id` matching "Title Docs"'s `id`.

- [ ] **Step 4: Verify — Storage bucket exists**

```sql
select id, public from storage.buckets where id = 'attachments';
```

Expected: one row, `public = false`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0017_attachments_core.sql
git commit -m "feat: add Attachments Core schema (folder_templates, attachment_folders, attachments, storage bucket)"
```

---

### Task 2: Permission schema + helper (profiles, can_manage_folder_templates)

**Files:**
- Create: `supabase/migrations/0018_profiles_permissions.sql`
- Create: `src/lib/permissions.ts`

**Interfaces:**
- Produces: table `public.profiles(id, can_manage_folder_templates, created_at)`; function `requireFolderTemplatePermission(supabase): Promise<boolean>` — consumed by Task 5's `folder-templates.ts` actions and Task 6's admin page.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0018_profiles_permissions.sql
-- Minimal permission primitive for Attachments' firm-level folder-template admin
-- screen (Genesis Rebuild - Attachments Core Design.md's can_manage_folder_templates
-- gate) — first permission-gated surface in the app. Not the full MFA/SSO/step-up
-- Admin system in Design Notes - Admin.md (separate, unbuilt initiative). No
-- self-service grant path exists yet — a row is inserted/flipped by direct SQL
-- until a real admin-user-management screen exists, matching the "not there yet"
-- precedent already set for the SSN/DOB access-control decision.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  can_manage_folder_templates boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Authenticated M&L staff can read their own profile"
  on public.profiles for select to authenticated using (id = auth.uid());
```

- [ ] **Step 2: Apply the migration**

Supabase MCP `apply_migration` (name: `profiles_permissions`).

- [ ] **Step 3: Write the permission helper**

```ts
// src/lib/permissions.ts
import type { createClient } from '@/lib/supabase/server'

export async function requireFolderTemplatePermission(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('can_manage_folder_templates')
    .eq('id', user.id)
    .maybeSingle()

  return profile?.can_manage_folder_templates ?? false
}
```

- [ ] **Step 4: Verify — no `profiles` row means no permission**

Since `profiles` starts empty, every existing user (including the seeded E2E user) has no row, so `requireFolderTemplatePermission` must return `false` for everyone right now — this is the desired default (deny unless explicitly granted). Confirm via:

```sql
select count(*) from public.profiles;
```

Expected: `0`.

- [ ] **Step 5: `npm run build` clean**

```bash
npm run build
```

Expected: no TypeScript errors (this file has no callers yet, but must type-check standalone).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0018_profiles_permissions.sql src/lib/permissions.ts
git commit -m "feat: add profiles table and can_manage_folder_templates permission helper"
```

---

### Task 3: Types and constants

**Files:**
- Modify: `src/lib/types.ts` (append)
- Modify: `src/lib/constants.ts` (append)

**Interfaces:**
- Produces: types `FolderTemplate`, `AttachmentFolder`, `Attachment`; constants `ATTACHMENT_MAX_SIZE_BYTES`, `ATTACHMENT_ALLOWED_MIME_TYPES` — consumed by every task from here on.

- [ ] **Step 1: Append types**

```ts
// src/lib/types.ts (append)

export type FolderTemplate = {
  id: string
  name: string
  sort_order: number
  parent_folder_template_id: string | null
}

export type AttachmentFolder = {
  id: string
  order_id: string
  name: string
  sort_order: number
  parent_folder_id: string | null
  source_template_id: string | null
}

export type Attachment = {
  id: string
  order_id: string
  folder_id: string
  name: string
  description: string | null
  storage_path: string
  mime_type: string
  size_bytes: number
  source: 'Attached' | 'Merged'
  uploaded_by: string
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Append constants**

```ts
// src/lib/constants.ts (append)

// Attachments upload validation (Genesis Rebuild - Attachments Core Design.md).
export const ATTACHMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
] as const
```

- [ ] **Step 3: `npm run build` clean**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add Attachments types and upload-validation constants"
```

---

### Task 4: Attachments server actions (list, search, move, upload, delete) + folder-tree copy on order creation

**Files:**
- Create: `src/app/actions/attachments.ts`
- Modify: `src/app/actions/orders.ts:62-84` (`createOrder`)

**Interfaces:**
- Consumes: `FolderTemplate`, `AttachmentFolder`, `Attachment` (Task 3); `ATTACHMENT_MAX_SIZE_BYTES`, `ATTACHMENT_ALLOWED_MIME_TYPES` (Task 3).
- Produces: `copyFolderTemplateForOrder(orderId: string): Promise<void>`, `listAttachments(orderId: string): Promise<{ folders: AttachmentFolder[]; attachments: Attachment[] }>`, `searchAttachments(orderId: string, query: string): Promise<Array<Attachment & { folderPath: string }>>`, `createFolder(orderId: string, parentFolderId: string | null, name: string): Promise<{ error?: string }>`, `moveAttachment(attachmentId: string, folderId: string): Promise<{ error?: string }>`, `uploadAttachment(orderId: string, folderId: string, formData: FormData): Promise<{ error?: string }>`, `deleteAttachmentPermanently(attachmentId: string): Promise<{ error?: string }>`, `getAttachmentDownloadUrl(storagePath: string): Promise<string | null>` — consumed by Task 6 (`AttachmentsPanel`, `FolderTree`), Task 7 (`AttachmentUploadDialog`), Task 8 (`AttachmentPreview`), Task 9 (Playwright).

**Note on the pattern deviation** (see Global Constraints): unlike `contacts.ts`, none of these actions redirect. `AttachmentsPanel` is an in-page dynamic panel — a redirect would kick the user out of the order screen entirely. Mutating actions return `{ error?: string }`; read actions return data directly.

- [ ] **Step 1: Write `src/app/actions/attachments.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ATTACHMENT_MAX_SIZE_BYTES, ATTACHMENT_ALLOWED_MIME_TYPES } from '@/lib/constants'
import type { Attachment, AttachmentFolder } from '@/lib/types'

// Copies the firm's folder_templates tree into a fresh order's attachment_folders,
// preserving nesting. Called once, from createOrder — a later edit to the firm
// template applies to new orders only, per the design doc's copy-once-then-decouple
// pattern (matches Deed/Security Instrument/Entity Directory elsewhere in this app).
export async function copyFolderTemplateForOrder(orderId: string): Promise<void> {
  const supabase = await createClient()

  const { data: templates } = await supabase
    .from('folder_templates')
    .select('id, name, sort_order, parent_folder_template_id')
    .order('sort_order')

  if (!templates || templates.length === 0) return

  const topLevel = templates.filter((t) => !t.parent_folder_template_id)
  const children = templates.filter((t) => t.parent_folder_template_id)

  const templateIdToNewId = new Map<string, string>()

  for (const t of topLevel) {
    const { data } = await supabase
      .from('attachment_folders')
      .insert({ order_id: orderId, name: t.name, sort_order: t.sort_order, source_template_id: t.id })
      .select('id')
      .single()
    if (data) templateIdToNewId.set(t.id, data.id)
  }

  for (const t of children) {
    const parentId = templateIdToNewId.get(t.parent_folder_template_id as string)
    if (!parentId) continue
    await supabase.from('attachment_folders').insert({
      order_id: orderId,
      name: t.name,
      sort_order: t.sort_order,
      parent_folder_id: parentId,
      source_template_id: t.id,
    })
  }
}

export async function listAttachments(
  orderId: string
): Promise<{ folders: AttachmentFolder[]; attachments: Attachment[] }> {
  const supabase = await createClient()

  const [{ data: folders }, { data: attachments }] = await Promise.all([
    supabase.from('attachment_folders').select('*').eq('order_id', orderId).order('sort_order'),
    supabase.from('attachments').select('*').eq('order_id', orderId).order('name'),
  ])

  return { folders: folders ?? [], attachments: attachments ?? [] }
}

function buildFolderPathMap(folders: AttachmentFolder[]): Map<string, string> {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const pathOf = (id: string): string => {
    const folder = byId.get(id)
    if (!folder) return ''
    return folder.parent_folder_id ? `${pathOf(folder.parent_folder_id)} / ${folder.name}` : folder.name
  }
  const map = new Map<string, string>()
  for (const f of folders) map.set(f.id, pathOf(f.id))
  return map
}

export async function searchAttachments(
  orderId: string,
  query: string
): Promise<Array<Attachment & { folderPath: string }>> {
  const supabase = await createClient()

  const [{ data: folders }, { data: attachments }] = await Promise.all([
    supabase.from('attachment_folders').select('*').eq('order_id', orderId),
    supabase
      .from('attachments')
      .select('*')
      .eq('order_id', orderId)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`),
  ])

  const pathMap = buildFolderPathMap(folders ?? [])
  return (attachments ?? []).map((a) => ({ ...a, folderPath: pathMap.get(a.folder_id) ?? '' }))
}

async function nextSortOrderUnderParent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  parentFolderId: string | null
): Promise<number> {
  let query = supabase
    .from('attachment_folders')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)
  query = parentFolderId ? query.eq('parent_folder_id', parentFolderId) : query.is('parent_folder_id', null)
  const { count } = await query
  return (count ?? 0) + 1
}

export async function createFolder(
  orderId: string,
  parentFolderId: string | null,
  name: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const sortOrder = await nextSortOrderUnderParent(supabase, orderId, parentFolderId)

  const { error } = await supabase.from('attachment_folders').insert({
    order_id: orderId,
    parent_folder_id: parentFolderId,
    name,
    sort_order: sortOrder,
  })

  if (error) {
    console.error('createFolder failed:', error)
    return { error: 'Could not create folder. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function moveAttachment(attachmentId: string, folderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: attachment } = await supabase
    .from('attachments')
    .select('order_id')
    .eq('id', attachmentId)
    .single()

  const { error } = await supabase
    .from('attachments')
    .update({ folder_id: folderId, updated_at: new Date().toISOString() })
    .eq('id', attachmentId)

  if (error) {
    console.error('moveAttachment failed:', error)
    return { error: 'Could not move attachment. Please try again.' }
  }

  if (attachment) revalidatePath(`/orders/${attachment.order_id}`)
  return {}
}

export async function uploadAttachment(
  orderId: string,
  folderId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const file = formData.get('file') as File | null
  const description = (formData.get('description') as string) || null

  if (!file || file.size === 0) return { error: 'Choose a file to upload.' }
  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    return { error: `File is too large. Maximum size is ${ATTACHMENT_MAX_SIZE_BYTES / (1024 * 1024)} MB.` }
  }
  if (!ATTACHMENT_ALLOWED_MIME_TYPES.includes(file.type as (typeof ATTACHMENT_ALLOWED_MIME_TYPES)[number])) {
    return { error: 'That file type is not allowed.' }
  }

  const { data: attachmentRow, error: insertError } = await supabase
    .from('attachments')
    .insert({
      order_id: orderId,
      folder_id: folderId,
      name: file.name,
      description,
      storage_path: '',
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (insertError || !attachmentRow) {
    console.error('uploadAttachment insert failed:', insertError)
    return { error: 'Could not save the upload. Please try again.' }
  }

  const storagePath = `${orderId}/${attachmentRow.id}/${file.name}`

  const { error: storageError } = await supabase.storage.from('attachments').upload(storagePath, file)

  if (storageError) {
    console.error('uploadAttachment storage upload failed:', storageError)
    await supabase.from('attachments').delete().eq('id', attachmentRow.id)
    return { error: 'Could not upload the file. Please try again.' }
  }

  await supabase.from('attachments').update({ storage_path: storagePath }).eq('id', attachmentRow.id)

  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function deleteAttachmentPermanently(attachmentId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: attachment } = await supabase
    .from('attachments')
    .select('order_id, storage_path')
    .eq('id', attachmentId)
    .single()

  if (!attachment) return { error: 'Attachment not found.' }

  await supabase.storage.from('attachments').remove([attachment.storage_path])

  const { error } = await supabase.from('attachments').delete().eq('id', attachmentId)

  if (error) {
    console.error('deleteAttachmentPermanently failed:', error)
    return { error: 'Could not delete attachment. Please try again.' }
  }

  revalidatePath(`/orders/${attachment.order_id}`)
  return {}
}

export async function getAttachmentDownloadUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(storagePath, 60 * 5)
  if (error || !data) {
    console.error('getAttachmentDownloadUrl failed:', error)
    return null
  }
  return data.signedUrl
}
```

- [ ] **Step 2: Hook the folder-tree copy into `createOrder`**

In `src/app/actions/orders.ts`, import `copyFolderTemplateForOrder` and call it right after the order row is successfully inserted, before `revalidatePath`/`redirect`:

```ts
// src/app/actions/orders.ts — add to the top imports
import { copyFolderTemplateForOrder } from '@/app/actions/attachments'
```

```ts
// src/app/actions/orders.ts:76-84 — replace this block
  if (error || !data) {
    console.error('createOrder failed:', error)
    redirect(
      `/orders/new?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath('/orders')
  redirect(`/orders/${data.id}/order-entry`)
}
```

```ts
// with:
  if (error || !data) {
    console.error('createOrder failed:', error)
    redirect(
      `/orders/new?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  await copyFolderTemplateForOrder(data.id)

  revalidatePath('/orders')
  redirect(`/orders/${data.id}/order-entry`)
}
```

- [ ] **Step 3: `npm run build` clean**

```bash
npm run build
```

- [ ] **Step 4: Verify — a manually created order gets the folder tree**

Via the Supabase MCP `execute_sql`, find any existing order id and run the copy directly to confirm it's wired (or just proceed to Task 9's Playwright test, which exercises this through the real UI — this manual check is a fast sanity pass before then):

```sql
-- pick any real order id from `select id from public.orders limit 1;`, then:
select name, parent_folder_id from public.attachment_folders where order_id = '<that id>' order by sort_order;
```

If the order predates this change, this returns 0 rows (expected — the copy only runs on new-order creation going forward, per the design doc's copy-once policy). Confirm behavior instead by creating one throwaway order through the running app (`npm run dev`, sign in as the seeded user, "+ New Order" → "Create Order") and re-running the query with its id — expect 12 rows, one named "Title Work" with a non-null `parent_folder_id`. Delete the throwaway order afterward (`delete from public.orders where id = '<id>';` — cascades to its folders).

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/attachments.ts src/app/actions/orders.ts
git commit -m "feat: add Attachments server actions and copy firm folder template on order creation"
```

---

### Task 5: Firm folder-template admin (actions + permission-gated page)

**Files:**
- Create: `src/app/actions/folder-templates.ts`
- Create: `src/app/admin/folder-templates/page.tsx`
- Create: `src/components/FolderTemplateAdmin.tsx`

**Interfaces:**
- Consumes: `requireFolderTemplatePermission` (Task 2), `FolderTemplate` (Task 3).
- Produces: `listFolderTemplates()`, `createFolderTemplate(parentFolderTemplateId, name)`, `renameFolderTemplate(id, name)`, `deleteFolderTemplate(id)` — used only by this task's own page/component, no downstream consumers.

- [ ] **Step 1: Write `src/app/actions/folder-templates.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireFolderTemplatePermission } from '@/lib/permissions'
import type { FolderTemplate } from '@/lib/types'

export async function listFolderTemplates(): Promise<FolderTemplate[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('folder_templates').select('*').order('sort_order')
  return data ?? []
}

async function nextTemplateSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentFolderTemplateId: string | null
): Promise<number> {
  let query = supabase.from('folder_templates').select('*', { count: 'exact', head: true })
  query = parentFolderTemplateId
    ? query.eq('parent_folder_template_id', parentFolderTemplateId)
    : query.is('parent_folder_template_id', null)
  const { count } = await query
  return (count ?? 0) + 1
}

export async function createFolderTemplate(
  parentFolderTemplateId: string | null,
  name: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (!(await requireFolderTemplatePermission(supabase))) {
    return { error: 'You do not have permission to manage folder templates.' }
  }

  const sortOrder = await nextTemplateSortOrder(supabase, parentFolderTemplateId)

  const { error } = await supabase.from('folder_templates').insert({
    name,
    parent_folder_template_id: parentFolderTemplateId,
    sort_order: sortOrder,
  })

  if (error) {
    console.error('createFolderTemplate failed:', error)
    return { error: 'Could not create folder template. Please try again.' }
  }

  revalidatePath('/admin/folder-templates')
  return {}
}

export async function renameFolderTemplate(id: string, name: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (!(await requireFolderTemplatePermission(supabase))) {
    return { error: 'You do not have permission to manage folder templates.' }
  }

  const { error } = await supabase.from('folder_templates').update({ name }).eq('id', id)

  if (error) {
    console.error('renameFolderTemplate failed:', error)
    return { error: 'Could not rename folder template. Please try again.' }
  }

  revalidatePath('/admin/folder-templates')
  return {}
}

export async function deleteFolderTemplate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (!(await requireFolderTemplatePermission(supabase))) {
    return { error: 'You do not have permission to manage folder templates.' }
  }

  const { error } = await supabase.from('folder_templates').delete().eq('id', id)

  if (error) {
    console.error('deleteFolderTemplate failed:', error)
    return { error: 'Could not delete folder template. Please try again.' }
  }

  revalidatePath('/admin/folder-templates')
  return {}
}
```

- [ ] **Step 2: Write `src/components/FolderTemplateAdmin.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createFolderTemplate, renameFolderTemplate, deleteFolderTemplate } from '@/app/actions/folder-templates'
import type { FolderTemplate } from '@/lib/types'

export function FolderTemplateAdmin({ templates }: { templates: FolderTemplate[] }) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const topLevel = templates.filter((t) => !t.parent_folder_template_id)
  const childrenOf = (id: string) => templates.filter((t) => t.parent_folder_template_id === id)

  function refresh() {
    // ponytail: full reload keeps this simple; this screen is used rarely enough
    // that a router.refresh()-based no-flash update isn't worth the extra wiring
    window.location.reload()
  }

  function handleCreate() {
    if (!newName.trim()) return
    startTransition(async () => {
      const result = await createFolderTemplate(null, newName.trim())
      if (result.error) setError(result.error)
      else {
        setNewName('')
        refresh()
      }
    })
  }

  function handleRename(id: string, name: string) {
    startTransition(async () => {
      const result = await renameFolderTemplate(id, name)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteFolderTemplate(id)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function renderRow(template: FolderTemplate, depth: number) {
    return (
      <li key={template.id} className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 24 }}>
        <Input
          defaultValue={template.name}
          aria-label={`Rename ${template.name}`}
          className="max-w-xs"
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== template.name) {
              handleRename(template.id, e.target.value.trim())
            }
          }}
        />
        <span className="text-xs text-muted-foreground">order {template.sort_order}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(template.id)} disabled={isPending}>
          Delete
        </Button>
      </li>
    )
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="mb-4 flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New top-level folder name"
          aria-label="New folder name"
          className="max-w-xs"
        />
        <Button type="button" onClick={handleCreate} disabled={isPending}>
          Add Folder
        </Button>
      </div>

      <ul>
        {topLevel.map((template) => (
          <li key={template.id}>
            {renderRow(template, 0)}
            <ul>{childrenOf(template.id).map((child) => renderRow(child, 1))}</ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/app/admin/folder-templates/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFolderTemplatePermission } from '@/lib/permissions'
import { listFolderTemplates } from '@/app/actions/folder-templates'
import { FolderTemplateAdmin } from '@/components/FolderTemplateAdmin'

export default async function FolderTemplatesAdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!(await requireFolderTemplatePermission(supabase))) redirect('/orders')

  const templates = await listFolderTemplates()

  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Folder Templates</h1>
      <FolderTemplateAdmin templates={templates} />
    </main>
  )
}
```

- [ ] **Step 4: `npm run build` clean**

```bash
npm run build
```

- [ ] **Step 5: Verify — the gate actually blocks**

```bash
npm run dev
```

Sign in as the seeded user (`genesis-e2e-seed@genesis-app-e2e-test.dev`) in a browser and visit `/admin/folder-templates` — expect an immediate redirect to `/orders`, since no `profiles` row exists yet for that user. (Task 9 automates this exact check.)

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/folder-templates.ts src/app/admin/folder-templates/page.tsx src/components/FolderTemplateAdmin.tsx
git commit -m "feat: add permission-gated firm folder-template admin screen"
```

---

### Task 6: FolderTree + AttachmentsPanel, wired into the order toolbar

**Files:**
- Modify: `src/components/OrderToolbar.tsx` (full replace)
- Modify: `src/app/orders/[id]/layout.tsx:52` (thread `orderId` prop)
- Create: `src/components/FolderTree.tsx`
- Create: `src/components/AttachmentsPanel.tsx`

**Interfaces:**
- Consumes: `listAttachments`, `searchAttachments`, `moveAttachment`, `createFolder`, `deleteAttachmentPermanently` (Task 4); `AttachmentFolder`, `Attachment` (Task 3).
- Produces: `<AttachmentsPanel orderId={string} />`, `<FolderTree orderId folders selectedFolderId onSelect onFoldersChanged />` — `AttachmentsPanel` is consumed by Task 7 (renders `AttachmentUploadDialog`) and Task 8 (renders `AttachmentPreview`), both added as children of this component in those tasks.

- [ ] **Step 1: Confirm the shadcn `table` primitive isn't already needed elsewhere before skipping it** — this task's own components (`FolderTree`, `AttachmentsPanel`) use plain lists, not a `<table>`, so no new shadcn install is required here. (Flagged in case a reviewer expects it — it's genuinely not needed until/unless a future list view calls for tabular columns.)

- [ ] **Step 2: Write `src/components/FolderTree.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createFolder } from '@/app/actions/attachments'
import type { AttachmentFolder } from '@/lib/types'

export function FolderTree({
  orderId,
  folders,
  selectedFolderId,
  onSelect,
  onFoldersChanged,
}: {
  orderId: string
  folders: AttachmentFolder[]
  selectedFolderId: string | null
  onSelect: (folderId: string) => void
  onFoldersChanged: () => void
}) {
  const [addingUnder, setAddingUnder] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [isPending, startTransition] = useTransition()

  const topLevel = folders.filter((f) => !f.parent_folder_id).sort((a, b) => a.sort_order - b.sort_order)
  const childrenOf = (id: string) =>
    folders.filter((f) => f.parent_folder_id === id).sort((a, b) => a.sort_order - b.sort_order)

  function handleAdd(parentFolderId: string) {
    if (!newName.trim()) return
    startTransition(async () => {
      await createFolder(orderId, parentFolderId, newName.trim())
      setNewName('')
      setAddingUnder(null)
      onFoldersChanged()
    })
  }

  function renderFolder(folder: AttachmentFolder, depth: number) {
    return (
      <li key={folder.id}>
        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
          <button
            type="button"
            data-testid={`folder-${folder.id}`}
            onClick={() => onSelect(folder.id)}
            className={`flex-1 rounded px-2 py-1 text-left text-sm ${
              selectedFolderId === folder.id ? 'bg-accent font-medium' : 'hover:bg-accent/50'
            }`}
          >
            {folder.name}
          </button>
          <button
            type="button"
            aria-label={`Add sub-folder to ${folder.name}`}
            onClick={() => setAddingUnder(folder.id)}
            className="px-1 text-xs text-muted-foreground hover:text-foreground"
          >
            +
          </button>
        </div>
        {addingUnder === folder.id && (
          <div className="flex gap-1 py-1" style={{ paddingLeft: (depth + 1) * 16 }}>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="New sub-folder name"
              className="h-7 text-sm"
            />
            <Button type="button" size="sm" onClick={() => handleAdd(folder.id)} disabled={isPending}>
              Add
            </Button>
          </div>
        )}
        {childrenOf(folder.id).length > 0 && (
          <ul>{childrenOf(folder.id).map((child) => renderFolder(child, depth + 1))}</ul>
        )}
      </li>
    )
  }

  return (
    <ul data-testid="folder-tree" className="space-y-0.5">
      {topLevel.map((folder) => renderFolder(folder, 0))}
    </ul>
  )
}
```

- [ ] **Step 3: Write `src/components/AttachmentsPanel.tsx`**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FolderTree } from '@/components/FolderTree'
import {
  listAttachments,
  searchAttachments,
  moveAttachment,
  deleteAttachmentPermanently,
} from '@/app/actions/attachments'
import type { Attachment, AttachmentFolder } from '@/lib/types'

type SearchResult = Attachment & { folderPath: string }

export function AttachmentsPanel({ orderId }: { orderId: string }) {
  const [folders, setFolders] = useState<AttachmentFolder[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      const data = await listAttachments(orderId)
      setFolders(data.folders)
      setAttachments(data.attachments)
      setSelectedFolderId((current) => current ?? data.folders.find((f) => !f.parent_folder_id)?.id ?? null)
    })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    const timeout = setTimeout(() => {
      searchAttachments(orderId, searchQuery.trim()).then(setSearchResults)
    }, 300)
    return () => clearTimeout(timeout)
  }, [orderId, searchQuery])

  const visibleAttachments: Array<Attachment | SearchResult> =
    searchResults ?? attachments.filter((a) => a.folder_id === selectedFolderId)

  function handleMove(attachmentId: string, folderId: string) {
    startTransition(async () => {
      await moveAttachment(attachmentId, folderId)
      refresh()
    })
  }

  function handleDelete(attachmentId: string) {
    startTransition(async () => {
      await deleteAttachmentPermanently(attachmentId)
      refresh()
    })
  }

  return (
    <div data-testid="attachments-panel" className="flex gap-6">
      <div className="w-56 shrink-0">
        <FolderTree
          orderId={orderId}
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelect={(id) => {
            setSelectedFolderId(id)
            setSearchQuery('')
          }}
          onFoldersChanged={refresh}
        />
      </div>

      <div className="flex-1">
        <div className="mb-3 flex items-center gap-2">
          <Input
            placeholder="Search this file's attachments..."
            aria-label="Search attachments"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button type="button" onClick={() => setUploadOpen(true)} disabled={!selectedFolderId}>
            Upload
          </Button>
        </div>

        <ul className="divide-y" data-testid="attachment-list">
          {visibleAttachments.map((attachment) => (
            <li key={attachment.id} className="flex items-center justify-between py-2">
              <div>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(attachment)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {attachment.name}
                </button>
                {'folderPath' in attachment && (
                  <p className="text-xs text-muted-foreground">{(attachment as SearchResult).folderPath}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Move ${attachment.name}`}
                  className="rounded border px-2 py-1 text-xs"
                  value=""
                  onChange={(e) => e.target.value && handleMove(attachment.id, e.target.value)}
                >
                  <option value="">Move to...</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleDelete(attachment.id)}
                  className="text-xs text-destructive hover:underline"
                >
                  Delete Permanently
                </button>
              </div>
            </li>
          ))}
          {visibleAttachments.length === 0 && !isPending && (
            <li className="py-2 text-sm text-muted-foreground">No attachments here yet.</li>
          )}
        </ul>
      </div>

      {uploadOpen && selectedFolderId && (
        <p className="text-sm text-muted-foreground" data-testid="upload-dialog-placeholder">
          Upload dialog not wired yet — see Task 7.
        </p>
      )}

      {previewAttachment && (
        <p className="text-sm text-muted-foreground" data-testid="preview-placeholder">
          Preview not wired yet — see Task 8.
        </p>
      )}
    </div>
  )
}
```

(The two placeholder blocks at the bottom are intentional — Task 7 and Task 8 each replace exactly one of them with the real component. This keeps this task's own build/verify step meaningful without forward-referencing components that don't exist yet.)

- [ ] **Step 4: Replace `src/components/OrderToolbar.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { AttachmentsPanel } from '@/components/AttachmentsPanel'

type ToolbarTab = 'requested-tasks' | 'checklist' | 'attachments' | 'history'

const TOOLBAR_TABS: { key: ToolbarTab; label: string }[] = [
  { key: 'requested-tasks', label: 'Requested Tasks' },
  { key: 'checklist', label: 'Checklist Tasks' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'history', label: 'File History' },
]

export function OrderToolbar({ orderId, children }: { orderId: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState<ToolbarTab | null>(null)
  const [prevPathname, setPrevPathname] = useState(pathname)

  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setActiveTab(null)
  }

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b" data-testid="order-toolbar">
        {TOOLBAR_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            data-testid={`toolbar-tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`cursor-pointer px-3 py-2.5 text-sm transition-colors duration-200 ${
              activeTab === tab.key
                ? 'border-b-2 border-foreground font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'attachments' ? (
        <AttachmentsPanel orderId={orderId} />
      ) : activeTab ? (
        <p className="text-sm text-muted-foreground" data-testid="toolbar-placeholder">
          Not built yet.
        </p>
      ) : (
        children
      )}
    </div>
  )
}
```

- [ ] **Step 5: Thread `orderId` into `OrderToolbar` from the layout**

In `src/app/orders/[id]/layout.tsx`, change line 52 from:

```tsx
        <OrderToolbar>{children}</OrderToolbar>
```

to:

```tsx
        <OrderToolbar orderId={id}>{children}</OrderToolbar>
```

- [ ] **Step 6: `npm run build` clean**

```bash
npm run build
```

- [ ] **Step 7: Verify manually**

```bash
npm run dev
```

Sign in, open any order, click the "Attachments" tab — expect the folder tree (11 named folders, "Title Work" nested under "Title Docs") and an empty "No attachments here yet." list, with the two "not wired yet" placeholders visible where the upload button/preview would appear.

- [ ] **Step 8: Commit**

```bash
git add src/components/OrderToolbar.tsx src/components/FolderTree.tsx src/components/AttachmentsPanel.tsx "src/app/orders/[id]/layout.tsx"
git commit -m "feat: wire AttachmentsPanel and FolderTree into the order toolbar"
```

---

### Task 7: Upload dialog with validation

**Files:**
- Create: `src/components/AttachmentUploadDialog.tsx`
- Modify: `src/components/AttachmentsPanel.tsx` (replace the upload placeholder block)

**Interfaces:**
- Consumes: `uploadAttachment` (Task 4); `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` (existing `src/components/ui/dialog.tsx` — confirmed exports: `Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription`, built on `@base-ui/react/dialog`).
- Produces: `<AttachmentUploadDialog orderId folderId onClose onUploaded />`.

- [ ] **Step 1: Write `src/components/AttachmentUploadDialog.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { uploadAttachment } from '@/app/actions/attachments'

export function AttachmentUploadDialog({
  orderId,
  folderId,
  onClose,
  onUploaded,
}: {
  orderId: string
  folderId: string
  onClose: () => void
  onUploaded: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await uploadAttachment(orderId, folderId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        onUploaded()
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Attachment</DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <form action={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="attachment-file">File</Label>
            <Input id="attachment-file" name="file" type="file" required />
          </div>
          <div>
            <Label htmlFor="attachment-description">Description</Label>
            <Input id="attachment-description" name="description" />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Wire it into `AttachmentsPanel`**

In `src/components/AttachmentsPanel.tsx`, add the import:

```tsx
import { AttachmentUploadDialog } from '@/components/AttachmentUploadDialog'
```

Replace:

```tsx
      {uploadOpen && selectedFolderId && (
        <p className="text-sm text-muted-foreground" data-testid="upload-dialog-placeholder">
          Upload dialog not wired yet — see Task 7.
        </p>
      )}
```

with:

```tsx
      {uploadOpen && selectedFolderId && (
        <AttachmentUploadDialog
          orderId={orderId}
          folderId={selectedFolderId}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false)
            refresh()
          }}
        />
      )}
```

- [ ] **Step 3: `npm run build` clean**

```bash
npm run build
```

- [ ] **Step 4: Verify manually**

```bash
npm run dev
```

Open an order's Attachments tab, select a folder, click "Upload," pick a small PDF, submit — expect the dialog to close and the file to appear in the list. Try a disallowed type (e.g. rename any file to `.exe`) — expect the inline error "That file type is not allowed."

- [ ] **Step 5: Commit**

```bash
git add src/components/AttachmentUploadDialog.tsx src/components/AttachmentsPanel.tsx
git commit -m "feat: add Attachment upload dialog with size/type validation"
```

---

### Task 8: PDF/image preview

**Files:**
- Modify: `package.json` (add `pdfjs-dist`)
- Create: `src/components/AttachmentPreview.tsx`
- Modify: `src/components/AttachmentsPanel.tsx` (replace the preview placeholder block)

**Interfaces:**
- Consumes: `getAttachmentDownloadUrl` (Task 4); `Attachment` (Task 3).
- Produces: `<AttachmentPreview attachment onClose />`.

- [ ] **Step 1: Install `pdfjs-dist`**

```bash
npm install pdfjs-dist
```

- [ ] **Step 2: Write `src/components/AttachmentPreview.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getAttachmentDownloadUrl } from '@/app/actions/attachments'
import type { Attachment } from '@/lib/types'

export function AttachmentPreview({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    getAttachmentDownloadUrl(attachment.storage_path).then(setUrl)
  }, [attachment.storage_path])

  useEffect(() => {
    if (!url || attachment.mime_type !== 'application/pdf' || !canvasRef.current) return

    let cancelled = false

    async function renderPdf() {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()

      const doc = await pdfjsLib.getDocument({ url: url as string }).promise
      const page = await doc.getPage(1)
      const viewport = page.getViewport({ scale: 1.2 })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const context = canvas.getContext('2d')
      if (!context) return
      await page.render({ canvasContext: context, viewport }).promise
    }

    renderPdf()

    return () => {
      cancelled = true
    }
  }, [url, attachment.mime_type])

  const isImage = attachment.mime_type.startsWith('image/')
  const isPdf = attachment.mime_type === 'application/pdf'

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{attachment.name}</DialogTitle>
        </DialogHeader>

        {!url && <p className="text-sm text-muted-foreground">Loading preview...</p>}
        {url && isPdf && <canvas ref={canvasRef} data-testid="pdf-preview-canvas" />}
        {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static asset Next can optimize */}
        {url && isImage && <img src={url} alt={attachment.name} className="max-h-[70vh] max-w-full" />}
        {url && !isPdf && !isImage && (
          <a href={url} download={attachment.name} className="text-sm text-primary hover:underline">
            Download {attachment.name}
          </a>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Wire it into `AttachmentsPanel`**

In `src/components/AttachmentsPanel.tsx`, add the import:

```tsx
import { AttachmentPreview } from '@/components/AttachmentPreview'
```

Replace:

```tsx
      {previewAttachment && (
        <p className="text-sm text-muted-foreground" data-testid="preview-placeholder">
          Preview not wired yet — see Task 8.
        </p>
      )}
```

with:

```tsx
      {previewAttachment && (
        <AttachmentPreview attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
      )}
```

- [ ] **Step 4: `npm run build` clean**

```bash
npm run build
```

- [ ] **Step 5: Verify manually**

```bash
npm run dev
```

Upload a real PDF, click its name in the list — expect the first page to render on a `<canvas>`. Upload a `.png`/`.jpg` — expect it to render as an `<img>`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/AttachmentPreview.tsx src/components/AttachmentsPanel.tsx
git commit -m "feat: add in-browser PDF and image preview for Attachments"
```

---

### Task 9: Playwright coverage

**Files:**
- Create: `tests/e2e/attachments.spec.ts`
- Modify: `tests/e2e/order-entry.spec.ts` (the toolbar-placeholder test currently keyed on `attachments`)

**Interfaces:**
- Consumes: the full running app built in Tasks 1–8.

- [ ] **Step 1: Fix the existing toolbar-placeholder test**

In `tests/e2e/order-entry.spec.ts`, find the test `'navigation shell: toolbar tabs show placeholder content and reset on nav'`. It currently clicks `toolbar-tab-attachments` and asserts the generic "Not built yet" placeholder — that's no longer true for that tab. Change every occurrence of `toolbar-tab-attachments` in that one test to `toolbar-tab-checklist` (still an unbuilt tab):

```ts
  await page.getByTestId('toolbar-tab-checklist').click()
  await expect(page.getByTestId('toolbar-placeholder')).toContainText('Not built yet')
```

- [ ] **Step 2: Write `tests/e2e/attachments.spec.ts`**

```ts
import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Public URL + anon key — same values the app itself ships to the browser
// (NEXT_PUBLIC_*), not secrets. Copied verbatim from tests/e2e/order-entry.spec.ts
// for consistency — Playwright's test runner does not load Next's .env files,
// so an env-var reference here would resolve to undefined at run time.
const SUPABASE_URL = 'https://hlahrypglnmjjxrdtfkm.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsYWhyeXBnbG5tamp4cmR0ZmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MzYyMDEsImV4cCI6MjEwMzMxMjIwMX0.dhgrZ8ei_NY2wG6bs6Ah--AHPEagl36gI7tcAX8llsY'
const SEEDED_EMAIL = 'genesis-e2e-seed@genesis-app-e2e-test.dev'
const SEEDED_PASSWORD = 'E2eSeedPass123!'

// Smallest valid PDF byte sequence that pdf.js can actually open — needed so the
// preview test exercises real rendering, not just a stubbed-out file.
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF'
)

const createdOrderIds = new Set<string>()

async function deleteTrackedOrders() {
  if (createdOrderIds.size === 0) return
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: SEEDED_EMAIL,
    password: SEEDED_PASSWORD,
  })
  if (authError) {
    console.error('deleteTrackedOrders auth failed:', authError)
    return
  }
  await supabase.from('orders').delete().in('id', [...createdOrderIds])
}

async function loginAsSeededUser(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(SEEDED_EMAIL)
  await page.getByLabel('Password').fill(SEEDED_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/orders')
}

async function createOrderAndOpenAttachments(page: Page): Promise<string> {
  await loginAsSeededUser(page)
  await page.getByRole('link', { name: '+ New Order' }).click()
  await page.getByRole('button', { name: 'Create Order' }).click()
  await page.waitForURL('**/orders/**/order-entry')
  const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1] as string
  createdOrderIds.add(orderId)
  await page.getByTestId('toolbar-tab-attachments').click()
  await expect(page.getByTestId('attachments-panel')).toBeVisible()
  return orderId
}

test.describe('Attachments', () => {
  test.beforeEach(async ({ page }) => {
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return
      const match = frame.url().match(/\/orders\/([^/?#]+)\/order-entry/)
      if (match) createdOrderIds.add(match[1])
    })
  })

  test.afterAll(async () => {
    await deleteTrackedOrders()
  })

  test('new order gets the firm folder template copied, including the nested sub-folder', async ({ page }) => {
    await createOrderAndOpenAttachments(page)

    await expect(page.getByTestId('folder-tree').getByText('Title Docs')).toBeVisible()
    await expect(page.getByTestId('folder-tree').getByText('Title Work')).toBeVisible()
    await expect(page.getByTestId('folder-tree').getByText('Trash')).toBeVisible()
  })

  test('upload, preview, search, move to Trash, and restore', async ({ page }) => {
    await createOrderAndOpenAttachments(page)

    await page.getByTestId('folder-tree').getByText('Contracts', { exact: true }).click()
    await page.getByRole('button', { name: 'Upload' }).click()
    await page.setInputFiles('#attachment-file', {
      name: 'sample-contract.pdf',
      mimeType: 'application/pdf',
      buffer: MINIMAL_PDF,
    })
    await page.getByLabel('Description').fill('Test contract upload')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.getByTestId('attachment-list')).toContainText('sample-contract.pdf')

    await page.getByRole('button', { name: 'sample-contract.pdf' }).click()
    await expect(page.getByTestId('pdf-preview-canvas')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByTestId('folder-tree').getByText('Post-Closing', { exact: true }).click()
    await page.getByLabel('Search attachments').fill('sample-contract')
    await expect(page.getByTestId('attachment-list')).toContainText('sample-contract.pdf')
    await expect(page.getByTestId('attachment-list')).toContainText('Contracts')
    await page.getByLabel('Search attachments').fill('')

    await page.getByTestId('folder-tree').getByText('Contracts', { exact: true }).click()
    await page.getByLabel('Move sample-contract.pdf').selectOption({ label: 'Trash' })
    await expect(page.getByTestId('attachment-list')).not.toContainText('sample-contract.pdf')
    await page.getByTestId('folder-tree').getByText('Trash', { exact: true }).click()
    await expect(page.getByTestId('attachment-list')).toContainText('sample-contract.pdf')
    await page.getByLabel('Move sample-contract.pdf').selectOption({ label: 'Contracts' })
    await expect(page.getByTestId('attachment-list')).not.toContainText('sample-contract.pdf')
    await page.getByTestId('folder-tree').getByText('Contracts', { exact: true }).click()
    await expect(page.getByTestId('attachment-list')).toContainText('sample-contract.pdf')
  })

  test('rejects a disallowed file type and an oversized file', async ({ page }) => {
    await createOrderAndOpenAttachments(page)

    await page.getByTestId('folder-tree').getByText('Contracts', { exact: true }).click()
    await page.getByRole('button', { name: 'Upload' }).click()
    await page.setInputFiles('#attachment-file', {
      name: 'malware.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('not really an executable'),
    })
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.getByText('That file type is not allowed.')).toBeVisible()

    await page.setInputFiles('#attachment-file', {
      name: 'huge.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(26 * 1024 * 1024, 1),
    })
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.getByText(/File is too large/)).toBeVisible()
  })

  test('folder-templates admin screen redirects a user without the permission', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto('/admin/folder-templates')
    await page.waitForURL('**/orders')
  })
})
```

- [ ] **Step 3: Run the suite**

```bash
npm run test:e2e
```

Expected: all `attachments.spec.ts` tests pass, and `order-entry.spec.ts` still passes in full (confirming the `toolbar-tab-checklist` swap didn't break anything else).

- [ ] **Step 4: `npm run build` and `npm run lint` clean**

```bash
npm run build
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/attachments.spec.ts tests/e2e/order-entry.spec.ts
git commit -m "test: add Playwright coverage for Attachments Core"
```

---

## After this plan lands

1. **Manual step required**: grant Cam's own user `can_manage_folder_templates = true` via direct SQL (`update public.profiles set can_manage_folder_templates = true where id = '<cam's auth.users id>'` — insert the row first if none exists) so he can actually reach `/admin/folder-templates`. No UI exists to do this yet (tracked as a known gap, same shape as the SSN/DOB "not there yet" precedent).
2. Update `Genesis Build Log.md` with what shipped (per the vault's own recurring "documentation lag" lesson from the 2026-08-27 audit).
3. Move to the next item in the agreed build order: Checklist Tasks.
