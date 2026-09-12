# Affidavits — Simple Per-Type Field Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give 7 of the 22 Affidavit Types their own real field sets (based on actual reference templates in the vault), instead of the current one-size-fits-all Type/Affiant/optional-recorded-fields form. Also alphabetize the Affidavit Type dropdown. The other 15 types are untouched — they keep today's generic form until Cam supplies reference material for them.

**Architecture:** `doc_prep_affidavits` gains a modest set of new nullable columns, reusing the existing `affiant`/`affiant_contact_id`/`dated_date`/`recorded`/`recorded_date`/`book`/`page`/`instrument_number`/`notes` fields wherever a type's reference form asks for the same concept (signer name, execution date, a prior recording reference, free-text exceptions) rather than duplicating them. `AffidavitsPanel.tsx`'s `AffidavitFields` becomes type-aware: the existing generic fields still always render, and a small per-type "extra fields" component renders underneath for these 7 types only.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres), React (client component), Playwright e2e.

**Spec:** No separate spec file — bounded change approved in chat 2026-09-11. Source references (all under `M&L Title - Obsidian Vault/Source Material/Deed:Doc Templates/`): `WaiverofSettlementAgentResponsibility.pdf`, `IL DS1 Form.pdf`, `Commercial ALTA Statement.doc` / `Residential ALTA Statement.doc`, `GAP Affidavit.pdf`, `Marital Status Affidavit.doc`, `Not Me Judgement Affidavit.doc`, `1099-S.pdf`.

## Global Constraints

