'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TITLE_POLICY_LINE_TYPES, SPLIT_BASIS_TYPES } from '@/lib/constants'
import {
  addPremium,
  updatePremium,
  deletePremium,
  addPremiumSplit,
  updatePremiumSplit,
  deletePremiumSplit,
} from '@/app/actions/title-premiums'
import {
  addEndorsement,
  updateEndorsement,
  deleteEndorsement,
  addEndorsementSplit,
  updateEndorsementSplit,
  deleteEndorsementSplit,
} from '@/app/actions/endorsements'
import type { TitleInsurancePremium, PremiumSplit, Endorsement, EndorsementSplit } from '@/lib/types'

type Contact = { id: string; name: string }

function refresh() {
  window.location.reload()
}

function SplitRows({
  idPrefix,
  splits,
  contacts,
  onAdd,
  onUpdate,
  onDelete,
}: {
  idPrefix: string
  splits: (PremiumSplit | EndorsementSplit)[]
  contacts: Contact[]
  onAdd: () => Promise<unknown>
  onUpdate: (id: string, formData: FormData) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-2 rounded border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Split</p>
      {splits.map((s) => (
        <form
          key={s.id}
          action={async (formData) => {
            await onUpdate(s.id, formData)
            refresh()
          }}
          className="grid grid-cols-6 items-end gap-2"
        >
          <div className="col-span-2">
            <Label htmlFor={`${idPrefix}-${s.id}-payee`}>Payee</Label>
            <select
              id={`${idPrefix}-${s.id}-payee`}
              name="payee_contact_id"
              defaultValue={s.payee_contact_id ?? ''}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              className="block w-full rounded border px-2 py-1 text-sm"
            >
              <option value="">—</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <Label htmlFor={`${idPrefix}-${s.id}-basis`}>Basis</Label>
            <select
              id={`${idPrefix}-${s.id}-basis`}
              name="basis"
              defaultValue={s.basis ?? ''}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              className="block w-full rounded border px-2 py-1 text-sm"
            >
              <option value="">—</option>
              {SPLIT_BASIS_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-${s.id}-percent`}>%</Label>
            <Input
              id={`${idPrefix}-${s.id}-percent`}
              name="percent"
              type="number"
              step="0.01"
              defaultValue={s.percent ?? ''}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-${s.id}-amount`}>Amount</Label>
            <Input
              id={`${idPrefix}-${s.id}-amount`}
              name="amount"
              type="number"
              step="0.01"
              defaultValue={s.amount ?? ''}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </div>
          <div className="col-span-3">
            <Label htmlFor={`${idPrefix}-${s.id}-bill_code`}>Bill Code</Label>
            <Input
              id={`${idPrefix}-${s.id}-bill_code`}
              name="bill_code"
              defaultValue={s.bill_code ?? ''}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </div>
          <button
            type="button"
            className="col-span-3 justify-self-start text-sm text-destructive hover:underline"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await onDelete(s.id)
                refresh()
              })
            }
          >
            Remove split
          </button>
        </form>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          startTransition(async () => {
            await onAdd()
            refresh()
          })
        }
        disabled={isPending}
      >
        + Add Split
      </Button>
    </div>
  )
}

