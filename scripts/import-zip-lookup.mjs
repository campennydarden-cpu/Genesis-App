// One-time import of uszips.csv (SimpleMaps) into the zip_lookup table.
// Run manually, once per environment, after migration 0014_zip_lookup.sql lands:
//
//   SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=... \
//     node scripts/import-zip-lookup.mjs /path/to/uszips.csv
//
// Uses the service-role key (bypasses RLS for the bulk write) -- never the anon key.
// Not run automatically and not part of the build; this is an admin/operator step,
// matching Cam's own framing of zip data as static reference data managed via CSV.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: node scripts/import-zip-lookup.mjs <path-to-uszips.csv>')
  process.exit(1)
}

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
  process.exit(1)
}

// Minimal RFC4180-style parser: handles quoted fields, embedded commas, and "" escaping
// (uszips.csv's county_weights column is a quoted JSON blob containing both).
function parseCsvLine(line) {
  const fields = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      fields.push(field)
      field = ''
    } else {
      field += c
    }
  }
  fields.push(field)
  return fields
}

const lines = readFileSync(csvPath, 'utf-8').split('\n').filter((l) => l.trim().length > 0)
const header = parseCsvLine(lines[0])
const col = Object.fromEntries(header.map((name, i) => [name, i]))

const supabase = createClient(supabaseUrl, serviceRoleKey)

const BATCH_SIZE = 1000
let batch = []
let total = 0

async function flush() {
  if (batch.length === 0) return
  const { error } = await supabase.from('zip_lookup').upsert(batch, { onConflict: 'zip' })
  if (error) {
    console.error('Batch upsert failed:', error.message)
    process.exit(1)
  }
  total += batch.length
  console.log(`Imported ${total} rows...`)
  batch = []
}

for (let i = 1; i < lines.length; i++) {
  const f = parseCsvLine(lines[i])
  const zip = f[col.zip]
  if (!zip) continue

  let countyWeights = {}
  try {
    countyWeights = JSON.parse(f[col.county_weights] || '{}')
  } catch {
    countyWeights = {}
  }
  const namesAll = (f[col.county_names_all] || f[col.county_name]).split('|')
  const fipsAll = (f[col.county_fips_all] || f[col.county_fips]).split('|')
  const counties = namesAll
    .map((name, idx) => ({
      name,
      fips: fipsAll[idx] ?? null,
      weight: countyWeights[fipsAll[idx]] ?? (idx === 0 ? 100 : 0),
    }))
    .sort((a, b) => b.weight - a.weight)

  batch.push({
    zip,
    city: f[col.city],
    state: f[col.state_id],
    state_name: f[col.state_name],
    primary_county: f[col.county_name],
    counties,
  })

  if (batch.length >= BATCH_SIZE) await flush()
}
await flush()

console.log(`Done. ${total} zip rows imported into zip_lookup.`)
