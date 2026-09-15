// Mortgagee Clause templates by Loan Type, per Cam's exact reference text
// (Movement Mortgage, LLC example) in Cam's Screen Notes. Texas Conventional
// added 2026-09-12 once Cam supplied its actual wording — unlike the other
// three, it has no trailing ": address" segment, per the exact text he gave.
export const MORTGAGEE_CLAUSE_LOAN_TYPES = ['Conventional', 'FHA', 'VA', 'Texas Conventional'] as const
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
    case 'Texas Conventional':
      return `${name}, and each successor in ownership of the indebtedness secured by the insured mortgage, except a successor who is an obligor under the provisions of section 12(c) of the conditions.`.trim()
    case 'Conventional':
    default:
      return `${name}, ${mortgageeClauseText ?? ''}: ${address}`.trim()
  }
}
