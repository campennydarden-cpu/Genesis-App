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

export const TRANSACTION_TYPES = ['Purchase', 'Refinance', 'Equity', 'Other'] as const

// Auto-suggested Transaction Type when Product Type changes — a starting point only,
// never locked; the user can always override it.
export const PRODUCT_TYPE_TO_TRANSACTION_TYPE: Record<string, (typeof TRANSACTION_TYPES)[number]> = {
  Purchase: 'Purchase',
  'Cash Purchase': 'Purchase',
  'Reverse Mortgage (Purchase)': 'Purchase',
  Refinance: 'Refinance',
  'Reverse Mortgage (Refi)': 'Refinance',
  HELOC: 'Equity',
  HELOAN: 'Equity',
  'Tract Search': 'Other',
}

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

// Order Info functional-role assignments — each maps to its own free-text `orders`
// column (no active-user roster exists yet, so these are names, not a picker).
// Abstractor is deliberately excluded: it's auto-assigned elsewhere, not entered here.
export const FUNCTIONAL_ROLES = [
  { key: 'title_officer', label: 'Title Officer' },
  { key: 'curative_title_officer', label: 'Curative Title Officer' },
  { key: 'escrow_assistant', label: 'Escrow Assistant' },
  { key: 'escrow_officer', label: 'Escrow Officer' },
  { key: 'closing_coordinator', label: 'Closing Coordinator' },
  { key: 'funder', label: 'Funder' },
  { key: 'recording_specialist', label: 'Recording Specialist' },
  { key: 'post_closer', label: 'Post-Closer' },
] as const

export const ENTITY_TYPES = [
  'Individual',
  'LLC',
  'Corporation',
  'Partnership',
  'Trust',
  'Estate',
] as const

// Focus set of contact roles. Deliberately not the full 24-value role list —
// the rest are deferred to a later pass. Recording Office/Tax Collector/Payoff
// Lender added 2026-09-07 per Cam's call; the remaining 12 stay deferred.
export const CONTACT_ROLES = [
  'Buyer/Borrower',
  'Seller',
  'Lender',
  'Mortgage Broker',
  'Underwriter',
  'Settlement Agent',
  'Title Company',
  "Listing Agent (Seller's Agent)",
  "Selling Agent (Buyer's Agent)",
  'Recording Office',
  'Tax Collector',
  'Payoff Lender',
] as const

// Roles where Entity Type applies in the UI (and, when Individual, SSN/DOB show).
export const CONTACT_ROLES_WITH_ENTITY_TYPE: readonly string[] = ['Buyer/Borrower', 'Seller']

// Roles that get a single Address field (stored in current_address) instead of
// separate Current/Mailing/Forwarding Address fields.
export const CONTACT_ROLES_SINGLE_ADDRESS: readonly string[] = [
  'Lender',
  'Mortgage Broker',
  'Underwriter',
  'Settlement Agent',
  'Title Company',
  "Listing Agent (Seller's Agent)",
  "Selling Agent (Buyer's Agent)",
  'Recording Office',
  'Tax Collector',
  'Payoff Lender',
]

export const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'] as const

// Roles with License Number + ALTA ID fields.
export const CONTACT_ROLES_WITH_LICENSE: readonly string[] = ['Title Company', 'Settlement Agent']

// Roles with a Mortgagee Clause field.
export const CONTACT_ROLES_WITH_MORTGAGEE_CLAUSE: readonly string[] = ['Lender']

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
  'Released/Satisfied', 'Insured Over', 'Waived', 'Paying off at Close', 'Expired', 'No Action',
] as const

export const EXCEPTION_DISPOSITIONS = [
  'Removed by Affidavit', 'Deleted per Underwriter',
] as const

// Attachments upload validation (Genesis Rebuild - Attachments Core Design.md).
export const ATTACHMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
] as const
