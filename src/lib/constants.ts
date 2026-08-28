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
