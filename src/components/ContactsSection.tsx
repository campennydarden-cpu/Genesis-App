import Link from 'next/link'
import { addContact, deleteContact } from '@/app/actions/contacts'
import { Button } from '@/components/ui/button'
import { AddContactForm } from '@/components/AddContactForm'
import { ContactPrincipalRoster } from '@/components/ContactPrincipalRoster'
import type { Contact, ContactPrincipal } from '@/lib/types'

// "People Box" — only entity types with an actual roster concept get one.
const PRINCIPAL_ROSTER_LABELS: Record<string, string> = {
  Trust: 'Trustees',
  LLC: 'Member Managers',
}

export function ContactsSection({
  orderId,
  contacts,
  principalsByContact,
}: {
  orderId: string
  contacts: Contact[]
  principalsByContact: Map<string, ContactPrincipal[]>
}) {
  const addContactWithOrderId = addContact.bind(null, orderId)

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Contacts</h2>

      <ul className="mb-6 space-y-2" data-testid="contact-list">
        {contacts.map((c) => {
          const rosterLabel = PRINCIPAL_ROSTER_LABELS[c.entity_type]
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
                </div>
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
              {rosterLabel && (
                <ContactPrincipalRoster
                  orderId={orderId}
                  contactId={c.id}
                  entityType={c.entity_type}
                  principals={principalsByContact.get(c.id) ?? []}
                  label={rosterLabel}
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
        <AddContactForm action={addContactWithOrderId} />
      </details>
    </div>
  )
}
