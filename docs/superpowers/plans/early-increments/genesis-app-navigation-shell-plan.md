# Genesis App — Navigation Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the persistent navigation shell every future `genesis-app` screen lives inside — order-list sidebar, vertical grouped File Sections nav (showing the entire planned structure, greyed where unbuilt), and a horizontal toolbar with four UI-only placeholder tabs — replacing the foundation phase's two bare, chrome-less pages.

**Architecture:** `/orders/[id]` becomes a Next.js layout (`/orders/[id]/layout.tsx`) providing the persistent chrome; Order Entry, Order Info (new — the three status fields split off Order Entry), and Contacts (moved) each become their own route segment underneath it. The vertical nav and toolbar are presentational — no new tables, no new Server Actions beyond splitting the existing order-update action in two.

**Tech Stack:** Same as foundation phase — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, `@supabase/ssr`, Playwright (E2E only, extending the existing `tests/e2e/order-entry.spec.ts`).

**Spec:** `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Navigation Shell Design.md`

## Global Constraints

- All file operations happen in the T7 copy (`/Volumes/T7/Claude Code/Genesis Platform/`), never the Desktop backup — per `CLAUDE.md`'s "Location" rule. Re-sync (`rsync -av --delete` T7 → Desktop) and run `.claude/hooks/verify-sync.sh` at the end of the final task.
- Repo: `/Volumes/T7/Claude Code/Genesis Platform/genesis-app/`, remote `origin` → `https://github.com/campennydarden-cpu/Genesis-App.git`, branch `main`, connected to Vercel (auto-deploys on push) at `https://genesis-app-tau.vercel.app`.
- No new Supabase tables/columns this phase — `orders`/`contacts` schema is unchanged. Only `order_status`/`title_status`/`escrow_status` move to a new form/action; no new fields (Order Received Date, functional-role assignments) — those are out of scope per the spec's Decisions table.
- Toolbar tabs (Requested Tasks, Checklist Tasks, Attachments, File History) are UI-only placeholders this phase — no schema, no data model. Clicking one shows static "Not built yet" content.
- Every planned nav group/item from the spec's "Routing restructure" section renders now, not just what's built — unbuilt items are disabled (no `href`), not dead links, not hidden.
- Testing stays Playwright E2E only, extending the existing cumulative spec file `tests/e2e/order-entry.spec.ts` — no unit-test framework introduced.
- Dev server must be running (`npm run dev`, port 3000) before running `npm run test:e2e` — `playwright.config.ts` has no `webServer` entry, so Playwright won't start it automatically.
- `/orders/page.tsx` (bare, no `[id]`) is explicitly **not** wrapped by the new `[id]/layout.tsx` chrome (the spec scopes the layout to `/orders/[id]`, not `/orders`) — it keeps its current standalone order-list rendering unchanged, satisfying the spec's "still needs *something* to render" note for the no-order-selected case.

## File Structure

```
genesis-app/src/
├── app/
│   ├── actions/
│   │   └── orders.ts                    # MODIFY: split updateOrder → updateOrderEntry + updateOrderInfo
│   └── orders/
│       ├── page.tsx                     # unchanged
│       ├── new/page.tsx                 # unchanged
│       └── [id]/
│           ├── layout.tsx               # NEW: persistent chrome (sidebar + vertical nav + toolbar host)
│           ├── page.tsx                 # MODIFY: becomes a bare redirect to order-entry
│           ├── order-entry/page.tsx     # NEW: OrderForm, minus status fields
│           ├── order-info/page.tsx      # NEW: the 3 status fields
│           └── contacts/page.tsx        # NEW: ContactsSection, moved here
├── components/
│   ├── OrderForm.tsx                    # MODIFY: remove the status-fields block
│   ├── OrderInfoForm.tsx                # NEW: status fields form
│   ├── ContactsSection.tsx              # MODIFY: drop now-redundant top margin/border (was for stacking under OrderForm)
│   ├── FileSectionsNav.tsx              # NEW: vertical grouped nav, built links + greyed placeholders
│   └── OrderToolbar.tsx                 # NEW: client component, 4 placeholder tabs, wraps {children}
└── lib/
    └── types.ts                         # NEW: shared `Order` type (was OrderForm-local)
tests/e2e/order-entry.spec.ts             # MODIFY (Task 1) + EXTEND (Tasks 2, 3)
```

