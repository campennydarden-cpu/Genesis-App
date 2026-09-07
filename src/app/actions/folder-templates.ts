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
