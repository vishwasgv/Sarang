import { getPrisma } from '../database/db'
import { nextLogisticsNumber } from './logistics-counter.service'
import { scheduleShipmentDispatchNotification, scheduleShipmentDelayedNotification } from './logistics-notification.service'
import { logAction } from './audit.service'

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:          ['READY', 'CANCELLED'],
  READY:            ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT:       ['OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED', 'CANCELLED'],
  DELIVERED:        [],
  RETURNED:         [],
  CANCELLED:        [],
}

function validateShipmentNumbers(p: { freightAmount?: number; weight?: number; packages?: number; items?: Array<{ quantity: number; unitValue?: number }> }): string | null {
  if (p.freightAmount !== undefined && p.freightAmount < 0) return 'Freight amount cannot be negative.'
  if (p.weight !== undefined && p.weight !== null && p.weight < 0) return 'Weight cannot be negative.'
  if (p.packages !== undefined && p.packages < 1) return 'Packages must be at least 1.'
  for (const i of p.items ?? []) {
    if (i.quantity <= 0) return 'Item quantity must be greater than 0.'
    if (i.unitValue !== undefined && i.unitValue < 0) return 'Item value cannot be negative.'
  }
  return null
}

function toListItem(r: any) {
  return {
    id: r.id, shipmentNumber: r.shipmentNumber, shipmentType: r.shipmentType,
    referenceType: r.referenceType, referenceNumber: r.referenceNumber,
    originAddress: r.originAddress, destinationAddress: r.destinationAddress,
    customerName: r.customerName, supplierName: r.supplierName,
    carrierName: r.carrier?.name ?? null, trackingNumber: r.trackingNumber,
    freightAmount: r.freightAmount, weight: r.weight, packages: r.packages,
    status: r.status, scheduledDate: r.scheduledDate?.toISOString() ?? null,
    readyAt: r.readyAt?.toISOString() ?? null,
    inTransitAt: r.inTransitAt?.toISOString() ?? null,
    outForDeliveryAt: r.outForDeliveryAt?.toISOString() ?? null,
    expectedDelivery: r.expectedDelivery?.toISOString() ?? null,
    deliveredAt: r.deliveredAt?.toISOString() ?? null,
    challanNumber: r.challanNumber, ewayBillNumber: r.ewayBillNumber,
    vehicleNumber: r.vehicle?.vehicleNumber ?? null,
    notes: r.notes, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  }
}

function toDetail(r: any) {
  return {
    ...toListItem(r),
    carrierId: r.carrierId, vehicleId: r.vehicleId,
    customerId: r.customerId, supplierId: r.supplierId,
    freightPaidBy: r.freightPaidBy, weightUnit: r.weightUnit,
    carrier: r.carrier ? { id: r.carrier.id, name: r.carrier.name, type: r.carrier.type, ratePerKg: r.carrier.ratePerKg, ratePerKm: r.carrier.ratePerKm } : null,
    vehicle: r.vehicle ? { id: r.vehicle.id, vehicleNumber: r.vehicle.vehicleNumber, vehicleType: r.vehicle.vehicleType, driverName: r.vehicle.driverName } : null,
    items: (r.items ?? []).map((i: any) => ({
      id: i.id, productId: i.productId, productName: i.productName,
      quantity: i.quantity, unit: i.unit, unitValue: i.unitValue, totalValue: i.totalValue,
      batchNumber: i.batchNumber, serialNumber: i.serialNumber, notes: i.notes, stopId: i.stopId,
    })),
    // Phase 58 §2 — Distributor route/beat planning. Ordered by
    // sequenceNumber (add-order) so the UI can render the run's stop
    // sequence directly without re-sorting.
    stops: (r.stops ?? []).sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber).map((s: any) => ({
      id: s.id, sequenceNumber: s.sequenceNumber, customerId: s.customerId, customerName: s.customerName,
      destinationAddress: s.destinationAddress, status: s.status,
      deliveredAt: s.deliveredAt?.toISOString() ?? null, notes: s.notes,
    })),
  }
}

const INCLUDE = {
  carrier: { select: { id: true, name: true, type: true, ratePerKg: true, ratePerKm: true } },
  vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true, driverName: true } },
  items: true,
  stops: true,
}