---

### Task 1: Split Order Entry / Order Info, move Contacts to its own route

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/app/orders/[id]/order-entry/page.tsx`
- Create: `src/app/orders/[id]/order-info/page.tsx`
- Create: `src/app/orders/[id]/contacts/page.tsx`
- Create: `src/components/OrderInfoForm.tsx`
- Modify: `src/app/orders/[id]/page.tsx` (becomes a bare redirect)
- Modify: `src/components/OrderForm.tsx` (remove status fields)
- Modify: `src/components/ContactsSection.tsx` (drop `mt-10 border-t pt-6` wrapper — no longer stacked under another section)
- Modify: `src/app/actions/orders.ts` (split `updateOrder`, retarget redirects)
- Modify: `src/app/actions/contacts.ts` (retarget error redirects to the new `/contacts` route)
- Test: `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Produces: `Order` type (`src/lib/types.ts`) — `{ id: string; file_number: string; product_type: string; policy_type: string; purchase_price: number | null; loan_amount: number | null; property_address: string | null; parcel_number: string | null; property_city: string | null; property_county: string | null; property_state: string | null; property_zip: string | null; order_status: string; title_status: string; escrow_status: string }`. Consumed by `OrderForm`, `OrderInfoForm`, and both new page components.
- Produces: `updateOrderEntry(orderId: string, formData: FormData): Promise<void>` and `updateOrderInfo(orderId: string, formData: FormData): Promise<void>` (both in `src/app/actions/orders.ts`) — replace the old `updateOrder`. Consumed by `order-entry/page.tsx` and `order-info/page.tsx` respectively (both bound via `.bind(null, id)`, same pattern as the old `updateOrder`).
- Produces: `OrderInfoForm({ action, order }: { action: (formData: FormData) => void; order: Pick<Order, 'order_status' | 'title_status' | 'escrow_status'> })`.

- [ ] **Step 1: Create the shared `Order` type**

```ts
// src/lib/types.ts
export type Order = {
  id: string
  file_number: string
  product_type: string
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
}
```

- [ ] **Step 2: Strip the status-fields block out of `OrderForm`**

Replace the local `Order` type in `src/components/OrderForm.tsx` with an import from `@/lib/types`, and delete the entire `{order && (...three status <select>s...)}` block (currently lines 186-240) along with the now-unused `ORDER_STATUSES`/`TITLE_STATUSES`/`ESCROW_STATUSES` imports:

```tsx
import { PRODUCT_TYPES, POLICY_TYPES } from '@/lib/constants'
import type { Order } from '@/lib/types'

export function OrderForm({
  action,
  order,
}: {
  action: (formData: FormData) => void
  order?: Order
}) {
  return (
    <form action={action} className="space-y-4">
      {/* ...unchanged: file_number, product_type/policy_type, purchase_price/loan_amount,
          property_address, city/county/state/zip, parcel_number... */}

      <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
        {order ? 'Save Changes' : 'Create Order'}
      </button>
    </form>
  )
}
```

Everything between the opening `<form>` and the final submit `<button>` stays exactly as it is today, minus the deleted status block.

- [ ] **Step 3: Create `OrderInfoForm`**

