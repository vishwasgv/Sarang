import { requirePermission } from '../permission-guard'
import {
  getTodayQueue,
  createToken,
  callToken,
  markSeen,
  skipToken,
  resetToken,
  getQueueStats,
} from '../../services/token-queue.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('tokenQueue:today', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const p = payload as { date?: string } | undefined
    return getTodayQueue(p?.date)
  })

  handle('tokenQueue:stats', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const p = payload as { date?: string } | undefined
    return getQueueStats(p?.date)
  })

  handle('tokenQueue:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createToken(payload as Parameters<typeof createToken>[0])
  })

  handle('tokenQueue:call', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = payload as { id: string }
    return callToken(id)
  })

  handle('tokenQueue:seen', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = payload as { id: string }
    return markSeen(id)
  })

  handle('tokenQueue:skip', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = payload as { id: string }
    return skipToken(id)
  })

  handle('tokenQueue:reset', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = payload as { id: string }
    return resetToken(id)
  })
}
