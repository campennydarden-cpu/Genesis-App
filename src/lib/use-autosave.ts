'use client'

import { useRef, useState, useTransition } from 'react'
import { usePendingSave, startTransitionAsPromise } from '@/lib/pending-saves'
import type { SaveState } from '@/components/SaveIndicator'

/**
 * Shared autosave plumbing: serializes saves (a promise chain, global not per-field —
 * fine at this scale), registers each with the pending-save nav guard, and drives a
 * SaveIndicator's state. Reverting "saved" back to "idle" after 2s is guarded by a
 * generation counter — without it, an earlier save's stale timeout can fire after a
 * later save has already shown "Saved", clobbering it back to idle mid-display.
 */
export function useAutosave<T extends { error?: string }>(saveFn: (formData: FormData) => Promise<T>) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()
  const { register } = usePendingSave()
  const saveChain = useRef<Promise<unknown>>(Promise.resolve())
  const generationRef = useRef(0)

  function save(formData: FormData): Promise<T> {
    const generation = ++generationRef.current
    setSaveState('saving')
    const promise = startTransitionAsPromise(startTransition, () =>
      saveChain.current.then(() => saveFn(formData))
    )
    saveChain.current = promise.catch(() => {})
    register(promise)
    promise
      .then((result) => {
        if (result.error) {
          setErrorMessage(result.error)
          setSaveState('error')
        } else {
          setSaveState('saved')
          setErrorMessage(undefined)
          setTimeout(() => {
            setSaveState((s) => (s === 'saved' && generationRef.current === generation ? 'idle' : s))
          }, 2000)
        }
      })
      .catch(() => {
        setErrorMessage(undefined)
        setSaveState('error')
      })
    return promise
  }

  return { state: (isPending ? 'saving' : saveState) as SaveState, errorMessage, save }
}
