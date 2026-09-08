'use client'

import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimeField } from '@/components/ui/datetime-field'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'
import { DERIVATION_INSTRUMENT_TYPES } from '@/lib/constants'
import { upsertPrelimSearch } from '@/app/actions/prelim-search'
import { fullDerivationClause, derivationVestingClause } from '@/lib/derivation-clause'
import { detectEntityType } from '@/lib/detect-entity-type'
import type { PrelimSearch, DerivationPrincipal, SecurityInstrument, Lien, ExceptionMatter } from '@/lib/types'
import { DerivationPrincipalRoster } from './DerivationPrincipalRoster'
import { SecurityInstrumentsSection } from './SecurityInstrumentsSection'
import { LiensSection } from './LiensSection'
import { ExceptionMattersSection } from './ExceptionMattersSection'

const ROSTER_ENTITY_TYPES = ['LLC', 'Corporation', 'Partnership', 'Trust']

export function DerivationSection({
  orderId,
  prelimSearch,
  granteePrincipals,
  grantorPrincipals,
  county,
  securityInstruments,
  relatedDocsSlots,
  liens,
  exceptionMatters,
}: {
  orderId: string
  prelimSearch: PrelimSearch | null
  granteePrincipals: DerivationPrincipal[]
  grantorPrincipals: DerivationPrincipal[]
  county: string | null
  securityInstruments: SecurityInstrument[]
  relatedDocsSlots?: Record<string, React.ReactNode>
  liens: Lien[]
  exceptionMatters: ExceptionMatter[]
}) {
  // Controlled (not just defaultValue) because the clause preview below is computed
  // live from these — under the old submit-and-redirect form, a save was always a
  // full page reload, which is what kept the preview in sync; autosave has no
  // equivalent reload, so the preview now tracks form state directly instead.
  const [granteeType, setGranteeType] = useState(prelimSearch?.derivation_grantee_entity_type ?? '')
  const [grantorType, setGrantorType] = useState(prelimSearch?.derivation_grantor_entity_type ?? '')
  const [granteeName, setGranteeName] = useState(prelimSearch?.derivation_grantee_name ?? '')
  const [grantorName, setGrantorName] = useState(prelimSearch?.derivation_grantor_name ?? '')
  const [instrumentType, setInstrumentType] = useState(prelimSearch?.derivation_instrument_type ?? '')
  const [recordedDate, setRecordedDate] = useState(prelimSearch?.derivation_recorded_date ?? '')
  const [book, setBook] = useState(prelimSearch?.derivation_book ?? '')
  const [pageNum, setPageNum] = useState(prelimSearch?.derivation_page ?? '')
  const [instrumentNumber, setInstrumentNumber] = useState(prelimSearch?.derivation_instrument_number ?? '')
  const [isPortion, setIsPortion] = useState(prelimSearch?.derivation_is_portion ?? false)

  const formRef = useRef<HTMLFormElement>(null)
  // The first successful save creates the prelim_search row. Track its id in client
  // state from the action's own return value (same approach as PropertyForm) — it
  // gates the sibling sections below, which need a real prelimSearchId to add against.
  const [prelimSearchId, setPrelimSearchId] = useState<string | null>(prelimSearch?.id ?? null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => upsertPrelimSearch(orderId, formData))

  function handleSave(override?: { name: string; value: string }) {
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    if (override) {
      formData.set(override.name, override.value)
    }
    save(formData).then((result) => {
      if (result.id) setPrelimSearchId(result.id)
    })
  }

  const vestingClause = prelimSearchId
    ? derivationVestingClause(granteeName, (granteeType as never) || null, granteePrincipals)
    : ''

  const derivationClause = prelimSearchId
    ? fullDerivationClause(
        {
          granteeName,
          granteeEntityType: (granteeType as never) || null,
          grantorName,
          grantorEntityType: (grantorType as never) || null,
          instrumentType,
          recordedDate,
          book,
          page: pageNum,
          instrumentNumber,
          isPortion,
          county,
        },
        granteePrincipals,
        grantorPrincipals
      )
    : ''

  return (
    <section id="derivation" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-semibold">Title History</h2>

      <SaveIndicator state={state} errorMessage={errorMessage} />

      <form ref={formRef} className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <DateTimeField
            id="effective_datetime"
            label="Effective Date"
            dateName="effective_date"
            timeName="effective_time"
            defaultDate={prelimSearch?.effective_date}
            defaultTime={prelimSearch?.effective_time}
            onBlur={() => handleSave()}
          />
          <div>
            <Label htmlFor="search_type">Search Type</Label>
            <Input
              id="search_type"
              name="search_type"
              defaultValue={prelimSearch?.search_type ?? undefined}
              onBlur={() => handleSave()}
            />
          </div>
          <div>
            <Label htmlFor="search_from_date">Search From Date</Label>
            <Input
              id="search_from_date"
              name="search_from_date"
              type="date"
              defaultValue={prelimSearch?.search_from_date ?? undefined}
              onBlur={() => handleSave()}
            />
          </div>
          <DateTimeField
            id="search_to_datetime"
            label="Search To Date"
            dateName="search_to_date"
            timeName="search_to_time"
            defaultDate={prelimSearch?.search_to_date}
            defaultTime={prelimSearch?.search_to_time}
            onBlur={() => handleSave()}
          />
        </div>

        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">Derivation Record</p>

          <div className="mb-4">
            <Label htmlFor="derivation_instrument_type">Deed Type</Label>
            <Select
              name="derivation_instrument_type"
              value={instrumentType}
              onValueChange={(v) => {
                setInstrumentType((v as string) ?? '')
                handleSave({ name: 'derivation_instrument_type', value: v as string })
              }}
            >
              <SelectTrigger id="derivation_instrument_type" className="w-full">
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

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="derivation_grantor_name">Grantor Name</Label>
              <Input
                id="derivation_grantor_name"
                name="derivation_grantor_name"
                value={grantorName}
                onChange={(e) => setGrantorName(e.target.value)}
                onBlur={() => {
                  const detected = detectEntityType(grantorName)
                  setGrantorType(detected)
                  handleSave({ name: 'derivation_grantor_entity_type', value: detected })
                }}
              />
              <input type="hidden" name="derivation_grantor_entity_type" value={grantorType} />
            </div>
            <div>
              <Label htmlFor="derivation_grantee_name">Grantee Name</Label>
              <Input
                id="derivation_grantee_name"
                name="derivation_grantee_name"
                value={granteeName}
                onChange={(e) => setGranteeName(e.target.value)}
                onBlur={() => {
                  const detected = detectEntityType(granteeName)
                  setGranteeType(detected)
                  handleSave({ name: 'derivation_grantee_entity_type', value: detected })
                }}
              />
              <input type="hidden" name="derivation_grantee_entity_type" value={granteeType} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="derivation_dated_date">Dated Date</Label>
              <Input
                id="derivation_dated_date"
                name="derivation_dated_date"
                type="date"
                defaultValue={prelimSearch?.derivation_dated_date ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="derivation_recorded_date">Recorded Date</Label>
              <Input
                id="derivation_recorded_date"
                name="derivation_recorded_date"
                type="date"
                value={recordedDate ?? ''}
                onChange={(e) => setRecordedDate(e.target.value)}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="derivation_book">Book</Label>
              <Input
                id="derivation_book"
                name="derivation_book"
                value={book ?? ''}
                onChange={(e) => setBook(e.target.value)}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="derivation_page">Page</Label>
              <Input
                id="derivation_page"
                name="derivation_page"
                value={pageNum ?? ''}
                onChange={(e) => setPageNum(e.target.value)}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="derivation_instrument_number">Instrument Number</Label>
              <Input
                id="derivation_instrument_number"
                name="derivation_instrument_number"
                value={instrumentNumber ?? ''}
                onChange={(e) => setInstrumentNumber(e.target.value)}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="derivation_consideration">Consideration</Label>
              <CurrencyInput
                id="derivation_consideration"
                name="derivation_consideration"
                defaultValue={prelimSearch?.derivation_consideration ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Checkbox
              id="derivation_is_portion"
              name="derivation_is_portion"
              checked={isPortion}
              onCheckedChange={(checked) => {
                setIsPortion(!!checked)
                handleSave({ name: 'derivation_is_portion', value: checked ? 'on' : '' })
              }}
            />
            <Label htmlFor="derivation_is_portion">Conveys a Portion (unchecked = conveys entire property)</Label>
          </div>

          <div className="mt-4">
            <Label htmlFor="derivation_note">Derivation Note</Label>
            <Textarea
              id="derivation_note"
              name="derivation_note"
              rows={3}
              defaultValue={prelimSearch?.derivation_note ?? undefined}
              onBlur={() => handleSave()}
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">Real Property Taxes</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="taxes_paid_through_year">Taxes Paid Through Year</Label>
              <Input
                id="taxes_paid_through_year"
                name="taxes_paid_through_year"
                defaultValue={prelimSearch?.taxes_paid_through_year ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="taxes_now_due">Taxes Now Due</Label>
              <Input
                id="taxes_now_due"
                name="taxes_now_due"
                defaultValue={prelimSearch?.taxes_now_due ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="taxes_not_yet_due">Taxes Not Yet Due</Label>
              <Input
                id="taxes_not_yet_due"
                name="taxes_not_yet_due"
                defaultValue={prelimSearch?.taxes_not_yet_due ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="special_levies_assessments">Special Levies/Assessments</Label>
              <Input
                id="special_levies_assessments"
                name="special_levies_assessments"
                defaultValue={prelimSearch?.special_levies_assessments ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
          </div>
        </div>
      </form>

      {prelimSearchId && (
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

      {prelimSearchId ? (
        <>
          {ROSTER_ENTITY_TYPES.includes(granteeType) && (
            <DerivationPrincipalRoster
              orderId={orderId}
              prelimSearchId={prelimSearchId}
              side="grantee"
              entityType={granteeType}
              principals={granteePrincipals}
              label="Grantee Principals"
            />
          )}
          {ROSTER_ENTITY_TYPES.includes(grantorType) && (
            <DerivationPrincipalRoster
              orderId={orderId}
              prelimSearchId={prelimSearchId}
              side="grantor"
              entityType={grantorType}
              principals={grantorPrincipals}
              label="Grantor Principals"
            />
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Save Derivation first before adding Principals.</p>
      )}

      {prelimSearchId && (
        <div className="mt-10 space-y-10">
          <SecurityInstrumentsSection
            orderId={orderId}
            prelimSearchId={prelimSearchId}
            instruments={securityInstruments}
            relatedDocsSlots={relatedDocsSlots}
          />
          <LiensSection orderId={orderId} prelimSearchId={prelimSearchId} liens={liens} />
          <ExceptionMattersSection orderId={orderId} prelimSearchId={prelimSearchId} matters={exceptionMatters} />
        </div>
      )}
    </section>
  )
}
