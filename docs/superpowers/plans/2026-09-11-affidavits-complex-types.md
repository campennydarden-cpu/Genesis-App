# Affidavits — Complex Per-Type Field Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue Tier 5 item 15 (Affidavits real per-type field sets) with the second, more complex batch: 10 of the remaining 15 Affidavit Types, now that Cam has supplied reference templates for them, plus one brand-new canonical type — **Affidavit of Affixation** — that Cam explicitly asked to be added (2026-09-11) using three manufactured-home-conversion templates as source material even though none of them are literally an "Affidavit." The other 4 types with still no reference material (Owner's Affidavit, Notice of Availability, Commitment Acknowledgement, Joint Tenancy Affidavit) stay generic, same as the first batch's untouched 15.

**Depends on:** `2026-09-11-affidavits-simple-types.md` — this plan reuses several columns that plan adds (`affiant_contact_id` already exists; `second_party_contact_id`/`second_party_name`/`reference_number`/`recorded`/`recorded_date`/`book`/`page`/`instrument_number` — the last four already existed pre-simple-types, only `second_party_*`/`reference_number` are new from that plan). **Run that plan's migration first** if it hasn't landed yet — check `select column_name from information_schema.columns where table_name = 'doc_prep_affidavits'` before starting Task 1 here.

**Architecture:** Same shape as the simple-types plan — `doc_prep_affidavits` gains more nullable columns, reusing simple-types' columns wherever the concept matches (a second named party, a reference number, a prior recorded instrument), plus a few genuinely new shared concepts (`deceased_name`, `date_of_death`, `tin`) reused across multiple types, plus six `jsonb` array columns for the Personal Information Affidavit's repeating history/exception lists (residence history, occupation history, divorce/name-change/bankruptcy/judgment-lien records) — a single small repeatable-rows mini-editor component handles all six rather than six bespoke child tables or six bespoke editors.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres, `jsonb` columns for repeating rows), React (client component), Playwright e2e.

**Spec:** No separate spec file — bounded change approved in chat 2026-09-11 (including explicit approval to add "Affidavit of Affixation" as a 23rd canonical type). Source references (all under `M&L Title - Obsidian Vault/Source Material/Deed:Doc Templates/`): `NC - Dec of Intent to Affix MH.pdf`, `TN - Affidavit of Affixation.pdf`, `PA - Form MV-16 (App for Cancellation fo Cert of Title).pdf` (Affidavit of Affixation), `Certificatefor1099SReporting.pdf` (Certification of No Information Reporting), `W-9.pdf`, `FIRPTA Affidavit.pdf`, `BLANK Fidelity Survey Affidavit.pdf` / `Survey Affidavit.doc` / `Affidavit In Lieu Of Survey.doc` (Survey Affidavit), `Personal Information Affidavit.pdf` (Buyer/Seller Personal Information Affidavit — same template, one per party), `VA - List of Heirs.pdf` (Affidavit of Heirship), `GA - Affidavit Affecting Title (Death of Joint Tenant).pdf` (Affidavit of Death - JTWROS), `TN - Affidavit of Death of Trustee.docx` (Affidavit of Death - Trustee — binary .docx, not machine-read for this plan; fields below follow the standard successor-trustee affidavit pattern used industry-wide, confirm against the actual template during implementation), `NC - Affidavit of Continuous Marriage (by Surviving Spouse).docx` (Continuous Marriage Affidavit + Surviving Spouse variant — same binary-.docx caveat).

**Explicitly out of scope:** `Affidavit_No_Equalization_Due_Template.docx` — Cam said to ignore it for now, it's unrelated to this pass.

## Global Constraints

- **`AFFIDAVIT_TYPES` gains exactly one new entry: `'Affidavit of Affixation'`.** This is the one exception to the simple-types plan's "canonical list is fixed" rule — Cam explicitly approved it this session. Append it to the array in `src/lib/constants.ts` (position doesn't matter, the dropdown is already alphabetized at display time by the simple-types plan); do not reorder or remove any existing entry.
- **Do not remove or restructure the 4 still-generic types' handling** (Owner's Affidavit, Notice of Availability, Commitment Acknowledgement, Joint Tenancy Affidavit) — they keep rendering the plain generic form, same as every untouched type from the first batch.
- Migration filename number: run `ls supabase/migrations | sort -V | tail -3` before writing the migration (same as simple-types Task 1) — do not assume a specific number, and account for the simple-types migration if it hasn't run yet.
- Shared new columns are added once and reused across every type that needs the same concept, not duplicated per type:
  - `deceased_name` — reused by Affidavit of Heirship, Affidavit of Death - JTWROS, Affidavit of Death - Trustee, Continuous Marriage Affidavit (Surviving Spouse).
  - `date_of_death` — reused by the same four types above.
  - `tin` (SSN or EIN, free text — deliberately not validated/masked beyond a plain text field, matching how this codebase already treats bank/tax numbers elsewhere) — reused by W-9, Certification of No Information Reporting, and FIRPTA.
  - `second_party_contact_id`/`second_party_name`/`reference_number` (from simple-types) — reused where applicable (e.g. FIRPTA's entity signer is *not* a second party, it's the affiant's own capacity, so it gets its own fields instead — see Task 1).
  - The existing `recorded`/`recorded_date`/`book`/`page`/`instrument_number` fields are reused for "the deed/deed-of-trust this affidavit references" on Affidavit of Death - JTWROS and Affidavit of Death - Trustee, exactly as the simple-types plan already established for Marital Status Affidavit — this is not a recording of the affidavit itself.
- **Personal Information Affidavit's six repeating lists are `jsonb` arrays, not child tables.** Each defaults to `'[]'::jsonb` and holds an array of small flat objects (see Task 1 for each list's shape). One shared `RepeatableRows` component (Task 3) renders add/remove/edit UI for all six — building six bespoke editors or six new tables would be considerably more code for the same result, and none of these lists need to be queried or joined outside this one affidavit record.
- Buyer Personal Information Affidavit and Seller Personal Information Affidavit are two separate `AFFIDAVIT_TYPES` entries (already exist) that both render the **same** extra-fields component — the existing `affiant`/`affiant_contact_id` fields already distinguish which contact (buyer or seller) the affidavit is about, so no new "which party" column is needed.
- Property address and File Number remain out of scope here too, same reasoning as the simple-types plan (already available from `Order.property_address`/`Order.file_number`, not modeled per-affidavit).

