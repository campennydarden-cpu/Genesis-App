# Order Info Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Order Info's "Save Changes" button with per-field autosave-on-blur, plus a shared navigation guard that waits for in-flight saves before leaving the page.

**Architecture:** `OrderInfoForm.tsx` becomes a Client Component calling a new non-redirecting `saveOrderInfo` action on blur. A new shared `PendingSaveProvider`/`usePendingSave` context (mounted once in the order layout) tracks in-flight saves; nav links check it before navigating.

**Tech Stack:** Next.js 16 / React 19, `@base-ui/react` Select (`onValueChange`), Supabase.

**Spec:** `docs/superpowers/specs/2026-09-08-order-info-autosave-design.md`

## Global Constraints

- No retry/backoff on save failure — a failure shows "Couldn't save" and the guard clears immediately (does not block navigation).
- `saveOrderInfo` replaces `updateOrderInfo` entirely (its only caller is `order-info/page.tsx`, confirmed). Do not keep both.
- The nav guard wraps shared components (`FileSectionsNav`, the order layout's Home/New-Order links) used by every screen — deliberate exception to "scope to Order Info only," since the guard cannot function otherwise. No-op everywhere nothing is registered.
- No new dependencies.

---

### Task 1: Shared pending-save context

**Files:**
- Create: `src/lib/pending-saves.tsx`

**Interfaces:**
- Produces: `PendingSaveProvider({children})`, `usePendingSave(): { register(promise), waitForPendingSaves(): Promise<void>, hasPending(): boolean }` — consumed by Task 4 and Task 5.

- [ ] **Step 1: Write the file**

```tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useRef } from 'react'

type PendingSaveContextValue = {
  register: (promise: Promise<unknown>) => void
  waitForPendingSaves: () => Promise<void>
  hasPending: () => boolean
}

const PendingSaveContext = createContext<PendingSaveContextValue | null>(null)

export function PendingSaveProvider({ children }: { children: React.ReactNode }) {
  const pending = useRef<Set<Promise<unknown>>>(new Set())

  const register = useCallback((promise: Promise<unknown>) => {
    pending.current.add(promise)
    promise.finally(() => pending.current.delete(promise))
  }, [])

  const waitForPendingSaves = useCallback(async () => {
    await Promise.allSettled([...pending.current])
  }, [])

  const hasPending = useCallback(() => pending.current.size > 0, [])

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (pending.current.size > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  return (
    <PendingSaveContext.Provider value={{ register, waitForPendingSaves, hasPending }}>
      {children}
    </PendingSaveContext.Provider>
  )
}

export function usePendingSave(): PendingSaveContextValue {
  const ctx = useContext(PendingSaveContext)
  if (!ctx) throw new Error('usePendingSave must be used within PendingSaveProvider')
  return ctx
}
```

- [ ] **Step 2: `npm run build` clean**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pending-saves.tsx
git commit -m "feat: add shared pending-save context for autosave nav guarding"
```

---

### Task 2: `saveOrderInfo` action

**Files:**
- Modify: `src/app/actions/orders.ts` (replace `updateOrderInfo`)

**Interfaces:**
- Produces: `saveOrderInfo(orderId: string, formData: FormData): Promise<{ error?: string }>` — consumed by Task 4.

- [ ] **Step 1: Read the current `updateOrderInfo` function in full** to confirm what it does before replacing it (validation, existing-row re-fetch, auto-timestamp logic, update call).

- [ ] **Step 2: Replace `updateOrderInfo` with `saveOrderInfo`**

```ts
export async function saveOrderInfo(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const orderStatus = formData.get('order_status') as string
  const titleStatus = formData.get('title_status') as string
  const escrowStatus = formData.get('escrow_status') as string

  if (
    !ORDER_STATUSES.includes(orderStatus as (typeof ORDER_STATUSES)[number]) ||
    !TITLE_STATUSES.includes(titleStatus as (typeof TITLE_STATUSES)[number]) ||
    !ESCROW_STATUSES.includes(escrowStatus as (typeof ESCROW_STATUSES)[number])
  ) {
    return { error: 'Invalid status value. Please choose from the provided options.' }
  }

  const { data: existingOrder, error: fetchError } = await supabase
    .from('orders')
    .select('title_status, title_opened_date, escrow_status, escrow_opened_date')
    .eq('id', orderId)
    .single()

  if (fetchError || !existingOrder) {
    console.error('saveOrderInfo failed to load current order:', fetchError)
    return { error: 'Could not save. Please check your entries and try again.' }
  }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    order_status: orderStatus,
    title_status: titleStatus,
    escrow_status: escrowStatus,
    updated_at: now,
  }

  for (const { key } of FUNCTIONAL_ROLES) {
    update[key] = (formData.get(key) as string) || null
  }

  if (titleStatus !== 'In Progress' && !existingOrder.title_opened_date) {
    update.title_opened_date = now
  }
  if (escrowStatus !== 'In Progress' && !existingOrder.escrow_opened_date) {
    update.escrow_opened_date = now
  }

  const { error } = await supabase.from('orders').update(update).eq('id', orderId)

  if (error) {
    console.error('saveOrderInfo failed:', error)
    return { error: 'Could not save. Please check your entries and try again.' }
  }

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  return {}
}
```

- [ ] **Step 3: Confirm no other file imports `updateOrderInfo`**

```bash
grep -rn "updateOrderInfo" src/
```

Expected: only `order-info/page.tsx` (updated in Task 4). Until Task 4 lands, `npm run build` will fail on that now-dangling import — expected, not a blocker; note it in the task report instead of treating it as a failure.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/orders.ts
git commit -m "feat: replace updateOrderInfo with non-redirecting saveOrderInfo"
```

