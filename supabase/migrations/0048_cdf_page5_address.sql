-- CDF Page 5 Contact Information grid is missing an Address row entirely (CDF
-- Pg5 Licensing.png shows one under every contact column) — needed so "pull
-- Lender/Title Company/Settlement Agent info from Contacts" has somewhere to
-- default the firm's address into. Defaulted from the linked Contact's
-- current_address when contact_id is picked, freely editable after — same
-- default-then-editable pattern as every other Contacts-pull on this CDF page.

alter table cdf_page5_contacts
  add column address text;
