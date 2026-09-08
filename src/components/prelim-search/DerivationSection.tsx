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

type Tab = 'derivation' | 'security-instruments' | 'liens' | 'taxes' | 'exception-matters'

const TABS: { key: Tab; label: string }[] = [
  { key: 'derivation', label: 'Title History' },
  { key: 'security-instruments', label: 'Security Instruments' },
  { key: 'liens', label: 'Other Liens & Encumbrances' },
  { key: 'taxes', label: 'Real Estate Taxes' },
  { key: 'exception-matters', label: 'Exception Matters' },
]

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
  const [tab, setTab] = useState<Tab>('derivation')

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
      <div className="mb-6 flex gap-2 border-b" data-testid="prelim-search-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            data-testid={`prelim-search-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`flex min-h-11 cursor-pointer items-center px-3 py-2 text-sm transition-colors duration-200 ${
              tab === t.key
                ? 'border-b-2 border-foreground font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === 'derivation' || tab === 'taxes' ? '' : 'hidden'}>
        <SaveIndicator state={state} errorMessage={errorMessage} />
      </div>

      <form ref={formRef} className="space-y-6">
        <div className={tab === 'derivation' ? 'space-y-6' : 'hidden'}>
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
        </div>

        <div className={tab === 'taxes' ? 'space-y-4' : 'hidden'}>
        <div className="pt-4">
          <p className="mb-3 text-sm font-medium">Last Paid Bill</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <Label htmlFor="tax_last_paid_year">Year</Label>
              <Input
                id="tax_last_paid_year"
                name="tax_last_paid_year"
                defaultValue={prelimSearch?.tax_last_paid_year ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="tax_last_paid_installment_count">Installment Count</Label>
              <Input
                id="tax_last_paid_installment_count"
                name="tax_last_paid_installment_count"
                type="number"
                min="0"
                defaultValue={prelimSearch?.tax_last_paid_installment_count ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="tax_last_paid_installment_amount">Per-Installment Amount</Label>
              <CurrencyInput
                id="tax_last_paid_installment_amount"
                name="tax_last_paid_installment_amount"
                defaultValue={prelimSearch?.tax_last_paid_installment_amount ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="tax_last_paid_due_date">Due Date</Label>
              <Input
                id="tax_last_paid_due_date"
                name="tax_last_paid_due_date"
                type="date"
                defaultValue={prelimSearch?.tax_last_paid_due_date ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
          </div>
        </div>

        <div className="pt-4">
          <p className="mb-3 text-sm font-medium">Next Due Bill</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div>
              <Label htmlFor="tax_next_due_year">Year</Label>
              <Input
                id="tax_next_due_year"
                name="tax_next_due_year"
                defaultValue={prelimSearch?.tax_next_due_year ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="tax_next_due_installment_number">Installment No.</Label>
              <Input
                id="tax_next_due_installment_number"
                name="tax_next_due_installment_number"
                type="number"
                min="0"
                defaultValue={prelimSearch?.tax_next_due_installment_number ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="tax_next_due_installment_count">of Total</Label>
              <Input
                id="tax_next_due_installment_count"
                name="tax_next_due_installment_count"
                type="number"
                min="0"
                defaultValue={prelimSearch?.tax_next_due_installment_count ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="tax_next_due_amount">Amount</Label>
              <CurrencyInput
                id="tax_next_due_amount"
                name="tax_next_due_amount"
                defaultValue={prelimSearch?.tax_next_due_amount ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="tax_next_due_due_date">Due Date</Label>
              <Input
                id="tax_next_due_due_date"
                name="tax_next_due_due_date"
                type="date"
                defaultValue={prelimSearch?.tax_next_due_due_date ?? undefined}
                onBlur={() => handleSave()}
              />
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Label htmlFor="special_levies_assessments">Special Levies/Assessments</Label>
          <Input
            id="special_levies_assessments"
            name="special_levies_assessments"
            defaultValue={prelimSearch?.special_levies_assessments ?? undefined}
            onBlur={() => handleSave()}
          />
        </div>
        </div>
      </form>

      <div className={tab === 'derivation' ? '' : 'hidden'}>
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
      </div>

      <div className={tab === 'security-instruments' ? '' : 'hidden'}>
        {prelimSearchId ? (
          <SecurityInstrumentsSection
            orderId={orderId}
            prelimSearchId={prelimSearchId}
            instruments={securityInstruments}
            relatedDocsSlots={relatedDocsSlots}
          />
        ) : (
          <p className="text-sm text-slate-500">Save Title History first before adding Security Instruments.</p>
        )}
      </div>

      <div className={tab === 'liens' ? '' : 'hidden'}>
        {prelimSearchId ? (
          <LiensSection orderId={orderId} prelimSearchId={prelimSearchId} liens={liens} />
        ) : (
          <p className="text-sm text-slate-500">Save Title History first before adding Liens.</p>
        )}
      </div>

      <div className={tab === 'exception-matters' ? '' : 'hidden'}>
        {prelimSearchId ? (
          <ExceptionMattersSection orderId={orderId} prelimSearchId={prelimSearchId} matters={exceptionMatters} />
        ) : (
          <p className="text-sm text-slate-500">Save Title History first before adding Exception Matters.</p>
        )}
      </div>
    </section>
  )
}
