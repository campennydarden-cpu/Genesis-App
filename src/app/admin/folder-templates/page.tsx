import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFolderTemplatePermission } from '@/lib/permissions'
import { listFolderTemplates } from '@/app/actions/folder-templates'
import { FolderTemplateAdmin } from '@/components/FolderTemplateAdmin'

export default async function FolderTemplatesAdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!(await requireFolderTemplatePermission(supabase))) redirect('/orders')

  const templates = await listFolderTemplates()

  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Folder Templates</h1>
      <FolderTemplateAdmin templates={templates} />
    </main>
  )
}
