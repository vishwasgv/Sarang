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
    const record = await db.dispatchRecord.findUnique({ where: { id: payload.id } })
    if (!record) return { success: false, error: { code: 'DSP-004', message: 'Dispatch record not found.' } }
    if (record.status === payload.status) return { success: true } // idempotent

    await db.$transaction(async (tx) => {
      await tx.dispatchRecord.update({
        where: { id: payload.id },
        data: {
          status: payload.status,
          ...(payload.status === 'DISPATCHED' ? { dispatchDate: payload.date ? new Date(payload.date) : new Date() } : {}),
          ...(payload.status === 'DELIVERED' ? { deliveryDate: payload.date ? new Date(payload.date) : new Date() } : {})
        }
      })

      // Deduct finished goods from inventory when dispatched (only on first DISPATCHED transition)
      if (payload.status === 'DISPATCHED' && record.status === 'READY') {
        const currentInv = await tx.inventory.findUnique({ where: { productId: record.productId }, select: { quantity: true } })
        const available = currentInv?.quantity ?? 0
        if (available < record.quantity) {
          throw new Error(`Insufficient stock to dispatch. Available: ${available}, required: ${record.quantity}.`)
        }
        await tx.inventory.update({
          where: { productId: record.productId },
          data: { quantity: { decrement: record.quantity } }
        })
        await tx.inventoryMovement.create({
          data: {
            productId: record.productId,
            movementType: 'DISPATCH_OUT',
            quantity: record.quantity,
            referenceType: 'DISPATCH',
            referenceId: record.dispatchNumber,
            remarks: `Dispatched: ${record.dispatchNumber}${record.destination ? ` → ${record.destination}` : ''}`,
            createdById: userId ?? null
          }
        })
      }
    })

    await logAction(userId, 'DISPATCH_STATUS_UPDATED', 'DispatchRecord', payload.id, record.status, payload.status)
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
