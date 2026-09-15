# New Order Configuration Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/orders/new` (today: the full `OrderForm.tsx` rendered directly, asking for Product Type/Transaction Type/property/price/etc. before an order even exists) with a small SoftPro-style "New Order" dialog — matching `SoftPro Screenshots/Order Cretation Editor.Config.png` — that asks only three things: the auto-generated base file number (read-only), a state Suffix, and a Settlement Format (Closing Disclosure or HUD-1). Submitting creates a minimal order row and redirects straight into the existing Order Entry screen (`OrderForm.tsx` in edit mode), where every other field is filled in afterward via its existing autosave. This is Tier 3, item 9 of the Fix Plan, and its Suffix field is also the answer to Tier 6, item 21 (file number format blocked on "what happens when state isn't known at creation").

**Architecture:** New `orders.state_suffix` column (2-char, not null, includes a literal `'XX'` "Unknown/TBD" option for the genuine not-yet-known case) plus a new `US_STATES` constant (50 states + DC + `XX`) in `src/lib/constants.ts` for the dropdown — no existing state-abbreviation list exists in this codebase (`property_state` is free text, autofilled from zip lookup by `ZipCountyField`, not a dropdown; it stays exactly as-is and is untouched by this plan). `next_file_number(p_year int)` becomes `next_file_number(p_year int, p_suffix text)`, returning `YY-NNNNNN` + suffix (6-digit sequence, matching Cam's spec `YY-######ST`) instead of the current `YYYY-NNNN`. A new client component `NewOrderDialog` replaces the current page body; `createOrder` in `orders.ts` is trimmed to a minimal insert (`file_number`, `state_suffix`, `settlement_format`, `created_by` — every other `orders` column already has a `not null default`, confirmed against `0001_foundation_schema.sql`/`0007`/`0013`, so nothing else needs a value at creation).

**Tech Stack:** Next.js Server Actions, Supabase (Postgres), React (client component), Playwright e2e.

**Spec:** No separate spec file — decided in chat 2026-09-11 from Cam's own walkthrough of the SoftPro reference screenshot. Background and the decision trail live in [[Genesis Screen Notes - Fix Plan]] (Tier 3, item 9; Tier 6, item 21) and the vault design doc `Genesis Rebuild - New Order Configuration Screen Design.md`.

## Global Constraints

- Migration filename number is **not** `0054`/`0055` — those are already reserved by `docs/superpowers/plans/2026-09-10-staff-directory-permissions.md`, and several other `2026-09-11-*` plans also reserve "the next number" without hardcoding one. Before writing the migration file, run `ls supabase/migrations | sort -V | tail -3` to find the real next number and use that. If more than one of these plans is dispatched in parallel, execute the migration-writing steps serially or re-check that command immediately before each.
- File number format from this point forward: `YY-NNNNNN` + 2-letter suffix (e.g. `26-000030NC`) — 2-digit year, 6-digit zero-padded sequence, matching Cam's spec `YY-######ST`. Existing orders (`2026-0029`-style, no suffix) are **not** retroactively renumbered — same call already made and recorded in [[Genesis Screen Notes - Fix Plan]] the first time this format gap was scoped.
- Settlement Format in this dialog offers exactly 2 of the 3 values already defined by [[Genesis Rebuild - Settlement Format & Policy-Type Defaults Implementation Readiness]] (`SETTLEMENT_FORMATS = ['Closing Disclosure', 'Commercial', 'HUD-1']`): Closing Disclosure and HUD-1, matching Cam's own description of this flow ("we pick the Settlement Format (CD or HUD-1)"). Commercial stays a valid, selectable value later on the Order Entry screen's own Settlement Format field for the rare case — this dialog just doesn't offer it as a first-run choice. **This plan supersedes that plan's `orders.settlement_format` migration/column** (Task 1 below) so the column only gets created once; that plan's Task 2 (constants), Task 3 (Order Entry's own Settlement Format `<Select>` + Transaction-Type auto-suggest), Task 4 (persistence in `saveOrderEntry`), and Task 5 (e2e) are unaffected and still needed — only its Task 1 (the migration) and the `createOrder`-side half of its Task 4 are redundant with this plan's Task 1/5 and should be skipped if that plan is executed after this one (or this plan's Task 1 skipped if that one runs first — whichever plan runs second should check for the column/constant before adding them again).
- The dialog's base file number is allocated (via `next_file_number`) as soon as the dialog opens, before Suffix/Settlement Format are chosen — matching the screenshot, which shows a populated Order Number field before either dropdown/radio has a value. **This means an abandoned dialog (opened, then navigated away from without clicking Create) burns a sequence number, leaving a gap.** That's an accepted SoftPro-matching tradeoff, not a reintroduction of the race/gap bug migration `0041` fixed — `0041` was about *collisions* from `count(*)+1` after a delete; a gap from a genuinely-abandoned allocation is cosmetic (skipped numbers), never a collision, and SoftPro's own dialog has the identical tradeoff (its Order number is already populated the instant the dialog opens).
- `state_suffix` is asked at order creation and is a **separate field from `property_state`** — it exists purely to compose the file number, same as SoftPro's own Suffix dropdown does nothing but that. As a convenience, `state_suffix` (when it's a real state, not `XX`) pre-fills `property_state` on the order row at creation — `ZipCountyField`'s existing autofill-if-blank behavior (`fillIfBlank`, `ZipCountyField.tsx`) already treats it as editable/overridable later, so this is a free, non-blocking default, not a new constraint on that field.