export async function listShipments(payload?: { status?: string; shipmentType?: string; search?: string; fromDate?: string; toDate?: string; offset?: number; limit?: number }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.status && payload.status !== 'ALL') where.status = payload.status
    if (payload?.shipmentType) where.shipmentType = payload.shipmentType
    if (payload?.search) {
      const q = payload.search.trim()
      where.OR = [
        { shipmentNumber: { contains: q } },
        { customerName: { contains: q } },
        { supplierName: { contains: q } },
        { trackingNumber: { contains: q } },
        { referenceNumber: { contains: q } },
      ]
    }
    if (payload?.fromDate || payload?.toDate) {
      where.createdAt = {
        ...(payload.fromDate ? { gte: new Date(payload.fromDate + 'T00:00:00.000') } : {}),
        ...(payload.toDate ? { lte: new Date(payload.toDate + 'T23:59:59.999') } : {}),
      }
    }
    const take = Math.min(payload?.limit ?? 200, 200)
    const skip = payload?.offset ?? 0
    const [rows, total] = await Promise.all([
      db.shipment.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, skip, take }),
      db.shipment.count({ where }),
    ])
    return { success: true, data: rows.map(toListItem), total }
  } catch (err) {
    return { success: false, error: { code: 'LOG-020', message: err instanceof Error ? err.message : 'Failed to list shipments.' } }
  }
}

export async function getShipment(id: string) {
  try {
    const db = getPrisma()
    const row = await db.shipment.findUnique({ where: { id }, include: INCLUDE })
    if (!row) return { success: false, error: { code: 'NF-001', message: 'Shipment not found.' } }
    return { success: true, data: toDetail(row) }
  } catch (err) {
    return { success: false, error: { code: 'LOG-021', message: err instanceof Error ? err.message : 'Failed to get shipment.' } }
  }
}

export async function createShipment(payload: {
  shipmentType?: string; referenceType?: string; referenceId?: string; referenceNumber?: string
  originAddress?: string; destinationAddress: string
  customerId?: string; customerName?: string; supplierId?: string; supplierName?: string
  carrierId?: string; vehicleId?: string; trackingNumber?: string
  freightAmount?: number; freightPaidBy?: string; weight?: number; weightUnit?: string; packages?: number
  scheduledDate?: string; expectedDelivery?: string; challanNumber?: string; ewayBillNumber?: string; notes?: string
  items?: Array<{ productId?: string; productName: string; quantity: number; unit?: string; unitValue?: number; batchNumber?: string; serialNumber?: string; notes?: string }>
}, userId?: string) {
  try {
    const db = getPrisma()
    if (!payload.destinationAddress?.trim()) return { success: false, error: { code: 'VAL-001', message: 'Destination address is required.' } }
    const numErr = validateShipmentNumbers(payload)
    if (numErr) return { success: false, error: { code: 'VAL-005', message: numErr } }
    const row = await db.$transaction(async (tx) => {
      const shipmentNumber = await nextLogisticsNumber('SHP', tx)
      return tx.shipment.create({
        data: {
          shipmentNumber, shipmentType: payload.shipmentType ?? 'OUTBOUND',
          referenceType: payload.referenceType ?? null, referenceId: payload.referenceId ?? null,
          referenceNumber: payload.referenceNumber?.trim() || null,
          originAddress: payload.originAddress?.trim() || null,
          destinationAddress: payload.destinationAddress.trim(),
          customerId: payload.customerId ?? null, customerName: payload.customerName?.trim() || null,
          supplierId: payload.supplierId ?? null, supplierName: payload.supplierName?.trim() || null,
          carrierId: payload.carrierId ?? null, vehicleId: payload.vehicleId ?? null,
          trackingNumber: payload.trackingNumber?.trim() || null,
          freightAmount: payload.freightAmount ?? 0, freightPaidBy: payload.freightPaidBy ?? 'SENDER',
          weight: payload.weight ?? null, weightUnit: payload.weightUnit ?? 'KG',
          packages: payload.packages ?? 1,
          scheduledDate: payload.scheduledDate ? new Date(payload.scheduledDate) : null,
          expectedDelivery: payload.expectedDelivery ? new Date(payload.expectedDelivery) : null,
          challanNumber: payload.challanNumber?.trim() || null,
          ewayBillNumber: payload.ewayBillNumber?.trim() || null,
          notes: payload.notes?.trim() || null,
          items: payload.items?.length ? {
            create: payload.items.map(i => ({
              productId: i.productId ?? null, productName: i.productName,
              quantity: i.quantity, unit: i.unit ?? 'PCS',
              unitValue: i.unitValue ?? 0, totalValue: (i.unitValue ?? 0) * i.quantity,
              batchNumber: i.batchNumber ?? null, serialNumber: i.serialNumber ?? null, notes: i.notes ?? null,
            }))
          } : undefined,
        },
        include: INCLUDE,
      })
    })
    await logAction({ userId, action: 'CREATE', entityType: 'Shipment', entityId: row.id, newValue: { shipmentNumber: row.shipmentNumber } })
    return { success: true, data: toDetail(row) }
  } catch (err) {
    return { success: false, error: { code: 'LOG-022', message: err instanceof Error ? err.message : 'Failed to create shipment.' } }
  }
}

