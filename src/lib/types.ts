export type Order = {
  id: string
  file_number: string
  product_type: string
  transaction_type: string
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
  settlement_date: string | null
  settlement_time: string | null
  rush_order: boolean
  title_opened_date: string | null
  escrow_opened_date: string | null
  title_officer: string | null
  curative_title_officer: string | null
  escrow_assistant: string | null
  escrow_officer: string | null
  closing_coordinator: string | null
  funder: string | null
  recording_specialist: string | null
  post_closer: string | null
}

export type ZipLookupCounty = { name: string; fips: string | null; weight: number }

export type ZipLookupRow = {
  zip: string
  city: string
  state: string
  state_name: string
  primary_county: string
  counties: ZipLookupCounty[]
}

export type Contact = {
  id: string
  role: string
  entity_type: string
  name: string
  current_address: string | null
  mailing_address: string | null
  forwarding_address: string | null
  phone: string | null
  email: string | null
  ssn: string | null
  dob: string | null
  license_number: string | null
  alta_id: string | null
  mortgagee_clause: string | null
  poa: boolean
  poa_attorney_in_fact_name: string | null
  marital_status: string | null
  linked_contact_id: string | null
}

export type ContactPrincipal = {
  id: string
  contact_id: string
  name: string
  role: string | null
}

export type ContactSignatureLine = {
  id: string
  contact_id: string
  text: string
}

