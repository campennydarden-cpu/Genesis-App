'use client'

import { createContext, useCallback, useContext, useEffect, useRef } from 'react'

type PendingSaveContextValue = {
  register: (promise: Promise<unknown>) => void
  waitForPendingSaves: () => Promise<void>
  hasPending: () => boolean
}

const PendingSaveContext = createContext<PendingSaveContextValue | null>(null)

export function startTransitionAsPromise<T>(
  startTransition: (callback: () => void) => void,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    startTransition(() => {
      fn().then(resolve, reject)
    })
  })
}

export function PendingSaveProvider({ children }: { children: React.ReactNode }) {
  const pending = useRef<Set<Promise<unknown>>>(new Set())

  const register = useCallback((promise: Promise<unknown>) => {
    pending.current.add(promise)
    promise.finally(() => pending.current.delete(promise))
  }, [])

  const waitForPendingSaves = useCallback(async () => {
    await Promise.allSettled([...pending.current])
  }, [])

  const hasPending = useCallback(() => pending.current.size > 0, [])

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (pending.current.size > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  return (
    <PendingSaveContext.Provider value={{ register, waitForPendingSaves, hasPending }}>
      {children}
    </PendingSaveContext.Provider>
  )
}

export function usePendingSave(): PendingSaveContextValue {
  const ctx = useContext(PendingSaveContext)
  if (!ctx) throw new Error('usePendingSave must be used within PendingSaveProvider')
  return ctx
}
