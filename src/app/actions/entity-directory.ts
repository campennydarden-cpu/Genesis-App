'use server'

import { createClient } from '@/lib/supabase/server'
import type { EntityDirectoryRecord, EntityDirectoryRoleType } from '@/lib/types'

export async function searchEntityDirectory(
  roleType: EntityDirectoryRoleType,
  query: string
): Promise<EntityDirectoryRecord[]> {
  const supabase = await createClient()
  if (!query.trim()) return []

  const { data, error } = await supabase.rpc('search_entity_directory', {
    p_role_type: roleType,
    p_query: query,
    p_limit: 10,
  })

  if (error) {
    console.error('searchEntityDirectory failed:', error)
    return []
  }

  return data as EntityDirectoryRecord[]
}

function formDataToRecord(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') result[key] = value
  }
  return result
}

async function insertDirectoryRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roleType: EntityDirectoryRoleType,
  fields: Record<string, string>
): Promise<EntityDirectoryRecord> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('entity_directory')
    .insert({
      role_type: roleType,
      name: fields.name,
      address_line1: fields.address_line1 || null,
      address_line2: fields.address_line2 || null,
      city: fields.city || null,
      state: fields.state || null,
      zip: fields.zip || null,
      county: fields.county || null,
      phone: fields.phone || null,
      fax: fields.fax || null,
      email: fields.email || null,
      license_number: fields.license_number || null,
      details: {
        nmls_number: fields.nmls_number || null,
        cdf_payee_type: fields.cdf_payee_type || null,
        proposed_insured_clause: fields.proposed_insured_clause || null,
        vesting_loss_payable: fields.vesting_loss_payable || null,
        settlement_type_preference: fields.settlement_type_preference || null,
        cd_hud_preference: fields.cd_hud_preference || null,
        premium_policy_type_default: fields.premium_policy_type_default || null,
        endorsement_defaults: fields.endorsement_defaults || null,
        communication_routing: fields.communication_routing || null,
      },
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`insertDirectoryRow failed: ${error.message}`)
  return data as EntityDirectoryRecord
}

export async function createDirectoryEntry(
  roleType: EntityDirectoryRoleType,
  formData: FormData
): Promise<
  | { status: 'created'; record: EntityDirectoryRecord }
  | {
      status: 'duplicates_found'
      candidates: EntityDirectoryRecord[]
      pendingName: string
      pendingFormData: Record<string, string>
    }
> {
  const supabase = await createClient()
  const fields = formDataToRecord(formData)
  const name = fields.name

  const { data: candidates, error: dupError } = await supabase.rpc('find_entity_directory_duplicates', {
    p_role_type: roleType,
    p_name: name,
    p_threshold: 0.45,
  })

  if (dupError) {
    console.error('find_entity_directory_duplicates failed:', dupError)
  }

  if (candidates && candidates.length > 0) {
    return {
      status: 'duplicates_found',
      candidates: candidates as EntityDirectoryRecord[],
      pendingName: name,
      pendingFormData: fields,
    }
  }

  const record = await insertDirectoryRow(supabase, roleType, fields)
  return { status: 'created', record }
}

export async function confirmCreateAsNew(
  roleType: EntityDirectoryRoleType,
  pendingFormData: Record<string, string>
): Promise<EntityDirectoryRecord> {
  const supabase = await createClient()
  return insertDirectoryRow(supabase, roleType, pendingFormData)
}

export async function mergeIntoExisting(
  existingId: string,
  pendingFormData: Record<string, string>
): Promise<EntityDirectoryRecord> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('entity_directory')
    .update({
      name: pendingFormData.name,
      address_line1: pendingFormData.address_line1 || null,
      address_line2: pendingFormData.address_line2 || null,
      city: pendingFormData.city || null,
      state: pendingFormData.state || null,
      zip: pendingFormData.zip || null,
      county: pendingFormData.county || null,
      phone: pendingFormData.phone || null,
      fax: pendingFormData.fax || null,
      email: pendingFormData.email || null,
      license_number: pendingFormData.license_number || null,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existingId)
    .select()
    .single()

  if (error) throw new Error(`mergeIntoExisting failed: ${error.message}`)
  return data as EntityDirectoryRecord
}

export async function deactivateDirectoryEntry(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('entity_directory').update({ is_active: false }).eq('id', id)

  if (error) throw new Error(`deactivateDirectoryEntry failed: ${error.message}`)
}
