// src/components/commitment-document/CommitmentDocumentReview.tsx
'use client'

import { useState, useTransition } from 'react'
import { resolveCommitmentDocumentField } from '@/app/actions/commitment-document-review'
import type { DivergentField } from '@/app/actions/commitment-document-diff'

export function CommitmentDocumentReview({ orderId, divergentFields }: { orderId: string; divergentFields: DivergentField[] }) {
  const [isPending, startTransition] = useTransition()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  if (divergentFields.length === 0) return null

  return (
    <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-4">
      <h2 className="mb-2 text-sm font-semibold text-amber-900">
        {divergentFields.length} field{divergentFields.length === 1 ? '' : 's'} changed inside the document
      </h2>
      <ul className="space-y-2">
        {divergentFields.map((field) => (
          <li key={field.tag} className="flex items-center justify-between gap-4 rounded bg-white p-2 text-sm">
            <div>
              <div className="font-medium">{field.tag}</div>
              <div className="text-gray-500">
                Database: <span className="line-through">{field.snapshotValue || '(empty)'}</span> → Document: {field.currentDocValue || '(empty)'}
              </div>
              {fieldErrors[field.tag] && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors[field.tag]}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    setFieldErrors((prev) => ({ ...prev, [field.tag]: '' }))
                    const result = await resolveCommitmentDocumentField(orderId, field.tag, 'accept', field.currentDocValue)
                    if (result.error) setFieldErrors((prev) => ({ ...prev, [field.tag]: result.error! }))
                  })
                }
                className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    setFieldErrors((prev) => ({ ...prev, [field.tag]: '' }))
                    const result = await resolveCommitmentDocumentField(orderId, field.tag, 'reject', field.currentDocValue)
                    if (result.error) setFieldErrors((prev) => ({ ...prev, [field.tag]: result.error! }))
                  })
                }
                className="rounded bg-gray-300 px-3 py-1 text-xs font-medium text-gray-800 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
