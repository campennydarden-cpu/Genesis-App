# Genesis App — Property Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Property File Section — the last unbuilt item in the General nav group — with 3 sub-tabs (Identification, Legal Description, Plat & Survey Matters), pre-filling from Order Entry, and a repeatable Access/Easements/ROW list.

**Architecture:** New `property_details` table (1:1 with `orders`) plus `property_easements` (1:many with `property_details`), matching the `orders`/`contacts` pattern already established. One route (`/orders/[id]/property`) with a client-side tab switcher inside one form — same single-form-per-File-Section pattern as Order Entry/Order Info.

**Tech Stack:** Same as prior increments — Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, `@supabase/ssr`, Playwright E2E extending `tests/e2e/order-entry.spec.ts`. Supabase project `hlahrypglnmjjxrdtfkm`.

**Spec:** `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Property Screen Design.md`

## Global Constraints

- All file operations happen in the T7 copy (`/Volumes/T7/Claude Code/Genesis Platform/`), never the Desktop backup.
- Repo: `/Volumes/T7/Claude Code/Genesis Platform/genesis-app/`, remote `origin` → `https://github.com/campennydarden-cpu/Genesis-App.git`, branch `main`, Vercel auto-deploys on push, live at `https://genesis-app-tau.vercel.app`.
- Pre-fill source columns on `orders` are `property_city`, `property_county`, `property_state`, `property_zip`, `parcel_number` (already exist, foundation-phase schema) — Property's own `city`/`county`/`state`/`zip`/`parcel_number` pre-fill from these once, non-destructively, only when no `property_details` row exists yet for the order.
- Access/Easements/ROW is add/remove only, no in-place edit — matches Contacts' existing pattern.
- Derivation Clause is explicitly out of scope this round (Prelim Title Search/Derivation isn't built).
- Testing stays Playwright E2E only, extending the existing cumulative spec file — no unit-test framework introduced.
- Dev server must be running (`npm run dev`, no `webServer` entry in `playwright.config.ts`) before `npm run test:e2e`.

## Value lists (exact, verbatim — used in constants, schema CHECK constraints, and form `<select>`s)

**Use Type:** `1-4 Family`, `Single Family`, `PUD`, `Condominium`, `Cooperative`, `Mobile/Manufactured Housing`, `Vacant Land`, `Unimproved Land`, `Ag Land`, `Commercial Property`, `Mixed Use`

**Parcel Number Type:** `Parcel ID`, `APN`, `Tax Map Number (TMS)`, `PIN`, `Folio Number`, `Account Number`, `Other`

**Easement Type:** `Utility Easement`, `Ingress/Egress Easement`, `Drainage Easement`, `Right of Way (ROW) Dedication`, `Shared Driveway Easement`, `Access Easement`, `Pipeline/Transmission Easement`, `Conservation Easement`, `Party Wall Agreement`, `Other`

## File Structure

```
genesis-app/
├── supabase/migrations/
│   └── 0002_property_details.sql        # NEW
├── src/
│   ├── lib/
│   │   ├── constants.ts                 # MODIFY: + USE_TYPES, PARCEL_NUMBER_TYPES, EASEMENT_TYPES
│   │   └── types.ts                     # MODIFY: + PropertyDetails, PropertyEasement
│   ├── app/
│   │   ├── actions/
│   │   │   └── property.ts              # NEW: upsertPropertyDetails, addEasement, deleteEasement
│   │   └── orders/[id]/
│   │       └── property/page.tsx        # NEW
│   └── components/
│       ├── FileSectionsNav.tsx          # MODIFY: Property gains segment: 'property'
│       └── PropertyForm.tsx             # NEW
└── tests/e2e/order-entry.spec.ts        # MODIFY: + property test
```

---

### Task 1: Schema — `property_details` + `property_easements`

**Files:**
- Create: `supabase/migrations/0002_property_details.sql`

**Interfaces:**
- Produces: `property_details` table (columns below) and `property_easements` table, both RLS-enabled `to authenticated using (true)`, matching `orders`/`contacts`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0002_property_details.sql
create table public.property_details (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  house_number text,
  street_name text,
  street_suffix text,
  directional text,
  city text,
  county text,
  state text,
  zip text,
  section_township_range text,
  brief_legal text,
  lot text,
  block text,
  subdivision_tract text,
  use_type text check (use_type in (
    '1-4 Family', 'Single Family', 'PUD', 'Condominium', 'Cooperative',
    'Mobile/Manufactured Housing', 'Vacant Land', 'Unimproved Land',
    'Ag Land', 'Commercial Property', 'Mixed Use'
  )),
  full_legal_description text,
  parcel_number text,
  parcel_number_type text check (parcel_number_type in (
    'Parcel ID', 'APN', 'Tax Map Number (TMS)', 'PIN', 'Folio Number', 'Account Number', 'Other'
  )),
  ccrs_dated date,
  ccrs_book text,
  ccrs_page text,
  ccrs_instrument_number text,
  ccrs_notes text,
  plat_survey_reference text,
  setback_front text,
  setback_side text,
  setback_side_street text,
  setback_rear text,
  lot_dimension_frontage text,
  lot_dimension_depth text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_easements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property_details(id) on delete cascade,
  type text not null check (type in (
    'Utility Easement', 'Ingress/Egress Easement', 'Drainage Easement',
    'Right of Way (ROW) Dedication', 'Shared Driveway Easement', 'Access Easement',
    'Pipeline/Transmission Easement', 'Conservation Easement', 'Party Wall Agreement', 'Other'
  )),
  other_type_text text,
  description text,
  created_at timestamptz not null default now()
);

create index property_easements_property_id_idx on public.property_easements(property_id);

alter table public.property_details enable row level security;
alter table public.property_easements enable row level security;

create policy "Authenticated M&L staff can do anything with property_details"
  on public.property_details
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated M&L staff can do anything with property_easements"
  on public.property_easements
  for all
  to authenticated
  using (true)
  with check (true);
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP tool (ToolSearch for `select:mcp__f2145503-a1fd-410e-a389-c079a07e574e__apply_migration` if not already loaded) against project `hlahrypglnmjjxrdtfkm`, with `name: "property_details"` and the SQL above as `query`.

Expected: migration applies with no errors.

- [ ] **Step 3: Verify**

Use the Supabase MCP `list_tables` tool (project `hlahrypglnmjjxrdtfkm`, schema `public`) and confirm both `property_details` and `property_easements` appear with RLS enabled.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add supabase/migrations/0002_property_details.sql
git commit -m "feat: add property_details and property_easements schema"
```

---

### Task 2: Constants, types, and Server Actions

**Files:**
- Modify: `src/lib/constants.ts` (append)
- Modify: `src/lib/types.ts` (append)
- Create: `src/app/actions/property.ts`

**Interfaces:**
- Produces: `USE_TYPES`, `PARCEL_NUMBER_TYPES`, `EASEMENT_TYPES` (readonly string-tuple constants).
- Produces: `PropertyDetails` type (all `property_details` columns except `created_at`/`updated_at`, all nullable except `id`/`order_id`) and `PropertyEasement` type (`id`, `property_id`, `type`, `other_type_text: string | null`, `description: string | null`).
- Produces: `upsertPropertyDetails(orderId: string, formData: FormData): Promise<void>`, `addEasement(propertyId: string, orderId: string, formData: FormData): Promise<void>`, `deleteEasement(orderId: string, easementId: string): Promise<void>`. Consumed by Task 3's page and form via `.bind()`, same pattern as `updateOrderEntry`/`addContact`/`deleteContact`.

- [ ] **Step 1: Append the 3 value-list constants**

```ts
// append to src/lib/constants.ts

export const USE_TYPES = [
  '1-4 Family',
  'Single Family',
  'PUD',
  'Condominium',
  'Cooperative',
  'Mobile/Manufactured Housing',
  'Vacant Land',
  'Unimproved Land',
  'Ag Land',
  'Commercial Property',
  'Mixed Use',
] as const

export const PARCEL_NUMBER_TYPES = [
  'Parcel ID',
  'APN',
  'Tax Map Number (TMS)',
  'PIN',
  'Folio Number',
  'Account Number',
  'Other',
] as const

export const EASEMENT_TYPES = [
  'Utility Easement',
  'Ingress/Egress Easement',
  'Drainage Easement',
  'Right of Way (ROW) Dedication',
  'Shared Driveway Easement',
  'Access Easement',
  'Pipeline/Transmission Easement',
  'Conservation Easement',
  'Party Wall Agreement',
  'Other',
] as const
```

- [ ] **Step 2: Append the two types**

```ts
// append to src/lib/types.ts

export type PropertyDetails = {
  id: string
  order_id: string
  house_number: string | null
  street_name: string | null
  street_suffix: string | null
  directional: string | null
  city: string | null
  county: string | null
  state: string | null
  zip: string | null
  section_township_range: string | null
  brief_legal: string | null
  lot: string | null
  block: string | null
  subdivision_tract: string | null
  use_type: string | null
  full_legal_description: string | null
  parcel_number: string | null
  parcel_number_type: string | null
  ccrs_dated: string | null
  ccrs_book: string | null
  ccrs_page: string | null
  ccrs_instrument_number: string | null
  ccrs_notes: string | null
  plat_survey_reference: string | null
  setback_front: string | null
  setback_side: string | null
  setback_side_street: string | null
  setback_rear: string | null
  lot_dimension_frontage: string | null
  lot_dimension_depth: string | null
}

export type PropertyEasement = {
  id: string
  property_id: string
  type: string
  other_type_text: string | null
  description: string | null
}
```

- [ ] **Step 3: Create the server actions**

```ts
// src/app/actions/property.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function upsertPropertyDetails(orderId: string, formData: FormData) {
  const supabase = await createClient()

  const field = (name: string) => (formData.get(name) as string) || null

  const { error } = await supabase.from('property_details').upsert(
    {
      order_id: orderId,
      house_number: field('house_number'),
      street_name: field('street_name'),
      street_suffix: field('street_suffix'),
      directional: field('directional'),
      city: field('city'),
      county: field('county'),
      state: field('state'),
      zip: field('zip'),
      section_township_range: field('section_township_range'),
      brief_legal: field('brief_legal'),
      lot: field('lot'),
      block: field('block'),
      subdivision_tract: field('subdivision_tract'),
      use_type: field('use_type'),
      full_legal_description: field('full_legal_description'),
      parcel_number: field('parcel_number'),
      parcel_number_type: field('parcel_number_type'),
      ccrs_dated: field('ccrs_dated'),
      ccrs_book: field('ccrs_book'),
      ccrs_page: field('ccrs_page'),
      ccrs_instrument_number: field('ccrs_instrument_number'),
      ccrs_notes: field('ccrs_notes'),
      plat_survey_reference: field('plat_survey_reference'),
      setback_front: field('setback_front'),
      setback_side: field('setback_side'),
      setback_side_street: field('setback_side_street'),
      setback_rear: field('setback_rear'),
      lot_dimension_frontage: field('lot_dimension_frontage'),
      lot_dimension_depth: field('lot_dimension_depth'),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  )

  if (error) {
    console.error('upsertPropertyDetails failed:', error)
    redirect(
      `/orders/${orderId}/property?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/property`)
  redirect(`/orders/${orderId}/property`)
}

export async function addEasement(propertyId: string, orderId: string, formData: FormData) {
  const supabase = await createClient()

  const type = formData.get('type') as string
  const otherTypeText = formData.get('other_type_text') as string
  const description = formData.get('description') as string

  const { error } = await supabase.from('property_easements').insert({
    property_id: propertyId,
    type,
    other_type_text: type === 'Other' ? otherTypeText || null : null,
    description: description || null,
  })

  if (error) {
    console.error('addEasement failed:', error)
    redirect(
      `/orders/${orderId}/property?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/property`)
}

export async function deleteEasement(orderId: string, easementId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('property_easements').delete().eq('id', easementId)

  if (error) {
    console.error('deleteEasement failed:', error)
    redirect(
      `/orders/${orderId}/property?error=${encodeURIComponent('Could not save. Please check your entries and try again.')}`
    )
  }

  revalidatePath(`/orders/${orderId}/property`)
}
```

- [ ] **Step 4: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

Expected: succeeds — confirms the new types/constants/actions are internally consistent (no consumers exist yet, so this only checks the new files compile).

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.ts src/lib/types.ts src/app/actions/property.ts
git commit -m "feat: add Property constants, types, and server actions"
```

---

### Task 3: PropertyForm, route page, and nav wiring

**Files:**
- Create: `src/app/orders/[id]/property/page.tsx`
- Create: `src/components/PropertyForm.tsx`
- Modify: `src/components/FileSectionsNav.tsx` (Property item gains `segment: 'property'`)
- Test: `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: `upsertPropertyDetails`, `addEasement`, `deleteEasement` (Task 2), `USE_TYPES`/`PARCEL_NUMBER_TYPES`/`EASEMENT_TYPES` (Task 2), `PropertyDetails`/`PropertyEasement` (Task 2).
- Produces: `PropertyForm({ action, orderId, property, orderDefaults, easements })` — Client Component. `orderDefaults: { city, county, state, zip, parcel_number: string | null }`.

- [ ] **Step 1: Wire the nav item**

In `src/components/FileSectionsNav.tsx`, change:

```tsx
{ label: 'Property' },
```

to:

```tsx
{ label: 'Property', segment: 'property' },
```

- [ ] **Step 2: Create `PropertyForm`**

```tsx
// src/components/PropertyForm.tsx
'use client'

import { useState } from 'react'
import { USE_TYPES, PARCEL_NUMBER_TYPES, EASEMENT_TYPES } from '@/lib/constants'
import { addEasement, deleteEasement } from '@/app/actions/property'
import type { PropertyDetails, PropertyEasement } from '@/lib/types'

type Tab = 'identification' | 'legal' | 'survey'

type OrderDefaults = {
  city: string | null
  county: string | null
  state: string | null
  zip: string | null
  parcel_number: string | null
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'identification', label: 'Identification' },
  { key: 'legal', label: 'Legal Description' },
  { key: 'survey', label: 'Plat & Survey Matters' },
]

export function PropertyForm({
  action,
  orderId,
  property,
  orderDefaults,
  easements,
}: {
  action: (formData: FormData) => void
  orderId: string
  property: PropertyDetails | null
  orderDefaults: OrderDefaults
  easements: PropertyEasement[]
}) {
  const [tab, setTab] = useState<Tab>('identification')
  const [easementType, setEasementType] = useState<string>(EASEMENT_TYPES[0])

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b" data-testid="property-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            data-testid={`property-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm ${
              tab === t.key
                ? 'border-b-2 border-slate-900 font-medium text-slate-900'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form action={action} className="space-y-4">
        <div className={tab === 'identification' ? 'space-y-4' : 'hidden'}>
          <div>
            <label htmlFor="house_number" className="block text-sm font-medium">
              House Number
            </label>
            <input
              id="house_number"
              name="house_number"
              defaultValue={property?.house_number ?? undefined}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="street_name" className="block text-sm font-medium">
              Street Name
            </label>
            <input
              id="street_name"
              name="street_name"
              defaultValue={property?.street_name ?? undefined}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="street_suffix" className="block text-sm font-medium">
                Street Suffix
              </label>
              <input
                id="street_suffix"
                name="street_suffix"
                defaultValue={property?.street_suffix ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="directional" className="block text-sm font-medium">
                Directional
              </label>
              <input
                id="directional"
                name="directional"
                defaultValue={property?.directional ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium">
                City
              </label>
              <input
                id="city"
                name="city"
                defaultValue={property?.city ?? orderDefaults.city ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="county" className="block text-sm font-medium">
                County
              </label>
              <input
                id="county"
                name="county"
                defaultValue={property?.county ?? orderDefaults.county ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium">
                State
              </label>
              <input
                id="state"
                name="state"
                defaultValue={property?.state ?? orderDefaults.state ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="zip" className="block text-sm font-medium">
                Zip
              </label>
              <input
                id="zip"
                name="zip"
                defaultValue={property?.zip ?? orderDefaults.zip ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label htmlFor="section_township_range" className="block text-sm font-medium">
              Section/Township/Range
            </label>
            <input
              id="section_township_range"
              name="section_township_range"
              defaultValue={property?.section_township_range ?? undefined}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="brief_legal" className="block text-sm font-medium">
              Brief Legal
            </label>
            <input
              id="brief_legal"
              name="brief_legal"
              defaultValue={property?.brief_legal ?? undefined}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="lot" className="block text-sm font-medium">
                Lot
              </label>
              <input
                id="lot"
                name="lot"
                defaultValue={property?.lot ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="block" className="block text-sm font-medium">
                Block
              </label>
              <input
                id="block"
                name="block"
                defaultValue={property?.block ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="subdivision_tract" className="block text-sm font-medium">
                Subdivision/Tract
              </label>
              <input
                id="subdivision_tract"
                name="subdivision_tract"
                defaultValue={property?.subdivision_tract ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label htmlFor="use_type" className="block text-sm font-medium">
              Use Type
            </label>
            <select
              id="use_type"
              name="use_type"
              defaultValue={property?.use_type ?? ''}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              <option value="">— Select —</option>
              {USE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={tab === 'legal' ? 'space-y-4' : 'hidden'}>
          <div>
            <label htmlFor="full_legal_description" className="block text-sm font-medium">
              Full Legal Description
            </label>
            <textarea
              id="full_legal_description"
              name="full_legal_description"
              defaultValue={property?.full_legal_description ?? undefined}
              rows={4}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="parcel_number" className="block text-sm font-medium">
                Parcel Number
              </label>
              <input
                id="parcel_number"
                name="parcel_number"
                defaultValue={property?.parcel_number ?? orderDefaults.parcel_number ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="parcel_number_type" className="block text-sm font-medium">
                Parcel Number Type
              </label>
              <select
                id="parcel_number_type"
                name="parcel_number_type"
                defaultValue={property?.parcel_number_type ?? ''}
                className="mt-1 w-full rounded border px-3 py-2"
              >
                <option value="">— Select —</option>
                {PARCEL_NUMBER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">CCRs / Master Deed</p>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label htmlFor="ccrs_dated" className="block text-sm font-medium">
                  Dated
                </label>
                <input
                  id="ccrs_dated"
                  name="ccrs_dated"
                  type="date"
                  defaultValue={property?.ccrs_dated ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="ccrs_book" className="block text-sm font-medium">
                  Book
                </label>
                <input
                  id="ccrs_book"
                  name="ccrs_book"
                  defaultValue={property?.ccrs_book ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="ccrs_page" className="block text-sm font-medium">
                  Page
                </label>
                <input
                  id="ccrs_page"
                  name="ccrs_page"
                  defaultValue={property?.ccrs_page ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="ccrs_instrument_number" className="block text-sm font-medium">
                  Instrument #
                </label>
                <input
                  id="ccrs_instrument_number"
                  name="ccrs_instrument_number"
                  defaultValue={property?.ccrs_instrument_number ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="ccrs_notes" className="block text-sm font-medium">
                Notes
              </label>
              <input
                id="ccrs_notes"
                name="ccrs_notes"
                defaultValue={property?.ccrs_notes ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className={tab === 'survey' ? 'space-y-4' : 'hidden'}>
          <div>
            <label htmlFor="plat_survey_reference" className="block text-sm font-medium">
              Plat/Survey Reference
            </label>
            <input
              id="plat_survey_reference"
              name="plat_survey_reference"
              defaultValue={property?.plat_survey_reference ?? undefined}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Setback Lines</p>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label htmlFor="setback_front" className="block text-sm font-medium">
                  Front
                </label>
                <input
                  id="setback_front"
                  name="setback_front"
                  defaultValue={property?.setback_front ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="setback_side" className="block text-sm font-medium">
                  Side
                </label>
                <input
                  id="setback_side"
                  name="setback_side"
                  defaultValue={property?.setback_side ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="setback_side_street" className="block text-sm font-medium">
                  Side Street
                </label>
                <input
                  id="setback_side_street"
                  name="setback_side_street"
                  defaultValue={property?.setback_side_street ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="setback_rear" className="block text-sm font-medium">
                  Rear
                </label>
                <input
                  id="setback_rear"
                  name="setback_rear"
                  defaultValue={property?.setback_rear ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Lot Dimensions</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="lot_dimension_frontage" className="block text-sm font-medium">
                  Street Frontage
                </label>
                <input
                  id="lot_dimension_frontage"
                  name="lot_dimension_frontage"
                  defaultValue={property?.lot_dimension_frontage ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="lot_dimension_depth" className="block text-sm font-medium">
                  Depth
                </label>
                <input
                  id="lot_dimension_depth"
                  name="lot_dimension_depth"
                  defaultValue={property?.lot_dimension_depth ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Save Changes
        </button>
      </form>

      {tab === 'legal' && (
        <div className="mt-8 border-t pt-6">
          <h2 className="mb-4 text-lg font-semibold">Access / Easements / ROW</h2>
          {!property ? (
            <p className="text-sm text-slate-500">Save Property Details first before adding easements.</p>
          ) : (
            <>
              <ul className="mb-6 space-y-2" data-testid="easement-list">
                {easements.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded border p-3"
                    data-testid="easement-row"
                  >
                    <div>
                      <p className="font-medium">{e.type === 'Other' ? e.other_type_text : e.type}</p>
                      {e.description && <p className="text-sm text-slate-500">{e.description}</p>}
                    </div>
                    <form action={deleteEasement.bind(null, orderId, e.id)}>
                      <button type="submit" className="text-sm text-red-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
                {easements.length === 0 && (
                  <p className="text-sm text-slate-500">No easements added yet.</p>
                )}
              </ul>

              <details className="rounded border p-4">
                <summary className="cursor-pointer font-medium">Add an easement</summary>
                <form action={addEasement.bind(null, property.id, orderId)} className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="easement_type" className="block text-sm font-medium">
                      Type
                    </label>
                    <select
                      id="easement_type"
                      name="type"
                      value={easementType}
                      onChange={(e) => setEasementType(e.target.value)}
                      className="mt-1 w-full rounded border px-3 py-2"
                    >
                      {EASEMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  {easementType === 'Other' && (
                    <div>
                      <label htmlFor="other_type_text" className="block text-sm font-medium">
                        Specify Type
                      </label>
                      <input
                        id="other_type_text"
                        name="other_type_text"
                        className="mt-1 w-full rounded border px-3 py-2"
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium">
                      Notes
                    </label>
                    <input id="description" name="description" className="mt-1 w-full rounded border px-3 py-2" />
                  </div>
                  <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
                    Add Easement
                  </button>
                </form>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create the route page**

```tsx
// src/app/orders/[id]/property/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { upsertPropertyDetails } from '@/app/actions/property'
import { PropertyForm } from '@/components/PropertyForm'

export default async function PropertyPage({
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
    .select('id, property_city, property_county, property_state, property_zip, parcel_number')
    .eq('id', id)
    .single()

  if (!order) {
    notFound()
  }

  const { data: property } = await supabase
    .from('property_details')
    .select('*')
    .eq('order_id', id)
    .maybeSingle()

  const { data: easements } = property
    ? await supabase
        .from('property_easements')
        .select('*')
        .eq('property_id', property.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  const upsertPropertyDetailsWithId = upsertPropertyDetails.bind(null, id)

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <PropertyForm
        action={upsertPropertyDetailsWithId}
        orderId={id}
        property={property}
        orderDefaults={{
          city: order.property_city,
          county: order.property_county,
          state: order.property_state,
          zip: order.property_zip,
          parcel_number: order.parcel_number,
        }}
        easements={easements ?? []}
      />
    </div>
  )
}
```

- [ ] **Step 4: Extend the E2E spec**

Add to `tests/e2e/order-entry.spec.ts`:

```ts
  test('property: pre-fills from Order Entry, saves fields, and manages easements', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByLabel('City').fill('Lorain')
    await page.getByLabel('County').fill('Lorain')
    await page.getByLabel('State').fill('OH')
    await page.getByLabel('Zip').fill('44053')
    await page.getByLabel('Parcel Number').fill('12-34-567')
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Property' }).click()
    await page.waitForURL('**/property')

    await expect(page.getByLabel('City')).toHaveValue('Lorain')
    await expect(page.getByLabel('County')).toHaveValue('Lorain')
    await expect(page.getByLabel('State')).toHaveValue('OH')
    await expect(page.getByLabel('Zip')).toHaveValue('44053')

    await page.getByLabel('House Number').fill('640')
    await page.getByLabel('Street Name').fill('Bayberry Rd')
    await page.getByLabel('Use Type').selectOption('Single Family')

    await page.getByTestId('property-tab-legal').click()
    await expect(page.getByLabel('Parcel Number')).toHaveValue('12-34-567')
    await page.getByLabel('Parcel Number Type').selectOption('APN')
    await page.getByLabel('Full Legal Description').fill('Lot 5, Block 2, Test Subdivision')

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/property')

    await page.getByTestId('property-tab-identification').click()
    await expect(page.getByLabel('House Number')).toHaveValue('640')
    await expect(page.getByLabel('Use Type')).toHaveValue('Single Family')

    await page.getByTestId('property-tab-legal').click()
    await expect(page.getByLabel('Full Legal Description')).toHaveValue('Lot 5, Block 2, Test Subdivision')

    await page.getByText('Add an easement').click()
    await page.getByLabel('Type').selectOption('Utility Easement')
    await page.getByLabel('Notes').fill('Rear yard utility line')
    await page.getByRole('button', { name: 'Add Easement' }).click()

    await expect(page.getByTestId('easement-row')).toContainText('Utility Easement')
    await expect(page.getByTestId('easement-row')).toContainText('Rear yard utility line')

    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('easement-row')).not.toBeVisible()
  })
```

- [ ] **Step 5: Run the full suite and verify**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run dev -- -p 3100 > /tmp/genesis-property-task3-dev.log 2>&1 &
sleep 4
PLAYWRIGHT_BASE_URL="http://localhost:3100" npm run test:e2e
```

Expected: all 9 tests PASS (8 existing + 1 new). Kill the dev server before finishing.

- [ ] **Step 6: Commit**

```bash
git add src/components/FileSectionsNav.tsx src/components/PropertyForm.tsx \
  "src/app/orders/[id]/property/page.tsx" tests/e2e/order-entry.spec.ts
git commit -m "feat: build Property screen (Identification, Legal Description, Plat & Survey Matters)"
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

Expected: both clean.

- [ ] **Step 2: Push and confirm the Vercel auto-deploy**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git fetch origin && git status
git push origin main
```

Wait for the deploy, then:

```bash
PLAYWRIGHT_BASE_URL="https://genesis-app-tau.vercel.app" npx playwright test
```

Expected: all 9 tests PASS against the live deployment.

- [ ] **Step 3: Update the vault**

In `M&L Title/M&L Title - Obsidian Vault/Genesis Build Log.md`, add a change-log entry: Property screen shipped (3 sub-tabs, pre-fill from Order Entry, structured Access/Easements list), the SoftPro-comparison refinements applied, commit range, 9/9 E2E passing locally and live.

In `M&L Title/M&L Title - Obsidian Vault/Genesis Rebuild - Property Screen Design.md`, change frontmatter `status:` from `approved — ready for implementation plan` to `implemented`.

- [ ] **Step 4: Re-sync T7 → Desktop backup and verify**

```bash
rsync -av --delete "/Volumes/T7/Claude Code/Genesis Platform/" "/Users/campenny/Desktop/Claude Code/Genesis Platform/"
bash "/Volumes/T7/Claude Code/Genesis Platform/.claude/hooks/verify-sync.sh"
```

Expected: T7 == Desktop == `github/main`, byte-identical roots.

---

## Self-Review

**Spec coverage:** All 3 sub-tabs with the full field list including the 4 SoftPro-driven refinements (Parcel Number+Type, Lot/Block/Subdivision split, CCRs recording-metadata group, Setback/Lot-Dimension fields) — Task 3 ✓. Schema matches the design doc's `property_details`/`property_easements` exactly — Task 1 ✓. Pre-fill from Order Entry (City/County/State/Zip/Parcel Number, non-destructive, fill-once) — Task 3's page.tsx + form `defaultValue` fallback chain ✓. Access/Easements/ROW as a structured add/remove-only list — Task 3 ✓. Derivation Clause correctly absent — never referenced ✓. Nav wiring — Task 3 Step 1 ✓.

**Placeholder scan:** No TBD/TODO. Collapsed CCRs/Setback/Survey sections in SoftPro's own UI were explicitly evaluated and NOT carried over wholesale — only the specific fields Cam approved are in scope.

**Type consistency:** `PropertyDetails`/`PropertyEasement` (Task 2) field names match the migration's column names exactly (Task 1) and the form's `name` attributes exactly (Task 3). `upsertPropertyDetails(orderId, formData)`, `addEasement(propertyId, orderId, formData)`, `deleteEasement(orderId, easementId)` signatures match their `.bind()` call sites in `PropertyForm.tsx` and `page.tsx`. `PropertyForm`'s prop shape (`action`, `orderId`, `property`, `orderDefaults`, `easements`) matches exactly what `page.tsx` passes.
