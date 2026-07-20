import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { billingService } from './billing.service'
import { createKOT } from './restaurant.service'
import { generateUpiQr, canShowUpiQr } from './print.service'

// Phase 47 — QR table ordering. A customer's submission (createOrderRequest)
// is called from the local LAN HTTP server (qr-order-server.ts), never from
// the authenticated IPC bridge, and only ever creates a PENDING
// TableOrderRequest — it can never touch Invoice/KOT/inventory on its own.
// Staff must explicitly call acceptOrderRequest (IPC, permissioned) to turn
// it into a real invoice, reusing billingService.createInvoice + the
// existing createKOT exactly as the manual staff-driven flow already does.

const MAX_ITEMS_PER_ORDER = 30
const MAX_QUANTITY_PER_ITEM = 50

export interface MenuProduct {
  id: string
  productName: string
  sellingPrice: number
  imagePath: string | null
  categoryName: string | null
}

export async function getBusinessDisplayInfo(): Promise<{ businessName: string; currencySymbol: string }> {
  const db = getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { businessName: true, currencySymbol: true } })
  return { businessName: profile?.businessName ?? 'Restaurant', currencySymbol: profile?.currencySymbol ?? '₹' }
}

export async function listMenuProducts(): Promise<MenuProduct[]> {
  const db = getPrisma()
  const products = await db.product.findMany({
    // Phase 58 §2 — a "86'd" item (unavailableUntil in the future) must
    // never appear on the customer-facing QR menu, same as isActive:false —
    // a customer scanning the table QR shouldn't be able to order something
    // the kitchen has explicitly marked out for today.
    where: { isActive: true, OR: [{ unavailableUntil: null }, { unavailableUntil: { lte: new Date() } }] },
    select: {
      id: true, productName: true, sellingPrice: true, imagePath: true,
      category: { select: { name: true } }
    },
    orderBy: { productName: 'asc' }
  })
  // Never expose costPrice, sku, hsnCode, or any other internal field to the
  // customer-facing surface — select only what a printed menu would show.
  return products.map(p => ({
    id: p.id, productName: p.productName, sellingPrice: p.sellingPrice,
    imagePath: p.imagePath, categoryName: p.category?.name ?? null
  }))
}

export interface CreateOrderRequestResult {
  success: boolean
  error?: { code: string; message: string }
  data?: { amount: number; upiQrDataUrl?: string }
}

export async function createOrderRequest(
  tableId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<CreateOrderRequestResult> {
  try {
    const db = getPrisma()

    if (!tableId) return { success: false, error: { code: 'QRO-001', message: 'Table not found.' } }
    const table = await db.restaurantTable.findUnique({ where: { id: tableId } })
    if (!table) return { success: false, error: { code: 'QRO-001', message: 'Table not found.' } }

    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: { code: 'QRO-002', message: 'Your order is empty.' } }
    }
    if (items.length > MAX_ITEMS_PER_ORDER) {
      return { success: false, error: { code: 'QRO-003', message: 'Too many items in one order.' } }
    }
    for (const item of items) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > MAX_QUANTITY_PER_ITEM) {
        return { success: false, error: { code: 'QRO-004', message: 'Invalid item in order.' } }
      }
    }

    // Re-validate every productId exists and is active — never trust the
    // client beyond productId + quantity; price is never accepted from the
    // request at all. The amount used for the optional "pay now via UPI" QR
    // below is computed here from these server-fetched prices, same as
    // acceptOrderRequest does at accept time — never from anything the
    // client sent.
    const productIds = items.map(i => i.productId)
    const validProducts = await db.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, sellingPrice: true }
    })
    const priceById = new Map(validProducts.map(p => [p.id, p.sellingPrice]))
    if (items.some(i => !priceById.has(i.productId))) {
      return { success: false, error: { code: 'QRO-005', message: 'One or more items are no longer available.' } }
    }
    const amount = items.reduce((sum, i) => sum + (priceById.get(i.productId) ?? 0) * i.quantity, 0)

    await db.tableOrderRequest.create({
      data: {
        tableId,
        status: 'PENDING',
        items: { create: items.map(i => ({ productId: i.productId, quantity: i.quantity })) }
      }
    })

    // UPI QR is a pure convenience for the customer to pay immediately from
    // their own phone — Sarang never verifies the payment landed (no gateway
    // integration, matching the project's "UPI QR display only" rule already
    // used for printed invoices/receipts); staff still independently picks
    // the actual received payment method when accepting the order.
    // canShowUpiQr() (shared with print.service.ts's invoice/receipt QR)
    // gates on country, not just whether upiId happens to be filled in — UPI
    // is exclusively an Indian payment system.
    let upiQrDataUrl: string | undefined
    const profile = await db.businessProfile.findFirst({ select: { businessName: true, upiId: true, country: true } })
    if (canShowUpiQr(profile) && amount > 0.01) {
      try {
        const tableLabel = table.tableName || table.tableNumber
        upiQrDataUrl = await generateUpiQr(profile!.upiId!, profile!.businessName, amount, `Table ${tableLabel} Order`)
      } catch {
        // A UPI QR failure must never block the order itself going through —
        // the order is already saved above; payment is always optional.
      }
    }

    return { success: true, data: { amount, upiQrDataUrl } }
  } catch (err) {
    return { success: false, error: { code: 'QRO-006', message: err instanceof Error ? err.message : 'Could not submit order.' } }
  }
}

