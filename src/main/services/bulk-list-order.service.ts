import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { billingService } from './billing.service'

// Stationery vertical — a bulk/institutional order matched against a named
// supply list (school booklist, office order), then billed in one shot once
// every line has a matched product + price. A staging area, not itself a
// sale — DRAFT -> BILLED, same claim-sentinel-free "invoiceId null until set"
// shape as JobSiteAccount's sibling models, but billing is gated on every
// item being matched first rather than an atomic claim (there's no
// concurrent-write race here — matching happens one line at a time by a
// single operator before the one-shot bill step).

const BULK_LIST_ORDER_INVOICE_CLAIM_SENTINEL = 'CLAIMING'

export async function createBulkListOrder(payload: {
  customerId?: string
  customerName?: string
  listName: string
  notes?: string
  createdById?: string
  items: Array<{ itemLabel: string; requestedQty: number; productId?: string; unitPrice?: number }>
}) {
  try {
    if (!payload.listName.trim()) {
      return { success: false, error: { code: 'BLO-001', message: 'List name is required.' } }
    }
    if (!payload.customerId && !payload.customerName?.trim()) {
      return { success: false, error: { code: 'BLO-002', message: 'A customer or an institution name is required.' } }
    }
    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: { code: 'BLO-003', message: 'At least one supply-list line is required.' } }
    }

    const db = getPrisma()
    const order = await db.$transaction(async (tx) => {
      const orderNumber = await generateSequenceNumber(
        tx, 'bulk_list_order_number_sequence', 'BLO', 5,
        async () => {
          const last = await tx.bulkListOrder.findFirst({ orderBy: { createdAt: 'desc' }, select: { orderNumber: true } })
          return last ? parseInt(last.orderNumber.replace('BLO-', ''), 10) : 0
        }
      )
      return tx.bulkListOrder.create({
        data: {
          orderNumber,
          customerId: payload.customerId ?? null,
          customerName: payload.customerName ?? null,
          listName: payload.listName.trim(),
          notes: payload.notes ?? null,
          createdById: payload.createdById ?? null,
          items: {
            create: payload.items.map(i => ({
              itemLabel: i.itemLabel,
              requestedQty: i.requestedQty,
              productId: i.productId ?? null,
              unitPrice: i.unitPrice ?? null,
            })),
          },
        },
        include: { items: { include: { product: { select: { id: true, productName: true } } } }, customer: { select: { id: true, customerName: true, phone: true } } },
      })
    })

    await logAction({ userId: payload.createdById, action: 'BULK_LIST_ORDER_CREATED', entityType: 'BulkListOrder', entityId: order.id, newValue: { orderNumber: order.orderNumber } })
    return { success: true, data: order }
  } catch (err) {
    return { success: false, error: { code: 'BLO-004', message: err instanceof Error ? err.message : 'Could not create bulk-list order.' } }
  }
}

export async function listBulkListOrders(filters?: { customerId?: string; status?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.status) where.status = filters.status
    const orders = await db.bulkListOrder.findMany({
      where,
      include: { items: { include: { product: { select: { id: true, productName: true } } } }, customer: { select: { id: true, customerName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: orders }
  } catch (err) {
    return { success: false, error: { code: 'BLO-005', message: err instanceof Error ? err.message : 'Could not list bulk-list orders.' } }
  }
}

export async function matchBulkListOrderItem(itemId: string, productId: string, unitPrice: number) {
  try {
    if (unitPrice < 0) return { success: false, error: { code: 'BLO-006', message: 'Unit price cannot be negative.' } }
    const db = getPrisma()
    const item = await db.bulkListOrderItem.findUnique({ where: { id: itemId }, include: { bulkListOrder: true } })
    if (!item) return { success: false, error: { code: 'BLO-007', message: 'Order line not found.' } }
    if (item.bulkListOrder.status !== 'DRAFT') return { success: false, error: { code: 'BLO-008', message: 'This order has already been billed or cancelled.' } }
    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) return { success: false, error: { code: 'BLO-009', message: 'Product not found.' } }
    const updated = await db.bulkListOrderItem.update({ where: { id: itemId }, data: { productId, unitPrice } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'BLO-010', message: err instanceof Error ? err.message : 'Could not match order line.' } }
  }
}

export async function deleteBulkListOrder(id: string) {
  try {
    const db = getPrisma()
    const existing = await db.bulkListOrder.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'BLO-011', message: 'Order not found.' } }
    if (existing.status === 'BILLED') return { success: false, error: { code: 'BLO-012', message: 'Cannot delete an order that has already been billed.' } }
    // billBulkListOrder's own claim step sets invoiceId to a sentinel WHILE
    // status is still 'DRAFT' (status only flips to 'BILLED' at the very
    // end) — checking status alone above leaves a window where a concurrent
    // delete can race an in-flight bill. A conditional deleteMany on
    // invoiceId:null closes it atomically: either this delete wins before
    // any claim, or a claim already in flight/done makes this a genuine 0-row
    // no-op instead of silently deleting a row mid-billing.
    const claim = await db.bulkListOrder.deleteMany({ where: { id, invoiceId: null } })
    if (claim.count === 0) {
      return { success: false, error: { code: 'BLO-012', message: 'This order is being billed right now and can no longer be deleted.' } }
    }
    await logAction({ action: 'BULK_LIST_ORDER_DELETED', entityType: 'BulkListOrder', entityId: id })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'BLO-013', message: err instanceof Error ? err.message : 'Could not delete order.' } }
  }
}

