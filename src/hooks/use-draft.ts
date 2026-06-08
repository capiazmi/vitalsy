import { useCallback } from 'react'

/**
 * Tiny localStorage-backed draft helper. SSR-safe (no-ops on the server).
 * Used to auto-save in-progress readings so they survive navigation/refresh.
 */
export function useDraft<T>(key: string) {
  const read = useCallback((): T | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }, [key])

  const save = useCallback(
    (value: T) => {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // quota / serialization errors are non-fatal for a draft
      }
    },
    [key],
  )

  const clear = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }, [key])

  return { read, save, clear }
}
