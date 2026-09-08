import Link from 'next/link'
import { addContact, deleteContact } from '@/app/actions/contacts'
import { Button } from '@/components/ui/button'
import { AddContactForm } from '@/components/AddContactForm'
import { ContactPrincipalRoster } from '@/components/ContactPrincipalRoster'
import { SignatureLinesDialog } from '@/components/SignatureLinesDialog'
import {
  PRINCIPAL_ROLES,
  CONTACT_ROLES_WITH_TEAM_ROSTER,
  TEAM_ROSTER_ROLES,
  CONTACT_ROLES_WITH_ENTITY_TYPE,
} from '@/lib/constants'
import type { Contact, ContactPrincipal, ContactSignatureLine } from '@/lib/types'

// "People Box" — only entity types with an actual roster concept get one.
const PRINCIPAL_ROSTER_LABELS: Record<string, string> = {
  Trust: 'Trustees',
  LLC: 'Member Managers',
}

export function ContactsSection({
  orderId,
  contacts,
  principalsByContact,
  signatureLinesByContact,
  propertyAddress,
}: {
  orderId: string
  contacts: Contact[]
  principalsByContact: Map<string, ContactPrincipal[]>
  signatureLinesByContact: Map<string, ContactSignatureLine[]>
  propertyAddress?: string | null
}) {
  const addContactWithOrderId = addContact.bind(null, orderId)

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Contacts</h2>

      <ul className="mb-6 space-y-2" data-testid="contact-list">
        {contacts.map((c) => {
          const rosterLabel = PRINCIPAL_ROSTER_LABELS[c.entity_type]
          const hasTeamRoster = CONTACT_ROLES_WITH_TEAM_ROSTER.includes(c.role)
          const linkedContact = c.linked_contact_id ? contacts.find((o) => o.id === c.linked_contact_id) : undefined
          return (
            <li key={c.id} className="rounded border p-3" data-testid="contact-row">
              <div className="flex items-center justify-between">
                <div>
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
                </div>
                <div className="flex items-center gap-2">
                  {CONTACT_ROLES_WITH_ENTITY_TYPE.includes(c.role) && (
                    <SignatureLinesDialog
                      orderId={orderId}
                      contact={c}
                      principals={principalsByContact.get(c.id) ?? []}
                      signatureLines={signatureLinesByContact.get(c.id) ?? []}
                    />
                  )}
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
              {rosterLabel && (
                <ContactPrincipalRoster
                  orderId={orderId}
                  contactId={c.id}
                  roles={PRINCIPAL_ROLES[c.entity_type] ?? []}
                  principals={principalsByContact.get(c.id) ?? []}
                  label={rosterLabel}
                />
              )}
              {hasTeamRoster && (
                <ContactPrincipalRoster
                  orderId={orderId}
                  contactId={c.id}
                  roles={TEAM_ROSTER_ROLES}
                  principals={principalsByContact.get(c.id) ?? []}
                  label="Team Contacts"
                />
              )}
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
