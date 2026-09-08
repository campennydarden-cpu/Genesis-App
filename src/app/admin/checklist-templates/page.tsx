import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireChecklistTemplatePermission } from '@/lib/permissions'
import { listChecklistTemplates } from '@/app/actions/checklist-templates'
import { ChecklistTemplateAdmin } from '@/components/ChecklistTemplateAdmin'

export default async function ChecklistTemplatesAdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!(await requireChecklistTemplatePermission(supabase))) redirect('/orders')

  const templates = await listChecklistTemplates()

  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Checklist Task Templates</h1>
      <ChecklistTemplateAdmin templates={templates} />
    </main>
  )
}
