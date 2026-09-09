'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SaveIndicator } from '@/components/SaveIndicator'
import {
  addRecordingDocument,
  updateRecordingDocument,
  deleteRecordingDocument,
  setRecordingDocumentCdfLine,
} from '@/app/actions/recording'
import { assignNextCdfPage2Line } from '@/app/actions/cdf-page2'
import { useAutosave } from '@/lib/use-autosave'
import { RECORDING_STATUSES, RECORDING_DOCUMENT_TYPES, CDF_PAGE2_SECTIONS } from '@/lib/constants'
import { CdfLineAssign } from '@/components/title/CdfLineAssign'
import type { RecordingDocument, CdfPage2Line } from '@/lib/types'

const SECTION_E = CDF_PAGE2_SECTIONS.filter((s) => s.code === 'E')

function refresh() {
  window.location.reload()
}

function DocumentRow({ orderId, doc, cdfLines }: { orderId: string; doc: RecordingDocument; cdfLines: CdfPage2Line[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateRecordingDocument(orderId, doc.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="space-y-2 rounded border p-3" data-testid={`recording-doc-${doc.id}`}>
      <form ref={formRef} className="grid grid-cols-4 gap-2">
        <div className="col-span-2">
          <Label htmlFor={`recording-doc-${doc.id}-document_description`}>Document</Label>
          <select
            id={`recording-doc-${doc.id}-document_description`}
            name="document_description"
            defaultValue={doc.document_description ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="" />
            {RECORDING_DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`recording-doc-${doc.id}-county`}>County</Label>
          <Input id={`recording-doc-${doc.id}-county`} name="county" defaultValue={doc.county ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`recording-doc-${doc.id}-number_of_pages`}># of Pages</Label>
          <Input
            id={`recording-doc-${doc.id}-number_of_pages`}
            name="number_of_pages"
            type="number"
            defaultValue={doc.number_of_pages ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`recording-doc-${doc.id}-status`}>Status</Label>
          <select
            id={`recording-doc-${doc.id}-status`}
            name="status"
            defaultValue={doc.status}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            {RECORDING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`recording-doc-${doc.id}-date_submitted`}>Date Submitted</Label>
          <Input
            id={`recording-doc-${doc.id}-date_submitted`}
            name="date_submitted"
            type="date"
            defaultValue={doc.date_submitted ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`recording-doc-${doc.id}-date_recorded`}>Date Recorded</Label>
          <Input
            id={`recording-doc-${doc.id}-date_recorded`}
            name="date_recorded"
            type="date"
            defaultValue={doc.date_recorded ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`recording-doc-${doc.id}-instrument_number`}>Instrument Number</Label>
          <Input
            id={`recording-doc-${doc.id}-instrument_number`}
            name="instrument_number"
            defaultValue={doc.instrument_number ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`recording-doc-${doc.id}-book`}>Book</Label>
          <Input id={`recording-doc-${doc.id}-book`} name="book" defaultValue={doc.book ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`recording-doc-${doc.id}-page`}>Page</Label>
          <Input id={`recording-doc-${doc.id}-page`} name="page" defaultValue={doc.page ?? ''} onBlur={handleSave} />
        </div>
        <div>
          <Label htmlFor={`recording-doc-${doc.id}-e_recording_reference`}>e-Recording Reference</Label>
          <Input
            id={`recording-doc-${doc.id}-e_recording_reference`}
            name="e_recording_reference"
            defaultValue={doc.e_recording_reference ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`recording-doc-${doc.id}-fee`}>Fee</Label>
          <Input
            id={`recording-doc-${doc.id}-fee`}
            name="fee"
            type="number"
            step="0.01"
            defaultValue={doc.fee ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`recording-doc-${doc.id}-seller_pay_percent`}>Seller Pay %</Label>
          <Input
            id={`recording-doc-${doc.id}-seller_pay_percent`}
            name="seller_pay_percent"
            type="number"
            step="0.01"
            defaultValue={doc.seller_pay_percent ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div className="col-span-2">
          <Label>CDF Page 2 Assignment</Label>
          <CdfLineAssign
            cdfLineId={doc.cdf_page2_line_id}
            cdfLines={cdfLines}
            sections={SECTION_E}
            onAssign={async (section) => {
              const { id } = await assignNextCdfPage2Line(orderId, section, doc.document_description, doc.fee)
              if (id) await setRecordingDocumentCdfLine(orderId, doc.id, id)
              refresh()
            }}
            onUnassign={async () => {
              await setRecordingDocumentCdfLine(orderId, doc.id, null)
              refresh()
            }}
          />
        </div>
        <div className="col-span-4">
          <SaveIndicator state={state} errorMessage={errorMessage} />
        </div>
      </form>
      <button
        type="button"
        className="text-sm text-destructive hover:underline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deleteRecordingDocument(orderId, doc.id)
            refresh()
          })
        }
      >
        Remove document
      </button>
    </div>
  )
}

export function RecordingPanel({
  orderId,
  documents,
  cdfLines,
}: {
  orderId: string
  documents: RecordingDocument[]
  cdfLines: CdfPage2Line[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-5xl space-y-6" data-testid="recording-panel">
      <div>
        <h2 className="text-lg font-semibold">Recording</h2>
        <p className="text-sm text-muted-foreground">
          Tracks each document sent to the recorder&apos;s office. Recording fees stay on CDF Page 2, Section E.
        </p>
      </div>

      <div className="space-y-3" data-testid="recording-doc-list">
        {documents.map((d) => (
          <DocumentRow key={d.id} orderId={orderId} doc={d} cdfLines={cdfLines} />
        ))}
        {documents.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          startTransition(async () => {
            await addRecordingDocument(orderId)
            refresh()
          })
        }
        disabled={isPending}
      >
        + Add Document
      </Button>
    </div>
  )
}
