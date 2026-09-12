# Settlement Format Field & Transaction-Type-Driven Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Settlement Format" field to Order Entry (Closing Disclosure / Commercial / HUD-1) and make both it and the existing Policy Type field auto-suggest a starting value from Transaction Type — never locked, always editable — the same pattern Product Type already uses to auto-suggest Transaction Type.

**Architecture:** One new `orders.settlement_format` column plus two new lookup tables in `src/lib/constants.ts` (`TRANSACTION_TYPE_TO_POLICY_TYPE`, `TRANSACTION_TYPE_TO_SETTLEMENT_FORMAT`). `OrderForm.tsx`'s Transaction Type radio group gains two more auto-suggest side effects (mirroring its existing Product Type → Transaction Type one), and Policy Type / Settlement Format become controlled `<Select>`s so their displayed value can be driven programmatically. `orders.ts`'s `createOrder`/`saveOrderEntry` persist and validate the new field.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres), React (client component, controlled `<Select>`/`<RadioGroup>`), Playwright e2e.

**Spec:** No separate spec file — this is a bounded change approved in chat 2026-09-11 (Cam: "Build #2+#3 now, plan #4 separately"). Background and the decision trail live in [[Genesis Screen Notes - Fix Plan]] (Tier 5, item 13) and this plan's own file structure below.

## Global Constraints

