// Mortgagee Clause templates by Loan Type, per Cam's exact reference text
// (Movement Mortgage, LLC example) in Cam's Screen Notes. Texas has its own
// set per Cam's note, but no template text was supplied for it — not built,
// flagged in the Fix Plan until that text is provided.
export const MORTGAGEE_CLAUSE_LOAN_TYPES = ['Conventional', 'FHA', 'VA'] as const
export type MortgageeClauseLoanType = (typeof MORTGAGEE_CLAUSE_LOAN_TYPES)[number]

export function buildMortgageeClause(
  loanType: MortgageeClauseLoanType,
  name: string,
  address: string,
  mortgageeClauseText: string | null
): string {
  switch (loanType) {
    case 'FHA':
      return `${name} and/or The Secretary of Housing and Urban Development, their successors and/or assigns, as their interest may appear: ${address}`.trim()
    case 'VA':
      return `${name} and/or The Department of Veteran Affairs, their successors and/or assigns, as their interest may appear: ${address}`.trim()
    case 'Conventional':
    default:
      return `${name}, ${mortgageeClauseText ?? ''}: ${address}`.trim()
  }
}
