import type {
  SecurityInstrument,
  SecurityInstrumentRelatedDoc,
  Lien,
  ExceptionMatter,
  PropertyEasement,
  PropertyDetails,
  Order,
  PrelimSearch,
  Contact,
  RequirementTemplateVariant,
  ExceptionTemplateVariant,
} from '@/lib/types'
import { fmtDate, fmtCurrency } from '@/lib/format'

const TAG_PATTERN = /\{\{\s*([a-z0-9_]+)\.([a-z0-9_]+)\s*\}\}/g

const BRACKET_LABELS: Record<string, string> = {
  'security_instrument.mortgagor': 'Mortgagor',
  'security_instrument.mortgagee': 'Mortgagee',
  'security_instrument.type': 'Security Instrument',
  'security_instrument.trustee': 'Trustee',
  'lien.creditor': 'Creditor',
  'lien.debtor': 'Debtor',
  'lien.amount': 'Amount',
  'lien.type': 'Lien Type',
  'related_document.type': 'Related Document',
  'related_document.assignor': 'Assignor',
  'related_document.assignee': 'Assignee',
  'exception_matter.description': 'Matter',
  'easement.type': 'Easement Type',
  'easement.description': 'Easement Description',
  'deed.type': 'Deed Type',
  'loan.principal_amount': 'Loan Amount',
  'contact.buyer_names': 'Buyer/Borrower',
  'contact.seller_names': 'Seller',
  'property.county': 'County',
  'property.state': 'State',
  'property.legal_description': 'Legal Description',
  'order.file_number': 'File Number',
  'order.effective_date': 'Effective Date',
}

/** Returns every distinct `{{namespace.field}}` reference found in a template body. */
export function parseTemplateTags(body: string): { namespace: string; field: string }[] {
  const matches: { namespace: string; field: string }[] = []
  const re = new RegExp(TAG_PATTERN)
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    matches.push({ namespace: m[1], field: m[2] })
  }
  return matches
}

/**
 * `undefined` in context means "required field, missing" -> renders the bracket
 * placeholder (e.g. "[Mortgagor]"), matching the existing missing-data convention.
 * An empty string means "optional clause, legitimately absent" -> renders nothing.
 * This distinction is why clause-builder functions below always provide a string
 * (possibly ''), while simple field tags pass `?? undefined`.
 */
export function renderTemplateBody(body: string, context: Record<string, string | undefined>): string {
  return body.replace(TAG_PATTERN, (_whole, namespace: string, field: string) => {
    const key = `${namespace}.${field}`
    const value = context[key]
    if (value === undefined) return `[${BRACKET_LABELS[key] ?? key}]`
    return value
  })
}

/** Picks the order's state-specific variant body, falling back to the template's own body. */
export function resolveVariantBody(
  templateBody: string,
  variants: (RequirementTemplateVariant | ExceptionTemplateVariant)[],
  state: string | null
): string {
  if (state) {
    const match = variants.find((v) => v.state === state)
    if (match) return match.body
  }
  const general = variants.find((v) => v.state === null)
  return general ? general.body : templateBody
}

export function buildFileLevelTags(params: {
  order: Order
  property: PropertyDetails | null
  prelimSearch: PrelimSearch | null
  contacts: Contact[]
}): Record<string, string | undefined> {
  const { order, property, prelimSearch, contacts } = params
  const namesByRole = (role: string) => {
    const names = contacts.filter((c) => c.role === role).map((c) => c.name)
    return names.length ? names.join(' and ') : undefined
  }
  return {
    'property.county': property?.county ?? undefined,
    'property.state': property?.state ?? undefined,
    'property.legal_description': property?.full_legal_description ?? undefined,
    'order.file_number': order.file_number,
    'order.effective_date': prelimSearch?.effective_date ? fmtDate(prelimSearch.effective_date) : undefined,
    'contact.buyer_names': namesByRole('Buyer/Borrower'),
    'contact.seller_names': namesByRole('Seller'),
  }
}