```tsx
// src/components/OrderInfoForm.tsx
import { ORDER_STATUSES, TITLE_STATUSES, ESCROW_STATUSES } from '@/lib/constants'
import type { Order } from '@/lib/types'

export function OrderInfoForm({
  action,
  order,
}: {
  action: (formData: FormData) => void
  order: Pick<Order, 'order_status' | 'title_status' | 'escrow_status'>
}) {
  return (
    <form action={action} className="max-w-md space-y-4">
      <div>
        <label htmlFor="order_status" className="block text-sm font-medium">
          Order Status
        </label>
        <select
          id="order_status"
          name="order_status"
          defaultValue={order.order_status}
          className="mt-1 w-full rounded border px-3 py-2"
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="title_status" className="block text-sm font-medium">
          Title Status
        </label>
        <select
          id="title_status"
          name="title_status"
          defaultValue={order.title_status}
          className="mt-1 w-full rounded border px-3 py-2"
        >
          {TITLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="escrow_status" className="block text-sm font-medium">
          Escrow Status
        </label>
        <select
          id="escrow_status"
          name="escrow_status"
          defaultValue={order.escrow_status}
          className="mt-1 w-full rounded border px-3 py-2"
        >
          {ESCROW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
        Save Changes
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Split the `updateOrder` action and retarget `createOrder`'s redirect**

In `src/app/actions/orders.ts`, delete `updateOrder` entirely and replace it with two functions. Also change `createOrder`'s final `redirect(\`/orders/${data.id}\`)` to `redirect(\`/orders/${data.id}/order-entry\`)` (skips the extra redirect hop through the now-bare `/orders/[id]` page):

```ts
// still: 'use server' / revalidatePath / redirect / createClient imports unchanged; createOrder unchanged except its final redirect target

export async function updateOrderEntry(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const fileNumber = formData.get('file_number') as string
  const productType = formData.get('product_type') as string
  const policyType = formData.get('policy_type') as string
  const purchasePrice = formData.get('purchase_price') as string
  const loanAmount = formData.get('loan_amount') as string
  const propertyAddress = formData.get('property_address') as string
  const parcelNumber = formData.get('parcel_number') as string
  const propertyCity = formData.get('property_city') as string
  const propertyCounty = formData.get('property_county') as string
  const propertyState = formData.get('property_state') as string
  const propertyZip = formData.get('property_zip') as string

  const { error } = await supabase
    .from('orders')
    .update({
      file_number: fileNumber,
      product_type: productType,
      policy_type: policyType,
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      loan_amount: loanAmount ? Number(loanAmount) : null,
      property_address: propertyAddress || null,
      parcel_number: parcelNumber || null,
      property_city: propertyCity || null,
      property_county: propertyCounty || null,
      property_state: propertyState || null,
      property_zip: propertyZip || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (error) {
    console.error('updateOrderEntry failed:', error)
    redirect(
      `/orders/${orderId}/order-entry?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}`)
  redirect(`/orders/${orderId}/order-entry`)
}

export async function updateOrderInfo(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const orderStatus = formData.get('order_status') as string
  const titleStatus = formData.get('title_status') as string
  const escrowStatus = formData.get('escrow_status') as string

  const { error } = await supabase
    .from('orders')
    .update({
      order_status: orderStatus,
      title_status: titleStatus,
      escrow_status: escrowStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (error) {
    console.error('updateOrderInfo failed:', error)
    redirect(
      `/orders/${orderId}/order-info?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}`)
  redirect(`/orders/${orderId}/order-info`)
}
```

- [ ] **Step 5: Retarget the Contacts actions' error redirects**

In `src/app/actions/contacts.ts`, both `addContact` and `deleteContact` currently redirect failures to `` `/orders/${orderId}?error=...` ``. Change both to `` `/orders/${orderId}/contacts?error=...` `` so a failed contact save/delete lands back on the Contacts page (not the now-bare redirect page).

- [ ] **Step 6: Create the three new route pages**

```tsx
// src/app/orders/[id]/page.tsx — becomes a bare redirect
import { redirect } from 'next/navigation'

export default async function OrderRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/orders/${id}/order-entry`)
}
```

```tsx
// src/app/orders/[id]/order-entry/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateOrderEntry } from '@/app/actions/orders'
import { OrderForm } from '@/components/OrderForm'

