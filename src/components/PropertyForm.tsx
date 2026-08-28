'use client'

import { useState } from 'react'
import { USE_TYPES, PARCEL_NUMBER_TYPES, EASEMENT_TYPES } from '@/lib/constants'
import { addEasement, deleteEasement } from '@/app/actions/property'
import type { PropertyDetails, PropertyEasement } from '@/lib/types'

type Tab = 'identification' | 'legal' | 'survey'

type OrderDefaults = {
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
  action,
  orderId,
  property,
  orderDefaults,
  easements,
}: {
  action: (formData: FormData) => void
  orderId: string
  property: PropertyDetails | null
  orderDefaults: OrderDefaults
  easements: PropertyEasement[]
}) {
  const [tab, setTab] = useState<Tab>('identification')
  const [easementType, setEasementType] = useState<string>(EASEMENT_TYPES[0])

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b" data-testid="property-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            data-testid={`property-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm ${
              tab === t.key
                ? 'border-b-2 border-slate-900 font-medium text-slate-900'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form action={action} className="space-y-4">
        <div className={tab === 'identification' ? 'space-y-4' : 'hidden'}>
          <div>
            <label htmlFor="house_number" className="block text-sm font-medium">
              House Number
            </label>
            <input
              id="house_number"
              name="house_number"
              defaultValue={property?.house_number ?? undefined}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="street_name" className="block text-sm font-medium">
              Street Name
            </label>
            <input
              id="street_name"
              name="street_name"
              defaultValue={property?.street_name ?? undefined}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="street_suffix" className="block text-sm font-medium">
                Street Suffix
              </label>
              <input
                id="street_suffix"
                name="street_suffix"
                defaultValue={property?.street_suffix ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="directional" className="block text-sm font-medium">
                Directional
              </label>
              <input
                id="directional"
                name="directional"
                defaultValue={property?.directional ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium">
                City
              </label>
              <input
                id="city"
                name="city"
                defaultValue={property?.city ?? orderDefaults.city ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="county" className="block text-sm font-medium">
                County
              </label>
              <input
                id="county"
                name="county"
                defaultValue={property?.county ?? orderDefaults.county ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium">
                State
              </label>
              <input
                id="state"
                name="state"
                defaultValue={property?.state ?? orderDefaults.state ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="zip" className="block text-sm font-medium">
                Zip
              </label>
              <input
                id="zip"
                name="zip"
                defaultValue={property?.zip ?? orderDefaults.zip ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label htmlFor="section_township_range" className="block text-sm font-medium">
              Section/Township/Range
            </label>
            <input
              id="section_township_range"
              name="section_township_range"
              defaultValue={property?.section_township_range ?? undefined}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="brief_legal" className="block text-sm font-medium">
              Brief Legal
            </label>
            <input
              id="brief_legal"
              name="brief_legal"
              defaultValue={property?.brief_legal ?? undefined}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="lot" className="block text-sm font-medium">
                Lot
              </label>
              <input
                id="lot"
                name="lot"
                defaultValue={property?.lot ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="block" className="block text-sm font-medium">
                Block
              </label>
              <input
                id="block"
                name="block"
                defaultValue={property?.block ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="subdivision_tract" className="block text-sm font-medium">
                Subdivision/Tract
              </label>
              <input
                id="subdivision_tract"
                name="subdivision_tract"
                defaultValue={property?.subdivision_tract ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label htmlFor="use_type" className="block text-sm font-medium">
              Use Type
            </label>
            <select
              id="use_type"
              name="use_type"
              defaultValue={property?.use_type ?? ''}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              <option value="">— Select —</option>
              {USE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={tab === 'legal' ? 'space-y-4' : 'hidden'}>
          <div>
            <label htmlFor="full_legal_description" className="block text-sm font-medium">
              Full Legal Description
            </label>
            <textarea
              id="full_legal_description"
              name="full_legal_description"
              defaultValue={property?.full_legal_description ?? undefined}
              rows={4}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="parcel_number" className="block text-sm font-medium">
                Parcel Number
              </label>
              <input
                id="parcel_number"
                name="parcel_number"
                defaultValue={property?.parcel_number ?? orderDefaults.parcel_number ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="parcel_number_type" className="block text-sm font-medium">
                Parcel Number Type
              </label>
              <select
                id="parcel_number_type"
                name="parcel_number_type"
                defaultValue={property?.parcel_number_type ?? ''}
                className="mt-1 w-full rounded border px-3 py-2"
              >
                <option value="">— Select —</option>
                {PARCEL_NUMBER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">CCRs / Master Deed</p>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label htmlFor="ccrs_dated" className="block text-sm font-medium">
                  Dated
                </label>
                <input
                  id="ccrs_dated"
                  name="ccrs_dated"
                  type="date"
                  defaultValue={property?.ccrs_dated ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="ccrs_book" className="block text-sm font-medium">
                  Book
                </label>
                <input
                  id="ccrs_book"
                  name="ccrs_book"
                  defaultValue={property?.ccrs_book ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="ccrs_page" className="block text-sm font-medium">
                  Page
                </label>
                <input
                  id="ccrs_page"
                  name="ccrs_page"
                  defaultValue={property?.ccrs_page ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="ccrs_instrument_number" className="block text-sm font-medium">
                  Instrument #
                </label>
                <input
                  id="ccrs_instrument_number"
                  name="ccrs_instrument_number"
                  defaultValue={property?.ccrs_instrument_number ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="ccrs_notes" className="block text-sm font-medium">
                Notes
              </label>
              <input
                id="ccrs_notes"
                name="ccrs_notes"
                defaultValue={property?.ccrs_notes ?? undefined}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className={tab === 'survey' ? 'space-y-4' : 'hidden'}>
          <div>
            <label htmlFor="plat_survey_reference" className="block text-sm font-medium">
              Plat/Survey Reference
            </label>
            <input
              id="plat_survey_reference"
              name="plat_survey_reference"
              defaultValue={property?.plat_survey_reference ?? undefined}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Setback Lines</p>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label htmlFor="setback_front" className="block text-sm font-medium">
                  Front
                </label>
                <input
                  id="setback_front"
                  name="setback_front"
                  defaultValue={property?.setback_front ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="setback_side" className="block text-sm font-medium">
                  Side
                </label>
                <input
                  id="setback_side"
                  name="setback_side"
                  defaultValue={property?.setback_side ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="setback_side_street" className="block text-sm font-medium">
                  Side Street
                </label>
                <input
                  id="setback_side_street"
                  name="setback_side_street"
                  defaultValue={property?.setback_side_street ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="setback_rear" className="block text-sm font-medium">
                  Rear
                </label>
                <input
                  id="setback_rear"
                  name="setback_rear"
                  defaultValue={property?.setback_rear ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Lot Dimensions</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="lot_dimension_frontage" className="block text-sm font-medium">
                  Street Frontage
                </label>
                <input
                  id="lot_dimension_frontage"
                  name="lot_dimension_frontage"
                  defaultValue={property?.lot_dimension_frontage ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="lot_dimension_depth" className="block text-sm font-medium">
                  Depth
                </label>
                <input
                  id="lot_dimension_depth"
                  name="lot_dimension_depth"
                  defaultValue={property?.lot_dimension_depth ?? undefined}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Save Changes
        </button>
      </form>

      {tab === 'legal' && (
        <div className="mt-8 border-t pt-6">
          <h2 className="mb-4 text-lg font-semibold">Access / Easements / ROW</h2>
          {!property ? (
            <p className="text-sm text-slate-500">Save Property Details first before adding easements.</p>
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
                      {e.description && <p className="text-sm text-slate-500">{e.description}</p>}
                    </div>
                    <form action={deleteEasement.bind(null, orderId, e.id)}>
                      <button type="submit" className="text-sm text-red-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
                {easements.length === 0 && (
                  <p className="text-sm text-slate-500">No easements added yet.</p>
                )}
              </ul>

              <details className="rounded border p-4">
                <summary className="cursor-pointer font-medium">Add an easement</summary>
                <form action={addEasement.bind(null, property.id, orderId)} className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="easement_type" className="block text-sm font-medium">
                      Type
                    </label>
                    <select
                      id="easement_type"
                      name="type"
                      value={easementType}
                      onChange={(e) => setEasementType(e.target.value)}
                      className="mt-1 w-full rounded border px-3 py-2"
                    >
                      {EASEMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  {easementType === 'Other' && (
                    <div>
                      <label htmlFor="other_type_text" className="block text-sm font-medium">
                        Specify Type
                      </label>
                      <input
                        id="other_type_text"
                        name="other_type_text"
                        className="mt-1 w-full rounded border px-3 py-2"
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium">
                      Notes
                    </label>
                    <input id="description" name="description" className="mt-1 w-full rounded border px-3 py-2" />
                  </div>
                  <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
                    Add Easement
                  </button>
                </form>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  )
}
