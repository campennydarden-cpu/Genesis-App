'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { uploadAttachment } from '@/app/actions/attachments'

export function AttachmentUploadDialog({
  orderId,
  folderId,
  onClose,
  onUploaded,
}: {
  orderId: string
  folderId: string
  onClose: () => void
  onUploaded: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await uploadAttachment(orderId, folderId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        onUploaded()
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Attachment</DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <form action={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="attachment-file">File</Label>
            <Input id="attachment-file" name="file" type="file" required />
          </div>
          <div>
            <Label htmlFor="attachment-description">Description</Label>
            <Input id="attachment-description" name="description" />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
