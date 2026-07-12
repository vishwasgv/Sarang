import { getPrisma } from '../database/db'
import { nextLogisticsNumber } from './logistics-counter.service'
import { logAction } from './audit.service'
import { inventoryService } from './inventory.service'
import { ServiceError } from '../errors/service-error'

// DeliveryChallan schema: challanNumber, challanType (DELIVERY/RETURNABLE/BRANCH_TRANSFER),
// customerId?, customerName (required), customerAddress?, shipmentId?, invoiceId?, vehicleId?,
// driverName?, driverPhone?, dispatchDate?, expectedReturn?, returnedAt?,
// status (DRAFT/ISSUED/DELIVERED/RETURNED/CANCELLED), totalValue, notes?

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:     ['ISSUED', 'CANCELLED'],
  ISSUED:    ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  RETURNED:  [],
  CANCELLED: [],
}

// Whether this challan's dispatch should move physical inventory at all. Stock is
// otherwise only ever reduced at Invoice creation (billing.service) — a challan
// that already has an invoiceId is just a paper trail for goods already accounted
// for there, so touching inventory again here would double-count. BRANCH_TRANSFER
// never changes total on-hand stock either: under this app's single-location
// inventory model, goods moving between branches are still owned and counted,
// just physically relocated — there is no per-location quantity to decrement.
function movesInventory(challan: { invoiceId: string | null; challanType: string }): boolean {
  return !challan.invoiceId && challan.challanType !== 'BRANCH_TRANSFER'
}

function validateChallanItems(items: Array<{ quantity: number; unitValue?: number; productName: string }>): string | null {
  for (const i of items) {
    if (i.quantity <= 0) return `Quantity for ${i.productName} must be greater than 0.`
    if (i.unitValue !== undefined && i.unitValue < 0) return `Value for ${i.productName} cannot be negative.`
  }
  return null
}

function toRecord(r: any) {
  return {
    id: r.id, challanNumber: r.challanNumber, challanType: r.challanType,
    customerId: r.customerId, customerName: r.customerName, customerAddress: r.customerAddress,
    shipmentId: r.shipmentId, invoiceId: r.invoiceId, vehicleId: r.vehicleId,
    vehicleNumber: r.vehicle?.vehicleNumber ?? null,
    driverName: r.driverName, driverPhone: r.driverPhone,
    dispatchDate: r.dispatchDate?.toISOString() ?? null,
    expectedReturn: r.expectedReturn?.toISOString() ?? null,
    returnedAt: r.returnedAt?.toISOString() ?? null,
    status: r.status, totalValue: r.totalValue, notes: r.notes,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    items: (r.items ?? []).map((i: any) => ({
      id: i.id, productId: i.productId, productName: i.productName,
      quantity: i.quantity, returnedQty: i.returnedQty, unit: i.unit,
      unitValue: i.unitValue, totalValue: i.totalValue, notes: i.notes,
    })),
  }
}

const INCLUDE = { items: true, vehicle: { select: { vehicleNumber: true } } }

export async function listChallans(payload?: { status?: string; challanType?: string; customerId?: string; offset?: number; limit?: number }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.status && payload.status !== 'ALL') where.status = payload.status
    if (payload?.challanType) where.challanType = payload.challanType
    if (payload?.customerId) where.customerId = payload.customerId
    const take = Math.min(payload?.limit ?? 200, 200)
    const skip = payload?.offset ?? 0
    const [rows, total] = await Promise.all([
      db.deliveryChallan.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, skip, take }),
      db.deliveryChallan.count({ where }),
    ])
    return { success: true, data: rows.map(toRecord), total }
  } catch (err) {
    return { success: false, error: { code: 'LOG-040', message: err instanceof Error ? err.message : 'Failed to list challans.' } }
  }
}

export async function getChallan(id: string) {
  try {
    const db = getPrisma()
    const row = await db.deliveryChallan.findUnique({ where: { id }, include: INCLUDE })
    if (!row) return { success: false, error: { code: 'NF-001', message: 'Challan not found.' } }
    return { success: true, data: toRecord(row) }
  } catch (err) {
    return { success: false, error: { code: 'LOG-041', message: err instanceof Error ? err.message : 'Failed to get challan.' } }
  }
}