- Migration filename number is **not** `0054`/`0055` — those are already reserved by `docs/superpowers/plans/2026-09-10-staff-directory-permissions.md`. Before writing the migration file, run `ls supabase/migrations | sort -V | tail -3` to find the real next number and use that.
- Settlement Format values: exactly `'Closing Disclosure'`, `'Commercial'`, `'HUD-1'` (Cam's wording from the SoftPro "New Order" dialog screenshot).
- Transaction Type → Settlement Format default: Purchase → Closing Disclosure, Refinance → Closing Disclosure, Equity → HUD-1, Other → HUD-1 (Cam's answer, 2026-09-11).
- Transaction Type → Policy Type default: Purchase → Simultaneous, Refinance → Loan, Equity → Loan, Other → **no default**, stays whatever it already was / manual selection (Cam's answer, 2026-09-11).
- Every auto-suggested default is a starting point only, never locked — same rule Product Type → Transaction Type already follows in this file.
- This field is deliberately named "Settlement Format," not "Settlement Type" — that name is already taken in this codebase (`SettlementOptions.settlement_type`: Combined/Borrower-Buyer/Seller/Cash, a different concept about statement disbursement structure, unrelated to this field).

---

### Task 1: Migration — `orders.settlement_format` column, and the `Order` type

**Files:**
- Create: `supabase/migrations/00XX_order_settlement_format.sql` (replace `00XX` with the real next number per Global Constraints)
- Modify: `src/lib/types.ts:1-31` (the `Order` type)

**Interfaces:**
- Produces: `Order.settlement_format: string` — consumed by Task 3 (`OrderForm.tsx`) and Task 4 (`orders.ts`).

- [ ] **Step 1: Find the real next migration number**

Run: `ls supabase/migrations | sort -V | tail -3`

Use whatever number comes after the highest one listed in place of `00XX` below.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/00XX_order_settlement_format.sql
-- Tier 5 item 13 (Order Entry's Transaction-Type-conditional matrix): SoftPro's "New
-- Order" dialog has its own "Settlement type" selector (Closing Disclosure / Commercial
-- / HUD-1), separate from the Transaction Type radio (Purchase/Refinance/Equity/Other).
-- Named "Settlement Format" here, not "Settlement Type," because that name is already
-- taken by settlement_options.settlement_type (Combined/Borrower-Buyer/Seller/Cash --
-- a different concept, statement disbursement structure). Auto-suggested from
-- Transaction Type on the client (OrderForm.tsx), editable, same pattern as
-- product_type -> transaction_type.
alter table public.orders
  add column settlement_format text not null default 'Closing Disclosure'
  check (settlement_format in ('Closing Disclosure', 'Commercial', 'HUD-1'));

-- Backfill existing orders using the same Transaction Type mapping the UI applies to
-- new ones (Purchase/Refinance -> Closing Disclosure, Equity/Other -> HUD-1), so no
-- existing order is left on the bare column default regardless of its actual type.
update public.orders
  set settlement_format = 'HUD-1'
  where transaction_type in ('Equity', 'Other');
```

- [ ] **Step 3: Apply the migration**

Use whichever Supabase migration-apply workflow this project already uses for prior migrations (check `docs/superpowers/plans/2026-09-10-staff-directory-permissions.md` Task 1 Step 5 for the exact command this project runs, since it applied a migration the same way).

- [ ] **Step 4: Update the `Order` type**

In `src/lib/types.ts`, add the new field to the `Order` type (after `policy_type`):

```typescript
export type Order = {
  id: string
  file_number: string
  product_type: string
  transaction_type: string
  policy_type: string
  settlement_format: string
  purchase_price: number | null
  // ...rest unchanged
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00XX_order_settlement_format.sql src/lib/types.ts
git commit -m "feat: add orders.settlement_format column"
```

---

### Task 2: Constants — `SETTLEMENT_FORMATS` and the two Transaction-Type default maps

**Files:**
- Modify: `src/lib/constants.ts:1-27`

**Interfaces:**
- Produces: `SETTLEMENT_FORMATS` (readonly tuple), `TRANSACTION_TYPE_TO_POLICY_TYPE: Partial<Record<(typeof TRANSACTION_TYPES)[number], (typeof POLICY_TYPES)[number]>>`, `TRANSACTION_TYPE_TO_SETTLEMENT_FORMAT: Record<(typeof TRANSACTION_TYPES)[number], (typeof SETTLEMENT_FORMATS)[number]>` — consumed by Task 3 (`OrderForm.tsx`) and Task 4 (`orders.ts`).

- [ ] **Step 1: Add the constants**

In `src/lib/constants.ts`, immediately after the existing `PRODUCT_TYPE_TO_TRANSACTION_TYPE` block (after line 27):

```typescript
export const SETTLEMENT_FORMATS = ['Closing Disclosure', 'Commercial', 'HUD-1'] as const

// Auto-suggested Policy Type when Transaction Type changes — a starting point only,
// never locked. Other has no entry on purpose (Cam's call, 2026-09-11): it stays
// whatever it already was / manual selection, unlike the other three. Keyed as
// Record<string, ...> (not a literal-keyed Record/Partial<Record<...>>) to match
// PRODUCT_TYPE_TO_TRANSACTION_TYPE's existing convention just above — this codebase
// indexes these maps with plain `string`-typed values (e.g. `v as string` off a
// RadioGroup's onValueChange), which a literal-keyed Record can't be indexed by
// under this project's `strict: true` tsconfig.
export const TRANSACTION_TYPE_TO_POLICY_TYPE: Record<string, (typeof POLICY_TYPES)[number]> = {
  Purchase: 'Simultaneous',
  Refinance: 'Loan',
  Equity: 'Loan',
}

// Auto-suggested Settlement Format when Transaction Type changes — a starting point
// only, never locked (Cam's call, 2026-09-11). Same Record<string, ...> keying as
// TRANSACTION_TYPE_TO_POLICY_TYPE above, for the same reason.
export const TRANSACTION_TYPE_TO_SETTLEMENT_FORMAT: Record<string, (typeof SETTLEMENT_FORMATS)[number]> = {
  Purchase: 'Closing Disclosure',
  Refinance: 'Closing Disclosure',
  Equity: 'HUD-1',
  Other: 'HUD-1',
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit` from `genesis-app/`
Expected: no new errors from `src/lib/constants.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add SETTLEMENT_FORMATS and Transaction-Type default maps"
```

---

### Task 3: `OrderForm.tsx` — Settlement Format field, controlled Policy Type, auto-suggest wiring

**Files:**
- Modify: `src/components/OrderForm.tsx`

**Interfaces:**
- Consumes: `SETTLEMENT_FORMATS`, `TRANSACTION_TYPE_TO_POLICY_TYPE`, `TRANSACTION_TYPE_TO_SETTLEMENT_FORMAT` (Task 2); `Order.settlement_format` (Task 1).
- Produces: form fields named `policy_type` and `settlement_format` in the rendered `<form>`, submitted the same way every other field here already is — consumed by Task 4 (`orders.ts`).

- [ ] **Step 1: Widen the import list**

In `src/components/OrderForm.tsx:5`, replace:

```typescript
import { PRODUCT_TYPES, POLICY_TYPES, TRANSACTION_TYPES, PRODUCT_TYPE_TO_TRANSACTION_TYPE } from '@/lib/constants'
```

with:

```typescript
import {
  PRODUCT_TYPES,
  POLICY_TYPES,
  TRANSACTION_TYPES,
  SETTLEMENT_FORMATS,
  PRODUCT_TYPE_TO_TRANSACTION_TYPE,
  TRANSACTION_TYPE_TO_POLICY_TYPE,
  TRANSACTION_TYPE_TO_SETTLEMENT_FORMAT,
} from '@/lib/constants'
```

- [ ] **Step 2: Add controlled state for Policy Type and Settlement Format**

In `src/components/OrderForm.tsx`, immediately after the existing `transactionTypeTouched` state (currently line 33), add:

```typescript
  const [policyType, setPolicyType] = useState(
    order?.policy_type ?? TRANSACTION_TYPE_TO_POLICY_TYPE[transactionType] ?? 'None'
  )
  const [policyTypeTouched, setPolicyTypeTouched] = useState(false)

  const [settlementFormat, setSettlementFormat] = useState(
    order?.settlement_format ?? TRANSACTION_TYPE_TO_SETTLEMENT_FORMAT[transactionType]
  )
  const [settlementFormatTouched, setSettlementFormatTouched] = useState(false)
```

- [ ] **Step 3: Make `handleSave` accept multiple overrides**

Multiple fields can now change from a single Transaction Type click (Transaction Type itself, plus whichever of Policy Type / Settlement Format aren't touched yet), and each needs to land in the same autosave call rather than three racing ones. Replace the existing `handleSave` function (currently lines 41-48):

```typescript
  function handleSave(overrides?: { name: string; value: string }[]) {
    if (!formRef.current || !order) return
    const formData = new FormData(formRef.current)
    for (const override of overrides ?? []) {
      formData.set(override.name, override.value)
    }
    save(formData)
  }
```

- [ ] **Step 4: Update the Product Type field's call site for the new signature**

In the Product Type `<Select>`'s `onValueChange` (currently lines 86-91), replace:

```typescript
              if (order) handleSave({ name: 'product_type', value: v as string })
```

with:

```typescript
              if (order) handleSave([{ name: 'product_type', value: v as string }])
```

- [ ] **Step 5: Replace the Policy Type field to be controlled, with a manual-touch flag**

Replace the existing Policy Type block (currently lines 106-124):

```tsx
        <div>
          <Label htmlFor="policy_type">Policy Type</Label>
          <Select
            name="policy_type"
            value={policyType}
            onValueChange={(v) => {
              setPolicyType(v as string)
              setPolicyTypeTouched(true)
              if (order) handleSave([{ name: 'policy_type', value: v as string }])
            }}
          >
            <SelectTrigger id="policy_type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POLICY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="settlement_format">Settlement Format</Label>
          <Select
            name="settlement_format"
            value={settlementFormat}
            onValueChange={(v) => {
              setSettlementFormat(v as string)
              setSettlementFormatTouched(true)
              if (order) handleSave([{ name: 'settlement_format', value: v as string }])
            }}
          >
            <SelectTrigger id="settlement_format" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SETTLEMENT_FORMATS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
```

(This turns the 2-column grid the Product Type/Policy Type pair currently lives in into 3 fields — leave the surrounding `<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">` wrapper as-is; a 3rd item in a 2-column grid just wraps to its own row, which is fine here.)

- [ ] **Step 6: Wire the Transaction Type radio group's auto-suggest side effects**

Replace the Transaction Type `RadioGroup`'s `onValueChange` (currently lines 133-137):

```typescript
          onValueChange={(v) => {
            setTransactionType(v as string)
            setTransactionTypeTouched(true)
            const overrides: { name: string; value: string }[] = [{ name: 'transaction_type', value: v as string }]

            if (!policyTypeTouched) {
              const suggestedPolicy = TRANSACTION_TYPE_TO_POLICY_TYPE[v as string]
              if (suggestedPolicy) {
                setPolicyType(suggestedPolicy)
                overrides.push({ name: 'policy_type', value: suggestedPolicy })
              }
            }

            if (!settlementFormatTouched) {
              const suggestedFormat = TRANSACTION_TYPE_TO_SETTLEMENT_FORMAT[v as string]
              setSettlementFormat(suggestedFormat)
              overrides.push({ name: 'settlement_format', value: suggestedFormat })
            }

            if (order) handleSave(overrides)
          }}
```

- [ ] **Step 7: Run the app locally and sanity-check by eye**

Run: `npm run dev` from `genesis-app/`, open `/orders/new`.
Expected: Policy Type shows "Simultaneous" and Settlement Format shows "Closing Disclosure" by default (Transaction Type defaults to Purchase). Within the same page session, clicking "Refinance" updates Policy Type to "Loan" (Settlement Format stays "Closing Disclosure") since neither has been manually touched yet. Clicking "Other" leaves Policy Type wherever it was (no entry in the map for Other) and sets Settlement Format to "HUD-1". Manually picking a Policy Type first, then changing Transaction Type again, must NOT change Policy Type a second time.

- [ ] **Step 8: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "feat: Settlement Format field + Transaction-Type-driven defaults for Policy Type and Settlement Format"
```

---

### Task 4: `orders.ts` — persist and validate `settlement_format`

**Files:**
- Modify: `src/app/actions/orders.ts`

**Interfaces:**
- Consumes: `SETTLEMENT_FORMATS` (Task 2), the `settlement_format` form field (Task 3).

- [ ] **Step 1: Import the new constant**

In `src/app/actions/orders.ts:6-14`, add `SETTLEMENT_FORMATS` to the existing import from `@/lib/constants`:

```typescript
import {
  ORDER_STATUSES,
  TITLE_STATUSES,
  ESCROW_STATUSES,
  FUNCTIONAL_ROLES,
  PRODUCT_TYPES,
  TRANSACTION_TYPES,
  POLICY_TYPES,
  SETTLEMENT_FORMATS,
} from '@/lib/constants'
```

- [ ] **Step 2: Read and persist the field in `createOrder`**

In `createOrder` (currently lines 29-60), add the read alongside `policyType` (after line 31):

```typescript
  const settlementFormat = formData.get('settlement_format') as string
```

and add it to `orderFields` (after `policy_type: policyType,` at line 47):

```typescript
    settlement_format: settlementFormat,
```

- [ ] **Step 3: Read, validate, and persist the field in `saveOrderEntry`**

In `saveOrderEntry` (currently lines 95-155), add the read alongside `policyType` (after line 101):

```typescript
  const settlementFormat = formData.get('settlement_format') as string
```

Extend the existing validation block (currently lines 117-123):

```typescript
  if (
    !PRODUCT_TYPES.includes(productType as (typeof PRODUCT_TYPES)[number]) ||
    !TRANSACTION_TYPES.includes(transactionType as (typeof TRANSACTION_TYPES)[number]) ||
    !POLICY_TYPES.includes(policyType as (typeof POLICY_TYPES)[number]) ||
    !SETTLEMENT_FORMATS.includes(settlementFormat as (typeof SETTLEMENT_FORMATS)[number])
  ) {
    return { error: 'Invalid selection. Please choose from the provided options.' }
  }
```

and add it to the update payload (after `policy_type: policyType,` at line 131):

```typescript
      settlement_format: settlementFormat,
```

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/orders.ts
git commit -m "feat: persist and validate orders.settlement_format"
```

---

### Task 5: e2e test — defaults follow Transaction Type, manual edits stick

**Files:**
- Modify: `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: the rendered `Settlement Format` and `Policy Type` `<Select>`s (Task 3), the persisted `settlement_format` column (Task 1/4).

- [ ] **Step 1: Write the test**

Add this test inside the existing `test.describe('Genesis foundation phase', ...)` block in `tests/e2e/order-entry.spec.ts`, near the other Order Entry autosave test (`'order entry: field, select, and checkbox edits autosave and persist across reload'`):

```typescript
  test('order entry: Settlement Format and Policy Type default from Transaction Type, manual picks stick', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    // Fresh order defaults to Transaction Type: Purchase.
    await expect(page.getByLabel('Policy Type')).toContainText('Simultaneous')
    await expect(page.getByLabel('Settlement Format')).toContainText('Closing Disclosure')

    // Switching to Refinance updates both, since neither has been touched manually yet.
    await page.getByRole('radio', { name: 'Refinance' }).click()
    await expect(page.getByLabel('Policy Type')).toContainText('Loan')
    await expect(page.getByLabel('Settlement Format')).toContainText('Closing Disclosure')
    await expect(page.getByTestId('save-indicator')).toContainText('Saved')

    // Manually override Policy Type, then switch Transaction Type again — the manual
    // pick must stick, but Settlement Format (still untouched) keeps auto-suggesting.
    await page.getByLabel('Policy Type').click()
    await page.getByRole('option', { name: "Owner's" }).click()
    await page.getByRole('radio', { name: 'Equity' }).click()
    await expect(page.getByLabel('Policy Type')).toContainText("Owner's")
    await expect(page.getByLabel('Settlement Format')).toContainText('HUD-1')
    await expect(page.getByTestId('save-indicator')).toContainText('Saved')

    // Other has no Policy Type default at all — it must stay unchanged.
    await page.getByRole('radio', { name: 'Other' }).click()
    await expect(page.getByLabel('Policy Type')).toContainText("Owner's")
    await expect(page.getByLabel('Settlement Format')).toContainText('HUD-1')

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByLabel('Policy Type')).toContainText("Owner's")
    await expect(page.getByLabel('Settlement Format')).toContainText('HUD-1')
  })
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/order-entry.spec.ts -g "Settlement Format and Policy Type default"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/order-entry.spec.ts
git commit -m "test: Settlement Format / Policy Type defaulting from Transaction Type"
```
