import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCdfPage1 } from '@/app/actions/cdf-page1'
import { CdfPage1Panel } from '@/components/title/CdfPage1Panel'

export default async function CdfPage1Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cdfPage1 = await getCdfPage1(orderId)

  return <CdfPage1Panel orderId={orderId} cdfPage1={cdfPage1} />
}
