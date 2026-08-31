export type Order = {
  id: string
  file_number: string
  product_type: string
  policy_type: string
  purchase_price: number | null
  loan_amount: number | null
  property_address: string | null
  parcel_number: string | null
  property_city: string | null
  property_county: string | null
  property_state: string | null
  property_zip: string | null
  order_status: string
  title_status: string
  escrow_status: string
}

export type PropertyDetails = {
  id: string
  order_id: string
  house_number: string | null
  street_name: string | null
  street_suffix: string | null
  directional: string | null
  city: string | null
  county: string | null
  state: string | null
  zip: string | null
  section_township_range: string | null
  brief_legal: string | null
  lot: string | null
  block: string | null
  subdivision_tract: string | null
  use_type: string | null
  full_legal_description: string | null
  parcel_number: string | null
  parcel_number_type: string | null
  ccrs_dated: string | null
  ccrs_book: string | null
  ccrs_page: string | null
  ccrs_instrument_number: string | null
  ccrs_notes: string | null
  plat_survey_reference: string | null
  setback_front: string | null
  setback_side: string | null
  setback_side_street: string | null
  setback_rear: string | null
  lot_dimension_frontage: string | null
  lot_dimension_depth: string | null
}

export type PropertyEasement = {
  id: string
  property_id: string
  type: string
  other_type_text: string | null
  description: string | null
}

export type PrelimSearch = {
  id: string
  order_id: string
  effective_date: string | null
  effective_time: string | null
  search_from_date: string | null
  search_to_date: string | null
  search_to_time: string | null
  search_type: string | null
  derivation_instrument_type: string | null
  derivation_dated_date: string | null
  derivation_recorded_date: string | null
  derivation_book: string | null
  derivation_page: string | null
  derivation_instrument_number: string | null
  derivation_consideration: number | null
  derivation_grantee_name: string | null
  derivation_grantee_entity_type: string | null
  derivation_grantor_name: string | null
  derivation_grantor_entity_type: string | null
  derivation_is_portion: boolean
  derivation_note: string | null
  taxes_paid_through_year: string | null
  taxes_now_due: string | null
  taxes_not_yet_due: string | null
  special_levies_assessments: string | null
}

export type DerivationPrincipal = {
  id: string
  prelim_search_id: string
  side: 'grantee' | 'grantor'
  name: string
  role: string | null
}

export type SecurityInstrument = {
  id: string
  prelim_search_id: string
  type: string
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
  original_amount: number | null
  mortgagor: string | null
  mortgagee: string | null
  trustee: string | null
}

export type SecurityInstrumentRelatedDoc = {
  id: string
  security_instrument_id: string
  type: string
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
  assignor: string | null
  assignee: string | null
  notes: string | null
}

export type Lien = {
  id: string
  prelim_search_id: string
  type: string
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
  amount: number | null
  debtor: string | null
  creditor: string | null
  docket_date: string | null
  case_number: string | null
  court: string | null
  taxing_authority: string | null
  tax_type: string | null
  filed_date: string | null
  hoa_company: string | null
  materialman: string | null
  last_service_date: string | null
  plaintiff: string | null
  defendant: string | null
  certificate_id: string | null
  redemption_expiration: string | null
}

export type ExceptionMatter = {
  id: string
  prelim_search_id: string
  description: string
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
}

export type CommitmentScheduleA = {
  id: string
  order_id: string
  form_type: string
  company_state_of_org: string | null
  requirements_time_period: string | null
  env_protection_lien_statutes: string | null
  issuing_agent: string | null
  issuing_office: string | null
  alta_universal_id: string | null
  loan_id_number: string | null
  commitment_number: string | null
  revision_number: string | null
  date_issued: string | null
  time_issued: string | null
  title_held_as: string | null
  owner_policy_type: string | null
  owner_coverage_amount: number | null
  owner_coverage_tbd: boolean
  owner_proposed_insured: string | null
  loan_policy_type: string | null
  loan_coverage_amount: number | null
  loan_coverage_tbd: boolean
  loan_proposed_insured: string | null
  loan_mortgagee_clause: string | null
  counter_signature: string | null
  counter_signature_date: string | null
}

export type ChainOfTitleEntry = {
  id: string
  commitment_sch_a_id: string
  instrument_type: string | null
  grantor: string | null
  grantee: string | null
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
}
