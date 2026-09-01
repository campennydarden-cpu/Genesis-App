import { issueCTC, rescindCTC } from '@/app/actions/curative'

export function CTCControl({
  orderId,
  ctcIssued,
  allDispositioned,
}: {
  orderId: string
  ctcIssued: boolean
  allDispositioned: boolean
}) {
  if (ctcIssued) {
    return (
      <form action={rescindCTC.bind(null, orderId)}>
        <p className="mb-2 text-sm font-medium text-green-700" data-testid="ctc-issued-label">
          Clear to Close issued
        </p>
        <button type="submit" className="rounded border px-4 py-2 text-sm" data-testid="rescind-ctc-button">
          Rescind CTC
        </button>
      </form>
    )
  }

  return (
    <form action={issueCTC.bind(null, orderId)}>
      <button
        type="submit"
        disabled={!allDispositioned}
        className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="issue-ctc-button"
      >
        Issue CTC
      </button>
    </form>
  )
}
