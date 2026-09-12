'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  inviteUser,
  setUserActive,
  updateFullName,
  createRole,
  setRolePermission,
  deleteRole,
} from '@/app/actions/admin-users'
import { PERMISSIONS } from '@/lib/constants'
import type { Role, Profile } from '@/lib/types'

type StaffRow = Profile & { email: string; role_name: string }
type RoleRow = Role & { permission_keys: string[] }

export function AdminUsersConsole({
  initialStaff,
  initialRoles,
}: {
  initialStaff: StaffRow[]
  initialRoles: RoleRow[]
}) {
  const [tab, setTab] = useState<'users' | 'roles'>('users')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState(initialRoles[0]?.id ?? '')
  const [newRoleName, setNewRoleName] = useState('')
  const [editingNameId, setEditingNameId] = useState<string | null>(null)

  function refresh() {
    window.location.reload()
  }

  function handleInvite() {
    startTransition(async () => {
      const result = await inviteUser(inviteEmail.trim(), inviteName.trim(), inviteRoleId)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleToggleActive(profileId: string, active: boolean) {
    startTransition(async () => {
      const result = await setUserActive(profileId, active)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleRenameStaff(profileId: string, fullName: string, currentName: string | null) {
    setEditingNameId(null)
    if (!fullName.trim() || fullName.trim() === (currentName ?? '')) return
    startTransition(async () => {
      const result = await updateFullName(profileId, fullName.trim())
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleCreateRole() {
    if (!newRoleName.trim()) return
    startTransition(async () => {
      const result = await createRole(newRoleName.trim())
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleTogglePermission(roleId: string, permissionKey: string, granted: boolean) {
    startTransition(async () => {
      const result = await setRolePermission(roleId, permissionKey, granted)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleDeleteRole(roleId: string, name: string) {
    if (!window.confirm(`Delete role "${name}"?`)) return
    startTransition(async () => {
      const result = await deleteRole(roleId)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div role="tablist" className="mb-4 flex gap-2 border-b">
        <button
          role="tab"
          aria-selected={tab === 'users'}
          className="border-b-2 px-3 py-2 text-sm data-[selected=true]:border-primary"
          data-selected={tab === 'users'}
          onClick={() => setTab('users')}
        >
          Users
        </button>
        <button
          role="tab"
          aria-selected={tab === 'roles'}
          className="border-b-2 px-3 py-2 text-sm data-[selected=true]:border-primary"
          data-selected={tab === 'roles'}
          onClick={() => setTab('roles')}
        >
          Roles
        </button>
      </div>

      {tab === 'users' && (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email"
              aria-label="Invite email"
              className="max-w-xs"
            />
            <Input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Full name"
              aria-label="Invite full name"
              className="max-w-xs"
            />
            <Select value={inviteRoleId} onValueChange={(v) => v !== null && setInviteRoleId(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {initialRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={handleInvite} disabled={isPending}>
              + Invite User
            </Button>
          </div>

          <ul className="divide-y" data-testid="staff-list">
            {initialStaff.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2" data-testid="staff-row">
                {editingNameId === s.id ? (
                  <Input
                    autoFocus
                    defaultValue={s.full_name ?? ''}
                    aria-label={`Edit name for ${s.full_name}`}
                    className="max-w-xs flex-1"
                    onBlur={(e) => handleRenameStaff(s.id, e.target.value, s.full_name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setEditingNameId(null)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="flex-1 text-left hover:underline"
                    onClick={() => setEditingNameId(s.id)}
                    title="Click to edit name"
                  >
                    {s.full_name}
                  </button>
                )}
                <span className="text-sm text-muted-foreground">{s.email}</span>
                <span className="text-xs">{s.role_name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleActive(s.id, !s.active)}
                  disabled={isPending}
                >
                  {s.active ? 'Deactivate' : 'Activate'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'roles' && (
        <div>
          <div className="mb-4 flex items-end gap-2">
            <Input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Role name"
              aria-label="New role name"
              className="max-w-xs"
            />
            <Button type="button" onClick={handleCreateRole} disabled={isPending}>
              + New Role
            </Button>
          </div>

          {initialRoles.map((role) => (
            <div key={role.id} className="mb-4 rounded border p-3" data-testid="role-card">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{role.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteRole(role.id, role.name)}
                  disabled={isPending}
                >
                  Delete
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSIONS.map((perm) => (
                  <label key={perm.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      defaultChecked={role.permission_keys.includes(perm.key)}
                      onChange={(e) =>
                        handleTogglePermission(role.id, perm.key, e.target.checked)
                      }
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
