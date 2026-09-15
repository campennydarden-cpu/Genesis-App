# Genesis App — Foundation Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the real, independently-hosted Genesis rebuild's foundation — auth, a minimal normalized schema, and one working screen (Order Entry, with an embedded Contacts sub-section) — end to end against Supabase, as a vertical-slice proof of the whole stack before any of the prototype's other 26 screens get ported.

**Architecture:** Next.js (App Router, TypeScript) deployed on Vercel; Supabase (Postgres + Auth) as the backend, accessed via `@supabase/ssr` from Next.js Server Actions — no separate API layer. Row Level Security enforces "authenticated M&L staff only," single-tenant, no `agency_id` scoping.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, `@supabase/ssr` + `@supabase/supabase-js`, Playwright (E2E only — no unit-test framework at this scope), Vercel (hosting), Supabase project `hlahrypglnmjjxrdtfkm` (Postgres 17, `us-east-1`).

**Spec:** `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Foundation Phase Design.md`

## Global Constraints

- All file operations happen in the T7 copy (`/Volumes/T7/Claude Code/Genesis Platform/`), never the Desktop backup — per `CLAUDE.md`'s "Location" rule. Re-sync (`rsync -av --delete` T7 → Desktop) and run `.claude/hooks/verify-sync.sh` at the end of the final task.
- New repo lives at `/Volumes/T7/Claude Code/Genesis Platform/genesis-app/`, sibling to `genesis-github-push/` (prototype, untouched throughout) and `M&L Title/` (vault).
- GitHub repo is **private** (unlike the public prototype repo) — this app will eventually hold a path to real SSN/DOB-bearing data even though foundation phase itself starts with zero real records.
- Single-tenant: every Postgres RLS policy is `to authenticated using (true)` — no `agency_id` anywhere.
- No data migration from the prototype's `localStorage` — fresh start, per spec.
- No auto-population/duplicate-file-detection logic (Parcel-from-Address, City/State from Zip, prior-file search) — explicitly deferred, matches spec scope.
- Contacts get real fields (full address model, entity type, SSN/DOB, License/ALTA ID, Mortgagee Clause) but no vesting/POA/Principals-roster complexity, and no in-place edit — add/view/delete only this phase. SSN/DOB stored in plaintext, matching the prototype's existing deliberate "not there yet" call (`MEMORY.md`).
- No signup/invite system beyond a single temporary `/signup` page Cam uses once to create his own first account — not a real staff-invite flow (that's explicitly out of scope, per spec).
- Testing is Playwright E2E only, extending one cumulative spec file (`tests/e2e/order-entry.spec.ts`) task by task — no unit-test framework, per spec.
- Vercel connection is a manual step for Cam (OAuth/dashboard action) — not something to automate via CLI login on his behalf.

## File Structure

```
genesis-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # root layout, Genesis branding in <title>
│   │   ├── page.tsx                    # redirects to /orders
│   │   ├── login/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts              # login, logout
│   │   ├── signup/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts              # signup (temporary, first-account-only)
│   │   ├── orders/
│   │   │   ├── page.tsx                # orders list
│   │   │   ├── new/
│   │   │   │   └── page.tsx            # Order Entry — create
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Order Entry — view/edit + Contacts section
│   │   └── actions/
│   │       ├── orders.ts               # createOrder, updateOrder
│   │       └── contacts.ts             # addContact, deleteContact
│   ├── components/
│   │   ├── OrderForm.tsx
│   │   └── ContactsSection.tsx
│   ├── lib/
│   │   ├── constants.ts                # PRODUCT_TYPES, POLICY_TYPES, status enums, ENTITY_TYPES
│   │   └── supabase/
│   │       ├── client.ts               # browser client
│   │       ├── server.ts               # server client (Server Components/Actions)
│   │       └── middleware.ts           # updateSession() helper
│   └── middleware.ts                   # root middleware, calls updateSession
├── supabase/
│   └── migrations/
│       └── 0001_foundation_schema.sql  # orders + contacts tables, RLS
├── tests/
│   └── e2e/
│       └── order-entry.spec.ts         # one cumulative journey test, extended each task
├── playwright.config.ts
├── .env.example
├── .env.local                          # gitignored — real Supabase URL/anon key
└── (package.json, tsconfig.json, next.config.ts — from create-next-app)
```

---

### Task 1: Scaffold Next.js app, create private GitHub repo, push initial commit

**Files:**
- Create: `genesis-app/` (via `create-next-app`)
- Create: `genesis-app/.gitignore` (from `create-next-app`'s default, already excludes `.env*.local`, `node_modules`, `.next`)

**Interfaces:**
- Produces: a running Next.js dev server (`npm run dev`) at `http://localhost:3000` showing the default Next.js starter page — later tasks replace this.

- [ ] **Step 1: Scaffold the app**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform"
npx create-next-app@latest genesis-app \
  --typescript --eslint --tailwind --app --src-dir \
  --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Verify the scaffold builds and runs**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

Expected: build succeeds with no errors (default starter page compiles cleanly).

- [ ] **Step 3: Create the private GitHub repo**

Use the GitHub MCP tool (ToolSearch for `select:mcp__9d7b20b8-06c9-4d59-bf8a-51e079e86428__create_repository` if not already loaded) to create a new repository:
- `name`: `genesis-app`
- `owner`: `campennydarden-cpu` (or omit to default to the authenticated user — confirm it resolves to `campennydarden-cpu`, the same account that owns `M-L-Title`)
- `private`: `true`
- `description`: `Genesis — M&L Title & Escrow real rebuild (foundation phase: auth, schema, Order Entry)`

- [ ] **Step 4: Push the initial commit**

`create-next-app` already initializes a git repo with an initial commit. Point it at the new remote and push:

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git remote add origin https://github.com/campennydarden-cpu/genesis-app.git
git branch -M main
git push -u origin main
```

Expected: push succeeds; the GitHub repo shows the scaffolded Next.js app on `main`.

- [ ] **Step 5: Commit checkpoint**

(Already committed by `create-next-app` + pushed in Step 4 — no separate commit needed here.)

---

### Task 2: Supabase client/server helpers + session-refresh middleware

**Files:**
- Create: `genesis-app/src/lib/supabase/client.ts`
- Create: `genesis-app/src/lib/supabase/server.ts`
- Create: `genesis-app/src/lib/supabase/middleware.ts`
- Create: `genesis-app/src/middleware.ts`
- Create: `genesis-app/.env.example`
- Create: `genesis-app/.env.local` (gitignored)

**Interfaces:**
- Produces: `createClient()` (browser, from `lib/supabase/client.ts`) — returns a `SupabaseClient`.
- Produces: `createClient()` (server, async, from `lib/supabase/server.ts`) — returns `Promise<SupabaseClient>`, reads/writes cookies via `next/headers`.
- Produces: `updateSession(request: NextRequest)` (from `lib/supabase/middleware.ts`) — returns `Promise<NextResponse>`, refreshes the session and redirects unauthenticated requests (except `/login` and `/signup`) to `/login`.

- [ ] **Step 1: Install Supabase packages**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm install @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Fetch the real Supabase URL and anon key**

Use the Supabase MCP tools:
- `mcp__f2145503-a1fd-410e-a389-c079a07e574e__get_project_url` with `project_id: "hlahrypglnmjjxrdtfkm"`
- `mcp__f2145503-a1fd-410e-a389-c079a07e574e__get_publishable_keys` with `project_id: "hlahrypglnmjjxrdtfkm"`

- [ ] **Step 3: Write env files**

`.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`.env.local` (real values from Step 2 — gitignored by `create-next-app`'s default `.gitignore`, verify `.env*.local` is present in it):

```
NEXT_PUBLIC_SUPABASE_URL=<value from get_project_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<value from get_publishable_keys>
```

- [ ] **Step 4: Write the browser client**

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 5: Write the server client**

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — middleware refreshes the session instead.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 6: Write the middleware session-refresh helper**

`src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const publicPaths = ['/login', '/signup']
  const isPublicPath = publicPaths.some((p) => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 7: Write the root middleware**

`src/middleware.ts`:

```ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 8: Verify the build still succeeds**

```bash
npm run build
```

Expected: succeeds (no route pages depend on the new clients yet, so this just confirms no syntax/type errors).

- [ ] **Step 9: Commit**

```bash
git add .env.example src/lib/supabase src/middleware.ts package.json package-lock.json
git commit -m "feat: add Supabase client/server helpers and session-refresh middleware"
git push
```

---

### Task 3: Database schema — `orders` + `contacts` tables, RLS

**Files:**
- Create: `genesis-app/supabase/migrations/0001_foundation_schema.sql`

**Interfaces:**
- Produces: Postgres tables `public.orders` and `public.contacts` with RLS enabled, policies granting full CRUD to any `authenticated` user. Columns match `src/lib/constants.ts` enums exactly (written in Task 5).

- [ ] **Step 1: Write the migration file**

`supabase/migrations/0001_foundation_schema.sql`:

```sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  file_number text not null unique,
  product_type text not null default 'Purchase' check (product_type in (
    'Purchase', 'Refinance', 'HELOC', 'HELOAN', 'Reverse Mortgage (Refi)',
    'Cash Purchase', 'Reverse Mortgage (Purchase)', 'Tract Search'
  )),
  policy_type text not null default 'None' check (policy_type in (
    'None', 'Owner''s', 'Loan', 'Simultaneous'
  )),
  purchase_price numeric(14,2),
  loan_amount numeric(14,2),
  property_address text,
  parcel_number text,
  property_city text,
  property_county text,
  property_state text,
  property_zip text,
  order_status text not null default 'In Progress' check (order_status in (
    'In Progress', 'Canceled', 'Retain', 'Hold', 'Completed', 'Duplicate'
  )),
  title_status text not null default 'In Progress' check (title_status in (
    'In Progress', 'Searching', 'Exam', 'Curative', 'Cleared for Policy',
    'Policy Issued', 'Policy Remitted', 'Hold - Title Only'
  )),
  escrow_status text not null default 'In Progress' check (escrow_status in (
    'In Progress', 'Balancing', 'Docs Out', 'Canceled', 'Closed'
  )),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  role text not null,
  entity_type text not null default 'Individual' check (entity_type in (
    'Individual', 'LLC', 'Corporation', 'Partnership', 'Trust', 'Estate'
  )),
  name text not null,
  current_address text,
  mailing_address text,
  forwarding_address text,
  phone text,
  email text,
  ssn text,
  dob date,
  license_number text,
  alta_id text,
  mortgagee_clause text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_order_id_idx on public.contacts(order_id);

alter table public.orders enable row level security;
alter table public.contacts enable row level security;

create policy "Authenticated M&L staff can do anything with orders"
  on public.orders
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated M&L staff can do anything with contacts"
  on public.contacts
  for all
  to authenticated
  using (true)
  with check (true);
```

- [ ] **Step 2: Apply the migration**

Use `mcp__f2145503-a1fd-410e-a389-c079a07e574e__apply_migration` with `project_id: "hlahrypglnmjjxrdtfkm"`, `name: "0001_foundation_schema"`, and `query` set to the SQL above.

- [ ] **Step 3: Verify the tables exist**

Use `mcp__f2145503-a1fd-410e-a389-c079a07e574e__list_tables` with `project_id: "hlahrypglnmjjxrdtfkm"`.

Expected: `orders` and `contacts` both appear, with RLS enabled.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add supabase/migrations/0001_foundation_schema.sql
git commit -m "feat: add foundation-phase database schema (orders, contacts) with RLS"
git push
```

---

### Task 4: Auth — signup (temporary), login, logout, protected routes

**Files:**
- Create: `genesis-app/src/app/login/page.tsx`
- Create: `genesis-app/src/app/login/actions.ts`
- Create: `genesis-app/src/app/signup/page.tsx`
- Create: `genesis-app/src/app/signup/actions.ts`
- Create: `genesis-app/src/app/orders/page.tsx` (minimal placeholder for now — full version in Task 7)
- Create: `genesis-app/tests/e2e/order-entry.spec.ts`
- Create: `genesis-app/playwright.config.ts`
- Modify: `genesis-app/package.json` (add `test:e2e` script)

**Interfaces:**
- Produces: `login(formData: FormData)` (server action, `src/app/login/actions.ts`) — signs in, redirects to `/orders` on success or back to `/login?error=...` on failure.
- Produces: `logout()` (server action) — signs out, redirects to `/login`. Imported by `OrdersPage` in Task 7.
- Produces: `signup(formData: FormData)` (server action, `src/app/signup/actions.ts`) — creates an account, redirects to `/login`.
- Consumes: `updateSession` from Task 2 (via root middleware) for the unauthenticated → `/login` redirect.

- [ ] **Step 1: Install Playwright**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

- [ ] **Step 3: Add the `test:e2e` script**

In `package.json`, add to `"scripts"`: `"test:e2e": "playwright test"`.

- [ ] **Step 4: Write the failing E2E test (auth portion)**

`tests/e2e/order-entry.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `genesis-test-${Date.now()}@example.com`
}

const TEST_PASSWORD = 'TestPassword123!'

test.describe('Genesis foundation phase', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/orders')
    await page.waitForURL('**/login**')
    await expect(page.getByRole('heading', { name: 'Genesis — Sign In' })).toBeVisible()
  })

  test('sign up and log in', async ({ page }) => {
    const email = uniqueEmail()

    await page.goto('/signup')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign Up' }).click()

    await page.waitForURL('**/login**')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await page.waitForURL('**/orders')
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

In one terminal: `npm run dev`. In another:

```bash
npx playwright test
```

Expected: FAIL — `/login`, `/signup`, and `/orders` don't exist yet (404s).

- [ ] **Step 6: Write the login page and action**

`src/app/login/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/orders')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
```

`src/app/login/page.tsx`:

```tsx
import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">Genesis — Sign In</h1>
      {message && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">{message}</p>
      )}
      {error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <form action={login} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <button type="submit" className="w-full rounded bg-slate-900 px-4 py-2 text-white">
          Sign In
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Write the signup page and action**

`src/app/signup/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message))
  }

  redirect('/login?message=' + encodeURIComponent('Account created — sign in below.'))
}
```

`src/app/signup/page.tsx`:

```tsx
import { signup } from './actions'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">Genesis — Create Account</h1>
      <p className="mb-4 text-sm text-slate-500">
        Temporary first-run signup — not a real staff-invite flow. See{' '}
        <code>Genesis Rebuild - Foundation Phase Design.md</code> for what&apos;s deferred.
      </p>
      {error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <form action={signup} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <button type="submit" className="w-full rounded bg-slate-900 px-4 py-2 text-white">
          Sign Up
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 8: Write a minimal placeholder `/orders` page**

`src/app/orders/page.tsx` (replaced with the full version in Task 7 — this just needs the `Orders` heading so Step 4's test can pass):

```tsx
export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Orders</h1>
    </div>
  )
}
```

- [ ] **Step 9: Write `src/app/page.tsx`**

```tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/orders')
}
```

- [ ] **Step 10: Update the root layout title**

In `src/app/layout.tsx`, change the `metadata` export to:

```ts
export const metadata: Metadata = {
  title: 'Genesis — M&L Title & Escrow',
  description: 'Genesis title/escrow production platform',
}
```

- [ ] **Step 11: Run the test to verify it passes**

```bash
npx playwright test
```

Expected: PASS — both tests green.

- [ ] **Step 12: Commit**

```bash
git add src/app/login src/app/signup src/app/orders src/app/page.tsx src/app/layout.tsx tests playwright.config.ts package.json package-lock.json
git commit -m "feat: add signup/login/logout and protected-route redirect, first E2E coverage"
git push
```

---

### Task 5: Order Entry — create an order

**Files:**
- Create: `genesis-app/src/lib/constants.ts`
- Create: `genesis-app/src/app/actions/orders.ts`
- Create: `genesis-app/src/components/OrderForm.tsx`
- Create: `genesis-app/src/app/orders/new/page.tsx`
- Create: `genesis-app/src/app/orders/[id]/page.tsx`
- Modify: `genesis-app/src/app/orders/page.tsx` (add "+ New Order" link — full list rendering comes in Task 7)
- Modify: `genesis-app/tests/e2e/order-entry.spec.ts` (extend)

**Interfaces:**
- Produces: `PRODUCT_TYPES`, `POLICY_TYPES`, `ORDER_STATUSES`, `TITLE_STATUSES`, `ESCROW_STATUSES`, `ENTITY_TYPES` (readonly string-tuple consts, `src/lib/constants.ts`) — consumed by `OrderForm.tsx` (this task) and `ContactsSection.tsx` (Task 6).
- Produces: `createOrder(formData: FormData)` (server action) — inserts a row, redirects to `/orders/[id]`.
- Produces: `updateOrder(orderId: string, formData: FormData)` (server action) — signature is `(orderId: string, formData: FormData) => Promise<void>`, meant to be partially applied via `.bind(null, orderId)` before being passed to `<OrderForm action={...}>`. Fully wired to the UI in Task 7 (status fields save correctly starting then); this task only needs the action to exist and compile.
- Produces: `<OrderForm action={...} order?={...}>` (component) — consumed by both `/orders/new` (no `order` prop) and `/orders/[id]` (with `order` prop).
- Consumes: `createClient` from `@/lib/supabase/server` (Task 2).

- [ ] **Step 1: Write `src/lib/constants.ts`**

```ts
export const PRODUCT_TYPES = [
  'Purchase',
  'Refinance',
  'HELOC',
  'HELOAN',
  'Reverse Mortgage (Refi)',
  'Cash Purchase',
  'Reverse Mortgage (Purchase)',
  'Tract Search',
] as const

export const POLICY_TYPES = ['None', "Owner's", 'Loan', 'Simultaneous'] as const

export const ORDER_STATUSES = [
  'In Progress',
  'Canceled',
  'Retain',
  'Hold',
  'Completed',
  'Duplicate',
] as const

export const TITLE_STATUSES = [
  'In Progress',
  'Searching',
  'Exam',
  'Curative',
  'Cleared for Policy',
  'Policy Issued',
  'Policy Remitted',
  'Hold - Title Only',
] as const

export const ESCROW_STATUSES = [
  'In Progress',
  'Balancing',
  'Docs Out',
  'Canceled',
  'Closed',
] as const

export const ENTITY_TYPES = [
  'Individual',
  'LLC',
  'Corporation',
  'Partnership',
  'Trust',
  'Estate',
] as const
```

- [ ] **Step 2: Extend the E2E test (write it failing first)**

Append to `tests/e2e/order-entry.spec.ts`, inside the existing `test.describe` block, after the `'sign up and log in'` test:

```ts
  test('create an order', async ({ page }) => {
    const email = uniqueEmail()

    await page.goto('/signup')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign Up' }).click()
    await page.waitForURL('**/login**')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('**/orders')

    await page.getByRole('link', { name: '+ New Order' }).click()
    await page.waitForURL('**/orders/new')

    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('Purchase Price').fill('250000')
    await page.getByLabel('Property Address').fill('123 Main St')
    await page.getByRole('button', { name: 'Create Order' }).click()

    await page.waitForURL('**/orders/**')
    await expect(page.getByRole('heading', { name: `Order ${fileNumber}` })).toBeVisible()
  })
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx playwright test --grep "create an order"
```

Expected: FAIL — no "+ New Order" link, no `/orders/new` route, no `createOrder` action.

- [ ] **Step 4: Write the `createOrder` and `updateOrder` server actions**

`src/app/actions/orders.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createOrder(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

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

  const { data, error } = await supabase
    .from('orders')
    .insert({
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
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    redirect(`/orders/new?error=${encodeURIComponent(error?.message ?? 'Unknown error')}`)
  }

  revalidatePath('/orders')
  redirect(`/orders/${data.id}`)
}

export async function updateOrder(orderId: string, formData: FormData) {
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
  const orderStatus = formData.get('order_status') as string
  const titleStatus = formData.get('title_status') as string
  const escrowStatus = formData.get('escrow_status') as string

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
      order_status: orderStatus,
      title_status: titleStatus,
      escrow_status: escrowStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (error) {
    redirect(`/orders/${orderId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/orders/${orderId}`)
  redirect(`/orders/${orderId}`)
}
```

- [ ] **Step 5: Write `OrderForm`**

`src/components/OrderForm.tsx`:

```tsx
import {
  PRODUCT_TYPES,
  POLICY_TYPES,
  ORDER_STATUSES,
  TITLE_STATUSES,
  ESCROW_STATUSES,
} from '@/lib/constants'

type Order = {
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

export function OrderForm({
  action,
  order,
}: {
  action: (formData: FormData) => void
  order?: Order
}) {
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="file_number" className="block text-sm font-medium">
          File Number
        </label>
        <input
          id="file_number"
          name="file_number"
          defaultValue={order?.file_number}
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="product_type" className="block text-sm font-medium">
            Product Type
          </label>
          <select
            id="product_type"
            name="product_type"
            defaultValue={order?.product_type ?? 'Purchase'}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="policy_type" className="block text-sm font-medium">
            Policy Type
          </label>
          <select
            id="policy_type"
            name="policy_type"
            defaultValue={order?.policy_type ?? 'None'}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            {POLICY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="purchase_price" className="block text-sm font-medium">
            Purchase Price
          </label>
          <input
            id="purchase_price"
            name="purchase_price"
            type="number"
            step="0.01"
            defaultValue={order?.purchase_price ?? undefined}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="loan_amount" className="block text-sm font-medium">
            Loan Amount
          </label>
          <input
            id="loan_amount"
            name="loan_amount"
            type="number"
            step="0.01"
            defaultValue={order?.loan_amount ?? undefined}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="property_address" className="block text-sm font-medium">
          Property Address
        </label>
        <input
          id="property_address"
          name="property_address"
          defaultValue={order?.property_address ?? undefined}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div>
          <label htmlFor="property_city" className="block text-sm font-medium">
            City
          </label>
          <input
            id="property_city"
            name="property_city"
            defaultValue={order?.property_city ?? undefined}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="property_county" className="block text-sm font-medium">
            County
          </label>
          <input
            id="property_county"
            name="property_county"
            defaultValue={order?.property_county ?? undefined}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="property_state" className="block text-sm font-medium">
            State
          </label>
          <input
            id="property_state"
            name="property_state"
            defaultValue={order?.property_state ?? undefined}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="property_zip" className="block text-sm font-medium">
            Zip
          </label>
          <input
            id="property_zip"
            name="property_zip"
            defaultValue={order?.property_zip ?? undefined}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="parcel_number" className="block text-sm font-medium">
          Parcel Number
        </label>
        <input
          id="parcel_number"
          name="parcel_number"
          defaultValue={order?.parcel_number ?? undefined}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>

      {order && (
        <div className="grid grid-cols-3 gap-4 border-t pt-4">
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
        </div>
      )}

      <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
        {order ? 'Save Changes' : 'Create Order'}
      </button>
    </form>
  )
}
```

- [ ] **Step 6: Write `/orders/new`**

`src/app/orders/new/page.tsx`:

```tsx
import { createOrder } from '@/app/actions/orders'
import { OrderForm } from '@/components/OrderForm'

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">New Order</h1>
      {error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <OrderForm action={createOrder} />
    </div>
  )
}
```

- [ ] **Step 7: Write `/orders/[id]` (view only — edit wiring completes in Task 7)**

`src/app/orders/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateOrder } from '@/app/actions/orders'
import { OrderForm } from '@/components/OrderForm'

export default async function OrderDetailPage({
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

  const updateOrderWithId = updateOrder.bind(null, id)

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Order {order.file_number}</h1>
      {error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <OrderForm action={updateOrderWithId} order={order} />
    </div>
  )
}
```

- [ ] **Step 8: Add the "+ New Order" link to `/orders`**

Replace `src/app/orders/page.tsx` with:

```tsx
import Link from 'next/link'

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Link href="/orders/new" className="rounded bg-slate-900 px-4 py-2 text-white">
          + New Order
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Run the full suite to verify it passes**

```bash
npx playwright test
```

Expected: all 3 tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/constants.ts src/app/actions/orders.ts src/components/OrderForm.tsx src/app/orders tests/e2e/order-entry.spec.ts
git commit -m "feat: add Order Entry create/view (orders table only, no contacts yet)"
git push
```

---

### Task 6: Contacts sub-section (add/remove) on the order detail page

**Files:**
- Create: `genesis-app/src/app/actions/contacts.ts`
- Create: `genesis-app/src/components/ContactsSection.tsx`
- Modify: `genesis-app/src/app/orders/[id]/page.tsx` (render `ContactsSection`)
- Modify: `genesis-app/tests/e2e/order-entry.spec.ts` (extend)

**Interfaces:**
- Produces: `addContact(orderId: string, formData: FormData)` (server action) — signature `(orderId: string, formData: FormData) => Promise<void>`, bound via `.bind(null, orderId)` before use as a form `action`.
- Produces: `deleteContact(orderId: string, contactId: string)` (server action) — signature `(orderId: string, contactId: string) => Promise<void>`, bound via `.bind(null, orderId, contactId)`.
- Produces: `<ContactsSection orderId={string} contacts={Contact[]}>` (component).
- Consumes: `ENTITY_TYPES` from `@/lib/constants` (Task 5).

- [ ] **Step 1: Extend the E2E test (write it failing first)**

Append to the `'create an order'` test in `tests/e2e/order-entry.spec.ts` (before its final closing — i.e., add these lines right after the `expect(page.getByRole('heading', ...)).toBeVisible()` line, still inside that same test):

```ts
    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').fill('Buyer/Borrower')
    await page.getByLabel('Name').fill('Jane Test Buyer')
    await page.getByLabel('Phone').fill('555-0100')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByTestId('contact-row')).toContainText('Jane Test Buyer')
    await expect(page.getByTestId('contact-row')).toContainText('Buyer/Borrower')
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx playwright test --grep "create an order"
```

Expected: FAIL — no "Add a contact" control exists yet.

- [ ] **Step 3: Write the contacts server actions**

`src/app/actions/contacts.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addContact(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const role = formData.get('role') as string
  const entityType = formData.get('entity_type') as string
  const name = formData.get('name') as string
  const currentAddress = formData.get('current_address') as string
  const mailingAddress = formData.get('mailing_address') as string
  const forwardingAddress = formData.get('forwarding_address') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const ssn = formData.get('ssn') as string
  const dob = formData.get('dob') as string
  const licenseNumber = formData.get('license_number') as string
  const altaId = formData.get('alta_id') as string
  const mortgageeClause = formData.get('mortgagee_clause') as string

  await supabase.from('contacts').insert({
    order_id: orderId,
    role,
    entity_type: entityType,
    name,
    current_address: currentAddress || null,
    mailing_address: mailingAddress || null,
    forwarding_address: forwardingAddress || null,
    phone: phone || null,
    email: email || null,
    ssn: ssn || null,
    dob: dob || null,
    license_number: licenseNumber || null,
    alta_id: altaId || null,
    mortgagee_clause: mortgageeClause || null,
  })

  revalidatePath(`/orders/${orderId}`)
}

export async function deleteContact(orderId: string, contactId: string) {
  const supabase = await createClient()
  await supabase.from('contacts').delete().eq('id', contactId)
  revalidatePath(`/orders/${orderId}`)
}
```

- [ ] **Step 4: Write `ContactsSection`**

`src/components/ContactsSection.tsx`:

```tsx
import { ENTITY_TYPES } from '@/lib/constants'
import { addContact, deleteContact } from '@/app/actions/contacts'

type Contact = {
  id: string
  role: string
  entity_type: string
  name: string
  current_address: string | null
  mailing_address: string | null
  forwarding_address: string | null
  phone: string | null
  email: string | null
  ssn: string | null
  dob: string | null
  license_number: string | null
  alta_id: string | null
  mortgagee_clause: string | null
}

export function ContactsSection({
  orderId,
  contacts,
}: {
  orderId: string
  contacts: Contact[]
}) {
  const addContactWithOrderId = addContact.bind(null, orderId)

  return (
    <div className="mt-10 border-t pt-6">
      <h2 className="mb-4 text-xl font-semibold">Contacts</h2>

      <ul className="mb-6 space-y-2" data-testid="contact-list">
        {contacts.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded border p-3"
            data-testid="contact-row"
          >
            <div>
              <p className="font-medium">
                {c.name} <span className="text-slate-500">— {c.role}</span>
              </p>
              <p className="text-sm text-slate-500">
                {c.entity_type}
                {c.phone ? ` · ${c.phone}` : ''}
                {c.email ? ` · ${c.email}` : ''}
              </p>
            </div>
            <form action={deleteContact.bind(null, orderId, c.id)}>
              <button type="submit" className="text-sm text-red-600 hover:underline">
                Remove
              </button>
            </form>
          </li>
        ))}
        {contacts.length === 0 && (
          <p className="text-sm text-slate-500">No contacts added yet.</p>
        )}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add a contact</summary>
        <form action={addContactWithOrderId} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="role" className="block text-sm font-medium">
                Role
              </label>
              <input
                id="role"
                name="role"
                required
                placeholder="e.g. Buyer/Borrower, Seller, Lender"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="entity_type" className="block text-sm font-medium">
                Entity Type
              </label>
              <select
                id="entity_type"
                name="entity_type"
                defaultValue="Individual"
                className="mt-1 w-full rounded border px-3 py-2"
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="current_address" className="block text-sm font-medium">
                Current Address
              </label>
              <input
                id="current_address"
                name="current_address"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="mailing_address" className="block text-sm font-medium">
                Mailing Address
              </label>
              <input
                id="mailing_address"
                name="mailing_address"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="forwarding_address" className="block text-sm font-medium">
                Forwarding Address
              </label>
              <input
                id="forwarding_address"
                name="forwarding_address"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ssn" className="block text-sm font-medium">
                SSN
              </label>
              <input
                id="ssn"
                name="ssn"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="dob" className="block text-sm font-medium">
                Date of Birth
              </label>
              <input
                id="dob"
                name="dob"
                type="date"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="license_number" className="block text-sm font-medium">
                License Number
              </label>
              <input
                id="license_number"
                name="license_number"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="alta_id" className="block text-sm font-medium">
                ALTA ID
              </label>
              <input
                id="alta_id"
                name="alta_id"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="mortgagee_clause" className="block text-sm font-medium">
                Mortgagee Clause
              </label>
              <input
                id="mortgagee_clause"
                name="mortgagee_clause"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
            Add Contact
          </button>
        </form>
      </details>
    </div>
  )
}
```

- [ ] **Step 5: Wire `ContactsSection` into the order detail page**

Modify `src/app/orders/[id]/page.tsx` — add the import and fetch, and render the section below the form:

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateOrder } from '@/app/actions/orders'
import { OrderForm } from '@/components/OrderForm'
import { ContactsSection } from '@/components/ContactsSection'

export default async function OrderDetailPage({
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

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  const updateOrderWithId = updateOrder.bind(null, id)

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Order {order.file_number}</h1>
      {error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <OrderForm action={updateOrderWithId} order={order} />
      <ContactsSection orderId={id} contacts={contacts ?? []} />
    </div>
  )
}
```

- [ ] **Step 6: Run the full suite to verify it passes**

```bash
npx playwright test
```

Expected: all 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/contacts.ts src/components/ContactsSection.tsx src/app/orders/\[id\]/page.tsx tests/e2e/order-entry.spec.ts
git commit -m "feat: add Contacts sub-section (add/remove) to Order Entry"
git push
```

---

### Task 7: Orders list page + order-status edit wiring

**Files:**
- Modify: `genesis-app/src/app/orders/page.tsx` (full list rendering)
- Modify: `genesis-app/tests/e2e/order-entry.spec.ts` (extend)

**Interfaces:**
- Consumes: `logout` from `@/app/login/actions` (Task 4).
- No new exports — this task completes the UI, it doesn't add new interfaces other tasks depend on.

- [ ] **Step 1: Extend the E2E test (write it failing first)**

Add a new test at the end of the `test.describe` block in `tests/e2e/order-entry.spec.ts`:

```ts
  test('orders list shows created orders and status edits persist', async ({ page }) => {
    const email = uniqueEmail()

    await page.goto('/signup')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign Up' }).click()
    await page.waitForURL('**/login**')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('**/orders')

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**')

    // Edit status fields and save
    await page.getByLabel('Title Status').selectOption('Searching')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/orders/**')
    await expect(page.getByLabel('Title Status')).toHaveValue('Searching')

    // Back to the list — the order should appear with its status
    await page.goto('/orders')
    await expect(page.getByTestId('order-list')).toContainText(fileNumber)
    await expect(page.getByTestId('order-list')).toContainText('Searching')

    // Sign out returns to /login
    await page.getByRole('button', { name: 'Sign Out' }).click()
    await page.waitForURL('**/login**')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx playwright test --grep "orders list"
```

Expected: FAIL — `/orders` doesn't render a list or a Sign Out button yet.

- [ ] **Step 3: Write the full orders list page**

Replace `src/app/orders/page.tsx`:

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'

export default async function OrdersPage() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select(
      'id, file_number, product_type, order_status, title_status, escrow_status, created_at'
    )
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <div className="flex items-center gap-4">
          <Link href="/orders/new" className="rounded bg-slate-900 px-4 py-2 text-white">
            + New Order
          </Link>
          <form action={logout}>
            <button type="submit" className="text-sm text-slate-500 hover:underline">
              Sign Out
            </button>
          </form>
        </div>
      </div>

      <ul className="space-y-2" data-testid="order-list">
        {(orders ?? []).map((o) => (
          <li key={o.id} data-testid="order-row">
            <Link
              href={`/orders/${o.id}`}
              className="block rounded border p-4 hover:bg-slate-50"
            >
              <p className="font-medium">{o.file_number}</p>
              <p className="text-sm text-slate-500">
                {o.product_type} · {o.order_status} / {o.title_status} / {o.escrow_status}
              </p>
            </Link>
          </li>
        ))}
        {(orders ?? []).length === 0 && (
          <p className="text-sm text-slate-500">No orders yet.</p>
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run the full suite to verify it passes**

```bash
npx playwright test
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/orders/page.tsx tests/e2e/order-entry.spec.ts
git commit -m "feat: add orders list page with sign-out, complete foundation-phase UI"
git push
```

---

### Task 8: Deploy to Vercel (manual handoff) + final verification + vault sync

**Files:**
- No new files — this task is deployment + verification + housekeeping.

- [ ] **Step 1: Hand off the Vercel connection to Cam**

This step requires Cam's own action — Vercel account OAuth/dashboard login isn't something to automate on his behalf. Tell Cam:

1. Go to vercel.com and sign in (or sign up) using the GitHub account that owns `campennydarden-cpu/genesis-app`.
2. Click "Add New" → "Project" → import the `genesis-app` repository.
3. Before or during the import, add two Environment Variables (from Task 2's `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.
5. Once deployed, copy the preview/production URL and share it back.

- [ ] **Step 2: Re-run the full E2E suite against the deployed URL**

Once Cam provides the URL:

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
PLAYWRIGHT_BASE_URL="<the-vercel-url>" npx playwright test
```

Expected: all 4 tests PASS against the real deployment — confirms the whole stack (Next.js → Vercel → Supabase, auth, RLS) works end to end outside local dev, closing out the "vertical slice proof" goal from the spec.

- [ ] **Step 3: Update the vault**

Add a Genesis Build Log change-log entry (T7 copy, `M&L Title/M&L Title - Obsidian Vault/Genesis Build Log.md`) describing what shipped: repo URL, deployed Vercel URL (if Cam is fine with it going in the vault — ask first, since it may not want to be public even in a private vault note), commit range, and confirmation of the 4/4 passing E2E suite against the live deployment. Update `Open Items & Parking Lot.md` item 4's entry to note the foundation phase is now *built*, not just *decided*.

- [ ] **Step 4: Re-sync T7 → Desktop backup and verify**

```bash
rsync -av --delete "/Volumes/T7/Claude Code/Genesis Platform/" "/Users/campenny/Desktop/Claude Code/Genesis Platform/"
bash "/Volumes/T7/Claude Code/Genesis Platform/.claude/hooks/verify-sync.sh"
```

Expected: `verify-sync.sh` reports T7 repo == Desktop repo == `github/main` for **both** repos now (`genesis-github-push` and the new `genesis-app`), and T7 root == Desktop root byte-for-byte. (Note: `verify-sync.sh` as it exists today only checks `genesis-github-push` — if it doesn't also check `genesis-app`, that's a small follow-up worth flagging to Cam, not something to silently skip.)

---

## Self-Review

**Spec coverage:** Auth (Task 4) ✓, single-tenant RLS (Task 3) ✓, normalized schema (Task 3) ✓, Order Entry screen (Tasks 5, 7) ✓, Contacts with real fields minus vesting (Task 6) ✓, fresh-start data / no migration (never referenced — correctly absent) ✓, Next.js + Vercel + Supabase stack (Tasks 1, 2, 8) ✓, Playwright E2E only (Tasks 4-7, one cumulative spec file) ✓, private new repo (Task 1) ✓.

**Placeholder scan:** No TBD/TODO markers. Vercel deployment is a genuine manual human action (OAuth), not a placeholder — explicitly justified in Global Constraints and Task 8 Step 1.

**Type consistency:** `Order` type (OrderForm.tsx) and `Contact` type (ContactsSection.tsx) match the exact column names/nullability from the Task 3 migration. `updateOrder(orderId, formData)` and `addContact(orderId, formData)` / `deleteContact(orderId, contactId)` signatures are consistent everywhere they're bound and called across Tasks 5-7.