export async function listOrderRequests(status?: string) {
  try {
    const db = getPrisma()
    const requests = await db.tableOrderRequest.findMany({
      where: status ? { status } : {},
      include: {
        table: { select: { tableNumber: true, tableName: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    })
    // Attach product names for display without a schema relation on the item
    const productIds = [...new Set(requests.flatMap(r => r.items.map(i => i.productId)))]
    const products = await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, productName: true, sellingPrice: true } })
    const byId = new Map(products.map(p => [p.id, p]))
    const withNames = requests.map(r => ({
      ...r,
      items: r.items.map(i => ({ ...i, productName: byId.get(i.productId)?.productName ?? '(deleted product)', currentPrice: byId.get(i.productId)?.sellingPrice ?? 0 }))
    }))
    return { success: true, data: withNames }
  } catch (err) {
    return { success: false, error: { code: 'QRO-010', message: err instanceof Error ? err.message : 'Could not list order requests.' } }
  }
}

export async function acceptOrderRequest(
  requestId: string,
  payload: { paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'WALLET' | 'CREDIT' | 'SPLIT'; customerId?: string },
  userId?: string
) {
  try {
    const db = getPrisma()
    const request = await db.tableOrderRequest.findUnique({ where: { id: requestId }, include: { items: true } })
    if (!request) return { success: false, error: { code: 'QRO-020', message: 'Order request not found.' } }
    if (request.status !== 'PENDING') return { success: false, error: { code: 'QRO-021', message: `This order was already ${request.status.toLowerCase()}.` } }

    // Price is always looked up fresh here, server-side — never taken from
    // the customer's original submission, matching the design in the spec.
    const products = await db.product.findMany({
      where: { id: { in: request.items.map(i => i.productId) } },
      select: { id: true, sellingPrice: true, taxRate: true, isActive: true }
    })
    const byId = new Map(products.map(p => [p.id, p]))
    const missing = request.items.filter(i => !byId.get(i.productId)?.isActive)
    if (missing.length > 0) {
      return { success: false, error: { code: 'QRO-022', message: 'One or more items in this order are no longer available — reject it and ask the customer to reorder.' } }
    }

    const invoiceResult = await billingService.createInvoice({
      customerId: payload.customerId,
      paymentMethod: payload.paymentMethod,
      items: request.items.map(i => {
        const p = byId.get(i.productId)!
        return { productId: i.productId, quantity: i.quantity, unitPrice: p.sellingPrice, discountAmount: 0, taxRate: p.taxRate }
      }),
      globalDiscount: 0,
      referenceNumber: `QR-${request.tableId.slice(-6)}`
    }, userId)

    if (!invoiceResult.success || !invoiceResult.data) {
      return { success: false, error: (invoiceResult as { error?: { code: string; message: string } }).error ?? { code: 'QRO-023', message: 'Could not create invoice from this order.' } }
    }
    const invoice = invoiceResult.data as { id: string }

    await createKOT(invoice.id, request.tableId, userId)

    await db.tableOrderRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED', invoiceId: invoice.id, resolvedAt: new Date() }
    })
    await logAction(userId, 'QR_ORDER_ACCEPTED', 'TableOrderRequest', requestId, undefined, invoice.id)
    return { success: true, data: { invoiceId: invoice.id } }
  } catch (err) {
    return { success: false, error: { code: 'QRO-024', message: err instanceof Error ? err.message : 'Could not accept order.' } }
  }
}

export async function rejectOrderRequest(requestId: string, userId?: string) {
  try {
    const db = getPrisma()
    const request = await db.tableOrderRequest.findUnique({ where: { id: requestId } })
    if (!request) return { success: false, error: { code: 'QRO-030', message: 'Order request not found.' } }
    if (request.status !== 'PENDING') return { success: false, error: { code: 'QRO-031', message: `This order was already ${request.status.toLowerCase()}.` } }

    await db.tableOrderRequest.update({ where: { id: requestId }, data: { status: 'REJECTED', resolvedAt: new Date() } })
    await logAction(userId, 'QR_ORDER_REJECTED', 'TableOrderRequest', requestId)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'QRO-032', message: err instanceof Error ? err.message : 'Could not reject order.' } }
  }
}
