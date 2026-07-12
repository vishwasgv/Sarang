import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// FreightLedger schema: id, shipmentId, carrierId, carrierName, referenceNumber,
// amount, paidDate, paidBy (CASH/BANK/CREDIT), notes, createdAt, updatedAt
// "PAID" status is derived: paidDate != null

function toRecord(r: any) {
  return {
    id: r.id,
    shipmentId: r.shipmentId,
    shipmentNumber: r.shipment?.shipmentNumber ?? null,
    carrierId: r.carrierId,
    carrierName: r.carrierName,
    referenceNumber: r.referenceNumber,
    amount: r.amount,
    paidDate: r.paidDate?.toISOString() ?? null,
    paidBy: r.paidBy,
    status: r.paidDate ? 'PAID' : 'PENDING',
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

const INCLUDE = {
  shipment: { select: { shipmentNumber: true } },
}

export async function listFreightLedger(payload?: { carrierId?: string; shipmentId?: string; status?: string; fromDate?: string; toDate?: string; offset?: number; limit?: number }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.carrierId) where.carrierId = payload.carrierId
    if (payload?.shipmentId) where.shipmentId = payload.shipmentId
    if (payload?.status === 'PAID') where.paidDate = { not: null }
    if (payload?.status === 'PENDING') where.paidDate = null
    if (payload?.fromDate || payload?.toDate) {
      where.createdAt = {
        ...(payload.fromDate ? { gte: new Date(payload.fromDate + 'T00:00:00.000') } : {}),
        ...(payload.toDate ? { lte: new Date(payload.toDate + 'T23:59:59.999') } : {}),
      }
    }
    const take = Math.min(payload?.limit ?? 500, 500)
    const skip = payload?.offset ?? 0
    const [rows, total] = await Promise.all([
      db.freightLedger.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, skip, take }),
      db.freightLedger.count({ where }),
    ])
    return { success: true, data: rows.map(toRecord), total }
  } catch (err) {
    return { success: false, error: { code: 'LOG-050', message: err instanceof Error ? err.message : 'Failed to list freight ledger.' } }
  }
}

export async function createFreightEntry(payload: {
  shipmentId?: string; carrierId?: string; carrierName?: string; referenceNumber?: string
  amount: number; paidBy?: string; notes?: string
}, userId?: string) {
  try {
    const db = getPrisma()
    if (!payload.amount || payload.amount <= 0) return { success: false, error: { code: 'VAL-001', message: 'Amount must be greater than 0.' } }

    let resolvedCarrierName = payload.carrierName?.trim() || 'Unknown'
    if (payload.carrierId && !payload.carrierName) {
      const carrier = await db.carrier.findUnique({ where: { id: payload.carrierId } })
      if (carrier) resolvedCarrierName = carrier.name
    }

    const row = await db.freightLedger.create({
      data: {
        shipmentId: payload.shipmentId ?? null,
        carrierId: payload.carrierId ?? null,
        carrierName: resolvedCarrierName,
        referenceNumber: payload.referenceNumber?.trim() || null,
        amount: payload.amount,
        paidBy: payload.paidBy ?? 'CASH',
        notes: payload.notes?.trim() || null,
      },
      include: INCLUDE,
    })
    await logAction({ userId, action: 'CREATE', entityType: 'FreightLedger', entityId: row.id, newValue: { carrierName: row.carrierName, amount: row.amount } })
    return { success: true, data: toRecord(row) }
  } catch (err) {
    return { success: false, error: { code: 'LOG-051', message: err instanceof Error ? err.message : 'Failed to create freight entry.' } }
  }
}

export async function markFreightPaid(payload: { id: string; paidBy?: string; notes?: string }, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.freightLedger.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Freight entry not found.' } }
    if (existing.paidDate) return { success: false, error: { code: 'VAL-002', message: 'Entry is already marked paid.' } }
    const row = await db.freightLedger.update({
      where: { id: payload.id },
      data: {
        paidDate: new Date(),
        ...(payload.paidBy && { paidBy: payload.paidBy }),
        ...(payload.notes !== undefined && { notes: payload.notes?.trim() || null }),
      },
      include: INCLUDE,
    })
    await logAction({ userId, action: 'MARK_PAID', entityType: 'FreightLedger', entityId: payload.id, oldValue: { paidDate: null }, newValue: { amount: existing.amount, paidBy: row.paidBy } })
    return { success: true, data: toRecord(row) }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Freight entry not found.' } }
    return { success: false, error: { code: 'LOG-052', message: err instanceof Error ? err.message : 'Failed to mark freight paid.' } }
  }
}

