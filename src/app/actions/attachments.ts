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

  const { data: templates, error: templatesError } = await supabase
    .from('folder_templates')
    .select('id, name, sort_order, parent_folder_template_id')
    .order('sort_order')

  if (templatesError) {
    console.error('copyFolderTemplateForOrder failed to read folder_templates:', templatesError)
    return
  }
  if (!templates || templates.length === 0) return

  const topLevel = templates.filter((t) => !t.parent_folder_template_id)
  const children = templates.filter((t) => t.parent_folder_template_id)

  const templateIdToNewId = new Map<string, string>()

  for (const t of topLevel) {
    const { data, error } = await supabase
      .from('attachment_folders')
      .insert({ order_id: orderId, name: t.name, sort_order: t.sort_order, source_template_id: t.id })
      .select('id')
      .single()
    if (error) {
      console.error(`copyFolderTemplateForOrder failed to insert top-level folder "${t.name}":`, error)
      continue
    }
    if (data) templateIdToNewId.set(t.id, data.id)
  }

  for (const t of children) {
    const parentId = templateIdToNewId.get(t.parent_folder_template_id as string)
    if (!parentId) continue
    const { error } = await supabase.from('attachment_folders').insert({
      order_id: orderId,
      name: t.name,
      sort_order: t.sort_order,
      parent_folder_id: parentId,
      source_template_id: t.id,
    })
    if (error) {
      console.error(`copyFolderTemplateForOrder failed to insert child folder "${t.name}":`, error)
    }
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

// PostgREST's .or() filter grammar uses `,` to separate conditions and `()` to group them,
// so a search term containing either (e.g. "Smith, John - Deed.pdf") must have them
// backslash-escaped or it breaks the filter parse and silently returns zero rows.
function escapePostgrestFilterValue(value: string): string {
  return value.replace(/[,()]/g, '\\$&')
}

export async function searchAttachments(
  orderId: string,
  query: string
): Promise<Array<Attachment & { folderPath: string }>> {
  const supabase = await createClient()
  const escapedQuery = escapePostgrestFilterValue(query)

  const [{ data: folders }, { data: attachments }] = await Promise.all([
    supabase.from('attachment_folders').select('*').eq('order_id', orderId),
    supabase
      .from('attachments')
      .select('*')
      .eq('order_id', orderId)
      .or(`name.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%`),
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
