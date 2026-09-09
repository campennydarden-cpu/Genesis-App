-- "Be able to assign a payee without using the split table" (Fix Plan). Cam's call:
-- a simple Payee field directly on the charge, used when it doesn't need splitting
-- at all — Split (additional_title_charge_splits, already has its own per-row
-- payee_contact_id, confirmed by 0026_additional_title_charges.sql) stays available
-- as-is for charges that do need it.

alter table additional_title_charges
  add column payee_contact_id uuid references contacts(id) on delete set null;
