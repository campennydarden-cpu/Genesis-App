// src/lib/template-tags.test.ts
import { parseTemplateTags, renderTemplateBody, siClauseTags, lienFullText } from './template-tags'
import type { SecurityInstrument, Lien } from './types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`PASS: ${msg}`)
}

assert(
  JSON.stringify(parseTemplateTags('Release of {{security_instrument.type}}, {{property.county}}')) ===
    JSON.stringify([
      { namespace: 'security_instrument', field: 'type' },
      { namespace: 'property', field: 'county' },
    ]),
  'parseTemplateTags finds all distinct tags in order'
)

assert(
  renderTemplateBody('{{property.county}} County', { 'property.county': 'Fulton' }) === 'Fulton County',
  'renderTemplateBody substitutes a present value'
)

assert(
  renderTemplateBody('{{property.county}} County', {}) === '[County] County',
  'renderTemplateBody falls back to the bracket placeholder when a key is undefined'
)

assert(
  renderTemplateBody('a{{lien.type}}b', { 'lien.type': '' }) === 'ab',
  'renderTemplateBody renders an explicit empty string as nothing, not a bracket'
)

const siNoTrustee = {
  type: 'Mortgage', mortgagor: 'Jane Smith', mortgagee: 'First National', trustee: null,
  dated_date: null, recorded_date: null, book: null, page: null, instrument_number: null, original_amount: null,
} as unknown as SecurityInstrument
const clauses = siClauseTags(siNoTrustee)
assert(
  clauses['security_instrument.party_clause'] === 'executed by Jane Smith to First National',
  'siClauseTags omits the trustee clause when trustee is null'
)
assert(clauses['security_instrument.optional_clauses'] === '', 'siClauseTags produces no optional clause text when all fields are absent')

const lisPendens = { type: 'Lis Pendens', plaintiff: 'ACME Corp', defendant: 'John Doe', case_number: '2024-CV-100', court: 'Superior Court' } as unknown as Lien
assert(
  lienFullText(lisPendens).startsWith('Dismissal of Lis Pendens filed by ACME Corp against John Doe'),
  'lienFullText branches to Dismissal wording for Lis Pendens'
)

console.log('All template-tags assertions passed.')
