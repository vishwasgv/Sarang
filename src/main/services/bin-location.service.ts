import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'

// Which shelf, rack or bin an item sits on inside a location. A label only; stock is still counted per location.

export interface BinRow {
  productId: string
  productName: string
  sku: string | null
  quantity: number
  binCode: string
}

function fail(err: unknown) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
}

export const binLocationService = {
  /** Items held at a location (stock or a bin label), with their bin. */
  async listForLocation(locationId: string, search?: string) {
    try {
      const db = getPrisma()
      const location = await db.location.findUnique({ where: { id: locationId }, select: { id: true } })
      if (!location) throw new ServiceError('BIN-001', 'Location not found.')
      const [stock, bins] = await Promise.all([
        db.locationStock.findMany({ where: { locationId, quantity: { not: 0 } }, select: { productId: true, quantity: true } }),
        db.productBin.findMany({ where: { locationId }, select: { productId: true, binCode: true } })
      ])
      const binOf = new Map(bins.map((b) => [b.productId, b.binCode]))
      const qtyOf = new Map(stock.map((s) => [s.productId, s.quantity]))
      const ids = Array.from(new Set([...qtyOf.keys(), ...binOf.keys()]))
      const q = search?.trim()
      const products = await db.product.findMany({
        where: { id: { in: ids }, isActive: true, ...(q ? { OR: [{ productName: { contains: q } }, { sku: { contains: q } }] } : {}) },
        select: { id: true, productName: true, sku: true },
        orderBy: { productName: 'asc' }
      })
      const rows: BinRow[] = products.map((p) => ({ productId: p.id, productName: p.productName, sku: p.sku ?? null, quantity: qtyOf.get(p.id) ?? 0, binCode: binOf.get(p.id) ?? '' }))
      return { success: true, data: rows }
    } catch (err) {
      return fail(err)
    }
  },

  /** Sets or clears (empty text) the bin of one item at a location. */
  async setBin(p: { productId: string; locationId: string; binCode: string }, userId?: string) {
    try {
      const db = getPrisma()
      const binCode = p.binCode.trim()
      const [product, location] = await Promise.all([
        db.product.findUnique({ where: { id: p.productId }, select: { id: true } }),
        db.location.findUnique({ where: { id: p.locationId }, select: { id: true } })
      ])
      if (!product) throw new ServiceError('BIN-002', 'Item not found.')
      if (!location) throw new ServiceError('BIN-001', 'Location not found.')
      if (binCode === '') {
        await db.productBin.deleteMany({ where: { productId: p.productId, locationId: p.locationId } })
      } else {
        await db.productBin.upsert({
          where: { productId_locationId: { productId: p.productId, locationId: p.locationId } },
          create: { productId: p.productId, locationId: p.locationId, binCode },
          update: { binCode }
        })
      }
      await logAction({ userId, action: 'BIN_SET', entityType: 'Product', entityId: p.productId, newValue: { locationId: p.locationId, binCode } })
      return { success: true }
    } catch (err) {
      return fail(err)
    }
  },

  /** Bin label per item at every location, for reports and pick lists. */
  async binsByProduct(productIds: string[]): Promise<Map<string, string[]>> {
    const rows = await getPrisma().productBin.findMany({ where: { productId: { in: productIds } }, select: { productId: true, binCode: true, locationId: true } })
    const out = new Map<string, string[]>()
    for (const r of rows) out.set(r.productId, [...(out.get(r.productId) ?? []), r.binCode])
    return out
  }
}