---

### Task 1: Migration — `orders.state_suffix`, updated `next_file_number`, and the `Order` type

**Files:**
- Create: `supabase/migrations/00XX_new_order_configuration.sql` (replace `00XX` with the real next number per Global Constraints)
- Modify: `src/lib/types.ts` (the `Order` type)

**Interfaces:**
- Produces: `Order.state_suffix: string` — consumed by Task 3 (`NewOrderDialog`) and Task 4 (`orders.ts`). Replaces `next_file_number(p_year int)` with `next_file_number(p_year int, p_suffix text)` — consumed by Task 4.

- [ ] **Step 1: Find the real next migration number**

Run: `ls supabase/migrations | sort -V | tail -3`

Use whatever number comes after the highest one listed in place of `00XX` below.

- [ ] **Step 2: Check whether `orders.settlement_format` already exists**

Run: `grep -rl "settlement_format" supabase/migrations`

If a migration adding `orders.settlement_format` already exists (from `2026-09-11-settlement-format-policy-type-defaults.md` having run first), **skip the `alter table ... add column settlement_format` statement below** — only add `state_suffix` and replace `next_file_number`. If it doesn't exist yet, include it (this plan is allowed to be the one that adds it first; whichever of the two plans runs second must re-check this before adding its own copy).

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/00XX_new_order_configuration.sql
-- Tier 3 item 9 (New Order Configuration screen) + Tier 6 item 21 (file number
-- format blocked on unknown state at creation). SoftPro's own "New Order" dialog
-- (SoftPro Screenshots/Order Cretation Editor.Config.png) has a Suffix dropdown
-- resolved before the file number is finalized -- this is the same answer: state
-- is picked (or explicitly marked unknown via 'XX') in the New Order dialog itself,
-- so it's always available to embed in the file number at creation time. Separate
-- column from property_state (free text, autofilled from zip lookup elsewhere) --
-- this one exists only to compose the file number, same as SoftPro's Suffix field.
alter table public.orders
  add column state_suffix text not null default 'XX'
  check (state_suffix ~ '^[A-Z]{2}$');

-- Only if not already added by the Settlement Format plan (see Step 2 above):
-- alter table public.orders
--   add column settlement_format text not null default 'Closing Disclosure'
--   check (settlement_format in ('Closing Disclosure', 'Commercial', 'HUD-1'));

