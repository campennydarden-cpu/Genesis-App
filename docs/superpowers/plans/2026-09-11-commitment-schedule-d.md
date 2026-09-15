# Commitment Schedule D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tier 6 item 19. Build the Commitment Schedule D File Section — the ALTA/Texas title-insurance premium-split disclosure ("$X to the issuing Title Insurance Company; $Y retained by the issuing Title Insurance Agent; remainder to other parties"). New nav-group screen under Title, alongside Commitment Sch A/Sch B-I/B-II.

**Source:** `M&L Title - Obsidian Vault/SoftPro Screenshots/Commitment Sch D.png` and `Sch D.png` (two orders, different premium totals, same 15/85 split values — confirms the top-level split is a **percentage**, not a fixed dollar amount). [[Genesis Screen Notes - Fix Plan]] lines 93, 235, 474: confirmed real requirement, Texas-specific, "needs full brainstorming from scratch (not a port)."

**Architecture:**
- **Estimated Title Premium grid is computed, not manually entered.** Reuses the exact "pure sum, recomputed fresh on every page load, never stored" convention already established by `lib/cdf-page2.ts`'s `computeCdfPage2Totals` and Recording's `syncRecordingCdfLines`: a new `computeScheduleDPremium(premiums, endorsements)` sums `title_insurance_premiums.final_premium` (grouped by Owner's/Loan policy_type, only showing a row when nonzero — matches the screenshots, where the Refinance order with no Owner Policy simply omits that row) plus total `endorsements.charge`. This keeps Schedule D honest to whatever's actually on the Premiums & Endorsements screen instead of risking a second, driftable copy of the same numbers.
- **Only the split percentages and the Remainder Breakdown are real per-order data**, stored in one `commitment_sch_d` row per order plus a repeating `commitment_sch_d_remainder_rows` list (same add/edit/delete list pattern as Commitment Sch A's Chain of Title).
- **No nav-gating.** `FileSectionsNav.tsx` has no conditional-visibility mechanism anywhere today (every nav item is a static always-shown list) and building one is explicitly out of scope here — Transaction Type's own full nav-gating matrix (Tier 5 item 13) is still unplanned for the same reason. Schedule D is always in the nav like every other screen; the screen itself shows a plain informational notice when `property_details.state` isn't Texas, rather than hiding the link.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres), React (client component), Playwright e2e.

**Spec:** No separate design doc — built directly from the SoftPro reference screenshots per Global Constraints below (same "port what the screenshot shows" approach as Commitment Sch A/B).

## Global Constraints

- Migrations use `text` + `check (col in (...))` for enums, `numeric(14,2)` for money/percent, matching every prior migration in this repo. Every table gets RLS enabled with `for all to authenticated using (true) with check (true)`.
- `to_whom` on Remainder Breakdown rows follows the established linked-contact-plus-free-text-fallback pattern (`to_whom_contact_id` nullable FK to `contacts`, `to_whom_text` free text) — same shape as `payee_contact_id`/`second_party_name` elsewhere.
- **"Include in Total" is captured but not wired into any other screen's total in this pass.** No existing total (CDF Page 2/3, Cash to Close) currently expects a Schedule D contribution — flag rather than speculatively wire, same call already made for Invoices/Payors in the Fix Plan notes.
- **Company/agent split percentages start blank, no hardcoded default (Cam's call, 2026-09-11).** The 15/85 seen in both screenshots is this office's real split, not a system constant — it's meant to come from an admin-configurable default, not be baked into this migration. No admin settings surface exists anywhere in this app yet (checked: no `organization_settings`/`admin_settings`/firm-level config table of any kind), so wiring an actual default-prefill is out of scope for this plan — flag rather than build speculatively, same call already made for Invoices/Payors. When that admin panel exists, it should prefill `company_split_percent`/`agent_split_percent` on `getOrCreateCommitmentSchD`'s first-create path; until then, both fields are simply blank on a new order.
- State-conditional notice compares `property_details.state` case-insensitively against `'TX'`/`'Texas'` (that field is free text, not an enum — same caveat already documented for `contacts.role` in the Sch A plan) — never blocks data entry, purely informational.
- No unit-test framework in this repo — new pure-function math (`computeScheduleDPremium`, split/remainder calc) gets a `demo()`/`console.assert` self-check gated behind `NODE_ENV === 'test'`, matching `lib/cdf-page2.ts`'s own convention; screen behavior is covered by Playwright e2e.

---

### Task 1: Migration — `commitment_sch_d`, `commitment_sch_d_remainder_rows`

**Files:**
- Create: `supabase/migrations/00XX_commitment_sch_d.sql`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Find the real next migration number** — `ls supabase/migrations | sort -V | tail -3`.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/00XX_commitment_sch_d.sql
-- Tier 6 item 19: Commitment Schedule D, the ALTA/Texas title-premium-split
-- disclosure. Estimated Title Premium itself is computed live from
-- title_insurance_premiums + endorsements (see lib/commitment-sch-d.ts) — only the
-- split percentages and Remainder Breakdown rows are real stored data.
create table public.commitment_sch_d (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  include_in_total boolean not null default false,
  company_split_percent numeric(5,2),
  agent_split_percent numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.commitment_sch_d enable row level security;
create policy "commitment_sch_d_all" on public.commitment_sch_d for all to authenticated using (true) with check (true);

create table public.commitment_sch_d_remainder_rows (
  id uuid primary key default gen_random_uuid(),
  commitment_sch_d_id uuid not null references public.commitment_sch_d(id) on delete cascade,
  percent_or_amount text not null default 'Percent' check (percent_or_amount in ('Percent', 'Amount')),
  value numeric(14,2),
  code text,
  to_whom_contact_id uuid references public.contacts(id) on delete set null,
  to_whom_text text,
  for_services text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.commitment_sch_d_remainder_rows enable row level security;
create policy "commitment_sch_d_remainder_rows_all" on public.commitment_sch_d_remainder_rows for all to authenticated using (true) with check (true);
```

- [ ] **Step 3: Apply the migration.**

- [ ] **Step 4: Add types to `src/lib/types.ts`**

```typescript
export type CommitmentSchD = {
  id: string
  order_id: string
  include_in_total: boolean
  company_split_percent: number | null
  agent_split_percent: number | null
}

export type CommitmentSchDRemainderRow = {
  id: string
  commitment_sch_d_id: string
  percent_or_amount: 'Percent' | 'Amount'
  value: number | null
  code: string | null
  to_whom_contact_id: string | null
  to_whom_text: string | null
  for_services: string | null
  sort_order: number
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00XX_commitment_sch_d.sql src/lib/types.ts
git commit -m "feat: add commitment_sch_d and remainder-row tables"
```

---

### Task 2: `lib/commitment-sch-d.ts` — computed premium/split math

**Files:**
- Create: `src/lib/commitment-sch-d.ts`

- [ ] **Step 1: Write the pure computation**

```typescript
import type { TitleInsurancePremium, Endorsement, CommitmentSchD } from './types'

export type ScheduleDPremium = {
  ownerPolicy: number | null
  loanPolicy: number | null
  endorsementCharges: number | null
  total: number
}

// Never stored — recomputed fresh from Premiums & Endorsements on every page load,
// same discipline as computeCdfPage2Totals. A row is omitted (not shown as $0) when
// its category has no charges, matching both reference screenshots (the Refinance
// order shows no Owner Policy row at all).
export function computeScheduleDPremium(premiums: TitleInsurancePremium[], endorsements: Endorsement[]): ScheduleDPremium {
  const sumBy = (type: string) =>
    premiums.filter((p) => p.policy_type === type).reduce((acc, p) => acc + (p.final_premium ?? p.base_premium ?? 0), 0)
  const ownerPolicy = sumBy("Owner's") || null
  const loanPolicy = sumBy('Loan') || null
  const endorsementCharges = endorsements.reduce((acc, e) => acc + (e.charge ?? 0), 0) || null
  const total = (ownerPolicy ?? 0) + (loanPolicy ?? 0) + (endorsementCharges ?? 0)
  return { ownerPolicy, loanPolicy, endorsementCharges, total }
}

export type ScheduleDSplit = { companyAmount: number; agentAmount: number; remainderAmount: number }

export function computeScheduleDSplit(total: number, schD: Pick<CommitmentSchD, 'company_split_percent' | 'agent_split_percent'>): ScheduleDSplit {
  const companyAmount = total * ((schD.company_split_percent ?? 0) / 100)
  const agentAmount = total * ((schD.agent_split_percent ?? 0) / 100)
  return { companyAmount, agentAmount, remainderAmount: total - companyAmount - agentAmount }
}

function demo() {
  const total = computeScheduleDPremium(
    [{ policy_type: 'Loan', final_premium: 330, base_premium: null } as TitleInsurancePremium],
    [{ charge: 83 } as Endorsement]
  )
  console.assert(total.loanPolicy === 330, `expected loanPolicy 330, got ${total.loanPolicy}`)
  console.assert(total.ownerPolicy === null, `expected ownerPolicy null (no Owner premium), got ${total.ownerPolicy}`)
  console.assert(total.total === 413, `expected total 413 (330+83), got ${total.total}`)

  const split = computeScheduleDSplit(413, { company_split_percent: 15, agent_split_percent: 85 })
  console.assert(Math.round(split.companyAmount) === 62, `expected company amount ~62 (15% of 413), got ${split.companyAmount}`)
  console.assert(Math.round(split.agentAmount) === 351, `expected agent amount ~351 (85% of 413), got ${split.agentAmount}`)
  console.assert(Math.round(split.remainderAmount) === 0, `expected 0 remainder at 15+85=100%, got ${split.remainderAmount}`)
}

if (process.env.NODE_ENV === 'test') demo()
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/commitment-sch-d.ts
git commit -m "feat: Schedule D premium and split computation"
```

---

### Task 3: Server actions

**Files:**
- Create: `src/app/actions/commitment-sch-d.ts`

- [ ] **Step 1: Write the actions** — `getOrCreateCommitmentSchD(orderId)` (upsert-on-first-load, same pattern as `upsertPropertyDetails`'s "first save creates the row" but eager here since there's nothing optional to wait on), `updateCommitmentSchD(orderId, formData)` (include_in_total, company_split_percent, agent_split_percent), `addRemainderRow`/`updateRemainderRow`/`deleteRemainderRow` (mirrors Chain of Title's add/edit/delete on Sch A), and `listPremiumsAndEndorsementsForSchD(orderId)` returning the raw `title_insurance_premiums`/`endorsements` rows for Task 2's computation to run against client-side.

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/commitment-sch-d.ts
git commit -m "feat: Commitment Schedule D server actions"
```

---

### Task 4: `CommitmentScheduleDForm.tsx` + page

**Files:**
- Create: `src/components/commitment-sch-d/CommitmentScheduleDForm.tsx`
- Create: `src/app/orders/[id]/commitment-sch-d/page.tsx`
- Modify: `src/components/FileSectionsNav.tsx` — add `{ label: 'Commitment Sch D', segment: 'commitment-sch-d' }` right after `'Commitment Sch B-I/B-II'` in the Title group.

- [ ] **Step 1: Build the screen**

Layout, top to bottom: a TX-only informational notice (shown when `property_details.state` doesn't case-insensitively match `TX`/`Texas` — plain text banner, not a blocker); "Estimated Title Premium" read-only grid (Owner Policy / Loan Policy / Endorsement Charges rows, each omitted when null, from `computeScheduleDPremium`) with an "Include in Total" checkbox and a read-only "Total estimated premium" figure; the split sentence as two inline percent inputs (`company_split_percent`, `agent_split_percent`) with the computed dollar amounts and remainder shown live via `computeScheduleDSplit`; the "Remainder Breakdown" repeating table (Percent-or-Amount select, Code text, To Whom contact-or-free-text pair, For Services text) using the exact add/edit/delete list pattern from `ChainOfTitleSection.tsx`.

- [ ] **Step 2: Run the app locally and sanity-check by eye**

`npm run dev`. Confirm the grid matches a seeded order's actual Premiums/Endorsements totals, split percentages compute the right dollar figures, and the nav link is always present regardless of the order's state (TX shows no notice, any other state shows the informational banner).

- [ ] **Step 3: Commit**

```bash
git add src/components/commitment-sch-d/CommitmentScheduleDForm.tsx src/app/orders/[id]/commitment-sch-d/page.tsx src/components/FileSectionsNav.tsx
git commit -m "feat: Commitment Schedule D screen"
```

---

### Task 5: e2e test

**Files:**
- Create: `tests/e2e/commitment-sch-d.spec.ts`

- [ ] **Step 1: Write a test** covering: the premium grid reflects existing seeded Premiums/Endorsements data, entering split percentages computes the right amounts, adding/editing/deleting a Remainder Breakdown row persists.

- [ ] **Step 2: Run it, confirm PASS.**

- [ ] **Step 3: Commit.**
