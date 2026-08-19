import { getPrisma } from '../database/db'
import { parseLocalDateEnd } from '../utils/date.util'
import { logAction } from './audit.service'
import type { CreatePriceMarkdownPayload } from '../validation/price-markdown.validation'

// Phase 67 §9.1 — Retail: time-boxed markdown workflow. Mirrors
// recurring-profile.service.ts's own "no real cron exists in this codebase"
// evaluation shape — revertDuePriceMarkdowns is called on app startup +
// hourly via the existing setInterval in main/index.ts, the same mechanism
// every other scheduled evaluator in this app already uses.
//
// A markdown applies its cut to Product.sellingPrice IMMEDIATELY on
// creation, and the evaluator reverts it back to originalPrice once endDate
// passes. If the price was manually changed away from markdownPrice in the
// meantime (a deliberate manual edit), the revert is SKIPPED rather than
// clobbering that edit — the markdown record still closes out, just without
// touching the price, and is marked SKIPPED_MANUAL_OVERRIDE so this is
// visible in the list rather than silently indistinguishable from a normal
// revert.
export const priceMarkdownService = {
  async createPriceMarkdown(payload: CreatePriceMarkdownPayload, userId?: string) {
    try {
      const db = getPrisma()
      const product = await db.product.findUnique({ where: { id: payload.productId } })
      if (!product) return { success: false, error: { code: 'PRD-001', message: 'Product not found.' } }

      const endDate = parseLocalDateEnd(payload.endDate)
      if (endDate <= new Date()) {
        return { success: false, error: { code: 'MKD-001', message: 'End date must be in the future.' } }
      }

      const existingActive = await db.priceMarkdown.findFirst({ where: { productId: payload.productId, status: 'ACTIVE' } })
      if (existingActive) {
        return { success: false, error: { code: 'MKD-002', message: 'This product already has an active markdown. Cancel it before starting a new one.' } }
      }

      const [markdown] = await db.$transaction([
        db.priceMarkdown.create({
          data: {
            productId: payload.productId,
            originalPrice: product.sellingPrice,
            markdownPrice: payload.markdownPrice,
            endDate,
            createdById: userId ?? null
          }
        }),
        db.product.update({ where: { id: payload.productId }, data: { sellingPrice: payload.markdownPrice } })
      ])

      await logAction({ userId, action: 'PRICE_MARKDOWN_CREATED', entityType: 'PriceMarkdown', entityId: markdown.id, newValue: { productId: payload.productId, originalPrice: product.sellingPrice, markdownPrice: payload.markdownPrice, endDate: payload.endDate } })
      return { success: true, data: markdown }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create price markdown.' } }
    }
  },

  async listPriceMarkdowns(filters?: { status?: string; productId?: string }) {
    try {
      const db = getPrisma()
      const where: Record<string, unknown> = {}
      if (filters?.status) where.status = filters.status
      if (filters?.productId) where.productId = filters.productId
      const markdowns = await db.priceMarkdown.findMany({
        where,
        include: { product: { select: { id: true, productName: true, sku: true } } },
        orderBy: { createdAt: 'desc' }
      })
      return { success: true, data: markdowns }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list price markdowns.' } }
    }
  },

  async cancelPriceMarkdown(id: string, userId?: string) {
    try {
      const db = getPrisma()
      const markdown = await db.priceMarkdown.findUnique({ where: { id }, include: { product: true } })
      if (!markdown) return { success: false, error: { code: 'MKD-003', message: 'Price markdown not found.' } }
      if (markdown.status !== 'ACTIVE') return { success: false, error: { code: 'MKD-004', message: 'This markdown is no longer active.' } }

      const priceStillAtMarkdown = markdown.product.sellingPrice === markdown.markdownPrice
      await db.$transaction([
        db.priceMarkdown.update({ where: { id }, data: { status: 'CANCELLED', revertedAt: new Date() } }),
        ...(priceStillAtMarkdown
          ? [db.product.update({ where: { id: markdown.productId }, data: { sellingPrice: markdown.originalPrice } })]
          : [])
      ])

      await logAction({ userId, action: 'PRICE_MARKDOWN_CANCELLED', entityType: 'PriceMarkdown', entityId: id, newValue: { priceReverted: priceStillAtMarkdown } })
      return { success: true }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to cancel price markdown.' } }
    }
  },

  // The evaluator — called on app startup + hourly, same shape as
  // recurring-profile.service.ts's generateDueRecurringDocuments. Never
  // throws; failures for one markdown don't block the others.
  async revertDuePriceMarkdowns(userId?: string) {
    const db = getPrisma()
    const due = await db.priceMarkdown.findMany({
      where: { status: 'ACTIVE', endDate: { lte: new Date() } },
      include: { product: true }
    })

    let reverted = 0
    let skippedManualOverride = 0
    for (const markdown of due) {
      try {
        const priceStillAtMarkdown = markdown.product.sellingPrice === markdown.markdownPrice
        if (priceStillAtMarkdown) {
          await db.$transaction([
            db.priceMarkdown.update({ where: { id: markdown.id }, data: { status: 'REVERTED', revertedAt: new Date() } }),
            db.product.update({ where: { id: markdown.productId }, data: { sellingPrice: markdown.originalPrice } })
          ])
          reverted++
        } else {
          await db.priceMarkdown.update({ where: { id: markdown.id }, data: { status: 'SKIPPED_MANUAL_OVERRIDE', revertedAt: new Date() } })
          skippedManualOverride++
        }
        await logAction({ userId, action: 'PRICE_MARKDOWN_EVALUATED', entityType: 'PriceMarkdown', entityId: markdown.id, newValue: { priceReverted: priceStillAtMarkdown } }).catch(() => {})
      } catch {
        // One markdown's failure must not block the others in this batch.
      }
    }
    return { evaluated: due.length, reverted, skippedManualOverride }
  }
}
