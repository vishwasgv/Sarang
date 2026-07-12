import { useEffect, useRef, useCallback } from 'react'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

export function useSessionTimeout(
  timeoutMs: number,
  onTimeout: () => void,
  enabled = true
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(onTimeout, timeoutMs)
  }, [timeoutMs, onTimeout])

  useEffect(() => {
    if (!enabled || timeoutMs <= 0) return

    resetTimer()

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true })
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer)
      }
    }
  }, [enabled, timeoutMs, resetTimer])
}
