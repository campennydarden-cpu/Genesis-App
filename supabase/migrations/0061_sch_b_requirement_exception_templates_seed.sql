-- supabase/migrations/0061_sch_b_requirement_exception_templates_seed.sql
-- Auto-triggered templates: straight ports of the retired commitment-text.ts
-- generators (src/lib/template-tags.ts's siClauseTags/relClauseTags/emClauseTags),
-- so behavior is unchanged until someone edits these in the admin panel.
insert into public.requirement_templates (category, label, body, trigger_source_type) values
  ('Mortgage', 'Release of Security Instrument',
   'Release of {{security_instrument.type}} {{security_instrument.party_clause}}{{security_instrument.optional_clauses}}, to be released of record prior to closing.',
   'si'),
  ('Related-Document-Release', 'Release of Related Document',
   'Release of {{related_document.type}} {{related_document.detail_clause}}, to be released of record prior to closing.',
   'rel'),
  ('Lien', 'Satisfaction/Dismissal of Lien',
   '{{lien.full_text}}',
   'lien');

-- ALTA Standard Requirements 1-4, verbatim per Cam's Screen Notes 2026-09-09.
-- No file-data tags in 1-3 (fixed boilerplate); 4a/4b are optional children of 4.
insert into public.requirement_templates (category, label, body, trigger_source_type) values
  ('General', 'ALTA Standard Requirement 1',
   'The Proposed Insured must notify the Company in writing of the name of any party not referred to in this Commitment who will obtain an interest in the Land or who will make a loan on the Land. The Company may then make additional Requirements or Exceptions.',
   null),
  ('General', 'ALTA Standard Requirement 2',
   'Pay the agreed amount for the estate or interest to be insured.',
   null),
  ('General', 'ALTA Standard Requirement 3',
   'Pay the premiums, fees, and charges for the Policy to the Company.',
   null),
  ('General', 'ALTA Standard Requirement 4',
   'Documents satisfactory to the Company that convey the Title or create the Mortgage to be insured, or both, must be properly authorized, executed, delivered, and recorded in the Public Records.',
   null);

insert into public.requirement_templates (category, label, body, trigger_source_type, parent_template_id) values
  ('General', 'ALTA Standard Requirement 4a (Deed)',
   '{{deed.type}} from {{contact.seller_names}} to {{contact.buyer_names}}, to recorded among the land records for {{property.county}} County, {{property.state}}.',
   null,
   (select id from public.requirement_templates where label = 'ALTA Standard Requirement 4')),
  ('General', 'ALTA Standard Requirement 4b (Security Instrument)',
   '{{security_instrument.type}} from {{contact.buyer_names}} to {{security_instrument.mortgagee}}, securing the principal sum of {{loan.principal_amount}} to be recorded among the land records for {{property.county}} County, {{property.state}}.',
   null,
   (select id from public.requirement_templates where label = 'ALTA Standard Requirement 4'));

-- Entity-Confirmation: Cam's own trigger rule ("when Buyer/Borrower or Seller's
-- entity type isn't Individual, suggest additional entity-confirmation
-- requirements/exceptions"). Draft wording pending Cam's review in the admin panel
-- (not ALTA-sourced, unlike Requirements 1-4 above).
insert into public.requirement_templates (category, label, body, trigger_source_type) values
  ('Entity-Confirmation', 'Entity Authority Documents',
   'Provide the Company with a copy of the organizational and authority documents (e.g. Articles of Organization/Incorporation, Operating Agreement/Bylaws, and a Certificate of Good Standing) for {{contact.buyer_names}}, evidencing the authority of the person executing documents on its behalf.',
   null);

-- Auto-triggered exception template: straight port of the retired emExceptionText.
insert into public.exception_templates (category, label, body, trigger_source_type) values
  ('General', 'Exception Matter',
   '{{exception_matter.description_or_default}}{{exception_matter.recording_clause}}.',
   'em');

-- Auto-triggered exception template for Property Access/Easements/ROW — new source
-- type, no prior generator existed. Draft wording pending Cam's review.
insert into public.exception_templates (category, label, body, trigger_source_type) values
  ('General', 'Property Easement',
   '{{easement.type}}{{easement.description_clause}}, as shown by the public records.',
   'easement');

-- ALTA Standard Exceptions 1-5, verbatim per Cam's Screen Notes 2026-09-09. Fixed
-- boilerplate, no tags.
insert into public.exception_templates (category, label, body, trigger_source_type) values
  ('General', 'ALTA Standard Exception 1',
   'Any defect, lien, encumbrance, adverse claim, or other matter that appears for the first time in the Public Records or is created, attaches, or is disclosed between the Commitment Date and the date on which all of the Schedule B, Part I—Requirements are met.',
   null),
  ('General', 'ALTA Standard Exception 2',
   'Rights or claims of parties in possession of the Land not shown by the public records.',
   null),
  ('General', 'ALTA Standard Exception 3',
   'Rights of tenants in possession or under unrecorded leases.',
   null),
  ('General', 'ALTA Standard Exception 4',
   'Easements, or claims of easements, not shown by the public records.',
   null),
  ('General', 'ALTA Standard Exception 5',
   'Any lien or right to a lien, for services, labor, or material heretofore or hereafter furnished, imposed by law and not shown by the public records.',
   null);

-- Entity-Confirmation exception counterpart to the requirement above. Draft wording.
insert into public.exception_templates (category, label, body, trigger_source_type) values
  ('Entity-Confirmation', 'Entity Authority Matters',
   'Matters relating to the organization, existence, and authority of {{contact.buyer_names}} to hold title and/or execute the instruments necessary to convey or encumber the Land.',
   null);