export default async function OrderEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('*').eq('id', id).single()

  if (!order) {
    notFound()
  }

  const updateOrderEntryWithId = updateOrderEntry.bind(null, id)

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <OrderForm action={updateOrderEntryWithId} order={order} />
    </div>
  )
}
```

```tsx
// src/app/orders/[id]/order-info/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateOrderInfo } from '@/app/actions/orders'
import { OrderInfoForm } from '@/components/OrderInfoForm'

export default async function OrderInfoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('order_status, title_status, escrow_status')
    .eq('id', id)
    .single()

  if (!order) {
    notFound()
  }

  const updateOrderInfoWithId = updateOrderInfo.bind(null, id)

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <OrderInfoForm action={updateOrderInfoWithId} order={order} />
    </div>
  )
}
```

```tsx
// src/app/orders/[id]/contacts/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactsSection } from '@/components/ContactsSection'

export default async function OrderContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id').eq('id', id).single()

  if (!order) {
    notFound()
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <ContactsSection orderId={id} contacts={contacts ?? []} />
    </div>
  )
}
```

- [ ] **Step 7: Drop the now-redundant wrapper margin on `ContactsSection`**

In `src/components/ContactsSection.tsx`, change the outer `<div className="mt-10 border-t pt-6">` to `<div>` — that spacing existed to separate Contacts from `OrderForm` when both lived on one page; now Contacts is the whole page.

- [ ] **Step 8: Update the two E2E tests that touch the old combined page**

In `tests/e2e/order-entry.spec.ts`, replace the `'create an order with contact add and remove'` and `'orders list shows created orders and status edits persist'` tests. Both now need to navigate to the new routes directly via `page.goto` (the nav UI that will make this clickable doesn't exist until Task 2):

```ts
  test('create an order with contact add and remove', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    await page.waitForURL('**/orders/new')

    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('Purchase Price').fill('250000')
    await page.getByLabel('Property Address').fill('123 Main St')
    await page.getByRole('button', { name: 'Create Order' }).click()

    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/contacts`)
    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').fill('Buyer/Borrower')
    await page.getByLabel('Name').fill('Jane Test Buyer')
    await page.getByLabel('Phone').fill('555-0100')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByTestId('contact-row')).toContainText('Jane Test Buyer')
    await expect(page.getByTestId('contact-row')).toContainText('Buyer/Borrower')

    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('contact-row')).not.toBeVisible()
  })

  test('orders list shows created orders and status edits persist', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/order-info`)
    await page.getByLabel('Title Status').selectOption('Searching')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/order-info')
    await expect(page.getByLabel('Title Status')).toHaveValue('Searching')

    await page.goto('/orders')
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)
    await expect(page.getByTestId('order-list')).toContainText('Searching')

    await page.getByRole('button', { name: 'Sign Out' }).click()
    await page.waitForURL('**/login**')
  })
```

- [ ] **Step 9: Run the full suite and verify**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run dev &
sleep 3
npm run test:e2e
kill %1
```

Expected: all 6 tests PASS (the 4 unaffected tests plus the 2 rewritten ones above).

- [ ] **Step 10: Commit**

```bash
git add src/lib/types.ts src/app/actions/orders.ts src/app/actions/contacts.ts \
  src/app/orders/\[id\]/page.tsx src/app/orders/\[id\]/order-entry/page.tsx \
  src/app/orders/\[id\]/order-info/page.tsx src/app/orders/\[id\]/contacts/page.tsx \
  src/components/OrderForm.tsx src/components/OrderInfoForm.tsx src/components/ContactsSection.tsx \
  tests/e2e/order-entry.spec.ts
git commit -m "feat: split Order Entry/Order Info and move Contacts to their own routes"
```

---

### Task 2: Persistent chrome — order-list sidebar + vertical File Sections nav

