import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import { listRequirementTemplates } from '@/app/actions/requirement-templates'
import { listExceptionTemplates } from '@/app/actions/exception-templates'
import { AdminTemplateConsole } from '@/components/AdminTemplateConsole'

export default async function RequirementTemplatesAdminPage() {
  const supabase = await createClient()
  if (!(await hasPermission(supabase, 'manage_requirement_templates'))) {
    redirect('/orders')
  }

  const [requirementTemplates, exceptionTemplates] = await Promise.all([
    listRequirementTemplates(),
    listExceptionTemplates(),
  ])

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Requirement/Exception Templates</h1>
      <AdminTemplateConsole requirementTemplates={requirementTemplates} exceptionTemplates={exceptionTemplates} />
    </div>
  )
}
