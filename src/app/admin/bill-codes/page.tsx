import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireBillCodePermission } from '@/lib/permissions'
import { listBillCodes } from '@/app/actions/bill-codes'
import { BillCodeAdmin } from '@/components/BillCodeAdmin'

export default async function BillCodesAdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!(await requireBillCodePermission(supabase))) redirect('/orders')

  const billCodes = await listBillCodes()

  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Bill Codes</h1>
      <BillCodeAdmin billCodes={billCodes} />
    </main>
  )
}
