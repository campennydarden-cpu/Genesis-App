# Contacts Two-Step List/Card IA Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Contacts list a lightweight list, and move the People Box (`ContactPrincipalRoster`) and Edit Signature (`SignatureLinesDialog`) — currently rendered inline on every list row — onto the per-contact detail page, so clicking into a contact opens a real "card" where all of that detail work happens, matching SoftPro's list-then-card pattern from the reference screenshots.

**Architecture:** No new tables or types — this moves existing components and their data-fetching from `contacts/page.tsx` + `ContactsSection.tsx` (the list) to `contacts/[contactId]/edit/page.tsx` (the card), and makes each list row's name/role block a link to that same page it already links to via its "Edit" button.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres), React (client components), Playwright e2e.

**Spec:** No separate spec file — bounded change approved in chat 2026-09-11. Source requirement: `Cam's Screen Notes.md` (Contacts section, line 331: "The first screen when you click contacts needs to be a list of contacts. You then click on the contact in that screen to open the Contact card itself. That is where the people box, edit signature, edit, etc. need to live.") and [[Genesis Screen Notes - Fix Plan]] (Tier 5, item 16). Reference layout: `M&L Title - Obsidian Vault/SoftPro Screenshots/Order Contacts Buyer.Borrower *.png` and `Title Company Order Contact Card *.png`.

## Global Constraints

- The existing `/edit` route is not renamed — it already is "the contact card" in every sense that matters (it's where the full field-edit form lives); this plan adds the People Box and Edit Signature to it rather than creating a new route.
- Remove (delete) stays on the list row as a quick action — Cam's note only calls out People Box, Edit Signature, and "edit" moving to the card; deleting a contact from the list itself is unaffected.
- The explicit "Edit" link/button on each list row is not removed — the row's name/role block becomes an additional clickable target to the same destination, so there are two ways in (matches the SoftPro reference: the whole row is clickable there, but this codebase's existing e2e tests already click "Edit" by role name, and keeping both avoids breaking that coverage for no reason).
- No e2e tests currently assert on `ContactPrincipalRoster`/`SignatureLinesDialog` rendering inline on the list page (checked `tests/e2e/*.spec.ts` during planning) — moving them is not expected to break any existing test.

---

### Task 1: `ContactsSection.tsx` — strip the People Box/Signature Lines, make the row clickable

**Files:**
- Modify: `src/components/ContactsSection.tsx`

**Interfaces:**
- Produces: `ContactsSection`'s props drop `principalsByContact`/`signatureLinesByContact` — consumed by Task 2 (`contacts/page.tsx`, which stops fetching/passing them).

- [ ] **Step 1: Rewrite the component**

Replace `src/components/ContactsSection.tsx` in full:

```tsx
import Link from 'next/link'
import { addContact, deleteContact } from '@/app/actions/contacts'
import { Button } from '@/components/ui/button'
import { AddContactForm } from '@/components/AddContactForm'
import type { Contact } from '@/lib/types'

export function ContactsSection({
  orderId,
  contacts,
  propertyAddress,
}: {
  orderId: string
  contacts: Contact[]
  propertyAddress?: string | null
}) {
  const addContactWithOrderId = addContact.bind(null, orderId)

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Contacts</h2>

      <ul className="mb-6 space-y-2" data-testid="contact-list">
        {contacts.map((c) => {
          const linkedContact = c.linked_contact_id ? contacts.find((o) => o.id === c.linked_contact_id) : undefined
          return (
            <li key={c.id} className="rounded border p-3" data-testid="contact-row">
              <div className="flex items-center justify-between">
                <Link href={`/orders/${orderId}/contacts/${c.id}/edit`} className="block hover:underline">
                  <p className="font-medium">
                    {c.name} <span className="text-slate-500">— {c.role}</span>
                  </p>
                  <p className="text-sm text-slate-500">
                    {c.entity_type}
                    {c.phone ? ` · ${c.phone}` : ''}
                    {c.email ? ` · ${c.email}` : ''}
                  </p>
                  {linkedContact && (
                    <p className="text-sm text-slate-500" data-testid="contact-linked-spouse">
                      🔗 Linked to {linkedContact.name}
                    </p>
                  )}
                </Link>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    render={<Link href={`/orders/${orderId}/contacts/${c.id}/edit`}>Edit</Link>}
                  />
                  <form action={deleteContact.bind(null, orderId, c.id)}>
                    <Button type="submit" variant="destructive" size="sm" className="min-h-11">
                      Remove
                    </Button>
                  </form>
                </div>
              </div>
            </li>
          )
        })}
        {contacts.length === 0 && (
          <p className="text-sm text-slate-500">No contacts added yet.</p>
        )}
      </ul>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">Add a contact</summary>
        <AddContactForm action={addContactWithOrderId} propertyAddress={propertyAddress} />
      </details>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ContactsSection.tsx
git commit -m "refactor: strip People Box/Signature Lines from the Contacts list, make rows link to the contact card"
```

