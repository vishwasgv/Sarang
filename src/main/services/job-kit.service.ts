import { getPrisma } from '../database/db'

// Electrical vertical wow feature — Job Kit Builder. Suggests which products
// to bundle into a kit around an anchor product, from real co-purchase
// history (same invoice, ACTIVE, non-RETURN), same statistical shape as
// report.service.ts's generateBasketCompositionReport but read for ONE
// anchor product instead of every pairing in the shop. The actual "turn this
// into a kit" mutation reuses kit.service.ts's existing, already-tested
// setComponents verbatim — this only produces the suggestion list.
export interface KitSuggestionRow {
  productId: string; productName: string; sku: string | null
  coOccurrenceCount: number; suggestedQuantity: number
}

export async function suggestKitComponents(anchorProductId: string, limit = 8) {
  const db = getPrisma()
  const invoices = await db.invoice.findMany({
    where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' }, items: { some: { productId: anchorProductId } } },
    select: {
      items: {
        select: { productId: true, quantity: true, product: { select: { productName: true, sku: true, productType: true, isKit: true } } }
      }
    }
  })

  const tally = new Map<string, { productName: string; sku: string | null; count: number; totalQty: number }>()
  for (const inv of invoices) {
    const seen = new Set<string>()
    for (const item of inv.items) {
      if (item.productId === anchorProductId) continue
      // Same STANDARD-only, one-level-deep constraints kit.service.ts's
      // setComponents itself enforces — never suggest something the actual
      // save would reject.
      if (item.product.productType !== 'STANDARD' || item.product.isKit) continue
      if (seen.has(item.productId)) continue
      seen.add(item.productId)
      const existing = tally.get(item.productId) ?? { productName: item.product.productName, sku: item.product.sku, count: 0, totalQty: 0 }
      existing.count++
      existing.totalQty += item.quantity
      tally.set(item.productId, existing)
    }
  }

  const suggestions: KitSuggestionRow[] = Array.from(tally.entries())
    .map(([productId, v]) => ({
      productId, productName: v.productName, sku: v.sku,
      coOccurrenceCount: v.count,
      suggestedQuantity: Math.max(1, Math.round(v.totalQty / v.count))
    }))
    .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount)
    .slice(0, limit)

  return { success: true, data: { anchorInvoiceCount: invoices.length, suggestions } }
}
