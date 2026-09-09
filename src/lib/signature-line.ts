// src/lib/signature-line.ts

export type SignatureEntityType = 'Individual' | 'LLC' | 'Corporation' | 'Partnership' | 'Trust' | 'Estate' | 'Other'

export type SignaturePrincipal = {
  name: string
  role: string | null
}

const ROSTER_LABELS: Partial<Record<SignatureEntityType, string>> = {
  LLC: 'limited liability company',
  Corporation: 'corporation',
  Partnership: 'partnership',
}

/**
 * Builds the default text for a contact's signature line(s), per Cam's exact supplied wording
 * (Cam's Screen Notes, 2026-09-09): a signature-block format (blank line + printed name/role)
 * distinct from the narrative Vesting/Derivation Clause `entityQualifiedName()` produces —
 * a signature line is meant to sit on a printed document with a blank for the physical
 * signature, not read as a sentence.
 */
export function defaultSignatureLine({
  name,
  entityType,
  principals,
  poa,
  attorneyInFactName,
}: {
  name: string | null
  entityType: SignatureEntityType | null
  principals: SignaturePrincipal[]
  poa: boolean
  attorneyInFactName: string | null
}): string {
  // POA takes precedence when flagged and an Attorney-in-Fact name is on file (from Power of
  // Attorney doc-prep) — "PRINCIPAL, by AGENT, its Attorney-in-Fact", per Cam's exact wording.
  if (poa && attorneyInFactName) {
    return `${name || '[Principal Name]'}, by ${attorneyInFactName}, its Attorney-in-Fact`
  }

  if (entityType === 'Trust') {
    const trustName = name || '[Trust Name]'
    const signerLines =
      principals.length === 0
        ? '________________________________ [Trustee not yet added], Trustee'
        : principals.map((p) => `________________________________ ${p.name}, Trustee`).join('\n')
    return `${trustName} by:\n${signerLines}`
  }

  const rosterLabel = entityType ? ROSTER_LABELS[entityType] : undefined
  if (rosterLabel) {
    const entityName = name || '[Entity Name]'
    const signerLines =
      principals.length === 0
        ? '________________________________ [Signer not yet added], Its: ___________'
        : principals.map((p) => `________________________________ ${p.name}, Its: ${p.role || '___________'}`).join('\n')
    return `${entityName}, a [State] ${rosterLabel} by:\n${signerLines}`
  }

  return name ?? ''
}