---

### Task 2: `contacts/page.tsx` — stop fetching principals/signature lines for the list

**Files:**
- Modify: `src/app/orders/[id]/contacts/page.tsx`

**Interfaces:**
- Consumes: `ContactsSection`'s narrowed props (Task 1).

- [ ] **Step 1: Rewrite the page**

Replace `src/app/orders/[id]/contacts/page.tsx` in full:

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactsSection } from '@/components/ContactsSection'
import { Alert, AlertDescription } from '@/components/ui/alert'

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

  const { data: order } = await supabase.from('orders').select('id, property_address').eq('id', id).single()

  if (!order) {
    notFound()
  }

  const { data: property } = await supabase
    .from('property_details')
    .select('property_address')
    .eq('order_id', id)
    .maybeSingle()
  const propertyAddress = property?.property_address ?? order.property_address ?? null

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ContactsSection orderId={id} contacts={contacts ?? []} propertyAddress={propertyAddress} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/orders/[id]/contacts/page.tsx
git commit -m "refactor: stop fetching principals/signature lines on the Contacts list page"
```

---

### Task 3: `[contactId]/edit/page.tsx` — the Contact Card gains People Box and Edit Signature

**Files:**
- Modify: `src/app/orders/[id]/contacts/[contactId]/edit/page.tsx`

**Interfaces:**
- Consumes: `ContactPrincipalRoster` and `SignatureLinesDialog` (both already exist, unchanged — `src/components/ContactPrincipalRoster.tsx`, `src/components/SignatureLinesDialog.tsx`).

- [ ] **Step 1: Rewrite the page**

Replace `src/app/orders/[id]/contacts/[contactId]/edit/page.tsx` in full:

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AddContactForm } from '@/components/AddContactForm'
import { ContactPrincipalRoster } from '@/components/ContactPrincipalRoster'
import { SignatureLinesDialog } from '@/components/SignatureLinesDialog'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  PRINCIPAL_ROLES,
  CONTACT_ROLES_WITH_TEAM_ROSTER,
  TEAM_ROSTER_ROLES,
  CONTACT_ROLES_WITH_ENTITY_TYPE,
} from '@/lib/constants'
import type { ContactPrincipal, ContactSignatureLine } from '@/lib/types'

// "People Box" — only entity types with an actual roster concept get one. Moved here
// (from ContactsSection.tsx, Tier 5 item 16) unchanged.
const PRINCIPAL_ROSTER_LABELS: Record<string, string> = {
  Trust: 'Trustees',
  LLC: 'Member Managers',
}

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string; contactId: string }>
}) {
  const { id, contactId } = await params
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('order_id', id)
    .single()

  if (!contact) {
    notFound()
  }

  const { data: order } = await supabase.from('orders').select('property_address').eq('id', id).single()
  const { data: property } = await supabase
    .from('property_details')
    .select('property_address')
    .eq('order_id', id)
    .maybeSingle()
  const propertyAddress = property?.property_address ?? order?.property_address ?? null

  // Same-role siblings on this file are the only valid link candidates (Buyer/Borrower
  // links to another Buyer/Borrower, Seller to another Seller).
  const { data: linkCandidates } = await supabase
    .from('contacts')
    .select('id, name, current_address, mailing_address, forwarding_address')
    .eq('order_id', id)
    .eq('role', contact.role)
    .neq('id', contactId)

  const { data: principals } = await supabase
    .from('contact_principals')
    .select('*')
    .eq('contact_id', contactId)
  const { data: signatureLines } = await supabase
    .from('contact_signature_lines')
    .select('*')
    .eq('contact_id', contactId)

  const rosterLabel = PRINCIPAL_ROSTER_LABELS[contact.entity_type]
  const hasTeamRoster = CONTACT_ROLES_WITH_TEAM_ROSTER.includes(contact.role)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {contact.name} <span className="text-slate-500">— {contact.role}</span>
        </h2>
        {CONTACT_ROLES_WITH_ENTITY_TYPE.includes(contact.role) && (
          <SignatureLinesDialog
            orderId={id}
            contact={contact}
            principals={(principals ?? []) as ContactPrincipal[]}
            signatureLines={(signatureLines ?? []) as ContactSignatureLine[]}
          />
        )}
      </div>

      <AddContactForm
        orderId={id}
        contact={contact}
        propertyAddress={propertyAddress}
        linkCandidates={linkCandidates ?? []}
      />

      {rosterLabel && (
        <ContactPrincipalRoster
          orderId={id}
          contactId={contact.id}
          roles={PRINCIPAL_ROLES[contact.entity_type] ?? []}
          principals={(principals ?? []) as ContactPrincipal[]}
          label={rosterLabel}
        />
      )}
      {hasTeamRoster && (
        <ContactPrincipalRoster
          orderId={id}
          contactId={contact.id}
          roles={TEAM_ROSTER_ROLES}
          principals={(principals ?? []) as ContactPrincipal[]}
          label="Team Contacts"
        />
      )}

      <Button
        variant="ghost"
        size="sm"
        className="mt-4"
        render={<Link href={`/orders/${id}/contacts`}>Back to Contacts</Link>}
      />
    </div>
  )
}
```

