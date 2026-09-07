import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { editContact } from '@/app/actions/contacts'
import { AddContactForm } from '@/components/AddContactForm'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function EditContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; contactId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id, contactId } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('order_id', id)
    .single()

  if (!contact) {
    notFound()
  }

  const editContactWithIds = editContact.bind(null, id, contactId)

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Edit Contact</h2>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <AddContactForm action={editContactWithIds} contact={contact} />
      <Button
        variant="ghost"
        size="sm"
        className="mt-4"
        render={<Link href={`/orders/${id}/contacts`}>Cancel</Link>}
      />
    </div>
  )
}
