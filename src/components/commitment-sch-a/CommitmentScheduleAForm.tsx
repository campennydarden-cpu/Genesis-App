'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COMMITMENT_FORM_TYPES, ALTA_POLICY_FORM_TYPES } from '@/lib/constants'
import type { CommitmentScheduleA } from '@/lib/types'

type ContactSeed = { id: string; name: string; role: string; mortgagee_clause: string | null }

export function CommitmentScheduleAForm({
  action,
  commitmentSchA,
  policyType,
  effectiveDateDisplay,
  buyerBorrowerContacts,
  lenderContacts,
}: {
  action: (formData: FormData) => void
  commitmentSchA: CommitmentScheduleA | null
  policyType: string
  effectiveDateDisplay: string
  buyerBorrowerContacts: ContactSeed[]
  lenderContacts: ContactSeed[]
}) {
  const [formType, setFormType] = useState<string>(commitmentSchA?.form_type ?? 'Standard')
  const [ownerProposedInsured, setOwnerProposedInsured] = useState(commitmentSchA?.owner_proposed_insured ?? '')
  const [loanProposedInsured, setLoanProposedInsured] = useState(commitmentSchA?.loan_proposed_insured ?? '')
  const [loanMortgageeClause, setLoanMortgageeClause] = useState(commitmentSchA?.loan_mortgagee_clause ?? '')

  const isShortForm = formType === 'Short Form'
  const showOwnerPolicy = !isShortForm && (policyType === "Owner's" || policyType === 'Simultaneous')
  const showLoanPolicy = isShortForm || policyType === 'Loan' || policyType === 'Simultaneous'

  const contactsWithMortgageeClause = lenderContacts.filter((c) => c.mortgagee_clause)

  return (
    <form action={action} className="space-y-8">
      <div className="rounded border p-4" data-testid="commitment-form-card">
        <h3 className="mb-4 font-semibold">Commitment Form</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="form_type">Form Type</Label>
            <Select
              name="form_type"
              defaultValue={commitmentSchA?.form_type ?? 'Standard'}
              onValueChange={(value) => setFormType(value ?? 'Standard')}
            >
              <SelectTrigger id="form_type">
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
            <Label htmlFor="company_state_of_org">Company&apos;s State of Organization</Label>
            <Input
              id="company_state_of_org"
              name="company_state_of_org"
              defaultValue={commitmentSchA?.company_state_of_org ?? undefined}
              placeholder="e.g. Ohio corporation"
            />
          </div>
          <div>
            <Label htmlFor="requirements_time_period">Requirements Time Period</Label>
            <Input
              id="requirements_time_period"
              name="requirements_time_period"
              defaultValue={commitmentSchA?.requirements_time_period ?? undefined}
              placeholder="e.g. 6 months"
            />
          </div>
        </div>
        {isShortForm && (
          <div className="mt-4">
            <Label htmlFor="env_protection_lien_statutes">
              ALTA 8.1-06 Environmental Protection Lien Statutes
            </Label>
            <Textarea
              id="env_protection_lien_statutes"
              name="env_protection_lien_statutes"
              defaultValue={commitmentSchA?.env_protection_lien_statutes ?? undefined}
              placeholder="State statutes to be set forth on any ALTA 8.1-06 endorsement"
            />
          </div>
        )}
      </div>

      <div className="rounded border p-4" data-testid="transaction-id-card">
        <h3 className="mb-4 font-semibold">Transaction Identification Data</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="issuing_agent">Issuing Agent</Label>
            <Input id="issuing_agent" name="issuing_agent" defaultValue={commitmentSchA?.issuing_agent ?? undefined} />
          </div>
          <div>
            <Label htmlFor="issuing_office">Issuing Office</Label>
            <Input id="issuing_office" name="issuing_office" defaultValue={commitmentSchA?.issuing_office ?? undefined} />
          </div>
          <div>
            <Label htmlFor="alta_universal_id">ALTA Universal ID</Label>
            <Input id="alta_universal_id" name="alta_universal_id" defaultValue={commitmentSchA?.alta_universal_id ?? undefined} />
          </div>
          <div>
            <Label htmlFor="loan_id_number">Loan ID Number</Label>
            <Input id="loan_id_number" name="loan_id_number" defaultValue={commitmentSchA?.loan_id_number ?? undefined} />
          </div>
          <div>
            <Label htmlFor="commitment_number">Commitment Number</Label>
            <Input id="commitment_number" name="commitment_number" defaultValue={commitmentSchA?.commitment_number ?? undefined} />
          </div>
          <div>
            <Label htmlFor="revision_number">Revision Number</Label>
            <Input id="revision_number" name="revision_number" defaultValue={commitmentSchA?.revision_number ?? undefined} />
          </div>
        </div>
      </div>

      <div className="rounded border p-4" data-testid="policy-coverage-card">
        <h3 className="mb-4 font-semibold">Policy &amp; Coverage</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="date_issued">Date Issued</Label>
            <Input id="date_issued" name="date_issued" type="date" defaultValue={commitmentSchA?.date_issued ?? undefined} />
          </div>
          <div>
            <Label htmlFor="time_issued">Time Issued</Label>
            <Input id="time_issued" name="time_issued" type="time" defaultValue={commitmentSchA?.time_issued ?? undefined} />
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
          {isShortForm ? (
            <div>
              <Label>The Estate or Interest in the Land</Label>
              <p className="mt-2 text-sm text-slate-700" data-testid="estate-fact">
                Fee Simple (fixed by the ALTA Short Form Commitment)
              </p>
            </div>
          ) : (
            <div>
              <Label htmlFor="title_held_as">The Estate or Interest in the Land</Label>
              <Input
                id="title_held_as"
                name="title_held_as"
                defaultValue={commitmentSchA?.title_held_as ?? undefined}
                placeholder="e.g. Fee Simple, Leasehold"
              />
            </div>
          )}
        </div>
        {!showOwnerPolicy && !showLoanPolicy && (
          <p className="mt-4 text-sm text-slate-500">
            Set a Policy Type (Owner&apos;s, Loan, or Simultaneous) on Order Entry to show the policy block(s) below.
          </p>
        )}
      </div>

      {showOwnerPolicy && (
        <div className="rounded border p-4" data-testid="owner-policy-card">
          <h3 className="mb-4 font-semibold">Owner&apos;s Policy</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="owner_policy_type">ALTA Form</Label>
              <Select name="owner_policy_type" defaultValue={commitmentSchA?.owner_policy_type ?? undefined}>
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
              <Input
                id="owner_coverage_amount"
                name="owner_coverage_amount"
                type="number"
                step="0.01"
                defaultValue={commitmentSchA?.owner_coverage_amount ?? undefined}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox id="owner_coverage_tbd" name="owner_coverage_tbd" defaultChecked={commitmentSchA?.owner_coverage_tbd ?? false} />
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
                  onClick={() => setOwnerProposedInsured(c.name)}
                >
                  + {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showLoanPolicy && (
        <div className="rounded border p-4" data-testid="loan-policy-card">
          <h3 className="mb-4 font-semibold">Loan Policy</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="loan_policy_type">ALTA Form</Label>
              <Select name="loan_policy_type" defaultValue={commitmentSchA?.loan_policy_type ?? undefined}>
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
              <Input
                id="loan_coverage_amount"
                name="loan_coverage_amount"
                type="number"
                step="0.01"
                defaultValue={commitmentSchA?.loan_coverage_amount ?? undefined}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox id="loan_coverage_tbd" name="loan_coverage_tbd" defaultChecked={commitmentSchA?.loan_coverage_tbd ?? false} />
              <Label htmlFor="loan_coverage_tbd">Coverage TBD</Label>
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="loan_proposed_insured">Proposed Insured</Label>
            <Input
              id="loan_proposed_insured"
              name="loan_proposed_insured"
              value={loanProposedInsured}
              onChange={(e) => setLoanProposedInsured(e.target.value)}
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
                  onClick={() => setLoanProposedInsured(c.name)}
                >
                  + {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Label htmlFor="loan_mortgagee_clause">Mortgagee Clause</Label>
            <Textarea
              id="loan_mortgagee_clause"
              name="loan_mortgagee_clause"
              value={loanMortgageeClause}
              onChange={(e) => setLoanMortgageeClause(e.target.value)}
              placeholder="ISAOA/ATIMA clause language"
            />
          </div>
          {contactsWithMortgageeClause.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" data-testid="mortgagee-clause-seed-chips">
              <span className="text-xs text-slate-500">From Lender contact on file:</span>
              {contactsWithMortgageeClause.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                  title={c.mortgagee_clause ?? undefined}
                  onClick={() => setLoanMortgageeClause(c.mortgagee_clause ?? '')}
                >
                  + Copy from {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
            />
          </div>
          <div>
            <Label htmlFor="counter_signature_date">Counter Signature Date</Label>
            <Input
              id="counter_signature_date"
              name="counter_signature_date"
              type="date"
              defaultValue={commitmentSchA?.counter_signature_date ?? undefined}
            />
          </div>
        </div>
      </div>

      <Button type="submit">Save Changes</Button>
    </form>
  )
}
