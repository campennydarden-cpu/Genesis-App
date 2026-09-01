export const PRODUCT_TYPES = [
  'Purchase',
  'Refinance',
  'HELOC',
  'HELOAN',
  'Reverse Mortgage (Refi)',
  'Cash Purchase',
  'Reverse Mortgage (Purchase)',
  'Tract Search',
] as const

export const POLICY_TYPES = ['None', "Owner's", 'Loan', 'Simultaneous'] as const

export const ORDER_STATUSES = [
  'In Progress',
  'Canceled',
  'Retain',
  'Hold',
  'Completed',
  'Duplicate',
] as const

export const TITLE_STATUSES = [
  'In Progress',
  'Searching',
  'Exam',
  'Curative',
  'Cleared for Policy',
  'Policy Issued',
  'Policy Remitted',
  'Hold - Title Only',
] as const

export const ESCROW_STATUSES = [
  'In Progress',
  'Balancing',
  'Docs Out',
  'Canceled',
  'Closed',
] as const

export const ENTITY_TYPES = [
  'Individual',
  'LLC',
  'Corporation',
  'Partnership',
  'Trust',
  'Estate',
] as const

export const USE_TYPES = [
  '1-4 Family',
  'Single Family',
  'PUD',
  'Condominium',
  'Cooperative',
  'Mobile/Manufactured Housing',
  'Vacant Land',
  'Unimproved Land',
  'Ag Land',
  'Commercial Property',
  'Mixed Use',
] as const

export const PARCEL_NUMBER_TYPES = [
  'Parcel ID',
  'APN',
  'Tax Map Number (TMS)',
  'PIN',
  'Folio Number',
  'Account Number',
  'Other',
] as const

export const EASEMENT_TYPES = [
  'Utility Easement',
  'Ingress/Egress Easement',
  'Drainage Easement',
  'Right of Way (ROW) Dedication',
  'Shared Driveway Easement',
  'Access Easement',
  'Pipeline/Transmission Easement',
  'Conservation Easement',
  'Party Wall Agreement',
  'Other',
] as const

export const DERIVATION_INSTRUMENT_TYPES = [
  'Warranty Deed', 'Special Warranty Deed', 'Limited Warranty Deed', "Trustee's Deed",
  'Deed of Distribution', 'Gift Deed', 'Quitclaim Deed', 'Grant Deed',
  'Deed of Bargain and Sale', 'Interspousal Transfer Deed', 'Transfer on Death Deed',
  'Affidavit', 'Death Certificate', 'Divorce Decree', 'Quiet Title Action', 'Confirmatory Deed',
] as const

export const PRELIM_ENTITY_TYPES = [
  'Individual', 'LLC', 'Corporation', 'Partnership', 'Trust', 'Estate', 'Other',
] as const

export const PRINCIPAL_ROLES: Record<string, readonly string[]> = {
  LLC: ['Member', 'Manager'],
  Corporation: ['President', 'Vice President', 'Secretary', 'Treasurer', 'Director', 'Chairman'],
  Partnership: ['General Partner', 'Limited Partner'],
  Trust: ['Trustee', 'Successor Trustee', 'Co-Trustee'],
}

export const SECURITY_INSTRUMENT_TYPES = [
  'Mortgage', 'Deed of Trust', 'Security Deed', 'UCC Financing Statement',
] as const

export const RELATED_DOC_TYPES = [
  'Assignment', 'Assignment of Leases and Rents', 'Assignment of Beneficial Interest',
  'Loan Modification Agreement', 'Substitution of Trustee', 'UCC Addendum - Continuation', 'Other',
] as const

export const RELATED_DOC_ASSIGNMENT_TYPES = [
  'Assignment', 'Assignment of Leases and Rents', 'Assignment of Beneficial Interest',
] as const

export const LIEN_TYPES = [
  'Judgment', 'Tax Lien', 'HOA/COA Lien', 'Mechanics Lien', 'Lis Pendens',
  'Tax Sale Certificate', 'Municipal Lien', 'Utility Lien', 'Other',
] as const

export const TAX_LIEN_TYPES = [
  'Income', 'Property', 'Franchise', 'Sales/Use', 'Estate', 'Other',
] as const

export const COMMITMENT_FORM_TYPES = ['Standard', 'Short Form'] as const

export const ALTA_POLICY_FORM_TYPES = [
  "ALTA Owner's Policy", 'ALTA Loan Policy', "ALTA Homeowner's Policy",
  "Leasehold Owner's Policy", 'Leasehold Loan Policy', 'Construction Loan Policy', 'Other',
] as const

export const REQUIREMENT_SEEDS = [
  'Warranty Deed from current owner to Buyer, to be recorded',
  'Release of existing Deed of Trust, to be recorded',
  'Payoff of existing mortgage',
  'Payment of delinquent real estate taxes',
  'Satisfaction of judgment against Seller',
  'Affidavit of title from Seller',
] as const

export const EXCEPTION_SEEDS = [
  'Real estate taxes for the current year, not yet due and payable',
  'Easements, restrictions, and rights of way of record',
  'Restrictive covenants of record',
  'Rights of parties in possession, not shown of record',
  'Matters that would be disclosed by an accurate survey',
] as const

export const STANDARD_BI_ITEM_COUNTS: Record<string, number> = {
  Standard: 4,
  'Short Form': 5,
}

export const REQUIREMENT_DISPOSITIONS = [
  'Released', 'Expired', 'Insured Over', 'Waived', 'No Action',
] as const

export const EXCEPTION_DISPOSITIONS = [
  'Removed by Affidavit', 'Deleted per Underwriter',
] as const
