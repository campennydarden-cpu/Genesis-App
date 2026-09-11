# Document Assembly Engine (Phase 1: Commitment) — Design

**Status:** design complete, awaiting Cam's spec review
**Date:** 2026-09-10

## Problem

What started as "Commitment-merge workflow" (Schedule A/B's Draft→Final cycle
needing a Revision Number, and a way to re-issue a commitment after a title
Date Down/Bring Down from the abstractor) turned out to need something much
more foundational once Cam described the actual mechanism he wants: a real
document — a Word file with smart field tags — that can be **merged in
place** from current file data, **re-merged (refreshed)** at any point while
in Draft, and **exported as a PDF** to email a client. Today, every generated
document in this app (Schedule A's Proposed Insured, Mortgagee Clause, Chain
of Title; the Deed; Security Instrument) works by one-time "seed chip" copy
buttons that then diverge independently — there's no re-mergeable document at
all, and no PDF export anywhere in the app.

This is scoped as its own project — a general **document assembly
engine** — with the **Commitment** (Schedule A + Schedule B-I/B-II) as its
first real document. Reuse for Deed, Security Instrument, Affidavits, Power
of Attorney, and Notary Acknowledgement is a real future direction implied by
"document tree architecture," but explicitly not designed here.

## Key clarification: this doesn't replace Schedule A/B's structured data

`commitment_sch_a`, `commitment_requirements`, and `commitment_exceptions`
remain exactly what they are today — the structured source of truth staff
edit through the existing web screens. The Word document is a new
**presentation/output layer** on top of that data, not a replacement for it.
A merge fills the document's tagged fields *from* those tables; it never
becomes the primary place data is entered.

## Platform decision: ONLYOFFICE, self-hosted

**Rejected: raw Word file manipulation.** Word Content Controls have
documented, real corruption problems under ordinary user behavior — Microsoft's
own support forums describe controls disappearing during copy-paste and
actual document corruption from copy-pasting between controls. For legal
documents carrying the same E&O exposure this app already treats carefully
elsewhere (the Recording rate tables' data-governance concern is the same
shape of risk), building the core mechanism on a file format with known
corruption modes was rejected.

**Rejected: Google Docs API.** No infrastructure to run, and Named Ranges
serve the same role as Content Controls — but title/escrow documents (which
already carry SSNs and financial data this app treats carefully) would live
in Google's cloud rather than infrastructure M&L controls. Also has real
technical caveats (a named range can split into multiple ranges under
certain edits; multiple ranges sharing a name all get replaced together).

**Chosen: ONLYOFFICE Document Server, self-hosted, Community Edition.**
Open-source (AGPL v3), free, capped at 20 concurrent editing connections —
comfortably above this office's actual scale (ONLYOFFICE's own guidance for
1-5 concurrent users is 2 CPU / 4GB RAM). Because it's API-driven rather than
file-round-trip-driven, reading and writing a document's Content Controls
happens through defined server calls against a live document, not by parsing
whatever a desktop app happened to save — this is what actually avoids the
corruption risk, provided editing happens inside ONLYOFFICE's own embedded
editor rather than in real Microsoft Word (see below).

## Editing model: embedded in-app (not download/edit-in-Word/re-upload)

Confirmed with Cam: staff review and edit the merged document **inside
Genesis**, via ONLYOFFICE's embedded editor component talking to the
self-hosted Document Server — never downloading a `.docx` and opening real
Microsoft Word for this. This is the only version of this architecture that
actually delivers ONLYOFFICE's advantage: if people instead hand-edited a
downloaded Word file, the same Content Control corruption risk that ruled out
raw Word in the first place would apply just as much, regardless of what
generated the file.

## Hosting

Self-hosted via DigitalOcean's official one-click Marketplace app for
ONLYOFFICE Docs — a pre-configured droplet, no hand-written Docker Compose
needed for the base install. Estimated cost at this office's scale: roughly
$6-24/month depending on droplet size (2 vCPU/4GB is ONLYOFFICE's own
recommendation for 1-5 concurrent users). Genesis itself stays on Vercel —
Vercel can't run a persistent service like Document Server, so this is
necessarily separate infrastructure.

**Required production hardening (not optional, both are real setup work, not
config toggles):**
- **JWT authentication** between Genesis's backend and the Document Server,
  so only Genesis can request a document be opened or accept a save callback
  — this matters given the actual data involved.
- **HTTPS via a reverse proxy** (nginx + Let's Encrypt is ONLYOFFICE's
  documented standard pattern) — the Document Server itself doesn't terminate
  TLS.