export async function createChallan(payload: {
  challanType?: string; customerId?: string; customerName: string; customerAddress?: string
  shipmentId?: string; invoiceId?: string; vehicleId?: string
  driverName?: string; driverPhone?: string
  dispatchDate?: string; expectedReturn?: string; notes?: string
  items: Array<{ productId?: string; productName: string; quantity: number; unit?: string; unitValue?: number; notes?: string }>
}, userId?: string) {
  try {
    const db = getPrisma()
    if (!payload.customerName?.trim()) return { success: false, error: { code: 'VAL-001', message: 'Customer name is required.' } }
    if (!payload.items?.length) return { success: false, error: { code: 'VAL-001', message: 'At least one item is required.' } }
    const itemErr = validateChallanItems(payload.items)
    if (itemErr) return { success: false, error: { code: 'VAL-005', message: itemErr } }
    const totalValue = payload.items.reduce((s, i) => s + ((i.unitValue ?? 0) * i.quantity), 0)
    const row = await db.$transaction(async (tx) => {
      const challanNumber = await nextLogisticsNumber('DC', tx)
      return tx.deliveryChallan.create({
        data: {
          challanNumber, challanType: payload.challanType ?? 'DELIVERY',
          customerId: payload.customerId ?? null,
          customerName: payload.customerName.trim(),
          customerAddress: payload.customerAddress?.trim() || null,
          shipmentId: payload.shipmentId ?? null, invoiceId: payload.invoiceId ?? null,
          vehicleId: payload.vehicleId ?? null,
          driverName: payload.driverName?.trim() || null,
          driverPhone: payload.driverPhone?.trim() || null,
          dispatchDate: payload.dispatchDate ? new Date(payload.dispatchDate) : null,
          expectedReturn: payload.expectedReturn ? new Date(payload.expectedReturn) : null,
          totalValue, notes: payload.notes?.trim() || null,
          items: {
            create: payload.items.map(i => ({
              productId: i.productId ?? null, productName: i.productName,
              quantity: i.quantity, unit: i.unit ?? 'PCS',
              unitValue: i.unitValue ?? 0, totalValue: (i.unitValue ?? 0) * i.quantity,
              notes: i.notes ?? null,
            }))
          }
        },
        include: INCLUDE,
      })
    })
    await logAction({ userId, action: 'CREATE', entityType: 'DeliveryChallan', entityId: row.id, newValue: { challanNumber: row.challanNumber, customerName: row.customerName, totalValue: row.totalValue } })
    return { success: true, data: toRecord(row) }
  } catch (err) {
    return { success: false, error: { code: 'LOG-042', message: err instanceof Error ? err.message : 'Failed to create challan.' } }
  }
}

export async function updateChallanStatus(payload: { id: string; status: string }, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.deliveryChallan.findUnique({ where: { id: payload.id }, include: { items: true } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Challan not found.' } }
    const allowed = VALID_TRANSITIONS[existing.status] ?? []
    if (!allowed.includes(payload.status))
      return { success: false, error: { code: 'VAL-003', message: `Cannot transition challan from ${existing.status} to ${payload.status}.` } }
    if (existing.challanType === 'RETURNABLE' && payload.status === 'DELIVERED')
      return { success: false, error: { code: 'VAL-004', message: 'Use Record Return for returnable challans.' } }

    const now = new Date()
    const data: Record<string, unknown> = { status: payload.status }
    if (payload.status === 'ISSUED') data.dispatchDate = existing.dispatchDate ?? now
    if (payload.status === 'RETURNED') data.returnedAt = now

    const row = await db.$transaction(async (tx) => {
      // Physical dispatch happens on the DRAFT→ISSUED transition, which the state
      // machine only ever allows once per challan — no double-decrement risk.
      if (payload.status === 'ISSUED' && movesInventory(existing)) {
        for (const item of existing.items) {
          if (!item.productId) continue
          await inventoryService.reduceStockTx(
            tx, item.productId, item.quantity,
            `Dispatched via Challan ${existing.challanNumber}`, 'DELIVERY_CHALLAN', existing.id, userId
          )
        }
      }
      return tx.deliveryChallan.update({ where: { id: payload.id }, data, include: INCLUDE })
    })
    await logAction({ userId, action: 'STATUS_CHANGE', entityType: 'DeliveryChallan', entityId: payload.id, oldValue: { status: existing.status }, newValue: { status: payload.status } })
    return { success: true, data: toRecord(row) }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Challan not found.' } }
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'LOG-043', message: err instanceof Error ? err.message : 'Failed to update challan status.' } }
  }
}

