'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DERIVATION_INSTRUMENT_TYPES, PRELIM_ENTITY_TYPES } from '@/lib/constants'
import { upsertPrelimSearch } from '@/app/actions/prelim-search'
import { fullDerivationClause, derivationVestingClause } from '@/lib/derivation-clause'
import type { PrelimSearch, DerivationPrincipal } from '@/lib/types'
import { DerivationPrincipalRoster } from './DerivationPrincipalRoster'

export function DerivationSection({
  orderId,
  prelimSearch,
  granteePrincipals,
  grantorPrincipals,
  county,
}: {
  orderId: string
  prelimSearch: PrelimSearch | null
  granteePrincipals: DerivationPrincipal[]
  grantorPrincipals: DerivationPrincipal[]
  county: string | null
}) {
  const [granteeType, setGranteeType] = useState(prelimSearch?.derivation_grantee_entity_type ?? '')
  const [grantorType, setGrantorType] = useState(prelimSearch?.derivation_grantor_entity_type ?? '')
  const action = upsertPrelimSearch.bind(null, orderId)

  const vestingClause = prelimSearch
    ? derivationVestingClause(
        prelimSearch.derivation_grantee_name,
        (prelimSearch.derivation_grantee_entity_type as never) ?? null,
        granteePrincipals
      )
    : ''

  const derivationClause = prelimSearch
    ? fullDerivationClause(
        {
          granteeName: prelimSearch.derivation_grantee_name,
          granteeEntityType: (prelimSearch.derivation_grantee_entity_type as never) ?? null,
          grantorName: prelimSearch.derivation_grantor_name,
          grantorEntityType: (prelimSearch.derivation_grantor_entity_type as never) ?? null,
          instrumentType: prelimSearch.derivation_instrument_type,
          recordedDate: prelimSearch.derivation_recorded_date,
          book: prelimSearch.derivation_book,
          page: prelimSearch.derivation_page,
          instrumentNumber: prelimSearch.derivation_instrument_number,
          isPortion: prelimSearch.derivation_is_portion,
          county,
        },
        granteePrincipals,
        grantorPrincipals
      )
    : ''

  return (
    <section id="derivation" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-semibold">Derivation</h2>

      <form action={action} className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="effective_date">Effective Date</Label>
            <Input id="effective_date" name="effective_date" type="date" defaultValue={prelimSearch?.effective_date ?? undefined} />
          </div>
          <div>
            <Label htmlFor="effective_time">Effective Time</Label>
            <Input id="effective_time" name="effective_time" type="time" defaultValue={prelimSearch?.effective_time ?? undefined} />
          </div>
          <div>
            <Label htmlFor="search_type">Search Type</Label>
            <Input id="search_type" name="search_type" defaultValue={prelimSearch?.search_type ?? undefined} />
          </div>
          <div>
            <Label htmlFor="search_from_date">Search From Date</Label>
            <Input id="search_from_date" name="search_from_date" type="date" defaultValue={prelimSearch?.search_from_date ?? undefined} />
          </div>
          <div>
            <Label htmlFor="search_to_date">Search To Date</Label>
            <Input id="search_to_date" name="search_to_date" type="date" defaultValue={prelimSearch?.search_to_date ?? undefined} />
          </div>
          <div>
            <Label htmlFor="search_to_time">Search To Time</Label>
            <Input id="search_to_time" name="search_to_time" type="time" defaultValue={prelimSearch?.search_to_time ?? undefined} />
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">Derivation Record</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="derivation_instrument_type">Instrument Type</Label>
              <Select name="derivation_instrument_type" defaultValue={prelimSearch?.derivation_instrument_type ?? undefined}>
                <SelectTrigger id="derivation_instrument_type">
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {DERIVATION_INSTRUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="derivation_dated_date">Dated Date</Label>
              <Input id="derivation_dated_date" name="derivation_dated_date" type="date" defaultValue={prelimSearch?.derivation_dated_date ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_recorded_date">Recorded Date</Label>
              <Input id="derivation_recorded_date" name="derivation_recorded_date" type="date" defaultValue={prelimSearch?.derivation_recorded_date ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_book">Book</Label>
              <Input id="derivation_book" name="derivation_book" defaultValue={prelimSearch?.derivation_book ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_page">Page</Label>
              <Input id="derivation_page" name="derivation_page" defaultValue={prelimSearch?.derivation_page ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_instrument_number">Instrument Number</Label>
              <Input id="derivation_instrument_number" name="derivation_instrument_number" defaultValue={prelimSearch?.derivation_instrument_number ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_consideration">Consideration</Label>
              <Input id="derivation_consideration" name="derivation_consideration" type="number" step="0.01" defaultValue={prelimSearch?.derivation_consideration ?? undefined} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="derivation_grantee_name">Grantee Name</Label>
              <Input id="derivation_grantee_name" name="derivation_grantee_name" defaultValue={prelimSearch?.derivation_grantee_name ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_grantee_entity_type">Grantee Entity Type</Label>
              <Select
                name="derivation_grantee_entity_type"
                defaultValue={prelimSearch?.derivation_grantee_entity_type ?? undefined}
                onValueChange={(value) => setGranteeType(value ?? '')}
              >
                <SelectTrigger id="derivation_grantee_entity_type">
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {PRELIM_ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="derivation_grantor_name">Grantor Name</Label>
              <Input id="derivation_grantor_name" name="derivation_grantor_name" defaultValue={prelimSearch?.derivation_grantor_name ?? undefined} />
            </div>
            <div>
              <Label htmlFor="derivation_grantor_entity_type">Grantor Entity Type</Label>
              <Select
                name="derivation_grantor_entity_type"
                defaultValue={prelimSearch?.derivation_grantor_entity_type ?? undefined}
                onValueChange={(value) => setGrantorType(value ?? '')}
              >
                <SelectTrigger id="derivation_grantor_entity_type">
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {PRELIM_ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Checkbox id="derivation_is_portion" name="derivation_is_portion" defaultChecked={prelimSearch?.derivation_is_portion ?? false} />
            <Label htmlFor="derivation_is_portion">Conveys a Portion (unchecked = conveys entire property)</Label>
          </div>

          <div className="mt-4">
            <Label htmlFor="derivation_note">Derivation Note</Label>
            <Textarea id="derivation_note" name="derivation_note" rows={3} defaultValue={prelimSearch?.derivation_note ?? undefined} />
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">Real Property Taxes</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="taxes_paid_through_year">Taxes Paid Through Year</Label>
              <Input id="taxes_paid_through_year" name="taxes_paid_through_year" defaultValue={prelimSearch?.taxes_paid_through_year ?? undefined} />
            </div>
            <div>
              <Label htmlFor="taxes_now_due">Taxes Now Due</Label>
              <Input id="taxes_now_due" name="taxes_now_due" defaultValue={prelimSearch?.taxes_now_due ?? undefined} />
            </div>
            <div>
              <Label htmlFor="taxes_not_yet_due">Taxes Not Yet Due</Label>
              <Input id="taxes_not_yet_due" name="taxes_not_yet_due" defaultValue={prelimSearch?.taxes_not_yet_due ?? undefined} />
            </div>
            <div>
              <Label htmlFor="special_levies_assessments">Special Levies/Assessments</Label>
              <Input id="special_levies_assessments" name="special_levies_assessments" defaultValue={prelimSearch?.special_levies_assessments ?? undefined} />
            </div>
          </div>
        </div>

        <Button type="submit">Save Changes</Button>
      </form>

      {prelimSearch && (
        <div className="mt-6 rounded border bg-slate-50 p-4" data-testid="derivation-clause-preview">
          <p className="text-sm font-medium">Vesting Clause</p>
          <p className="mb-3 text-sm text-slate-700" data-testid="vesting-clause">
            {vestingClause || '— complete Grantee Name/Entity Type to generate —'}
          </p>
          <p className="text-sm font-medium">Derivation Clause</p>
          <p className="text-sm text-slate-700" data-testid="derivation-clause">
            {derivationClause || '— complete Grantee, Instrument Type, Grantor, and Recorded Date to generate —'}
          </p>
        </div>
      )}

      {prelimSearch ? (
        <>
          <DerivationPrincipalRoster
            orderId={orderId}
            prelimSearchId={prelimSearch.id}
            side="grantee"
            entityType={granteeType}
            principals={granteePrincipals}
            label="Grantee Principals"
          />
          <DerivationPrincipalRoster
            orderId={orderId}
            prelimSearchId={prelimSearch.id}
            side="grantor"
            entityType={grantorType}
            principals={grantorPrincipals}
            label="Grantor Principals"
          />
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Save Derivation first before adding Principals.</p>
      )}
    </section>
  )
}
