'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRINCIPAL_ROLES } from '@/lib/constants'
import {
  addDerivationPrincipal,
  updateDerivationPrincipal,
  deleteDerivationPrincipal,
} from '@/app/actions/prelim-search'
import type { DerivationPrincipal } from '@/lib/types'

export function DerivationPrincipalRoster({
  orderId,
  prelimSearchId,
  side,
  entityType,
  principals,
  label,
}: {
  orderId: string
  prelimSearchId: string
  side: 'grantee' | 'grantor'
  entityType: string
  principals: DerivationPrincipal[]
  label: string
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const roles = PRINCIPAL_ROLES[entityType] ?? []

  return (
    <div className="mt-4 border-t pt-4" data-testid={`${side}-principal-roster`}>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <ul className="mb-4 space-y-2">
        {principals.map((p) =>
          editingId === p.id ? (
            <li key={p.id} className="rounded border p-3" data-testid={`${side}-principal-row-editing`}>
              <form
                action={async (formData) => {
                  await updateDerivationPrincipal(p.id, orderId, formData)
                  setEditingId(null)
                }}
                className="space-y-3"
              >
                <div>
                  <Label htmlFor={`${side}-name-${p.id}`}>Name</Label>
                  <Input id={`${side}-name-${p.id}`} name="name" defaultValue={p.name} required />
                </div>
                <div>
                  <Label htmlFor={`${side}-role-${p.id}`}>Role</Label>
                  <Select name="role" defaultValue={p.role ?? undefined}>
                    <SelectTrigger id={`${side}-role-${p.id}`}>
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
              data-testid={`${side}-principal-row`}
            >
              <div>
                <p className="font-medium">{p.name}</p>
                {p.role && <p className="text-sm text-slate-500">{p.role}</p>}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-sm text-slate-600 hover:underline"
                  onClick={() => setEditingId(p.id)}
                  aria-label={`Edit ${p.name}`}
                >
                  Edit
                </button>
                <form action={deleteDerivationPrincipal.bind(null, orderId, p.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          )
        )}
        {principals.length === 0 && <p className="text-sm text-slate-500">None added yet.</p>}
      </ul>

      <details className="rounded border p-3">
        <summary className="cursor-pointer text-sm font-medium">Add {label.replace(/s$/, '')}</summary>
        <form action={addDerivationPrincipal.bind(null, prelimSearchId, orderId, side)} className="mt-3 space-y-3">
          <div>
            <Label htmlFor={`${side}-new-name`}>Name</Label>
            <Input id={`${side}-new-name`} name="name" required />
          </div>
          <div>
            <Label htmlFor={`${side}-new-role`}>Role</Label>
            <Select name="role">
              <SelectTrigger id={`${side}-new-role`}>
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