export function siFieldTags(si: SecurityInstrument): Record<string, string | undefined> {
  return {
    'security_instrument.type': si.type || 'Security Instrument',
    'security_instrument.mortgagor': si.mortgagor ?? undefined,
    'security_instrument.mortgagee': si.mortgagee ?? undefined,
    'security_instrument.trustee': si.trustee ?? undefined,
  }
}

/**
 * Ported unchanged from the retired `siRequirementText` (src/lib/commitment-text.ts).
 * `party_clause` bakes in the trustee/no-trustee branch (structural, not wording — kept
 * as code); `optional_clauses` pre-joins the dated/recording/amount clauses with a
 * leading ", " so the seed template body can concatenate it directly without producing
 * doubled commas when a clause is absent.
 */
export function siClauseTags(si: SecurityInstrument): Record<string, string> {
  const partyClause = si.trustee
    ? `executed by ${si.mortgagor || '[Mortgagor]'} to ${si.trustee}, Trustee, for the benefit of ${si.mortgagee || '[Mortgagee]'}`
    : `executed by ${si.mortgagor || '[Mortgagor]'} to ${si.mortgagee || '[Mortgagee]'}`
  const parts: string[] = []
  if (si.dated_date) parts.push(`dated ${fmtDate(si.dated_date)}`)
  const recParts: string[] = []
  if (si.recorded_date) recParts.push(`recorded ${fmtDate(si.recorded_date)}`)
  const locBits: string[] = []
  if (si.book || si.page) locBits.push(`in Book ${si.book || '—'}, Page ${si.page || '—'}`)
  if (si.instrument_number) locBits.push(`Instrument No. ${si.instrument_number}`)
  if (locBits.length) recParts.push(locBits.join(', '))
  if (recParts.length) parts.push(recParts.join(' '))
  if (si.original_amount) parts.push(`securing an original amount of ${fmtCurrency(si.original_amount)}`)
  return {
    'security_instrument.party_clause': partyClause,
    'security_instrument.optional_clauses': parts.length ? `, ${parts.join(', ')}` : '',
  }
}

/** Ported unchanged from the retired `relRequirementText`. Same leading-comma convention as siClauseTags. */
export function relClauseTags(
  rel: SecurityInstrumentRelatedDoc,
  si: SecurityInstrument
): Record<string, string> {
  const parts: string[] = []
  if (rel.assignor || rel.assignee) parts.push(`from ${rel.assignor || '[Assignor]'} to ${rel.assignee || '[Assignee]'}`)
  if (rel.dated_date) parts.push(`dated ${fmtDate(rel.dated_date)}`)
  const recParts: string[] = []
  if (rel.recorded_date) recParts.push(`recorded ${fmtDate(rel.recorded_date)}`)
  const locBits: string[] = []
  if (rel.book || rel.page) locBits.push(`in Book ${rel.book || '—'}, Page ${rel.page || '—'}`)
  if (rel.instrument_number) locBits.push(`Instrument No. ${rel.instrument_number}`)
  if (locBits.length) recParts.push(locBits.join(', '))
  if (recParts.length) parts.push(recParts.join(' '))
  let affecting = `affecting the ${si.type || 'Security Instrument'}`
  const siLocBits: string[] = []
  if (si.book || si.page) siLocBits.push(`Book ${si.book || '—'}, Page ${si.page || '—'}`)
  if (si.instrument_number) siLocBits.push(`Instrument No. ${si.instrument_number}`)
  if (siLocBits.length) affecting += ` recorded as ${siLocBits.join(', ')}`
  parts.push(affecting)
  return {
    'related_document.type': rel.type || 'Related Document',
    'related_document.detail_clause': parts.join(', '),
  }
}

/**
 * Liens branch into 5 structurally different sentences by lien.type (Lis Pendens reads
 * as a dismissal, not a release/satisfaction; Tax/HOA/Mechanics/generic each pick a
 * different "in favor of" source). That's true today in the pre-existing
 * `lienRequirementText` too. Rather than fake a decomposition that would produce
 * wrong sentences for some lien types, this ports that function's full logic
 * unchanged as one opaque `lien.full_text` tag — the seed template body is just
 * `{{lien.full_text}}`. Liens are not wording-editable per-state through the admin
 * panel as a result; flagged as a known limitation, same one that exists today.
 */