export async function updateShipment(payload: {
  id: string; shipmentType?: string; referenceType?: string; referenceNumber?: string
  originAddress?: string; destinationAddress?: string
  customerId?: string; customerName?: string; supplierId?: string; supplierName?: string
  carrierId?: string | null; vehicleId?: string | null; trackingNumber?: string
  freightAmount?: number; freightPaidBy?: string; weight?: number; packages?: number
  scheduledDate?: string; expectedDelivery?: string; challanNumber?: string; ewayBillNumber?: string; notes?: string
  items?: Array<{ productId?: string; productName: string; quantity: number; unit?: string; unitValue?: number; batchNumber?: string; serialNumber?: string; notes?: string }>
}, userId?: string) {
  try {
    const db = getPrisma()
    if (!payload.id) return { success: false, error: { code: 'VAL-001', message: 'id is required.' } }
    const existing = await db.shipment.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Shipment not found.' } }
    if (['DELIVERED', 'RETURNED', 'CANCELLED'].includes(existing.status))
      return { success: false, error: { code: 'VAL-002', message: 'Cannot edit a terminal shipment.' } }
    const numErr = validateShipmentNumbers(payload)
    if (numErr) return { success: false, error: { code: 'VAL-005', message: numErr } }

    // Reassigning the vehicle while this shipment is the one actually holding it
    // (status IN_TRANSIT) must move the IN_TRANSIT flag with it — otherwise the old
    // vehicle is stranded at IN_TRANSIT forever (no UI/service path sets it back to
    // AVAILABLE once the shipment itself has moved on) and the new vehicle silently
    // becomes double-booked with whatever it's already assigned to.
    const vehicleChanging = payload.vehicleId !== undefined && payload.vehicleId !== existing.vehicleId
    if (vehicleChanging && existing.status === 'IN_TRANSIT' && payload.vehicleId) {
      const targetVehicle = await db.vehicle.findUnique({ where: { id: payload.vehicleId } })
      if (!targetVehicle) return { success: false, error: { code: 'NF-001', message: 'Vehicle not found.' } }
      if (targetVehicle.status !== 'AVAILABLE')
        return { success: false, error: { code: 'VAL-004', message: 'Selected vehicle is not available.' } }
    }

    const row = await db.$transaction(async (tx) => {
      if (payload.items !== undefined) {
        await tx.shipmentItem.deleteMany({ where: { shipmentId: payload.id } })
      }
      if (vehicleChanging && existing.status === 'IN_TRANSIT') {
        if (existing.vehicleId) await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'AVAILABLE' } })
        if (payload.vehicleId) await tx.vehicle.update({ where: { id: payload.vehicleId }, data: { status: 'IN_TRANSIT' } })
      }
      return tx.shipment.update({
        where: { id: payload.id },
        data: {
          ...(payload.shipmentType && { shipmentType: payload.shipmentType }),
          ...(payload.referenceType !== undefined && { referenceType: payload.referenceType }),
          ...(payload.referenceNumber !== undefined && { referenceNumber: payload.referenceNumber?.trim() || null }),
          ...(payload.originAddress !== undefined && { originAddress: payload.originAddress?.trim() || null }),
          ...(payload.destinationAddress && { destinationAddress: payload.destinationAddress.trim() }),
          ...(payload.customerId !== undefined && { customerId: payload.customerId }),
          ...(payload.customerName !== undefined && { customerName: payload.customerName?.trim() || null }),
          ...(payload.supplierId !== undefined && { supplierId: payload.supplierId }),
          ...(payload.supplierName !== undefined && { supplierName: payload.supplierName?.trim() || null }),
          ...(payload.carrierId !== undefined && { carrierId: payload.carrierId }),
          ...(payload.vehicleId !== undefined && { vehicleId: payload.vehicleId }),
          ...(payload.trackingNumber !== undefined && { trackingNumber: payload.trackingNumber?.trim() || null }),
          ...(payload.freightAmount !== undefined && { freightAmount: payload.freightAmount }),
          ...(payload.freightPaidBy && { freightPaidBy: payload.freightPaidBy }),
          ...(payload.weight !== undefined && { weight: payload.weight }),
          ...(payload.packages !== undefined && { packages: payload.packages }),
          ...(payload.scheduledDate !== undefined && { scheduledDate: payload.scheduledDate ? new Date(payload.scheduledDate) : null }),
          ...(payload.expectedDelivery !== undefined && { expectedDelivery: payload.expectedDelivery ? new Date(payload.expectedDelivery) : null }),
          ...(payload.challanNumber !== undefined && { challanNumber: payload.challanNumber?.trim() || null }),
          ...(payload.ewayBillNumber !== undefined && { ewayBillNumber: payload.ewayBillNumber?.trim() || null }),
          ...(payload.notes !== undefined && { notes: payload.notes?.trim() || null }),
          ...(payload.items !== undefined && payload.items.length > 0 && {
            items: {
              create: payload.items.map(i => ({
                productId: i.productId ?? null, productName: i.productName,
                quantity: i.quantity, unit: i.unit ?? 'PCS',
                unitValue: i.unitValue ?? 0, totalValue: (i.unitValue ?? 0) * i.quantity,
                batchNumber: i.batchNumber ?? null, serialNumber: i.serialNumber ?? null, notes: i.notes ?? null,
              }))
            }
          }),
        },
        include: INCLUDE,
      })
    })
    await logAction({ userId, action: 'UPDATE', entityType: 'Shipment', entityId: payload.id })
    return { success: true, data: toDetail(row) }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Shipment not found.' } }
    return { success: false, error: { code: 'LOG-023', message: err instanceof Error ? err.message : 'Failed to update shipment.' } }
  }
}

