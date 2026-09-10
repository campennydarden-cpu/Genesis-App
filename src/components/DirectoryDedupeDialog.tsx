'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { EntityDirectoryRecord } from '@/lib/types'

export function DirectoryDedupeDialog({
  open,
  onOpenChange,
  candidates,
  pendingName,
  onUpdateExisting,
  onAddAsNew,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: EntityDirectoryRecord[]
  pendingName: string
  onUpdateExisting: (existingId: string) => void
  onAddAsNew: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>&quot;{pendingName}&quot; looks similar to an existing entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {candidates.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded border p-3">
              <span>
                {c.name} <span className="text-xs text-slate-500">{c.lookup_code}</span>
              </span>
              <Button size="sm" onClick={() => onUpdateExisting(c.id)}>
                Update this record
              </Button>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={onAddAsNew}>
            Add &quot;{pendingName}&quot; as new
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
