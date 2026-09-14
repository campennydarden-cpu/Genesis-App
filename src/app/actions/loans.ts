'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { LOAN_TYPES } from '@/lib/constants'
import type { Loan } from '@/lib/types'

export async function listLoans(orderId: string): Promise<Loan[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('loans').select('*').eq('order_id', orderId).order('sort_order').order('created_at')
  return data ?? []
}

// The one loan every other screen's seeding relationship reads from. Returns
// null for an order with no loans yet -- every caller treats that as "no
// seed available," not an error. Secondary sort on created_at is a
// deterministic tiebreaker for the (order_id, sort_order) unique index --
// ties shouldn't occur, but if they ever do, "primary" stays stable.
export async function getPrimaryLoan(orderId: string): Promise<Loan | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('loans')
    .select('*')
    .eq('order_id', orderId)
    .order('sort_order')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  return data
}

export async function addLoan(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: last } = await supabase
    .from('loans')
    .select('sort_order')
    .eq('order_id', orderId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSortOrder = last ? last.sort_order + 1 : 0
  const isFirstLoan = nextSortOrder === 0
  let seedPrincipal: number | null = null
  if (isFirstLoan) {
    const { data: order } = await supabase.from('orders').select('loan_amount').eq('id', orderId).single()
    seedPrincipal = order?.loan_amount ?? null
  }

  const { error } = await supabase
    .from('loans')
    .insert({ order_id: orderId, sort_order: nextSortOrder, principal_amount: seedPrincipal })

  if (error) {
    console.error('addLoan failed:', error)
    return { error: 'Could not add. Please try again.' }
  }

  revalidatePath('/', 'layout')
  return {}
}

export async function updateLoan(orderId: string, id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const strOrNull = (key: string) => (formData.get(key) as string) || null
  const numOrNull = (key: string) => (formData.get(key) ? Number(formData.get(key)) : null)

  const loanType = strOrNull('loan_type')
  if (loanType && !(LOAN_TYPES as readonly string[]).includes(loanType)) {
    return { error: 'Invalid loan type.' }
  }

  const { error } = await supabase
    .from('loans')
    .update({
      lender_contact_id: strOrNull('lender_contact_id'),
      principal_amount: numOrNull('principal_amount'),
      annual_interest_rate: numOrNull('annual_interest_rate'),
      loan_number: strOrNull('loan_number'),
      loan_type: loanType,
      construction_equity_draw_amount: numOrNull('construction_equity_draw_amount'),
    })
    .eq('id', id)
    .eq('order_id', orderId)

  if (error) {
    console.error('updateLoan failed:', error)
    return { error: 'Could not save. Please try again.' }
  }

  revalidatePath('/', 'layout')
  return {}
}

export async function deleteLoan(orderId: string, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('loans').delete().eq('id', id).eq('order_id', orderId)

  if (error) {
    console.error('deleteLoan failed:', error)
    return { error: 'Could not remove. Please try again.' }
  }

  revalidatePath('/', 'layout')
  return {}
}
