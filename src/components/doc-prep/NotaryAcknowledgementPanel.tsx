'use client'

import { useTransition } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { updateNotaryAckText, regenerateNotaryAck } from '@/app/actions/doc-prep-notary-acks'
import type { NotaryAck } from '@/lib/types'

export function NotaryAcknowledgementPanel({
  orderId,
  acks,
}: {
  orderId: string
  acks: Array<NotaryAck & { contact_name: string }>
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-3xl space-y-4" data-testid="notary-ack-panel">
      <h2 className="text-lg font-semibold">Notary Acknowledgement</h2>

      {acks.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No Deed Grantor or Security Instrument Mortgagor contacts on file yet — acknowledgment language generates
          automatically once Contacts are added.
        </div>
      ) : (
        <ul className="space-y-4">
          {acks.map((ack) => (
            <li key={ack.id} className="rounded border p-4" data-testid={`notary-ack-${ack.id}`}>
              <p className="mb-2 font-medium">
                {ack.contact_name} · {ack.doc_label}
              </p>
              <Textarea
                defaultValue={ack.text}
                className="min-h-40"
                onBlur={(e) => {
                  if (e.target.value !== ack.text) {
                    startTransition(async () => {
                      await updateNotaryAckText(orderId, ack.id, e.target.value)
                    })
                  }
                }}
              />
              <button
                type="button"
                className="mt-2 text-xs text-primary hover:underline"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await regenerateNotaryAck(orderId, ack.id)
                    window.location.reload()
                  })
                }
              >
                Regenerate
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                Fills once, generated for this signer/document — fully editable for the final merged document.
                Regenerate recomputes and overwrites. Who needs an acknowledgment still tracks live from Contacts.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
