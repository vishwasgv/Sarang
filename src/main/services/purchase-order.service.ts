import { getPrisma } from '../database/db'
import { inventoryService } from './inventory.service'
import { supplierLedgerService } from './supplier-ledger.service'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import { generateSequenceNumber } from './sequence.service'
import { ServiceError } from '../errors/service-error'
import type { CreatePOPayload } from '../validation/purchase-order.validation'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// A plain count()+1 (the old approach) has two independent problems, not
// just one: (1) it races under concurrent creates the same way
// sequence.service.ts's own header comment describes — count() is a read
// that doesn't take SQLite's write lock, so two concurrent transactions can
// both read the same count before either writes — and (2) even with zero
// concurrency, it collides as soon as any PurchaseOrder is ever hard-deleted
// (count drops but the highest poNumber already issued didn't) — the exact
// bug found and fixed for customerCode/supplierCode in customer.service.ts
// and supplier.service.ts. Must be called with a tx from inside the same
// $transaction that performs the create.
async function generatePONumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'po_number_sequence', 'PO', 5,
    async () => {
      const rows = await tx.purchaseOrder.findMany({ select: { poNumber: true } })
      let max = 0
      for (const row of rows) {
        const n = parseInt(row.poNumber.replace('PO-', ''), 10)
        if (Number.isFinite(n) && n > max) max = n
      }
      return max
    }
  )
}