---

### Task 3: `SaveIndicator` component

**Files:**
- Create: `src/components/SaveIndicator.tsx`

**Interfaces:**
- Produces: `<SaveIndicator state={'idle'|'saving'|'saved'|'error'} errorMessage={string|undefined} />` — consumed by Task 4.

- [ ] **Step 1: Write the file**

```tsx
export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function SaveIndicator({ state, errorMessage }: { state: SaveState; errorMessage?: string }) {
  if (state === 'idle') return null

  return (
    <p
      data-testid="save-indicator"
      className={`text-sm ${state === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
    >
      {state === 'saving' && 'Saving…'}
      {state === 'saved' && 'Saved'}
      {state === 'error' && `Couldn't save${errorMessage ? ` — ${errorMessage}` : ''}`}
    </p>
  )
}
```

- [ ] **Step 2: `npm run build` clean**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SaveIndicator.tsx
git commit -m "feat: add SaveIndicator component"
```

---

### Task 4: `OrderInfoForm` client component + page wiring

**Files:**
- Modify: `src/components/OrderInfoForm.tsx` (full rewrite)
- Modify: `src/app/orders/[id]/order-info/page.tsx`

**Interfaces:**
- Consumes: `saveOrderInfo` (Task 2), `usePendingSave` (Task 1), `SaveIndicator`/`SaveState` (Task 3), `Order` type (`src/lib/types.ts`, unchanged).
- Produces: `<OrderInfoForm orderId={string} order={OrderInfoFields} />` — prop shape changes from today's `{ action, order }`.

- [ ] **Step 1: Read the current `OrderInfoForm.tsx` and `order-info/page.tsx` in full** to preserve every existing field, label, `StatusBadge`, and the opened-date display exactly.

- [ ] **Step 2: Rewrite `src/components/OrderInfoForm.tsx`**

