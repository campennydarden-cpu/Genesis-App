'use client'

import { useRef, useState } from 'react'
import { USE_TYPES, PARCEL_NUMBER_TYPES, EASEMENT_TYPES } from '@/lib/constants'
import { upsertPropertyDetails, addEasement, deleteEasement } from '@/app/actions/property'
import type { PropertyDetails, PropertyEasement } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SaveIndicator } from '@/components/SaveIndicator'
import { useAutosave } from '@/lib/use-autosave'

type Tab = 'identification' | 'legal' | 'survey'

type OrderDefaults = {
  property_address: string | null
  city: string | null
  county: string | null
  state: string | null
  zip: string | null
  parcel_number: string | null
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'identification', label: 'Identification' },
  { key: 'legal', label: 'Legal Description' },
  { key: 'survey', label: 'Plat & Survey Matters' },
]

export function PropertyForm({
  orderId,
  property,
  orderDefaults,
  easements,
}: {
  orderId: string
  property: PropertyDetails | null
  orderDefaults: OrderDefaults
  easements: PropertyEasement[]
}) {
  const [tab, setTab] = useState<Tab>('identification')
  const [useType, setUseType] = useState(property?.use_type ?? '')
  const [parcelNumberType, setParcelNumberType] = useState(property?.parcel_number_type ?? '')
  const [easementType, setEasementType] = useState<string>(EASEMENT_TYPES[0])

  const formRef = useRef<HTMLFormElement>(null)
  // The first successful save creates the property_details row. Track its id in client
  // state from the action's own return value — a router.refresh() here was tried first
  // and reverted: it remounted this component mid-save, resetting saveState to 'idle'
  // and orphaning whichever save was still in flight.
  const [propertyId, setPropertyId] = useState<string | null>(property?.id ?? null)
  const { state, errorMessage, save } = useAutosave((formData: FormData) => upsertPropertyDetails(orderId, formData))

  function handleSave(override?: { name: string; value: string }) {
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    if (override) {
      formData.set(override.name, override.value)
    }
    save(formData).then((result) => {
      if (result.id) setPropertyId(result.id)
    })
  }

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b" data-testid="property-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            data-testid={`property-tab-${t.key}`}
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

      <SaveIndicator state={state} errorMessage={errorMessage} />

      <form ref={formRef} className="space-y-4">
        <div className={tab === 'identification' ? 'space-y-4' : 'hidden'}>
          <div>
            <Label htmlFor="property_address">Property Address</Label>
            <Input
              id="property_address"
              name="property_address"
              defaultValue={
                property
                  ? (property.property_address ?? undefined)
                  : (orderDefaults.property_address ?? undefined)
              }
              className="mt-1"
              onBlur={() => handleSave()}
            />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                defaultValue={property ? (property.city ?? undefined) : (orderDefaults.city ?? undefined)}
                className="mt-1"
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="county">County</Label>
              <Input
                id="county"
                name="county"
                defaultValue={property ? (property.county ?? undefined) : (orderDefaults.county ?? undefined)}
                className="mt-1"
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                name="state"
                defaultValue={property ? (property.state ?? undefined) : (orderDefaults.state ?? undefined)}
                className="mt-1"
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="zip">Zip</Label>
              <Input
                id="zip"
                name="zip"
                defaultValue={property ? (property.zip ?? undefined) : (orderDefaults.zip ?? undefined)}
                className="mt-1"
                onBlur={() => handleSave()}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="section">Section</Label>
              <Input
                id="section"
                name="section"
                defaultValue={property?.section ?? undefined}
                className="mt-1"
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="township">Township</Label>
              <Input
                id="township"
                name="township"
                defaultValue={property?.township ?? undefined}
                className="mt-1"
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="range">Range</Label>
              <Input
                id="range"
                name="range"
                defaultValue={property?.range ?? undefined}
                className="mt-1"
                onBlur={() => handleSave()}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="brief_legal">Brief Legal</Label>
            <Input
              id="brief_legal"
              name="brief_legal"
              defaultValue={property?.brief_legal ?? undefined}
              className="mt-1"
              onBlur={() => handleSave()}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="lot">Lot</Label>
              <Input
                id="lot"
                name="lot"
                defaultValue={property?.lot ?? undefined}
                className="mt-1"
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="block">Block</Label>
              <Input
                id="block"
                name="block"
                defaultValue={property?.block ?? undefined}
                className="mt-1"
                onBlur={() => handleSave()}
              />
            </div>
            <div>
              <Label htmlFor="subdivision_tract">Subdivision/Tract</Label>
              <Input
                id="subdivision_tract"
                name="subdivision_tract"
                defaultValue={property?.subdivision_tract ?? undefined}
                className="mt-1"
                onBlur={() => handleSave()}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="use_type">Use Type</Label>
            <Select
              name="use_type"
              value={useType}
              onValueChange={(v) => {
                setUseType(v as string)
                handleSave({ name: 'use_type', value: v as string })
              }}
            >
              <SelectTrigger id="use_type" className="mt-1 w-full">
                <SelectValue placeholder="— Select —" />
              </SelectTrigger>
              <SelectContent>
                {USE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className={tab === 'legal' ? 'space-y-4' : 'hidden'}>
          <div>
            <Label htmlFor="full_legal_description">Full Legal Description</Label>
            <Textarea
              id="full_legal_description"
              name="full_legal_description"
              defaultValue={property?.full_legal_description ?? undefined}
              rows={4}
              className="mt-1"
              onBlur={() => handleSave()}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="parcel_number_type">Parcel Number Type</Label>
              <Select
                name="parcel_number_type"
                value={parcelNumberType}
                onValueChange={(v) => {
                  setParcelNumberType(v as string)
                  handleSave({ name: 'parcel_number_type', value: v as string })
                }}
              >
                <SelectTrigger id="parcel_number_type" className="mt-1 w-full">
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {PARCEL_NUMBER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="parcel_number">Parcel Number</Label>
              <Input
                id="parcel_number"
                name="parcel_number"
                defaultValue={
                  property ? (property.parcel_number ?? undefined) : (orderDefaults.parcel_number ?? undefined)
                }
                className="mt-1"
                onBlur={() => handleSave()}
              />
            </div>
          </div>

          <fieldset className="m-0 border-0 border-t p-0 pt-4">
            <legend className="mb-2 text-sm font-medium">CCRs / Master Deed</legend>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="ccrs_dated">Dated</Label>
                <Input
                  id="ccrs_dated"
                  name="ccrs_dated"
                  type="date"
                  defaultValue={property?.ccrs_dated ?? undefined}
                  className="mt-1"
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="ccrs_book">Book</Label>
                <Input
                  id="ccrs_book"
                  name="ccrs_book"
                  defaultValue={property?.ccrs_book ?? undefined}
                  className="mt-1"
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="ccrs_page">Page</Label>
                <Input
                  id="ccrs_page"
                  name="ccrs_page"
                  defaultValue={property?.ccrs_page ?? undefined}
                  className="mt-1"
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="ccrs_instrument_number">Instrument #</Label>
                <Input
                  id="ccrs_instrument_number"
                  name="ccrs_instrument_number"
                  defaultValue={property?.ccrs_instrument_number ?? undefined}
                  className="mt-1"
                  onBlur={() => handleSave()}
                />
              </div>
            </div>
            <div className="mt-4">
              <Label htmlFor="ccrs_notes">Notes</Label>
              <Input
                id="ccrs_notes"
                name="ccrs_notes"
                defaultValue={property?.ccrs_notes ?? undefined}
                className="mt-1"
                onBlur={() => handleSave()}
              />
            </div>
          </fieldset>
        </div>

        <div className={tab === 'survey' ? 'space-y-4' : 'hidden'}>
          <div>
            <Label htmlFor="plat_survey_reference">Plat/Survey Reference</Label>
            <Input
              id="plat_survey_reference"
              name="plat_survey_reference"
              defaultValue={property?.plat_survey_reference ?? undefined}
              className="mt-1"
              onBlur={() => handleSave()}
            />
          </div>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-medium">Setback Lines</legend>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="setback_front">Front</Label>
                <Input
                  id="setback_front"
                  name="setback_front"
                  defaultValue={property?.setback_front ?? undefined}
                  className="mt-1"
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="setback_side">Side</Label>
                <Input
                  id="setback_side"
                  name="setback_side"
                  defaultValue={property?.setback_side ?? undefined}
                  className="mt-1"
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="setback_side_street">Side Street</Label>
                <Input
                  id="setback_side_street"
                  name="setback_side_street"
                  defaultValue={property?.setback_side_street ?? undefined}
                  className="mt-1"
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="setback_rear">Rear</Label>
                <Input
                  id="setback_rear"
                  name="setback_rear"
                  defaultValue={property?.setback_rear ?? undefined}
                  className="mt-1"
                  onBlur={() => handleSave()}
                />
              </div>
            </div>
          </fieldset>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-medium">Lot Dimensions</legend>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lot_dimension_frontage">Street Frontage</Label>
                <Input
                  id="lot_dimension_frontage"
                  name="lot_dimension_frontage"
                  defaultValue={property?.lot_dimension_frontage ?? undefined}
                  className="mt-1"
                  onBlur={() => handleSave()}
                />
              </div>
              <div>
                <Label htmlFor="lot_dimension_depth">Depth</Label>
                <Input
                  id="lot_dimension_depth"
                  name="lot_dimension_depth"
                  defaultValue={property?.lot_dimension_depth ?? undefined}
                  className="mt-1"
                  onBlur={() => handleSave()}
                />
              </div>
            </div>
          </fieldset>
        </div>
      </form>

      {tab === 'legal' && (
        <div className="mt-8 border-t pt-6">
          <h2 className="mb-4 text-lg font-semibold">Access / Easements / ROW</h2>
          {!propertyId ? (
            <p className="text-sm text-muted-foreground">Save Property Details first before adding easements.</p>
          ) : (
            <>
              <ul className="mb-6 space-y-2" data-testid="easement-list">
                {easements.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded border p-3"
                    data-testid="easement-row"
                  >
                    <div>
                      <p className="font-medium">{e.type === 'Other' ? e.other_type_text : e.type}</p>
                      {e.description && <p className="text-sm text-muted-foreground">{e.description}</p>}
                    </div>
                    <form action={deleteEasement.bind(null, orderId, e.id)}>
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        className="min-h-11"
                        onClick={(event) => {
                          if (!window.confirm('Remove this easement?')) {
                            event.preventDefault()
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </form>
                  </li>
                ))}
                {easements.length === 0 && (
                  <p className="text-sm text-muted-foreground">No easements added yet.</p>
                )}
              </ul>

              <details className="rounded border p-4">
                <summary className="cursor-pointer font-medium">Add an easement</summary>
                <form action={addEasement.bind(null, propertyId, orderId)} className="mt-4 space-y-4">
                  <div>
                    <Label htmlFor="easement_type">Type</Label>
                    <Select
                      name="type"
                      value={easementType}
                      onValueChange={(v) => setEasementType(v as string)}
                    >
                      <SelectTrigger id="easement_type" className="mt-1 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EASEMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {easementType === 'Other' && (
                    <div>
                      <Label htmlFor="other_type_text">Specify Type</Label>
                      <Input id="other_type_text" name="other_type_text" className="mt-1" />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="description">Notes</Label>
                    <Input id="description" name="description" className="mt-1" />
                  </div>
                  <Button type="submit">Add Easement</Button>
                </form>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  )
}
