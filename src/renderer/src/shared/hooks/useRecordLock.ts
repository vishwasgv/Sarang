import { useEffect, useState } from 'react'

// Holds a "being edited" lock on a record while its form is open, and reports who else has it open.
// On a single PC this is always free. The lock lapses by itself after a few minutes if the PC goes away.
export function useRecordLock(kind: string, id: string | null | undefined, active: boolean): string | null {
  const [heldBy, setHeldBy] = useState<string | null>(null)

  useEffect(() => {
    if (!active || !id) { setHeldBy(null); return }
    let stopped = false
    const take = async () => {
      try {
        const res = await window.api.locks.acquire({ kind, id })
        if (stopped) return
        const data = res.success ? (res.data as { ok: boolean; heldBy?: string }) : null
        setHeldBy(data && !data.ok ? (data.heldBy ?? '') : null)
      } catch { /* the lock is a courtesy; a failure never blocks editing */ }
    }
    void take()
    const timer = setInterval(() => { void take() }, 60_000)
    return () => {
      stopped = true
      clearInterval(timer)
      void window.api.locks.release({ kind, id }).catch(() => {})
    }
  }, [kind, id, active])

  return heldBy
}
