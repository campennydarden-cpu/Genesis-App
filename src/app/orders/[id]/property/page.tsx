import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PropertyForm } from '@/components/PropertyForm'

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, property_address, property_city, property_county, property_state, property_zip, parcel_number'
    )
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

  return (
    <PropertyForm
      orderId={id}
      property={property}
      orderDefaults={{
        property_address: order.property_address,
        city: order.property_city,
        county: order.property_county,
        state: order.property_state,
        zip: order.property_zip,
        parcel_number: order.parcel_number,
      }}
      easements={easements ?? []}
    />
  )
}
