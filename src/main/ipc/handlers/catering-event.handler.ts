import {
  createCateringEvent, listCateringEvents, getCateringEvent,
  recordFinalNegotiatedPrice, updateCateringEventStatus, deleteCateringEvent, generateCateringEventInvoice,
} from '../../services/catering-event.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateCateringEventSchema, RecordFinalNegotiatedPriceSchema, UpdateCateringEventStatusSchema } from '../../validation/catering-event.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// 2026-09-02 — Catering event booking (Bakery/Sweet Shop/Catering vertical),
// direct structural mirror of custom-order-booking.handler.ts.
export function register(handle: HandleFn): void {
  handle('cateringEvent:list', async (payload) => {
    const deny = await requirePermission('cateringEvent.view'); if (deny) return deny
    return listCateringEvents(payload as Parameters<typeof listCateringEvents>[0])
  })

  handle('cateringEvent:get', async (payload) => {
    const deny = await requirePermission('cateringEvent.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return getCateringEvent(id)
  })

  handle('cateringEvent:create', async (payload) => {
    const deny = await requirePermission('cateringEvent.manage'); if (deny) return deny
    const parsed = CreateCateringEventSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return createCateringEvent({ ...parsed.data, createdById: session?.userId })
  })

  handle('cateringEvent:recordFinalNegotiatedPrice', async (payload) => {
    const deny = await requirePermission('cateringEvent.manage'); if (deny) return deny
    const parsed = RecordFinalNegotiatedPriceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return recordFinalNegotiatedPrice(parsed.data.id, parsed.data.finalNegotiatedPrice, session?.userId)
  })

  handle('cateringEvent:updateStatus', async (payload) => {
    const deny = await requirePermission('cateringEvent.manage'); if (deny) return deny
    const parsed = UpdateCateringEventStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return updateCateringEventStatus(parsed.data.id, parsed.data.status, session?.userId)
  })

  handle('cateringEvent:delete', async (payload) => {
    const deny = await requirePermission('cateringEvent.manage'); if (deny) return deny
    const { id } = payload as { id: string }
    const session = getCurrentSession()
    return deleteCateringEvent(id, session?.userId)
  })

  handle('cateringEvent:generateInvoice', async (payload) => {
    const deny = await requirePermission('cateringEvent.manage'); if (deny) return deny
    const { id } = payload as { id: string }
    const session = getCurrentSession()
    return generateCateringEventInvoice(id, session?.userId)
  })
}
