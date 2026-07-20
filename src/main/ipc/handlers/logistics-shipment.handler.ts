import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  listShipments, getShipment, createShipment, updateShipment, updateShipmentStatus, deleteShipment,
  addShipmentStop, updateShipmentStopStatus, deleteShipmentStop
} from '../../services/logistics-shipment.service'
import { CreateShipmentSchema, UpdateShipmentSchema, UpdateShipmentStatusSchema } from '../../validation/logistics-shipment.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerLogisticsShipmentHandlers(handle: HandleFn): void {
  handle('logisticsShipment:list', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return listShipments(raw as { status?: string; shipmentType?: string; search?: string; fromDate?: string; toDate?: string; offset?: number; limit?: number })
  })

  handle('logisticsShipment:get', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return getShipment(raw as string)
  })

  handle('logisticsShipment:create', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = CreateShipmentSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createShipment(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsShipment:update', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = UpdateShipmentSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateShipment(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsShipment:updateStatus', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = UpdateShipmentStatusSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateShipmentStatus(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsShipment:delete', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return deleteShipment(raw as string, getCurrentSession()?.userId)
  })

  // ── Phase 58 §2 — Distributor route/beat planning (multi-stop shipments) ──

  handle('logisticsShipment:addStop', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const p = raw as { shipmentId?: string; customerId?: string; customerName?: string; destinationAddress?: string; notes?: string }
    if (!p?.shipmentId || !p?.destinationAddress?.trim()) {
      return { success: false, error: { code: 'VAL-001', message: 'shipmentId and destinationAddress are required.' } }
    }
    return addShipmentStop({ shipmentId: p.shipmentId, customerId: p.customerId, customerName: p.customerName, destinationAddress: p.destinationAddress, notes: p.notes }, getCurrentSession()?.userId)
  })

  handle('logisticsShipment:updateStopStatus', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const p = raw as { id?: string; status?: string }
    if (!p?.id || !p?.status) return { success: false, error: { code: 'VAL-001', message: 'id and status are required.' } }
    return updateShipmentStopStatus({ id: p.id, status: p.status as 'DELIVERED' | 'SKIPPED' | 'PENDING' }, getCurrentSession()?.userId)
  })

  handle('logisticsShipment:deleteStop', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return deleteShipmentStop(raw as string, getCurrentSession()?.userId)
  })
}