export async function deleteShipment(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.shipment.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Shipment not found.' } }
    if (!['PENDING', 'CANCELLED'].includes(existing.status))
      return { success: false, error: { code: 'VAL-002', message: 'Only PENDING or CANCELLED shipments can be deleted.' } }
    const freightCount = await db.freightLedger.count({ where: { shipmentId: id } })
    if (freightCount > 0)
      return { success: false, error: { code: 'REF-001', message: `Cannot delete: ${freightCount} freight entry/entries reference this shipment.` } }
    await db.shipment.delete({ where: { id } })
    await logAction({ userId, action: 'DELETE', entityType: 'Shipment', entityId: id, oldValue: { shipmentNumber: existing.shipmentNumber } })
    return { success: true }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Shipment not found.' } }
    return { success: false, error: { code: 'LOG-025', message: err instanceof Error ? err.message : 'Failed to delete shipment.' } }
  }
}

export async function updateShipmentStatus(payload: { id: string; status: string }, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.shipment.findUnique({ where: { id: payload.id }, include: { vehicle: true } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Shipment not found.' } }

    const allowed = VALID_TRANSITIONS[existing.status] ?? []
    if (!allowed.includes(payload.status))
      return { success: false, error: { code: 'VAL-003', message: `Cannot transition from ${existing.status} to ${payload.status}.` } }

    // A vehicle can only be the mover for one active shipment at a time — without this,
    // two shipments both pointed at the same vehicleId can each independently transition
    // to IN_TRANSIT with no conflict ever raised.
    if (payload.status === 'IN_TRANSIT' && existing.vehicleId && existing.vehicle?.status !== 'AVAILABLE') {
      return { success: false, error: { code: 'VAL-004', message: `Vehicle ${existing.vehicle?.vehicleNumber ?? ''} is not available (status: ${existing.vehicle?.status}).` } }
    }

    const now = new Date()
    const updateData: Record<string, unknown> = { status: payload.status }

    if (payload.status === 'READY') updateData.readyAt = now
    if (payload.status === 'IN_TRANSIT') updateData.inTransitAt = now
    if (payload.status === 'OUT_FOR_DELIVERY') updateData.outForDeliveryAt = now
    if (payload.status === 'DELIVERED') updateData.deliveredAt = now

    // Shipment status update + vehicle side-effect are atomic in one transaction
    const row = await db.$transaction(async (tx) => {
      const updated = await tx.shipment.update({ where: { id: payload.id }, data: updateData, include: INCLUDE })
      if (existing.vehicleId) {
        if (payload.status === 'IN_TRANSIT') {
          await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'IN_TRANSIT' } })
        } else if (['DELIVERED', 'RETURNED', 'CANCELLED'].includes(payload.status)) {
          await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'AVAILABLE' } })
        }
      }
      return updated
    })

    await logAction({ userId, action: 'STATUS_CHANGE', entityType: 'Shipment', entityId: existing.id, oldValue: { status: existing.status }, newValue: { status: payload.status } })

    // Dispatch notification when going IN_TRANSIT — works with or without linked customerId
    if (payload.status === 'IN_TRANSIT' && (existing.customerId || existing.customerName)) {
      let phone: string | null = null
      if (existing.customerId) {
        const cust = await db.customer.findUnique({ where: { id: existing.customerId }, select: { phone: true } })
        phone = cust?.phone ?? null
      }
      await scheduleShipmentDispatchNotification(
        existing.id, existing.shipmentNumber,
        existing.customerName ?? 'Customer',
        phone, existing.customerId ?? null, existing.trackingNumber,
        existing.expectedDelivery
      )
    }

    // Delayed notification when going OUT_FOR_DELIVERY past the expected date
    if (payload.status === 'OUT_FOR_DELIVERY' && existing.expectedDelivery && existing.expectedDelivery < new Date()) {
      if (existing.customerId || existing.customerName) {
        await scheduleShipmentDelayedNotification(
          existing.id, existing.shipmentNumber,
          existing.customerName ?? 'Customer',
          existing.customerId ?? null,
          existing.expectedDelivery
        )
      }
    }

    return { success: true, data: toDetail(row) }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Shipment not found.' } }
    return { success: false, error: { code: 'LOG-024', message: err instanceof Error ? err.message : 'Failed to update shipment status.' } }
  }
}

