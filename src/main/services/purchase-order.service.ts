import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { inventoryService } from './inventory.service'
import { supplierLedgerService } from './supplier-ledger.service'
import { calculateLineTotal, sumCurrency, roundCurrency } from './currency.service'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import { generateSequenceNumber } from './sequence.service'
import { assertNotLocked, assertNotLockedOrThrow } from './transaction-lock.service'
import { approvalWorkflowService } from './approval-workflow.service'
import { getProductCostsBatch } from './valuation.service'
import { getLandedCostPerUnitForPO } from './landed-cost.service'
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

// Phase 67 §9.1 — Hardware: smart carton-break reorder trigger. Rounds a
// piece-unit reorder quantity UP to the next whole multiple of the
// product's carton size — never down, since under-ordering a genuinely low-
// stock item to save a fraction of a carton defeats the point of a reorder
// alert. A product not sold by pack (the overwhelming majority) is returned
// completely untouched.
function roundUpToCartonMultiple(quantity: number, sellByPack: boolean, unitsPerPack: number | null): number {
  if (!sellByPack || !unitsPerPack || unitsPerPack <= 0) return quantity
  return Math.ceil(quantity / unitsPerPack) * unitsPerPack
}

export const purchaseOrderService = {
  async createPO(payload: CreatePOPayload, userId?: string) {
    const db = getPrisma()

    const supplier = await db.supplier.findUnique({ where: { id: payload.supplierId } })
    if (!supplier) return { success: false, error: { code: 'SUP-001', message: 'Supplier not found.' } }
    if (!supplier.isActive) return { success: false, error: { code: 'SUP-004', message: 'Cannot create PO for an archived supplier.' } }

    // Phase 63 — drop-shipment: the delivery address on this PO's own print
    // output/GRN flow becomes the customer's, not the business's own.
    if (payload.dropShipToCustomerId) {
      const dropShipCustomer = await db.customer.findUnique({ where: { id: payload.dropShipToCustomerId } })
      if (!dropShipCustomer) return { success: false, error: { code: 'CUST-001', message: 'Drop-ship customer not found.' } }
    }
    if (payload.sourceSalesOrderId) {
      const so = await db.salesOrder.findUnique({ where: { id: payload.sourceSalesOrderId } })
      if (!so) return { success: false, error: { code: 'SO-001', message: 'Source sales order not found.' } }
    }

    // Phase 61 — a line is either a physical product (validated as before) or
    // a genuine free-text service line (productId absent entirely). The
    // PRD-006 rejection stays for product lines: it blocks selecting an
    // internal placeholder SERVICE-type Product record as a PO line, which
    // is a different thing from the new additive no-productId service-line
    // path below.
    for (const item of payload.items) {
      if (item.productId) {
        const product = await db.product.findUnique({ where: { id: item.productId } })
        if (!product) return { success: false, error: { code: 'PRD-001', message: `Product not found.` } }
        if (!product.isActive) return { success: false, error: { code: 'PRD-005', message: `Product "${product.productName}" is archived.` } }
        if (product.productType !== 'STANDARD') return { success: false, error: { code: 'PRD-006', message: `Cannot order service product "${product.productName}". Only physical products can be ordered.` } }
      } else if (item.serviceCategoryId) {
        const cat = await db.expenseCategory.findUnique({ where: { id: item.serviceCategoryId } })
        if (!cat) return { success: false, error: { code: 'EXP-002', message: 'Expense category not found.' } }
      }
    }

    // Real bug found live (core-commerce audit): subtotal/taxAmount/totalAmount
    // used to be accumulated with plain `+=` on raw `quantity * unitCost`
    // floats — the one financial-document-creation path in this scope that
    // didn't route through currency.service.ts's Decimal-backed helpers the
    // way billing.service.ts/returns.service.ts already do. Not just cosmetic:
    // receivePO() below posts `debitAmount: po.totalAmount` straight into the
    // supplier's real ledger balance (an aggregate SUM that a float artifact
    // like 4999.999999999999 would carry forward permanently), and this
    // total also lands verbatim on the printed PO. Computed per-line via
    // calculateLineTotal (no discount on a PO line) and summed via
    // sumCurrency, exactly mirroring every other invoice-shaped total in
    // this codebase.
    const lineRows = payload.items.map(item => ({
      item,
      ...calculateLineTotal(item.quantity, item.unitCost, 0, item.taxRate ?? 0)
    }))
    const subtotal = sumCurrency(lineRows.map(r => r.subtotal))
    const taxAmount = sumCurrency(lineRows.map(r => r.taxAmount))
    const totalAmount = roundCurrency(subtotal + taxAmount)

    // Phase 62 — Transaction Locking. POs always order at "now" (no
    // backdating field exists), same reasoning as billing.service.ts's own
    // createInvoice check.
    const lockError = await assertNotLocked(new Date())
    if (lockError) return lockError

    const po = await db.$transaction(async (tx) => {
      const poNumber = await generatePONumber(tx)
      return tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: payload.supplierId,
          // Real bug found live (2026-07-28 core-commerce audit): a bare
          // `new Date('YYYY-MM-DD')` parses as UTC midnight — ai-query.service.ts's
          // `expectedDate: { lt: now }` overdue-PO check compared this
          // against local `now`, flagging a PO as overdue starting 5:30 AM
          // local time (IST) on its actual expected delivery date. Same fix
          // as billing.service.ts's dueDate (see its comment there).
          expectedDate: payload.expectedDate ? parseLocalDateStart(payload.expectedDate) : null,
          notes: payload.notes || null,
          status: 'DRAFT',
          subtotal,
          taxAmount,
          totalAmount,
          isReverseCharge: payload.isReverseCharge,
          dropShipToCustomerId: payload.dropShipToCustomerId || null,
          sourceSalesOrderId: payload.sourceSalesOrderId || null,
          createdById: userId || null,
          items: {
            create: lineRows.map(({ item, taxAmount: lineTax, lineTotal }) => ({
              productId: item.productId || null,
              serviceDescription: item.serviceDescription || null,
              serviceCategoryId: item.serviceCategoryId || null,
              quantity: item.quantity,
              unitCost: item.unitCost,
              taxRate: item.taxRate ?? 0,
              taxAmount: lineTax,
              itcAmount: lineTax,  // ITC = GST paid on purchase, claimable against output tax liability
              total: lineTotal
            }))
          }
        },
        include: {
          supplier: { select: { id: true, supplierName: true, supplierCode: true } },
          items: {
            include: {
              product: { select: { id: true, productName: true, sku: true, unit: true } },
              serviceCategory: { select: { id: true, categoryName: true } }
            }
          }
        }
      })
    })

    await logAction({ userId: userId ?? getCurrentSession()?.userId, action: 'PO_CREATED', entityType: 'PurchaseOrder', entityId: po.id, newValue: { poNumber: po.poNumber, supplierId: po.supplierId, totalAmount: po.totalAmount } })
    return { success: true, data: po }
  },

  // Phase 58 §2 — reorder automation, triggered manually from the low-stock
  // alert (not fully silent — an owner reviews/approves the drafted PO like
  // any other, same DRAFT-status starting point createPO already uses).
  // Only ever drafts for a product that has BOTH reorderLevel/reorderQuantity
  // configured AND a defaultSupplierId set — no guessing which supplier or
  // how much to order. Groups all due products by supplier into one PO per
  // supplier, and skips a product that already has an open (DRAFT/APPROVED)
  // PO in flight so re-running this doesn't pile up duplicate orders.
  async generateReorderDraftPOs(userId?: string): Promise<{ success: boolean; error?: { code: string; message: string }; data?: { created: Array<{ poId: string; poNumber: string; supplierId: string; supplierName: string; itemCount: number }>; skippedNoDefaultSupplier: number; skippedAlreadyOnOpenPO: number } }> {
    const db = getPrisma()

    const lowStock = await db.inventory.findMany({
      where: { reorderLevel: { gt: 0 }, reorderQuantity: { gt: 0 } },
      // Phase 67 §9.1 — Hardware: sellByPack/unitsPerPack needed for the
      // carton-aware reorder rounding below.
      include: { product: { select: { id: true, productName: true, isActive: true, defaultSupplierId: true, costPrice: true, taxRate: true, sellByPack: true, unitsPerPack: true } } }
    })
    const due = lowStock.filter(inv => inv.quantity <= inv.reorderLevel && inv.product.isActive)

    const withSupplier = due.filter(inv => !!inv.product.defaultSupplierId)
    const skippedNoDefaultSupplier = due.length - withSupplier.length

    // Skip a product that's already on a DRAFT or APPROVED PO — re-running
    // this action repeatedly (e.g. once a day) must not pile up duplicate
    // orders for the same still-unreceived shortage.
    const productIds = withSupplier.map(inv => inv.product.id)
    const openItems = productIds.length
      ? await db.purchaseOrderItem.findMany({
          where: { productId: { in: productIds }, purchaseOrder: { status: { in: ['DRAFT', 'APPROVED'] } } },
          select: { productId: true }
        })
      : []
    const alreadyOpen = new Set(openItems.map(i => i.productId))
    const toOrder = withSupplier.filter(inv => !alreadyOpen.has(inv.product.id))
    const skippedAlreadyOnOpenPO = withSupplier.length - toOrder.length

    // Phase 64 — was inv.product.costPrice (the static, hand-edited field);
    // a draft PO's suggested unitCost is still just a starting point the
    // buyer reviews before approving, but it should reflect the product's
    // own real, currently-resolved cost, same as every other consumer of
    // this figure, not silently diverge from it.
    const costs = await getProductCostsBatch(toOrder.map(inv => inv.product.id))

    const bySupplier = new Map<string, Array<{ productId: string; quantity: number; unitCost: number; taxRate: number }>>()
    for (const inv of toOrder) {
      const supplierId = inv.product.defaultSupplierId!
      const list = bySupplier.get(supplierId) ?? []
      // Phase 67 §9.1 — Hardware: smart carton-break reorder trigger. A
      // supplier sells whole cartons, not a fractional count of pieces — a
      // draft PO suggesting "37 pieces" for a product bought in cartons of
      // 50 is not actually orderable as written. Round the suggested
      // quantity UP to the next whole-carton multiple for any product sold
      // by pack; every other product is completely unaffected.
      const quantity = roundUpToCartonMultiple(inv.reorderQuantity, inv.product.sellByPack, inv.product.unitsPerPack)
      list.push({ productId: inv.product.id, quantity, unitCost: costs.get(inv.product.id) ?? inv.product.costPrice, taxRate: inv.product.taxRate })
      bySupplier.set(supplierId, list)
    }

    const created: Array<{ poId: string; poNumber: string; supplierId: string; supplierName: string; itemCount: number }> = []
    for (const [supplierId, items] of bySupplier) {
      const res = await this.createPO({ supplierId, items, isReverseCharge: false, notes: 'Auto-drafted from low-stock reorder alert — review before approving.' }, userId)
      if (res.success && res.data) {
        const po = res.data as { id: string; poNumber: string; supplier: { supplierName: string } }
        created.push({ poId: po.id, poNumber: po.poNumber, supplierId, supplierName: po.supplier.supplierName, itemCount: items.length })
      }
    }

    return { success: true, data: { created, skippedNoDefaultSupplier, skippedAlreadyOnOpenPO } }
  },

  async getPO(id: string) {
    const db = getPrisma()
    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        // email added for the Share feature (Section 4/5.1 of
        // FEATURE_SHARE_BILL_REPORT_WHATSAPP_EMAIL.md) — POs share to the
        // Supplier's contact info, not a Customer's.
        supplier: { select: { id: true, supplierName: true, supplierCode: true, phone: true, email: true } },
        // Phase 63 — drop-shipment: the address a real user needs to see on
        // this PO's own detail screen when it's shipping direct to a customer.
        dropShipToCustomer: { select: { id: true, customerName: true, address: true, city: true, state: true, phone: true } },
        sourceSalesOrder: { select: { id: true, soNumber: true } },
        items: {
          include: {
            product: {
              select: {
                id: true, productName: true, sku: true, unit: true,
                inventory: { select: { quantity: true } }
              }
            },
            serviceCategory: { select: { id: true, categoryName: true } }
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

  // Phase 63 — multi-level approval workflows, fully opt-in: an install with
  // no active ApprovalWorkflow for PURCHASE_ORDER (the overwhelming
  // majority) sees zero behavior change here — submitForApproval always
  // returns requiresApproval:false and this goes straight to APPROVED
  // exactly as before. Re-callable, mirroring
  // salesOrderService.confirmSalesOrder's own identical pattern: once a
  // PENDING_APPROVAL order's ApprovalInstance reaches APPROVED, calling
  // this again finishes the DRAFT→APPROVED transition instead of erroring.
  async approvePO(id: string) {
    const db = getPrisma()
    try {
      const po = await db.purchaseOrder.findUnique({ where: { id } })
      if (!po) return { success: false, error: { code: 'PO-001', message: 'Purchase order not found.' } }

      if (po.status === 'PENDING_APPROVAL') {
        const instanceRes = await approvalWorkflowService.getInstanceForDocument('PURCHASE_ORDER', id)
        const instance = instanceRes.success ? (instanceRes.data as { status: string } | null) : null
        if (!instance || instance.status === 'PENDING') {
          return { success: false, error: { code: 'PO-006', message: 'This Purchase Order is still awaiting approval.' } }
        }
        if (instance.status === 'REJECTED') {
          return { success: false, error: { code: 'PO-007', message: 'This Purchase Order was rejected during approval and cannot be approved.' } }
        }
        // instance.status === 'APPROVED' — fall through to the real transition below.
      } else if (po.status !== 'DRAFT') {
        return { success: false, error: { code: 'PO-002', message: `Only DRAFT orders can be approved. Current status: ${po.status}.` } }
      } else {
        const approvalRes = await approvalWorkflowService.submitForApproval({ documentType: 'PURCHASE_ORDER', documentId: id, amount: po.totalAmount })
        if (approvalRes.success && (approvalRes.data as { requiresApproval: boolean }).requiresApproval) {
          const pending = await db.purchaseOrder.update({ where: { id }, data: { status: 'PENDING_APPROVAL' } })
          await logAction({ userId: getCurrentSession()?.userId, action: 'PO_SUBMITTED_FOR_APPROVAL', entityType: 'PurchaseOrder', entityId: id, newValue: { status: 'PENDING_APPROVAL' } })
          return { success: true, data: pending }
        }
      }

      // Read-check-write atomically inside one transaction — a status read
      // followed by a separate write left a window where a concurrent cancel
      // could land between them and get silently overwritten back to APPROVED.
      const updated = await db.$transaction(async (tx) => {
        const fresh = await tx.purchaseOrder.findUnique({ where: { id } })
        if (!fresh) throw new ServiceError('PO-001', 'Purchase order not found.')
        if (fresh.status !== 'DRAFT' && fresh.status !== 'PENDING_APPROVAL') {
          throw new ServiceError('PO-002', `Only DRAFT orders can be approved. Current status: ${fresh.status}.`)
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

        // Phase 64 — landed cost (freight/duty/handling) allocated
        // proportionally across this PO's own product lines, folded into
        // the effective unit cost BEFORE it feeds Inventory.averageCost/
        // ProductCostHistory — this is what makes a landed-cost-bearing
        // purchase genuinely raise the received goods' cost basis, not
        // just sit as a disconnected Expense line. Empty map (every
        // pre-Phase-64 PO, and any PO with no landed cost entered) means
        // every line's effectiveUnitCost equals its own unitCost exactly —
        // zero behavior change for the common case.
        const productLines = po.items.filter((item): item is typeof item & { productId: string } => item.productId !== null)
        const landedCostPerUnit = await getLandedCostPerUnitForPO(
          tx, po.id, productLines.map(item => ({ productId: item.productId, quantity: item.quantity, unitCost: item.unitCost }))
        )

        // Update inventory for each PO item — average cost recalculated.
        // Phase 61 — a service line (productId null) has no stock to
        // receive, same reasoning as GRN's own receiving logic.
        for (const item of productLines) {
          const effectiveUnitCost = item.unitCost + (landedCostPerUnit.get(item.productId) ?? 0)
          // Phase 64 — the ProductCostHistory row ("from where the goods are
          // being bought, at what price," same raw material bill.service.ts's
          // createBill writes for a billed product line) is now written by
          // addStockTx itself via the costHistory param, the single place
          // both it and Inventory.averageCost update together.
          await inventoryService.addStockTx(
            tx,
            item.productId,
            item.quantity,
            effectiveUnitCost,
            `Received from PO ${po.poNumber}`,
            'PURCHASE_ORDER',
            po.id,
            userId,
            { sourceType: 'PURCHASE_ORDER', sourceId: po.id }
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
        await assertNotLockedOrThrow(tx, po.orderDate)
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
