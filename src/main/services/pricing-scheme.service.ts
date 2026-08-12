import { getPrisma } from '../database/db'
import { roundCurrency } from './currency.service'
import { logAction } from './audit.service'
import type { CreatePricingSchemePayload, UpdatePricingSchemePayload, EvaluateCartPayload } from '../validation/pricing-scheme.validation'

// The scheme engine — buy-X-get-Y-free and slab discounts, the second
// literal field-note feature independently named by both Zoho ("zero-value
// line items") and Tally ("Actual and Billed quantities... free samples").
// evaluateCart is a pure read-only lookup, the same "UI resolves, server
// enforces at InvoiceItem.isFreeOfCost" split priceListService.resolvePrice
// already established — this never writes anything.
export const pricingSchemeService = {
  async createPricingScheme(payload: CreatePricingSchemePayload, userId?: string) {
    try {
      const db = getPrisma()
      if (payload.productId) {
        const product = await db.product.findUnique({ where: { id: payload.productId } })
        if (!product) return { success: false, error: { code: 'PRD-001', message: 'Product not found.' } }
      }
      if (payload.categoryId) {
        const category = await db.productCategory.findUnique({ where: { id: payload.categoryId } })
        if (!category) return { success: false, error: { code: 'CAT-001', message: 'Category not found.' } }
      }

      const scheme = await db.pricingScheme.create({
        data: {
          name: payload.name,
          ruleType: payload.ruleType,
          productId: payload.productId ?? null,
          categoryId: payload.categoryId ?? null,
          buyQuantity: payload.buyQuantity ?? null,
          freeQuantity: payload.freeQuantity ?? null,
          slabBreakpoints: payload.slabBreakpoints ? JSON.stringify(payload.slabBreakpoints) : '[]',
          startDate: payload.startDate ? new Date(payload.startDate) : null,
          endDate: payload.endDate ? new Date(payload.endDate) : null,
        }
      })
      await logAction({ userId, action: 'PRICING_SCHEME_CREATED', entityType: 'PricingScheme', entityId: scheme.id, newValue: { name: scheme.name, ruleType: scheme.ruleType } })
      return { success: true, data: scheme }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create pricing scheme.' } }
    }
  },

  async updatePricingScheme(payload: UpdatePricingSchemePayload, userId?: string) {
    try {
      const db = getPrisma()
      const existing = await db.pricingScheme.findUnique({ where: { id: payload.id } })
      if (!existing) return { success: false, error: { code: 'PS-001', message: 'Pricing scheme not found.' } }
      const updated = await db.pricingScheme.update({
        where: { id: payload.id },
        data: {
          name: payload.name ?? existing.name,
          isActive: payload.isActive ?? existing.isActive,
          endDate: payload.endDate !== undefined ? (payload.endDate ? new Date(payload.endDate) : null) : existing.endDate
        }
      })
      await logAction({ userId, action: 'PRICING_SCHEME_UPDATED', entityType: 'PricingScheme', entityId: payload.id, newValue: payload })
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to update pricing scheme.' } }
    }
  },

  async listPricingSchemes(filters?: { isActive?: boolean; productId?: string }) {
    try {
      const db = getPrisma()
      const where: Record<string, unknown> = {}
      if (filters?.isActive !== undefined) where.isActive = filters.isActive
      if (filters?.productId) where.productId = filters.productId
      const schemes = await db.pricingScheme.findMany({
        where,
        include: { product: { select: { id: true, productName: true } }, category: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' }
      })
      return { success: true, data: schemes }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list pricing schemes.' } }
    }
  },

  async deletePricingScheme(id: string, userId?: string) {
    try {
      const db = getPrisma()
      const existing = await db.pricingScheme.findUnique({ where: { id } })
      if (!existing) return { success: false, error: { code: 'PS-001', message: 'Pricing scheme not found.' } }
      await db.pricingScheme.delete({ where: { id } })
      await logAction({ userId, action: 'PRICING_SCHEME_DELETED', entityType: 'PricingScheme', entityId: id })
      return { success: true }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to delete pricing scheme.' } }
    }
  },

  // Read-only — evaluates every active, in-date-range scheme against a cart
  // and returns suggestions for the UI to apply (a new FOC line to add, or a
  // discount percent to apply to an existing line). Never writes anything;
  // the actual enforcement happens server-side in billing.service.ts's
  // createInvoice when the resulting isFreeOfCost/discountAmount are
  // eventually submitted with the real invoice.
  async evaluateCart(payload: EvaluateCartPayload) {
    try {
      const db = getPrisma()
      const focLines: Array<{ productId: string; quantity: number; schemeId: string; schemeName: string }> = []
      const discounts: Array<{ productId: string; discountPercent: number; schemeId: string; schemeName: string }> = []
      const now = new Date()

      for (const line of payload.items) {
        const product = await db.product.findUnique({ where: { id: line.productId }, select: { categoryId: true } })
        if (!product) continue

        const schemes = await db.pricingScheme.findMany({
          where: {
            isActive: true,
            OR: [{ productId: line.productId }, ...(product.categoryId ? [{ categoryId: product.categoryId }] : [])],
          }
        })

        for (const scheme of schemes) {
          if (scheme.startDate && scheme.startDate > now) continue
          if (scheme.endDate && scheme.endDate < now) continue

          if (scheme.ruleType === 'BUY_X_GET_Y_FREE' && scheme.buyQuantity && scheme.freeQuantity) {
            const timesEarned = Math.floor(line.quantity / scheme.buyQuantity)
            const freeQty = roundCurrency(timesEarned * scheme.freeQuantity)
            if (freeQty > 0) {
              focLines.push({ productId: line.productId, quantity: freeQty, schemeId: scheme.id, schemeName: scheme.name })
            }
          } else if (scheme.ruleType === 'SLAB_DISCOUNT') {
            let breakpoints: Array<{ minQty: number; discountPercent: number }> = []
            try { breakpoints = JSON.parse(scheme.slabBreakpoints) } catch { breakpoints = [] }
            const best = breakpoints.filter(b => b.minQty <= line.quantity).sort((a, b) => b.minQty - a.minQty)[0]
            if (best) {
              discounts.push({ productId: line.productId, discountPercent: best.discountPercent, schemeId: scheme.id, schemeName: scheme.name })
            }
          }
        }
      }

      return { success: true, data: { focLines, discounts } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to evaluate schemes.' } }
    }
  }
}
