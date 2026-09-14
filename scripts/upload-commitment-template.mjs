// scripts/upload-commitment-template.mjs
// One-time upload of the Commitment template .docx into Storage and its
// document_templates row. Run manually after authoring the template with the
// 11 tagged Content Controls listed in the Phase 1a plan:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/upload-commitment-template.mjs /path/to/commitment-template.docx
//
// Uses the service-role key (bypasses RLS), matching scripts/import-zip-lookup.mjs's
// established pattern for one-off admin/operator scripts in this codebase.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node scripts/upload-commitment-template.mjs <path-to-template.docx>')
  process.exit(1)
}

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)
const fileBytes = readFileSync(filePath)
const storagePath = 'commitment/template.docx'

const { error: uploadError } = await supabase.storage
  .from('document-templates')
  .upload(storagePath, fileBytes, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    upsert: true,
  })
if (uploadError) {
  console.error('Upload failed:', uploadError.message)
  process.exit(1)
}

const { error: upsertError } = await supabase
  .from('document_templates')
  .upsert({ document_type: 'commitment', storage_path: storagePath }, { onConflict: 'document_type' })
if (upsertError) {
  console.error('document_templates upsert failed:', upsertError.message)
  process.exit(1)
}

console.log(`Uploaded ${filePath} -> document-templates/${storagePath}, document_templates row upserted.`)