export type PropertyDetails = {
  id: string
  order_id: string
  city: string | null
  county: string | null
  state: string | null
  zip: string | null
  section_township_range: string | null
  property_address: string | null
  section: string | null
  township: string | null
  range: string | null
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
  tax_last_paid_year: string | null
  tax_last_paid_installment_count: number | null
  tax_last_paid_installment_amount: number | null
  tax_last_paid_due_date: string | null
  tax_next_due_year: string | null
  tax_next_due_installment_number: number | null
  tax_next_due_installment_count: number | null
  tax_next_due_amount: number | null
  tax_next_due_due_date: string | null
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

export type CommitmentRequirement = {
  id: string
  order_id: string
  description: string
  notes: string | null
  source_type: 'si' | 'rel' | 'lien' | null
  source_id: string | null
  parent_requirement_id: string | null
  disposition: string | null
  disposition_notes: string | null
  dont_show: boolean
  sort_order: number
}

export type CommitmentException = {
  id: string
  order_id: string
  description: string
  notes: string | null
  source_type: 'em' | null
  source_id: string | null
  disposition: string | null
  disposition_notes: string | null
  dont_show: boolean
  sort_order: number
}

// Not dead code: backs the "Begin Requirements/Exceptions At" numbering-offset override UI,
// which is not built yet (follow-up task). Both values are inclusive first-item numbers.
export type CommitmentSchBSettings = {
  id: string
  order_id: string
  begin_requirements_at: number | null
  begin_exceptions_at: number
}

export type CurativeSettings = {
  id: string
  order_id: string
  commitment_status: 'draft' | 'final'
  finalized_at: string | null
  ctc_issued_at: string | null
  ctc_rescinded_at: string | null
}

export type FolderTemplate = {
  id: string
  name: string
  sort_order: number
  parent_folder_template_id: string | null
}

export type AttachmentFolder = {
  id: string
  order_id: string
  name: string
  sort_order: number
  parent_folder_id: string | null
  source_template_id: string | null
}

export type ChecklistTaskTemplate = {
  id: string
  description: string
  milestone: string
  sort_order: number
}

export type BillCode = {
  id: string
  code: string
  description: string | null
  sort_order: number
}

export type Invoice = {
  id: string
  order_id: string
  sort_order: number
  invoice_number: string
  status: string
  invoice_date: string | null
  due_date: string | null
  bill_to_contact_id: string | null
  remit_to_contact_id: string | null
  message: string | null
}

export type InvoiceLineItem = {
  id: string
  invoice_id: string
  sort_order: number
  source_table: string | null
  source_split_id: string | null
  print_to_invoice: boolean
  bill_code: string | null
  description: string | null
  amount: number | null
  taxable: boolean
  tax: number | null
}

export type ChecklistTask = {
  id: string
  order_id: string
  template_id: string | null
  description: string
  milestone: string
  due_date: string | null
  status: string
  completed_date: string | null
  sort_order: number
}

export type RequestedTask = {
  id: string
  order_id: string
  task_name: string
  requested_date: string | null
  requested_due_date: string | null
  due_date: string | null
  received_date: string | null
  notes: string | null
  status: string
  sort_order: number
}

export type DocPrepDeed = {
  id: string
  order_id: string
  instrument_type: string | null
  consideration: number | null
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
  prepared_by_contact_id: string | null
  return_to_contact_id: string | null
  exemption_code: string | null
  legal_as_exhibit: boolean
  final: boolean
  finalized_at: string | null
  grantor_name: string | null
  grantor_entity_type: string | null
  grantee_name: string | null
  grantee_entity_type: string | null
  notary_block: string | null
  legal_text: string | null
  parcel_number: string | null
  derivation_text: string | null
  situs_address: string | null
}

export type DocPrepDeedPrincipal = {
  id: string
  deed_id: string
  side: 'grantor' | 'grantee'
  name: string
  role: string | null
}

export type DocPrepDeedSignatureLine = {
  id: string
  deed_id: string
  text: string
}

export type DocPrepDeedSubjectTo = {
  id: string
  deed_id: string
  description: string
  sort_order: number
}

export type DocPrepSecurityInstrument = {
  id: string
  order_id: string
  instrument_type: string | null
  trustee_name: string | null
  loan_amount: number | null
  dated_date: string | null
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
  mortgagor_name: string | null
  mortgagor_entity_type: string | null
  mortgagee_name: string | null
  mortgagee_entity_type: string | null
  note_date: string | null
  note_amount: number | null
  maturity_date: string | null
  interest_rate: number | null
}

export type DocPrepSiPrincipal = {
  id: string
  si_id: string
  side: 'mortgagor' | 'mortgagee'
  name: string
  role: string | null
}

export type DocPrepAffidavit = {
  id: string
  order_id: string
  type: string
  affiant: string | null
  affiant_contact_id: string | null
  dated_date: string | null
  recorded: boolean
  recorded_date: string | null
  book: string | null
  page: string | null
  instrument_number: string | null
  notes: string | null
  sort_order: number
}

export type NotaryAck = {
  id: string
  order_id: string
  contact_id: string
  doc_label: string
  text: string
}

export type TitleInsurancePremium = {
  id: string
  order_id: string
  sort_order: number
  policy_type: string | null
  underwriter_contact_id: string | null
  coverage_amount: number | null
  base_premium: number | null
  final_premium: number | null
  bill_code: string | null
  cdf_page2_line_id: string | null
}

export type PremiumSplit = {
  id: string
  premium_id: string
  sort_order: number
  payee_contact_id: string | null
  basis: string | null
  percent: number | null
  amount: number | null
  bill_code: string | null
}

export type Endorsement = {
  id: string
  premium_id: string
  sort_order: number
  code: string | null
  description: string | null
  charge: number | null
  bill_code: string | null
  cdf_page2_line_id: string | null
}

export type EndorsementSplit = {
  id: string
  endorsement_id: string
  sort_order: number
  payee_contact_id: string | null
  basis: string | null
  percent: number | null
  amount: number | null
  bill_code: string | null
}

export type AdditionalTitleCharge = {
  id: string
  order_id: string
  sort_order: number
  description: string | null
  policy_id: string | null
  charge: number | null
  taxable: boolean
  fee_type: string | null
  cdf_line: string | null
  cdf_page2_line_id: string | null
  invoice: string | null
  bill_code: string | null
  seller_pay_percent: number | null
  issued_date: string | null
  effective_date: string | null
  payee_contact_id: string | null
}

export type AdditionalTitleChargeSplit = {
  id: string
  charge_id: string
  sort_order: number
  payee_contact_id: string | null
  basis: string | null
  percent: number | null
  amount: number | null
  bill_code: string | null
}

export type TaxProration = {
  id: string
  order_id: string
  sort_order: number
  description: string | null
  category: string | null
  payee_contact_id: string | null
  account_number: string | null
  compute_for: string | null
  credit_debit: string | null
  share_of_amount: number | null
  proration_date: string | null
  period_from: string | null
  period_to: string | null
  use_30_day_months: boolean
  days_in_period: number | null
  days_prorated: number | null
  per_diem: number | null
  prorated_amount: number | null
  cdf_line: string | null
  cdf_page2_line_id: string | null
  bill_code: string | null
}

export type CdfPage2Line = {
  id: string
  order_id: string
  section: string
  sort_order: number
  description: string | null
  to_contact_id: string | null
  borrower_paid_at_closing: number | null
  borrower_paid_before_closing: number | null
  seller_paid_at_closing: number | null
  seller_paid_before_closing: number | null
  paid_by_others: number | null
  is_fixed: boolean
  points_percent: number | null
  points_round_whole_dollar: boolean
  points_adjustment: number | null
  points_adjustment_for: string | null
  per_month: number | null
  months: number | null
  prepaid_interest_from: string | null
  prepaid_interest_to: string | null
  prepaid_interest_per_diem_rate: number | null
  prepaid_interest_use_30_day_months: boolean
  prepaid_interest_date_basis: string | null
}

export type CdfPage2Totals = {
  borrowerAtClosing: number
  borrowerBeforeClosing: number
  sellerAtClosing: number
  sellerBeforeClosing: number
}

export type CdfPage1 = {
  id: string
  order_id: string
  loan_amount: number | null
  interest_rate: number | null
  monthly_principal_interest: number | null
  principal_interest_can_increase: boolean
  principal_interest_increase_explanation: string | null
  has_prepayment_penalty: boolean
  prepayment_penalty_max: number | null
  has_balloon_payment: boolean
  balloon_payment_amount: number | null
  estimated_total_monthly_payment: number | null
  estimated_escrow_monthly: number | null
  taxes_included_in_escrow: boolean
  homeowners_insurance_included_in_escrow: boolean
  other_escrow_included: boolean
  other_escrow_description: string | null
  closing_costs_total: number | null
  closing_costs_note: string | null
  cash_to_close_total: number | null
  cash_to_close_note: string | null
}

export type CdfCashToClose = {
  id: string
  order_id: string
  loan_amount_estimate: number | null
  loan_amount_final: number | null
  loan_amount_changed: string | null
  closing_costs_j_estimate: number | null
  closing_costs_j_final: number | null
  closing_costs_changed: string | null
  closing_costs_paid_before_closing_estimate: number | null
  closing_costs_paid_before_closing_final: number | null
  payoffs_k_estimate: number | null
  payoffs_k_final: number | null
  payoffs_changed: string | null
  cash_to_close_estimate: number | null
  cash_to_close_final: number | null
  cash_to_close_from_borrower: boolean
  cash_to_close_to_borrower: boolean
  closing_costs_financed: number | null
}

export type CdfPayoffPayment = {
  id: string
  order_id: string
  sort_order: number
  description: string | null
  payee_contact_id: string | null
  amount: number | null
  principal_balance: number | null
  interest_rate: number | null
  per_diem: number | null
  interest_from: string | null
  interest_to: string | null
  additional_interest: number | null
  late_fee: number | null
  payoff_expires_on: string | null
  payoff_method: 'principal_balance' | 'payoff_amount'
  interest_charged: number | null
  late_fee_after: string | null
  payoff_amount: number | null
  per_diem_days_basis: '365' | '360'
  payoff_date_basis: string | null
  payoff_date_basis_from: string | null
  payoff_date_basis_to: string | null
  extra_days: number | null
}

export type CdfPayoffAdditionalCharge = {
  id: string
  payoff_id: string
  sort_order: number
  description: string | null
  fee: number | null
}

export type CdfTransactionSummaryLine = {
  id: string
  order_id: string
  party: string
  section: string
  sort_order: number
  description: string | null
  amount: number | null
}

export type CdfPage4 = {
  id: string
  order_id: string
  has_assumption: boolean
  assumption_allowed: boolean
  has_demand_feature: boolean
  demand_feature_explanation: string | null
  late_payment_grace_period_days: number | null
  late_payment_fee_percent: number | null
  has_negative_amortization: boolean
  negative_amortization_explanation: string | null
  partial_payments_accepted: boolean
  partial_payments_explanation: string | null
  has_security_interest: boolean
  security_interest_property_address: string | null
  escrow_type: string | null
  escrow_initial_deposit: number | null
  escrow_monthly_payment: number | null
  no_escrow_estimated_property_costs: number | null
  no_escrow_escrowed_note: string | null
}

export type CdfPage5 = {
  id: string
  order_id: string
  total_of_payments: number | null
  finance_charge: number | null
  amount_financed: number | null
  apr: number | null
  total_interest_percentage: number | null
  print_appraisal_disclosure: boolean
  liability_after_foreclosure: string | null
}

export type CdfPage5Contact = {
  id: string
  order_id: string
  sort_order: number
  role: string | null
  contact_id: string | null
  address: string | null
  nmls_id: string | null
  license_id: string | null
  contact_person: string | null
  contact_nmls_id: string | null
  contact_license_id: string | null
  email: string | null
  phone: string | null
}

export type RecordingDocument = {
  id: string
  order_id: string
  sort_order: number
  document_description: string | null
  county: string | null
  status: string
  date_submitted: string | null
  date_recorded: string | null
  instrument_number: string | null
  book: string | null
  page: string | null
  number_of_pages: number | null
  e_recording_reference: string | null
  fee: number | null
  recordation_tax: number | null
  transfer_tax: number | null
  stamp_tax: number | null
  seller_pay_percent: number | null
  cdf_page2_line_id: string | null
}

export type SettlementOptions = {
  id: string
  order_id: string
  settlement_type: string | null
  place_of_settlement_address: string | null
  settlement_agent_contact_id: string | null
  admin_data_cdf1: string | null
  admin_data_cdf2: string | null
  admin_data_cdf3: string | null
  admin_data_cdf4: string | null
  admin_data_cdf5: string | null
  seller_credit_method: string | null
}

export type Attachment = {
  id: string
  order_id: string
  folder_id: string
  name: string
  description: string | null
  storage_path: string
  mime_type: string
  size_bytes: number
  source: 'Attached' | 'Merged'
  uploaded_by: string
  created_at: string
  updated_at: string
}
