import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { listFreightLedger, createFreightEntry, updateFreightEntry, markFreightPaid, deleteFreightEntry, getFreightSummary } from '../../services/logistics-freight.service'
import { CreateFreightEntrySchema, UpdateFreightEntrySchema, MarkFreightPaidSchema } from '../../validation/logistics-freight.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerLogisticsFreightHandlers(handle: HandleFn): void {
  handle('logisticsFreight:list', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return listFreightLedger(raw as Parameters<typeof listFreightLedger>[0])
  })

  handle('logisticsFreight:create', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = CreateFreightEntrySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createFreightEntry(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsFreight:update', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = UpdateFreightEntrySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateFreightEntry(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsFreight:markPaid', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = MarkFreightPaidSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return markFreightPaid(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsFreight:delete', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return deleteFreightEntry(raw as string, getCurrentSession()?.userId)
  })

  handle('logisticsFreight:summary', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return getFreightSummary(raw as Parameters<typeof getFreightSummary>[0])
  })
}
