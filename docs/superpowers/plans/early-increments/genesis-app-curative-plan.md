# Genesis App — Curative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Curative File Section — fourth and final Title nav-group item — adding the disposition/Finalize/Clear-to-Close workflow layer on top of the Requirement/Exception rows Schedule B-I/B-II already creates.

**Architecture:** One new table (`curative_settings`, keyed by `order_id`, same pattern as `commitment_sch_b_settings`) tracking Draft/Final commitment status and CTC timestamps. One new route (`/orders/[id]/curative`) with its own components — `CurativeRequirementsSection`/`CurativeExceptionsSection` (read-only description + either a delete control in Draft or Disposition/Disposition Notes/Don't Show controls in Final), `FinalizeControl` (Finalize / Revert to Draft), `CTCControl` (Issue CTC / Rescind). Curative reads and writes the same `commitment_requirements`/`commitment_exceptions` rows Schedule B-I/B-II created — no new Requirement/Exception tables, only the three columns (`disposition`, `disposition_notes`, `dont_show`) Sch B reserved for this round. Schedule B's own screen becomes read-only once the commitment is Final, so the two screens can't fight over the same rows (data-entry and workflow/lock stay on separate screens, per the confirmed design).

**Tech Stack:** Same as prior increments — Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, `@supabase/ssr`, Playwright E2E extending `tests/e2e/order-entry.spec.ts`. Supabase project `hlahrypglnmjjxrdtfkm`.

**Spec:** `M&L Title - Obsidian Vault/Genesis Rebuild - Curative Design.md`

## Global Constraints

- All file operations happen in the T7 copy (`/Volumes/T7/Claude Code/Genesis Platform/`), never the Desktop backup.
- Repo: `/Volumes/T7/Claude Code/Genesis Platform/genesis-app/`, remote `origin` → `https://github.com/campennydarden-cpu/Genesis-App.git`, branch `main`, Vercel auto-deploys on push, live at `https://genesis-app-tau.vercel.app`.
- Model-cost discipline: haiku for mechanical/fully-specified tasks, sonnet for tasks requiring judgment (workflow-state gating, cross-screen read-only behavior, test design). No opus.
- **Migration numbering:** the last applied migration is `0005_commitment_sch_b.sql`. This plan uses `0006_curative.sql`.
- **Disposition lists were corrected 2026-08-31** (the design doc's original lists were explicit placeholders pending correction — do not use the placeholder values from any older draft). **Requirements:** Released, Expired, Insured Over, Waived, No Action. **Exceptions:** Removed by Affidavit, Deleted per Underwriter. These are final, confirmed values — use them verbatim.
- **CTC document generation is out of scope this round** (scope narrowed 2026-08-31, confirmed with Cam): neither a document renderer nor an Attachments backend exists anywhere in the app today — Attachments is an inert placeholder tab ("Not built yet"), and Sch A/Sch B both already deferred document rendering. "Issue CTC" in this plan stamps `ctc_issued_at` and flips `orders.title_status` only; it does **not** generate or store any document. Do not add an `attachments` table or any document-rendering code — that is a future increment once the renderer and Attachments backend exist.
- The decision-tree curative logic (Legal Facts/Risk Tolerance admin layers), the three-phase task auto-generation, Schedule D, and permission-gated access to Finalize/Issue CTC are all out of scope — see the design doc's own "Out of scope" section. Nothing in this plan should touch tasks, permissions, or Schedule D.
- `orders.title_status` already has a check constraint including `'Curative'` and `'Cleared for Policy'` (added in the foundation-phase migration) — no schema change needed there.
- Testing stays Playwright E2E only, extending the existing cumulative spec file.
- Dev server must be running (`npm run dev`, no `webServer` entry in `playwright.config.ts`) before `npm run test:e2e`.

## File Structure

```
genesis-app/
├── supabase/migrations/
│   └── 0006_curative.sql                                     # NEW
├── src/
│   ├── lib/
│   │   ├── constants.ts                                      # MODIFY: + REQUIREMENT_DISPOSITIONS, EXCEPTION_DISPOSITIONS
│   │   └── types.ts                                          # MODIFY: + CurativeSettings
│   ├── app/
│   │   ├── actions/
│   │   │   └── curative.ts                                   # NEW
│   │   └── orders/[id]/
│   │       ├── curative/page.tsx                              # NEW
│   │       └── commitment-sch-b/page.tsx                      # MODIFY: fetch curative_settings, pass readOnly
│   └── components/
│       ├── FileSectionsNav.tsx                               # MODIFY: Curative gains segment
│       ├── commitment-sch-b/
│       │   ├── RequirementsSection.tsx                        # MODIFY: + readOnly prop
│       │   └── ExceptionsSection.tsx                          # MODIFY: + readOnly prop
│       └── curative/
│           ├── CurativeRequirementsSection.tsx                # NEW
│           ├── CurativeExceptionsSection.tsx                  # NEW
│           ├── FinalizeControl.tsx                            # NEW
│           └── CTCControl.tsx                                 # NEW
└── tests/e2e/order-entry.spec.ts                              # MODIFY
```

---

### Task 1: Schema — `curative_settings`

**Suggested model:** haiku (fully-specified schema transcription)

**Files:**
- Create: `supabase/migrations/0006_curative.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0006_curative.sql
create table public.curative_settings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  commitment_status text not null default 'draft' check (commitment_status in ('draft', 'final')),
  finalized_at timestamptz,
  ctc_issued_at timestamptz,
  ctc_rescinded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.curative_settings enable row level security;

create policy "Authenticated M&L staff can do anything with curative_settings"
  on public.curative_settings for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool against project `hlahrypglnmjjxrdtfkm`, with `name: "curative"` and the SQL above as `query`.

- [ ] **Step 3: Verify**

Use the Supabase MCP `list_tables` tool and confirm `curative_settings` appears with RLS enabled.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git add supabase/migrations/0006_curative.sql
git commit -m "feat: add curative_settings schema"
```

---

### Task 2: Constants and types

**Suggested model:** haiku (fully-specified value lists and type definitions)

**Files:**
- Modify: `src/lib/constants.ts` (append)
- Modify: `src/lib/types.ts` (append)

- [ ] **Step 1: Append the constants**

```ts
// append to src/lib/constants.ts

export const REQUIREMENT_DISPOSITIONS = [
  'Released', 'Expired', 'Insured Over', 'Waived', 'No Action',
] as const

export const EXCEPTION_DISPOSITIONS = [
  'Removed by Affidavit', 'Deleted per Underwriter',
] as const
```

- [ ] **Step 2: Append the type**

```ts
// append to src/lib/types.ts

export type CurativeSettings = {
  id: string
  order_id: string
  commitment_status: 'draft' | 'final'
  finalized_at: string | null
  ctc_issued_at: string | null
  ctc_rescinded_at: string | null
}
```

- [ ] **Step 3: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/types.ts
git commit -m "feat: add Curative constants and types"
```

---

### Task 3: Server Actions

**Suggested model:** sonnet (workflow-state gating — Revert blocked while a CTC exists, Issue CTC blocked until every row is dispositioned — is judgment, not pure CRUD)

**Files:**
- Create: `src/app/actions/curative.ts`

**Interfaces:**
- Consumes: `CommitmentRequirement`/`CommitmentException` (already in `src/lib/types.ts`, from the Sch B increment), `CurativeSettings` (Task 2).
- Produces: `updateRequirementDisposition(orderId, requirementId, formData)`, `updateExceptionDisposition(orderId, exceptionId, formData)`, `finalizeCommitment(orderId, formData)`, `revertToDraft(orderId, formData)`, `issueCTC(orderId, formData)`, `rescindCTC(orderId, formData)`. Consumed by Tasks 5-6 via `.bind()`.

- [ ] **Step 1: Create the actions file**

```ts
// src/app/actions/curative.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function fail(orderId: string, message: string): never {
  redirect(`/orders/${orderId}/curative?error=${encodeURIComponent(message)}`)
}

export async function updateRequirementDisposition(orderId: string, requirementId: string, formData: FormData) {
  const supabase = await createClient()
  const disposition = (formData.get('disposition') as string) || null
  const disposition_notes = (formData.get('disposition_notes') as string) || null
  const dont_show = formData.get('dont_show') === 'on'

  const { error } = await supabase
    .from('commitment_requirements')
    .update({ disposition, disposition_notes, dont_show })
    .eq('id', requirementId)

  if (error) {
    console.error('updateRequirementDisposition failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/curative`)
}

export async function updateExceptionDisposition(orderId: string, exceptionId: string, formData: FormData) {
  const supabase = await createClient()
  const disposition = (formData.get('disposition') as string) || null
  const disposition_notes = (formData.get('disposition_notes') as string) || null
  const dont_show = formData.get('dont_show') === 'on'

  const { error } = await supabase
    .from('commitment_exceptions')
    .update({ disposition, disposition_notes, dont_show })
    .eq('id', exceptionId)

  if (error) {
    console.error('updateExceptionDisposition failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }
  revalidatePath(`/orders/${orderId}/curative`)
}

export async function finalizeCommitment(orderId: string, formData: FormData) {
  void formData
  const supabase = await createClient()

  const { error: settingsError } = await supabase.from('curative_settings').upsert(
    {
      order_id: orderId,
      commitment_status: 'final',
      finalized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  )
  if (settingsError) {
    console.error('finalizeCommitment failed:', settingsError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  const { error: orderError } = await supabase.from('orders').update({ title_status: 'Curative' }).eq('id', orderId)
  if (orderError) {
    console.error('finalizeCommitment (order update) failed:', orderError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  revalidatePath(`/orders/${orderId}/curative`)
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function revertToDraft(orderId: string, formData: FormData) {
  void formData
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('curative_settings')
    .select('ctc_issued_at')
    .eq('order_id', orderId)
    .maybeSingle()

  if (settings?.ctc_issued_at) {
    fail(orderId, 'Cannot revert to Draft while a Clear to Close has been issued. Rescind the CTC first.')
  }

  const { error } = await supabase
    .from('curative_settings')
    .update({ commitment_status: 'draft', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)

  if (error) {
    console.error('revertToDraft failed:', error)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  revalidatePath(`/orders/${orderId}/curative`)
  revalidatePath(`/orders/${orderId}/commitment-sch-b`)
}

export async function issueCTC(orderId: string, formData: FormData) {
  void formData
  const supabase = await createClient()

  const { data: requirements } = await supabase
    .from('commitment_requirements')
    .select('disposition, dont_show')
    .eq('order_id', orderId)
  const { data: exceptions } = await supabase
    .from('commitment_exceptions')
    .select('disposition, dont_show')
    .eq('order_id', orderId)

  const allDispositioned = [...(requirements ?? []), ...(exceptions ?? [])].every(
    (r) => r.disposition || r.dont_show
  )

  if (!allDispositioned) {
    fail(orderId, "Every Requirement and Exception must have a Disposition set or Don't Show checked before issuing a CTC.")
  }

  const { error: settingsError } = await supabase
    .from('curative_settings')
    .update({ ctc_issued_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
  if (settingsError) {
    console.error('issueCTC failed:', settingsError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  const { error: orderError } = await supabase.from('orders').update({ title_status: 'Cleared for Policy' }).eq('id', orderId)
  if (orderError) {
    console.error('issueCTC (order update) failed:', orderError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  revalidatePath(`/orders/${orderId}/curative`)
}

export async function rescindCTC(orderId: string, formData: FormData) {
  void formData
  const supabase = await createClient()

  const { error: settingsError } = await supabase
    .from('curative_settings')
    .update({ ctc_issued_at: null, ctc_rescinded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
  if (settingsError) {
    console.error('rescindCTC failed:', settingsError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  const { error: orderError } = await supabase.from('orders').update({ title_status: 'Curative' }).eq('id', orderId)
  if (orderError) {
    console.error('rescindCTC (order update) failed:', orderError)
    fail(orderId, 'Could not save. Please check your entries and try again.')
  }

  revalidatePath(`/orders/${orderId}/curative`)
}
```

Note: `finalizeCommitment` and `revertToDraft` also revalidate `commitment-sch-b`'s path — that screen's read-only state (Task 4) depends on `curative_settings.commitment_status`, so it needs to reflect the change immediately, not just the Curative screen itself.

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/curative.ts
git commit -m "feat: add Curative server actions"
```

---

### Task 4: Schedule B read-only gating

**Suggested model:** sonnet (touches two existing components' render branches — must not regress the Sch B E2E test already passing on main)

**Files:**
- Modify: `src/components/commitment-sch-b/RequirementsSection.tsx`
- Modify: `src/components/commitment-sch-b/ExceptionsSection.tsx`
- Modify: `src/app/orders/[id]/commitment-sch-b/page.tsx`

**Why:** the design doc's "Delete gating" decision requires that once a commitment is Final, rows can no longer be deleted outright from the data-entry screen — only Curative's disposition controls (on its own screen) can further change them. Without this, Finalize is not load-bearing: staff could still delete a "Released" requirement from the Sch B screen and destroy the record Curative just dispositioned.

- [ ] **Step 1: Add a `readOnly` prop to `RequirementsSection`**

In `src/components/commitment-sch-b/RequirementsSection.tsx`, add `readOnly = false` to the props:

```ts
export function RequirementsSection({
  orderId,
  requirements,
  securityInstruments,
  relatedDocs,
  liens,
  beginAt,
  readOnly = false,
}: {
  orderId: string
  requirements: CommitmentRequirement[]
  securityInstruments: SecurityInstrument[]
  relatedDocs: SecurityInstrumentRelatedDoc[]
  liens: Lien[]
  beginAt: number
  readOnly?: boolean
}) {
```

Wrap the chip bar's existing condition so it never renders when read-only:

```tsx
{!readOnly && (siChips.length > 0 || relChips.length > 0 || lienChips.length > 0) && (
  <div className="mb-4 flex flex-wrap gap-2" data-testid="requirement-chips">
```

Replace the per-row edit/non-edit branch so a read-only row never enters edit mode and never shows Edit/Remove:

```tsx
{orderedRequirements.map((r, idx) =>
  !readOnly && editingId === r.id ? (
    <li key={r.id} className="rounded border p-4" data-testid="requirement-row">
      {/* unchanged edit form */}
    </li>
  ) : (
    <li
      key={r.id}
      className={`flex items-center justify-between rounded border p-3 ${r.parent_requirement_id ? 'ml-6' : ''}`}
      data-testid="requirement-row"
    >
      <div>
        <p>
          {labels[idx]}. {r.description}
        </p>
        {r.notes && <p className="text-sm text-slate-500">{r.notes}</p>}
      </div>
      {!readOnly && (
        <div className="flex gap-3">
          <button type="button" onClick={() => setEditingId(r.id)} className="text-sm text-slate-600 hover:underline">
            Edit
          </button>
          <form action={deleteRequirement.bind(null, orderId, r.id)}>
            <button type="submit" className="text-sm text-red-600 hover:underline">
              Remove
            </button>
          </form>
        </div>
      )}
    </li>
  )
)}
```

Wrap the "Add a requirement" `<details>` block:

```tsx
{!readOnly && (
  <details className="rounded border p-4">
    {/* unchanged */}
  </details>
)}
```

- [ ] **Step 2: Same change in `ExceptionsSection.tsx`**

Add `readOnly = false` to `ExceptionsSection`'s props (and `readOnly?: boolean` to its type), wrap the chip bar's `{emChips.length > 0 && (...)}` as `{!readOnly && emChips.length > 0 && (...)}`, replace the per-row branch the same way (no edit mode, no Edit/Remove when read-only), and wrap the "Add an exception" `<details>` block in `{!readOnly && (...)}`.

- [ ] **Step 3: Wire `readOnly` from the Sch B page**

In `src/app/orders/[id]/commitment-sch-b/page.tsx`, add a fetch for `curative_settings` and pass the derived flag to both sections:

```ts
const { data: curativeSettings } = await supabase
  .from('curative_settings')
  .select('commitment_status')
  .eq('order_id', id)
  .maybeSingle()
const readOnly = curativeSettings?.commitment_status === 'final'
```

```tsx
<RequirementsSection
  orderId={id}
  requirements={requirements ?? []}
  securityInstruments={securityInstruments ?? []}
  relatedDocs={relatedDocs ?? []}
  liens={liens ?? []}
  beginAt={beginRequirementsAt}
  readOnly={readOnly}
/>
<ExceptionsSection
  orderId={id}
  exceptions={exceptions ?? []}
  exceptionMatters={exceptionMatters ?? []}
  beginAt={beginExceptionsAt}
  readOnly={readOnly}
/>
```

- [ ] **Step 4: Verify with a build, then re-run the existing Sch B E2E test**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
npm run dev -- -p 3100 > /tmp/genesis-curative-task4-dev.log 2>&1 &
sleep 4
PLAYWRIGHT_BASE_URL="http://localhost:3100" npx playwright test -g "commitment schedule B"
```

Expected: PASS, unchanged — a fresh order has no `curative_settings` row, so `commitment_status` defaults to `'draft'` and `readOnly` is `false`; the existing Sch B test never finalizes anything, so its Edit/Remove/chip/add-form assertions must still hold exactly as before. Kill the dev server before finishing.

- [ ] **Step 5: Commit**

```bash
git add src/components/commitment-sch-b/RequirementsSection.tsx src/components/commitment-sch-b/ExceptionsSection.tsx "src/app/orders/[id]/commitment-sch-b/page.tsx"
git commit -m "feat: make Schedule B read-only once the commitment is finalized"
```

---

### Task 5: CurativeRequirementsSection

**Suggested model:** sonnet (same numbering/grouping logic as Sch B's RequirementsSection, plus the Draft/Final branch)

**Files:**
- Create: `src/components/curative/CurativeRequirementsSection.tsx`

**Interfaces:**
- Consumes: `deleteRequirement` (from `@/app/actions/commitment-sch-b`, Sch B increment), `updateRequirementDisposition` (Task 3), `computeReqLabels`/`reorderForNumbering` (from `@/lib/commitment-text`, Sch B increment), `REQUIREMENT_DISPOSITIONS` (Task 2), `CommitmentRequirement` (Sch B increment).
- Produces: `CurativeRequirementsSection({ orderId, requirements, beginAt, commitmentStatus })`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/curative/CurativeRequirementsSection.tsx
import { REQUIREMENT_DISPOSITIONS } from '@/lib/constants'
import { computeReqLabels, reorderForNumbering } from '@/lib/commitment-text'
import { deleteRequirement } from '@/app/actions/commitment-sch-b'
import { updateRequirementDisposition } from '@/app/actions/curative'
import type { CommitmentRequirement } from '@/lib/types'

export function CurativeRequirementsSection({
  orderId,
  requirements,
  beginAt,
  commitmentStatus,
}: {
  orderId: string
  requirements: CommitmentRequirement[]
  beginAt: number
  commitmentStatus: 'draft' | 'final'
}) {
  const orderedRequirements = reorderForNumbering(requirements)
  const labels = computeReqLabels(orderedRequirements, beginAt)

  return (
    <div className="rounded border p-4">
      <p className="mb-4 text-lg font-semibold">Requirements</p>
      <ul className="space-y-2" data-testid="curative-requirement-list">
        {orderedRequirements.map((r, idx) => (
          <li
            key={r.id}
            className={`rounded border p-3 ${r.parent_requirement_id ? 'ml-6' : ''}`}
            data-testid="curative-requirement-row"
          >
            <p>
              {labels[idx]}. {r.description}
            </p>
            {r.notes && <p className="text-sm text-slate-500">{r.notes}</p>}

            {commitmentStatus === 'draft' ? (
              <form action={deleteRequirement.bind(null, orderId, r.id)} className="mt-2">
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  Remove
                </button>
              </form>
            ) : (
              <form action={updateRequirementDisposition.bind(null, orderId, r.id)} className="mt-2 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor={`req-disposition-${r.id}`} className="block text-xs font-medium">
                    Disposition
                  </label>
                  <select
                    id={`req-disposition-${r.id}`}
                    name="disposition"
                    defaultValue={r.disposition ?? ''}
                    className="mt-1 rounded border px-2 py-1 text-sm"
                  >
                    <option value="">— Select —</option>
                    {REQUIREMENT_DISPOSITIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`req-disposition-notes-${r.id}`} className="block text-xs font-medium">
                    Disposition Notes
                  </label>
                  <input
                    id={`req-disposition-notes-${r.id}`}
                    name="disposition_notes"
                    defaultValue={r.disposition_notes ?? ''}
                    className="mt-1 rounded border px-2 py-1 text-sm"
                  />
                </div>
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="dont_show" defaultChecked={r.dont_show} />
                  Don&apos;t Show
                </label>
                <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                  Save
                </button>
              </form>
            )}
          </li>
        ))}
        {requirements.length === 0 && <p className="text-sm text-slate-500">No requirements on file.</p>}
      </ul>
    </div>
  )
}
```

Note: no `'use client'` directive — this component uses no hooks, only server actions bound directly in form `action`s, which works in a Server Component.

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/curative/CurativeRequirementsSection.tsx
git commit -m "feat: add CurativeRequirementsSection component"
```

---

### Task 6: CurativeExceptionsSection

**Suggested model:** sonnet (parallel to Task 5, simpler — flat numbering, no sub-items)

**Files:**
- Create: `src/components/curative/CurativeExceptionsSection.tsx`

**Interfaces:**
- Consumes: `deleteException` (from `@/app/actions/commitment-sch-b`), `updateExceptionDisposition` (Task 3), `EXCEPTION_DISPOSITIONS` (Task 2), `CommitmentException` (Sch B increment).
- Produces: `CurativeExceptionsSection({ orderId, exceptions, beginAt, commitmentStatus })`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/curative/CurativeExceptionsSection.tsx
import { EXCEPTION_DISPOSITIONS } from '@/lib/constants'
import { deleteException } from '@/app/actions/commitment-sch-b'
import { updateExceptionDisposition } from '@/app/actions/curative'
import type { CommitmentException } from '@/lib/types'

export function CurativeExceptionsSection({
  orderId,
  exceptions,
  beginAt,
  commitmentStatus,
}: {
  orderId: string
  exceptions: CommitmentException[]
  beginAt: number
  commitmentStatus: 'draft' | 'final'
}) {
  return (
    <div className="mt-6 rounded border p-4">
      <p className="mb-4 text-lg font-semibold">Exceptions</p>
      <ul className="space-y-2" data-testid="curative-exception-list">
        {exceptions.map((e, idx) => (
          <li key={e.id} className="rounded border p-3" data-testid="curative-exception-row">
            <p>
              {beginAt + idx}. {e.description}
            </p>
            {e.notes && <p className="text-sm text-slate-500">{e.notes}</p>}

            {commitmentStatus === 'draft' ? (
              <form action={deleteException.bind(null, orderId, e.id)} className="mt-2">
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  Remove
                </button>
              </form>
            ) : (
              <form action={updateExceptionDisposition.bind(null, orderId, e.id)} className="mt-2 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor={`exc-disposition-${e.id}`} className="block text-xs font-medium">
                    Disposition
                  </label>
                  <select
                    id={`exc-disposition-${e.id}`}
                    name="disposition"
                    defaultValue={e.disposition ?? ''}
                    className="mt-1 rounded border px-2 py-1 text-sm"
                  >
                    <option value="">— Select —</option>
                    {EXCEPTION_DISPOSITIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`exc-disposition-notes-${e.id}`} className="block text-xs font-medium">
                    Disposition Notes
                  </label>
                  <input
                    id={`exc-disposition-notes-${e.id}`}
                    name="disposition_notes"
                    defaultValue={e.disposition_notes ?? ''}
                    className="mt-1 rounded border px-2 py-1 text-sm"
                  />
                </div>
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="dont_show" defaultChecked={e.dont_show} />
                  Don&apos;t Show
                </label>
                <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                  Save
                </button>
              </form>
            )}
          </li>
        ))}
        {exceptions.length === 0 && <p className="text-sm text-slate-500">No exceptions on file.</p>}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/curative/CurativeExceptionsSection.tsx
git commit -m "feat: add CurativeExceptionsSection component"
```

---

### Task 7: FinalizeControl and CTCControl

**Suggested model:** haiku (two small, fully-specified button components — no design judgment left to make, Task 3/5/6 already resolved the behavior)

**Files:**
- Create: `src/components/curative/FinalizeControl.tsx`
- Create: `src/components/curative/CTCControl.tsx`

**Interfaces:**
- Consumes: `finalizeCommitment`/`revertToDraft`/`issueCTC`/`rescindCTC` (Task 3).
- Produces: `FinalizeControl({ orderId, commitmentStatus, ctcIssued })`, `CTCControl({ orderId, ctcIssued, allDispositioned })`. Consumed by Task 8's page.

- [ ] **Step 1: Create `FinalizeControl`**

```tsx
// src/components/curative/FinalizeControl.tsx
import { finalizeCommitment, revertToDraft } from '@/app/actions/curative'

export function FinalizeControl({
  orderId,
  commitmentStatus,
  ctcIssued,
}: {
  orderId: string
  commitmentStatus: 'draft' | 'final'
  ctcIssued: boolean
}) {
  if (commitmentStatus === 'draft') {
    return (
      <form action={finalizeCommitment.bind(null, orderId)}>
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white" data-testid="finalize-button">
          Finalize
        </button>
      </form>
    )
  }

  return (
    <form action={revertToDraft.bind(null, orderId)}>
      <button
        type="submit"
        disabled={ctcIssued}
        className="rounded border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="revert-to-draft-button"
      >
        Revert to Draft
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create `CTCControl`**

```tsx
// src/components/curative/CTCControl.tsx
import { issueCTC, rescindCTC } from '@/app/actions/curative'

export function CTCControl({
  orderId,
  ctcIssued,
  allDispositioned,
}: {
  orderId: string
  ctcIssued: boolean
  allDispositioned: boolean
}) {
  if (ctcIssued) {
    return (
      <form action={rescindCTC.bind(null, orderId)}>
        <p className="mb-2 text-sm font-medium text-green-700" data-testid="ctc-issued-label">
          Clear to Close issued
        </p>
        <button type="submit" className="rounded border px-4 py-2 text-sm" data-testid="rescind-ctc-button">
          Rescind CTC
        </button>
      </form>
    )
  }

  return (
    <form action={issueCTC.bind(null, orderId)}>
      <button
        type="submit"
        disabled={!allDispositioned}
        className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="issue-ctc-button"
      >
        Issue CTC
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/curative/FinalizeControl.tsx src/components/curative/CTCControl.tsx
git commit -m "feat: add FinalizeControl and CTCControl components"
```

---

### Task 8: Route page and nav wiring

**Suggested model:** sonnet (orchestrates fetching across 4 tables and computing the CTC-eligibility gate)

**Files:**
- Create: `src/app/orders/[id]/curative/page.tsx`
- Modify: `src/components/FileSectionsNav.tsx` (Curative item gains `segment: 'curative'`)

- [ ] **Step 1: Wire the nav item**

In `src/components/FileSectionsNav.tsx`, change:

```tsx
{ label: 'Curative' },
```

to:

```tsx
{ label: 'Curative', segment: 'curative' },
```

- [ ] **Step 2: Create the route page**

```tsx
// src/app/orders/[id]/curative/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { STANDARD_BI_ITEM_COUNTS } from '@/lib/constants'
import { CurativeRequirementsSection } from '@/components/curative/CurativeRequirementsSection'
import { CurativeExceptionsSection } from '@/components/curative/CurativeExceptionsSection'
import { FinalizeControl } from '@/components/curative/FinalizeControl'
import { CTCControl } from '@/components/curative/CTCControl'
import type { CurativeSettings } from '@/lib/types'

export default async function CurativePage({
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

  const { data: schA } = await supabase.from('commitment_sch_a').select('form_type').eq('order_id', id).maybeSingle()
  const formType = schA?.form_type ?? 'Standard'
  const standardCount = STANDARD_BI_ITEM_COUNTS[formType] ?? STANDARD_BI_ITEM_COUNTS.Standard

  const { data: schBSettings } = await supabase.from('commitment_sch_b_settings').select('*').eq('order_id', id).maybeSingle()
  const beginRequirementsAt = schBSettings?.begin_requirements_at ?? standardCount + 1
  const beginExceptionsAt = schBSettings?.begin_exceptions_at ?? 1

  const { data: requirements } = await supabase.from('commitment_requirements').select('*').eq('order_id', id).order('created_at')
  const { data: exceptions } = await supabase.from('commitment_exceptions').select('*').eq('order_id', id).order('created_at')

  const { data: curativeSettings } = await supabase.from('curative_settings').select('*').eq('order_id', id).maybeSingle()
  const commitmentStatus: CurativeSettings['commitment_status'] = curativeSettings?.commitment_status ?? 'draft'
  const ctcIssued = !!curativeSettings?.ctc_issued_at

  const allDispositioned = [...(requirements ?? []), ...(exceptions ?? [])].every((r) => r.disposition || r.dont_show)

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mb-4 flex items-center gap-4">
        <FinalizeControl orderId={id} commitmentStatus={commitmentStatus} ctcIssued={ctcIssued} />
        <CTCControl orderId={id} ctcIssued={ctcIssued} allDispositioned={allDispositioned} />
      </div>

      <CurativeRequirementsSection
        orderId={id}
        requirements={requirements ?? []}
        beginAt={beginRequirementsAt}
        commitmentStatus={commitmentStatus}
      />
      <CurativeExceptionsSection
        orderId={id}
        exceptions={exceptions ?? []}
        beginAt={beginExceptionsAt}
        commitmentStatus={commitmentStatus}
      />
    </div>
  )
}
```

Note: this page reads from `commitment_sch_a`, `commitment_sch_b_settings`, `commitment_requirements`, and `commitment_exceptions` — all from prior Title increments. It duplicates the same numbering-offset lookup Sch B's own page does (form_type → standard count → settings row) rather than extracting a shared helper — both pages are the only two callers, and the lookup is ~6 lines; not worth a shared abstraction yet. If a third caller ever needs it, factor it out then.

- [ ] **Step 3: Verify with a build**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/FileSectionsNav.tsx "src/app/orders/[id]/curative/page.tsx"
git commit -m "feat: wire Curative route and nav"
```

---

### Task 9: E2E test suite extension

**Suggested model:** sonnet (test design needs judgment about the Draft → Final → CTC → Rescind → Draft state machine)

**Files:**
- Modify: `tests/e2e/order-entry.spec.ts`

- [ ] **Step 1: Add the test**

Append to `tests/e2e/order-entry.spec.ts`, after the Commitment Schedule B test. This test builds its own order, Prelim Search data, and Schedule B Requirement/Exception first (Curative has no chip sourcing or manual-add of its own — it only operates on rows Schedule B already created):

```ts
  test('curative: finalize, disposition, issue CTC, rescind, revert to draft', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    const fileNumber = `TEST-${Date.now()}`
    await page.getByLabel('File Number').fill(fileNumber)
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Prelim Title Search' }).click()
    await page.waitForURL('**/prelim-search')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForURL('**/prelim-search')
    await page.waitForLoadState('networkidle')

    await page.getByText('Add a Security Instrument').click()
    const siForm = page.locator('details:has-text("Add a Security Instrument")')
    await page.locator('#si-new-type').click()
    await page.getByRole('option', { name: 'Deed of Trust' }).click()
    await siForm.getByLabel('Mortgagor').fill('Test Owner')
    await siForm.getByLabel('Mortgagee').fill('Test Lender')
    await siForm.getByRole('button', { name: 'Add Security Instrument' }).click()
    await expect(page.getByTestId('security-instrument-row')).toContainText('Deed of Trust')

    await page.getByText('Add an Exception Matter').click()
    const emForm = page.locator('details:has-text("Add an Exception Matter")')
    await emForm.getByLabel('Description').fill('Utility easement of record')
    await emForm.getByRole('button', { name: 'Add Exception Matter' }).click()
    await expect(page.getByTestId('exception-matter-row')).toContainText('Utility easement of record')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch B-I/B-II' }).click()
    await page.waitForURL('**/commitment-sch-b')
    await page.getByTestId('si-req-chip').click()
    await expect(page.getByTestId('requirement-row')).toContainText('Release of Deed of Trust')
    await page.getByTestId('em-exc-chip').click()
    await expect(page.getByTestId('exception-row')).toContainText('Utility easement of record')

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Curative' }).click()
    await page.waitForURL('**/curative')

    // Draft: rows show a delete control, no disposition fields, Issue CTC disabled
    await expect(page.getByTestId('curative-requirement-row')).toContainText('Release of Deed of Trust')
    await expect(page.getByTestId('curative-requirement-row').getByRole('button', { name: 'Remove' })).toBeVisible()
    await expect(page.getByTestId('curative-requirement-row').locator('select[name="disposition"]')).toHaveCount(0)
    await expect(page.getByTestId('issue-ctc-button')).toBeDisabled()

    // The Sch B screen is still fully editable pre-Finalize
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch B-I/B-II' }).click()
    await page.waitForURL('**/commitment-sch-b')
    await expect(page.getByTestId('requirement-row').getByRole('button', { name: 'Remove' })).toBeVisible()

    // Finalize
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Curative' }).click()
    await page.waitForURL('**/curative')
    await page.getByTestId('finalize-button').click()
    await expect(page.getByTestId('revert-to-draft-button')).toBeVisible()
    await expect(page.getByTestId('curative-requirement-row').getByRole('button', { name: 'Remove' })).toHaveCount(0)
    await expect(page.getByTestId('curative-requirement-row').locator('select[name="disposition"]')).toBeVisible()

    // orders.title_status flips to Curative
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Order Info' }).click()
    await page.waitForURL('**/order-info')
    await expect(page.locator('#title_status')).toHaveValue('Curative')

    // Sch B is now read-only
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch B-I/B-II' }).click()
    await page.waitForURL('**/commitment-sch-b')
    await expect(page.getByTestId('requirement-row').getByRole('button', { name: 'Remove' })).toHaveCount(0)
    await expect(page.getByTestId('requirement-chips')).toHaveCount(0)

    // Disposition the Requirement, but leave the Exception undispositioned - CTC stays gated
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Curative' }).click()
    await page.waitForURL('**/curative')
    await page.getByTestId('curative-requirement-row').locator('select[name="disposition"]').selectOption('Released')
    await page.getByTestId('curative-requirement-row').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('issue-ctc-button')).toBeDisabled()

    // Don't Show the Exception instead of dispositioning it - still satisfies the CTC gate
    await page.getByTestId('curative-exception-row').locator('input[name="dont_show"]').check()
    await page.getByTestId('curative-exception-row').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('issue-ctc-button')).toBeEnabled()

    // Issue CTC
    await page.getByTestId('issue-ctc-button').click()
    await expect(page.getByTestId('ctc-issued-label')).toBeVisible()
    await expect(page.getByTestId('revert-to-draft-button')).toBeDisabled()

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Order Info' }).click()
    await page.waitForURL('**/order-info')
    await expect(page.locator('#title_status')).toHaveValue('Cleared for Policy')

    // Rescind CTC
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Curative' }).click()
    await page.waitForURL('**/curative')
    await page.getByTestId('rescind-ctc-button').click()
    await expect(page.getByTestId('issue-ctc-button')).toBeVisible()
    await expect(page.getByTestId('revert-to-draft-button')).toBeEnabled()

    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Order Info' }).click()
    await page.waitForURL('**/order-info')
    await expect(page.locator('#title_status')).toHaveValue('Curative')

    // Revert to Draft
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Curative' }).click()
    await page.waitForURL('**/curative')
    await page.getByTestId('revert-to-draft-button').click()
    await expect(page.getByTestId('finalize-button')).toBeVisible()
    await expect(page.getByTestId('curative-requirement-row').getByRole('button', { name: 'Remove' })).toBeVisible()

    // Sch B is editable again
    await page.getByTestId('file-section-nav').getByRole('link', { name: 'Commitment Sch B-I/B-II' }).click()
    await page.waitForURL('**/commitment-sch-b')
    await expect(page.getByTestId('requirement-row').getByRole('button', { name: 'Remove' })).toBeVisible()
  })
```

- [ ] **Step 2: Run the full suite and verify**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run dev -- -p 3100 > /tmp/genesis-curative-task9-dev.log 2>&1 &
sleep 4
PLAYWRIGHT_BASE_URL="http://localhost:3100" npm run test:e2e
```

Expected: all tests pass (count = existing suite size + 1). Kill the dev server before finishing.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/order-entry.spec.ts
git commit -m "test: add Curative E2E coverage"
```

---

### Task 10: Final verification, deploy check, and vault sync

**Suggested model:** sonnet (final gate before deploy)

- [ ] **Step 1: Full local verification**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
npm run lint
npm run build
```

- [ ] **Step 2: Push and confirm the Vercel auto-deploy**

```bash
cd "/Volumes/T7/Claude Code/Genesis Platform/genesis-app"
git fetch origin && git status
git push origin main
```

Then, after the deploy completes:

```bash
PLAYWRIGHT_BASE_URL="https://genesis-app-tau.vercel.app" npx playwright test
```

- [ ] **Step 3: Update the vault**

In `M&L Title - Obsidian Vault/Genesis Build Log.md`, add a change-log entry: Curative shipped (Finalize/Revert to Draft, per-row Disposition/Disposition Notes/Don't Show, Issue CTC gating, Rescind CTC, Schedule B read-only once finalized), commit range, test results.

In `Genesis Rebuild - Curative Design.md`, change frontmatter `status:` to `implemented`.

- [ ] **Step 4: Re-sync T7 → Desktop backup and verify**

```bash
rsync -av --delete "/Volumes/T7/Claude Code/Genesis Platform/" "/Users/campenny/Desktop/Claude Code/Genesis Platform/"
bash "/Volumes/T7/Claude Code/Genesis Platform/.claude/hooks/verify-sync.sh"
```

---

## Self-Review

**Spec coverage:** `curative_settings` schema, Finalize/Revert, per-row Disposition/Disposition Notes/Don't Show in Final state, delete-only in Draft state, Issue CTC gating on full dispositioning, Rescind CTC, `orders.title_status` transitions (Curative on Finalize, Cleared for Policy on Issue CTC, Curative on Rescind) — Tasks 1, 3, 5-8 ✓. Sch B/Curative "separate screens" architecture decision, made load-bearing by Task 4's read-only gating (otherwise Finalize would not actually stop deletion) ✓. Decision-tree logic, task auto-generation, Schedule D, and permission gating correctly absent — never referenced ✓. CTC document generation and Attachments correctly absent per the 2026-08-31 scope narrowing — never referenced ✓. Nav wiring — Task 8 Step 1 ✓.

**Placeholder scan:** No TBD/TODO. The design doc's "existing 'proceed?' confirm" phrase for Draft-state delete doesn't correspond to any real code — grepped the codebase and no `confirm()`/proceed pattern exists anywhere, including Sch B's own delete buttons (plain submit, no dialog). Tasks 5-6's Draft-state delete buttons match that actual, current convention rather than inventing a confirm dialog no other delete control in the app has.

**Type consistency:** `CurativeSettings` (Task 2) field names match the migration's columns (Task 1) exactly. `updateRequirementDisposition`/`updateExceptionDisposition`/`finalizeCommitment`/`revertToDraft`/`issueCTC`/`rescindCTC` (Task 3) signatures match their `.bind()` call sites in Tasks 5-7 exactly. `CurativeRequirementsSection`/`CurativeExceptionsSection`/`FinalizeControl`/`CTCControl` (Tasks 5-7) prop shapes match exactly what Task 8's page passes. `RequirementsSection`/`ExceptionsSection`'s new `readOnly` prop (Task 4) matches exactly what the Sch B page (modified in that same task) passes.