```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { SaveIndicator, type SaveState } from '@/components/SaveIndicator'
import { saveOrderInfo } from '@/app/actions/orders'
import { usePendingSave } from '@/lib/pending-saves'
import { ORDER_STATUSES, TITLE_STATUSES, ESCROW_STATUSES, FUNCTIONAL_ROLES } from '@/lib/constants'
import type { Order } from '@/lib/types'

function formatOpenedDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function startTransitionAsPromise<T>(
  startTransition: (callback: () => void) => void,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    startTransition(() => {
      fn().then(resolve, reject)
    })
  })
}

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
>

export function OrderInfoForm({ orderId, order }: { orderId: string; order: OrderInfoFields }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()
  const { register } = usePendingSave()

  const titleOpenedDate = formatOpenedDate(order.title_opened_date)
  const escrowOpenedDate = formatOpenedDate(order.escrow_opened_date)

  function handleSave() {
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    setSaveState('saving')
    const promise = startTransitionAsPromise(startTransition, () => saveOrderInfo(orderId, formData))
    register(promise)
    promise.then((result) => {
      if (result.error) {
        setErrorMessage(result.error)
        setSaveState('error')
      } else {
        setSaveState('saved')
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000)
      }
    })
  }

  return (
    <form ref={formRef} className="max-w-2xl space-y-4">
      <SaveIndicator state={isPending ? 'saving' : saveState} errorMessage={errorMessage} />
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="order_status">Order Status</Label>
          <StatusBadge status={order.order_status} />
        </div>
        <Select name="order_status" defaultValue={order.order_status} onValueChange={handleSave}>
          <SelectTrigger id="order_status" className="mt-1 w-full">
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="title_status">Title Status</Label>
          <StatusBadge status={order.title_status} />
        </div>
        <Select name="title_status" defaultValue={order.title_status} onValueChange={handleSave}>
          <SelectTrigger id="title_status" className="mt-1 w-full">
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {TITLE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {titleOpenedDate && <p className="mt-1 text-xs text-muted-foreground">Title opened {titleOpenedDate}</p>}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="escrow_status">Escrow Status</Label>
          <StatusBadge status={order.escrow_status} />
        </div>
        <Select name="escrow_status" defaultValue={order.escrow_status} onValueChange={handleSave}>
          <SelectTrigger id="escrow_status" className="mt-1 w-full">
            <SelectValue placeholder="— Select —" />
          </SelectTrigger>
          <SelectContent>
            {ESCROW_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {escrowOpenedDate && <p className="mt-1 text-xs text-muted-foreground">Escrow opened {escrowOpenedDate}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FUNCTIONAL_ROLES.map(({ key, label }) => (
          <div key={key}>
            <Label htmlFor={key}>{label}</Label>
            <Input id={key} name={key} className="mt-1" defaultValue={order[key] ?? undefined} onBlur={handleSave} />
          </div>
        ))}
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Update `src/app/orders/[id]/order-info/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrderInfoForm } from '@/components/OrderInfoForm'

export default async function OrderInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select(
      'order_status, title_status, escrow_status, title_opened_date, escrow_opened_date, title_officer, curative_title_officer, escrow_assistant, escrow_officer, closing_coordinator, funder, recording_specialist, post_closer'
    )
    .eq('id', id)
    .single()

  if (!order) {
    notFound()
  }

  return <OrderInfoForm orderId={id} order={order} />
}
```

Drop the `searchParams`/`?error=` Alert branch — it only ever fired on the old redirect-based failure path, which no longer exists once `saveOrderInfo` stops redirecting.

- [ ] **Step 4: `npm run build` clean**

```bash
npm run build
```

- [ ] **Step 5: Verify manually**

```bash
npm run dev
```

Open an order's Order Info screen, change Title Status, click away — expect "Saving…" then "Saved," value persists on refresh. Change a functional-role text field and tab out — same behavior.

- [ ] **Step 6: Commit**

```bash
git add src/components/OrderInfoForm.tsx "src/app/orders/[id]/order-info/page.tsx"
git commit -m "feat: convert OrderInfoForm to autosave-on-blur client component"
```

---

### Task 5: Nav guard wiring

**Files:**
- Modify: `src/app/orders/[id]/layout.tsx`
- Create: `src/components/OrderLayoutLinks.tsx`
- Modify: `src/components/FileSectionsNav.tsx`

**Interfaces:**
- Consumes: `PendingSaveProvider`, `usePendingSave` (Task 1).

- [ ] **Step 1: Read `src/components/FileSectionsNav.tsx` in full** to find its existing `<Link>` element and current imports before editing.

- [ ] **Step 2: Rewrite `src/app/orders/[id]/layout.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import { FileSectionsNav } from '@/components/FileSectionsNav'
import { OrderToolbar } from '@/components/OrderToolbar'
import { PendingSaveProvider } from '@/lib/pending-saves'
import { OrderLayoutLinks } from '@/components/OrderLayoutLinks'

