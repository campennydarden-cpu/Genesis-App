import type { SecurityInstrument, SecurityInstrumentRelatedDoc, Lien, ExceptionMatter, CommitmentRequirement } from '@/lib/types'

export function siRequirementText(si: SecurityInstrument): string {
  const instr = si.type || 'Security Instrument'
  const partyClause = si.trustee
    ? `executed by ${si.mortgagor || '[Mortgagor]'} to ${si.trustee}, Trustee, for the benefit of ${si.mortgagee || '[Mortgagee]'}`
    : `executed by ${si.mortgagor || '[Mortgagor]'} to ${si.mortgagee || '[Mortgagee]'}`
  const parts: string[] = [partyClause]
  if (si.dated_date) parts.push(`dated ${si.dated_date}`)
  const recParts: string[] = []
  if (si.recorded_date) recParts.push(`recorded ${si.recorded_date}`)
  const locBits: string[] = []
  if (si.book || si.page) locBits.push(`in Book ${si.book || '—'}, Page ${si.page || '—'}`)
  if (si.instrument_number) locBits.push(`Instrument No. ${si.instrument_number}`)
  if (locBits.length) recParts.push(locBits.join(', '))
  if (recParts.length) parts.push(recParts.join(' '))
  if (si.original_amount) parts.push(`securing an original amount of ${si.original_amount}`)
  return `Release of ${instr} ${parts.join(', ')}, to be released of record prior to closing.`
}

export function relRequirementText(rel: SecurityInstrumentRelatedDoc, si: SecurityInstrument): string {
  const docType = rel.type || 'Related Document'
  const parts: string[] = []
  if (rel.assignor || rel.assignee) parts.push(`from ${rel.assignor || '[Assignor]'} to ${rel.assignee || '[Assignee]'}`)
  if (rel.dated_date) parts.push(`dated ${rel.dated_date}`)
  const recParts: string[] = []
  if (rel.recorded_date) recParts.push(`recorded ${rel.recorded_date}`)
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
  return `Release of ${docType} ${parts.join(', ')}, to be released of record prior to closing.`
}

export function lienRequirementText(lien: Lien): string {
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
  if (datedDate) parts.push(`dated ${datedDate}`)
  const filedParts: string[] = []
  const filed = lien.filed_date || lien.recorded_date
  if (filed) filedParts.push(`filed ${filed}`)
  if (lien.court) filedParts.push(`in ${lien.court}`)
  if (filedParts.length) parts.push(filedParts.join(' '))
  const recParts: string[] = []
  if (lien.book || lien.page) recParts.push(`Book ${lien.book || '—'}, Page ${lien.page || '—'}`)
  if (lien.instrument_number) recParts.push(`Instrument No. ${lien.instrument_number}`)
  if (recParts.length) parts.push(recParts.join(', '))
  if (lien.amount) parts.push(`in the amount of ${lien.amount}`)
  if (lien.type === 'Tax Sale Certificate' && lien.redemption_expiration) {
    parts.push(`redemption period expiring ${lien.redemption_expiration}`)
  }
  return `Satisfaction of ${lien.type} ${parts.join(', ')}, to be released of record prior to closing.`
}

export function emExceptionText(em: ExceptionMatter): string {
  const parts: string[] = [em.description || '(matter of record)']
  const recParts: string[] = []
  if (em.recorded_date) recParts.push(`recorded ${em.recorded_date}`)
  else if (em.dated_date) recParts.push(`dated ${em.dated_date}`)
  const locBits: string[] = []
  if (em.book || em.page) locBits.push(`in Book ${em.book || '—'}, Page ${em.page || '—'}`)
  if (em.instrument_number) locBits.push(`Instrument No. ${em.instrument_number}`)
  if (locBits.length) recParts.push(locBits.join(', '))
  if (recParts.length) parts.push(recParts.join(' '))
  return parts.join(', ') + '.'
}

/**
 * Display-order pass: emit each top-level requirement immediately followed by its own
 * children, preserving original relative order within each group. computeReqLabels letters a
 * child off the last main number it emitted, so without this a sub-item stored after an
 * unrelated top-level item (rows come back in created_at order - there is no sort column)
 * gets lettered under the wrong parent. Display-only: does not change how rows are stored or
 * queried, so callers that just read/write rows need no changes.
 */
export function reorderForNumbering(requirements: CommitmentRequirement[]): CommitmentRequirement[] {
  const ids = new Set(requirements.map((r) => r.id))
  const topLevelIds = new Set(
    requirements.filter((r) => !r.parent_requirement_id || !ids.has(r.parent_requirement_id)).map((r) => r.id)
  )
  // Only pull up children of a top-level parent; anything deeper stays in place rather than
  // being dropped.
  const isChild = (r: CommitmentRequirement) => !!r.parent_requirement_id && topLevelIds.has(r.parent_requirement_id)

  const childrenOf = new Map<string, CommitmentRequirement[]>()
  for (const r of requirements) {
    if (!isChild(r)) continue
    const siblings = childrenOf.get(r.parent_requirement_id!)
    if (siblings) siblings.push(r)
    else childrenOf.set(r.parent_requirement_id!, [r])
  }

  return requirements.flatMap((r) => (isChild(r) ? [] : [r, ...(childrenOf.get(r.id) ?? [])]))
}

/** `startAt` is inclusive: the first top-level requirement renders as exactly `startAt`. */
export function computeReqLabels(requirements: CommitmentRequirement[], startAt: number): string[] {
  const ids = new Set(requirements.map((r) => r.id))
  let mainNum = (startAt || 1) - 1
  let childNum = 0
  return requirements.map((r) => {
    const hasParent = r.parent_requirement_id && ids.has(r.parent_requirement_id)
    if (!hasParent) {
      mainNum++
      childNum = 0
      return String(mainNum)
    }
    childNum++
    return String(mainNum) + String.fromCharCode(96 + childNum)
  })
}
