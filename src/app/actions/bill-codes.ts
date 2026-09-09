'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireBillCodePermission } from '@/lib/permissions'
import type { BillCode } from '@/lib/types'

export async function listBillCodes(): Promise<BillCode[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('bill_codes').select('*').order('sort_order')
  return data ?? []
}

async function nextBillCodeSortOrder(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number> {
  const { count } = await supabase.from('bill_codes').select('*', { count: 'exact', head: true })
  return (count ?? 0) + 1
}

export async function createBillCode(code: string, description: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (!(await requireBillCodePermission(supabase))) {
    return { error: 'You do not have permission to manage bill codes.' }
  }

  const sortOrder = await nextBillCodeSortOrder(supabase)

  const { error } = await supabase
    .from('bill_codes')
    .insert({ code, description: description || null, sort_order: sortOrder })

  if (error) {
    console.error('createBillCode failed:', error)
    return { error: 'Could not create bill code. Please try again.' }
  }

  revalidatePath('/admin/bill-codes')
  return {}
}

export async function updateBillCode(id: string, code: string, description: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (!(await requireBillCodePermission(supabase))) {
    return { error: 'You do not have permission to manage bill codes.' }
  }

  const { error } = await supabase
    .from('bill_codes')
    .update({ code, description: description || null })
    .eq('id', id)

  if (error) {
    console.error('updateBillCode failed:', error)
    return { error: 'Could not update bill code. Please try again.' }
  }

  revalidatePath('/admin/bill-codes')
  return {}
}

export async function deleteBillCode(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (!(await requireBillCodePermission(supabase))) {
    return { error: 'You do not have permission to manage bill codes.' }
  }

  const { error } = await supabase.from('bill_codes').delete().eq('id', id)

  if (error) {
    console.error('deleteBillCode failed:', error)
    return { error: 'Could not delete bill code. Please try again.' }
  }

  revalidatePath('/admin/bill-codes')
  return {}
}
