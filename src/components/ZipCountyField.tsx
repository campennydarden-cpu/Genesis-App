'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { ZipLookupCounty } from '@/lib/types'

export function ZipCountyField({
  defaultCity,
  defaultCounty,
  defaultState,
  defaultZip,
}: {
  defaultCity?: string | null
  defaultCounty?: string | null
  defaultState?: string | null
  defaultZip?: string | null
}) {
  const cityRef = useRef<HTMLInputElement>(null)
  const countyRef = useRef<HTMLInputElement>(null)
  const stateRef = useRef<HTMLInputElement>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [counties, setCounties] = useState<ZipLookupCounty[]>([])

  // Fill-if-blank, non-destructive: never overwrite a value the user already typed.
  function fillIfBlank(ref: React.RefObject<HTMLInputElement | null>, value: string) {
    if (ref.current && !ref.current.value) {
      ref.current.value = value
    }
  }

  async function handleZipBlur(e: React.FocusEvent<HTMLInputElement>) {
    const zip = e.target.value.trim()
    if (!zip) return

    const supabase = createClient()
    const { data } = await supabase.from('zip_lookup').select('*').eq('zip', zip).maybeSingle()
    if (!data) return // soft-fail: unrecognized zip, no change

    fillIfBlank(stateRef, data.state)
    fillIfBlank(cityRef, data.city)

    if (data.counties.length <= 1) {
      fillIfBlank(countyRef, data.primary_county)
    } else {
      setCounties(data.counties)
      setDialogOpen(true)
    }
  }

  function selectCounty(county: ZipLookupCounty) {
    if (countyRef.current) countyRef.current.value = county.name
    setDialogOpen(false)
  }

  return (
    <>
      <div>
        <Label htmlFor="property_city">City</Label>
        <Input id="property_city" name="property_city" defaultValue={defaultCity ?? undefined} ref={cityRef} />
      </div>
      <div>
        <Label htmlFor="property_county">County</Label>
        <Input
          id="property_county"
          name="property_county"
          defaultValue={defaultCounty ?? undefined}
          ref={countyRef}
        />
      </div>
      <div>
        <Label htmlFor="property_state">State</Label>
        <Input
          id="property_state"
          name="property_state"
          defaultValue={defaultState ?? undefined}
          ref={stateRef}
        />
      </div>
      <div>
        <Label htmlFor="property_zip">Zip</Label>
        <Input
          id="property_zip"
          name="property_zip"
          defaultValue={defaultZip ?? undefined}
          onBlur={handleZipBlur}
        />
      </div>

      {dialogOpen && (
      <Dialog open onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Which county?</DialogTitle>
            <DialogDescription>This zip code spans more than one county.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {counties.map((c, i) => (
              <Button
                key={c.fips ?? c.name}
                type="button"
                variant={i === 0 ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => selectCounty(c)}
              >
                {c.name}
                {i === 0 && <span className="ml-auto text-xs opacity-70">Most likely</span>}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      )}
    </>
  )
}
