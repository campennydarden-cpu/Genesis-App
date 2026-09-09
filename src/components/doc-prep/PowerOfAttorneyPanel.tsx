'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { savePoaFields } from '@/app/actions/doc-prep-poa'
import type { PoaContact } from '@/app/actions/doc-prep-poa'

export function PowerOfAttorneyPanel({ orderId, contacts }: { orderId: string; contacts: PoaContact[] }) {
  return (
    <div className="max-w-3xl space-y-4" data-testid="poa-panel">
      <h2 className="text-lg font-semibold">Power of Attorney</h2>

      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No contacts have POA enabled yet — check the POA box on a Contact to have them appear here.
        </p>
      ) : (
        <ul className="space-y-4">
          {contacts.map((c) => (
            <li key={c.id} className="rounded border p-4" data-testid={`poa-contact-${c.id}`}>
              <p className="mb-3 font-medium">
                {c.name} ({c.role})
              </p>
              <form
                action={async (formData) => {
                  await savePoaFields(orderId, c.id, formData)
                }}
                className="grid grid-cols-2 gap-3"
              >
                <div className="col-span-2">
                  <Label htmlFor={`${c.id}-poa_attorney_in_fact_name`}>Attorney-in-Fact Name</Label>
                  <Input
                    id={`${c.id}-poa_attorney_in_fact_name`}
                    name="poa_attorney_in_fact_name"
                    defaultValue={c.poa_attorney_in_fact_name ?? ''}
                  />
                </div>
                <div>
                  <Label htmlFor={`${c.id}-poa_dated_date`}>Dated Date</Label>
                  <Input id={`${c.id}-poa_dated_date`} name="poa_dated_date" type="date" defaultValue={c.poa_dated_date ?? ''} />
                </div>
                <div>
                  <Label htmlFor={`${c.id}-poa_recorded_date`}>Recorded Date</Label>
                  <Input
                    id={`${c.id}-poa_recorded_date`}
                    name="poa_recorded_date"
                    type="date"
                    defaultValue={c.poa_recorded_date ?? ''}
                  />
                </div>
                <div>
                  <Label htmlFor={`${c.id}-poa_book`}>Book</Label>
                  <Input id={`${c.id}-poa_book`} name="poa_book" defaultValue={c.poa_book ?? ''} />
                </div>
                <div>
                  <Label htmlFor={`${c.id}-poa_page`}>Page</Label>
                  <Input id={`${c.id}-poa_page`} name="poa_page" defaultValue={c.poa_page ?? ''} />
                </div>
                <div>
                  <Label htmlFor={`${c.id}-poa_instrument_number`}>Instrument #</Label>
                  <Input
                    id={`${c.id}-poa_instrument_number`}
                    name="poa_instrument_number"
                    defaultValue={c.poa_instrument_number ?? ''}
                  />
                </div>
                <div className="col-span-2">
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
