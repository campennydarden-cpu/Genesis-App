import type { createClient } from '@/lib/supabase/server'

export async function requireFolderTemplatePermission(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('can_manage_folder_templates')
    .eq('id', user.id)
    .maybeSingle()

  return profile?.can_manage_folder_templates ?? false
}
