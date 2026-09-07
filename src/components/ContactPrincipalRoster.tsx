'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRINCIPAL_ROLES } from '@/lib/constants'
import {
  addContactPrincipal,
  updateContactPrincipal,
  deleteContactPrincipal,
} from '@/app/actions/contacts'
import type { ContactPrincipal } from '@/lib/types'

export function ContactPrincipalRoster({
  orderId,
  contactId,
  entityType,
  principals,
  label,
}: {
  orderId: string
  contactId: string
  entityType: string
  principals: ContactPrincipal[]
  label: string
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const roles = PRINCIPAL_ROLES[entityType] ?? []

  return (
    <div className="mt-3 border-t pt-3" data-testid="contact-principal-roster">
      <p className="mb-2 text-sm font-medium">{label}</p>
      <ul className="mb-3 space-y-2">
        {principals.map((p) =>
          editingId === p.id ? (
            <li key={p.id} className="rounded border p-3" data-testid="contact-principal-row-editing">
              <form
                action={async (formData) => {
                  await updateContactPrincipal(p.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-3"
              >
                <div>
                  <Label htmlFor={`principal-name-${p.id}`}>Name</Label>
                  <Input id={`principal-name-${p.id}`} name="name" defaultValue={p.name} required />
                </div>
                <div>
                  <Label htmlFor={`principal-role-${p.id}`}>Role</Label>
                  <Select name="role" defaultValue={p.role ?? undefined}>
                    <SelectTrigger id={`principal-role-${p.id}`}>
                      <SelectValue placeholder="— Select —" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </li>
          ) : (
            <li
              key={p.id}
              className="flex items-center justify-between rounded border p-3"
              data-testid="contact-principal-row"
            >
              <div>
                <p className="font-medium">{p.name}</p>
                {p.role && <p className="text-sm text-muted-foreground">{p.role}</p>}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:underline"
                  onClick={() => setEditingId(p.id)}
                  aria-label={`Edit ${p.name}`}
                >
                  Edit
                </button>
                <form action={deleteContactPrincipal.bind(null, orderId, p.id)}>
                  <button type="submit" className="text-sm text-destructive hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {principals.length === 0 && <p className="text-sm text-muted-foreground">None added yet.</p>}
      </ul>

      <details className="rounded border p-3">
        <summary className="cursor-pointer text-sm font-medium">Add {label.replace(/s$/, '')}</summary>
        <form action={addContactPrincipal.bind(null, contactId, orderId)} className="mt-3 space-y-3">
          <div>
            <Label htmlFor={`principal-new-name-${contactId}`}>Name</Label>
            <Input id={`principal-new-name-${contactId}`} name="name" required />
          </div>
          <div>
            <Label htmlFor={`principal-new-role-${contactId}`}>Role</Label>
            <Select name="role">
              <SelectTrigger id={`principal-new-role-${contactId}`}>
                <SelectValue placeholder="— Select —" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      </details>
    </div>
  )
}
