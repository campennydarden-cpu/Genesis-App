---
status: design complete
part-of: Genesis Screen Notes - Fix Plan (vault) — "Order Entry (system-wide) autosave" decision
---

# Order Info Autosave — Design

First screen of a system-wide autosave rollout (per the vault's Fix Plan decision: "hybrid — background autosave AND a save-before-navigate-away guard as a backstop"). Scoped to Order Info only — later screens (Order Entry, Property, Contacts, Prelim Search, Commitment Sch A/B, Curative) get their own pass once this one has shipped and proven the pattern. The one piece built as shared infrastructure now, rather than scoped to this screen alone, is the navigate-away guard — it has to reach shared nav components (`FileSectionsNav`, the order layout's Home/New-Order links), so it can't be built any other way even for a single-screen first pass.

## Why this screen, why now

Two independent motivations converged:

1. **The vault's own decision**, made 2026-09-07, queued as its own design/build pass, not yet built.
2. **A live debugging session** (2026-09-07/08) found a real, unresolved staleness bug: after saving Order Info's Title Status and navigating to `/orders`, the list sometimes shows the pre-save value. Three targeted fixes (`force-dynamic` on `/orders`, disabling a Link's prefetch, `cache: 'no-store'` on the Supabase client) all failed to resolve it, and root-cause tracing stalled at "some caching layer serves a premature snapshot" without pinning down which one. This design removes the exact mechanism implicated — the full-page redirect a `<form action={serverAction}>` submission triggers — for this one screen. It is not a targeted fix for that bug and should not be treated as one; if the bug is still reproducible after this ships, that's expected information, not a regression, and debugging resumes from there with one variable (the redirect) already ruled out.

## Current state (what this replaces)

- `src/app/orders/[id]/order-info/page.tsx` — Server Component. Fetches the order, binds `updateOrderInfo(id, ...)`, renders `<OrderInfoForm action={...} order={...} />`.
- `src/components/OrderInfoForm.tsx` — Server Component. Renders a plain `<form action={action}>` with three shadcn `<Select>`s (Order/Title/Escrow Status, uncontrolled via `defaultValue`) and 8 free-text functional-role `<Input>`s, plus a `<Button type="submit">Save Changes</Button>`.
- `src/app/actions/orders.ts`'s `updateOrderInfo(orderId, formData)` — validates the three statuses against `ORDER_STATUSES`/`TITLE_STATUSES`/`ESCROW_STATUSES`, re-fetches the existing row to decide whether to stamp `title_opened_date`/`escrow_opened_date` for the first time a status leaves "In Progress", writes the update, calls `revalidatePath` twice, and `redirect()`s back to the same URL.

## Architecture

**`OrderInfoForm.tsx` becomes a Client Component.** It needs `onBlur` handlers and local state for the save indicator, which Server Components can't have. The page (`order-info/page.tsx`) stays a Server Component — it still does the initial fetch and passes `order` down as a prop, same as today, just without binding a server action for a `<form action>` (the client component calls the new action directly).

