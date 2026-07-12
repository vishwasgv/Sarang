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
import { CreateTokenSchema, TokenQueueIdSchema } from '../../validation/token-queue.validation'

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
    const parsed = CreateTokenSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createToken(parsed.data)
  })

  handle('tokenQueue:call', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = TokenQueueIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return callToken(parsed.data.id)
  })

  handle('tokenQueue:seen', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = TokenQueueIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return markSeen(parsed.data.id)
  })

  handle('tokenQueue:skip', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = TokenQueueIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return skipToken(parsed.data.id)
  })

  handle('tokenQueue:reset', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = TokenQueueIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return resetToken(parsed.data.id)
  })
}
