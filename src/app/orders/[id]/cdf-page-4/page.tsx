import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCdfPage4 } from '@/app/actions/cdf-page4'
import { CdfPage4Panel } from '@/components/title/CdfPage4Panel'

export default async function CdfPage4Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cdfPage4 = await getCdfPage4(orderId)

  return <CdfPage4Panel orderId={orderId} cdfPage4={cdfPage4} />
}