**Files:**
- Create: `src/components/FileSectionsNav.tsx`
- Create: `src/app/orders/[id]/layout.tsx`
- Test: `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Produces: `FileSectionsNav({ orderId }: { orderId: string })` — renders the full grouped nav (built links + greyed placeholders). Consumed by `[id]/layout.tsx`.
- Consumes: nothing new from Task 1 beyond the three routes it links to (`order-entry`, `order-info`, `contacts`).

- [ ] **Step 1: Create `FileSectionsNav`**

```tsx
// src/components/FileSectionsNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { label: string; segment?: string }
type NavGroup = { heading: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'General',
    items: [
      { label: 'Order Entry', segment: 'order-entry' },
      { label: 'Order Info', segment: 'order-info' },
      { label: 'Contacts', segment: 'contacts' },
      { label: 'Property' },
    ],
  },
  {
    heading: 'Title',
    items: [
      { label: 'Prelim Title Search' },
      { label: 'Commitment Sch A' },
      { label: 'Commitment Sch B-I/B-II' },
      { label: 'Curative' },
    ],
  },
  {
    heading: 'Document Preparation',
    items: [
      { label: 'Deed' },
      { label: 'Security Instrument' },
      { label: 'Affidavits' },
      { label: 'Power of Attorney' },
      { label: 'Notary Acknowledgement' },
    ],
  },
  {
    heading: 'Escrow / Closing',
    items: [
      { label: 'Settlement Type' },
      { label: 'Options' },
      { label: 'Additional Charges' },
      { label: 'Premiums' },
      { label: 'Endorsements' },
      { label: 'Recording' },
      { label: 'Payoff Calculations' },
      { label: 'Tax/Other Prorations' },
      { label: 'CDF Pages 1-5' },
      { label: 'HUD Pages 1-3' },
    ],
  },
]

