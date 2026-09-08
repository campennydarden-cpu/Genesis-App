'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireChecklistTemplatePermission } from '@/lib/permissions'
import { CHECKLIST_MILESTONES } from '@/lib/constants'
import type { ChecklistTaskTemplate } from '@/lib/types'

export async function listChecklistTemplates(): Promise<ChecklistTaskTemplate[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('checklist_task_templates').select('*').order('sort_order')
  return data ?? []
}

async function nextTemplateSortOrder(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number> {
  const { count } = await supabase
    .from('checklist_task_templates')
    .select('*', { count: 'exact', head: true })
  return (count ?? 0) + 1
}

export async function createChecklistTemplate(
  description: string,
  milestone: (typeof CHECKLIST_MILESTONES)[number]
): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (!(await requireChecklistTemplatePermission(supabase))) {
    return { error: 'You do not have permission to manage checklist templates.' }
  }

  const sortOrder = await nextTemplateSortOrder(supabase)

  const { error } = await supabase
    .from('checklist_task_templates')
    .insert({ description, milestone, sort_order: sortOrder })

  if (error) {
    console.error('createChecklistTemplate failed:', error)
    return { error: 'Could not create checklist template. Please try again.' }
  }

  revalidatePath('/admin/checklist-templates')
  return {}
}

export async function updateChecklistTemplate(
  id: string,
  description: string,
  milestone: (typeof CHECKLIST_MILESTONES)[number]
): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (!(await requireChecklistTemplatePermission(supabase))) {
    return { error: 'You do not have permission to manage checklist templates.' }
  }

  const { error } = await supabase
    .from('checklist_task_templates')
    .update({ description, milestone })
    .eq('id', id)

  if (error) {
    console.error('updateChecklistTemplate failed:', error)
    return { error: 'Could not update checklist template. Please try again.' }
  }

  revalidatePath('/admin/checklist-templates')
  return {}
}

export async function deleteChecklistTemplate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (!(await requireChecklistTemplatePermission(supabase))) {
    return { error: 'You do not have permission to manage checklist templates.' }
  }

  const { error } = await supabase.from('checklist_task_templates').delete().eq('id', id)

  if (error) {
    console.error('deleteChecklistTemplate failed:', error)
    return { error: 'Could not delete checklist template. Please try again.' }
  }

  revalidatePath('/admin/checklist-templates')
  return {}
}
