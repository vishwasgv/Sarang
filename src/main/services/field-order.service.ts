import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { billingService } from './billing.service'
import { resolveCustomerPrice } from './product.service'

// Phase 58 §2 — Distributor field-rep order capture. Structural mirror of
// restaurant-order.service.ts's TableOrderRequest flow: a rep away from the
// billing counter submits (createFieldOrderRequest) via the local LAN HTTP
// server (field-order-server.ts), never the authenticated IPC bridge, and
// this only ever creates a PENDING FieldOrderRequest — it can never touch
// Invoice/inventory/credit-limit on its own. Office staff must explicitly
// call acceptFieldOrderRequest (IPC, permissioned) to turn it into a real
// invoice, re-resolving price (via resolveCustomerPrice, honoring the
// customer's negotiated class price if any) and running the exact same
// billingService.createInvoice path used everywhere else — the credit-limit
// check happens exactly once, inside that call, never duplicated here.

const MAX_ITEMS_PER_ORDER = 60
const MAX_QUANTITY_PER_ITEM = 10_000

export interface FieldOrderCatalogProduct {
  id: string
  productName: string
  price: number
  imagePath: string | null
  categoryName: string | null
}

export async function getBusinessDisplayInfo(): Promise<{ businessName: string; currencySymbol: string }> {
  const db = getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { businessName: true, currencySymbol: true } })
  return { businessName: profile?.businessName ?? 'Business', currencySymbol: profile?.currencySymbol ?? '₹' }
}

export async function listCustomersForFieldOrder(): Promise<Array<{ id: string; customerName: string; phone: string | null }>> {
  const db = getPrisma()
  return db.customer.findMany({
    where: { isActive: true },
    select: { id: true, customerName: true, phone: true },
    orderBy: { customerName: 'asc' }
  })
}

export async function listFieldOrderCatalog(customerId?: string): Promise<FieldOrderCatalogProduct[]> {
  const db = getPrisma()
  const products = await db.product.findMany({
    where: { isActive: true },
    select: { id: true, productName: true, sellingPrice: true, imagePath: true, category: { select: { name: true } } },
    orderBy: { productName: 'asc' }
  })
  // Show the rep the customer's actual negotiated price up front, not the
  // list price — never a financial decision (accept-time re-resolves it
  // fresh regardless), purely so the rep isn't quoting a stale number.
  const resolved = await Promise.all(products.map(async (p) => ({
    id: p.id, productName: p.productName,
    price: customerId ? await resolveCustomerPrice(p.id, customerId) : p.sellingPrice,
    imagePath: p.imagePath, categoryName: p.category?.name ?? null
  })))
  return resolved
}

export interface CreateFieldOrderRequestResult {
  success: boolean
  error?: { code: string; message: string }
  data?: { amount: number }
}

export async function createFieldOrderRequest(
  repName: string,
  customerId: string | undefined,
  customerName: string | undefined,
  items: Array<{ productId: string; quantity: number }>,
  notes?: string
): Promise<CreateFieldOrderRequestResult> {
  try {
    const db = getPrisma()

    if (!repName?.trim()) return { success: false, error: { code: 'FOR-001', message: 'Rep name is required.' } }
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: { code: 'FOR-002', message: 'Order is empty.' } }
    }
    if (items.length > MAX_ITEMS_PER_ORDER) {
      return { success: false, error: { code: 'FOR-003', message: 'Too many items in one order.' } }
    }
    for (const item of items) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > MAX_QUANTITY_PER_ITEM) {
        return { success: false, error: { code: 'FOR-004', message: 'Invalid item in order.' } }
      }
    }

    let resolvedCustomerId: string | undefined
    if (customerId) {
      const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } })
      if (!customer) return { success: false, error: { code: 'FOR-005', message: 'Customer not found.' } }
      resolvedCustomerId = customer.id
    }

    // Re-validate every productId exists and is active — never trust the
    // client beyond productId + quantity; price is never accepted from the
    // request at all (same principle as createOrderRequest).
    const productIds = items.map(i => i.productId)
    const validProducts = await db.product.findMany({ where: { id: { in: productIds }, isActive: true }, select: { id: true, sellingPrice: true } })
    const priceById = new Map(validProducts.map(p => [p.id, p.sellingPrice]))
    if (items.some(i => !priceById.has(i.productId))) {
      return { success: false, error: { code: 'FOR-006', message: 'One or more items are no longer available.' } }
    }

    // amount shown to the rep is an estimate at list/class price — informational
    // only, never what accept-time actually bills.
    const itemPrices = await Promise.all(items.map(i =>
      resolvedCustomerId ? resolveCustomerPrice(i.productId, resolvedCustomerId) : Promise.resolve(priceById.get(i.productId) ?? 0)
    ))
    const amount = items.reduce((sum, i, idx) => sum + itemPrices[idx] * i.quantity, 0)

    await db.fieldOrderRequest.create({
      data: {
        repName: repName.trim(),
        customerId: resolvedCustomerId ?? null,
        customerName: customerName?.trim() || null,
        notes: notes?.trim() || null,
        status: 'PENDING',
        items: { create: items.map(i => ({ productId: i.productId, quantity: i.quantity })) }
      }
    })

    return { success: true, data: { amount } }
  } catch (err) {
    return { success: false, error: { code: 'FOR-007', message: err instanceof Error ? err.message : 'Could not submit order.' } }
  }
}