export function FileSectionsNav({ orderId }: { orderId: string }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.heading}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.heading}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              if (!item.segment) {
                return (
                  <li key={item.label}>
                    <span
                      data-testid="nav-disabled"
                      className="block cursor-not-allowed rounded p-2 text-sm text-slate-300"
                    >
                      {item.label}
                    </span>
                  </li>
                )
              }

              const href = `/orders/${orderId}/${item.segment}`
              const active = pathname === href

              return (
                <li key={item.label}>
                  <Link
                    href={href}
                    data-testid="nav-link"
                    className={`block rounded p-2 text-sm ${
                      active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `[id]/layout.tsx`**

```tsx
// src/app/orders/[id]/layout.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import { FileSectionsNav } from '@/components/FileSectionsNav'

export default async function OrderLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, file_number')
    .eq('id', id)
    .single()

  if (!order) {
    notFound()
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('id, file_number, product_type, order_status, title_status, escrow_status')
    .order('created_at', { ascending: false })

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r bg-slate-50 p-4" data-testid="order-sidebar">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/orders/new" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
            + New Order
          </Link>
          <form action={logout}>
            <button type="submit" className="text-xs text-slate-500 hover:underline">
              Sign Out
            </button>
          </form>
        </div>
        <ul className="space-y-1">
          {(orders ?? []).map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}/order-entry`}
                data-testid="sidebar-order-row"
                data-order-id={o.id}
                className={`block rounded p-2 text-sm ${
                  o.id === id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                }`}
              >
                <p className="font-medium">{o.file_number}</p>
                <p className={o.id === id ? 'text-slate-300' : 'text-slate-500'}>
                  {o.product_type} · {o.order_status}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <nav className="w-56 shrink-0 border-r p-4" data-testid="file-section-nav">
        <FileSectionsNav orderId={id} />
      </nav>

      <main className="flex-1 p-8">
        <h1 className="mb-4 text-2xl font-semibold">Order {order.file_number}</h1>
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Extend the E2E spec with a navigation-shell test**

Add to `tests/e2e/order-entry.spec.ts`:

```ts
  test('navigation shell: sidebar and vertical nav render and link correctly', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await expect(page.getByTestId('order-sidebar')).toContainText(fileNumber)

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Contacts' }).click()
    await page.waitForURL('**/contacts')
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible()

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Order Info' }).click()
    await page.waitForURL('**/order-info')
    await expect(page.getByLabel('Order Status')).toBeVisible()

    await expect(
      page.getByTestId('file-section-nav').getByTestId('nav-disabled').filter({ hasText: 'Property' })
    ).toBeVisible()
    await expect(
      page.getByTestId('file-section-nav').getByRole('link', { name: 'Property' })
    ).toHaveCount(0)
  })
```

- [ ] **Step 4: Run the full suite and verify**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run dev &
sleep 3
npm run test:e2e
kill %1
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FileSectionsNav.tsx "src/app/orders/[id]/layout.tsx" tests/e2e/order-entry.spec.ts
git commit -m "feat: add persistent order-list sidebar and vertical File Sections nav"
```

---

### Task 3: Horizontal toolbar (Requested Tasks / Checklist / Attachments / File History placeholders)

**Files:**
- Create: `src/components/OrderToolbar.tsx`
- Modify: `src/app/orders/[id]/layout.tsx` (wrap `{children}` in `<OrderToolbar>`)
- Test: `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Produces: `OrderToolbar({ children }: { children: React.ReactNode })` — Client Component. Renders the 4 tab buttons; shows `children` when no tab is active, a "Not built yet" placeholder when one is. Resets to `children` whenever the route (`pathname`) changes, so switching File Sections via the vertical nav always lands back on real content, not a stale placeholder.

- [ ] **Step 1: Create `OrderToolbar`**

```tsx
// src/components/OrderToolbar.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

type ToolbarTab = 'requested-tasks' | 'checklist' | 'attachments' | 'history'

const TOOLBAR_TABS: { key: ToolbarTab; label: string }[] = [
  { key: 'requested-tasks', label: 'Requested Tasks' },
  { key: 'checklist', label: 'Checklist Tasks' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'history', label: 'File History' },
]

export function OrderToolbar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState<ToolbarTab | null>(null)

  useEffect(() => {
    setActiveTab(null)
  }, [pathname])

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b" data-testid="order-toolbar">
        {TOOLBAR_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            data-testid={`toolbar-tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-sm ${
              activeTab === tab.key
                ? 'border-b-2 border-slate-900 font-medium text-slate-900'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab ? (
        <p className="text-sm text-slate-500" data-testid="toolbar-placeholder">
          Not built yet.
        </p>
      ) : (
        children
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the layout**

In `src/app/orders/[id]/layout.tsx`, import `OrderToolbar` and replace the bare `{children}` inside `<main>` with `<OrderToolbar>{children}</OrderToolbar>`:

```tsx
import { OrderToolbar } from '@/components/OrderToolbar'
// ...
      <main className="flex-1 p-8">
        <h1 className="mb-4 text-2xl font-semibold">Order {order.file_number}</h1>
        <OrderToolbar>{children}</OrderToolbar>
      </main>
```

- [ ] **Step 3: Extend the E2E spec with a toolbar test**

Add to `tests/e2e/order-entry.spec.ts`:

```ts
  test('navigation shell: toolbar tabs show placeholder content and reset on nav', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await expect(page.getByLabel('File Number')).toBeVisible()

    await page.getByTestId('toolbar-tab-attachments').click()
    await expect(page.getByTestId('toolbar-placeholder')).toContainText('Not built yet')
    await expect(page.getByLabel('File Number')).not.toBeVisible()

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Order Info' }).click()
    await page.waitForURL('**/order-info')
    await expect(page.getByTestId('toolbar-placeholder')).not.toBeVisible()
    await expect(page.getByLabel('Order Status')).toBeVisible()
  })
```

- [ ] **Step 4: Run the full suite and verify**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run dev &
sleep 3
npm run test:e2e
kill %1
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/OrderToolbar.tsx "src/app/orders/[id]/layout.tsx" tests/e2e/order-entry.spec.ts
git commit -m "feat: add horizontal toolbar with placeholder tabs to the navigation shell"
```

---

### Task 4: Final verification, deploy check, and vault sync

**Files:**
- No new files — build/lint/test verification, deployment smoke check, and housekeeping.

- [ ] **Step 1: Full local verification**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run lint
npm run build
```

Expected: both succeed with no errors (confirms the split types/components/routes all compile cleanly, including the `Pick<Order, ...>` usage in `OrderInfoForm` and the new route segments).

- [ ] **Step 2: Push and confirm the Vercel auto-deploy**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git fetch origin && git status
git push origin main
```

Wait for the Vercel deployment tied to this push to finish (check the Vercel dashboard or `https://genesis-app-tau.vercel.app` directly), then re-run the suite against the live deployment:

```bash
PLAYWRIGHT_BASE_URL="https://genesis-app-tau.vercel.app" npx playwright test
```

Expected: all 8 tests PASS against the live deployment, confirming the navigation shell works end-to-end outside local dev.

- [ ] **Step 3: Update the vault**

In `M&L Title/M&L Title - Obsidian Vault/Genesis Build Log.md`, add a change-log entry for `genesis-app` noting: the navigation shell shipped (sidebar + grouped vertical nav + toolbar placeholders), Order Entry/Order Info/Contacts split into their own routes, commit range for this plan's 3 feature commits, and 8/8 E2E passing both locally and against the live deployment.

In `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Navigation Shell Design.md`, change the frontmatter `status:` from `approved — ready for implementation plan` to `implemented`.

- [ ] **Step 4: Re-sync T7 → Desktop backup and verify**

```bash
rsync -av --delete "/Volumes/T7/Claude Code/Genesis Platform/" "/Users/campenny/Desktop/Claude Code/Genesis Platform/"
bash "/Volumes/T7/Claude Code/Genesis Platform/.claude/hooks/verify-sync.sh"
```

Expected: `verify-sync.sh` reports T7 == Desktop == `github/main` for `genesis-app`, and T7 root == Desktop root byte-for-byte.

---

## Self-Review

**Spec coverage:** Full shell scope — vertical nav + horizontal toolbar, not deferred (Tasks 2, 3) ✓. Entire planned nav structure shown now, greyed where unbuilt (Task 2, `FileSectionsNav`) ✓. Order Entry vs. Contacts split into separate routes (Task 1) ✓. Order Entry vs. Order Info split, matching the prototype's field grouping — only the 3 statuses move, per the Decisions table (Task 1) ✓. Routing restructure exactly as specified (`/orders/[id]/layout.tsx` + 4 route segments + bare-`[id]` redirect) (Task 1) ✓. Toolbar as UI-only placeholders, no schema (Task 3) ✓. `/orders` bare-list edge case addressed via explicit Global Constraint (left unchanged) ✓.

**Placeholder scan:** No TBD/TODO markers. "Not built yet" toolbar content is the spec's own literal placeholder behavior, not an authoring shortcut. Vercel push/deploy-check in Task 4 is a genuine verification step (mirrors the foundation phase's Task 8 Step 2), not a placeholder.

**Type consistency:** `Order` type (`src/lib/types.ts`) matches the foundation-phase migration's columns exactly (`purchase_price`/`loan_amount` as `number | null`, address fields as `string | null`, statuses as `string`). `OrderForm`'s `order?: Order` and `OrderInfoForm`'s `order: Pick<Order, 'order_status' | 'title_status' | 'escrow_status'>` are consistent with what each of the Task 1 pages fetches and passes in (full row for Order Entry, narrowed `select()` for Order Info). `updateOrderEntry(orderId, formData)` / `updateOrderInfo(orderId, formData)` signatures match their `.bind(null, id)` call sites in both new pages. `FileSectionsNav({ orderId })` and `OrderToolbar({ children })` signatures match how `[id]/layout.tsx` calls them in Tasks 2 and 3.
