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