-- New format: YY-NNNNNN + 2-letter suffix (Cam's spec: YY-######ST), replacing the
-- prior YYYY-NNNN with no suffix. Existing orders keep their old-format numbers --
-- not retroactively renumbered, per the standing call already recorded in
-- [[Genesis Screen Notes - Fix Plan]] the first time this gap was scoped.
create or replace function next_file_number(p_year int, p_suffix text)
returns text
language sql
as $$
  insert into file_number_counters (year, last_number)
  values (p_year, 1)
  on conflict (year) do update set last_number = file_number_counters.last_number + 1
  returning (p_year % 100)::text || '-' || lpad(last_number::text, 6, '0') || p_suffix;
$$;
```

- [ ] **Step 4: Apply the migration**

Use whichever Supabase migration-apply workflow this project already uses for prior migrations (check `docs/superpowers/plans/2026-09-10-staff-directory-permissions.md` Task 1 Step 5 for the exact command this project runs).

- [ ] **Step 5: Update the `Order` type**

In `src/lib/types.ts`, add the new field to the `Order` type (after `file_number`):

```typescript
export type Order = {
  id: string
  file_number: string
  state_suffix: string
  product_type: string
  // ...rest unchanged (settlement_format already added here if the Settlement
  // Format plan ran first -- don't duplicate it)
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/00XX_new_order_configuration.sql src/lib/types.ts
git commit -m "feat: add orders.state_suffix, extend next_file_number with a state suffix"
```

---

### Task 2: Constants — `US_STATES`

**Files:**
- Modify: `src/lib/constants.ts`

**Interfaces:**
- Produces: `US_STATES` (readonly tuple — match whichever shape this codebase's existing enums already use, e.g. `PRODUCT_TYPES`) — consumed by Task 3.

- [ ] **Step 1: Check the existing convention for enum-with-dropdown constants**

Run: `sed -n '1,30p' src/lib/constants.ts` — confirm whether existing tuples like `PRODUCT_TYPES` are bare string arrays (`as const`) or objects, and match that shape exactly for `US_STATES` rather than inventing a new shape.

- [ ] **Step 2: Add the constant**

In `src/lib/constants.ts`, add (matching whichever shape Step 1 found):

```typescript
// Used only by the New Order dialog's Suffix dropdown (file-number composition) --
// not the same list as property_state, which stays free text elsewhere in this app.
// 'XX' is the explicit "state unknown at creation" placeholder answering Tier 6 item
// 21's original blocker.
export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'XX',
] as const
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit` from `genesis-app/`
Expected: no new errors from `src/lib/constants.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add US_STATES for the New Order dialog's Suffix dropdown"
```

---

### Task 3: `NewOrderDialog` — the replacement for `/orders/new`'s current bare-form flow

**Files:**
- Create: `src/components/NewOrderDialog.tsx`
- Modify: `src/app/orders/new/page.tsx`

**Interfaces:**
- Consumes: `US_STATES` (Task 2); `createOrder` (Task 4, updated signature).
- Produces: a form posting `state_suffix` and `settlement_format` — consumed by Task 4.

- [ ] **Step 1: Add a server action that allocates the base number on dialog-open**

This can live in `src/app/actions/orders.ts` alongside `createOrder` — a thin wrapper that just previews the next number without incrementing the counter permanently is not possible with the current atomic upsert-increment design (`next_file_number` increments on every call, by design, per migration `0041`'s race-free guarantee) — so "preview" and "allocate" are the same operation here. Add:

```typescript
export async function allocateFileNumberPreview(): Promise<string> {
  const supabase = await createClient()
  const year = new Date().getFullYear()
  const { data, error } = await supabase.rpc('next_file_number', { p_year: year, p_suffix: 'XX' })
  if (error || !data) throw new Error('Could not allocate a file number')
  return data
}
```

Note this allocates with a placeholder `'XX'` suffix immediately, then Task 4's `createOrder` re-derives the final displayed number by string-splicing the real suffix in client-side before submit (replace the trailing `XX` with the chosen 2-letter code) rather than calling `next_file_number` a second time — a second call would burn a second sequence number for the same dialog session. If the user picks a real state, the final `file_number` inserted is the spliced version; if they leave it `XX` (or the dialog's default), it's inserted as allocated.

- [ ] **Step 2: Build the dialog component**

```tsx
// src/components/NewOrderDialog.tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { US_STATES } from '@/lib/constants'
import { allocateFileNumberPreview, createOrder } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export function NewOrderDialog() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [baseNumber, setBaseNumber] = useState<string | null>(null)
  const [suffix, setSuffix] = useState('XX')
  const [settlementFormat, setSettlementFormat] = useState('Closing Disclosure')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    allocateFileNumberPreview()
      .then(setBaseNumber)
      .catch(() => setError('Could not generate a file number. Please retry.'))
  }, [])

  const displayNumber = baseNumber ? baseNumber.replace(/XX$/, suffix) : '…'

  function handleCreate() {
    if (!baseNumber) return
    startTransition(async () => {
      const result = await createOrder({
        fileNumber: baseNumber.replace(/XX$/, suffix),
        stateSuffix: suffix,
        settlementFormat,
      })
      if (result?.error) {
        setError(result.error)
        return
      }
      router.push(`/orders/${result.orderId}/order-entry`)
    })
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-2xl font-semibold">New Order</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Label>Order Number</Label>
        <p className="rounded-md border bg-input/50 px-3 py-2 font-mono text-muted-foreground">{displayNumber}</p>
      </div>

      <div>
        <Label htmlFor="state_suffix">Suffix</Label>
        <Select value={suffix} onValueChange={setSuffix}>
          <SelectTrigger id="state_suffix" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {US_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'XX' ? 'Unknown / TBD' : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Settlement Format</Label>
        <RadioGroup value={settlementFormat} onValueChange={setSettlementFormat} className="mt-2">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="Closing Disclosure" id="sf_cd" />
            <Label htmlFor="sf_cd" className="font-normal">Closing Disclosure</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="HUD-1" id="sf_hud" />
            <Label htmlFor="sf_hud" className="font-normal">HUD-1</Label>
          </div>
        </RadioGroup>
      </div>

      <Button onClick={handleCreate} disabled={!baseNumber || isPending}>
        {isPending ? 'Creating…' : 'Create'}
      </Button>
    </div>
  )
}
```

(Confirm `Select`/`RadioGroup`/`Button`/`Label` import paths match `OrderForm.tsx`'s existing imports exactly — copy them from there rather than re-guessing.)

- [ ] **Step 3: Wire the page**

Replace `src/app/orders/new/page.tsx`'s body (it currently renders `OrderForm` directly) with `NewOrderDialog`:

```tsx
import { NewOrderDialog } from '@/components/NewOrderDialog'
import { PendingSaveProvider } from '@/lib/pending-saves'

