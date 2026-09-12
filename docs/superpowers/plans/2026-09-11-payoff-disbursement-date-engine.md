# Payoff Per-Diem & Disbursement Date Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two gaps Cam flagged in Payoff Calculations: (1) the "Payoff Amount" method has no per-diem field and doesn't compute a live total, unlike "Principal Balance" which already does both; (2) a real disbursement-date engine on Order Info — Purchase disburses same day as Settlement Date, Refinance (by default) carries a 3-day rescission period disbursing on the 4th day — plus a plain Settlement Office Location field Cam's raw notes call for on the same screen.

**Architecture:** A new pure `calculateDisbursementDate` function (same style/date-string convention as the existing `tax-proration.ts`) drives four new `orders` columns (`settlement_office_location`, `disbursement_date`, `rescission_included`, `include_saturday_in_rescission`), surfaced on `OrderInfoForm.tsx` and computed authoritatively server-side in `saveOrderInfo`. Payoff Calculations' existing "Payoff Date Basis" dropdown (`Disbursement`/`Closing`/`Recording` — already on screen, currently just a label with no effect) gets wired so picking "Disbursement" pulls the payoff's own "Payoff Expires On" date into From and the order's Disbursement Date into To, and the Payoff Amount method gains its own Per Diem field and live total.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres), React (client components), Playwright e2e.

**Spec:** No separate spec file — bounded change approved in chat 2026-09-11. Source requirement: `Cam's Screen Notes.md` (Order Info section, line 34; Payoff Calculations section, line 203) and [[Genesis Screen Notes - Fix Plan]] (Tier 5, item 14).

## Global Constraints

