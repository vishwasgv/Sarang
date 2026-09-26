import { z } from 'zod'
import { requireSession } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { acquireEditLock, releaseEditLock } from '../../lan/edit-locks'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const Schema = z.object({ kind: z.string().min(1).max(40), id: z.string().min(1).max(80) })

export function register(handle: HandleFn): void {
  handle('locks:acquire', async (payload) => {
    const deny = requireSession(); if (deny) return deny
    const parsed = Schema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Record is required.' } }
    const s = getCurrentSession()!
    const r = acquireEditLock(parsed.data.kind, parsed.data.id, { userId: s.userId, username: s.username })
    return { success: true, data: r }
  })

  handle('locks:release', async (payload) => {
    const deny = requireSession(); if (deny) return deny
    const parsed = Schema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Record is required.' } }
    releaseEditLock(parsed.data.kind, parsed.data.id, getCurrentSession()!.userId)
    return { success: true }
  })
}