## Architecture — the full pipeline

1. **Template authoring**: a `.docx` with Content Controls tagged to field
   names (e.g. tag `proposed_insured`, `effective_date`, one per Sch B
   requirement/exception row), stored in a new Supabase Storage bucket
   (`document-templates`), matching the existing Attachments bucket pattern.
2. **Merge**: opening the Commitment document for the first time (or after a
   Date Down/Bring Down) fills the template's Content Controls from current
   `commitment_sch_a`/`commitment_requirements`/`commitment_exceptions` data,
   producing a filled `.docx`. Candidate mechanism: `docxtemplater`'s
   Content-Control tag-binding mode (`EnableContentControlTagBinding`) — an
   actively-maintained, open-source library that already supports this
   exact operation. **Flagged as needing a technical spike before full
   implementation** (see below) — this specific combination (docxtemplater
   merge → ONLYOFFICE embedded edit → Document Builder read-back) hasn't been
   proven end-to-end.
3. **Embedded review/edit**: the filled document opens inside Genesis via
   ONLYOFFICE's embedded editor component, authenticated via the JWT config
   above.
4. **Save callback**: ONLYOFFICE's standard integration pattern — on save,
   the Document Server POSTs the updated file to a webhook Genesis provides.
5. **Read-back / diff**: Genesis extracts each Content Control's current
   value. Candidate mechanism: an ONLYOFFICE Document Builder script (its
   scripting engine can read Content Controls server-side) — this sidesteps
   the weak Node.js support for reading Content Controls out of an existing
   file that surfaced during research. Compared against a **last-merged
   snapshot** (stored per document instance, one value per tag) — this
   three-way comparison (current document value vs. last-merged snapshot vs.
   current database value) is what distinguishes "the document was hand-edited"
   from "nothing changed here."
6. **Review screen**: any field whose document value diverged from its
   last-merged snapshot surfaces old-vs-new, with a per-field accept/reject
   control — never an all-or-nothing choice, and never a silent overwrite
   (Cam's decision: ask first, not auto-push).
7. **PDF export**: ONLYOFFICE's built-in conversion service renders the
   current document as a PDF for emailing to a client.

## Data model (sketch — full schema is implementation-plan-level detail)

- **`document_templates`**: `id`, `document_type` (starts with just
  `'commitment'`), `storage_path`, `created_at`. One row per document type,
  not per order.
- **A per-order document instance** (table name and exact shape TBD at
  implementation time — likely `order_documents` or scoped under
  `commitment_sch_a` itself, since Commitment is the only document type in
  Phase 1): `order_id`, `template_id`, `storage_path` (current merged
  `.docx`), `last_merged_snapshot` (one value per Content Control tag, at the
  moment of the most recent merge), `pdf_storage_path`, `revision_number`.
- **Revision Number**: increments each time a full merge-and-finalize cycle
  completes (tying back to the original Fix Plan ask) — exact trigger point
  (on merge? on Finalize? on Date Down specifically?) is a remaining open
  question for the implementation plan, not resolved here.

## Recommended next step: a technical spike

This pipeline chains three pieces of technology that have never been proven
together in this codebase: `docxtemplater`'s Content-Control binding, a
self-hosted ONLYOFFICE Document Server's embedded editor, and Document
Builder scripting for read-back. Each piece is independently documented and
plausible, but the full chain is not implementation-plan-ready until a small
spike proves: (1) a Content-Control-tagged template can be merged via
docxtemplater, (2) the merged file opens correctly in an embedded ONLYOFFICE
editor, (3) a Document Builder script can read back a Content Control's
current value after a real edit inside that embedded editor, and (4) that
value survives correctly through a save-callback round trip. Recommend
running this spike (self-hosted Document Server on a throwaway droplet, one
template, one tag) before writing the full implementation plan.

## Out of scope for this pass

- Reuse of this engine for Deed, Security Instrument, Affidavits, Power of
  Attorney, Notary Acknowledgement — a real future direction, not designed
  here.
- The Date Down/Bring Down real-world request-tracking workflow itself
  (request sent to abstractor, package received) — this spec covers "merge a
  new commitment," which is the piece that was actually missing; the
  surrounding steps (upload the new search package via Attachments, update
  Prelim Search's effective date) already exist as capabilities.
- Exact trigger point for Revision Number increment — implementation-plan
  question.
- Exact per-order document instance table shape — implementation-plan
  question.