**New action: `saveOrderInfo`** in `src/app/actions/orders.ts`, replacing `updateOrderInfo` (no other caller exists — `order-info/page.tsx` is `updateOrderInfo`'s only importer, confirmed). Same validation, same existing-row re-fetch, same auto-timestamp logic, same update call — the only change is the ending: instead of `redirect(...)`, it returns `{ error?: string }`, matching the pattern Attachments Core already established in this codebase for actions backing an in-page dynamic UI rather than a full-page form.

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

**New shared module: `src/lib/pending-saves.tsx`** — a React Context + hook any autosaving component registers an in-flight save promise against, and any navigation-triggering component can query/await before proceeding.

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

`PendingSaveProvider` mounts once, in `src/app/orders/[id]/layout.tsx`, wrapping everything below the order header (both `FileSectionsNav` and `{children}`) — the natural shared ancestor of every autosaving form and every nav link that needs to respect it. Every other screen's nav links get wrapped by this provider today even though only Order Info has anything to register yet; an empty pending set makes the guard a complete no-op everywhere else, so this is zero behavior change for every other screen.

**Nav link guarding.** `FileSectionsNav`'s `<Link>`s and the order layout's "← Home"/"+ New Order" links each get an `onClick` that checks `hasPending()`; if true, prevent the default navigation, await `waitForPendingSaves()`, then navigate via `router.push(href)`:

```tsx
const router = useRouter()
const { hasPending, waitForPendingSaves } = usePendingSave()

function handleClick(e: React.MouseEvent, href: string) {
  if (!hasPending()) return // let the Link navigate normally
  e.preventDefault()
  waitForPendingSaves().then(() => router.push(href))
}
```

In practice this is invisible almost always — saves are a single small UPDATE, typically resolved well before a user finishes moving their mouse to the next link.

**`OrderInfoForm.tsx` (client component) skeleton:**

```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { saveOrderInfo } from '@/app/actions/orders'
import { usePendingSave } from '@/lib/pending-saves'
// ...existing imports (Select, Input, Label, StatusBadge, constants, types)

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function OrderInfoForm({ orderId, order }: { orderId: string; order: OrderInfoFields }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [isPending, startTransition] = useTransition()
  const { register } = usePendingSave()

  function handleBlur() {
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    setSaveState('saving')
    const promise = startTransitionAsPromise(() => saveOrderInfo(orderId, formData))
    register(promise)
    promise.then((result) => {
      if (result.error) {
        setSaveState('error')
      } else {
        setSaveState('saved')
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000)
      }
    })
  }

  return (
    <form ref={formRef} className="max-w-2xl space-y-4">
      <SaveIndicator state={saveState} />
      {/* same field markup as today, defaultValue-driven, each Select/Input gets onBlur={handleBlur} */}
    </form>
  )
}
```

`startTransitionAsPromise` wraps `startTransition` in a Promise so its resolution can be `register()`ed — needed because `useTransition`'s `startTransition` callback itself doesn't return a Promise the caller can await:

```ts
function startTransitionAsPromise<T>(startTransition: React.TransitionStartFunction, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    startTransition(() => {
      fn().then(resolve, reject)
    })
  })
}
```

Called as `startTransitionAsPromise(startTransition, () => saveOrderInfo(orderId, formData))`.

shadcn's `<Select>` fires its value-change callback (`onValueChange`), not a DOM blur event, when an option is picked — the design uses `onValueChange` for the three status Selects (saving immediately on selection, which is functionally "blur" for a dropdown) and native `onBlur` for the 8 text `<Input>`s.

**`SaveIndicator`** — a small new component, three states: "Saving…" (visible while `isPending`), "Saved" (visible ~2s after a successful save, per the approved UX), nothing on idle, "Couldn't save — {error}" persisting until the next successful save attempt.

## Error handling

A failed save shows "Couldn't save" inline and does **not** revert the field's value or retry automatically (per the approved design — trapping someone over a transient network blip would be worse than a rare lost edit). The pending-save guard still clears when the failed promise settles, so navigation is never blocked by a failure, only by genuine in-flight saves.

## Testing

- Update `tests/e2e/order-entry.spec.ts`'s Order Info coverage: replace "select Searching → click Save Changes → waitForURL" with "select Searching → blur → wait for the Saved indicator" (no more Save Changes button to click).
- New test: start a save, immediately click a File Sections nav link, assert the navigation actually waits (e.g. by asserting the destination page's content doesn't appear until after the save's network call resolves — Playwright's request/response events, or a slight artificial delay in a test-only code path, can make this deterministic rather than timing-dependent).
- New test: force a save failure (e.g. stub the network to fail, or use an intentionally invalid status bypassing the UI) and assert "Couldn't save" appears and navigation is NOT blocked.
- Re-run the full E2E baseline afterward and compare against the known pre-existing failure list (currently 6, tracked in the SDD ledger from the Attachments Core build) — the Order Info staleness test's outcome here is informational for the ongoing debugging thread, not a pass/fail gate for this feature.

## Out of scope

- Every other screen's autosave (Order Entry, Property, Contacts, Prelim Search, Commitment Sch A/B, Curative) — each gets its own pass reusing `pending-saves.tsx` and the pattern proven here.
- Conflict resolution for two people editing the same order simultaneously (this app has no such concept anywhere yet; not introduced here).
- Retry/backoff on save failure (explicitly decided against — see Error handling).
