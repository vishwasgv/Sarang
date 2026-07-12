import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

export interface VehicleRecord {
  id: string
  vehicleNumber: string
  vehicleType: string
  ownerType: string
  driverName: string | null
  driverPhone: string | null
  capacity: number | null
  capacityUnit: string
  status: string
  notes: string | null
  shipmentsThisMonth: number
  createdAt: string
  updatedAt: string
}

function toRecord(r: any, shipmentsThisMonth = 0): VehicleRecord {
  return {
    id: r.id,
    vehicleNumber: r.vehicleNumber,
    vehicleType: r.vehicleType,
    ownerType: r.ownerType,
    driverName: r.driverName,
    driverPhone: r.driverPhone,
    capacity: r.capacity,
    capacityUnit: r.capacityUnit,
    status: r.status,
    notes: r.notes,
    shipmentsThisMonth,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

export async function listVehicles(payload?: { status?: string; ownerType?: string; offset?: number; limit?: number }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.status) where.status = payload.status
    if (payload?.ownerType) where.ownerType = payload.ownerType

    const take = Math.min(payload?.limit ?? 500, 500)
    const skip = payload?.offset ?? 0
    const [rows, total] = await Promise.all([
      db.vehicle.findMany({ where, orderBy: { vehicleNumber: 'asc' }, skip, take }),
      db.vehicle.count({ where }),
    ])

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Single aggregation query instead of N+1 per-vehicle counts
    const shipmentCounts = await db.shipment.groupBy({
      by: ['vehicleId'],
      _count: { id: true },
      where: { vehicleId: { in: rows.map(r => r.id).filter(Boolean) as string[] }, createdAt: { gte: monthStart } },
    })
    const countMap: Record<string, number> = {}
    for (const c of shipmentCounts) if (c.vehicleId) countMap[c.vehicleId] = c._count.id

    const records = rows.map(r => toRecord(r, countMap[r.id] ?? 0))

    return { success: true, data: records, total }
  } catch (err) {
    return { success: false, error: { code: 'LOG-001', message: err instanceof Error ? err.message : 'Failed to list vehicles.' } }
  }
}

export async function createVehicle(payload: {
  vehicleNumber: string; vehicleType: string; ownerType?: string
  driverName?: string; driverPhone?: string; capacity?: number; capacityUnit?: string; notes?: string
}, userId?: string) {
  try {
    const db = getPrisma()
    if (!payload.vehicleNumber?.trim()) return { success: false, error: { code: 'VAL-001', message: 'Vehicle number is required.' } }
    if (payload.capacity !== undefined && payload.capacity !== null && payload.capacity < 0)
      return { success: false, error: { code: 'VAL-002', message: 'Capacity cannot be negative.' } }
    const row = await db.vehicle.create({
      data: {
        vehicleNumber: payload.vehicleNumber.trim().toUpperCase(),
        vehicleType: payload.vehicleType ?? 'VAN',
        ownerType: payload.ownerType ?? 'OWN',
        driverName: payload.driverName?.trim() || null,
        driverPhone: payload.driverPhone?.trim() || null,
        capacity: payload.capacity ?? null,
        capacityUnit: payload.capacityUnit ?? 'KG',
        notes: payload.notes?.trim() || null,
      }
    })
    await logAction({ userId, action: 'CREATE', entityType: 'Vehicle', entityId: row.id, newValue: { vehicleNumber: row.vehicleNumber } })
    return { success: true, data: toRecord(row) }
  } catch (err: any) {
    if (err?.code === 'P2002') return { success: false, error: { code: 'DUP-001', message: 'Vehicle number already exists.' } }
    return { success: false, error: { code: 'LOG-002', message: err instanceof Error ? err.message : 'Failed to create vehicle.' } }
  }
}

export async function updateVehicle(payload: {
  id: string; vehicleNumber?: string; vehicleType?: string; ownerType?: string
  driverName?: string; driverPhone?: string; capacity?: number; capacityUnit?: string; notes?: string; status?: string
}, userId?: string) {
  try {
    const db = getPrisma()
    if (!payload.id) return { success: false, error: { code: 'VAL-001', message: 'id is required.' } }
    if (payload.capacity !== undefined && payload.capacity !== null && payload.capacity < 0)
      return { success: false, error: { code: 'VAL-002', message: 'Capacity cannot be negative.' } }
    const row = await db.vehicle.update({
      where: { id: payload.id },
      data: {
        ...(payload.vehicleNumber && { vehicleNumber: payload.vehicleNumber.trim().toUpperCase() }),
        ...(payload.vehicleType && { vehicleType: payload.vehicleType }),
        ...(payload.ownerType && { ownerType: payload.ownerType }),
        ...(payload.driverName !== undefined && { driverName: payload.driverName?.trim() || null }),
        ...(payload.driverPhone !== undefined && { driverPhone: payload.driverPhone?.trim() || null }),
        ...(payload.capacity !== undefined && { capacity: payload.capacity }),
        ...(payload.capacityUnit && { capacityUnit: payload.capacityUnit }),
        ...(payload.notes !== undefined && { notes: payload.notes?.trim() || null }),
        ...(payload.status && payload.status !== 'IN_TRANSIT' && { status: payload.status }),
      }
    })
    await logAction({ userId, action: 'UPDATE', entityType: 'Vehicle', entityId: payload.id })
    return { success: true, data: toRecord(row) }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Vehicle not found.' } }
    return { success: false, error: { code: 'LOG-003', message: err instanceof Error ? err.message : 'Failed to update vehicle.' } }
  }
}

export async function deleteVehicle(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const shipCount = await db.shipment.count({ where: { vehicleId: id } })
    const challanCount = await db.deliveryChallan.count({ where: { vehicleId: id } })
    if (shipCount + challanCount > 0)
      return { success: false, error: { code: 'REF-001', message: `Cannot delete: ${shipCount} shipment(s) and ${challanCount} challan(s) reference this vehicle.` } }
    const existing = await db.vehicle.findUnique({ where: { id } })
    await db.vehicle.delete({ where: { id } })
    await logAction({ userId, action: 'DELETE', entityType: 'Vehicle', entityId: id, oldValue: { vehicleNumber: existing?.vehicleNumber } })
    return { success: true }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Vehicle not found.' } }
    return { success: false, error: { code: 'LOG-004', message: err instanceof Error ? err.message : 'Failed to delete vehicle.' } }
  }
}

export async function updateVehicleStatus(id: string, status: string, userId?: string) {
  try {
    const db = getPrisma()
    if (status === 'IN_TRANSIT') return { success: false, error: { code: 'VAL-002', message: 'IN_TRANSIT status can only be set by shipment transitions.' } }
    const row = await db.vehicle.update({ where: { id }, data: { status } })
    await logAction({ userId, action: 'STATUS_CHANGE', entityType: 'Vehicle', entityId: id, newValue: { status } })
    return { success: true, data: toRecord(row) }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Vehicle not found.' } }
    return { success: false, error: { code: 'LOG-005', message: err instanceof Error ? err.message : 'Failed to update vehicle status.' } }
  }
}