export const purchaseOrderService = {
  async createPO(payload: CreatePOPayload, userId?: string) {
    const db = getPrisma()

    const supplier = await db.supplier.findUnique({ where: { id: payload.supplierId } })
    if (!supplier) return { success: false, error: { code: 'SUP-001', message: 'Supplier not found.' } }
    if (!supplier.isActive) return { success: false, error: { code: 'SUP-004', message: 'Cannot create PO for an archived supplier.' } }

    for (const item of payload.items) {
      const product = await db.product.findUnique({ where: { id: item.productId } })
      if (!product) return { success: false, error: { code: 'PRD-001', message: `Product not found.` } }
      if (!product.isActive) return { success: false, error: { code: 'PRD-005', message: `Product "${product.productName}" is archived.` } }
      if (product.productType !== 'STANDARD') return { success: false, error: { code: 'PRD-006', message: `Cannot order service product "${product.productName}". Only physical products can be ordered.` } }
    }

    let subtotal = 0
    let taxAmount = 0
    for (const item of payload.items) {
      const lineBase = item.quantity * item.unitCost
      const lineTax = lineBase * ((item.taxRate ?? 0) / 100)
      subtotal += lineBase
      taxAmount += lineTax
    }
    const totalAmount = subtotal + taxAmount

    const po = await db.$transaction(async (tx) => {
      const poNumber = await generatePONumber(tx)
      return tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: payload.supplierId,
          expectedDate: payload.expectedDate ? new Date(payload.expectedDate) : null,
          notes: payload.notes || null,
          status: 'DRAFT',
          subtotal,
          taxAmount,
          totalAmount,
          createdById: userId || null,
          items: {
            create: payload.items.map(item => {
              const base = item.quantity * item.unitCost
              const tax = base * ((item.taxRate ?? 0) / 100)
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitCost: item.unitCost,
                taxRate: item.taxRate ?? 0,
                taxAmount: tax,
                itcAmount: tax,  // ITC = GST paid on purchase, claimable against output tax liability
                total: base + tax
              }
            })
          }
        },
        include: {
          supplier: { select: { id: true, supplierName: true, supplierCode: true } },
          items: {
            include: { product: { select: { id: true, productName: true, sku: true, unit: true } } }
          }
        }
      })
    })

    await logAction({ userId: userId ?? getCurrentSession()?.userId, action: 'PO_CREATED', entityType: 'PurchaseOrder', entityId: po.id, newValue: { poNumber: po.poNumber, supplierId: po.supplierId, totalAmount: po.totalAmount } })
    return { success: true, data: po }
  },

  async getPO(id: string) {
    const db = getPrisma()
    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, supplierName: true, supplierCode: true, phone: true } },
        items: {
          include: {
            product: {
              select: {
                id: true, productName: true, sku: true, unit: true,
                inventory: { select: { quantity: true } }
              }
            }
          }
        }
      }
    })
    if (!po) return { success: false, error: { code: 'PO-001', message: 'Purchase order not found.' } }
    return { success: true, data: po }
  },

  async listPOs(filters?: { supplierId?: string; status?: string; page?: number; limit?: number }) {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 20
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters?.supplierId) where.supplierId = filters.supplierId
    if (filters?.status) where.status = filters.status

    const [orders, total] = await db.$transaction([
      db.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, supplierName: true, supplierCode: true } },
          items: { select: { id: true, quantity: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.purchaseOrder.count({ where })
    ])

    return { success: true, data: { orders, total } }
  },

  async approvePO(id: string) {
    const db = getPrisma()
    try {
      // Read-check-write atomically inside one transaction — a status read
      // followed by a separate write left a window where a concurrent cancel
      // could land between them and get silently overwritten back to APPROVED.
      const updated = await db.$transaction(async (tx) => {
        const po = await tx.purchaseOrder.findUnique({ where: { id } })
        if (!po) throw new ServiceError('PO-001', 'Purchase order not found.')
        if (po.status !== 'DRAFT') {
          throw new ServiceError('PO-002', `Only DRAFT orders can be approved. Current status: ${po.status}.`)
        }
        return tx.purchaseOrder.update({ where: { id }, data: { status: 'APPROVED' } })
      })
      await logAction({ userId: getCurrentSession()?.userId, action: 'PO_APPROVED', entityType: 'PurchaseOrder', entityId: id, newValue: { status: 'APPROVED' } })
      return { success: true, data: updated }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  },

  async receivePO(id: string, userId?: string) {
    const db = getPrisma()
    try {
      // Status check + stock additions + ledger debit + status write must all
      // happen inside ONE transaction. Reading the PO (and its status) before
      // opening the transaction left a window where two concurrent receive
      // calls for the same PO could both pass the status check and each add
      // stock and debit the supplier ledger — a double-receive.
      const result = await db.$transaction(async (tx) => {
        const po = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } })
        if (!po) throw new ServiceError('PO-001', 'Purchase order not found.')
        if (po.status !== 'APPROVED') {
          throw new ServiceError('PO-003', `PO must be APPROVED before receiving. Current status: ${po.status}.`)
        }

        // Update inventory for each PO item — average cost recalculated
        for (const item of po.items) {
          await inventoryService.addStockTx(
            tx,
            item.productId,
            item.quantity,
            item.unitCost,
            `Received from PO ${po.poNumber}`,
            'PURCHASE_ORDER',
            po.id,
            userId
          )
        }

        // Add supplier ledger entry via supplier-ledger service — we owe supplier po.totalAmount
        await supplierLedgerService.addEntry({
          supplierId: po.supplierId,
          referenceType: 'PURCHASE_ORDER',
          referenceId: po.id,
          debitAmount: po.totalAmount,
          creditAmount: 0,
          remarks: `PO ${po.poNumber} received`
        }, tx)

        // Mark PO as received
        const updated = await tx.purchaseOrder.update({ where: { id }, data: { status: 'RECEIVED' } })
        return { updated, poNumber: po.poNumber }
      })

      await logAction({ userId, action: 'PO_RECEIVED', entityType: 'PurchaseOrder', entityId: id, newValue: { status: 'RECEIVED', poNumber: result.poNumber } })
      return { success: true, data: result.updated }
    } catch (err) {
      if (err instanceof ServiceError) {
        return { success: false, error: { code: err.code, message: err.message } }
      }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  },

  async cancelPO(id: string, reason: string) {
    const db = getPrisma()
    try {
      const updated = await db.$transaction(async (tx) => {
        const po = await tx.purchaseOrder.findUnique({ where: { id } })
        if (!po) throw new ServiceError('PO-001', 'Purchase order not found.')
        if (po.status === 'RECEIVED') {
          throw new ServiceError('PO-004', 'Cannot cancel a PO that has already been received.')
        }
        if (po.status === 'CANCELLED') {
          throw new ServiceError('PO-005', 'This purchase order is already cancelled.')
        }
        const cancelNote = po.notes ? `${po.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`
        return tx.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED', notes: cancelNote } })
      })
      await logAction({ userId: getCurrentSession()?.userId, action: 'PO_CANCELLED', entityType: 'PurchaseOrder', entityId: id, newValue: { status: 'CANCELLED', reason } })
      return { success: true, data: updated }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  }
}
