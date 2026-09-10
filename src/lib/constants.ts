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

// Matches CONTACT_ROLES minus Buyer/Borrower and Seller (transaction parties, not
// reusable firm vendors -- see Entity Directory - Implementation Readiness.md Q2/Q6).
export const ENTITY_DIRECTORY_ROLE_TYPES = [
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

// Cam's "Local VIP Client Management" group (2026-09-10) -- these get a nested
// entity_directory_people roster; the rest don't.
export const ENTITY_DIRECTORY_ROLE_TYPES_WITH_PEOPLE = [
  'Lender',
  'Mortgage Broker',
  "Selling Agent (Buyer's Agent)",
  "Listing Agent (Seller's Agent)",
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

// Roles that get a "People Box" of their own staff (Loan Officer, Processor, etc.)
// per Cam's note — unlike the Trust/LLC roster above, this isn't entity-type-gated.
export const CONTACT_ROLES_WITH_TEAM_ROSTER: readonly string[] = [
  'Lender',
  'Mortgage Broker',
  "Listing Agent (Seller's Agent)",
  "Selling Agent (Buyer's Agent)",
]

export const TEAM_ROSTER_ROLES: readonly string[] = [
  'Loan Officer',
  'Loan Officer Assistant',
  'Processor',
  'Other',
]

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
  'Removed by Affidavit', 'Deleted per Underwriter', 'No Action',
] as const

// Canonical ordered Milestone list (Design Notes.md's "Milestone list, in order").
export const CHECKLIST_MILESTONES = [
  'Order Entry',
  'Search',
  'Typing and Exam',
  'Curative',
  'Closing',
  'Post Closing',
  'Funding',
  'Recording',
  'Policy and Remittance',
] as const

export const CHECKLIST_TASK_STATUSES = ['Required', 'Completed', 'N/A'] as const

export const REQUESTED_TASK_STATUSES = ['Required', 'Requested', 'Received', 'N/A'] as const

// Requested Tasks seed chips (Design Notes - Curative & Tasking.md's Tasking section,
// Cam's call 2026-09-08 over Design Notes.md's shorter prototype-era list).
export const REQUESTED_TASK_SEEDS = [
  'Assign Vendor and Order Search Package',
  'Order and Publish Tax Certificate',
  'Order and Publish Payoff',
  'Order and Publish Date Down',
  'Order and Publish Updated Taxes',
] as const

// Document Preparation — Affidavits type list. Cam's canonical list (2026-09-09
// click-through notes); two entries are flagged there as state-conditional
// (Notice of Availability, Commitment Acknowledgement) but that filtering isn't
// built yet — the dropdown itself doesn't need it to ship.
export const AFFIDAVIT_TYPES = [
  'ALTA Statement',
  'W-9 Request for Taxpayer ID and Certification (seller)',
  'Certification of No Information Reporting Sale or Exchange Principal Residence',
  'Substitute 1099-S',
  'Survey Affidavit',
  'GAP Affidavit',
  "Owner's Affidavit",
  'FIRPTA',
  'DS-1 Form (IL Only)',
  'Notice of Availability',
  'Commitment Acknowledgement',
  // Second batch, Cam's Screen Notes 2026-09-10 — "Commitment Acknowledgement" repeats
  // the entry above, so it isn't duplicated here.
  'Marital Status Affidavit',
  'Waiver of Settlement Agent Responsibility',
  'Buyer Personal Information Affidavit',
  'Seller Personal Information Affidavit',
  'Not Me Judgement Affidavit',
  'Affidavit of Heirship',
  'Affidavit of Death - JTWROS',
  'Affidavit of Death - Trustee',
  'Continuous Marriage Affidavit',
  'Continuous Marriage Affidavit (Surviving Spouse)',
  'Joint Tenancy Affidavit',
] as const

// Title Insurance Premiums — per-line policy type (distinct from the order-level
// POLICY_TYPES field, which includes 'None'/'Simultaneous' as a whole-order selection).
export const TITLE_POLICY_LINE_TYPES = ["Owner's", 'Loan'] as const

// Shared by Premiums, Endorsements, and Additional Title Charges — every "Split" section
// in the Title group uses this same basis list (no stored data depends on the exact
// wording as of 2026-09-08, so it stays screen-agnostic rather than premium-specific).
export const SPLIT_BASIS_TYPES = [
  'Percent of Final Charge',
  'Percent of Balance',
  'Fixed Amount',
] as const

export const TAX_PRORATION_CATEGORIES = ['County Tax', 'City/Town Tax', 'Assessment', 'HOA/COA', 'Other'] as const

export const PRORATION_COMPUTE_FOR = ['Buyer', 'Seller'] as const

export const PRORATION_CREDIT_DEBIT = ['Credit', 'Debit'] as const

// CDF Page 2 itemized sections, in form order. D/I/J are computed subtotals, not
// enterable sections, so they're not listed here — see computeCdfPage2Totals().
export const CDF_PAGE2_SECTIONS = [
  { code: 'A', label: 'Origination Charges' },
  { code: 'B', label: 'Services Borrower Did Not Shop For' },
  { code: 'C', label: 'Services Borrower Did Shop For' },
  { code: 'E', label: 'Taxes and Other Government Fees' },
  { code: 'F', label: 'Prepaids' },
  { code: 'G', label: 'Initial Escrow Payment at Closing' },
  { code: 'H', label: 'Other' },
] as const

export const CDF_YES_NO = ['Yes', 'No'] as const

// CDF Page 3 Summaries of Transactions — six subsections, mirrored for Borrower and
// Seller. Order matches the official form's Borrower's Transaction column top-to-bottom
// (the Seller's Transaction column uses the same six subsections in the same order).
export const CDF_TRANSACTION_SUMMARY_SECTIONS = [
  { code: 'due_from_at_closing', label: 'Due from Borrower/Seller at Closing' },
  { code: 'due_to_at_closing', label: 'Due to Borrower/Seller at Closing' },
  { code: 'paid_already', label: 'Paid Already by or on Behalf of Borrower/Seller at Closing' },
  { code: 'due_from_before_closing', label: 'Due from Borrower/Seller Before Closing' },
  { code: 'due_to_before_closing', label: 'Due to Borrower/Seller Before Closing' },
  { code: 'adjustments', label: 'Adjustments' },
] as const

export const CDF_TRANSACTION_SUMMARY_PARTIES = ['Borrower', 'Seller'] as const

export const CDF_PAGE5_CONTACT_ROLES = [
  'Lender',
  'Mortgage Broker',
  "Real Estate Broker (B)",
  "Real Estate Broker (S)",
  'Settlement Agent',
  'Additional',
] as const

export const CDF_LIABILITY_AFTER_FORECLOSURE = [
  'State law may protect you from liability',
  'State law does not protect you from liability',
] as const

export const RECORDING_STATUSES = ['Not Submitted', 'Submitted', 'Recorded', 'Rejected'] as const

export const RECORDING_DOCUMENT_TYPES = ['Mortgage', 'Deed', 'Release', 'Power of Attorney', 'Affidavit', 'Other'] as const

// ponytail: `Invoice.png`'s Status dropdown was collapsed in the screenshot (only "Pending"
// visible) -- this list is a reasonable guess, not confirmed with Cam.
export const INVOICE_STATUSES = ['Pending', 'Sent', 'Paid', 'Void'] as const

export const SETTLEMENT_TYPES = ['Combined', 'Borrower-Buyer', 'Seller', 'Cash'] as const

// Payoff Calculation.png and Prepaid Interest Config.png both anchor their per-diem
// date range to a "date basis" dropdown; only "Disbursement" is confirmed by either
// screenshot (the dropdown wasn't expanded) — ponytail: Closing/Recording are
// reasonable title/escrow anchors, not confirmed with Cam.
export const DATE_BASIS_OPTIONS = ['Disbursement', 'Closing', 'Recording'] as const

// Section F's 4 fixed lines, in order — Cam's exact wording: "these should default
// this way on every CD." Seeded idempotently by listCdfPage2Lines (cdf-page2.ts).
export const CDF_PAGE2_SECTION_F_FIXED_LINES = [
  "Homeowner's Insurance",
  'Mortgage Insurance Premium',
  'Prepaid Interest',
  'Property Taxes',
] as const

// Section E's 3 fixed lines — every Recording document's Fee/Recordation Tax/Transfer
// Tax/Stamp Tax combines into whichever of these it belongs to (Recordation Tax and
// Transfer Tax share one line; Cam's call, 2026-09-10). Unlike every other CDF Page 2
// fixed line, these are computed and re-synced from Recording on every add/edit/delete
// there (syncRecordingCdfLines, recording.ts) — read-only on CDF Page 2 itself.
export const CDF_PAGE2_SECTION_E_RECORDING_LINES = ['Recording Fees', 'Recordation/Transfer Tax', 'Stamp Tax'] as const

export const SELLER_CREDIT_METHODS = [
  'Apply seller credit to borrower paid loan policy on CDF Page 2',
  'Apply general seller credit on CDF Page 3',
  'Charge borrower full premiums on CDF Page 2 and apply seller credit on CDF Page 3',
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