export default async function OrderLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase.from('orders').select('id, file_number').eq('id', id).single()

  if (!order) {
    notFound()
  }

  return (
    <PendingSaveProvider>
      <div className="flex min-h-screen">
        <nav
          className="w-56 shrink-0 border-r p-4"
          data-testid="file-section-nav"
          aria-label="File sections"
        >
          <FileSectionsNav orderId={id} />
        </nav>

        <main className="flex-1 p-8">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Order {order.file_number}</h1>
            <div className="flex items-center gap-4">
              <OrderLayoutLinks />
              <form action={logout}>
                <button
                  type="submit"
                  className="cursor-pointer text-xs text-muted-foreground transition-colors duration-200 hover:underline"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
          <OrderToolbar orderId={id}>{children}</OrderToolbar>
        </main>
      </div>
    </PendingSaveProvider>
  )
}
```

The `notFound()`-gated Supabase fetch stays server-side, so the layout itself stays a Server Component; the two guarded links move into their own client component (Step 3) since they need `usePendingSave()`/`useRouter()`.

- [ ] **Step 3: Create `src/components/OrderLayoutLinks.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePendingSave } from '@/lib/pending-saves'

export function OrderLayoutLinks() {
  const router = useRouter()
  const { hasPending, waitForPendingSaves } = usePendingSave()

  function guardedNavigate(e: React.MouseEvent, href: string) {
    if (!hasPending()) return
    e.preventDefault()
    waitForPendingSaves().then(() => router.push(href))
  }

  return (
    <>
      <Link
        href="/orders"
        onClick={(e) => guardedNavigate(e, '/orders')}
        className="text-sm text-primary transition-colors duration-200 hover:underline"
      >
        ← Home
      </Link>
      <Link
        href="/orders/new"
        onClick={(e) => guardedNavigate(e, '/orders/new')}
        className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
      >
        + New Order
      </Link>
    </>
  )
}
```

- [ ] **Step 4: Guard `FileSectionsNav`'s link**

Add to its imports:

```tsx
import { useRouter } from 'next/navigation'
import { usePendingSave } from '@/lib/pending-saves'
```

Add inside the component body, alongside its existing `usePathname()` call:

```tsx
const router = useRouter()
const { hasPending, waitForPendingSaves } = usePendingSave()

function guardedNavigate(e: React.MouseEvent, href: string) {
  if (!hasPending()) return
  e.preventDefault()
  waitForPendingSaves().then(() => router.push(href))
}
```

Add one prop to the existing `<Link>` element (`href`/`data-testid`/`aria-current`/`className` all unchanged):

```tsx
onClick={(e) => guardedNavigate(e, href)}
```

- [ ] **Step 5: `npm run build` clean**

```bash
npm run build
```

- [ ] **Step 6: Verify manually**

```bash
npm run dev
```

Confirm normal navigation (nothing pending) is unaffected — click a nav link, it navigates immediately. Full behavioral confirmation of the guard actually delaying a click is Task 6's job.

- [ ] **Step 7: Commit**

```bash
git add "src/app/orders/[id]/layout.tsx" src/components/OrderLayoutLinks.tsx src/components/FileSectionsNav.tsx
git commit -m "feat: guard order nav links against in-flight autosaves"
```

---

### Task 6: Playwright coverage

**Files:**
- Modify: `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: `data-testid="save-indicator"` (Task 3), the running app from Tasks 1-5.

