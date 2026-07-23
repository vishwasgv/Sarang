import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'

export interface DispatchRecord {
  id: string
  dispatchNumber: string
  productId: string
  productName: string
  productionOrderId: string | null
  productionOrderNumber: string | null
  quantity: number
  customerId: string | null
  customerName: string | null
  destination: string | null
  status: 'READY' | 'DISPATCHED' | 'DELIVERED'
  dispatchDate: string | null
  deliveryDate: string | null
  notes: string | null
  createdAt: string
}

export async function listDispatch(payload?: {
  status?: string
  productId?: string
  limit?: number
}): Promise<{ success: boolean; data?: { records: DispatchRecord[]; total: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.status) where.status = payload.status
    if (payload?.productId) where.productId = payload.productId

    const rows = await db.dispatchRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: payload?.limit ?? 200,
      include: {
        product: { select: { productName: true } },
        customer: { select: { customerName: true } }
      }
    })
    return { success: true, data: { records: rows.map(toRecord), total: rows.length } }
  } catch (err) {
    return { success: false, error: { code: 'DSP-001', message: err instanceof Error ? err.message : 'Failed to list dispatches.' } }
  }
}

export async function createDispatch(payload: {
  productId: string
  productionOrderId?: string
  quantity: number
  customerId?: string
  destination?: string
  notes?: string
}, userId?: string): Promise<{ success: boolean; data?: DispatchRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    const product = await db.product.findUnique({ where: { id: payload.productId }, select: { productName: true } })
    if (!product) return { success: false, error: { code: 'DSP-002', message: 'Product not found.' } }

    if (payload.quantity <= 0) {
      return { success: false, error: { code: 'DSP-007', message: 'Dispatch quantity must be greater than 0.' } }
    }

    const inventory = await db.inventory.findUnique({ where: { productId: payload.productId }, select: { quantity: true } })
    const availableStock = inventory?.quantity ?? 0
    if (payload.quantity > availableStock) {
      return { success: false, error: { code: 'DSP-006', message: `Insufficient stock. Available: ${availableStock}, requested: ${payload.quantity}.` } }
    }

    const created = await db.$transaction(async (tx) => {
      const dispatchNumber = await generateSequenceNumber(
        tx, 'dispatch_number_sequence', 'DSP', 5,
        async () => {
          const lastRecord = await tx.dispatchRecord.findFirst({ orderBy: { createdAt: 'desc' }, select: { dispatchNumber: true } })
          return lastRecord ? parseInt(lastRecord.dispatchNumber.replace('DSP-', ''), 10) : 0
        }
      )
      return tx.dispatchRecord.create({
        data: {
          dispatchNumber,
          productId: payload.productId,
          productionOrderId: payload.productionOrderId ?? null,
          quantity: payload.quantity,
          customerId: payload.customerId ?? null,
          destination: payload.destination?.trim() ?? null,
          notes: payload.notes?.trim() ?? null,
          createdById: userId ?? null
        },
        include: {
          product: { select: { productName: true } },
          customer: { select: { customerName: true } }
        }
      })
    })

    await logAction(userId, 'DISPATCH_CREATED', 'DispatchRecord', created.id, undefined, { dispatchNumber: created.dispatchNumber, productId: payload.productId })
    return { success: true, data: toRecord(created) }
  } catch (err) {
    return { success: false, error: { code: 'DSP-003', message: err instanceof Error ? err.message : 'Failed to create dispatch.' } }
  }
}

