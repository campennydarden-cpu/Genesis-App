export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function SaveIndicator({ state, errorMessage }: { state: SaveState; errorMessage?: string }) {
  if (state === 'idle') return null

  return (
    <p
      data-testid="save-indicator"
      className={`text-sm ${state === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
    >
      {state === 'saving' && 'Saving…'}
      {state === 'saved' && 'Saved'}
      {state === 'error' && `Couldn't save${errorMessage ? ` — ${errorMessage}` : ''}`}
    </p>
  )
}
