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
