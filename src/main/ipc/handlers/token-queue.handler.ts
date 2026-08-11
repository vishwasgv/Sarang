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
import { getTokenQueueServerStatus, getOrCreateTokenQueueToken, regenerateTokenQueueToken } from '../../server/token-queue-server'

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
    const deny = await requirePermission('tokenQueue.manage'); if (deny) return deny
    const parsed = CreateTokenSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createToken(parsed.data)
  })

  handle('tokenQueue:call', async (payload) => {
    const deny = await requirePermission('tokenQueue.manage'); if (deny) return deny
    const parsed = TokenQueueIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return callToken(parsed.data.id)
  })

  handle('tokenQueue:seen', async (payload) => {
    const deny = await requirePermission('tokenQueue.manage'); if (deny) return deny
    const parsed = TokenQueueIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return markSeen(parsed.data.id)
  })

  handle('tokenQueue:skip', async (payload) => {
    const deny = await requirePermission('tokenQueue.manage'); if (deny) return deny
    const parsed = TokenQueueIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return skipToken(parsed.data.id)
  })

  handle('tokenQueue:reset', async (payload) => {
    const deny = await requirePermission('tokenQueue.manage'); if (deny) return deny
    const parsed = TokenQueueIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return resetToken(parsed.data.id)
  })

  // ── Phase 62 — self check-in via QR (phone/laptop, LAN) ──
  handle('tokenQueue:getServerStatus', async () => {
    const deny = await requirePermission('tokenQueue.manage'); if (deny) return deny
    const status = getTokenQueueServerStatus()
    const token = status.running ? await getOrCreateTokenQueueToken() : null
    return { success: true, data: { ...status, token } }
  })

  handle('tokenQueue:regenerateServerToken', async () => {
    const deny = await requirePermission('tokenQueue.manage'); if (deny) return deny
    const token = await regenerateTokenQueueToken()
    return { success: true, data: { token } }
  })

  handle('tokenQueue:generateServerQr', async () => {
    const deny = await requirePermission('tokenQueue.manage'); if (deny) return deny
    const status = getTokenQueueServerStatus()
    if (!status.running || status.lanUrls.length === 0) {
      return { success: false, error: { code: 'TQ-040', message: 'Token queue check-in is not currently running. Enable the Token Queue module in Settings first.' } }
    }
    const token = await getOrCreateTokenQueueToken()
    const captureUrl = `${status.lanUrls[0]}/token-queue/${token}`
    const QRCode = await import('qrcode')
    const qrDataUrl = await QRCode.toDataURL(captureUrl, { margin: 1, width: 320 })
    return { success: true, data: { qrDataUrl, captureUrl } }
  })
}
