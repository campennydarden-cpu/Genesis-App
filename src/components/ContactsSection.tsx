import { addContact, deleteContact } from '@/app/actions/contacts'
import { Button } from '@/components/ui/button'
import { AddContactForm } from '@/components/AddContactForm'

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
    <div>
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
              <Button type="submit" variant="destructive" size="sm">
                Remove
              </Button>
            </form>
          </li>
        ))}
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
