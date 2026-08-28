import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { upsertPropertyDetails } from '@/app/actions/property'
import { PropertyForm } from '@/components/PropertyForm'

export default async function PropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, property_city, property_county, property_state, property_zip, parcel_number')
    .eq('id', id)
    .single()

  if (!order) {
    notFound()
  }

  const { data: property } = await supabase
    .from('property_details')
    .select('*')
    .eq('order_id', id)
    .maybeSingle()

  const { data: easements } = property
    ? await supabase
        .from('property_easements')
        .select('*')
        .eq('property_id', property.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  const upsertPropertyDetailsWithId = upsertPropertyDetails.bind(null, id)

  return (
    <div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <PropertyForm
        action={upsertPropertyDetailsWithId}
        orderId={id}
        property={property}
        orderDefaults={{
          city: order.property_city,
          county: order.property_county,
          state: order.property_state,
          zip: order.property_zip,
          parcel_number: order.parcel_number,
        }}
        easements={easements ?? []}
      />
    </div>
  )
}
