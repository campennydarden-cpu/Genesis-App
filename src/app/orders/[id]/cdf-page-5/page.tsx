import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCdfPage5, listCdfPage5Contacts, listAllContacts } from '@/app/actions/cdf-page5'
import { CdfPage5Panel } from '@/components/title/CdfPage5Panel'

export default async function CdfPage5Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [cdfPage5, contacts, allContacts] = await Promise.all([
    getCdfPage5(orderId),
    listCdfPage5Contacts(orderId),
    listAllContacts(orderId),
  ])

  return <CdfPage5Panel orderId={orderId} cdfPage5={cdfPage5} contacts={contacts} allContacts={allContacts} />
}