export async function updateChallan(payload: {
  id: string; challanType?: string; customerName?: string; customerAddress?: string
  vehicleId?: string | null; driverName?: string; driverPhone?: string
  dispatchDate?: string; expectedReturn?: string; notes?: string
  items?: Array<{ productId?: string; productName: string; quantity: number; unit?: string; unitValue?: number; notes?: string }>
}, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.deliveryChallan.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Challan not found.' } }
    if (existing.status !== 'DRAFT') return { success: false, error: { code: 'VAL-002', message: 'Only DRAFT challans can be edited.' } }
    if (payload.items !== undefined && payload.items.length === 0)
      return { success: false, error: { code: 'VAL-004', message: 'A challan must have at least one item — delete the challan instead of clearing all items.' } }
    if (payload.items?.length) {
      const itemErr = validateChallanItems(payload.items)
      if (itemErr) return { success: false, error: { code: 'VAL-005', message: itemErr } }
    }
    const totalValue = payload.items ? payload.items.reduce((s, i) => s + ((i.unitValue ?? 0) * i.quantity), 0) : undefined
    const row = await db.$transaction(async (tx) => {
      if (payload.items !== undefined) {
        await tx.challanItem.deleteMany({ where: { challanId: payload.id } })
      }
      return tx.deliveryChallan.update({
        where: { id: payload.id },
        data: {
          ...(payload.challanType && { challanType: payload.challanType }),
          ...(payload.customerName && { customerName: payload.customerName.trim() }),
          ...(payload.customerAddress !== undefined && { customerAddress: payload.customerAddress?.trim() || null }),
          ...(payload.vehicleId !== undefined && { vehicleId: payload.vehicleId }),
          ...(payload.driverName !== undefined && { driverName: payload.driverName?.trim() || null }),
          ...(payload.driverPhone !== undefined && { driverPhone: payload.driverPhone?.trim() || null }),
          ...(payload.dispatchDate !== undefined && { dispatchDate: payload.dispatchDate ? new Date(payload.dispatchDate) : null }),
          ...(payload.expectedReturn !== undefined && { expectedReturn: payload.expectedReturn ? new Date(payload.expectedReturn) : null }),
          ...(payload.notes !== undefined && { notes: payload.notes?.trim() || null }),
          ...(totalValue !== undefined && { totalValue }),
          ...(payload.items !== undefined && {
            items: {
              create: payload.items.map(i => ({
                productId: i.productId ?? null, productName: i.productName,
                quantity: i.quantity, unit: i.unit ?? 'PCS',
                unitValue: i.unitValue ?? 0, totalValue: (i.unitValue ?? 0) * i.quantity,
                notes: i.notes ?? null,
              }))
            }
          }),
        },
        include: INCLUDE,
      })
    })
    await logAction({ userId, action: 'UPDATE', entityType: 'DeliveryChallan', entityId: payload.id })
    return { success: true, data: toRecord(row) }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Challan not found.' } }
    return { success: false, error: { code: 'LOG-045', message: err instanceof Error ? err.message : 'Failed to update challan.' } }
  }
}

export async function deleteChallan(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.deliveryChallan.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Challan not found.' } }
    if (existing.status !== 'DRAFT') return { success: false, error: { code: 'VAL-002', message: 'Only DRAFT challans can be deleted.' } }
    await db.deliveryChallan.delete({ where: { id } })
    await logAction({ userId, action: 'DELETE', entityType: 'DeliveryChallan', entityId: id, oldValue: { challanNumber: existing.challanNumber } })
    return { success: true }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Challan not found.' } }
    return { success: false, error: { code: 'LOG-046', message: err instanceof Error ? err.message : 'Failed to delete challan.' } }
  }
}

export async function recordChallanReturn(payload: {
  id: string; items: Array<{ itemId: string; returnedQty: number }>
}, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.deliveryChallan.findUnique({ where: { id: payload.id }, include: { items: true } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Challan not found.' } }
    if (existing.challanType !== 'RETURNABLE') return { success: false, error: { code: 'VAL-002', message: 'Only returnable challans support return recording.' } }
    if (existing.status !== 'ISSUED') return { success: false, error: { code: 'VAL-003', message: 'Only ISSUED challans can be returned.' } }

    // Validate all quantities before any writes
    for (const ret of payload.items) {
      const item = existing.items.find(i => i.id === ret.itemId)
      if (!item) continue
      if (ret.returnedQty < 0)
        return { success: false, error: { code: 'VAL-003', message: `Return qty for ${item.productName} cannot be negative.` } }
      if (ret.returnedQty > item.quantity)
        return { success: false, error: { code: 'VAL-003', message: `Return qty for ${item.productName} exceeds dispatched qty.` } }
    }

    // All item updates + status change + inventory restore are atomic in one transaction
    const row = await db.$transaction(async (tx) => {
      for (const ret of payload.items) {
        const item = existing.items.find(i => i.id === ret.itemId)
        if (!item) continue
        await tx.challanItem.update({ where: { id: ret.itemId }, data: { returnedQty: ret.returnedQty } })

        // Mirror the dispatch-time decrement: only restore stock for items that
        // actually left inventory when this challan was issued.
        if (item.productId && ret.returnedQty > 0 && movesInventory(existing)) {
          const inv = await tx.inventory.findUnique({ where: { productId: item.productId } })
          if (inv) {
            // Pass the product's current average cost back in so a return doesn't
            // shift the cost basis of what's already on the shelf — it's the same
            // stock coming back, not a new purchase at a different price.
            await inventoryService.addStockTx(
              tx, item.productId, ret.returnedQty, inv.averageCost,
              `Returned via Challan ${existing.challanNumber}`, 'DELIVERY_CHALLAN_RETURN', existing.id, userId
            )
          }
        }
      }
      return tx.deliveryChallan.update({
        where: { id: payload.id }, data: { status: 'RETURNED', returnedAt: new Date() }, include: INCLUDE,
      })
    })
    await logAction({ userId, action: 'RETURN', entityType: 'DeliveryChallan', entityId: payload.id, newValue: { items: payload.items } })
    return { success: true, data: toRecord(row) }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Challan not found.' } }
    return { success: false, error: { code: 'LOG-044', message: err instanceof Error ? err.message : 'Failed to record return.' } }
  }
}