export async function listFieldOrderRequests(status?: string) {
  try {
    const db = getPrisma()
    const requests = await db.fieldOrderRequest.findMany({
      where: status ? { status } : {},
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    })
    const productIds = [...new Set(requests.flatMap(r => r.items.map(i => i.productId)))]
    const products = await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, productName: true, sellingPrice: true } })
    const byId = new Map(products.map(p => [p.id, p]))
    const withNames = requests.map(r => ({
      ...r,
      items: r.items.map(i => ({ ...i, productName: byId.get(i.productId)?.productName ?? '(deleted product)', currentPrice: byId.get(i.productId)?.sellingPrice ?? 0 }))
    }))
    return { success: true, data: withNames }
  } catch (err) {
    return { success: false, error: { code: 'FOR-010', message: err instanceof Error ? err.message : 'Could not list field order requests.' } }
  }
}

export async function acceptFieldOrderRequest(
  requestId: string,
  payload: { paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'WALLET' | 'CREDIT' | 'SPLIT' },
  userId?: string
) {
  try {
    const db = getPrisma()
    const request = await db.fieldOrderRequest.findUnique({ where: { id: requestId }, include: { items: true } })
    if (!request) return { success: false, error: { code: 'FOR-020', message: 'Order request not found.' } }
    if (request.status !== 'PENDING') return { success: false, error: { code: 'FOR-021', message: `This order was already ${request.status.toLowerCase()}.` } }

    // Price is always looked up fresh here, server-side — never taken from
    // the rep's original submission — honoring the customer's negotiated
    // class price via resolveCustomerPrice, same as every other add-to-cart
    // site in this vertical.
    const products = await db.product.findMany({
      where: { id: { in: request.items.map(i => i.productId) } },
      select: { id: true, taxRate: true, isActive: true }
    })
    const byId = new Map(products.map(p => [p.id, p]))
    const missing = request.items.filter(i => !byId.get(i.productId)?.isActive)
    if (missing.length > 0) {
      return { success: false, error: { code: 'FOR-022', message: 'One or more items in this order are no longer available — reject it and ask the rep to resubmit.' } }
    }

    const resolvedItems = await Promise.all(request.items.map(async (i) => {
      const p = byId.get(i.productId)!
      const unitPrice = await resolveCustomerPrice(i.productId, request.customerId)
      return { productId: i.productId, quantity: i.quantity, unitPrice, discountAmount: 0, taxRate: p.taxRate }
    }))

    const invoiceResult = await billingService.createInvoice({
      customerId: request.customerId ?? undefined,
      paymentMethod: payload.paymentMethod,
      items: resolvedItems,
      globalDiscount: 0,
      referenceNumber: `FLD-${request.repName.slice(0, 6)}`
    }, userId)

    if (!invoiceResult.success || !invoiceResult.data) {
      return { success: false, error: (invoiceResult as { error?: { code: string; message: string } }).error ?? { code: 'FOR-023', message: 'Could not create invoice from this order.' } }
    }
    const invoice = invoiceResult.data as { id: string }

    await db.fieldOrderRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED', invoiceId: invoice.id, resolvedAt: new Date() }
    })
    await logAction(userId, 'FIELD_ORDER_ACCEPTED', 'FieldOrderRequest', requestId, undefined, invoice.id)
    return { success: true, data: { invoiceId: invoice.id } }
  } catch (err) {
    return { success: false, error: { code: 'FOR-024', message: err instanceof Error ? err.message : 'Could not accept order.' } }
  }
}

export async function rejectFieldOrderRequest(requestId: string, userId?: string) {
  try {
    const db = getPrisma()
    const request = await db.fieldOrderRequest.findUnique({ where: { id: requestId } })
    if (!request) return { success: false, error: { code: 'FOR-030', message: 'Order request not found.' } }
    if (request.status !== 'PENDING') return { success: false, error: { code: 'FOR-031', message: `This order was already ${request.status.toLowerCase()}.` } }

    await db.fieldOrderRequest.update({ where: { id: requestId }, data: { status: 'REJECTED', resolvedAt: new Date() } })
    await logAction(userId, 'FIELD_ORDER_REJECTED', 'FieldOrderRequest', requestId)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'FOR-032', message: err instanceof Error ? err.message : 'Could not reject order.' } }
  }
}