export async function updateDispatchStatus(payload: {
  id: string
  status: 'DISPATCHED' | 'DELIVERED'
  date?: string
}, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    // Fast pre-check outside the transaction (not-found / already-idempotent)
    // — NOT the real guard for the stock-deduction race, see below.
    const record = await db.dispatchRecord.findUnique({ where: { id: payload.id } })
    if (!record) return { success: false, error: { code: 'DSP-004', message: 'Dispatch record not found.' } }
    if (record.status === payload.status) return { success: true } // idempotent

    // BUG FOUND 2026-07-22: `record.status === 'READY'` used to check the
    // pre-transaction snapshot. Two concurrent calls to mark the same
    // dispatch DISPATCHED would both read status: 'READY' before either
    // committed, both pass this guard, and both decrement inventory by
    // record.quantity — silently over-deducting finished-goods stock for
    // one physical dispatch event (the insufficient-stock check only
    // guards against going negative, not against double-counting when
    // there's enough stock to cover both decrements). Fixed to re-read the
    // record's status fresh INSIDE the transaction, immediately before the
    // guard, matching the pattern already established elsewhere in this
    // codebase (e.g. logistics-grn.service.ts's postGRN) for the identical
    // race shape.
    let previousStatus = record.status
    await db.$transaction(async (tx) => {
      const fresh = await tx.dispatchRecord.findUniqueOrThrow({ where: { id: payload.id }, select: { status: true, productId: true, quantity: true, dispatchNumber: true, destination: true } })
      previousStatus = fresh.status
      if (fresh.status === payload.status) return // became a no-op by the time we got the lock

      await tx.dispatchRecord.update({
        where: { id: payload.id },
        data: {
          status: payload.status,
          ...(payload.status === 'DISPATCHED' ? { dispatchDate: payload.date ? new Date(payload.date) : new Date() } : {}),
          ...(payload.status === 'DELIVERED' ? { deliveryDate: payload.date ? new Date(payload.date) : new Date() } : {})
        }
      })

      // Deduct finished goods from inventory when dispatched (only on first DISPATCHED transition)
      if (payload.status === 'DISPATCHED' && fresh.status === 'READY') {
        const currentInv = await tx.inventory.findUnique({ where: { productId: fresh.productId }, select: { quantity: true } })
        const available = currentInv?.quantity ?? 0
        if (available < fresh.quantity) {
          throw new Error(`Insufficient stock to dispatch. Available: ${available}, required: ${fresh.quantity}.`)
        }
        await tx.inventory.update({
          where: { productId: fresh.productId },
          data: { quantity: { decrement: fresh.quantity } }
        })
        await tx.inventoryMovement.create({
          data: {
            productId: fresh.productId,
            movementType: 'DISPATCH_OUT',
            quantity: fresh.quantity,
            referenceType: 'DISPATCH',
            referenceId: fresh.dispatchNumber,
            remarks: `Dispatched: ${fresh.dispatchNumber}${fresh.destination ? ` → ${fresh.destination}` : ''}`,
            createdById: userId ?? null
          }
        })
      }
    })

    await logAction(userId, 'DISPATCH_STATUS_UPDATED', 'DispatchRecord', payload.id, previousStatus, payload.status)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'DSP-005', message: err instanceof Error ? err.message : 'Failed to update dispatch status.' } }
  }
}

type DispatchRow = {
  id: string
  dispatchNumber: string
  productId: string
  productionOrderId: string | null
  quantity: number
  customerId: string | null
  destination: string | null
  status: string
  dispatchDate: Date | null
  deliveryDate: Date | null
  notes: string | null
  createdAt: Date
  product: { productName: string }
  customer: { customerName: string } | null
}

function toRecord(r: DispatchRow): DispatchRecord {
  return {
    id: r.id,
    dispatchNumber: r.dispatchNumber,
    productId: r.productId,
    productName: r.product.productName,
    productionOrderId: r.productionOrderId,
    productionOrderNumber: null, // not needed for list view
    quantity: r.quantity,
    customerId: r.customerId,
    customerName: r.customer?.customerName ?? null,
    destination: r.destination,
    status: r.status as DispatchRecord['status'],
    dispatchDate: r.dispatchDate?.toISOString() ?? null,
    deliveryDate: r.deliveryDate?.toISOString() ?? null,
    notes: r.notes,
    createdAt: r.createdAt.toISOString()
  }
}
