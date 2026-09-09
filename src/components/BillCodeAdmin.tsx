'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createBillCode, updateBillCode, deleteBillCode } from '@/app/actions/bill-codes'
import type { BillCode } from '@/lib/types'

export function BillCodeAdmin({ billCodes }: { billCodes: BillCode[] }) {
  const [newCode, setNewCode] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // ponytail: full reload keeps this simple; this screen is used rarely enough
  // that a router.refresh()-based no-flash update isn't worth the extra wiring
  function refresh() {
    window.location.reload()
  }

  function handleCreate() {
    if (!newCode.trim()) return
    startTransition(async () => {
      const result = await createBillCode(newCode.trim(), newDescription.trim())
      if (result.error) setError(result.error)
      else {
        setNewCode('')
        setNewDescription('')
        refresh()
      }
    })
  }

  function handleUpdate(billCode: BillCode, code: string, description: string) {
    startTransition(async () => {
      const result = await updateBillCode(billCode.id, code, description)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteBillCode(id)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="mb-4 flex gap-2">
        <Input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="Code (e.g. CLOSE)"
          aria-label="New bill code"
          className="max-w-[160px]"
        />
        <Input
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Description"
          aria-label="New bill code description"
          className="max-w-sm"
        />
        <Button type="button" onClick={handleCreate} disabled={isPending}>
          Add Bill Code
        </Button>
      </div>

      <ul className="divide-y">
        {billCodes.map((billCode) => (
          <li key={billCode.id} className="flex items-center gap-2 py-1">
            <Input
              defaultValue={billCode.code}
              aria-label={`Code for ${billCode.code}`}
              className="max-w-[160px]"
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== billCode.code) {
                  handleUpdate(billCode, e.target.value.trim(), billCode.description ?? '')
                }
              }}
            />
            <Input
              defaultValue={billCode.description ?? ''}
              aria-label={`Description for ${billCode.code}`}
              className="max-w-sm"
              onBlur={(e) => {
                if (e.target.value !== (billCode.description ?? '')) {
                  handleUpdate(billCode, billCode.code, e.target.value)
                }
              }}
            />
            <span className="text-xs text-muted-foreground">order {billCode.sort_order}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm(`Delete bill code "${billCode.code}"? Existing splits keep the code as text.`)) {
                  handleDelete(billCode.id)
                }
              }}
              disabled={isPending}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