// ── Phase 58 §2 — Distributor route/beat planning ──────────────────────────
// A stop is an ADDITIVE beat point on top of the shipment's own primary
// destinationAddress/customerId (unchanged, still the "first" stop for
// every pre-existing single-destination shipment). Stops never touch
// Vehicle.status/inventory themselves — a vehicle stays "in transit" for
// the whole run, matching updateShipmentStatus's existing behavior above.

export async function addShipmentStop(payload: {
  shipmentId: string; customerId?: string; customerName?: string; destinationAddress: string; notes?: string
}, userId?: string) {
  try {
    const db = getPrisma()
    if (!payload.destinationAddress?.trim()) return { success: false, error: { code: 'VAL-001', message: 'Destination address is required.' } }
    const shipment = await db.shipment.findUnique({ where: { id: payload.shipmentId } })
    if (!shipment) return { success: false, error: { code: 'NF-001', message: 'Shipment not found.' } }
    if (['DELIVERED', 'RETURNED', 'CANCELLED'].includes(shipment.status))
      return { success: false, error: { code: 'VAL-002', message: 'Cannot add a stop to a terminal shipment.' } }

    const maxSeq = await db.shipmentStop.aggregate({ where: { shipmentId: payload.shipmentId }, _max: { sequenceNumber: true } })
    const stop = await db.shipmentStop.create({
      data: {
        shipmentId: payload.shipmentId,
        sequenceNumber: (maxSeq._max.sequenceNumber ?? 0) + 1,
        customerId: payload.customerId ?? null,
        customerName: payload.customerName?.trim() || null,
        destinationAddress: payload.destinationAddress.trim(),
        notes: payload.notes?.trim() || null,
      }
    })
    await logAction({ userId, action: 'CREATE', entityType: 'ShipmentStop', entityId: stop.id, newValue: { shipmentId: payload.shipmentId } })
    return { success: true, data: stop }
  } catch (err) {
    return { success: false, error: { code: 'LOG-026', message: err instanceof Error ? err.message : 'Failed to add stop.' } }
  }
}

export async function updateShipmentStopStatus(payload: { id: string; status: 'DELIVERED' | 'SKIPPED' | 'PENDING' }, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.shipmentStop.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Stop not found.' } }
    const stop = await db.shipmentStop.update({
      where: { id: payload.id },
      data: { status: payload.status, deliveredAt: payload.status === 'DELIVERED' ? new Date() : existing.deliveredAt }
    })
    await logAction({ userId, action: 'STATUS_CHANGE', entityType: 'ShipmentStop', entityId: payload.id, oldValue: { status: existing.status }, newValue: { status: payload.status } })
    return { success: true, data: stop }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Stop not found.' } }
    return { success: false, error: { code: 'LOG-027', message: err instanceof Error ? err.message : 'Failed to update stop status.' } }
  }
}

export async function deleteShipmentStop(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.shipmentStop.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Stop not found.' } }
    await db.shipmentStop.delete({ where: { id } })
    await logAction({ userId, action: 'DELETE', entityType: 'ShipmentStop', entityId: id, oldValue: { shipmentId: existing.shipmentId } })
    return { success: true }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Stop not found.' } }
    return { success: false, error: { code: 'LOG-028', message: err instanceof Error ? err.message : 'Failed to delete stop.' } }
  }
}