export function lienFullText(lien: Lien): string {
  if (lien.type === 'Lis Pendens') {
    const parts: string[] = []
    if (lien.plaintiff || lien.defendant) parts.push(`filed by ${lien.plaintiff || '[Plaintiff]'} against ${lien.defendant || '[Defendant]'}`)
    if (lien.case_number) parts.push(`Case No. ${lien.case_number}`)
    if (lien.court) parts.push(`in ${lien.court}`)
    return `Dismissal of Lis Pendens ${parts.join(', ')}, to be released of record prior to closing.`
  }
  const favorOf =
    lien.type === 'Tax Lien'
      ? lien.taxing_authority || '[Taxing Authority]'
      : lien.type === 'HOA/COA Lien'
        ? lien.hoa_company || '[HOA/COA]'
        : lien.type === 'Mechanics Lien'
          ? lien.materialman || '[Materialman]'
          : lien.creditor || '[Creditor]'
  const parts: string[] = [`against ${lien.debtor || '[Debtor]'} in favor of ${favorOf}`]
  if (lien.tax_type) parts.push(`${lien.tax_type} tax`)
  if (lien.case_number) parts.push(`Case No. ${lien.case_number}`)
  if (lien.certificate_id) parts.push(`Certificate No. ${lien.certificate_id}`)
  const datedDate = lien.dated_date || lien.docket_date
  if (datedDate) parts.push(`dated ${fmtDate(datedDate)}`)
  const filedParts: string[] = []
  const filed = lien.filed_date || lien.recorded_date
  if (filed) filedParts.push(`filed ${fmtDate(filed)}`)
  if (lien.court) filedParts.push(`in ${lien.court}`)
  if (filedParts.length) parts.push(filedParts.join(' '))
  const recParts: string[] = []
  if (lien.book || lien.page) recParts.push(`Book ${lien.book || '—'}, Page ${lien.page || '—'}`)
  if (lien.instrument_number) recParts.push(`Instrument No. ${lien.instrument_number}`)
  if (recParts.length) parts.push(recParts.join(', '))
  if (lien.amount) parts.push(`in the amount of ${fmtCurrency(lien.amount)}`)
  if (lien.type === 'Tax Sale Certificate' && lien.redemption_expiration) {
    parts.push(`redemption period expiring ${fmtDate(lien.redemption_expiration)}`)
  }
  return `Satisfaction of ${lien.type} ${parts.join(', ')}, to be released of record prior to closing.`
}

export function emFieldTags(em: ExceptionMatter): Record<string, string | undefined> {
  return { 'exception_matter.description': em.description || undefined }
}

/** Ported unchanged from the retired `emExceptionText`. */
export function emClauseTags(em: ExceptionMatter): Record<string, string> {
  const recParts: string[] = []
  if (em.recorded_date) recParts.push(`recorded ${fmtDate(em.recorded_date)}`)
  else if (em.dated_date) recParts.push(`dated ${fmtDate(em.dated_date)}`)
  const locBits: string[] = []
  if (em.book || em.page) locBits.push(`in Book ${em.book || '—'}, Page ${em.page || '—'}`)
  if (em.instrument_number) locBits.push(`Instrument No. ${em.instrument_number}`)
  if (locBits.length) recParts.push(locBits.join(', '))
  return {
    'exception_matter.description_or_default': em.description || '(matter of record)',
    'exception_matter.recording_clause': recParts.length ? `, ${recParts.join(' ')}` : '',
  }
}

export function easementFieldTags(easement: PropertyEasement): Record<string, string | undefined> {
  const typeLabel = easement.type === 'Other' && easement.other_type_text ? easement.other_type_text : easement.type
  return {
    'easement.type': typeLabel || undefined,
    'easement.description': easement.description ?? undefined,
  }
}

/** New — Property Easements had no prior text generator. Draft wording, not ALTA-sourced; review in the admin panel. */
export function easementClauseTags(easement: PropertyEasement): Record<string, string> {
  return {
    'easement.description_clause': easement.description ? `: ${easement.description}` : '',
  }
}
