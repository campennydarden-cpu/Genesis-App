# Sign In & Dashboard Retrofit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrofit Login and the Orders/landing screen against the design system, and rebuild the Orders/landing screen into a real Home dashboard (search, production queues, order list, stubbed Tasks/Firm Analytics cards).

**Architecture:** One shared foundation task wires shadcn/ui and the design-system CSS tokens into `globals.css` (neither exists in `main` yet). Login gets a visual-only swap to shadcn primitives. The Orders page is decomposed into a Server Component (`page.tsx`, fetches `orders` + `contacts`) and a new `'use client'` component (`HomeDashboard`) that owns search text and queue-filter state, built up incrementally: list skeleton, then search, then queues, then placeholder cards.

**Tech Stack:** Next.js 16.3.3 App Router, React 19.2.8, TypeScript, Tailwind v4, shadcn/ui, Supabase (`@supabase/ssr`), Playwright.

**Spec:** `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Sign In & Dashboard Design.md`

## Global Constraints

- Design tokens (exact hex values, from `genesis-app/design-system/MASTER.md`'s Colors table): Primary `#1E3A8A`, On Primary `#FFFFFF`, Secondary `#1E40AF`, On Secondary `#FFFFFF`, Accent `#B45309`, On Accent `#FFFFFF`, Status Pending `#D97706`, Status Cleared `#059669`, Destructive `#DC2626`, On Destructive `#FFFFFF`, Background `#F8FAFC`, Foreground `#0F172A`, Card `#FFFFFF`, Card Foreground `#0F172A`, Muted `#E9EEF5`, Muted Foreground `#475569`, Border `#CBD5E1`, Ring `#1E3A8A`.
- Font: Plus Jakarta Sans, loaded via `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap');` (verbatim from `MASTER.md`).
- shadcn/ui primitives needed across this plan: `button`, `input`, `label`, `card`, `badge`, `alert`.
- Preserve existing `data-testid` values exactly: `order-list`, `order-row` (values unchanged, per spec's Testing section — only surrounding markup changes).
- Single-tenant, single-user scope: no order-assignment/ownership schema changes anywhere in this plan.
- No new tables, no new API routes, no new Server Actions — all filtering is client-side over data already fetched by `page.tsx`.
- Search matches exactly three things: File Number, Property Address, and a contact whose `role` case-insensitively contains "buyer", "borrower", or "seller" (role is free text, substring match only).
- Production Queues group by the existing `TITLE_STATUSES` and `ESCROW_STATUSES` constants (`src/lib/constants.ts`) — no new status values.
- Tasks and Firm Analytics are placeholder cards only — no new table, no port from the prototype, in this plan.

---

### Task 1: Design system foundation — shadcn/ui init + design tokens

_Model: haiku_ (mechanical CLI scaffolding + verbatim token values, no logic)

**Files:**
- Create: `genesis-app/components.json` (via shadcn CLI)
- Create: `genesis-app/src/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `badge.tsx`, `alert.tsx` (via shadcn CLI)
- Modify: `genesis-app/src/app/globals.css`

**Interfaces:**
- Produces: shadcn primitives importable as `@/components/ui/button` (`Button`), `@/components/ui/input` (`Input`), `@/components/ui/label` (`Label`), `@/components/ui/card` (`Card`, `CardHeader`, `CardTitle`, `CardContent`), `@/components/ui/badge` (`Badge`), `@/components/ui/alert` (`Alert`, `AlertDescription`) — every later task in this plan consumes these.
- Produces: CSS custom properties `--color-primary`, `--color-on-primary`, `--color-secondary`, `--color-on-secondary`, `--color-accent`, `--color-on-accent`, `--color-status-pending`, `--color-status-cleared`, `--color-destructive`, `--color-on-destructive`, `--color-background`, `--color-foreground`, `--color-card`, `--color-card-foreground`, `--color-muted`, `--color-muted-foreground`, `--color-border`, `--color-ring` — every later task's Tailwind classes (`bg-primary`, `text-primary`, etc.) rely on these existing under `@theme inline`.

- [ ] **Step 1: Run the shadcn CLI init**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npx shadcn@latest init -d -y
```

Expected: creates `components.json` and `src/lib/utils.ts` (or confirms it exists), adds `tw-animate-css`/`class-variance-authority`/`clsx`/`tailwind-merge` to `package.json`. If the CLI prompts interactively despite `-d -y`, answer: style = New York, base color = Neutral, CSS variables = Yes.

- [ ] **Step 2: Add the required primitives**

```bash
npx shadcn@latest add button input label card badge alert -y
```

Expected: creates the six files listed under Files above, no errors.

- [ ] **Step 3: Add the design-system color tokens to `globals.css`**

Replace the file's `@theme inline` block and add the color tokens under `:root`. Full replacement content for `genesis-app/src/app/globals.css`:

```css
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap');

:root {
  --background: #F8FAFC;
  --foreground: #0F172A;
  --color-primary: #1E3A8A;
  --color-on-primary: #FFFFFF;
  --color-secondary: #1E40AF;
  --color-on-secondary: #FFFFFF;
  --color-accent: #B45309;
  --color-on-accent: #FFFFFF;
  --color-status-pending: #D97706;
  --color-status-cleared: #059669;
  --color-destructive: #DC2626;
  --color-on-destructive: #FFFFFF;
  --color-card: #FFFFFF;
  --color-card-foreground: #0F172A;
  --color-muted: #E9EEF5;
  --color-muted-foreground: #475569;
  --color-border: #CBD5E1;
  --color-ring: #1E3A8A;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: "Plus Jakarta Sans", var(--font-geist-sans), sans-serif;
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: "Plus Jakarta Sans", Arial, Helvetica, sans-serif;
}
```

Note: this drops the `prefers-color-scheme: dark` block that was there before — `MASTER.md`'s Anti-patterns section says light mode is primary and dark mode is a separate, later decision, not scoped here.

- [ ] **Step 4: Verify the build**

```bash
npm run build && npm run lint
```

Expected: both succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add components.json src/lib/utils.ts src/components/ui/ src/app/globals.css package.json package-lock.json
git commit -m "chore: install shadcn/ui and wire Genesis design-system tokens"
```

---

### Task 2: Sign In retrofit

_Model: haiku_ (well-defined markup swap, existing tests already cover the underlying behavior)

**Files:**
- Modify: `genesis-app/src/app/login/page.tsx`

**Interfaces:**
- Consumes: `Card`, `CardHeader`, `CardTitle`, `CardContent` from `@/components/ui/card`; `Input` from `@/components/ui/input`; `Label` from `@/components/ui/label`; `Button` from `@/components/ui/button`; `Alert`, `AlertDescription` from `@/components/ui/alert` (Task 1).
- No new props, no change to `login` (from `./actions`) — same `(formData: FormData) => void` signature already in use.

- [ ] **Step 1: Replace the page's markup**

Full replacement content for `genesis-app/src/app/login/page.tsx`:

```tsx
import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <p className="mb-6 text-center text-2xl font-bold text-primary">Genesis</p>
      <Card>
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          {message && (
            <Alert className="mb-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form action={login} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build**

```bash
npm run build && npm run lint
```

Expected: succeeds.

- [ ] **Step 3: Run the existing e2e auth tests**

```bash
npx playwright test -g "redirects unauthenticated|signup is disabled|log in with the seeded account|bad login shows an error"
```

Expected: all 4 PASS unchanged — `getByLabel('Email')`, `getByLabel('Password')`, `getByRole('button', { name: 'Sign In' })`, and `getByRole('heading', { name: 'Genesis — Sign In' })` all still resolve (shadcn `Label`/`Input` preserve the `htmlFor`/`id` association; `CardTitle` renders as visible text, but note: `CardTitle` does not render an `<h1>` by default — verify the existing test's `getByRole('heading', { name: 'Genesis — Sign In' })` still passes, since the heading text changed to just "Sign In". If it fails, update that one assertion in `tests/e2e/order-entry.spec.ts` to `getByRole('heading', { name: 'Sign In' })` and re-run.)

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx tests/e2e/order-entry.spec.ts
git commit -m "feat: retrofit Sign In screen against Genesis design system"
```

---

### Task 3: Dashboard shell — extract HomeDashboard, wire data fetching

_Model: sonnet_ (component extraction + data-fetching refactor, must not break existing list/tests)

**Files:**
- Create: `genesis-app/src/components/HomeDashboard.tsx`
- Modify: `genesis-app/src/app/orders/page.tsx`

**Interfaces:**
- Produces: `type OrderSummary = { id: string; file_number: string; product_type: string; order_status: string; title_status: string; escrow_status: string; property_address: string | null; created_at: string }` and `type ContactSummary = { order_id: string; role: string; name: string }`, exported from `HomeDashboard.tsx` — Tasks 4 and 5 import both.
- Produces: `export function HomeDashboard({ orders, contacts }: { orders: OrderSummary[]; contacts: ContactSummary[] })` — Task 4 adds search state to this component, Task 5 adds queue state, Task 6 adds the placeholder cards. All three tasks modify this same file's body, not its exported signature.
- Consumes: `Card`, `Badge` from `@/components/ui/card` and `@/components/ui/badge` (Task 1).

- [ ] **Step 1: Create `HomeDashboard.tsx` with the list skeleton**

```tsx
'use client'

export type OrderSummary = {
  id: string
  file_number: string
  product_type: string
  order_status: string
  title_status: string
  escrow_status: string
  property_address: string | null
  created_at: string
}

export type ContactSummary = {
  order_id: string
  role: string
  name: string
}

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function HomeDashboard({
  orders,
  contacts,
}: {
  orders: OrderSummary[]
  contacts: ContactSummary[]
}) {
  void contacts // consumed starting Task 4

  return (
    <div className="space-y-6">
      <ul className="space-y-2" data-testid="order-list">
        {orders.map((o) => (
          <li key={o.id} data-testid="order-row">
            <Link href={`/orders/${o.id}/order-entry`}>
              <Card className="p-4 transition-colors hover:bg-muted">
                <p className="font-medium">{o.file_number}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{o.product_type}</span>
                  <Badge variant="outline">{o.order_status}</Badge>
                  <Badge variant="outline">{o.title_status}</Badge>
                  <Badge variant="outline">{o.escrow_status}</Badge>
                </div>
              </Card>
            </Link>
          </li>
        ))}
        {orders.length === 0 && (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `orders/page.tsx` to fetch and delegate**

Full replacement content for `genesis-app/src/app/orders/page.tsx`:

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import { HomeDashboard } from '@/components/HomeDashboard'
import { Button } from '@/components/ui/button'

export default async function OrdersPage() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select(
      'id, file_number, product_type, order_status, title_status, escrow_status, property_address, created_at'
    )
    .order('created_at', { ascending: false })

  const { data: contacts } = await supabase.from('contacts').select('order_id, role, name')

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Genesis</h1>
        <div className="flex items-center gap-4">
          <Button asChild>
            <Link href="/orders/new">+ New Order</Link>
          </Button>
          <form action={logout}>
            <button type="submit" className="text-sm text-muted-foreground hover:underline">
              Sign Out
            </button>
          </form>
        </div>
      </div>

      <HomeDashboard orders={orders ?? []} contacts={contacts ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Update the existing e2e test's assertions**

In `tests/e2e/order-entry.spec.ts`, the test `'orders list shows created orders and status edits persist'` still uses `getByTestId('order-list')` and expects it to contain the file number and `'Searching'` — both still true with the new markup (Badge renders the status text as visible content). No code change needed to that test; run it to confirm:

```bash
npx playwright test -g "orders list shows created orders and status edits persist"
```

Expected: PASS. If it fails, the most likely cause is `getByRole('heading', { name: 'Orders' })` in the earlier `'log in with the seeded account'` test — the heading text changed from "Orders" to "Genesis" in Step 2 above. Update that one assertion to `getByRole('heading', { name: 'Genesis' })` in `tests/e2e/order-entry.spec.ts` and re-run both tests.

- [ ] **Step 4: Verify the full build**

```bash
npm run build && npm run lint
```

Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/HomeDashboard.tsx src/app/orders/page.tsx tests/e2e/order-entry.spec.ts
git commit -m "refactor: extract HomeDashboard component, fetch contacts alongside orders"
```

---

### Task 4: Search

_Model: sonnet_ (real multi-field matching logic, including cross-table role substring matching)

**Files:**
- Modify: `genesis-app/src/components/HomeDashboard.tsx`
- Modify: `genesis-app/tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: `OrderSummary`, `ContactSummary` (Task 3).
- Produces: internal `matchesSearch(order, contactsByOrder, query)` helper — not exported, only Task 5's filtering logic in the same file composes with it (via the shared `filteredOrders` computation this task introduces).

- [ ] **Step 1: Add search state and filtering to `HomeDashboard.tsx`**

Replace the full content of `genesis-app/src/components/HomeDashboard.tsx`:

```tsx
'use client'

export type OrderSummary = {
  id: string
  file_number: string
  product_type: string
  order_status: string
  title_status: string
  escrow_status: string
  property_address: string | null
  created_at: string
}

export type ContactSummary = {
  order_id: string
  role: string
  name: string
}

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

const PARTY_ROLE_PATTERN = /buyer|borrower|seller/i

function matchesSearch(
  order: OrderSummary,
  contactsByOrder: Map<string, ContactSummary[]>,
  query: string
): boolean {
  if (!query) return true
  const q = query.toLowerCase()

  if (order.file_number.toLowerCase().includes(q)) return true
  if (order.property_address?.toLowerCase().includes(q)) return true

  const contacts = contactsByOrder.get(order.id) ?? []
  return contacts.some(
    (c) => PARTY_ROLE_PATTERN.test(c.role) && c.name.toLowerCase().includes(q)
  )
}

export function HomeDashboard({
  orders,
  contacts,
}: {
  orders: OrderSummary[]
  contacts: ContactSummary[]
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const contactsByOrder = useMemo(() => {
    const map = new Map<string, ContactSummary[]>()
    for (const c of contacts) {
      const existing = map.get(c.order_id)
      if (existing) {
        existing.push(c)
      } else {
        map.set(c.order_id, [c])
      }
    }
    return map
  }, [contacts])

  const filteredOrders = useMemo(
    () => orders.filter((o) => matchesSearch(o, contactsByOrder, searchQuery)),
    [orders, contactsByOrder, searchQuery]
  )

  return (
    <div className="space-y-6">
      <Input
        placeholder="Search by file number, property address, or buyer/seller name"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        data-testid="dashboard-search"
      />

      <ul className="space-y-2" data-testid="order-list">
        {filteredOrders.map((o) => (
          <li key={o.id} data-testid="order-row">
            <Link href={`/orders/${o.id}/order-entry`}>
              <Card className="p-4 transition-colors hover:bg-muted">
                <p className="font-medium">{o.file_number}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{o.product_type}</span>
                  <Badge variant="outline">{o.order_status}</Badge>
                  <Badge variant="outline">{o.title_status}</Badge>
                  <Badge variant="outline">{o.escrow_status}</Badge>
                </div>
              </Card>
            </Link>
          </li>
        ))}
        {filteredOrders.length === 0 && (
          <p className="text-sm text-muted-foreground">No orders match.</p>
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Add e2e coverage for all three search paths**

Add to `tests/e2e/order-entry.spec.ts`, inside the `test.describe` block:

```typescript
  test('dashboard search matches file number, property address, and buyer/seller name', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('Property Address').fill('789 Search Test Ave')
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/contacts`)
    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').fill('Buyer/Borrower')
    await page.getByLabel('Name').fill('Search Test Buyer')
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await expect(page.getByTestId('contact-row')).toContainText('Search Test Buyer')

    await page.goto('/orders')

    await page.getByTestId('dashboard-search').fill(fileNumber)
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)

    await page.getByTestId('dashboard-search').fill('789 Search Test Ave')
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)

    await page.getByTestId('dashboard-search').fill('Search Test Buyer')
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)

    await page.getByTestId('dashboard-search').fill('no-such-order-xyz')
    await expect(page.getByTestId('order-list')).toContainText('No orders match')
  })
```

- [ ] **Step 3: Run the new test and the full suite**

```bash
npx playwright test -g "dashboard search matches"
npx playwright test
```

Expected: new test PASSes; full suite passes with no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/components/HomeDashboard.tsx tests/e2e/order-entry.spec.ts
git commit -m "feat: add dashboard search across file number, address, and buyer/seller name"
```

---

### Task 5: Production Queues

_Model: sonnet_ (grouping/counting logic, toggle-filter state combined with Task 4's search filter)

**Files:**
- Modify: `genesis-app/src/components/HomeDashboard.tsx`
- Modify: `genesis-app/tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: `TITLE_STATUSES`, `ESCROW_STATUSES` from `@/lib/constants` (already exist).
- Produces: internal `QueueFilter = { dimension: 'title' | 'escrow'; status: string } | null` state — local to `HomeDashboard.tsx`, not consumed elsewhere.

- [ ] **Step 1: Add queue state and badges to `HomeDashboard.tsx`**

Replace the full content of `genesis-app/src/components/HomeDashboard.tsx`:

```tsx
'use client'

export type OrderSummary = {
  id: string
  file_number: string
  product_type: string
  order_status: string
  title_status: string
  escrow_status: string
  property_address: string | null
  created_at: string
}

export type ContactSummary = {
  order_id: string
  role: string
  name: string
}

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { TITLE_STATUSES, ESCROW_STATUSES } from '@/lib/constants'

const PARTY_ROLE_PATTERN = /buyer|borrower|seller/i

function matchesSearch(
  order: OrderSummary,
  contactsByOrder: Map<string, ContactSummary[]>,
  query: string
): boolean {
  if (!query) return true
  const q = query.toLowerCase()

  if (order.file_number.toLowerCase().includes(q)) return true
  if (order.property_address?.toLowerCase().includes(q)) return true

  const contacts = contactsByOrder.get(order.id) ?? []
  return contacts.some(
    (c) => PARTY_ROLE_PATTERN.test(c.role) && c.name.toLowerCase().includes(q)
  )
}

type QueueDimension = 'title' | 'escrow'
type QueueFilter = { dimension: QueueDimension; status: string } | null

function matchesQueue(order: OrderSummary, filter: QueueFilter): boolean {
  if (!filter) return true
  return filter.dimension === 'title'
    ? order.title_status === filter.status
    : order.escrow_status === filter.status
}

function QueuePanel({
  heading,
  dimension,
  statuses,
  orders,
  activeFilter,
  onSelect,
}: {
  heading: string
  dimension: QueueDimension
  statuses: readonly string[]
  orders: OrderSummary[]
  activeFilter: QueueFilter
  onSelect: (dimension: QueueDimension, status: string) => void
}) {
  const field = dimension === 'title' ? 'title_status' : 'escrow_status'

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </p>
      <div className="flex flex-wrap gap-2" data-testid={`queue-panel-${dimension}`}>
        {statuses.map((status) => {
          const count = orders.filter((o) => o[field] === status).length
          const active = activeFilter?.dimension === dimension && activeFilter.status === status
          return (
            <button
              key={status}
              type="button"
              data-testid="queue-badge"
              onClick={() => onSelect(dimension, status)}
            >
              <Badge variant={active ? 'default' : 'outline'}>
                {status} ({count})
              </Badge>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function HomeDashboard({
  orders,
  contacts,
}: {
  orders: OrderSummary[]
  contacts: ContactSummary[]
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [queueFilter, setQueueFilter] = useState<QueueFilter>(null)

  const contactsByOrder = useMemo(() => {
    const map = new Map<string, ContactSummary[]>()
    for (const c of contacts) {
      const existing = map.get(c.order_id)
      if (existing) {
        existing.push(c)
      } else {
        map.set(c.order_id, [c])
      }
    }
    return map
  }, [contacts])

  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (o) => matchesQueue(o, queueFilter) && matchesSearch(o, contactsByOrder, searchQuery)
      ),
    [orders, contactsByOrder, searchQuery, queueFilter]
  )

  function handleSelectQueue(dimension: QueueDimension, status: string) {
    setQueueFilter((prev) =>
      prev?.dimension === dimension && prev.status === status ? null : { dimension, status }
    )
  }

  return (
    <div className="space-y-6">
      <Input
        placeholder="Search by file number, property address, or buyer/seller name"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        data-testid="dashboard-search"
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <QueuePanel
          heading="Title"
          dimension="title"
          statuses={TITLE_STATUSES}
          orders={orders}
          activeFilter={queueFilter}
          onSelect={handleSelectQueue}
        />
        <QueuePanel
          heading="Escrow"
          dimension="escrow"
          statuses={ESCROW_STATUSES}
          orders={orders}
          activeFilter={queueFilter}
          onSelect={handleSelectQueue}
        />
      </div>

      <ul className="space-y-2" data-testid="order-list">
        {filteredOrders.map((o) => (
          <li key={o.id} data-testid="order-row">
            <Link href={`/orders/${o.id}/order-entry`}>
              <Card className="p-4 transition-colors hover:bg-muted">
                <p className="font-medium">{o.file_number}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{o.product_type}</span>
                  <Badge variant="outline">{o.order_status}</Badge>
                  <Badge variant="outline">{o.title_status}</Badge>
                  <Badge variant="outline">{o.escrow_status}</Badge>
                </div>
              </Card>
            </Link>
          </li>
        ))}
        {filteredOrders.length === 0 && (
          <p className="text-sm text-muted-foreground">No orders match.</p>
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Add e2e coverage for queue filtering**

Add to `tests/e2e/order-entry.spec.ts`:

```typescript
  test('dashboard queue badges filter the order list and toggle off', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/order-info`)
    await page.getByLabel('Title Status').selectOption('Exam')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/order-info')

    await page.goto('/orders')
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)

    await page
      .getByTestId('queue-panel-title')
      .getByTestId('queue-badge')
      .filter({ hasText: /^Curative/ })
      .click()
    await expect(page.getByTestId('order-list')).not.toContainText(fileNumber)

    await page
      .getByTestId('queue-panel-title')
      .getByTestId('queue-badge')
      .filter({ hasText: /^Curative/ })
      .click()
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)

    await page
      .getByTestId('queue-panel-title')
      .getByTestId('queue-badge')
      .filter({ hasText: /^Exam/ })
      .click()
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)
  })
```

- [ ] **Step 3: Run the new test and the full suite**

```bash
npx playwright test -g "dashboard queue badges"
npx playwright test
```

Expected: new test PASSes; full suite passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/HomeDashboard.tsx tests/e2e/order-entry.spec.ts
git commit -m "feat: add Title/Escrow production queue filtering to dashboard"
```

---

### Task 6: Tasks and Firm Analytics placeholder cards

_Model: haiku_ (simplest remaining piece — two static stub cards, same pattern already used elsewhere)

**Files:**
- Modify: `genesis-app/src/components/HomeDashboard.tsx`
- Modify: `genesis-app/tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: `Card`, `CardHeader`, `CardTitle`, `CardContent` from `@/components/ui/card` (Task 1).
- No new exports — this task only adds JSX to the existing `HomeDashboard` return value.

- [ ] **Step 1: Add the two placeholder cards**

In `genesis-app/src/components/HomeDashboard.tsx`, add `CardHeader` and `CardTitle` to the existing `@/components/ui/card` import (it currently only imports `Card`):

```typescript
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
```

Then add this block immediately after the closing `</div>` of the `grid gap-6 sm:grid-cols-2` queues section and before the `<ul data-testid="order-list">`:

```tsx
      <div className="grid gap-6 sm:grid-cols-2">
        <Card data-testid="dashboard-placeholder-tasks">
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Not built yet.</p>
          </CardContent>
        </Card>
        <Card data-testid="dashboard-placeholder-analytics">
          <CardHeader>
            <CardTitle>Firm Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Not built yet.</p>
          </CardContent>
        </Card>
      </div>
```

- [ ] **Step 2: Add e2e coverage**

Add to `tests/e2e/order-entry.spec.ts`:

```typescript
  test('dashboard shows Tasks and Firm Analytics as placeholders', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto('/orders')

    await expect(page.getByTestId('dashboard-placeholder-tasks')).toContainText('Tasks')
    await expect(page.getByTestId('dashboard-placeholder-tasks')).toContainText('Not built yet')
    await expect(page.getByTestId('dashboard-placeholder-analytics')).toContainText('Firm Analytics')
    await expect(page.getByTestId('dashboard-placeholder-analytics')).toContainText('Not built yet')
  })
```

- [ ] **Step 3: Run the new test and the full suite**

```bash
npx playwright test -g "Tasks and Firm Analytics"
npx playwright test
```

Expected: new test PASSes; full suite passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/HomeDashboard.tsx tests/e2e/order-entry.spec.ts
git commit -m "feat: add Tasks and Firm Analytics placeholder cards to dashboard"
```

---

### Task 7: Full regression, Build Log update, sync

_Model: haiku_ (mechanical wrap-up — verification commands, doc updates, merge/push)

**Files:**
- Modify: `M&L Title/M&L Title - Obsidian Vault/Genesis Build Log.md`
- Modify: `M&L Title/M&L Title - Obsidian Vault/Welcome.md`

**Interfaces:**
- None — this task consumes nothing new and produces no code interfaces, only verification and documentation.

- [ ] **Step 1: Full regression**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm install
npm run build
npm run lint
npx playwright test
```

Expected: clean install, build succeeds, lint clean, full suite passes (baseline 10 tests plus the 3 new ones from Tasks 4-6 = 13).

- [ ] **Step 2: Update the Build Log**

Add a new dated entry to `M&L Title/M&L Title - Obsidian Vault/Genesis Build Log.md`'s change log, under today's date, summarizing: shadcn/ui + design-system tokens now live in `main`; Sign In retrofitted; `/orders` rebuilt into a Home dashboard (search across file number/address/buyer-seller name, Title and Escrow production queues, Tasks and Firm Analytics as stubbed placeholder cards); full suite passing at the new count.

- [ ] **Step 3: Update `Welcome.md`**

Change the `[[Genesis Rebuild - Sign In & Dashboard Design]]` bullet's status from "Design complete 2026-08-30, pending implementation plan" to "**Built and deployed** — see [[Genesis Build Log]]." (matching the phrasing used for every other shipped increment).

- [ ] **Step 4: Merge to main and deploy**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git checkout main
git merge sign-in-dashboard --no-ff -m "Merge Sign In & Dashboard retrofit"
git push github main:main
```

Expected: merge succeeds with no conflicts (this branch is the only one touching these files); push succeeds; Vercel picks up the push and redeploys `genesis-app-tau.vercel.app` automatically.

- [ ] **Step 5: Commit the vault updates**

Vault files aren't part of the `genesis-app` git repo — these are plain file edits, not a git commit. After Step 3's edits are saved, this task is complete.
