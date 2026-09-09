'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { CDF_PAGE2_SECTIONS } from '@/lib/constants'
import type { CdfPage2Line } from '@/lib/types'

const DEFAULT_SECTIONS = CDF_PAGE2_SECTIONS.filter((s) => s.code === 'B' || s.code === 'C' || s.code === 'H')

/**
 * "Assign to CDF Page 2" control shared by Premiums & Endorsements, Additional Title/Escrow
 * Charges, Tax/Other Prorations, and Recording. Links the row to a real cdf_page2_lines row
 * (referenced by id, so CDF Page 2 reordering never breaks it; the FK's `on delete set null`
 * clears the link automatically if that line is deleted).
 *
 * Two assignment modes, chosen per selected section: sections with no fixed rows (B/C/H/E)
 * create a fresh line via `onAssign`, seeding its description/amount from the source row as a
 * one-time starting point (still freely editable on both sides after, not a live sync).
 * Sections that already carry fixed, named rows (e.g. F's 4 Prepaids lines) instead show a
 * picker of those existing lines and link to the chosen one via `onLinkExisting` — a fixed row
 * is meaningful on its own, not something a caller should be creating more of.
 */
export function CdfLineAssign({
  cdfLineId,
  cdfLines,
  sections = DEFAULT_SECTIONS,
  onAssign,
  onLinkExisting,
  onUnassign,
}: {
  cdfLineId: string | null
  cdfLines: CdfPage2Line[]
  sections?: readonly { code: string; label: string }[]
  onAssign: (section: string) => Promise<unknown>
  onLinkExisting?: (lineId: string) => Promise<unknown>
  onUnassign: () => Promise<unknown>
}) {
  const [section, setSection] = useState<string>(sections[0].code)
  const [isPending, startTransition] = useTransition()

  const line = cdfLineId ? cdfLines.find((l) => l.id === cdfLineId) : undefined
  const fixedLinesInSection = useMemo(
    () => cdfLines.filter((l) => l.section === section && l.is_fixed).sort((a, b) => a.sort_order - b.sort_order),
    [cdfLines, section]
  )
  const [existingLineId, setExistingLineId] = useState<string>('')
  const selectedExistingLineId = existingLineId || fixedLinesInSection[0]?.id || ''

  if (cdfLineId) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded border px-2 py-1 text-muted-foreground">
          {line
            ? `CDF Page 2 — Section ${line.section}${line.is_fixed ? ` — ${line.description}` : `, Line ${line.sort_order}`}`
            : 'CDF Page 2 line assigned'}
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
        onChange={(e) => {
          setSection(e.target.value)
          setExistingLineId('')
        }}
        className="rounded border px-2 py-1 text-xs"
        aria-label="CDF Page 2 section"
      >
        {sections.map((s) => (
          <option key={s.code} value={s.code}>
            Section {s.code} — {s.label}
          </option>
        ))}
      </select>
      {fixedLinesInSection.length > 0 ? (
        <>
          <select
            value={selectedExistingLineId}
            onChange={(e) => setExistingLineId(e.target.value)}
            className="rounded border px-2 py-1 text-xs"
            aria-label="CDF Page 2 line"
          >
            {fixedLinesInSection.map((l) => (
              <option key={l.id} value={l.id}>
                {l.description}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending || !onLinkExisting}
            onClick={() =>
              startTransition(async () => {
                await onLinkExisting?.(selectedExistingLineId)
              })
            }
          >
            + Assign to CDF Page 2
          </Button>
        </>
      ) : (
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
      )}
    </div>
  )
}