---

### Task 1: Migration — new `doc_prep_affidavits` columns, `DocPrepAffidavit` type, `AFFIDAVIT_TYPES` update

**Files:**
- Create: `supabase/migrations/00XX_affidavit_complex_type_fields.sql` (replace `00XX` with the real next number)
- Modify: `src/lib/types.ts` (the `DocPrepAffidavit` type)
- Modify: `src/lib/constants.ts` (append `'Affidavit of Affixation'` to `AFFIDAVIT_TYPES`)

**Interfaces:**
- Produces: the new `DocPrepAffidavit` fields listed below — consumed by Task 2 and Task 3.

- [ ] **Step 1: Find the real next migration number**

Run: `ls supabase/migrations | sort -V | tail -3`. Confirm the simple-types migration (`affidavit_type_fields`) is already in that list — if not, run it first (see that plan's Task 1).

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/00XX_affidavit_complex_type_fields.sql
-- Tier 5 item 15 (real per-type Affidavit field sets), second pass: 10 more types
-- with reference templates now on file, plus the new 'Affidavit of Affixation' type
-- Cam approved adding. See the implementation plan's Global Constraints for which
-- columns are shared across types and why the six history/exception lists on the
-- Personal Information Affidavit are jsonb arrays rather than child tables.
alter table public.doc_prep_affidavits
  -- Shared across Affidavit of Heirship, Affidavit of Death - JTWROS,
  -- Affidavit of Death - Trustee, Continuous Marriage Affidavit (Surviving Spouse).
  add column deceased_name text,
  add column date_of_death date,
  -- Shared across W-9, Certification of No Information Reporting, FIRPTA.
  add column tin text,

  -- Affidavit of Affixation (new type) -- home description, title/lien status.
  -- One design covers the NC/PA/TN source templates' common ground; jurisdiction-
  -- specific boilerplate (permits, foundation compliance, utilities, legal
  -- description of land) is left to the existing `notes` field rather than
  -- modeled as its own columns, since it varies most by state.
  add column home_new_or_used text check (home_new_or_used in ('New', 'Used')),
  add column home_year text,
  add column home_make text,
  add column home_model text,
  add column home_serial_number text,
  add column certificate_of_title_status text
    check (certificate_of_title_status in (
      'Never titled, MCO attached', 'Never titled, MCO not attached',
      'Certificate of title held, to be surrendered', 'Title previously surrendered/cancelled'
    )),
  add column lienholder_name text,
  add column lienholder_address text,
  add column lienholder_amount numeric,

  -- Certification of No Information Reporting Sale or Exchange Principal Residence --
  -- assurances (1)-(5) are true/false, assurance (6) is true/false/not-applicable.
  add column assurance_1 boolean,
  add column assurance_2 boolean,
  add column assurance_3 boolean,
  add column assurance_4 boolean,
  add column assurance_5 boolean,
  add column assurance_6 text check (assurance_6 in ('True', 'False', 'N/A')),
  add column forwarding_address text,

  -- W-9 Request for Taxpayer ID and Certification (seller).
  add column w9_business_name text,
  add column w9_tax_classification text
    check (w9_tax_classification in (
      'Individual/sole proprietor', 'C corporation', 'S corporation',
      'Partnership', 'Trust/estate', 'LLC', 'Other'
    )),
  add column w9_llc_tax_classification text check (w9_llc_tax_classification in ('C', 'S', 'P')),
  add column w9_exempt_payee_code text,
  add column w9_fatca_exemption_code text,

  -- FIRPTA -- Certification of Non-Foreign Transferor. `tin` above covers both the
  -- individual SSN and entity EIN cases; these two are entity-transferor-only.
  add column firpta_transferor_type text check (firpta_transferor_type in ('Individual', 'Entity')),
  add column firpta_entity_signer_name text,
  add column firpta_entity_signer_title text,

  -- Survey Affidavit -- "no new improvements/encroachments since the attached survey."
  add column survey_date date,
  add column no_new_improvements_or_encroachments boolean,

  -- Affidavit of Heirship.
  add column heirs jsonb not null default '[]'::jsonb,
  add column heirship_filer_role text
    check (heirship_filer_role in ('Proponent of will', 'Personal representative', 'Heir-at-law')),

  -- Affidavit of Death - Trustee.
  add column trust_name text,

  -- Continuous Marriage Affidavit (both the base type and the Surviving Spouse variant).
  add column marriage_date date,

  -- Buyer/Seller Personal Information Affidavit -- marital status snapshot plus six
  -- repeating history/exception lists, each `[]` meaning "none to report."
  add column personal_info_marital_status text
    check (personal_info_marital_status in ('Never married', 'Widowed', 'Married')),
  add column personal_info_spouse_name text,
  add column personal_info_marriage_place text,
  add column personal_info_marriage_year text,
  add column has_never_divorced boolean not null default true,
  add column divorce_records jsonb not null default '[]'::jsonb,
  add column has_never_changed_name boolean not null default true,
  add column name_change_records jsonb not null default '[]'::jsonb,
  add column has_never_bankrupt boolean not null default true,
  add column bankruptcy_records jsonb not null default '[]'::jsonb,
  add column has_no_judgments_liens boolean not null default true,
  add column judgment_lien_records jsonb not null default '[]'::jsonb,
  add column residence_history jsonb not null default '[]'::jsonb,
  add column occupation_history jsonb not null default '[]'::jsonb;
```

Row shapes for the six `jsonb` array columns (documented here for Task 3, not enforced at the DB level — small enough lists that app-level validation is sufficient, same trust level this codebase already gives other free-form jsonb):

- `heirs`: `{ name, address, relationship, age }`
- `divorce_records`: `{ former_spouse_name, year, case_no, county, state }`
- `name_change_records`: `{ from_name, year, case_no, county, state }`
- `bankruptcy_records`: `{ case_no, year, county, state }`
- `judgment_lien_records`: `{ case_no_and_court, plaintiff, defendant, judgment_date, amount }`
- `residence_history`: `{ from_date, to_date, street, city, state }`
- `occupation_history`: `{ from_date, to_date, occupation, employer, place_of_business }`

- [ ] **Step 3: Apply the migration**

Same workflow as `2026-09-10-staff-directory-permissions.md` Task 1 Step 5.

- [ ] **Step 4: Append the new type to `AFFIDAVIT_TYPES`**

In `src/lib/constants.ts`, add `'Affidavit of Affixation'` as a new entry in the `AFFIDAVIT_TYPES` array (any position — display order is already alphabetized by the simple-types plan's dropdown change).

- [ ] **Step 5: Update the `DocPrepAffidavit` type**

In `src/lib/types.ts`, add the new fields to `DocPrepAffidavit` (after the simple-types fields, or after `sort_order` if that plan hasn't run yet):

```typescript
  deceased_name: string | null
  date_of_death: string | null
  tin: string | null
  home_new_or_used: string | null
  home_year: string | null
  home_make: string | null
  home_model: string | null
  home_serial_number: string | null
  certificate_of_title_status: string | null
  lienholder_name: string | null
  lienholder_address: string | null
  lienholder_amount: number | null
  assurance_1: boolean | null
  assurance_2: boolean | null
  assurance_3: boolean | null
  assurance_4: boolean | null
  assurance_5: boolean | null
  assurance_6: string | null
  forwarding_address: string | null
  w9_business_name: string | null
  w9_tax_classification: string | null
  w9_llc_tax_classification: string | null
  w9_exempt_payee_code: string | null
  w9_fatca_exemption_code: string | null
  firpta_transferor_type: string | null
  firpta_entity_signer_name: string | null
  firpta_entity_signer_title: string | null
  survey_date: string | null
  no_new_improvements_or_encroachments: boolean | null
  heirs: { name: string; address: string; relationship: string; age: string }[]
  heirship_filer_role: string | null
  trust_name: string | null
  marriage_date: string | null
  personal_info_marital_status: string | null
  personal_info_spouse_name: string | null
  personal_info_marriage_place: string | null
  personal_info_marriage_year: string | null
  has_never_divorced: boolean
  divorce_records: { former_spouse_name: string; year: string; case_no: string; county: string; state: string }[]
  has_never_changed_name: boolean
  name_change_records: { from_name: string; year: string; case_no: string; county: string; state: string }[]
  has_never_bankrupt: boolean
  bankruptcy_records: { case_no: string; year: string; county: string; state: string }[]
  has_no_judgments_liens: boolean
  judgment_lien_records: { case_no_and_court: string; plaintiff: string; defendant: string; judgment_date: string; amount: string }[]
  residence_history: { from_date: string; to_date: string; street: string; city: string; state: string }[]
  occupation_history: { from_date: string; to_date: string; occupation: string; employer: string; place_of_business: string }[]
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/00XX_affidavit_complex_type_fields.sql src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add fields for 10 complex Affidavit Types plus new Affidavit of Affixation type"
```

---

### Task 2: `doc-prep-affidavits.ts` — persist the new fields

**Files:**
- Modify: `src/app/actions/doc-prep-affidavits.ts`

**Interfaces:**
- Consumes: the new `DocPrepAffidavit` columns (Task 1).

- [ ] **Step 1: Add the scalar fields to both `addAffidavit`/`updateAffidavit` payloads**

Following the existing `strOrNull`/`numOrNull`/checkbox helper pattern:

```typescript
deceased_name: strOrNull('deceased_name'),
date_of_death: strOrNull('date_of_death'),
tin: strOrNull('tin'),
home_new_or_used: strOrNull('home_new_or_used'),
home_year: strOrNull('home_year'),
home_make: strOrNull('home_make'),
home_model: strOrNull('home_model'),
home_serial_number: strOrNull('home_serial_number'),
certificate_of_title_status: strOrNull('certificate_of_title_status'),
lienholder_name: strOrNull('lienholder_name'),
lienholder_address: strOrNull('lienholder_address'),
lienholder_amount: numOrNull('lienholder_amount'),
assurance_1: formData.get('assurance_1') === 'on',
assurance_2: formData.get('assurance_2') === 'on',
assurance_3: formData.get('assurance_3') === 'on',
assurance_4: formData.get('assurance_4') === 'on',
assurance_5: formData.get('assurance_5') === 'on',
assurance_6: strOrNull('assurance_6'),
forwarding_address: strOrNull('forwarding_address'),
w9_business_name: strOrNull('w9_business_name'),
w9_tax_classification: strOrNull('w9_tax_classification'),
w9_llc_tax_classification: strOrNull('w9_llc_tax_classification'),
w9_exempt_payee_code: strOrNull('w9_exempt_payee_code'),
w9_fatca_exemption_code: strOrNull('w9_fatca_exemption_code'),
firpta_transferor_type: strOrNull('firpta_transferor_type'),
firpta_entity_signer_name: strOrNull('firpta_entity_signer_name'),
firpta_entity_signer_title: strOrNull('firpta_entity_signer_title'),
survey_date: strOrNull('survey_date'),
no_new_improvements_or_encroachments: formData.get('no_new_improvements_or_encroachments') === 'on',
heirship_filer_role: strOrNull('heirship_filer_role'),
trust_name: strOrNull('trust_name'),
marriage_date: strOrNull('marriage_date'),
personal_info_marital_status: strOrNull('personal_info_marital_status'),
personal_info_spouse_name: strOrNull('personal_info_spouse_name'),
personal_info_marriage_place: strOrNull('personal_info_marriage_place'),
personal_info_marriage_year: strOrNull('personal_info_marriage_year'),
has_never_divorced: formData.get('has_never_divorced') === 'on',
has_never_changed_name: formData.get('has_never_changed_name') === 'on',
has_never_bankrupt: formData.get('has_never_bankrupt') === 'on',
has_no_judgments_liens: formData.get('has_no_judgments_liens') === 'on',
```

- [ ] **Step 2: Add the seven `jsonb` list fields**

These arrive as a JSON string from the client component (Task 3 serializes each list before submit), not individual form fields:

```typescript
heirs: JSON.parse((formData.get('heirs') as string) || '[]'),
divorce_records: JSON.parse((formData.get('divorce_records') as string) || '[]'),
name_change_records: JSON.parse((formData.get('name_change_records') as string) || '[]'),
bankruptcy_records: JSON.parse((formData.get('bankruptcy_records') as string) || '[]'),
judgment_lien_records: JSON.parse((formData.get('judgment_lien_records') as string) || '[]'),
residence_history: JSON.parse((formData.get('residence_history') as string) || '[]'),
occupation_history: JSON.parse((formData.get('occupation_history') as string) || '[]'),
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/doc-prep-affidavits.ts
git commit -m "feat: persist complex per-type Affidavit fields"
```

---

### Task 3: `AffidavitsPanel.tsx` — extra-fields components, shared repeatable-rows editor

**Files:**
- Modify: `src/components/doc-prep/AffidavitsPanel.tsx`

**Interfaces:**
- Consumes: the new `DocPrepAffidavit` fields (Task 1), the existing `TYPE_EXTRA_FIELDS` map and `ExtraFieldsProps` type (from the simple-types plan).

- [ ] **Step 1: Add a shared `RepeatableRows` component**

Add this once, above `AffidavitFields`, alongside the simple-types plan's extra-fields components:

```tsx
type RepeatableRowsProps = {
  name: string
  label: string
  columns: { key: string; label: string; type?: 'text' | 'date' | 'number' }[]
  initialRows: Record<string, string>[]
}

function RepeatableRows({ name, label, columns, initialRows }: RepeatableRowsProps) {
  const [rows, setRows] = useState<Record<string, string>[]>(initialRows.length ? initialRows : [])

  const addRow = () => setRows([...rows, Object.fromEntries(columns.map((c) => [c.key, '']))])
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i))
  const updateRow = (i: number, key: string, value: string) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))

  return (
    <div className="col-span-4">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button type="button" onClick={addRow} className="text-sm underline">
          + Add
        </button>
      </div>
      {rows.length === 0 && <p className="text-sm text-gray-500">None</p>}
      {rows.map((row, i) => (
        <div key={i} className="mb-1 grid grid-cols-5 gap-1">
          {columns.map((c) => (
            <Input
              key={c.key}
              type={c.type ?? 'text'}
              placeholder={c.label}
              value={row[c.key] ?? ''}
              onChange={(e) => updateRow(i, c.key, e.target.value)}
            />
          ))}
          <button type="button" onClick={() => removeRow(i)} className="text-sm text-red-600">
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add the Affidavit of Affixation extra fields**

```tsx
function AffixationExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <>
      <div>
        <Label htmlFor={id('home_new_or_used')}>New/Used</Label>
        <select id={id('home_new_or_used')} name="home_new_or_used" defaultValue={affidavit?.home_new_or_used ?? ''} className="block w-full rounded border px-2 py-1 text-sm">
          <option value="">—</option>
          <option value="New">New</option>
          <option value="Used">Used</option>
        </select>
      </div>
      <div>
        <Label htmlFor={id('home_year')}>Year</Label>
        <Input id={id('home_year')} name="home_year" defaultValue={affidavit?.home_year ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('home_make')}>Manufacturer / Make</Label>
        <Input id={id('home_make')} name="home_make" defaultValue={affidavit?.home_make ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('home_model')}>Model</Label>
        <Input id={id('home_model')} name="home_model" defaultValue={affidavit?.home_model ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('home_serial_number')}>Serial No. / VIN</Label>
        <Input id={id('home_serial_number')} name="home_serial_number" defaultValue={affidavit?.home_serial_number ?? ''} />
      </div>
      <div className="col-span-2">
        <Label htmlFor={id('certificate_of_title_status')}>Certificate of Title Status</Label>
        <select
          id={id('certificate_of_title_status')}
          name="certificate_of_title_status"
          defaultValue={affidavit?.certificate_of_title_status ?? ''}
          className="block w-full rounded border px-2 py-1 text-sm"
        >
          <option value="">—</option>
          <option value="Never titled, MCO attached">Never titled, MCO attached</option>
          <option value="Never titled, MCO not attached">Never titled, MCO not attached</option>
          <option value="Certificate of title held, to be surrendered">Certificate of title held, to be surrendered</option>
          <option value="Title previously surrendered/cancelled">Title previously surrendered/cancelled</option>
        </select>
      </div>
      <div>
        <Label htmlFor={id('lienholder_name')}>Lienholder Name</Label>
        <Input id={id('lienholder_name')} name="lienholder_name" defaultValue={affidavit?.lienholder_name ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('lienholder_address')}>Lienholder Address</Label>
        <Input id={id('lienholder_address')} name="lienholder_address" defaultValue={affidavit?.lienholder_address ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('lienholder_amount')}>Original Principal Amount Secured</Label>
        <Input id={id('lienholder_amount')} name="lienholder_amount" type="number" step="0.01" defaultValue={affidavit?.lienholder_amount ?? ''} />
      </div>
    </>
  )
}
```

- [ ] **Step 3: Add the Certification of No Information Reporting extra fields**

```tsx
function CertNoInfoReportingExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  const assuranceLabels: [string, string][] = [
    ['assurance_1', 'Owned/used as principal residence 2+ of last 5 years'],
    ['assurance_2', 'Have not sold/exchanged another principal residence in last 2 years'],
    ['assurance_3', 'No business/rental use after 5/6/1997 (if married)'],
    ['assurance_4', 'Sale price/gain falls under the applicable $250k/$500k threshold'],
    ['assurance_5', 'Did not acquire residence in a §1031 exchange within the 5-year period'],
  ]
  return (
    <>
      {assuranceLabels.map(([key, label]) => (
        <div key={key} className="col-span-4 flex items-center gap-2">
          <input id={id(key)} type="checkbox" name={key} defaultChecked={affidavit?.[key as keyof typeof affidavit] === true} />
          <Label htmlFor={id(key)}>{label}</Label>
        </div>
      ))}
      <div className="col-span-2">
        <Label htmlFor={id('assurance_6')}>§1031 basis carryover applies (assurance 6)</Label>
        <select id={id('assurance_6')} name="assurance_6" defaultValue={affidavit?.assurance_6 ?? ''} className="block w-full rounded border px-2 py-1 text-sm">
          <option value="">—</option>
          <option value="True">True</option>
          <option value="False">False</option>
          <option value="N/A">N/A</option>
        </select>
      </div>
      <div>
        <Label htmlFor={id('tin')}>TIN</Label>
        <Input id={id('tin')} name="tin" defaultValue={affidavit?.tin ?? ''} />
      </div>
      <div className="col-span-4">
        <Label htmlFor={id('forwarding_address')}>Forwarding Address</Label>
        <Input id={id('forwarding_address')} name="forwarding_address" defaultValue={affidavit?.forwarding_address ?? ''} />
      </div>
    </>
  )
}
```

- [ ] **Step 4: Add the W-9 extra fields**

```tsx
function W9ExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  const [classification, setClassification] = useState(affidavit?.w9_tax_classification ?? '')
  return (
    <>
      <div>
        <Label htmlFor={id('w9_business_name')}>Business / Disregarded Entity Name</Label>
        <Input id={id('w9_business_name')} name="w9_business_name" defaultValue={affidavit?.w9_business_name ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('w9_tax_classification')}>Federal Tax Classification</Label>
        <select
          id={id('w9_tax_classification')}
          name="w9_tax_classification"
          value={classification}
          onChange={(e) => setClassification(e.target.value)}
          className="block w-full rounded border px-2 py-1 text-sm"
        >
          <option value="">—</option>
          <option value="Individual/sole proprietor">Individual/sole proprietor</option>
          <option value="C corporation">C corporation</option>
          <option value="S corporation">S corporation</option>
          <option value="Partnership">Partnership</option>
          <option value="Trust/estate">Trust/estate</option>
          <option value="LLC">LLC</option>
          <option value="Other">Other</option>
        </select>
      </div>
      {classification === 'LLC' && (
        <div>
          <Label htmlFor={id('w9_llc_tax_classification')}>LLC Tax Classification</Label>
          <select
            id={id('w9_llc_tax_classification')}
            name="w9_llc_tax_classification"
            defaultValue={affidavit?.w9_llc_tax_classification ?? ''}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            <option value="C">C corporation</option>
            <option value="S">S corporation</option>
            <option value="P">Partnership</option>
          </select>
        </div>
      )}
      <div>
        <Label htmlFor={id('w9_exempt_payee_code')}>Exempt Payee Code</Label>
        <Input id={id('w9_exempt_payee_code')} name="w9_exempt_payee_code" defaultValue={affidavit?.w9_exempt_payee_code ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('w9_fatca_exemption_code')}>FATCA Exemption Code</Label>
        <Input id={id('w9_fatca_exemption_code')} name="w9_fatca_exemption_code" defaultValue={affidavit?.w9_fatca_exemption_code ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('tin')}>TIN (SSN or EIN)</Label>
        <Input id={id('tin')} name="tin" defaultValue={affidavit?.tin ?? ''} />
      </div>
    </>
  )
}
```

- [ ] **Step 5: Add the FIRPTA extra fields**

```tsx
function FirptaExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  const [transferorType, setTransferorType] = useState(affidavit?.firpta_transferor_type ?? 'Individual')
  return (
    <>
      <div>
        <Label htmlFor={id('firpta_transferor_type')}>Transferor Type</Label>
        <select
          id={id('firpta_transferor_type')}
          name="firpta_transferor_type"
          value={transferorType}
          onChange={(e) => setTransferorType(e.target.value)}
          className="block w-full rounded border px-2 py-1 text-sm"
        >
          <option value="Individual">Individual</option>
          <option value="Entity">Entity</option>
        </select>
      </div>
      <div>
        <Label htmlFor={id('tin')}>{transferorType === 'Entity' ? 'Employer Identification Number' : 'Social Security Number'}</Label>
        <Input id={id('tin')} name="tin" defaultValue={affidavit?.tin ?? ''} />
      </div>
      {transferorType === 'Entity' && (
        <>
          <div>
            <Label htmlFor={id('firpta_entity_signer_name')}>Signer Name</Label>
            <Input id={id('firpta_entity_signer_name')} name="firpta_entity_signer_name" defaultValue={affidavit?.firpta_entity_signer_name ?? ''} />
          </div>
          <div>
            <Label htmlFor={id('firpta_entity_signer_title')}>Signer Title</Label>
            <Input id={id('firpta_entity_signer_title')} name="firpta_entity_signer_title" defaultValue={affidavit?.firpta_entity_signer_title ?? ''} />
          </div>
        </>
      )}
    </>
  )
}
```

- [ ] **Step 6: Add the Survey Affidavit extra fields**

```tsx
function SurveyExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <>
      <div>
        <Label htmlFor={id('survey_date')}>Date of Attached Survey</Label>
        <Input id={id('survey_date')} name="survey_date" type="date" defaultValue={affidavit?.survey_date ?? ''} />
      </div>
      <div className="col-span-3 flex items-end gap-2">
        <input
          id={id('no_new_improvements_or_encroachments')}
          type="checkbox"
          name="no_new_improvements_or_encroachments"
          defaultChecked={affidavit?.no_new_improvements_or_encroachments ?? false}
        />
        <Label htmlFor={id('no_new_improvements_or_encroachments')}>No new improvements or encroachments since the attached survey</Label>
      </div>
    </>
  )
}
```

- [ ] **Step 7: Add the Affidavit of Heirship extra fields**

```tsx
function HeirshipExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <>
      <div>
        <Label htmlFor={id('deceased_name')}>Decedent Name</Label>
        <Input id={id('deceased_name')} name="deceased_name" defaultValue={affidavit?.deceased_name ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('date_of_death')}>Date of Death</Label>
        <Input id={id('date_of_death')} name="date_of_death" type="date" defaultValue={affidavit?.date_of_death ?? ''} />
      </div>
      <div className="col-span-2">
        <Label htmlFor={id('heirship_filer_role')}>Filer's Role</Label>
        <select id={id('heirship_filer_role')} name="heirship_filer_role" defaultValue={affidavit?.heirship_filer_role ?? ''} className="block w-full rounded border px-2 py-1 text-sm">
          <option value="">—</option>
          <option value="Proponent of will">Proponent of will</option>
          <option value="Personal representative">Personal representative</option>
          <option value="Heir-at-law">Heir-at-law</option>
        </select>
      </div>
      <RepeatableRows
        name="heirs"
        label="Heirs"
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'address', label: 'Address' },
          { key: 'relationship', label: 'Relationship' },
          { key: 'age', label: 'Age' },
        ]}
        initialRows={affidavit?.heirs ?? []}
      />
    </>
  )
}
```

- [ ] **Step 8: Add the Affidavit of Death - JTWROS and Affidavit of Death - Trustee extra fields**

```tsx
function DeathJtwrosExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <>
      <div>
        <Label htmlFor={id('deceased_name')}>Deceased Joint Tenant</Label>
        <Input id={id('deceased_name')} name="deceased_name" defaultValue={affidavit?.deceased_name ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('date_of_death')}>Date of Death</Label>
        <Input id={id('date_of_death')} name="date_of_death" type="date" defaultValue={affidavit?.date_of_death ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('reference_number')}>Property ID / Parcel No.</Label>
        <Input id={id('reference_number')} name="reference_number" defaultValue={affidavit?.reference_number ?? ''} />
      </div>
    </>
  )
}

function DeathTrusteeExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <>
      <div>
        <Label htmlFor={id('deceased_name')}>Deceased Trustee</Label>
        <Input id={id('deceased_name')} name="deceased_name" defaultValue={affidavit?.deceased_name ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('date_of_death')}>Date of Death</Label>
        <Input id={id('date_of_death')} name="date_of_death" type="date" defaultValue={affidavit?.date_of_death ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('trust_name')}>Trust Name</Label>
        <Input id={id('trust_name')} name="trust_name" defaultValue={affidavit?.trust_name ?? ''} />
      </div>
    </>
  )
}
```

- [ ] **Step 9: Add the Continuous Marriage Affidavit extra fields (both variants)**

```tsx
function ContinuousMarriageExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <div>
      <Label htmlFor={id('marriage_date')}>Marriage Date</Label>
      <Input id={id('marriage_date')} name="marriage_date" type="date" defaultValue={affidavit?.marriage_date ?? ''} />
    </div>
  )
}

function ContinuousMarriageSurvivingSpouseExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <>
      <ContinuousMarriageExtraFields affidavit={affidavit} idPrefix={idPrefix} contacts={[]} />
      <div>
        <Label htmlFor={id('deceased_name')}>Deceased Spouse</Label>
        <Input id={id('deceased_name')} name="deceased_name" defaultValue={affidavit?.deceased_name ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('date_of_death')}>Date of Death</Label>
        <Input id={id('date_of_death')} name="date_of_death" type="date" defaultValue={affidavit?.date_of_death ?? ''} />
      </div>
    </>
  )
}
```

- [ ] **Step 10: Add the Buyer/Seller Personal Information Affidavit extra fields**

```tsx
function PersonalInformationExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  const [neverDivorced, setNeverDivorced] = useState(affidavit?.has_never_divorced ?? true)
  const [neverChangedName, setNeverChangedName] = useState(affidavit?.has_never_changed_name ?? true)
  const [neverBankrupt, setNeverBankrupt] = useState(affidavit?.has_never_bankrupt ?? true)
  const [noJudgmentsLiens, setNoJudgmentsLiens] = useState(affidavit?.has_no_judgments_liens ?? true)
  const [maritalStatus, setMaritalStatus] = useState(affidavit?.personal_info_marital_status ?? 'Never married')

  return (
    <>
      <div className="col-span-2">
        <Label htmlFor={id('personal_info_marital_status')}>Marital Status</Label>
        <select
          id={id('personal_info_marital_status')}
          name="personal_info_marital_status"
          value={maritalStatus}
          onChange={(e) => setMaritalStatus(e.target.value)}
          className="block w-full rounded border px-2 py-1 text-sm"
        >
          <option value="Never married">Never married</option>
          <option value="Widowed">Widowed</option>
          <option value="Married">Married</option>
        </select>
      </div>
      {maritalStatus !== 'Never married' && (
        <>
          <div>
            <Label htmlFor={id('personal_info_spouse_name')}>{maritalStatus === 'Widowed' ? 'Widow(er) Of' : 'Married To'}</Label>
            <Input id={id('personal_info_spouse_name')} name="personal_info_spouse_name" defaultValue={affidavit?.personal_info_spouse_name ?? ''} />
          </div>
          <div>
            <Label htmlFor={id('personal_info_marriage_place')}>Marriage Place</Label>
            <Input id={id('personal_info_marriage_place')} name="personal_info_marriage_place" defaultValue={affidavit?.personal_info_marriage_place ?? ''} />
          </div>
          <div>
            <Label htmlFor={id('personal_info_marriage_year')}>Marriage Year</Label>
            <Input id={id('personal_info_marriage_year')} name="personal_info_marriage_year" defaultValue={affidavit?.personal_info_marriage_year ?? ''} />
          </div>
        </>
      )}

      <div className="col-span-4 flex items-center gap-2">
        <input id={id('has_never_divorced')} type="checkbox" name="has_never_divorced" checked={neverDivorced} onChange={(e) => setNeverDivorced(e.target.checked)} />
        <Label htmlFor={id('has_never_divorced')}>Has never been a party to a divorce proceeding</Label>
      </div>
      {!neverDivorced && (
        <RepeatableRows
          name="divorce_records"
          label="Divorce Records"
          columns={[
            { key: 'former_spouse_name', label: 'Former Spouse' },
            { key: 'year', label: 'Year' },
            { key: 'case_no', label: 'Case No.' },
            { key: 'county', label: 'County' },
            { key: 'state', label: 'State' },
          ]}
          initialRows={affidavit?.divorce_records ?? []}
        />
      )}

      <div className="col-span-4 flex items-center gap-2">
        <input
          id={id('has_never_changed_name')}
          type="checkbox"
          name="has_never_changed_name"
          checked={neverChangedName}
          onChange={(e) => setNeverChangedName(e.target.checked)}
        />
        <Label htmlFor={id('has_never_changed_name')}>Has never been known by any other name</Label>
      </div>
      {!neverChangedName && (
        <RepeatableRows
          name="name_change_records"
          label="Name Change Records"
          columns={[
            { key: 'from_name', label: 'Former Name' },
            { key: 'year', label: 'Year' },
            { key: 'case_no', label: 'Case No.' },
            { key: 'county', label: 'County' },
            { key: 'state', label: 'State' },
          ]}
          initialRows={affidavit?.name_change_records ?? []}
        />
      )}

      <div className="col-span-4 flex items-center gap-2">
        <input id={id('has_never_bankrupt')} type="checkbox" name="has_never_bankrupt" checked={neverBankrupt} onChange={(e) => setNeverBankrupt(e.target.checked)} />
        <Label htmlFor={id('has_never_bankrupt')}>Has never been adjudged bankrupt</Label>
      </div>
      {!neverBankrupt && (
        <RepeatableRows
          name="bankruptcy_records"
          label="Bankruptcy Records"
          columns={[
            { key: 'case_no', label: 'Case No.' },
            { key: 'year', label: 'Year' },
            { key: 'county', label: 'County' },
            { key: 'state', label: 'State' },
          ]}
          initialRows={affidavit?.bankruptcy_records ?? []}
        />
      )}

      <div className="col-span-4 flex items-center gap-2">
        <input
          id={id('has_no_judgments_liens')}
          type="checkbox"
          name="has_no_judgments_liens"
          checked={noJudgmentsLiens}
          onChange={(e) => setNoJudgmentsLiens(e.target.checked)}
        />
        <Label htmlFor={id('has_no_judgments_liens')}>No unsatisfied/unreleased judgments, decrees, or liens against affiant</Label>
      </div>
      {!noJudgmentsLiens && (
        <RepeatableRows
          name="judgment_lien_records"
          label="Judgments / Liens"
          columns={[
            { key: 'case_no_and_court', label: 'Case No. & Court' },
            { key: 'plaintiff', label: 'Plaintiff' },
            { key: 'defendant', label: 'Defendant' },
            { key: 'judgment_date', label: 'Date', type: 'date' },
            { key: 'amount', label: 'Amount', type: 'number' },
          ]}
          initialRows={affidavit?.judgment_lien_records ?? []}
        />
      )}

      <RepeatableRows
        name="residence_history"
        label="Residence History (Last 10 Years)"
        columns={[
          { key: 'from_date', label: 'From', type: 'date' },
          { key: 'to_date', label: 'To', type: 'date' },
          { key: 'street', label: 'Street' },
          { key: 'city', label: 'City' },
          { key: 'state', label: 'State' },
        ]}
        initialRows={affidavit?.residence_history ?? []}
      />

      <RepeatableRows
        name="occupation_history"
        label="Occupation History (Last 10 Years)"
        columns={[
          { key: 'from_date', label: 'From', type: 'date' },
          { key: 'to_date', label: 'To', type: 'date' },
          { key: 'occupation', label: 'Occupation' },
          { key: 'employer', label: 'Employer' },
          { key: 'place_of_business', label: 'Place of Business' },
        ]}
        initialRows={affidavit?.occupation_history ?? []}
      />
    </>
  )
}
```

- [ ] **Step 11: Register all new types in `TYPE_EXTRA_FIELDS`**

Add to the existing map (from the simple-types plan):

```tsx
'Affidavit of Affixation': AffixationExtraFields,
'Certification of No Information Reporting Sale or Exchange Principal Residence': CertNoInfoReportingExtraFields,
'W-9 Request for Taxpayer ID and Certification (seller)': W9ExtraFields,
'FIRPTA': FirptaExtraFields,
'Survey Affidavit': SurveyExtraFields,
'Buyer Personal Information Affidavit': PersonalInformationExtraFields,
'Seller Personal Information Affidavit': PersonalInformationExtraFields,
'Affidavit of Heirship': HeirshipExtraFields,
'Affidavit of Death - JTWROS': DeathJtwrosExtraFields,
'Affidavit of Death - Trustee': DeathTrusteeExtraFields,
'Continuous Marriage Affidavit': ContinuousMarriageExtraFields,
'Continuous Marriage Affidavit (Surviving Spouse)': ContinuousMarriageSurvivingSpouseExtraFields,
```

- [ ] **Step 12: Run the app locally and sanity-check by eye**

Run: `npm run dev` from `genesis-app/`. On an order's Affidavits screen, click "+ Add Affidavit".
Expected: "Affidavit of Affixation" appears in the (alphabetized) Type dropdown with its own fields. Selecting "Buyer Personal Information Affidavit" shows the marital-status conditional fields and all six repeatable-rows lists starting empty ("None") with working +Add/Remove. Selecting any of the 4 still-generic types (Owner's Affidavit, Notice of Availability, Commitment Acknowledgement, Joint Tenancy Affidavit) shows only the original generic fields, unchanged.

- [ ] **Step 13: Commit**

```bash
git add src/components/doc-prep/AffidavitsPanel.tsx
git commit -m "feat: per-type extra fields for 10 complex Affidavit Types, add Affidavit of Affixation"
```

---

### Task 4: e2e test — repeatable rows persist, new type renders

**Files:**
- Modify: `tests/e2e/document-preparation.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-3.

- [ ] **Step 1: Write the test**

```typescript
  test('affidavits: Personal Information repeatable rows persist, Affidavit of Affixation renders', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/affidavits`)
    await page.getByRole('button', { name: '+ Add Affidavit' }).click()

    await page.locator('select[name="type"]').selectOption('Buyer Personal Information Affidavit')
    await page.locator('select[name="personal_info_marital_status"]').selectOption('Married')
    await page.locator('input[name="personal_info_spouse_name"]').fill('Jordan Smith')

    // uncheck "never divorced" to reveal the repeatable-rows editor, add one row
    await page.locator('input[name="has_never_divorced"]').uncheck()
    await page.getByRole('button', { name: '+ Add' }).first().click()
    await page.locator('input[placeholder="Former Spouse"]').fill('Pat Smith')
    await page.locator('input[placeholder="Year"]').first().fill('2015')

    await page.getByRole('button', { name: 'Add Affidavit' }).click()
    await expect(page.getByTestId('affidavit-list')).toContainText('Buyer Personal Information Affidavit')

    await page.getByText('Edit').click()
    await expect(page.locator('input[name="personal_info_spouse_name"]')).toHaveValue('Jordan Smith')
    await expect(page.locator('input[placeholder="Former Spouse"]')).toHaveValue('Pat Smith')

    // Affidavit of Affixation renders as a new dropdown option with its own fields
    await page.locator('select[name="type"]').selectOption('Affidavit of Affixation')
    await expect(page.locator('select[name="certificate_of_title_status"]')).toBeVisible()
  })
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/document-preparation.spec.ts -g "affidavits: Personal Information"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/document-preparation.spec.ts
git commit -m "test: complex Affidavit Types repeatable rows and Affidavit of Affixation"
```
