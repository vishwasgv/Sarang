import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import { ServiceError } from '../errors/service-error'
import type { CreatePriceListPayload, UpdatePriceListPayload, SetPriceListItemsPayload, ResolvePricePayload } from '../validation/price-list.validation'

// Formal Price Lists — additive alongside the existing, narrower
// CustomerClassPrice (Phase 58 §2: one flat price per product per
// Customer.customerClass string, no quantity tiers, no supplier side, no
// per-customer assignment). See resolvePrice's own comment for the full
// resolution order between the two.
export const priceListService = {
  async createPriceList(payload: CreatePriceListPayload, userId?: string) {
    try {
      const db = getPrisma()
      const priceList = await db.priceList.create({
        data: { name: payload.name, appliesTo: payload.appliesTo, currencyCode: payload.currencyCode ?? 'INR' }
      })
      await logAction({ userId, action: 'PRICE_LIST_CREATED', entityType: 'PriceList', entityId: priceList.id, newValue: { name: priceList.name, appliesTo: priceList.appliesTo } })
      return { success: true, data: priceList }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create price list.' } }
    }
  },

  async updatePriceList(payload: UpdatePriceListPayload, userId?: string) {
    try {
      const db = getPrisma()
      const existing = await db.priceList.findUnique({ where: { id: payload.id } })
      if (!existing) return { success: false, error: { code: 'PL-001', message: 'Price list not found.' } }
      const updated = await db.priceList.update({ where: { id: payload.id }, data: { name: payload.name, isActive: payload.isActive } })
      await logAction({ userId, action: 'PRICE_LIST_UPDATED', entityType: 'PriceList', entityId: payload.id, newValue: payload })
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to update price list.' } }
    }
  },

  async listPriceLists(filters?: { appliesTo?: string; isActive?: boolean }) {
    try {
      const db = getPrisma()
      const where: Record<string, unknown> = {}
      if (filters?.appliesTo) where.appliesTo = filters.appliesTo
      if (filters?.isActive !== undefined) where.isActive = filters.isActive
      const priceLists = await db.priceList.findMany({ where, orderBy: { name: 'asc' }, include: { _count: { select: { items: true } } } })
      return { success: true, data: priceLists }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list price lists.' } }
    }
  },

  async getPriceList(id: string) {
    try {
      const db = getPrisma()
      const priceList = await db.priceList.findUnique({
        where: { id },
        include: { items: { include: { product: { select: { id: true, productName: true, sku: true, unit: true } } }, orderBy: { minQuantity: 'asc' } } }
      })
      if (!priceList) return { success: false, error: { code: 'PL-001', message: 'Price list not found.' } }
      return { success: true, data: priceList }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to fetch price list.' } }
    }
  },

  // Bulk-replace convention (see validation schema's own comment) — atomic
  // delete-then-recreate inside one transaction, so a failed set never
  // leaves the price list with a half-updated tier table.
  async setPriceListItems(payload: SetPriceListItemsPayload, userId?: string) {
    const db = getPrisma()
    try {
      const priceList = await db.$transaction(async (tx) => {
        const existing = await tx.priceList.findUnique({ where: { id: payload.priceListId } })
        if (!existing) throw new ServiceError('PL-001', 'Price list not found.')

        for (const item of payload.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } })
          if (!product) throw new ServiceError('PRD-001', 'Product not found.')
        }

        await tx.priceListItem.deleteMany({ where: { priceListId: payload.priceListId } })
        await tx.priceListItem.createMany({
          data: payload.items.map(item => ({
            priceListId: payload.priceListId,
            productId: item.productId,
            minQuantity: item.minQuantity,
            unitPrice: item.unitPrice
          }))
        })

        return tx.priceList.findUnique({
          where: { id: payload.priceListId },
          include: { items: { include: { product: { select: { id: true, productName: true, sku: true } } }, orderBy: { minQuantity: 'asc' } } }
        })
      })

      await logAction({ userId, action: 'PRICE_LIST_ITEMS_SET', entityType: 'PriceList', entityId: payload.priceListId, newValue: { itemCount: payload.items.length } })
      return { success: true, data: priceList }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  },

  // The one function every billing/purchasing entry point actually calls.
  // Most-specific-wins, three tiers: (1) the counterparty's own assigned
  // PriceList, best-matching minQuantity ≤ the entered quantity; (2) for a
  // customer only, the pre-existing CustomerClassPrice for their
  // customerClass (kept exactly as-is, never migrated); (3) the plain
  // default — Product.sellingPrice for a sale, Product.costPrice for a
  // purchase, matching what the app already does today with no Price List
  // in the picture at all.
  async resolvePrice(payload: ResolvePricePayload) {
    try {
      const db = getPrisma()
      const product = await db.product.findUnique({ where: { id: payload.productId }, select: { sellingPrice: true, costPrice: true } })
      if (!product) return { success: false, error: { code: 'PRD-001', message: 'Product not found.' } }
      const defaultPrice = payload.for === 'CUSTOMER' ? product.sellingPrice : product.costPrice

      if (payload.for === 'CUSTOMER') {
        const customer = await db.customer.findUnique({ where: { id: payload.counterpartyId }, select: { priceListId: true, customerClass: true } })
        if (!customer) return { success: false, error: { code: 'CUST-001', message: 'Customer not found.' } }

        if (customer.priceListId) {
          const tiers = await db.priceListItem.findMany({ where: { priceListId: customer.priceListId, productId: payload.productId } })
          const best = tiers.filter(t => t.minQuantity <= payload.quantity).sort((a, b) => b.minQuantity - a.minQuantity)[0]
          if (best) return { success: true, data: { unitPrice: best.unitPrice, source: 'PRICE_LIST' as const } }
        }

        if (customer.customerClass) {
          const classPrice = await db.customerClassPrice.findUnique({
            where: { productId_customerClass: { productId: payload.productId, customerClass: customer.customerClass } }
          })
          if (classPrice) return { success: true, data: { unitPrice: classPrice.price, source: 'CUSTOMER_CLASS' as const } }
        }

        return { success: true, data: { unitPrice: defaultPrice, source: 'DEFAULT' as const } }
      }

      const supplier = await db.supplier.findUnique({ where: { id: payload.counterpartyId }, select: { priceListId: true } })
      if (!supplier) return { success: false, error: { code: 'SUP-001', message: 'Supplier not found.' } }

      if (supplier.priceListId) {
        const tiers = await db.priceListItem.findMany({ where: { priceListId: supplier.priceListId, productId: payload.productId } })
        const best = tiers.filter(t => t.minQuantity <= payload.quantity).sort((a, b) => b.minQuantity - a.minQuantity)[0]
        if (best) return { success: true, data: { unitPrice: best.unitPrice, source: 'PRICE_LIST' as const } }
      }

      return { success: true, data: { unitPrice: defaultPrice, source: 'DEFAULT' as const } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to resolve price.' } }
    }
  }
}
