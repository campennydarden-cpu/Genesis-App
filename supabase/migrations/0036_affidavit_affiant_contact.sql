alter table doc_prep_affidavits
  add column affiant_contact_id uuid references contacts(id) on delete set null;