- [ ] **Step 1: Read `tests/e2e/order-entry.spec.ts` in full** to find the existing Order Info save test and its exact selectors/helpers (e.g. `loginAsSeededUser`) before editing.

- [ ] **Step 2: Update the existing Order Info save test**

Replace its "click Save Changes, waitForURL" sequence with:

```ts
    await page.goto(`/orders/${orderId}/order-info`)
    await page.getByLabel('Title Status').click()
    await page.getByRole('option', { name: 'Searching' }).click()
    await expect(page.getByTestId('save-indicator')).toContainText('Saved')
    await expect(page.getByLabel('Title Status')).toContainText('Searching')

    await page.goto('/orders')
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)
    await expect(page.getByTestId('order-list')).toContainText('Searching')
```

- [ ] **Step 3: Add a nav-guard test**

```ts
  test('order info: nav guard waits for an in-flight autosave before navigating', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/order-info`)
    await page.getByLabel('Title Status').click()
    await page.getByRole('option', { name: 'Curative' }).click()
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Contacts' }).click()
    await page.waitForURL('**/contacts')
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible()

    await page.goto(`/orders/${orderId}/order-info`)
    await expect(page.getByLabel('Title Status')).toContainText('Curative')
  })
```

- [ ] **Step 4: Add a save-failure test**

```ts
  test('order info: a failed save shows an inline error and does not block navigation', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/order-info`)
    await page.route('**rest/v1/orders*', (route) => route.abort())
    await page.getByLabel('Title Status').click()
    await page.getByRole('option', { name: 'Searching' }).click()
    await expect(page.getByTestId('save-indicator')).toContainText("Couldn't save")

    await page.unroute('**rest/v1/orders*')
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Contacts' }).click()
    await page.waitForURL('**/contacts')
  })
```

`saveOrderInfo` runs server-side, so `page.route` may not intercept its outbound Supabase call the way it would a client fetch. If this doesn't trigger reliably, fall back to provoking the server action's own validation error instead (e.g. `page.evaluate` to submit a status value not in the allow-list) — either way, what matters is genuinely exercising the `error` state and confirming navigation isn't blocked. Note in the task report which approach worked.

- [ ] **Step 5: Run the new/updated tests**

```bash
npx playwright test tests/e2e/order-entry.spec.ts -g "order info|orders list shows created orders and status edits persist"
```

- [ ] **Step 6: Run the full suite and compare against the known baseline**

```bash
npm run test:e2e
```

Compare against the known pre-existing baseline failures unrelated to Order Info (tracked in the Attachments Core SDD ledger): `navigation shell: sidebar...`, `dashboard queue badges...`, `prelim search: Derivation form...`, `commitment sch A: Chain of Title...`, `curative: finalize...`. Report explicitly whether the *rewritten* Order Info save test passes reliably (run it 2-3 times if borderline) — this is the first real signal on whether removing the redirect flow incidentally fixed the `/orders` staleness bug from the parked debugging thread, even though that isn't this plan's goal.

- [ ] **Step 7: `npm run build` and `npm run lint` clean**

```bash
npm run build
npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/order-entry.spec.ts
git commit -m "test: add Playwright coverage for Order Info autosave and nav guard"
```

## After this plan lands

1. Update the vault's Fix Plan: move Order Info off "queued," note the pattern is proven for future screens.
2. Report Task 6 Step 6's finding on the staleness bug to the user — confirmed fixed, still present, or inconclusive.
3. Resume systematic-debugging on the staleness bug per the user's explicit "and then continue debugging" instruction if still present.
