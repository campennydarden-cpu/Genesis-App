'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { CHECKLIST_MILESTONES } from '@/lib/constants'
import type { ChecklistTask } from '@/lib/types'

// Copies the firm's checklist_task_templates into a fresh order's checklist_tasks,
// same copy-once-then-decouple pattern as Attachments' copyFolderTemplateForOrder —
// a later edit to the firm template applies to new orders only. Cam's call,
// 2026-09-08: Checklist Tasks auto-populate on order creation (unlike Requested
// Tasks, which stay a manual per-order log with UI seed chips).
export async function copyChecklistTemplateForOrder(orderId: string): Promise<void> {
  const supabase = await createClient()

  const { data: templates, error } = await supabase
    .from('checklist_task_templates')
    .select('id, description, milestone, sort_order')
    .order('sort_order')

  if (error) {
    console.error('copyChecklistTemplateForOrder failed to read checklist_task_templates:', error)
    return
  }
  if (!templates || templates.length === 0) return

  const { error: insertError } = await supabase.from('checklist_tasks').insert(
    templates.map((t) => ({
      order_id: orderId,
      template_id: t.id,
      description: t.description,
      milestone: t.milestone,
      sort_order: t.sort_order,
    }))
  )

  if (insertError) {
    console.error('copyChecklistTemplateForOrder failed to insert checklist_tasks:', insertError)
  }
}

export async function listChecklistTasks(orderId: string): Promise<ChecklistTask[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('checklist_tasks')
    .select('*')
    .eq('order_id', orderId)
    .order('sort_order')
  return data ?? []
}

async function nextSortOrder(supabase: Awaited<ReturnType<typeof createClient>>, orderId: string): Promise<number> {
  const { count } = await supabase
    .from('checklist_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)
  return (count ?? 0) + 1
}

export async function addChecklistTask(
  orderId: string,
  description: string,
  milestone: (typeof CHECKLIST_MILESTONES)[number]
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const sortOrder = await nextSortOrder(supabase, orderId)

  const { error } = await supabase
    .from('checklist_tasks')
    .insert({ order_id: orderId, description, milestone, sort_order: sortOrder })

  if (error) {
    console.error('addChecklistTask failed:', error)
    return { error: 'Could not add task. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function updateChecklistTaskStatus(
  id: string,
  orderId: string,
  status: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('checklist_tasks')
    .update({ status, completed_date: status === 'Completed' ? new Date().toISOString().slice(0, 10) : null })
    .eq('id', id)

  if (error) {
    console.error('updateChecklistTaskStatus failed:', error)
    return { error: 'Could not update status. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function updateChecklistTaskDueDate(
  id: string,
  orderId: string,
  dueDate: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('checklist_tasks').update({ due_date: dueDate }).eq('id', id)

  if (error) {
    console.error('updateChecklistTaskDueDate failed:', error)
    return { error: 'Could not update due date. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function deleteChecklistTask(id: string, orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('checklist_tasks').delete().eq('id', id)

  if (error) {
    console.error('deleteChecklistTask failed:', error)
    return { error: 'Could not delete task. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  return {}
}
