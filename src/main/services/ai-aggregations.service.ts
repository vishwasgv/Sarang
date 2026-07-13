// Phase 57 — AI Assistant. Small aggregation functions the query template
// catalog needs (PHASE_57_TECHNICAL_SPEC.md Section 5) that don't correspond
// to an existing printable Reports-screen entry — kept out of
// report.service.ts deliberately, to avoid growing that file with functions
// that have no report UI of their own. Follows report.service.ts's own
// established "call getPrisma(), aggregate in JS" style, including its
// RETURN-invoice sign-correction convention (see getTopProducts in
// analytics.service.ts, replicated here — a RETURN invoice item stores
// quantity as POSITIVE, only lineTotal is signed negative).
import { getPrisma } from '../database/db'

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

export interface DeadStockItem { productName: string; sku: string | null; currentStock: number; lastSoldDate: string | null }
export async function getDeadStock(days = 90): Promise<DeadStockItem[]> {
  const db = getPrisma()
  const cutoff = daysAgo(days)

  const products = await db.product.findMany({
    where: { isActive: true },
    select: {
      productName: true, sku: true,
      inventory: { select: { quantity: true } },
      invoiceItems: {
        where: { invoice: { status: 'ACTIVE' } },
        orderBy: { invoice: { invoiceDate: 'desc' } },
        take: 1,
        select: { invoice: { select: { invoiceDate: true } } }
      }
    }
  })

  return products
    .filter((p) => (p.inventory?.quantity ?? 0) > 0)
    .map((p) => ({
      productName: p.productName,
      sku: p.sku,
      currentStock: p.inventory?.quantity ?? 0,
      lastSoldDate: p.invoiceItems[0]?.invoice.invoiceDate.toISOString().slice(0, 10) ?? null
    }))
    .filter((p) => !p.lastSoldDate || new Date(p.lastSoldDate) < cutoff)
    .sort((a, b) => (a.lastSoldDate ?? '').localeCompare(b.lastSoldDate ?? ''))
}

export interface RevenueProduct { productName: string; sku: string | null; quantitySold: number; revenue: number }
export async function getBottomRevenueProducts(limit = 10, dateFrom?: string, dateTo?: string): Promise<RevenueProduct[]> {
  const db = getPrisma()
  const items = await db.invoiceItem.findMany({
    where: {
      invoice: {
        status: 'ACTIVE',
        ...(dateFrom || dateTo ? { invoiceDate: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59') } : {}) } } : {})
      }
    },
    select: { productId: true, quantity: true, lineTotal: true, invoice: { select: { invoiceType: true } }, product: { select: { productName: true, sku: true } } }
  })

  const map = new Map<string, RevenueProduct>()
  for (const item of items) {
    const existing = map.get(item.productId) ?? { productName: item.product.productName, sku: item.product.sku, quantitySold: 0, revenue: 0 }
    const sign = item.invoice.invoiceType === 'RETURN' ? -1 : 1
    existing.quantitySold += sign * item.quantity
    existing.revenue += item.lineTotal
    map.set(item.productId, existing)
  }

  // Only products that have actually sold something in the period — a
  // never-sold product is inventory.deadStock's question, not "lowest
  // revenue," and would otherwise flood this list with meaningless zeros.
  return Array.from(map.values())
    .filter((p) => p.quantitySold > 0)
    .sort((a, b) => a.revenue - b.revenue)
    .slice(0, limit)
    .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))
}

export interface TopCustomer { customerName: string; phone: string | null; invoiceCount: number; revenue: number }
export async function getTopCustomersByRevenue(limit = 10, dateFrom?: string, dateTo?: string): Promise<TopCustomer[]> {
  const db = getPrisma()
  const invoices = await db.invoice.findMany({
    where: {
      status: 'ACTIVE',
      customerId: { not: null },
      ...(dateFrom || dateTo ? { invoiceDate: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59') } : {}) } } : {})
    },
    select: { customerId: true, totalAmount: true, invoiceType: true, customer: { select: { customerName: true, phone: true } } }
  })

  const map = new Map<string, TopCustomer>()
  for (const inv of invoices) {
    if (!inv.customerId || !inv.customer) continue
    const existing = map.get(inv.customerId) ?? { customerName: inv.customer.customerName, phone: inv.customer.phone, invoiceCount: 0, revenue: 0 }
    const sign = inv.invoiceType === 'RETURN' ? -1 : 1
    existing.revenue += sign * inv.totalAmount
    if (inv.invoiceType !== 'RETURN') existing.invoiceCount += 1
    map.set(inv.customerId, existing)
  }

  return Array.from(map.values())
    .filter((c) => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((c) => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 }))
}

export interface InactiveCustomer { customerName: string; phone: string | null; lastPurchaseDate: string | null }
export async function getCustomersWithNoRecentPurchases(days = 90): Promise<InactiveCustomer[]> {
  const db = getPrisma()
  const cutoff = daysAgo(days)

  const customers = await db.customer.findMany({
    where: { isActive: true },
    select: {
      customerName: true, phone: true,
      invoices: { where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' } }, orderBy: { invoiceDate: 'desc' }, take: 1, select: { invoiceDate: true } }
    }
  })

  return customers
    .map((c) => ({ customerName: c.customerName, phone: c.phone, lastPurchaseDate: c.invoices[0]?.invoiceDate.toISOString().slice(0, 10) ?? null }))
    // Only customers with at least one prior purchase — someone who's never
    // bought anything is a different question (a lead, not a lapsed
    // customer), and would otherwise dominate this list meaninglessly.
    .filter((c) => c.lastPurchaseDate && new Date(c.lastPurchaseDate) < cutoff)
    .sort((a, b) => (a.lastPurchaseDate ?? '').localeCompare(b.lastPurchaseDate ?? ''))
}

export interface TopSupplier { supplierName: string; phone: string | null; poCount: number; totalPurchaseValue: number }
export async function getTopSuppliersByPurchaseVolume(limit = 10): Promise<TopSupplier[]> {
  const db = getPrisma()
  const orders = await db.purchaseOrder.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: { supplierId: true, totalAmount: true, supplier: { select: { supplierName: true, phone: true } } }
  })

  const map = new Map<string, TopSupplier>()
  for (const po of orders) {
    const existing = map.get(po.supplierId) ?? { supplierName: po.supplier.supplierName, phone: po.supplier.phone, poCount: 0, totalPurchaseValue: 0 }
    existing.poCount += 1
    existing.totalPurchaseValue += po.totalAmount
    map.set(po.supplierId, existing)
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalPurchaseValue - a.totalPurchaseValue)
    .slice(0, limit)
    .map((s) => ({ ...s, totalPurchaseValue: Math.round(s.totalPurchaseValue * 100) / 100 }))
}
