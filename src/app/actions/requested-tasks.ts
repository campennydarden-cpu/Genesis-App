'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { RequestedTask } from '@/lib/types'

export async function listRequestedTasks(orderId: string): Promise<RequestedTask[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('requested_tasks')
    .select('*')
    .eq('order_id', orderId)
    .order('sort_order')
  return data ?? []
}

async function nextSortOrder(supabase: Awaited<ReturnType<typeof createClient>>, orderId: string): Promise<number> {
  const { count } = await supabase
    .from('requested_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)
  return (count ?? 0) + 1
}

export async function addRequestedTask(orderId: string, taskName: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const sortOrder = await nextSortOrder(supabase, orderId)

  const { error } = await supabase
    .from('requested_tasks')
    .insert({ order_id: orderId, task_name: taskName, sort_order: sortOrder })

  if (error) {
    console.error('addRequestedTask failed:', error)
    return { error: 'Could not add task. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function updateRequestedTaskStatus(
  id: string,
  orderId: string,
  status: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('requested_tasks')
    .select('received_date')
    .eq('id', id)
    .single()

  const receivedDate =
    status === 'Received' && !existing?.received_date ? new Date().toISOString().slice(0, 10) : existing?.received_date

  const { error } = await supabase
    .from('requested_tasks')
    .update({ status, received_date: receivedDate ?? null })
    .eq('id', id)

  if (error) {
    console.error('updateRequestedTaskStatus failed:', error)
    return { error: 'Could not update status. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function updateRequestedTask(
  id: string,
  orderId: string,
  fields: {
    requested_date?: string | null
    requested_due_date?: string | null
    due_date?: string | null
    received_date?: string | null
    notes?: string | null
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('requested_tasks').update(fields).eq('id', id)

  if (error) {
    console.error('updateRequestedTask failed:', error)
    return { error: 'Could not update task. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function deleteRequestedTask(id: string, orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('requested_tasks').delete().eq('id', id)

  if (error) {
    console.error('deleteRequestedTask failed:', error)
    return { error: 'Could not delete task. Please try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  return {}
}