function EndorsementRows({
  orderId,
  premiumId,
  endorsements,
  splitsByEndorsement,
  contacts,
}: {
  orderId: string
  premiumId: string
  endorsements: Endorsement[]
  splitsByEndorsement: Record<string, EndorsementSplit[]>
  contacts: Contact[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-3 rounded border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Endorsements</p>
      {endorsements.map((e) => (
        <div key={e.id} className="space-y-2 rounded border p-3">
          <form
            action={async (formData) => {
              await updateEndorsement(orderId, e.id, formData)
              refresh()
            }}
            className="grid grid-cols-6 items-end gap-2"
          >
            <div>
              <Label htmlFor={`endorsement-${e.id}-code`}>Code</Label>
              <Input
                id={`endorsement-${e.id}-code`}
                name="code"
                defaultValue={e.code ?? ''}
                onBlur={(ev) => ev.currentTarget.form?.requestSubmit()}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor={`endorsement-${e.id}-description`}>Description</Label>
              <Input
                id={`endorsement-${e.id}-description`}
                name="description"
                defaultValue={e.description ?? ''}
                onBlur={(ev) => ev.currentTarget.form?.requestSubmit()}
              />
            </div>
            <div>
              <Label htmlFor={`endorsement-${e.id}-charge`}>Charge</Label>
              <Input
                id={`endorsement-${e.id}-charge`}
                name="charge"
                type="number"
                step="0.01"
                defaultValue={e.charge ?? ''}
                onBlur={(ev) => ev.currentTarget.form?.requestSubmit()}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor={`endorsement-${e.id}-bill_code`}>Bill Code</Label>
              <Input
                id={`endorsement-${e.id}-bill_code`}
                name="bill_code"
                defaultValue={e.bill_code ?? ''}
                onBlur={(ev) => ev.currentTarget.form?.requestSubmit()}
              />
            </div>
          </form>
          <SplitRows
            idPrefix={`endorsement-split-${e.id}`}
            splits={splitsByEndorsement[e.id] ?? []}
            contacts={contacts}
            onAdd={() => addEndorsementSplit(orderId, e.id)}
            onUpdate={(id, formData) => updateEndorsementSplit(orderId, id, formData)}
            onDelete={(id) => deleteEndorsementSplit(orderId, id)}
          />
          <button
            type="button"
            className="text-sm text-destructive hover:underline"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await deleteEndorsement(orderId, e.id)
                refresh()
              })
            }
          >
            Remove endorsement
          </button>
        </div>
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

export function PremiumsPanel({
  orderId,
  premiums,
  splitsByPremium,
  endorsementsByPremium,
  endorsementSplits,
  underwriterContacts,
  allContacts,
}: {
  orderId: string
  premiums: TitleInsurancePremium[]
  splitsByPremium: Record<string, PremiumSplit[]>
  endorsementsByPremium: Record<string, Endorsement[]>
  endorsementSplits: Record<string, EndorsementSplit[]>
  underwriterContacts: Contact[]
  allContacts: Contact[]
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
          <div key={p.id} className="space-y-3 rounded border p-4" data-testid={`premium-${p.id}`}>
            <form
              action={async (formData) => {
                await updatePremium(orderId, p.id, formData)
                refresh()
              }}
              className="grid grid-cols-4 gap-3"
            >
              <div>
                <Label htmlFor={`premium-${p.id}-policy_type`}>Policy Type</Label>
                <select
                  id={`premium-${p.id}-policy_type`}
                  name="policy_type"
                  defaultValue={p.policy_type ?? ''}
                  onBlur={(e) => e.currentTarget.form?.requestSubmit()}
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
                <Label htmlFor={`premium-${p.id}-underwriter`}>Underwriter</Label>
                <select
                  id={`premium-${p.id}-underwriter`}
                  name="underwriter_contact_id"
                  defaultValue={p.underwriter_contact_id ?? ''}
                  onBlur={(e) => e.currentTarget.form?.requestSubmit()}
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
                <Label htmlFor={`premium-${p.id}-coverage_amount`}>Coverage Amount</Label>
                <Input
                  id={`premium-${p.id}-coverage_amount`}
                  name="coverage_amount"
                  type="number"
                  step="0.01"
                  defaultValue={p.coverage_amount ?? ''}
                  onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                />
              </div>
              <div>
                <Label htmlFor={`premium-${p.id}-bill_code`}>Bill Code</Label>
                <Input
                  id={`premium-${p.id}-bill_code`}
                  name="bill_code"
                  defaultValue={p.bill_code ?? ''}
                  onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                />
              </div>
              <div>
                <Label htmlFor={`premium-${p.id}-base_premium`}>Base Premium</Label>
                <Input
                  id={`premium-${p.id}-base_premium`}
                  name="base_premium"
                  type="number"
                  step="0.01"
                  defaultValue={p.base_premium ?? ''}
                  onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                />
              </div>
              <div>
                <Label htmlFor={`premium-${p.id}-final_premium`}>Final Premium</Label>
                <Input
                  id={`premium-${p.id}-final_premium`}
                  name="final_premium"
                  type="number"
                  step="0.01"
                  defaultValue={p.final_premium ?? ''}
                  onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                />
              </div>
            </form>

            <SplitRows
              idPrefix={`premium-split-${p.id}`}
              splits={splitsByPremium[p.id] ?? []}
              contacts={allContacts}
              onAdd={() => addPremiumSplit(orderId, p.id)}
              onUpdate={(id, formData) => updatePremiumSplit(orderId, id, formData)}
              onDelete={(id) => deletePremiumSplit(orderId, id)}
            />

            <EndorsementRows
              orderId={orderId}
              premiumId={p.id}
              endorsements={endorsementsByPremium[p.id] ?? []}
              splitsByEndorsement={endorsementSplits}
              contacts={allContacts}
            />

            <button
              type="button"
              className="text-sm text-destructive hover:underline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await deletePremium(orderId, p.id)
                  refresh()
                })
              }
            >
              Remove policy
            </button>
          </div>
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