- Migration filename number is **not** `0054`/`0055` (reserved by `docs/superpowers/plans/2026-09-10-staff-directory-permissions.md`). Run `ls supabase/migrations | sort -V | tail -3` before writing the migration and account for any of this session's other plans (`2026-09-11-settlement-format-policy-type-defaults.md`, `2026-09-11-recording-fee-schedules.md`) that may have already run.
- Rescission counting rule (Cam's own model, not general TILA/Reg Z — do not "correct" it toward the federal standard): starting the day after Settlement Date, count 3 days that are **not** Sunday, and **not** Saturday unless "Include Saturday in Rescission" is checked. Disbursement Date is the calendar day immediately after the 3rd counted day. No holiday handling — not requested, don't add it.
- "Rescission Included with This Order" defaults to **checked only when Transaction Type is Refinance** — Purchase, Equity, and Other all default unchecked (Cam's explicit answer, 2026-09-11, overriding the more general "Refinance/Equity" wording in the Fix Plan's own summary). Like every other Transaction-Type-driven default in this codebase, it's a starting point only — always manually editable.
- "Include Saturday in Rescission" has no Transaction-Type-driven default — it's a plain checkbox, defaults unchecked.
- Settlement Date is edited on Order Entry, not Order Info (Cam's own note) — Order Info only reads it to compute/display Disbursement Date, never edits it.
- Disbursement Date is server-computed and stored (`saveOrderInfo` recomputes it from the persisted Settlement Date + the submitted checkboxes on every save), not client-editable directly — matches the "(calculated)" label in Cam's own note.
- **Payoff Date Basis = "Disbursement" auto-fill mapping (corrected 2026-09-11, do not use Settlement Date here):** From = the payoff's own existing "Payoff Expires On" field (`payoff_expires_on` — Cam's "Payoff Good Through Date," same field, no rename needed), To = the order's Disbursement Date. This is the period over which extra per-diem interest accrues beyond a quoted payoff's good-through date, not the settlement-to-disbursement window.
- This codebase has no unit-test runner (no `vitest`/`jest`, no `test` script in `package.json`) — pure lib functions like the existing `tax-proration.ts` are verified only through Playwright e2e tests against the UI that uses them. `calculateDisbursementDate` follows that same convention; do not add a separate unit-test file/framework for it.
- Live-computed totals (Payoff Amount method's new total, same as the existing Principal Balance total) are **display only** — never written back into `payoff_amount`, `amount`, or any other field, matching the rule already documented for Principal Balance's total in this file.

---

### Task 1: Migration — four new `orders` columns, `Order` type

**Files:**
- Create: `supabase/migrations/00XX_order_disbursement_date.sql` (replace `00XX` with the real next number per Global Constraints)
- Modify: `src/lib/types.ts:1-32` (the `Order` type)

**Interfaces:**
- Produces: `Order.settlement_office_location: string | null`, `Order.disbursement_date: string | null`, `Order.rescission_included: boolean`, `Order.include_saturday_in_rescission: boolean` — consumed by Task 3 (`orders.ts`), Task 4 (`OrderInfoForm.tsx`), Task 5 (`PayoffCalculationsPanel.tsx`).

- [ ] **Step 1: Find the real next migration number**

Run: `ls supabase/migrations | sort -V | tail -3`

Use whatever number comes after the highest one listed in place of `00XX` below.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/00XX_order_disbursement_date.sql
-- Tier 5 item 14 (Cam's Screen Notes, Order Info + Payoff Calculations sections):
-- Settlement Office Location (plain text, new) and a real disbursement-date engine.
-- Purchase disburses same day as Settlement Date; Refinance (by default -- Cam's
-- explicit call, 2026-09-11) carries a 3-day rescission period disbursing on the 4th
-- day. disbursement_date is server-computed in saveOrderInfo (src/app/actions/orders.ts)
-- via src/lib/disbursement-date.ts, never edited directly.
alter table public.orders
  add column settlement_office_location text,
  add column disbursement_date date,
  add column rescission_included boolean not null default false,
  add column include_saturday_in_rescission boolean not null default false;

-- Backfill: every existing order has no rescission info on file yet. Disbursement
-- Date starts equal to Settlement Date for all of them (the "no rescission" default);
-- Rescission Included is then flipped on for existing Refinance orders to match the
-- UI's own going-forward default, so they aren't left incorrectly defaulted to "no
-- rescission." Their disbursement_date stays at settlement_date here regardless --
-- SQL can't run calculateDisbursementDate's day-counting logic -- and gets corrected
-- to the real rescission-adjusted value the next time staff save Order Info for that
-- file (Task 3's saveOrderInfo recomputes it from whatever rescission_included/
-- include_saturday_in_rescission are on file at save time).
update public.orders
  set disbursement_date = settlement_date
  where settlement_date is not null;

update public.orders
  set rescission_included = true
  where transaction_type = 'Refinance';
```

- [ ] **Step 3: Apply the migration**

Use whichever Supabase migration-apply workflow this project already uses for prior migrations (check `docs/superpowers/plans/2026-09-10-staff-directory-permissions.md` Task 1 Step 5 for the exact command).

- [ ] **Step 4: Update the `Order` type**

In `src/lib/types.ts`, add the four fields to the `Order` type (after `settlement_time`):

```typescript
export type Order = {
  id: string
  file_number: string
  product_type: string
  transaction_type: string
  policy_type: string
  purchase_price: number | null
  loan_amount: number | null
  property_address: string | null
  parcel_number: string | null
  property_city: string | null
  property_county: string | null
  property_state: string | null
  property_zip: string | null
  order_status: string
  title_status: string
  escrow_status: string
  settlement_date: string | null
  settlement_time: string | null
  settlement_office_location: string | null
  disbursement_date: string | null
  rescission_included: boolean
  include_saturday_in_rescission: boolean
  rush_order: boolean
  title_opened_date: string | null
  escrow_opened_date: string | null
  title_officer: string | null
  curative_title_officer: string | null
  escrow_assistant: string | null
  escrow_officer: string | null
  closing_coordinator: string | null
  funder: string | null
  recording_specialist: string | null
  post_closer: string | null
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00XX_order_disbursement_date.sql src/lib/types.ts
git commit -m "feat: add settlement_office_location and disbursement-date columns to orders"
```

---

### Task 2: `src/lib/disbursement-date.ts` — the calculation engine

**Files:**
- Create: `src/lib/disbursement-date.ts`

**Interfaces:**
- Produces: `calculateDisbursementDate(settlementDate: string, rescissionIncluded: boolean, includeSaturday: boolean): string` — consumed by Task 3 (`orders.ts`) and Task 4 (`OrderInfoForm.tsx`).

- [ ] **Step 1: Write the function**

```typescript
// Disbursement Date engine (Tier 5 item 14, Cam's Screen Notes -- Order Info +
// Payoff Calculations, resolved 2026-09-11). Same UTC-midnight date-string convention
// as tax-proration.ts's actualDaysBetween, to avoid local-timezone off-by-one bugs on
// plain 'YYYY-MM-DD' values.
//
// Purchase (and any order without rescission) disburses same day as Settlement Date.
// Refinance carries a 3-day rescission period by default (the checkbox is manually
// overridable for any Transaction Type): count 3 days after Settlement Date, skipping
// Sunday always and skipping Saturday unless includeSaturday is checked, then disburse
// the calendar day immediately after that 3rd counted day. This is Cam's own stated
// model, not the federal Reg Z rescission-counting rule -- do not "correct" it.
// No holiday handling -- not requested, don't add it.

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function dayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay() // 0 = Sunday, 6 = Saturday
}

export function calculateDisbursementDate(settlementDate: string, rescissionIncluded: boolean, includeSaturday: boolean): string {
  if (!rescissionIncluded) return settlementDate

  let date = addDays(settlementDate, 1)
  let counted = 0
  while (counted < 3) {
    const dow = dayOfWeek(date)
    const isSunday = dow === 0
    const isSaturday = dow === 6
    const countable = !isSunday && (includeSaturday || !isSaturday)
    if (countable) {
      counted++
      if (counted === 3) break
    }
    date = addDays(date, 1)
  }
  return addDays(date, 1)
}
```

- [ ] **Step 2: Sanity-check the function by hand against Cam's own example**

Cam's example: closing (Settlement Date) on a Monday, no Saturday counted, disburses "the fourth day after closing" — i.e. Friday. Verify: `calculateDisbursementDate('2026-06-01', true, false)` where `2026-06-01` is a Monday. Day-after-settlement = Tuesday 6/2 (countable, day 1), Wednesday 6/3 (day 2), Thursday 6/4 (day 3) — disbursement = Friday 6/5.

Find this project's existing pattern for running a one-off script against its own TypeScript lib code (check how `scripts/import-zip-lookup.mjs`, referenced in the Fix Plan, is invoked — that's this project's established way to run ad-hoc scripts). Use the same runner to execute a throwaway script that imports `calculateDisbursementDate` and logs `calculateDisbursementDate('2026-06-01', true, false)`. Confirm it prints `2026-06-05`, then delete the throwaway script.

- [ ] **Step 3: Commit**

```bash
git add src/lib/disbursement-date.ts
git commit -m "feat: add calculateDisbursementDate engine"
```

---

### Task 3: `orders.ts` — persist Settlement Office Location, rescission fields, and server-compute Disbursement Date

**Files:**
- Modify: `src/app/actions/orders.ts`

**Interfaces:**
- Consumes: `calculateDisbursementDate` (Task 2).
- Produces: `saveOrderInfo` now persists `settlement_office_location`, `rescission_included`, `include_saturday_in_rescission`, `disbursement_date` — consumed by Task 4 (`OrderInfoForm.tsx`). `createOrder` now defaults `rescission_included` from Transaction Type for new orders.

- [ ] **Step 1: Import the calculation function**

In `src/app/actions/orders.ts`, add near the top:

```typescript
import { calculateDisbursementDate } from '@/lib/disbursement-date'
```

- [ ] **Step 2: Default `rescission_included` on order creation**

In `createOrder` (currently lines 18-93), after the existing `const rushOrder = formData.get('rush_order') === 'on'` line (currently line 42), add:

```typescript
  const rescissionIncluded = transactionType === 'Refinance'
```

and add `rescission_included: rescissionIncluded,` to the `orderFields` object (after `rush_order: rushOrder,` at line 58).

- [ ] **Step 3: Extend `saveOrderInfo`'s existing-order fetch to include `settlement_date`**

In `saveOrderInfo` (currently lines 157-212), the existing fetch (currently lines 172-177):

```typescript
  const { data: existingOrder, error: fetchError } = await supabase
    .from('orders')
    .select('title_status, title_opened_date, escrow_status, escrow_opened_date')
    .eq('id', orderId)
    .single()
```

becomes:

```typescript
  const { data: existingOrder, error: fetchError } = await supabase
    .from('orders')
    .select('title_status, title_opened_date, escrow_status, escrow_opened_date, settlement_date')
    .eq('id', orderId)
    .single()
```

- [ ] **Step 4: Read the new fields and compute Disbursement Date**

In `saveOrderInfo`, after the existing `for (const { key } of FUNCTIONAL_ROLES) { ... }` loop (currently lines 191-193), add:

```typescript
  const settlementOfficeLocation = (formData.get('settlement_office_location') as string) || null
  const rescissionIncludedInput = formData.get('rescission_included') === 'on'
  const includeSaturdayInRescission = formData.get('include_saturday_in_rescission') === 'on'

  update.settlement_office_location = settlementOfficeLocation
  update.rescission_included = rescissionIncludedInput
  update.include_saturday_in_rescission = includeSaturdayInRescission
  update.disbursement_date = existingOrder.settlement_date
    ? calculateDisbursementDate(existingOrder.settlement_date, rescissionIncludedInput, includeSaturdayInRescission)
    : null
```

(This lands inside the existing `update: Record<string, unknown>` object already being built in this function — no new variable needed, just more assignments onto it before the final `supabase.from('orders').update(update)` call.)

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/orders.ts
git commit -m "feat: persist Settlement Office Location, default rescission from Transaction Type, server-compute Disbursement Date"
```

---

### Task 4: `OrderInfoForm.tsx` — Settlement Office Location, rescission checkboxes, computed Disbursement Date

**Files:**
- Modify: `src/components/OrderInfoForm.tsx`
- Modify: `src/app/orders/[id]/order-info/page.tsx`

**Interfaces:**
- Consumes: `calculateDisbursementDate` (Task 2), the four new `Order` fields (Task 1), plus `Order.settlement_date` (already exists, just not currently selected by this page).
- Produces: form fields `settlement_office_location`, `rescission_included`, `include_saturday_in_rescission` in the rendered form — consumed by Task 3 (`orders.ts`, already wired above).

- [ ] **Step 1: Select the extra columns in the page component**

In `src/app/orders/[id]/order-info/page.tsx`, extend the `.select(...)` string:

```typescript
  const { data: order } = await supabase
    .from('orders')
    .select(
      'order_status, title_status, escrow_status, title_opened_date, escrow_opened_date, title_officer, curative_title_officer, escrow_assistant, escrow_officer, closing_coordinator, funder, recording_specialist, post_closer, settlement_date, settlement_office_location, disbursement_date, rescission_included, include_saturday_in_rescission'
    )
    .eq('id', id)
    .single()
```

- [ ] **Step 2: Widen `OrderInfoForm`'s props type**

In `src/components/OrderInfoForm.tsx`, replace the `OrderInfoFields` type (currently lines 19-34):

```typescript
type OrderInfoFields = Pick<
  Order,
  | 'order_status'
  | 'title_status'
  | 'escrow_status'
  | 'title_opened_date'
  | 'escrow_opened_date'
  | 'title_officer'
  | 'curative_title_officer'
  | 'escrow_assistant'
  | 'escrow_officer'
  | 'closing_coordinator'
  | 'funder'
  | 'recording_specialist'
  | 'post_closer'
  | 'settlement_date'
  | 'settlement_office_location'
  | 'disbursement_date'
  | 'rescission_included'
  | 'include_saturday_in_rescission'
>
```

- [ ] **Step 3: Import the calculation function and the Checkbox component**

Replace the import block (currently lines 1-12):

```typescript
'use client'

import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { SaveIndicator } from '@/components/SaveIndicator'
import { saveOrderInfo } from '@/app/actions/orders'
import { useAutosave } from '@/lib/use-autosave'
import { calculateDisbursementDate } from '@/lib/disbursement-date'
import { ORDER_STATUSES, TITLE_STATUSES, ESCROW_STATUSES, FUNCTIONAL_ROLES } from '@/lib/constants'
import type { Order } from '@/lib/types'
```

- [ ] **Step 4: Add controlled state for the rescission checkboxes and a live-computed Disbursement Date**

In `OrderInfoForm`, immediately after the existing `escrowOpenedDate` line (currently line 41), add:

```typescript
  const [rescissionIncluded, setRescissionIncluded] = useState(order.rescission_included)
  const [includeSaturday, setIncludeSaturday] = useState(order.include_saturday_in_rescission)
  const disbursementDatePreview = order.settlement_date
    ? calculateDisbursementDate(order.settlement_date, rescissionIncluded, includeSaturday)
    : null
```

- [ ] **Step 5: Update `handleSave` to accept overrides, matching this session's other multi-field autosave forms**

Replace `handleSave` (currently lines 43-50):

```typescript
  function handleSave(overrides?: { name: string; value: string }[]) {
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    for (const override of overrides ?? []) {
      formData.set(override.name, override.value)
    }
    save(formData)
  }
```

- [ ] **Step 6: Fix the existing single-override call sites for the new signature**

The three existing `<Select>`s (`order_status`, `title_status`, `escrow_status`) each call `handleSave({ name: ..., value })` — replace each with the array form. For `order_status` (currently line 63):

```typescript
          onValueChange={(value) => value !== null && handleSave([{ name: 'order_status', value }])}
```

Apply the same `[{ ... }]` wrapping to the `title_status` `onValueChange` (currently line 83) and `escrow_status` `onValueChange` (currently line 104).

- [ ] **Step 7: Add the new fields to the rendered form**

After the existing `FUNCTIONAL_ROLES` grid (currently lines 117-124, right before the closing `</form>`), add:

```tsx
      <div>
        <Label htmlFor="settlement_office_location">Settlement Office Location</Label>
        <Input
          id="settlement_office_location"
          name="settlement_office_location"
          className="mt-1"
          defaultValue={order.settlement_office_location ?? undefined}
          onBlur={() => handleSave()}
        />
      </div>

      <div className="space-y-2 rounded border p-3">
        <p className="text-sm font-medium">Disbursement</p>
        <div className="flex items-center gap-2">
          <Checkbox
            id="rescission_included"
            name="rescission_included"
            checked={rescissionIncluded}
            onCheckedChange={(checked) => {
              const value = Boolean(checked)
              setRescissionIncluded(value)
              handleSave([{ name: 'rescission_included', value: value ? 'on' : '' }])
            }}
          />
          <Label htmlFor="rescission_included">Rescission Included with This Order</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="include_saturday_in_rescission"
            name="include_saturday_in_rescission"
            checked={includeSaturday}
            onCheckedChange={(checked) => {
              const value = Boolean(checked)
              setIncludeSaturday(value)
              handleSave([{ name: 'include_saturday_in_rescission', value: value ? 'on' : '' }])
            }}
          />
          <Label htmlFor="include_saturday_in_rescission">Include Saturday in Rescission</Label>
        </div>
        <p className="text-sm" data-testid="disbursement-date-preview">
          Disbursement Date:{' '}
          <span className="font-medium">{disbursementDatePreview ?? '— (needs a Settlement Date on Order Entry)'}</span>
        </p>
      </div>
```

(`rescission_included`/`include_saturday_in_rescission` are controlled `Checkbox`es rather than the plain `defaultChecked` pattern `rush_order` uses on `OrderForm.tsx`, because their live-preview text above needs to update on every click — a `defaultChecked`, uncontrolled checkbox can't drive that re-render.)

- [ ] **Step 8: Run the app locally and sanity-check by eye**

Run: `npm run dev` from `genesis-app/`. Create a Refinance order with a Settlement Date, go to Order Info.
Expected: "Rescission Included with This Order" is checked by default (per Task 3 Step 2's `createOrder` default); if the Settlement Date is a Monday, the Disbursement Date preview reads the following Friday (per Task 2 Step 2's worked example). Unchecking it changes the preview to the Settlement Date itself. Create a Purchase order instead — the checkbox defaults unchecked and the preview equals Settlement Date.

- [ ] **Step 9: Commit**

```bash
git add src/components/OrderInfoForm.tsx src/app/orders/[id]/order-info/page.tsx
git commit -m "feat: Settlement Office Location, rescission checkboxes, and Disbursement Date preview on Order Info"
```

---

### Task 5: `PayoffCalculationsPanel.tsx` — Payoff Amount per-diem/total, Disbursement date-basis auto-fill

**Files:**
- Modify: `src/components/title/PayoffCalculationsPanel.tsx`
- Modify: `src/app/orders/[id]/payoff-calculations/page.tsx`

**Interfaces:**
- Consumes: `Order.disbursement_date` (Task 1).
- Produces: a live-computed total on the Payoff Amount method, and Payoff Date Basis = "Disbursement" auto-filling `payoff_date_basis_from` (from this payoff's own "Payoff Expires On") and `payoff_date_basis_to` (from the order's Disbursement Date).

- [ ] **Step 1: Fetch the order's Disbursement Date in the page component**

Replace `src/app/orders/[id]/payoff-calculations/page.tsx` in full:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listPayoffsForCalculation, listPayoffAdditionalCharges, listAllContacts } from '@/app/actions/payoff-calculations'
import { PayoffCalculationsPanel } from '@/components/title/PayoffCalculationsPanel'

export default async function PayoffCalculationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [payoffs, contacts, order] = await Promise.all([
    listPayoffsForCalculation(orderId),
    listAllContacts(orderId),
    supabase.from('orders').select('disbursement_date').eq('id', orderId).single().then((r) => r.data),
  ])
  const chargesByPayoff = Object.fromEntries(
    await Promise.all(payoffs.map(async (p) => [p.id, await listPayoffAdditionalCharges(p.id)] as const))
  )

  return (
    <PayoffCalculationsPanel
      orderId={orderId}
      payoffs={payoffs}
      chargesByPayoff={chargesByPayoff}
      contacts={contacts}
      orderDisbursementDate={order?.disbursement_date ?? null}
    />
  )
}
```

- [ ] **Step 2: Thread the new prop down to `PayoffCalculationCard`**

In `src/components/title/PayoffCalculationsPanel.tsx`, update `PayoffCalculationsPanel`'s props and pass-through (currently lines 425-449):

```typescript
export function PayoffCalculationsPanel({
  orderId,
  payoffs,
  chargesByPayoff,
  contacts,
  orderDisbursementDate,
}: {
  orderId: string
  payoffs: CdfPayoffPayment[]
  chargesByPayoff: Record<string, CdfPayoffAdditionalCharge[]>
  contacts: Contact[]
  orderDisbursementDate: string | null
}) {
  const [isPending, startTransition] = useTransition()
  return (
    <div className="max-w-5xl space-y-6" data-testid="payoff-calculations-panel">
      <div>
        <h2 className="text-lg font-semibold">Payoff Calculations</h2>
        <p className="text-sm text-muted-foreground">
          Each payoff here is the same K. Payoffs and Payments line shown on CDF Page 3 — add, describe, or remove it from
          either screen.
        </p>
      </div>

      {payoffs.map((p) => (
        <PayoffCalculationCard
          key={p.id}
          orderId={orderId}
          payoff={p}
          charges={chargesByPayoff[p.id] ?? []}
          contacts={contacts}
          orderDisbursementDate={orderDisbursementDate}
        />
      ))}
      {payoffs.length === 0 && <p className="text-sm text-muted-foreground">No payoffs yet.</p>}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          startTransition(async () => {
            await addPayoff(orderId)
            refresh()
          })
        }
        disabled={isPending}
      >
        + Add Payoff
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Add controlled state for the From/To dates in `PayoffCalculationCard`**

Update `PayoffCalculationCard`'s signature (currently lines 72-82):

```typescript
function PayoffCalculationCard({
  orderId,
  payoff,
  charges,
  contacts,
  orderDisbursementDate,
}: {
  orderId: string
  payoff: CdfPayoffPayment
  charges: CdfPayoffAdditionalCharge[]
  contacts: Contact[]
  orderDisbursementDate: string | null
}) {
```

Add controlled state right after the existing `method`/`setMethod` line (currently line 85):

```typescript
  const [dateBasisFrom, setDateBasisFrom] = useState(payoff.payoff_date_basis_from ?? '')
  const [dateBasisTo, setDateBasisTo] = useState(payoff.payoff_date_basis_to ?? '')
```

- [ ] **Step 4: Make `handleSave` accept overrides**

Replace the existing `handleSave` (currently lines 92-95):

```typescript
  function handleSave(overrides?: { name: string; value: string }[]) {
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    for (const override of overrides ?? []) {
      formData.set(override.name, override.value)
    }
    save(formData)
  }
```

- [ ] **Step 5: Add the Per Diem field, wire the date-basis auto-fill, and add the live total to the Payoff Amount method**

Replace the entire Payoff Amount method's field grid (currently lines 281-379):

```tsx
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label htmlFor={`payoff-calc-${payoff.id}-payoff_amount`}>Payoff Amount</Label>
              <Input
                id={`payoff-calc-${payoff.id}-payoff_amount`}
                name="payoff_amount"
                type="number"
                step="0.01"
                defaultValue={payoff.payoff_amount ?? ''}
                onBlur={handleSave}
              />
            </div>
            <div>
              <Label htmlFor={`payoff-calc-${payoff.id}-payoff_amount_per_diem`}>Per Diem</Label>
              <Input
                id={`payoff-calc-${payoff.id}-payoff_amount_per_diem`}
                name="per_diem"
                type="number"
                step="0.01"
                defaultValue={payoff.per_diem ?? ''}
                onBlur={handleSave}
              />
            </div>
            <div>
              <Label htmlFor={`payoff-calc-${payoff.id}-interest_to`}>Interest To</Label>
              <Input
                id={`payoff-calc-${payoff.id}-interest_to`}
                name="interest_to"
                type="date"
                defaultValue={payoff.interest_to ?? ''}
                onBlur={handleSave}
              />
            </div>
            <div>
              <Label htmlFor={`payoff-calc-${payoff.id}-per_diem_days_basis`}>Per Diem Based On</Label>
              <select
                id={`payoff-calc-${payoff.id}-per_diem_days_basis`}
                name="per_diem_days_basis"
                defaultValue={payoff.per_diem_days_basis ?? '365'}
                onBlur={handleSave}
                className="block w-full rounded border px-2 py-1 text-sm"
              >
                <option value="365">365 days/year</option>
                <option value="360">360 days/year</option>
              </select>
            </div>
            <div>
              <Label htmlFor={`payoff-calc-${payoff.id}-payoff_expires_on`}>Payoff Expires On</Label>
              <Input
                id={`payoff-calc-${payoff.id}-payoff_expires_on`}
                name="payoff_expires_on"
                type="date"
                defaultValue={payoff.payoff_expires_on ?? ''}
                onBlur={handleSave}
              />
            </div>
            <div>
              <Label htmlFor={`payoff-calc-${payoff.id}-payoff_date_basis`}>Payoff Date Basis</Label>
              <select
                id={`payoff-calc-${payoff.id}-payoff_date_basis`}
                name="payoff_date_basis"
                defaultValue={payoff.payoff_date_basis ?? ''}
                onChange={(e) => {
                  if (e.target.value === 'Disbursement') {
                    const from = payoff.payoff_expires_on ?? ''
                    const to = orderDisbursementDate ?? ''
                    setDateBasisFrom(from)
                    setDateBasisTo(to)
                    handleSave([
                      { name: 'payoff_date_basis', value: e.target.value },
                      { name: 'payoff_date_basis_from', value: from },
                      { name: 'payoff_date_basis_to', value: to },
                    ])
                  } else {
                    handleSave([{ name: 'payoff_date_basis', value: e.target.value }])
                  }
                }}
                className="block w-full rounded border px-2 py-1 text-sm"
              >
                <option value="">—</option>
                {DATE_BASIS_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={`payoff-calc-${payoff.id}-payoff_date_basis_from`}>From</Label>
              <Input
                id={`payoff-calc-${payoff.id}-payoff_date_basis_from`}
                name="payoff_date_basis_from"
                type="date"
                value={dateBasisFrom}
                onChange={(e) => setDateBasisFrom(e.target.value)}
                onBlur={handleSave}
              />
            </div>
            <div>
              <Label htmlFor={`payoff-calc-${payoff.id}-payoff_date_basis_to`}>To</Label>
              <Input
                id={`payoff-calc-${payoff.id}-payoff_date_basis_to`}
                name="payoff_date_basis_to"
                type="date"
                value={dateBasisTo}
                onChange={(e) => setDateBasisTo(e.target.value)}
                onBlur={handleSave}
              />
            </div>
            <div>
              <Label htmlFor={`payoff-calc-${payoff.id}-extra_days`}>Extra Day(s)</Label>
              <Input
                id={`payoff-calc-${payoff.id}-extra_days`}
                name="extra_days"
                type="number"
                step="1"
                defaultValue={payoff.extra_days ?? ''}
                onBlur={handleSave}
              />
            </div>
            {dateBasisFrom && dateBasisTo && (
              <div className="col-span-4 text-sm font-medium">
                {actualDaysBetween(dateBasisFrom, dateBasisTo) + (payoff.extra_days ?? 0)} day(s) — Payoff Amount ={' '}
                <span className="font-mono">
                  $
                  {money(
                    (payoff.payoff_amount ?? 0) +
                      (payoff.per_diem ?? 0) * (actualDaysBetween(dateBasisFrom, dateBasisTo) + (payoff.extra_days ?? 0))
                  )}
                </span>
              </div>
            )}
          </div>
```

(Note: `name="per_diem"` here is the same `cdf_payoffs_payments.per_diem` column the Principal Balance method already writes to — only one of the two methods is ever rendered/submitted at a time per the existing `method === 'principal_balance' ? ... : ...` branch, so there's no collision. The "Payoff Expires On" field moved earlier in the grid, immediately before "Payoff Date Basis," purely so its value is visually adjacent to the dropdown that now reads it — no field was removed.)

- [ ] **Step 6: Run the app locally and sanity-check by eye**

Run: `npm run dev` from `genesis-app/`. On a Refinance order with a Settlement Date set (so Disbursement Date computes on Order Info), add a payoff, switch to Payoff Amount method, set "Payoff Expires On" to some date, then set Payoff Date Basis to "Disbursement".
Expected: From auto-fills to the "Payoff Expires On" date just entered; To auto-fills to the order's Disbursement Date. Entering a Payoff Amount and a Per Diem shows a live total combining both. Manually editing From/To afterward still works and updates the total.

- [ ] **Step 7: Commit**

```bash
git add src/components/title/PayoffCalculationsPanel.tsx src/app/orders/[id]/payoff-calculations/page.tsx
git commit -m "feat: Payoff Amount per-diem/total and Disbursement date-basis auto-fill"
```

---

### Task 6: e2e tests — Disbursement Date engine and Payoff Amount total

**Files:**
- Modify: `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-5.

- [ ] **Step 1: Write the Order Info test**

Add inside the existing `test.describe('Genesis foundation phase', ...)` block:

```typescript
  test('order info: Disbursement Date defaults from Transaction Type and recomputes with the rescission checkboxes', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.getByRole('radio', { name: 'Refinance' }).click()
    await page.getByLabel('Settlement Date').fill('2026-06-01') // a Monday
    await page.getByLabel('Settlement Date').blur()
    await expect(page.getByTestId('save-indicator')).toContainText('Saved')

    await page.goto(`/orders/${orderId}/order-info`)
    await expect(page.getByLabel('Rescission Included with This Order')).toBeChecked()
    await expect(page.getByTestId('disbursement-date-preview')).toContainText('2026-06-05')

    await page.getByLabel('Rescission Included with This Order').click()
    await expect(page.getByTestId('disbursement-date-preview')).toContainText('2026-06-01')
    await expect(page.getByTestId('save-indicator')).toContainText('Saved')

    await page.getByLabel('Settlement Office Location').fill('123 Main St, Suite 4')
    await page.getByLabel('Settlement Office Location').blur()
    await expect(page.getByTestId('save-indicator')).toContainText('Saved')

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByLabel('Rescission Included with This Order')).not.toBeChecked()
    await expect(page.getByTestId('disbursement-date-preview')).toContainText('2026-06-01')
    await expect(page.getByLabel('Settlement Office Location')).toHaveValue('123 Main St, Suite 4')
  })

  test('payoff calculations: Payoff Amount method computes a live total and Disbursement basis auto-fills dates', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.getByRole('radio', { name: 'Refinance' }).click()
    await page.getByLabel('Settlement Date').fill('2026-06-01')
    await page.getByLabel('Settlement Date').blur()
    await expect(page.getByTestId('save-indicator')).toContainText('Saved')

    await page.goto(`/orders/${orderId}/payoff-calculations`)
    await page.getByRole('button', { name: '+ Add Payoff' }).click()
    await page.getByText('Payoff Amount').click()

    // Payoff good through 6/2, but rescission pushes actual disbursement to 6/5 —
    // 3 extra days of per diem accrue between the quote's good-through date and the
    // real disbursement date.
    await page.locator('input[name="payoff_expires_on"]').fill('2026-06-02')
    await page.locator('input[name="payoff_expires_on"]').blur()

    await page.locator('select[name="payoff_date_basis"]').selectOption('Disbursement')
    await expect(page.locator('input[name="payoff_date_basis_from"]')).toHaveValue('2026-06-02')
    await expect(page.locator('input[name="payoff_date_basis_to"]')).toHaveValue('2026-06-05')

    await page.locator('input[name="payoff_amount"]').fill('500')
    await page.locator('input[name="per_diem"]').fill('10')
    await page.locator('input[name="per_diem"]').blur()

    // actualDaysBetween('2026-06-02', '2026-06-05') = 3 days; 500 + 10*3 = $530.00
    await expect(page.getByText('$530.00')).toBeVisible()
  })
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/order-entry.spec.ts -g "Disbursement Date|Payoff Amount method computes"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/order-entry.spec.ts
git commit -m "test: Disbursement Date engine and Payoff Amount live total"
```
