# Document Preparation Implementation Plan

**Goal:** Build the 5 Document Preparation screens (Deed, Security Instrument, Affidavits, Power of Attorney, Notary Acknowledgement) — currently disabled placeholder nav items, 0% built in the rebuild. Replaces `FileSectionsNav`'s disabled `Document Preparation` group items with real routed links.

**Spec sources:** `Design Notes - Platform.md`'s "Doc Prep screen / Recording milestone" section, `Genesis Build Log.md`'s 2026-08-24 entries, and — as ground truth where the vault drifted — the old prototype's actual code (`genesis-github-push/genesis-app.html`). One real doc/code conflict found and resolved: `Design Notes - Platform.md` claims Security Instrument's Mortgagor/Mortgagee "remain pulled LIVE from Contacts," but the prototype's code (`docPrep.securityInstrument.mortgagorName` etc., comment: "independent of Order Contacts") and the Build Log's 2026-08-24 entry both confirm they were reversed to independent copies, same as Deed's Grantor/Grantee. Going with the code-verified version.

**Cam's standing direction** (2026-08-24, quoted in Build Log): "all Doc Prep fields need to be editable — filter down where applicable, but edited for the final merged document." Every Doc Prep field that pulls from elsewhere in the file is a one-time, non-destructive auto-fill (or manual "Copy from a file contact"/"Refill from source" action), never a live read-only mirror — except where explicitly noted otherwise.

**Two deliberate scope trims vs. the prototype** (ponytail-lite — flag, don't silently cut):
1. Deed's Prepared By / Return To: single-Contact picker only, skipping the prototype's role-group batch option ("All Seller"). Add if a real multi-party Return To need comes up.
2. Deed's Subject To: a plain free-form CRUD list, skipping the prototype's auto-seed-from-Exception-Matters dedup-on-use chip mechanism (the same pattern Requirements/Exceptions use). Add later if Subject To boilerplate turns out to repeat enough to be worth it.

Everything else matches the prototype's validated behavior.

## Schema — one migration, `0024_document_preparation.sql`

- `doc_prep_deed` (one row per order, `order_id` unique): `instrument_type, consideration, dated_date, recorded_date, book, page, instrument_number, prepared_by_contact_id, return_to_contact_id, exemption_code, legal_as_exhibit bool, final bool, finalized_at, grantor_name, grantor_entity_type, grantee_name, grantee_entity_type, notary_block, legal_text, parcel_number, derivation_text, situs_address`
- `doc_prep_deed_principals` (`deed_id, side` ('grantor'|'grantee'), `name, role`) — mirrors `contact_principals`
- `doc_prep_deed_signature_lines` (`deed_id, text`) — mirrors `contact_signature_lines`
- `doc_prep_deed_subject_to` (`deed_id, description, sort_order`) — plain free-form list (trim #2 above)
- `doc_prep_security_instrument` (one row per order, `order_id` unique): `instrument_type, trustee_name, loan_amount, dated_date, recorded_date, book, page, instrument_number, mortgagor_name, mortgagor_entity_type, mortgagee_name, mortgagee_entity_type, note_date, note_amount, maturity_date, interest_rate`
- `doc_prep_si_principals` (`si_id, side` ('mortgagor'|'mortgagee'), `name, role`)
- `doc_prep_affidavits` (`order_id, type, affiant, dated_date, recorded bool, recorded_date, book, page, instrument_number, notes, sort_order`) — free multi-entry list
- `doc_prep_notary_acks` (`order_id, contact_id, doc_label, text`) — auto-generated per (Contact, document) signer pair on read, independently editable, Regenerate button overwrites
- `contacts` gains `poa_attorney_in_fact_name, poa_dated_date, poa_recorded_date, poa_book, poa_page, poa_instrument_number` (structured, per the prototype's own "upgraded from free-text poaInstrumentRef" note) — POA has no table of its own, it's a Doc Prep screen listing every `contacts.poa = true` row and writing back onto that same Contact record.

RLS: same blanket `for all to authenticated using (true) with check (true)` pattern as every other table.

## Constants / types

- Reuse existing `DERIVATION_INSTRUMENT_TYPES` for Deed's instrument type (prototype's `DEED_INSTRUMENT_TYPES` is a strict subset — reusing avoids a near-duplicate list) and `SECURITY_INSTRUMENT_TYPES` for SI (already identical).
- New: `AFFIDAVIT_TYPES` (`Owner's Affidavit, Affidavit of Title, Name Affidavit / Affidavit of Identity, Non-Foreign Affidavit (FIRPTA), Survey Affidavit, Gap Affidavit, Debts and Liens Affidavit, Other`).
- New types in `lib/types.ts`: `DocPrepDeed`, `DocPrepDeedPrincipal`, `DocPrepDeedSignatureLine`, `DocPrepDeedSubjectTo`, `DocPrepSecurityInstrument`, `DocPrepSiPrincipal`, `DocPrepAffidavit`, `NotaryAck`.

## Server actions

- `app/actions/doc-prep-deed.ts`: get-or-create-on-read `getOrCreateDeed(orderId)` (mirrors the one-row-per-order pattern — no existing precedent for this exact shape in the codebase, closest is `curative_settings`), field autosave actions, principals CRUD, signature-lines CRUD, subject-to CRUD, copy-from-contact (incl. married-pair), toggle Final/Draft, refill-from-source for legal/parcel/derivation/situs, generate-notary-block-from-grantor.
- `app/actions/doc-prep-security-instrument.ts`: same shape for SI.
- `app/actions/doc-prep-affidavits.ts`: list/add/edit/delete.
- `app/actions/doc-prep-poa.ts`: list contacts where `poa = true`, update the 5 new fields on a contact.
- `app/actions/doc-prep-notary-acks.ts`: `listNotaryAcks(orderId)` — computes the live signer-pair list (Deed signers = `role = 'Seller'` contacts, SI signers = `role = 'Buyer/Borrower'` contacts, matching the prototype exactly), syncs `doc_prep_notary_acks` rows to match (insert new pairs, prune stale ones), returns the merged list; `updateNotaryAckText`, `regenerateNotaryAck`.

## Components / routes

- `app/orders/[id]/deed/page.tsx` + `DeedForm.tsx` (autosave-on-blur via `useAutosave`, matching Property/Contacts/Schedule A)
- `app/orders/[id]/security-instrument/page.tsx` + `SecurityInstrumentForm.tsx`
- `app/orders/[id]/affidavits/page.tsx` + `AffidavitsPanel.tsx`
- `app/orders/[id]/power-of-attorney/page.tsx` + `PowerOfAttorneyPanel.tsx`
- `app/orders/[id]/notary-acknowledgement/page.tsx` + `NotaryAcknowledgementPanel.tsx`
- `FileSectionsNav.tsx`: add `segment` to the 5 Document Preparation items, turning them from disabled placeholders into real links.

## Verification

- `npm run lint` / `npm run build` clean after each screen.
- Playwright: `tests/e2e/document-preparation.spec.ts` — one test per screen's core flow (Deed copy-from-contact + Draft/Final + signature lines; SI copy-from-contact + Note fields; Affidavits add/edit/delete; POA field save on a `poa=true` contact; Notary Ack auto-generates for a Seller contact and Regenerate overwrites edits).
- Live browser verification against a real order before calling this done, matching this project's standing practice.
- Independent code-review pass at the end (Cam's ask: "plan, implement, review").
