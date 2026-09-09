'use client'

import { useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { TITLE_POLICY_LINE_TYPES } from '@/lib/constants'
import { SplitList } from '@/components/title/SplitFields'
import {
  addPremium,
  updatePremium,
  deletePremium,
  addPremiumSplit,
  updatePremiumSplit,
  deletePremiumSplit,
  setPremiumCdfLine,
} from '@/app/actions/title-premiums'
import {
  addEndorsement,
  updateEndorsement,
  deleteEndorsement,
  addEndorsementSplit,
  updateEndorsementSplit,
  deleteEndorsementSplit,
  setEndorsementCdfLine,
} from '@/app/actions/endorsements'
import { assignNextCdfPage2Line } from '@/app/actions/cdf-page2'
import { CdfLineAssign } from '@/components/title/CdfLineAssign'
import type { TitleInsurancePremium, PremiumSplit, Endorsement, EndorsementSplit, CdfPage2Line } from '@/lib/types'

type Contact = { id: string; name: string }
type BillCode = { id: string; code: string }

function refresh() {
  window.location.reload()
}

function EndorsementRow({
  orderId,
  endorsement,
  splits,
  contacts,
  billCodes,
  cdfLines,
  onDelete,
}: {
  orderId: string
  endorsement: Endorsement
  splits: EndorsementSplit[]
  contacts: Contact[]
  billCodes: BillCode[]
  cdfLines: CdfPage2Line[]
  onDelete: () => Promise<unknown>
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updateEndorsement(orderId, endorsement.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="space-y-2 rounded border p-3">
      <form ref={formRef} className="grid grid-cols-6 items-end gap-2">
        <div>
          <Label htmlFor={`endorsement-${endorsement.id}-code`}>Code</Label>
          <Input id={`endorsement-${endorsement.id}-code`} name="code" defaultValue={endorsement.code ?? ''} onBlur={handleSave} />
        </div>
        <div className="col-span-2">
          <Label htmlFor={`endorsement-${endorsement.id}-description`}>Description</Label>
          <Input
            id={`endorsement-${endorsement.id}-description`}
            name="description"
            defaultValue={endorsement.description ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`endorsement-${endorsement.id}-charge`}>Charge</Label>
          <CurrencyInput
            id={`endorsement-${endorsement.id}-charge`}
            name="charge"
            defaultValue={endorsement.charge}
            onBlur={handleSave}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor={`endorsement-${endorsement.id}-bill_code`}>Bill Code</Label>
          <select
            id={`endorsement-${endorsement.id}-bill_code`}
            name="bill_code"
            defaultValue={endorsement.bill_code ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {billCodes.map((b) => (
              <option key={b.id} value={b.code}>
                {b.code}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-6">
          <SaveIndicator state={state} errorMessage={errorMessage} />
        </div>
      </form>
      <CdfLineAssign
        cdfLineId={endorsement.cdf_page2_line_id}
        cdfLines={cdfLines}
        onAssign={async (section) => {
          const { id } = await assignNextCdfPage2Line(orderId, section)
          if (id) await setEndorsementCdfLine(orderId, endorsement.id, id)
          refresh()
        }}
        onUnassign={async () => {
          await setEndorsementCdfLine(orderId, endorsement.id, null)
          refresh()
        }}
      />
      <SplitList
        splits={splits}
        contacts={contacts}
        billCodes={billCodes}
        onAdd={() => addEndorsementSplit(orderId, endorsement.id)}
        onUpdate={(id, formData) => updateEndorsementSplit(orderId, id, formData)}
        onDelete={(id) => deleteEndorsementSplit(orderId, id)}
        onChanged={refresh}
      />
      <button
        type="button"
        className="text-sm text-destructive hover:underline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await onDelete()
            refresh()
          })
        }
      >
        Remove endorsement
      </button>
    </div>
  )
}

function EndorsementList({
  orderId,
  premiumId,
  endorsements,
  splitsByEndorsement,
  contacts,
  billCodes,
  cdfLines,
}: {
  orderId: string
  premiumId: string
  endorsements: Endorsement[]
  splitsByEndorsement: Record<string, EndorsementSplit[]>
  contacts: Contact[]
  billCodes: BillCode[]
  cdfLines: CdfPage2Line[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-3 rounded border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Endorsements</p>
      {endorsements.map((e) => (
        <EndorsementRow
          key={e.id}
          orderId={orderId}
          endorsement={e}
          splits={splitsByEndorsement[e.id] ?? []}
          contacts={contacts}
          billCodes={billCodes}
          cdfLines={cdfLines}
          onDelete={() => deleteEndorsement(orderId, e.id)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          startTransition(async () => {
            await addEndorsement(orderId, premiumId)
            refresh()
          })
        }
        disabled={isPending}
      >
        + Add Endorsement
      </Button>
    </div>
  )
}

function PremiumCard({
  orderId,
  premium,
  splits,
  endorsements,
  endorsementSplits,
  underwriterContacts,
  allContacts,
  billCodes,
  purchasePrice,
  loanAmount,
  cdfLines,
}: {
  orderId: string
  premium: TitleInsurancePremium
  splits: PremiumSplit[]
  endorsements: Endorsement[]
  endorsementSplits: Record<string, EndorsementSplit[]>
  underwriterContacts: Contact[]
  allContacts: Contact[]
  billCodes: BillCode[]
  purchasePrice: number | null
  loanAmount: number | null
  cdfLines: CdfPage2Line[]
}) {
  const coverageDefault =
    premium.coverage_amount ?? (premium.policy_type === "Owner's" ? purchasePrice : premium.policy_type === 'Loan' ? loanAmount : null)
  const formRef = useRef<HTMLFormElement>(null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => updatePremium(orderId, premium.id, formData))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!formRef.current) return
    save(new FormData(formRef.current))
  }

  return (
    <div className="space-y-3 rounded border p-4" data-testid={`premium-${premium.id}`}>
      <form ref={formRef} className="grid grid-cols-4 gap-3">
        <div>
          <Label htmlFor={`premium-${premium.id}-policy_type`}>Policy Type</Label>
          <select
            id={`premium-${premium.id}-policy_type`}
            name="policy_type"
            defaultValue={premium.policy_type ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {TITLE_POLICY_LINE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`premium-${premium.id}-underwriter`}>Underwriter</Label>
          <select
            id={`premium-${premium.id}-underwriter`}
            name="underwriter_contact_id"
            defaultValue={premium.underwriter_contact_id ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {underwriterContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`premium-${premium.id}-coverage_amount`}>Coverage Amount</Label>
          <CurrencyInput
            id={`premium-${premium.id}-coverage_amount`}
            name="coverage_amount"
            defaultValue={coverageDefault}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`premium-${premium.id}-bill_code`}>Bill Code</Label>
          <select
            id={`premium-${premium.id}-bill_code`}
            name="bill_code"
            defaultValue={premium.bill_code ?? ''}
            onBlur={handleSave}
            className="block w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {billCodes.map((b) => (
              <option key={b.id} value={b.code}>
                {b.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`premium-${premium.id}-base_premium`}>Base Premium</Label>
          <Input
            id={`premium-${premium.id}-base_premium`}
            name="base_premium"
            type="number"
            step="0.01"
            defaultValue={premium.base_premium ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div>
          <Label htmlFor={`premium-${premium.id}-final_premium`}>Final Premium</Label>
          <Input
            id={`premium-${premium.id}-final_premium`}
            name="final_premium"
            type="number"
            step="0.01"
            defaultValue={premium.final_premium ?? ''}
            onBlur={handleSave}
          />
        </div>
        <div className="col-span-4">
          <SaveIndicator state={state} errorMessage={errorMessage} />
        </div>
      </form>

      <CdfLineAssign
        cdfLineId={premium.cdf_page2_line_id}
        cdfLines={cdfLines}
        onAssign={async (section) => {
          const { id } = await assignNextCdfPage2Line(orderId, section)
          if (id) await setPremiumCdfLine(orderId, premium.id, id)
          refresh()
        }}
        onUnassign={async () => {
          await setPremiumCdfLine(orderId, premium.id, null)
          refresh()
        }}
      />

      <SplitList
        splits={splits}
        contacts={allContacts}
        billCodes={billCodes}
        onAdd={() => addPremiumSplit(orderId, premium.id)}
        onUpdate={(id, formData) => updatePremiumSplit(orderId, id, formData)}
        onDelete={(id) => deletePremiumSplit(orderId, id)}
        onChanged={refresh}
      />

      <EndorsementList
        orderId={orderId}
        premiumId={premium.id}
        endorsements={endorsements}
        splitsByEndorsement={endorsementSplits}
        contacts={allContacts}
        billCodes={billCodes}
        cdfLines={cdfLines}
      />

      <button
        type="button"
        className="text-sm text-destructive hover:underline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deletePremium(orderId, premium.id)
            refresh()
          })
        }
      >
        Remove policy
      </button>
    </div>
  )
}

export function PremiumsPanel({
  orderId,
  premiums,
  splitsByPremium,
  endorsementsByPremium,
  endorsementSplits,
  underwriterContacts,
  allContacts,
  billCodes,
  purchasePrice,
  loanAmount,
  cdfLines,
}: {
  orderId: string
  premiums: TitleInsurancePremium[]
  splitsByPremium: Record<string, PremiumSplit[]>
  endorsementsByPremium: Record<string, Endorsement[]>
  endorsementSplits: Record<string, EndorsementSplit[]>
  underwriterContacts: Contact[]
  allContacts: Contact[]
  billCodes: BillCode[]
  purchasePrice: number | null
  loanAmount: number | null
  cdfLines: CdfPage2Line[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-4xl space-y-4" data-testid="premiums-panel">
      <h2 className="text-lg font-semibold">Title Insurance Premiums & Endorsements</h2>
      <p className="text-sm text-muted-foreground">
        Manual entry shell — premiums and endorsement charges are keyed in directly, not calculated from a rate table.
      </p>

      <div className="space-y-4" data-testid="premium-list">
        {premiums.map((p) => (
          <PremiumCard
            key={p.id}
            orderId={orderId}
            premium={p}
            splits={splitsByPremium[p.id] ?? []}
            endorsements={endorsementsByPremium[p.id] ?? []}
            endorsementSplits={endorsementSplits}
            underwriterContacts={underwriterContacts}
            allContacts={allContacts}
            billCodes={billCodes}
            purchasePrice={purchasePrice}
            loanAmount={loanAmount}
            cdfLines={cdfLines}
          />
        ))}
        {premiums.length === 0 && <p className="text-sm text-muted-foreground">No policies yet.</p>}
      </div>

      <Button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await addPremium(orderId)
            refresh()
          })
        }
        disabled={isPending}
      >
        + Add Policy
      </Button>
    </div>
  )
}
