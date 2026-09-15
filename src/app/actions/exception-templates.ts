'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import type { ExceptionTemplate, ExceptionTemplateVariant } from '@/lib/types'

async function requirePermission() {
  const supabase = await createClient()
  if (!(await hasPermission(supabase, 'manage_requirement_templates'))) {
    redirect('/orders')
  }
  return supabase
}

export async function listExceptionTemplates(): Promise<
  (ExceptionTemplate & { variants: ExceptionTemplateVariant[] })[]
> {
  const supabase = await createClient()
  const { data: templates } = await supabase.from('exception_templates').select('*').order('label')
  const { data: variants } = await supabase.from('exception_template_variants').select('*')
  return (templates ?? []).map((t) => ({
    ...t,
    variants: (variants ?? []).filter((v) => v.template_id === t.id),
  }))
}

export async function createExceptionTemplate(formData: FormData) {
  const supabase = await requirePermission()
  const category = formData.get('category') as string
  const label = formData.get('label') as string
  const body = formData.get('body') as string
  const parentTemplateId = (formData.get('parent_template_id') as string) || null

  const { error } = await supabase.from('exception_templates').insert({ category, label, body, parent_template_id: parentTemplateId })
  if (error) console.error('createExceptionTemplate failed:', error)
  revalidatePath('/', 'layout')
}

export async function updateExceptionTemplate(templateId: string, formData: FormData) {
  const supabase = await requirePermission()
  const category = formData.get('category') as string
  const label = formData.get('label') as string
  const body = formData.get('body') as string

  const { error } = await supabase
    .from('exception_templates')
    .update({ category, label, body, updated_at: new Date().toISOString() })
    .eq('id', templateId)
  if (error) console.error('updateExceptionTemplate failed:', error)
  revalidatePath('/', 'layout')
}

export async function setExceptionTemplateActive(templateId: string, active: boolean) {
  const supabase = await requirePermission()
  const { error } = await supabase.from('exception_templates').update({ active }).eq('id', templateId)
  if (error) console.error('setExceptionTemplateActive failed:', error)
  revalidatePath('/', 'layout')
}

export async function upsertExceptionTemplateVariant(templateId: string, formData: FormData) {
  const supabase = await requirePermission()
  const state = (formData.get('state') as string) || null
  const body = formData.get('body') as string

  const { error } = await supabase
    .from('exception_template_variants')
    .upsert({ template_id: templateId, state, body }, { onConflict: 'template_id,state' })
  if (error) console.error('upsertExceptionTemplateVariant failed:', error)
  revalidatePath('/', 'layout')
}

export async function deleteExceptionTemplateVariant(variantId: string) {
  const supabase = await requirePermission()
  const { error } = await supabase.from('exception_template_variants').delete().eq('id', variantId)
  if (error) console.error('deleteExceptionTemplateVariant failed:', error)
  revalidatePath('/', 'layout')
}