- **Do not remove or restructure the other 15 Affidavit Types' handling** — `AFFIDAVIT_TYPES` in `src/lib/constants.ts` stays exactly as-is (same 22 entries, same order in the source array); only the dropdown's *rendered* order changes (alphabetized at display time), and only these 7 types get an extra-fields block. Every other type keeps rendering the plain generic form exactly as it does today.
- Migration filename number is **not** `0054`/`0055` (reserved) — run `ls supabase/migrations | sort -V | tail -3` before writing the migration and account for any of this session's other plans that may have already run.
- Fields already covered by the existing generic columns are reused, not duplicated: signer/affiant name → `affiant`/`affiant_contact_id`; execution date → `dated_date`; a prior recorded instrument being referenced (e.g. Marital Status Affidavit's deed reference) → the existing `recorded`/`recorded_date`/`book`/`page`/`instrument_number` fields; free-text exception lists (ALTA Statement's 6 numbered items, Not Me Judgement's specific judgment/lien callouts) → the existing `notes` field. Only genuinely new concepts get new columns.
- The title company's own filer information on Substitute 1099-S (name/address/TIN) is M&L's own fixed identity, not per-order data — out of scope for this pass, not modeled as a field. Digital-asset consideration (1099-S boxes 8a-8d) is left to `notes` if it ever comes up — real estate sales paid in digital assets are rare enough that 4 more columns for it isn't justified yet.
- Property address and File Number are not captured per-affidavit — they're already available from `Order.property_address`/`Order.file_number` at whatever point these fields feed into actual document generation (which doesn't exist yet for Affidavits, matching every other Doc Prep screen's current scope).

---

### Task 1: Migration — new `doc_prep_affidavits` columns, `DocPrepAffidavit` type

**Files:**
- Create: `supabase/migrations/00XX_affidavit_type_fields.sql` (replace `00XX` with the real next number per Global Constraints)
- Modify: `src/lib/types.ts` (the `DocPrepAffidavit` type)

**Interfaces:**
- Produces: the new `DocPrepAffidavit` fields listed below — consumed by Task 2 (`doc-prep-affidavits.ts`) and Task 3 (`AffidavitsPanel.tsx`).

- [ ] **Step 1: Find the real next migration number**

Run: `ls supabase/migrations | sort -V | tail -3`

Use whatever number comes after the highest one listed in place of `00XX` below.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/00XX_affidavit_type_fields.sql
-- Tier 5 item 15 (real per-type Affidavit field sets), first pass: the 7 types with a
-- real reference template on file whose forms need something beyond the existing
-- generic affiant/dated_date/recorded/notes fields. See the implementation plan's
-- Global Constraints for which existing columns are reused for which concept, and
-- why the title company's own filer info + digital-asset consideration are excluded.
alter table public.doc_prep_affidavits
  -- Waiver of Settlement Agent Responsibility, DS-1, ALTA Statement: the document's
  -- "other named party" alongside affiant (e.g. affiant = Purchaser, second party =
  -- Seller, or vice versa) -- generic and reusable across all three.
  add column second_party_contact_id uuid references contacts(id),
  add column second_party_name text,
  -- GAP Affidavit's Policy No., ALTA Statement's Commitment/Loan No., generic enough
  -- to reuse for any future type with a single file-reference blank.
  add column reference_number text,
  -- Marital Status Affidavit: status AT THE TIME OF THE REFERENCED DEED's execution,
  -- distinct from Contacts.marital_status (today's status) -- this is a point-in-time
  -- historical assertion, not the same fact.
  add column marital_status_at_execution text
    check (marital_status_at_execution in ('Unmarried at execution', 'Not homestead of affiant or spouse', 'Married to co-grantor at execution')),
  -- Not Me Judgement Affidavit: "have always been known as ___" / prior name.
  add column also_known_as text,
  -- DS-1 Form (IL Only) -- IL Controlled Business Arrangement disclosure, all new.
  add column ds1_disclosure_directed_to text check (ds1_disclosure_directed_to in ('Seller', 'Buyer', 'Both')),
  add column ds1_referred_provider_name text,
  add column ds1_owner_policy_fee numeric,
  add column ds1_mortgage_policy_fee numeric,
  add column ds1_escrow_fee numeric,
  add column ds1_other_fee_label text,
  add column ds1_other_fee_amount numeric,
  -- ALTA Statement: which boilerplate variant applies (Commercial forms have no
  -- separate Print Name fields; otherwise the two are functionally identical).
  add column alta_statement_variant text check (alta_statement_variant in ('Commercial', 'Residential')),
  -- Substitute 1099-S (IRS Form 1099-S) fields not already covered generically.
  add column form1099s_account_number text,
  add column form1099s_total_gross_proceeds numeric,
  add column form1099s_cash_gross_proceeds numeric,
  add column form1099s_digital_asset_gross_proceeds numeric,
  add column form1099s_buyers_real_estate_tax_portion numeric,
  add column form1099s_received_other_consideration boolean not null default false,
  add column form1099s_transferor_is_foreign_person boolean not null default false;
```

- [ ] **Step 3: Apply the migration**

Use whichever Supabase migration-apply workflow this project already uses for prior migrations (check `docs/superpowers/plans/2026-09-10-staff-directory-permissions.md` Task 1 Step 5 for the exact command).

- [ ] **Step 4: Update the `DocPrepAffidavit` type**

In `src/lib/types.ts`, add the new fields to the existing `DocPrepAffidavit` type (after `sort_order`):

```typescript
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
  second_party_contact_id: string | null
  second_party_name: string | null
  reference_number: string | null
  marital_status_at_execution: string | null
  also_known_as: string | null
  ds1_disclosure_directed_to: string | null
  ds1_referred_provider_name: string | null
  ds1_owner_policy_fee: number | null
  ds1_mortgage_policy_fee: number | null
  ds1_escrow_fee: number | null
  ds1_other_fee_label: string | null
  ds1_other_fee_amount: number | null
  alta_statement_variant: string | null
  form1099s_account_number: string | null
  form1099s_total_gross_proceeds: number | null
  form1099s_cash_gross_proceeds: number | null
  form1099s_digital_asset_gross_proceeds: number | null
  form1099s_buyers_real_estate_tax_portion: number | null
  form1099s_received_other_consideration: boolean
  form1099s_transferor_is_foreign_person: boolean
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00XX_affidavit_type_fields.sql src/lib/types.ts
git commit -m "feat: add per-type fields for 7 Affidavit Types (Waiver, DS-1, ALTA Statement, GAP, Marital Status, Not Me Judgement, Substitute 1099-S)"
```

---

### Task 2: `doc-prep-affidavits.ts` — persist the new fields

**Files:**
- Modify: `src/app/actions/doc-prep-affidavits.ts`

**Interfaces:**
- Consumes: the new `DocPrepAffidavit` columns (Task 1).
- Produces: `addAffidavit`/`updateAffidavit` now persist the new fields, whichever are present in the submitted form.

- [ ] **Step 1: Read the current file to find the exact update/insert payload shape**

Run: `cat src/app/actions/doc-prep-affidavits.ts` and locate the `addAffidavit`/`updateAffidavit` functions' Supabase `.insert(...)`/`.update(...)` payload objects (same `strOrNull`/`numOrNull`-style helper pattern used throughout this codebase's other actions, e.g. `src/app/actions/recording.ts`).

- [ ] **Step 2: Add the new fields to both functions' payloads**

In both `addAffidavit` and `updateAffidavit`, add these fields to the insert/update payload, following whatever `strOrNull`/`numOrNull`/boolean-checkbox helper pattern the file already uses for its existing fields:

```typescript
second_party_contact_id: strOrNull('second_party_contact_id'),
second_party_name: strOrNull('second_party_name'),
reference_number: strOrNull('reference_number'),
marital_status_at_execution: strOrNull('marital_status_at_execution'),
also_known_as: strOrNull('also_known_as'),
ds1_disclosure_directed_to: strOrNull('ds1_disclosure_directed_to'),
ds1_referred_provider_name: strOrNull('ds1_referred_provider_name'),
ds1_owner_policy_fee: numOrNull('ds1_owner_policy_fee'),
ds1_mortgage_policy_fee: numOrNull('ds1_mortgage_policy_fee'),
ds1_escrow_fee: numOrNull('ds1_escrow_fee'),
ds1_other_fee_label: strOrNull('ds1_other_fee_label'),
ds1_other_fee_amount: numOrNull('ds1_other_fee_amount'),
alta_statement_variant: strOrNull('alta_statement_variant'),
form1099s_account_number: strOrNull('form1099s_account_number'),
form1099s_total_gross_proceeds: numOrNull('form1099s_total_gross_proceeds'),
form1099s_cash_gross_proceeds: numOrNull('form1099s_cash_gross_proceeds'),
form1099s_digital_asset_gross_proceeds: numOrNull('form1099s_digital_asset_gross_proceeds'),
form1099s_buyers_real_estate_tax_portion: numOrNull('form1099s_buyers_real_estate_tax_portion'),
form1099s_received_other_consideration: formData.get('form1099s_received_other_consideration') === 'on',
form1099s_transferor_is_foreign_person: formData.get('form1099s_transferor_is_foreign_person') === 'on',
```

(If the file doesn't already define `strOrNull`/`numOrNull` helpers matching `(formData.get(key) as string) || null` / `formData.get(key) ? Number(formData.get(key)) : null`, add them at the top of the file the same way `src/app/actions/recording.ts` does, rather than inlining the ternaries 19 times.)

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/doc-prep-affidavits.ts
git commit -m "feat: persist per-type Affidavit fields"
```

---

### Task 3: `AffidavitsPanel.tsx` — type-specific extra fields, alphabetized dropdown

**Files:**
- Modify: `src/components/doc-prep/AffidavitsPanel.tsx`

**Interfaces:**
- Consumes: the new `DocPrepAffidavit` fields (Task 1).

- [ ] **Step 1: Alphabetize the Type dropdown**

In `AffidavitFields` (currently lines 11-99), replace the Type `<select>`'s options (currently lines 32-36):

```tsx
          {[...AFFIDAVIT_TYPES].sort((a, b) => a.localeCompare(b)).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
```

- [ ] **Step 2: Make the Type field controlled so extra fields can react to it**

Replace the Type `<select>` block in full (currently lines 24-38):

```tsx
      <div>
        <Label htmlFor={id('type')}>Type</Label>
        <select
          id={id('type')}
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="block w-full rounded border px-2 py-1 text-sm"
        >
          {[...AFFIDAVIT_TYPES].sort((a, b) => a.localeCompare(b)).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
```

Add the `type` state right after the existing `recorded`/`setRecorded` line (currently line 20):

```typescript
  const [type, setType] = useState(affidavit?.type ?? AFFIDAVIT_TYPES[0])
```

- [ ] **Step 3: Add the 7 per-type extra-fields components**

Add these above `AffidavitFields` in the same file:

```tsx
type ExtraFieldsProps = {
  affidavit?: DocPrepAffidavit
  idPrefix: string
  contacts: { id: string; name: string }[]
}

function SecondPartyField({ affidavit, idPrefix, contacts, label }: ExtraFieldsProps & { label: string }) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <>
      <div>
        <Label htmlFor={id('second_party_contact_id')}>{label} (Linked Contact)</Label>
        <select
          id={id('second_party_contact_id')}
          name="second_party_contact_id"
          defaultValue={affidavit?.second_party_contact_id ?? ''}
          className="block w-full rounded border px-2 py-1 text-sm"
        >
          <option value="">—</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={id('second_party_name')}>{label} (Free Type)</Label>
        <Input id={id('second_party_name')} name="second_party_name" defaultValue={affidavit?.second_party_name ?? ''} />
      </div>
    </>
  )
}

function WaiverExtraFields({ affidavit, idPrefix, contacts }: ExtraFieldsProps) {
  return <SecondPartyField affidavit={affidavit} idPrefix={idPrefix} contacts={contacts} label="Seller" />
}

function GapAffidavitExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <div>
      <Label htmlFor={id('reference_number')}>Policy No.</Label>
      <Input id={id('reference_number')} name="reference_number" defaultValue={affidavit?.reference_number ?? ''} />
    </div>
  )
}

function AltaStatementExtraFields({ affidavit, idPrefix, contacts }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <>
      <div>
        <Label htmlFor={id('alta_statement_variant')}>Variant</Label>
        <select
          id={id('alta_statement_variant')}
          name="alta_statement_variant"
          defaultValue={affidavit?.alta_statement_variant ?? 'Residential'}
          className="block w-full rounded border px-2 py-1 text-sm"
        >
          <option value="Residential">Residential</option>
          <option value="Commercial">Commercial</option>
        </select>
      </div>
      <div>
        <Label htmlFor={id('reference_number')}>Commitment / Loan No.</Label>
        <Input id={id('reference_number')} name="reference_number" defaultValue={affidavit?.reference_number ?? ''} />
      </div>
      <SecondPartyField affidavit={affidavit} idPrefix={idPrefix} contacts={contacts} label="Purchaser" />
    </>
  )
}

function MaritalStatusExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <div className="col-span-2">
      <Label htmlFor={id('marital_status_at_execution')}>Marital Status at Execution</Label>
      <select
        id={id('marital_status_at_execution')}
        name="marital_status_at_execution"
        defaultValue={affidavit?.marital_status_at_execution ?? ''}
        className="block w-full rounded border px-2 py-1 text-sm"
      >
        <option value="">—</option>
        <option value="Unmarried at execution">Unmarried at execution</option>
        <option value="Not homestead of affiant or spouse">Not homestead of affiant or spouse</option>
        <option value="Married to co-grantor at execution">Married to co-grantor at execution</option>
      </select>
    </div>
  )
}

function NotMeJudgementExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <div>
      <Label htmlFor={id('also_known_as')}>Also Known As</Label>
      <Input id={id('also_known_as')} name="also_known_as" defaultValue={affidavit?.also_known_as ?? ''} />
    </div>
  )
}

function Ds1ExtraFields({ affidavit, idPrefix, contacts }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <>
      <div>
        <Label htmlFor={id('ds1_disclosure_directed_to')}>Directed To</Label>
        <select
          id={id('ds1_disclosure_directed_to')}
          name="ds1_disclosure_directed_to"
          defaultValue={affidavit?.ds1_disclosure_directed_to ?? ''}
          className="block w-full rounded border px-2 py-1 text-sm"
        >
          <option value="">—</option>
          <option value="Seller">Seller</option>
          <option value="Buyer">Buyer</option>
          <option value="Both">Both</option>
        </select>
      </div>
      <SecondPartyField affidavit={affidavit} idPrefix={idPrefix} contacts={contacts} label="Buyer" />
      <div>
        <Label htmlFor={id('ds1_referred_provider_name')}>Referred Provider</Label>
        <Input id={id('ds1_referred_provider_name')} name="ds1_referred_provider_name" defaultValue={affidavit?.ds1_referred_provider_name ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('ds1_owner_policy_fee')}>Owner&apos;s Title Policy Fee</Label>
        <Input id={id('ds1_owner_policy_fee')} name="ds1_owner_policy_fee" type="number" step="0.01" defaultValue={affidavit?.ds1_owner_policy_fee ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('ds1_mortgage_policy_fee')}>Mortgage Title Policy Fee</Label>
        <Input id={id('ds1_mortgage_policy_fee')} name="ds1_mortgage_policy_fee" type="number" step="0.01" defaultValue={affidavit?.ds1_mortgage_policy_fee ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('ds1_escrow_fee')}>Escrow/Closing Fee</Label>
        <Input id={id('ds1_escrow_fee')} name="ds1_escrow_fee" type="number" step="0.01" defaultValue={affidavit?.ds1_escrow_fee ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('ds1_other_fee_label')}>Other Fee Label</Label>
        <Input id={id('ds1_other_fee_label')} name="ds1_other_fee_label" defaultValue={affidavit?.ds1_other_fee_label ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('ds1_other_fee_amount')}>Other Fee Amount</Label>
        <Input id={id('ds1_other_fee_amount')} name="ds1_other_fee_amount" type="number" step="0.01" defaultValue={affidavit?.ds1_other_fee_amount ?? ''} />
      </div>
    </>
  )
}

function Form1099SExtraFields({ affidavit, idPrefix }: ExtraFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`
  const [receivedOther, setReceivedOther] = useState(affidavit?.form1099s_received_other_consideration ?? false)
  const [isForeign, setIsForeign] = useState(affidavit?.form1099s_transferor_is_foreign_person ?? false)
  return (
    <>
      <div>
        <Label htmlFor={id('form1099s_account_number')}>Account Number</Label>
        <Input id={id('form1099s_account_number')} name="form1099s_account_number" defaultValue={affidavit?.form1099s_account_number ?? ''} />
      </div>
      <div>
        <Label htmlFor={id('form1099s_total_gross_proceeds')}>Total Gross Proceeds</Label>
        <Input
          id={id('form1099s_total_gross_proceeds')}
          name="form1099s_total_gross_proceeds"
          type="number"
          step="0.01"
          defaultValue={affidavit?.form1099s_total_gross_proceeds ?? ''}
        />
      </div>
      <div>
        <Label htmlFor={id('form1099s_cash_gross_proceeds')}>Cash Gross Proceeds</Label>
        <Input
          id={id('form1099s_cash_gross_proceeds')}
          name="form1099s_cash_gross_proceeds"
          type="number"
          step="0.01"
          defaultValue={affidavit?.form1099s_cash_gross_proceeds ?? ''}
        />
      </div>
      <div>
        <Label htmlFor={id('form1099s_digital_asset_gross_proceeds')}>Digital Asset Gross Proceeds</Label>
        <Input
          id={id('form1099s_digital_asset_gross_proceeds')}
          name="form1099s_digital_asset_gross_proceeds"
          type="number"
          step="0.01"
          defaultValue={affidavit?.form1099s_digital_asset_gross_proceeds ?? ''}
        />
      </div>
      <div>
        <Label htmlFor={id('form1099s_buyers_real_estate_tax_portion')}>Buyer&apos;s Part of Real Estate Tax</Label>
        <Input
          id={id('form1099s_buyers_real_estate_tax_portion')}
          name="form1099s_buyers_real_estate_tax_portion"
          type="number"
          step="0.01"
          defaultValue={affidavit?.form1099s_buyers_real_estate_tax_portion ?? ''}
        />
      </div>
      <div className="flex items-end gap-2">
        <input
          id={id('form1099s_received_other_consideration')}
          type="checkbox"
          name="form1099s_received_other_consideration"
          checked={receivedOther}
          onChange={(e) => setReceivedOther(e.target.checked)}
        />
        <Label htmlFor={id('form1099s_received_other_consideration')}>Received services/property as consideration</Label>
      </div>
      <div className="flex items-end gap-2">
        <input
          id={id('form1099s_transferor_is_foreign_person')}
          type="checkbox"
          name="form1099s_transferor_is_foreign_person"
          checked={isForeign}
          onChange={(e) => setIsForeign(e.target.checked)}
        />
        <Label htmlFor={id('form1099s_transferor_is_foreign_person')}>Transferor is a foreign person</Label>
      </div>
    </>
  )
}

const TYPE_EXTRA_FIELDS: Record<string, (props: ExtraFieldsProps) => React.JSX.Element> = {
  'Waiver of Settlement Agent Responsibility': WaiverExtraFields,
  'GAP Affidavit': GapAffidavitExtraFields,
  'ALTA Statement': AltaStatementExtraFields,
  'Marital Status Affidavit': MaritalStatusExtraFields,
  'Not Me Judgement Affidavit': NotMeJudgementExtraFields,
  'DS-1 Form (IL Only)': Ds1ExtraFields,
  'Substitute 1099-S': Form1099SExtraFields,
}
```

- [ ] **Step 4: Render the matching extra-fields component**

In `AffidavitFields`'s return block, add the extra-fields render right before the closing `Notes` field (currently lines 93-96):

```tsx
      {(() => {
        const ExtraFields = TYPE_EXTRA_FIELDS[type]
        return ExtraFields ? <ExtraFields affidavit={affidavit} idPrefix={idPrefix} contacts={contacts} /> : null
      })()}
      <div className="col-span-4">
        <Label htmlFor={id('notes')}>Notes</Label>
        <Input id={id('notes')} name="notes" defaultValue={affidavit?.notes ?? ''} />
      </div>
```

- [ ] **Step 5: Run the app locally and sanity-check by eye**

Run: `npm run dev` from `genesis-app/`. On an order's Affidavits screen, click "+ Add Affidavit".
Expected: the Type dropdown is alphabetized (ALTA Statement near the top, not first per the old array order). Selecting "DS-1 Form (IL Only)" shows the IL-specific fee/disclosure fields; selecting any of the other 15 untouched types shows only the original generic fields, unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/doc-prep/AffidavitsPanel.tsx
git commit -m "feat: per-type extra fields for 7 Affidavit Types, alphabetized Type dropdown"
```

---

### Task 4: e2e test — DS-1 extra fields render and persist, dropdown is alphabetized

**Files:**
- Modify: `tests/e2e/document-preparation.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-3.

- [ ] **Step 1: Write the test**

Add near this file's existing Affidavits coverage:

```typescript
  test('affidavits: Type dropdown is alphabetized and DS-1 extra fields persist', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/affidavits`)
    await page.getByRole('button', { name: '+ Add Affidavit' }).click()

    const options = await page.locator('select[name="type"] option').allTextContents()
    const sorted = [...options].sort((a, b) => a.localeCompare(b))
    expect(options).toEqual(sorted)

    await page.locator('select[name="type"]').selectOption('DS-1 Form (IL Only)')
    await expect(page.locator('select[name="ds1_disclosure_directed_to"]')).toBeVisible()
    await page.locator('select[name="ds1_disclosure_directed_to"]').selectOption('Both')
    await page.locator('input[name="ds1_owner_policy_fee"]').fill('450')
    await page.getByRole('button', { name: 'Add Affidavit' }).click()

    await expect(page.getByTestId('affidavit-list')).toContainText('DS-1 Form (IL Only)')

    await page.getByText('Edit').click()
    await expect(page.locator('select[name="ds1_disclosure_directed_to"]')).toHaveValue('Both')
    await expect(page.locator('input[name="ds1_owner_policy_fee"]')).toHaveValue('450')
  })
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/document-preparation.spec.ts -g "affidavits: Type dropdown"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/document-preparation.spec.ts
git commit -m "test: Affidavit Type dropdown alphabetization and DS-1 extra fields"
```
