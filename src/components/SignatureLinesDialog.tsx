'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { addSignatureLine, updateSignatureLine, deleteSignatureLine } from '@/app/actions/contacts'
import { defaultSignatureLine } from '@/lib/signature-line'
import type { Contact, ContactPrincipal, ContactSignatureLine } from '@/lib/types'

export function SignatureLinesDialog({
  orderId,
  contact,
  principals,
  signatureLines,
}: {
  orderId: string
  contact: Contact
  principals: ContactPrincipal[]
  signatureLines: ContactSignatureLine[]
}) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const defaultText = defaultSignatureLine({
    name: contact.name,
    entityType: (contact.entity_type as never) || null,
    principals: principals.map((p) => ({ name: p.name, role: p.role })),
    poa: contact.poa,
    attorneyInFactName: contact.poa_attorney_in_fact_name,
  })

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setOpen(true)}>
        Edit Signature
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signature Line(s) — {contact.name}</DialogTitle>
          </DialogHeader>

          <ul className="mb-3 space-y-2" data-testid="signature-line-list">
            {signatureLines.map((s) =>
              editingId === s.id ? (
                <li key={s.id} className="rounded border p-3" data-testid="signature-line-row-editing">
                  <form
                    action={async (formData) => {
                      await updateSignatureLine(s.id, orderId, formData)
                      setEditingId(null)
                    }}
                    className="space-y-2"
                  >
                    <Textarea name="text" defaultValue={s.text} required rows={3} />
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
                  key={s.id}
                  className="flex items-start justify-between rounded border p-3"
                  data-testid="signature-line-row"
                >
                  <p className="whitespace-pre-wrap text-sm">{s.text}</p>
                  <div className="ml-3 flex shrink-0 gap-3">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:underline"
                      onClick={() => setEditingId(s.id)}
                    >
                      Edit
                    </button>
                    <form action={deleteSignatureLine.bind(null, orderId, s.id)}>
                      <button type="submit" className="text-sm text-destructive hover:underline">
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              )
            )}
            {signatureLines.length === 0 && <p className="text-sm text-muted-foreground">None added yet.</p>}
          </ul>

          <form action={addSignatureLine.bind(null, contact.id, orderId)}>
            <input type="hidden" name="text" value={defaultText} />
            <Button type="submit" size="sm" variant="outline" disabled={!defaultText}>
              Regenerate default from entity details
            </Button>
          </form>

          <details className="mt-3 rounded border p-3">
            <summary className="cursor-pointer text-sm font-medium">Add Signature Line</summary>
            <form action={addSignatureLine.bind(null, contact.id, orderId)} className="mt-3 space-y-2">
              <Textarea name="text" required rows={3} />
              <Button type="submit" size="sm">
                Add
              </Button>
            </form>
          </details>
        </DialogContent>
      </Dialog>
    </>
  )
}
