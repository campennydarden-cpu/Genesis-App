'use client'

import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { COMMITMENT_FORM_TYPES, ALTA_POLICY_FORM_TYPES } from '@/lib/constants'
import { MORTGAGEE_CLAUSE_LOAN_TYPES, buildMortgageeClause } from '@/lib/mortgagee-clause'
import { upsertCommitmentScheduleA } from '@/app/actions/commitment-sch-a'
import type { CommitmentScheduleA, ChainOfTitleEntry } from '@/lib/types'
import { ChainOfTitleSection } from './ChainOfTitleSection'

type ContactSeed = {
  id: string
  name: string
  role: string
  mortgagee_clause: string | null
  trusteeLabel?: string | null
  current_address?: string | null
}
type TitleCompanyContact = { name: string; current_address: string | null; alta_id: string | null } | null
type DerivationSeed = { instrumentType: string; grantor: string; grantee: string } | null

export function CommitmentScheduleAForm({
  orderId,
  commitmentSchA,
  policyType,
  effectiveDateDisplay,
  buyerBorrowerContacts,
  lenderContacts,
  titleCompanyContact,
  purchasePrice,
  loanAmount,
  readOnly,
  chainOfTitleEntries,
  derivationSeed,
}: {
  orderId: string
  commitmentSchA: CommitmentScheduleA | null
  policyType: string
  effectiveDateDisplay: string
  buyerBorrowerContacts: ContactSeed[]
  lenderContacts: ContactSeed[]
  titleCompanyContact?: TitleCompanyContact
  purchasePrice?: number | null
  loanAmount?: number | null
  readOnly?: boolean
  chainOfTitleEntries: ChainOfTitleEntry[]
  derivationSeed: DerivationSeed
}) {
  const [formType, setFormType] = useState<string>(commitmentSchA?.form_type ?? 'Standard')
  const [ownerProposedInsured, setOwnerProposedInsured] = useState(commitmentSchA?.owner_proposed_insured ?? '')
  const [loanProposedInsured, setLoanProposedInsured] = useState(commitmentSchA?.loan_proposed_insured ?? '')

  const isShortForm = formType === 'Short Form'
  const showOwnerPolicy = !isShortForm && (policyType === "Owner's" || policyType === 'Simultaneous')
  const showLoanPolicy = isShortForm || policyType === 'Loan' || policyType === 'Simultaneous'

  const contactsWithMortgageeClause = lenderContacts.filter((c) => c.mortgagee_clause)

  const formRef = useRef<HTMLFormElement>(null)
  // The first successful save creates the commitment_sch_a row. Track its id in client
  // state from the action's own return value (same approach as PropertyForm) — it
  // gates the Chain of Title section below, which needs a real id to add against.
  const [commitmentSchAId, setCommitmentSchAId] = useState<string | null>(commitmentSchA?.id ?? null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => upsertCommitmentScheduleA(orderId, formData))

  function handleSave(override?: { name: string; value: string }) {
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    if (override) {
      formData.set(override.name, override.value)
    }
    save(formData).then((result) => {
      if (result.id) setCommitmentSchAId(result.id)
    })
  }

  function handleProposedInsuredSeed(fieldName: string, setter: (v: string) => void, value: string) {
    setter(value)
    handleSave({ name: fieldName, value })
  }

  return (
    <div>
      <fieldset disabled={readOnly} className="space-y-8 border-0 p-0">
        {readOnly && (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            This commitment is finalized and locked. Revert to Draft in Curative to edit.
          </p>
        )}
        <SaveIndicator state={state} errorMessage={errorMessage} />
        <form ref={formRef} className="space-y-8">
          <div className="rounded border p-4" data-testid="transaction-id-card">
            <h3 className="mb-4 font-semibold">Transaction Identification Data</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="form_type">Commitment Form</Label>
                <Select
                  name="form_type"
                  defaultValue={commitmentSchA?.form_type ?? 'Standard'}
                  onValueChange={(value) => {
                    setFormType(value ?? 'Standard')
                    handleSave({ name: 'form_type', value: (value as string) ?? 'Standard' })
                  }}
                >
                  <SelectTrigger id="form_type" className="w-full">
                    <SelectValue placeholder="— Select —" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMITMENT_FORM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="issuing_agent">Issuing Agent</Label>
                <Input
                  id="issuing_agent"
                  name="issuing_agent"
                  defaultValue={commitmentSchA?.issuing_agent ?? titleCompanyContact?.name ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="issuing_office">Issuing Office</Label>
                <Input
                  id="issuing_office"
                  name="issuing_office"
                  defaultValue={commitmentSchA?.issuing_office ?? titleCompanyContact?.current_address ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="alta_universal_id">ALTA Universal ID</Label>
                <Input
                  id="alta_universal_id"
                  name="alta_universal_id"
                  defaultValue={commitmentSchA?.alta_universal_id ?? titleCompanyContact?.alta_id ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="loan_id_number">Loan ID Number</Label>
                <Input
                  id="loan_id_number"
                  name="loan_id_number"
                  defaultValue={commitmentSchA?.loan_id_number ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="commitment_number">Commitment Number</Label>
                <Input
                  id="commitment_number"
                  name="commitment_number"
                  defaultValue={commitmentSchA?.commitment_number ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="revision_number">Revision Number</Label>
                <Input
                  id="revision_number"
                  name="revision_number"
                  defaultValue={commitmentSchA?.revision_number ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
            </div>
            <div className={`mt-4 ${isShortForm ? '' : 'hidden'}`}>
              <Label htmlFor="env_protection_lien_statutes">
                ALTA 8.1-06 Environmental Protection Lien Statutes
              </Label>
              <Textarea
                id="env_protection_lien_statutes"
                name="env_protection_lien_statutes"
                defaultValue={commitmentSchA?.env_protection_lien_statutes ?? undefined}
                placeholder="State statutes to be set forth on any ALTA 8.1-06 endorsement"
                onBlur={() => handleSave()}
              />
            </div>
          </div>

          <div className="rounded border p-4" data-testid="policy-coverage-card">
            <h3 className="mb-4 font-semibold">Policy &amp; Coverage</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="date_issued">Date Issued</Label>
                <Input
                  id="date_issued"
                  name="date_issued"
                  type="date"
                  defaultValue={commitmentSchA?.date_issued ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="time_issued">Time Issued</Label>
                <Input
                  id="time_issued"
                  name="time_issued"
                  type="time"
                  defaultValue={commitmentSchA?.time_issued ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label>Effective Date</Label>
                <p className="mt-2 text-sm text-slate-700" data-testid="effective-date-fact">
                  {effectiveDateDisplay}
                </p>
              </div>
              <div>
                <Label>Policy Type</Label>
                <p className="mt-2 text-sm text-slate-700" data-testid="policy-type-fact">
                  {policyType}
                </p>
              </div>
              <div className={isShortForm ? '' : 'hidden'}>
                <Label>The Estate or Interest in the Land</Label>
                <p className="mt-2 text-sm text-slate-700" data-testid="estate-fact">
                  Fee Simple (fixed by the ALTA Short Form Commitment)
                </p>
              </div>
              <div className={isShortForm ? 'hidden' : ''}>
                <Label htmlFor="title_held_as">The Estate or Interest in the Land</Label>
                <Input
                  id="title_held_as"
                  name="title_held_as"
                  defaultValue={commitmentSchA?.title_held_as ?? undefined}
                  placeholder="e.g. Fee Simple, Leasehold"
                  onBlur={() => handleSave()}
                />
              </div>
            </div>
            {!showOwnerPolicy && !showLoanPolicy && (
              <p className="mt-4 text-sm text-slate-500">
                Set a Policy Type (Owner&apos;s, Loan, or Simultaneous) on Order Entry to show the policy block(s) below.
              </p>
            )}
          </div>

          <div className={`rounded border p-4 ${showOwnerPolicy ? '' : 'hidden'}`} data-testid="owner-policy-card">
            <h3 className="mb-4 font-semibold">Owner&apos;s Policy</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="owner_policy_type">ALTA Form</Label>
                <Select
                  name="owner_policy_type"
                  defaultValue={commitmentSchA?.owner_policy_type ?? undefined}
                  onValueChange={(v) => handleSave({ name: 'owner_policy_type', value: v as string })}
                >
                  <SelectTrigger id="owner_policy_type">
                    <SelectValue placeholder="— Select —" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALTA_POLICY_FORM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="owner_coverage_amount">Coverage Amount</Label>
                <CurrencyInput
                  id="owner_coverage_amount"
                  name="owner_coverage_amount"
                  defaultValue={commitmentSchA?.owner_coverage_amount ?? purchasePrice ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Checkbox
                  id="owner_coverage_tbd"
                  name="owner_coverage_tbd"
                  defaultChecked={commitmentSchA?.owner_coverage_tbd ?? false}
                  onCheckedChange={(checked) => handleSave({ name: 'owner_coverage_tbd', value: checked ? 'on' : '' })}
                />
                <Label htmlFor="owner_coverage_tbd">Coverage TBD</Label>
              </div>
            </div>
            <div className="mt-4">
              <Label htmlFor="owner_proposed_insured">Proposed Insured</Label>
              <Input
                id="owner_proposed_insured"
                name="owner_proposed_insured"
                value={ownerProposedInsured}
                onChange={(e) => setOwnerProposedInsured(e.target.value)}
                onBlur={() => handleSave()}
              />
            </div>
            {buyerBorrowerContacts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2" data-testid="owner-insured-seed-chips">
                <span className="text-xs text-slate-500">From this file:</span>
                {buyerBorrowerContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                    onClick={() => handleProposedInsuredSeed('owner_proposed_insured', setOwnerProposedInsured, c.name)}
                  >
                    + {c.name}
                  </button>
                ))}
                {buyerBorrowerContacts
                  .filter((c) => c.trusteeLabel)
                  .map((c) => (
                    <button
                      key={`${c.id}-trustee`}
                      type="button"
                      className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                      title={c.trusteeLabel ?? undefined}
                      onClick={() =>
                        handleProposedInsuredSeed('owner_proposed_insured', setOwnerProposedInsured, c.trusteeLabel ?? '')
                      }
                    >
                      + {c.name} (with Trustees)
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className={`rounded border p-4 ${showLoanPolicy ? '' : 'hidden'}`} data-testid="loan-policy-card">
            <h3 className="mb-4 font-semibold">Loan Policy</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="loan_policy_type">ALTA Form</Label>
                <Select
                  name="loan_policy_type"
                  defaultValue={commitmentSchA?.loan_policy_type ?? undefined}
                  onValueChange={(v) => handleSave({ name: 'loan_policy_type', value: v as string })}
                >
                  <SelectTrigger id="loan_policy_type">
                    <SelectValue placeholder="— Select —" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALTA_POLICY_FORM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="loan_coverage_amount">Coverage Amount</Label>
                <CurrencyInput
                  id="loan_coverage_amount"
                  name="loan_coverage_amount"
                  defaultValue={commitmentSchA?.loan_coverage_amount ?? loanAmount ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Checkbox
                  id="loan_coverage_tbd"
                  name="loan_coverage_tbd"
                  defaultChecked={commitmentSchA?.loan_coverage_tbd ?? false}
                  onCheckedChange={(checked) => handleSave({ name: 'loan_coverage_tbd', value: checked ? 'on' : '' })}
                />
                <Label htmlFor="loan_coverage_tbd">Coverage TBD</Label>
              </div>
            </div>
            <div className="mt-4">
              <Label htmlFor="loan_proposed_insured">Proposed Insured</Label>
              <Textarea
                id="loan_proposed_insured"
                name="loan_proposed_insured"
                value={loanProposedInsured}
                onChange={(e) => setLoanProposedInsured(e.target.value)}
                onBlur={() => handleSave()}
              />
            </div>
            {lenderContacts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2" data-testid="loan-insured-seed-chips">
                <span className="text-xs text-slate-500">From this file:</span>
                {lenderContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                    onClick={() => handleProposedInsuredSeed('loan_proposed_insured', setLoanProposedInsured, c.name)}
                  >
                    + {c.name}
                  </button>
                ))}
              </div>
            )}
            {contactsWithMortgageeClause.length > 0 && (
              <div className="mt-2 space-y-1" data-testid="mortgagee-clause-seed-chips">
                <span className="text-xs text-slate-500">Full clause, by Loan Type:</span>
                {contactsWithMortgageeClause.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">{c.name}:</span>
                    {MORTGAGEE_CLAUSE_LOAN_TYPES.map((loanType) => {
                      const clause = buildMortgageeClause(
                        loanType,
                        c.name,
                        c.current_address ?? '',
                        c.mortgagee_clause
                      )
                      return (
                        <button
                          key={loanType}
                          type="button"
                          className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                          title={clause}
                          onClick={() =>
                            handleProposedInsuredSeed('loan_proposed_insured', setLoanProposedInsured, clause)
                          }
                        >
                          + {loanType}
                        </button>
                      )
                    })}
                  </div>
                ))}
                <p className="text-xs text-slate-400">
                  Texas has its own Mortgagee Clause set per Cam&apos;s note — not built yet, needs reference text.
                </p>
              </div>
            )}
          </div>

          <div className="rounded border p-4" data-testid="countersignature-card">
            <h3 className="mb-4 font-semibold">Countersignature</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="counter_signature">Counter Signature</Label>
                <Input
                  id="counter_signature"
                  name="counter_signature"
                  defaultValue={commitmentSchA?.counter_signature ?? undefined}
                  placeholder="Licensee name"
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="counter_signature_date">Counter Signature Date</Label>
                <Input
                  id="counter_signature_date"
                  name="counter_signature_date"
                  type="date"
                  defaultValue={commitmentSchA?.counter_signature_date ?? undefined}
                  onBlur={() => handleSave()}
                />
              </div>
            </div>
          </div>
        </form>
      </fieldset>

      {commitmentSchAId && (
        <div className="mt-10">
          <ChainOfTitleSection
            orderId={orderId}
            commitmentSchAId={commitmentSchAId}
            entries={chainOfTitleEntries}
            derivationSeed={derivationSeed}
          />
        </div>
      )}
    </div>
  )
}
