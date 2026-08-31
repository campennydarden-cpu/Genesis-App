// src/lib/derivation-clause.ts

export type EntityType = 'Individual' | 'LLC' | 'Corporation' | 'Partnership' | 'Trust' | 'Estate' | 'Other'

export type PrincipalRecord = {
  name: string
  role: string | null
}

export type DerivationClauseInput = {
  granteeName: string | null
  granteeEntityType: EntityType | null
  grantorName: string | null
  grantorEntityType: EntityType | null
  instrumentType: string | null
  recordedDate: string | null
  book: string | null
  page: string | null
  instrumentNumber: string | null
  isPortion: boolean
  county: string | null
}

const ROSTER_ENTITY_TYPES: EntityType[] = ['LLC', 'Corporation', 'Partnership', 'Trust']

/** Formats a `YYYY-MM-DD` date string as "January 5, 2026". Returns '' for falsy input. */
export function fmtDate(value: string | null): string {
  if (!value) return ''
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/**
 * Builds the "qualified name" used in generated clauses: a plain name for
 * Individual/Estate/Other, or an entity-qualified phrase built from the
 * name plus its principal roster for LLC/Corporation/Partnership/Trust.
 */
export function entityQualifiedName(
  name: string | null,
  entityType: EntityType | null,
  principals: PrincipalRecord[]
): string {
  const hasRoster = entityType !== null && ROSTER_ENTITY_TYPES.includes(entityType)
  if (!name && !hasRoster) return name ?? ''

  switch (entityType) {
    case 'Trust': {
      const trustees = principals.map((p) => p.name).filter(Boolean)
      if (trustees.length === 0) return `[Trustee(s) not yet added] of the ${name || '[Trust Name]'}`
      const label = trustees.length > 1 ? 'Trustees' : 'Trustee'
      return `${trustees.join(' and ')}, as ${label} of the ${name || '[Trust Name]'}`
    }
    case 'LLC':
    case 'Corporation':
    case 'Partnership': {
      const base = name || '[Entity Name]'
      const names = principals.map((p) => p.name + (p.role ? ` (${p.role})` : '')).filter(Boolean)
      return base + (names.length ? `, by ${names.join(', ')}` : '')
    }
    default:
      return name ?? ''
  }
}

/** Vesting Clause — the Grantee's qualified name, or '' if there's nothing to show yet. */
export function derivationVestingClause(
  granteeName: string | null,
  granteeEntityType: EntityType | null,
  principals: PrincipalRecord[]
): string {
  const hasRoster = granteeEntityType !== null && ROSTER_ENTITY_TYPES.includes(granteeEntityType)
  if (!granteeName && !hasRoster) return granteeName ?? ''
  return entityQualifiedName(granteeName, granteeEntityType, principals)
}

/**
 * Full Derivation Clause sentence. Renders '' until Grantee Name, Instrument
 * Type, Grantor Name, Recorded Date, and County are all present.
 */
export function fullDerivationClause(
  input: DerivationClauseInput,
  granteePrincipals: PrincipalRecord[],
  grantorPrincipals: PrincipalRecord[]
): string {
  const {
    granteeName,
    granteeEntityType,
    grantorName,
    grantorEntityType,
    instrumentType,
    recordedDate,
    book,
    page,
    instrumentNumber,
    isPortion,
    county,
  } = input

  if (!(granteeName && instrumentType && grantorName && recordedDate && county)) return ''

  const recordingParts: string[] = []
  if (book || page) recordingParts.push(`Book ${book || '—'}, Page ${page || '—'}`)
  if (instrumentNumber) recordingParts.push(`Instrument No. ${instrumentNumber}`)
  const recording = recordingParts.length ? ` as ${recordingParts.join(', ')}` : ''

  const granteeQualified = entityQualifiedName(granteeName, granteeEntityType, granteePrincipals)
  const grantorQualified = entityQualifiedName(grantorName, grantorEntityType, grantorPrincipals)
  const parcelPhrase = isPortion ? 'Being a portion of the same parcel' : 'Being the same parcel'

  return (
    `${parcelPhrase} conveyed unto ${granteeQualified} by ${instrumentType} of ${grantorQualified}` +
    ` recorded ${fmtDate(recordedDate)}${recording} of the ${county} County records.`
  )
}
