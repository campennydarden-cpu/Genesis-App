'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { CDF_PAGE2_SECTIONS } from '@/lib/constants'
import type { CdfPage2Line } from '@/lib/types'

const ASSIGNABLE_SECTIONS = CDF_PAGE2_SECTIONS.filter((s) => s.code === 'B' || s.code === 'C' || s.code === 'H')

/**
 * "Assign to CDF Page 2" control shared by Premiums & Endorsements, Additional Title/Escrow
 * Charges, and Tax/Other Prorations. Links the row to a real cdf_page2_lines row (referenced
 * by id, so CDF Page 2 reordering never breaks it; the FK's `on delete set null` clears the
 * link automatically if that line is deleted). Amounts/description stay manual entry on both
 * sides — this only reserves/links a line, matching the CDF pages' existing manual-entry-shell
 * scope.
 */
export function CdfLineAssign({
  cdfLineId,
  cdfLines,
  onAssign,
  onUnassign,
}: {
  cdfLineId: string | null
  cdfLines: CdfPage2Line[]
  onAssign: (section: string) => Promise<unknown>
  onUnassign: () => Promise<unknown>
}) {
  const [section, setSection] = useState<string>(ASSIGNABLE_SECTIONS[0].code)
  const [isPending, startTransition] = useTransition()

  const line = cdfLineId ? cdfLines.find((l) => l.id === cdfLineId) : undefined

  if (cdfLineId) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded border px-2 py-1 text-muted-foreground">
          {line ? `CDF Page 2 — Section ${line.section}, Line ${line.sort_order}` : 'CDF Page 2 line assigned'}
        </span>
        <button
          type="button"
          className="text-destructive hover:underline"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await onUnassign()
            })
          }
        >
          Unassign
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={section}
        onChange={(e) => setSection(e.target.value)}
        className="rounded border px-2 py-1 text-xs"
        aria-label="CDF Page 2 section"
      >
        {ASSIGNABLE_SECTIONS.map((s) => (
          <option key={s.code} value={s.code}>
            Section {s.code} — {s.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await onAssign(section)
          })
        }
      >
        + Assign to CDF Page 2
      </Button>
    </div>
  )
}