export default function NewOrderPage() {
  return (
    <PendingSaveProvider>
      <NewOrderDialog />
    </PendingSaveProvider>
  )
}
```

(`OrderForm`'s `action` prop for the create case, and the page's `searchParams`-based error banner, both become dead once `NewOrderDialog` handles create+error itself — remove them from `OrderForm.tsx` only if nothing else still depends on the create-mode branch; check for other callers first with `grep -rn "OrderForm" src/app` before deleting that branch, since `OrderForm` is also used in edit mode on Order Entry and must keep working there unchanged.)

- [ ] **Step 4: Commit**

```bash
git add src/components/NewOrderDialog.tsx src/app/orders/new/page.tsx
git commit -m "feat: New Order Configuration dialog replaces the bare create-order form"
```

---

### Task 4: `orders.ts` — minimal `createOrder`

**Files:**
- Modify: `src/app/actions/orders.ts`

**Interfaces:**
- Consumes: `{ fileNumber, stateSuffix, settlementFormat }` (Task 3).
- Produces: `{ orderId: string } | { error: string }` — consumed by Task 3.

- [ ] **Step 1: Replace `createOrder`'s signature and body**

Replace the existing `createOrder` (currently reads a full `FormData` of every Order Entry field) with a minimal version taking the three New Order dialog values directly, since none of the other `orders` columns are being collected at creation anymore — they all already have `not null default`s (confirmed against `0001_foundation_schema.sql`, `0007_order_entry_settlement_rush.sql`, `0013_order_transaction_type.sql`) and get filled in on Order Entry afterward via its existing autosave:

```typescript
export async function createOrder(input: {
  fileNumber: string
  stateSuffix: string
  settlementFormat: string
}): Promise<{ orderId: string } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      file_number: input.fileNumber,
      state_suffix: input.stateSuffix,
      settlement_format: input.settlementFormat,
      property_state: input.stateSuffix === 'XX' ? null : input.stateSuffix,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('createOrder failed:', error)
    return { error: 'Could not save. Please check your entries and try again.' }
  }

  await copyFolderTemplateForOrder(data.id)
  await copyChecklistTemplateForOrder(data.id)

  revalidatePath('/orders')
  return { orderId: data.id }
}
```

Note the `property_state` pre-fill is the convenience default from Global Constraints — `null` when the suffix is the `'XX'` placeholder (nothing to prefill), the 2-letter code otherwise; `ZipCountyField`'s existing `fillIfBlank` behavior already treats this as overridable later, so this doesn't lock anything in.

- [ ] **Step 2: Remove the now-unused `FormData`-parsing logic specific to the old full-form create path**

Check whether `PRODUCT_TYPES`/`TRANSACTION_TYPES`/`POLICY_TYPES`/`SETTLEMENT_FORMATS` are still imported/used elsewhere in this file (they are — `saveOrderEntry` still needs them) — only remove what was solely serving the old `createOrder`'s form-parsing (the old `productType`/`transactionType`/etc. `const` reads inside `createOrder` itself, now gone with the replaced function body above).

- [ ] **Step 3: Run the app locally and sanity-check by eye**

Run: `npm run dev` from `genesis-app/`, open `/orders/new`.
Expected: Order Number field shows a real allocated number ending in `XX` until a state is picked, updates live as the Suffix dropdown changes, Settlement Format defaults to Closing Disclosure, clicking Create lands on `/orders/[id]/order-entry` with the new file number displayed and every other field at its normal default (Product Type "Purchase," etc.) ready to fill in.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/orders.ts
git commit -m "feat: minimal createOrder for the New Order Configuration dialog"
```

---

### Task 5: e2e test — New Order dialog creates with the right file number shape

**Files:**
- Modify: `tests/e2e/order-entry.spec.ts` (or wherever the existing "create order" e2e coverage lives — check for one first with `grep -rn "New Order\|Create Order" tests/e2e` before adding a duplicate)

**Interfaces:**
- Consumes: the rendered `NewOrderDialog` (Task 3), the persisted `file_number`/`state_suffix`/`settlement_format` (Task 1/4).

- [ ] **Step 1: Write the test**

```typescript
  test('new order dialog: suffix and settlement format compose the file number and land on Order Entry', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    await expect(page.getByLabel('Order Number')).toContainText(/XX$/)

    await page.getByLabel('Suffix').click()
    await page.getByRole('option', { name: 'NC' }).click()
    await expect(page.getByLabel('Order Number')).toContainText(/NC$/)

    await page.getByRole('radio', { name: 'HUD-1' }).click()
    await page.getByRole('button', { name: 'Create' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await expect(page.getByLabel('File Number')).toHaveValue(/^\d{2}-\d{6}NC$/)
  })
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/order-entry.spec.ts -g "New Order dialog"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/order-entry.spec.ts
git commit -m "test: New Order Configuration dialog file-number composition"
```
