import { listSerials, createSerial, bulkCreateSerials, updateSerialStatus, searchByImei, updateSerialServiceInfo, listEquipmentDueForService, scheduleEquipmentServiceReminder } from '../../services/serial.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateSerialSchema, BulkCreateSerialsSchema, UpdateSerialStatusSchema } from '../../validation/serial.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('serials:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return listSerials(payload as Parameters<typeof listSerials>[0])
  })

  handle('serials:create', async (payload) => {
    const deny = await requirePermission('inventory.addStock'); if (deny) return deny
    const parsed = CreateSerialSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createSerial(parsed.data, getCurrentSession()?.userId)
  })

  handle('serials:bulkCreate', async (payload) => {
    const deny = await requirePermission('inventory.addStock'); if (deny) return deny
    const parsed = BulkCreateSerialsSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return bulkCreateSerials(parsed.data, getCurrentSession()?.userId)
  })

  handle('serials:updateStatus', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const parsed = UpdateSerialStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateSerialStatus(parsed.data, getCurrentSession()?.userId)
  })

  handle('serials:searchByImei', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { imei: string }
    return searchByImei(p.imei)
  })

  // Phase 67 §9.1 — Agri Inputs item 5: equipment AMC/service reminders.
  handle('serials:updateServiceInfo', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const p = (payload ?? {}) as { id: string; nextServiceDueDate?: string | null; lastServicedDate?: string | null }
    if (!p.id) return { success: false, error: { code: 'VAL-001', message: 'ID is required.' } }
    return updateSerialServiceInfo(p, getCurrentSession()?.userId)
  })

  handle('serials:dueForService', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { dueSoonDays?: number }
    return listEquipmentDueForService(p.dueSoonDays)
  })

  handle('serials:scheduleServiceReminder', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const p = (payload ?? {}) as { serialId: string; daysBefore?: number }
    if (!p.serialId) return { success: false, error: { code: 'VAL-001', message: 'Serial ID is required.' } }
    return scheduleEquipmentServiceReminder(p.serialId, p.daysBefore)
  })
}
