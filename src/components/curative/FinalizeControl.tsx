import { finalizeCommitment, revertToDraft } from '@/app/actions/curative'

export function FinalizeControl({
  orderId,
  commitmentStatus,
  ctcIssued,
}: {
  orderId: string
  commitmentStatus: 'draft' | 'final'
  ctcIssued: boolean
}) {
  if (commitmentStatus === 'draft') {
    return (
      <form action={finalizeCommitment.bind(null, orderId)}>
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white" data-testid="finalize-button">
          Finalize
        </button>
      </form>
    )
  }

  return (
    <form action={revertToDraft.bind(null, orderId)}>
      <button
        type="submit"
        disabled={ctcIssued}
        className="rounded border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="revert-to-draft-button"
      >
        Revert to Draft
      </button>
    </form>
  )
}