// Bills every matched line in one shot. Same atomic claim-sentinel +
// billingService.createInvoice() pattern as hotel/furniture-booking's
// invoice generation.
// Stationery wow feature — Annual Reorder Reminder for Institutional
// Clients. Institutions (schools, offices) reorder on a roughly annual
// cycle; flags whoever's last BILLED order is old enough that they're
// likely due again, so the shop can proactively reach out rather than
// waiting for the client to remember. Thresholds are a shop-year cycle:
// 10-14 months = due soon, >14 months = overdue.
export interface ReorderReminderRow {
  customerId: string | null; institutionName: string
  lastOrderId: string; lastOrderNumber: string; lastOrderDate: string
  monthsSinceLastOrder: number; status: 'DUE_SOON' | 'OVERDUE'
}

export async function getAnnualReorderReminders() {
  try {
    const db = getPrisma()
    const orders = await db.bulkListOrder.findMany({
      where: { status: 'BILLED' },
      include: { customer: { select: { customerName: true } } },
      orderBy: { createdAt: 'desc' }
    })

    const latestByInstitution = new Map<string, typeof orders[number]>()
    for (const o of orders) {
      const key = o.customerId ?? `name:${o.customerName ?? o.id}`
      if (!latestByInstitution.has(key)) latestByInstitution.set(key, o)
    }

    const now = Date.now()
    const rows: ReorderReminderRow[] = Array.from(latestByInstitution.values())
      .map(o => {
        const monthsSinceLastOrder = Math.round(((now - o.createdAt.getTime()) / (30 * 86400000)) * 10) / 10
        return {
          customerId: o.customerId, institutionName: o.customer?.customerName ?? o.customerName ?? 'Walk-in',
          lastOrderId: o.id, lastOrderNumber: o.orderNumber, lastOrderDate: o.createdAt.toISOString(),
          monthsSinceLastOrder,
          status: (monthsSinceLastOrder > 14 ? 'OVERDUE' : 'DUE_SOON') as 'DUE_SOON' | 'OVERDUE'
        }
      })
      .filter(r => r.monthsSinceLastOrder >= 10)
      .sort((a, b) => b.monthsSinceLastOrder - a.monthsSinceLastOrder)

    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: { code: 'BLO-019', message: err instanceof Error ? err.message : 'Could not compute reorder reminders.' } }
  }
}

export async function billBulkListOrder(orderId: string, paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'WALLET' | 'CREDIT' | 'SPLIT', userId?: string): Promise<{ success: boolean; data?: { invoiceId: string }; error?: { code: string; message: string } }> {
  const db = getPrisma()
  try {
    const claim = await db.bulkListOrder.updateMany({ where: { id: orderId, invoiceId: null, status: 'DRAFT' }, data: { invoiceId: BULK_LIST_ORDER_INVOICE_CLAIM_SENTINEL } })
    if (claim.count === 0) {
      const existing = await db.bulkListOrder.findUnique({ where: { id: orderId }, select: { id: true, invoiceId: true, status: true } })
      if (!existing) return { success: false, error: { code: 'BLO-011', message: 'Order not found.' } }
      if (existing.invoiceId === BULK_LIST_ORDER_INVOICE_CLAIM_SENTINEL) return { success: false, error: { code: 'BLO-014', message: 'Billing already in progress for this order.' } }
      return { success: false, error: { code: 'BLO-015', message: 'This order has already been billed or cancelled.' } }
    }

    try {
      const order = await db.bulkListOrder.findUnique({ where: { id: orderId }, include: { items: true } })
      if (!order) {
        await db.bulkListOrder.update({ where: { id: orderId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'BLO-011', message: 'Order not found.' } }
      }
      const unmatched = order.items.filter(i => !i.productId || i.unitPrice == null)
      if (unmatched.length > 0) {
        await db.bulkListOrder.update({ where: { id: orderId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'BLO-016', message: `${unmatched.length} line(s) still need to be matched to a product before billing.` } }
      }
      // Only CREDIT actually needs a real Customer record — same rule
      // billingService.createInvoice itself enforces (a CASH/UPI/CARD/
      // WALLET sale never required one). The old unconditional check here
      // was stricter than the underlying engine and left a free-text
      // "institution name only" order (the natural first-time-buyer path)
      // permanently unbillable even for cash.
      if (paymentMethod === 'CREDIT' && !order.customerId) {
        await db.bulkListOrder.update({ where: { id: orderId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'BLO-017', message: 'A Credit sale needs a real customer record — pick one, or bill this order as Cash/UPI/Card/Wallet instead.' } }
      }

      const invoiceItems = order.items.map(i => ({ productId: i.productId as string, quantity: i.requestedQty, unitPrice: i.unitPrice as number }))
      const result = await billingService.createInvoice({
        customerId: order.customerId ?? undefined,
        paymentMethod,
        items: invoiceItems,
        notes: `Bulk-list order ${order.orderNumber} — ${order.listName}`,
        referenceNumber: order.orderNumber,
      })
      if (!result.success) {
        await db.bulkListOrder.update({ where: { id: orderId }, data: { invoiceId: null } })
        return result as { success: false; error: { code: string; message: string } }
      }

      const invoice = result.data as { id: string }
      await db.bulkListOrder.update({ where: { id: orderId }, data: { invoiceId: invoice.id, status: 'BILLED' } })
      await logAction({ userId, action: 'BULK_LIST_ORDER_BILLED', entityType: 'BulkListOrder', entityId: orderId, newValue: { invoiceId: invoice.id } })
      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.bulkListOrder.update({ where: { id: orderId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (e) {
    return { success: false, error: { code: 'BLO-018', message: e instanceof Error ? e.message : 'Could not bill order.' } }
  }
}