- [ ] **Step 2: Run the app locally and sanity-check by eye**

Run: `npm run dev` from `genesis-app/`. Create an order, add a Buyer/Borrower contact and a Trust-entity-type contact from the list.
Expected: the Contacts list shows just name/role/entity-type/phone/email rows with Edit/Remove — no People Box, no Signature Lines button. Clicking a row's name (not just "Edit") navigates to its card. On the Trust contact's card, the "Trustees" People Box appears; on any contact with an entity type, the Edit Signature button appears in the card header.

- [ ] **Step 3: Commit**

```bash
git add "src/app/orders/[id]/contacts/[contactId]/edit/page.tsx"
git commit -m "feat: move People Box and Edit Signature onto the Contact Card"
```

---

### Task 4: e2e test — row click navigates to the card, card shows People Box/Signature

**Files:**
- Modify: `tests/e2e/order-entry.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-3.

- [ ] **Step 1: Write the test**

Add inside the existing `test.describe('Genesis foundation phase', ...)` block:

```typescript
  test('contacts: clicking a row opens the Contact Card with People Box and Edit Signature', async ({ page }) => {
    await loginAsSeededUser(page)

    await page.getByRole('link', { name: '+ New Order' }).click()
    await page.getByRole('button', { name: 'Create Order' }).click()
    await page.waitForURL('**/orders/**/order-entry')
    const orderId = page.url().match(/\/orders\/([^/]+)\/order-entry/)?.[1]

    await page.goto(`/orders/${orderId}/contacts`)
    await page.getByText('Add a contact').click()
    await page.getByLabel('Role').click()
    await page.getByRole('option', { name: 'Buyer/Borrower', exact: true }).click()
    await page.getByLabel('Entity Type').click()
    await page.getByRole('option', { name: 'Trust', exact: true }).click()
    await page.getByLabel('Name').fill('Penny-Darden Family Trust')
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await expect(page.getByTestId('contact-row').filter({ hasText: 'Penny-Darden Family Trust' })).toBeVisible()

    // The list row itself has no People Box or Edit Signature button on it anymore.
    await expect(page.getByTestId('contact-row').getByText('Trustees')).not.toBeVisible()
    await expect(page.getByTestId('contact-row').getByRole('button', { name: /Signature/ })).not.toBeVisible()

    // Clicking the row's name (not the "Edit" button) navigates to the card.
    await page.getByTestId('contact-row').filter({ hasText: 'Penny-Darden Family Trust' }).getByText('Penny-Darden Family Trust').click()
    await page.waitForURL('**/edit')

    await expect(page.getByRole('heading', { name: /Penny-Darden Family Trust/ })).toBeVisible()
    await expect(page.getByText('Trustees')).toBeVisible()
    await expect(page.getByRole('button', { name: /Signature/ })).toBeVisible()
  })
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/order-entry.spec.ts -g "Contact Card"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/order-entry.spec.ts
git commit -m "test: Contacts list-to-card navigation and card contents"
```