export async function updateFreightEntry(payload: {
  id: string; carrierId?: string | null; carrierName?: string; referenceNumber?: string; amount?: number; paidBy?: string; notes?: string
}, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.freightLedger.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Freight entry not found.' } }
    if (existing.paidDate) return { success: false, error: { code: 'VAL-002', message: 'Cannot edit a paid freight entry.' } }
    if (payload.amount !== undefined && payload.amount <= 0) return { success: false, error: { code: 'VAL-001', message: 'Amount must be greater than 0.' } }

    let resolvedCarrierName = payload.carrierName?.trim()
    if (payload.carrierId && !resolvedCarrierName) {
      const carrier = await db.carrier.findUnique({ where: { id: payload.carrierId } })
      if (carrier) resolvedCarrierName = carrier.name
    }

    const row = await db.freightLedger.update({
      where: { id: payload.id },
      data: {
        ...(payload.carrierId !== undefined && { carrierId: payload.carrierId }),
        ...(resolvedCarrierName && { carrierName: resolvedCarrierName }),
        ...(payload.referenceNumber !== undefined && { referenceNumber: payload.referenceNumber?.trim() || null }),
        ...(payload.amount !== undefined && { amount: payload.amount }),
        ...(payload.paidBy && { paidBy: payload.paidBy }),
        ...(payload.notes !== undefined && { notes: payload.notes?.trim() || null }),
      },
      include: INCLUDE,
    })
    await logAction({ userId, action: 'UPDATE', entityType: 'FreightLedger', entityId: payload.id })
    return { success: true, data: toRecord(row) }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Freight entry not found.' } }
    return { success: false, error: { code: 'LOG-054', message: err instanceof Error ? err.message : 'Failed to update freight entry.' } }
  }
}

export async function deleteFreightEntry(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.freightLedger.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Freight entry not found.' } }
    if (existing.paidDate) return { success: false, error: { code: 'VAL-002', message: 'Cannot delete a paid freight entry.' } }
    await db.freightLedger.delete({ where: { id } })
    await logAction({ userId, action: 'DELETE', entityType: 'FreightLedger', entityId: id, oldValue: { carrierName: existing.carrierName, amount: existing.amount } })
    return { success: true }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Freight entry not found.' } }
    return { success: false, error: { code: 'LOG-055', message: err instanceof Error ? err.message : 'Failed to delete freight entry.' } }
  }
}

export async function getFreightSummary(payload?: { fromDate?: string; toDate?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.fromDate || payload?.toDate) {
      where.createdAt = {
        ...(payload?.fromDate ? { gte: new Date(payload.fromDate + 'T00:00:00.000') } : {}),
        ...(payload?.toDate ? { lte: new Date(payload.toDate + 'T23:59:59.999') } : {}),
      }
    }
    const all = await db.freightLedger.findMany({ where })
    const totalAmount = all.reduce((s, r) => s + r.amount, 0)
    const paidAmount = all.filter(r => r.paidDate !== null).reduce((s, r) => s + r.amount, 0)
    const pendingAmount = totalAmount - paidAmount

    const byCarrier: Record<string, { name: string; total: number; paid: number; pending: number }> = {}
    for (const row of all) {
      const key = row.carrierId ?? row.carrierName
      if (!byCarrier[key]) byCarrier[key] = { name: row.carrierName, total: 0, paid: 0, pending: 0 }
      byCarrier[key].total += row.amount
      if (row.paidDate) byCarrier[key].paid += row.amount
      else byCarrier[key].pending += row.amount
    }
    return { success: true, data: { totalAmount, pendingAmount, paidAmount, byCarrier: Object.values(byCarrier) } }
  } catch (err) {
    return { success: false, error: { code: 'LOG-053', message: err instanceof Error ? err.message : 'Failed to get freight summary.' } }
  }
}
