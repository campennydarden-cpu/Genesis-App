alter table title_insurance_premiums
  add column cdf_page2_line_id uuid references cdf_page2_lines(id) on delete set null;

alter table endorsements
  add column cdf_page2_line_id uuid references cdf_page2_lines(id) on delete set null;

alter table additional_title_charges
  add column cdf_page2_line_id uuid references cdf_page2_lines(id) on delete set null;

alter table tax_prorations
  add column cdf_page2_line_id uuid references cdf_page2_lines(id) on delete set null;
