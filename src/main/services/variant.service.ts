import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { ServiceError } from '../errors/service-error'
import { getAllowNegative } from './inventory.service'

export interface VariantRecord {
  id: string
  productId: string
  productName: string
  size: string | null
  color: string | null
  // Phase 67 §9.1 — Footwear item 1: half-size/width matrix. Free text
  // (e.g. "Wide", "Narrow", "2E"), same convention as size/color — null and
  // simply unused for every business type other than FOOTWEAR.
  width: string | null
  sku: string | null
  barcode: string | null
  additionalPrice: number
  stockQty: number
  isActive: boolean
  createdAt: string
}

export async function listVariants(productId: string): Promise<{ success: boolean; data?: VariantRecord[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.productVariant.findMany({
      where: { productId, isActive: true },
      orderBy: [{ size: 'asc' }, { color: 'asc' }],
      include: { product: { select: { productName: true } } }
    })
    return { success: true, data: rows.map(toRecord) }
  } catch (err) {
    return { success: false, error: { code: 'VAR-001', message: err instanceof Error ? err.message : 'Failed to list variants.' } }
  }
}

export async function upsertVariants(payload: {
  productId: string
  variants: Array<{
    id?: string
    size?: string
    color?: string
    width?: string
    sku?: string
    barcode?: string
    additionalPrice?: number
    stockQty?: number
  }>
}, userId?: string): Promise<{ success: boolean; data?: VariantRecord[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    const product = await db.product.findUnique({ where: { id: payload.productId }, select: { productName: true } })
    if (!product) return { success: false, error: { code: 'VAR-002', message: 'Product not found.' } }

    const results: VariantRecord[] = await db.$transaction(async (tx) => {
      const saved: VariantRecord[] = []

      for (const v of payload.variants) {
        if (v.id) {
          const updated = await tx.productVariant.update({
            where: { id: v.id },
            data: {
              size: v.size ?? null,
              color: v.color ?? null,
              width: v.width ?? null,
              sku: v.sku ?? null,
              barcode: v.barcode ?? null,
              additionalPrice: v.additionalPrice ?? 0,
              stockQty: v.stockQty ?? 0
            },
            include: { product: { select: { productName: true } } }
          })
          saved.push(toRecord(updated))
        } else {
          const created = await tx.productVariant.create({
            data: {
              productId: payload.productId,
              size: v.size ?? null,
              color: v.color ?? null,
              width: v.width ?? null,
              sku: v.sku ?? null,
              barcode: v.barcode ?? null,
              additionalPrice: v.additionalPrice ?? 0,
              stockQty: v.stockQty ?? 0
            },
            include: { product: { select: { productName: true } } }
          })
          saved.push(toRecord(created))
        }
      }

      // Sync total variant stock to the inventory table
      const allVariants = await tx.productVariant.findMany({ where: { productId: payload.productId, isActive: true } })
      const totalStock = allVariants.reduce((sum, v) => sum + v.stockQty, 0)
      await tx.inventory.upsert({
        where: { productId: payload.productId },
        create: { productId: payload.productId, quantity: totalStock },
        update: { quantity: totalStock }
      })

      return saved
    })

    await logAction(userId, 'VARIANTS_UPSERTED', 'ProductVariant', payload.productId, undefined, { count: payload.variants.length })
    return { success: true, data: results }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save variants.'
    if (msg.includes('Unique constraint')) {
      return { success: false, error: { code: 'VAR-003', message: 'Duplicate SKU or barcode in variants.' } }
    }
    return { success: false, error: { code: 'VAR-004', message: msg } }
  }
}

export async function deleteVariant(id: string, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.productVariant.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'VAR-005', message: 'Variant not found.' } }

    await db.$transaction(async (tx) => {
      await tx.productVariant.update({ where: { id }, data: { isActive: false } })
      if (existing.stockQty > 0) {
        await tx.inventory.upsert({
          where: { productId: existing.productId },
          create: { productId: existing.productId, quantity: 0 },
          update: { quantity: { decrement: existing.stockQty } }
        })
      }
    })
    await logAction(userId, 'VARIANT_DELETED', 'ProductVariant', id)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'VAR-006', message: err instanceof Error ? err.message : 'Failed to delete variant.' } }
  }
}

export async function adjustVariantStock(payload: {
  variantId: string
  quantityDelta: number
}, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    // Real bug found live (core-commerce audit): `variant` used to be read,
    // and the resulting `newQty` / insufficient-stock check computed, BEFORE
    // this transaction opened. Two concurrent adjustVariantStock calls on the
    // same variant (e.g. two staff each correcting the same size/colour at
    // once) would each read the same stale stockQty, each independently pass
    // the "newQty >= 0" check even when the combination of both adjustments
    // would have gone negative, and then race on the final absolute
    // `stockQty: newQty` write (last one wins, silently discarding the
    // other's adjustment) while Inventory.quantity — updated with a relative
    // `increment` — ends up applying BOTH deltas. Reading and validating
    // fresh INSIDE the transaction closes both problems: SQLite serializes
    // writers, so nothing can land between this read and the writes below.
    const { previousQty, newQty } = await db.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({ where: { id: payload.variantId } })
      if (!variant) throw new ServiceError('VAR-005', 'Variant not found.')

      const newQty = variant.stockQty + payload.quantityDelta
      if (newQty < 0) {
        throw new ServiceError('VAR-007', 'Insufficient variant stock.')
      }

      await tx.productVariant.update({ where: { id: payload.variantId }, data: { stockQty: newQty } })
      await tx.inventory.upsert({
        where: { productId: variant.productId },
        create: { productId: variant.productId, quantity: Math.max(0, newQty) },
        update: { quantity: { increment: payload.quantityDelta } }
      })
      return { previousQty: variant.stockQty, newQty }
    })
    // logAction always uses its own getPrisma() connection, not `tx` — every
    // other caller in this scope logs AFTER the transaction commits, never
    // from inside it (calling it inside would contend with the
    // transaction's own held write lock). Kept consistent with that.
    await logAction(userId, 'VARIANT_STOCK_ADJUSTED', 'ProductVariant', payload.variantId, String(previousQty), String(newQty))
    return { success: true }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'VAR-008', message: err instanceof Error ? err.message : 'Failed to adjust variant stock.' } }
  }
}

export async function getVariantSummary(productId: string): Promise<{ success: boolean; data?: { totalVariants: number; totalStock: number; sizes: string[]; colors: string[]; widths: string[] } }> {
  try {
    const db = getPrisma()
    const variants = await db.productVariant.findMany({ where: { productId, isActive: true } })
    return {
      success: true,
      data: {
        totalVariants: variants.length,
        totalStock: variants.reduce((sum, v) => sum + v.stockQty, 0),
        sizes: [...new Set(variants.map(v => v.size).filter(Boolean) as string[])],
        colors: [...new Set(variants.map(v => v.color).filter(Boolean) as string[])],
        // Phase 67 §9.1 — Footwear item 1. Empty for every product that
        // never sets a width — harmless for every non-Footwear vertical.
        widths: [...new Set(variants.map(v => v.width).filter(Boolean) as string[])]
      }
    }
  } catch {
    return { success: true, data: { totalVariants: 0, totalStock: 0, sizes: [], colors: [], widths: [] } }
  }
}

// Phase 67 §9.1 — Clothing: size-curve reorder suggestion. "Auto-weights the
// reorder ratio toward the sizes that actually sell" — the artifact's own
// example: "you sold out of M and L three weeks before S and XL." This is
// deliberately a SUGGESTION/breakdown, not a new ordering mechanism —
// PurchaseOrderItem has no variantId at all (grounded: the PO/GRN pipeline
// only orders at the parent-Product level), so actually rebuilding
// variant-level purchasing is a much larger change than this single
// signature item calls for. The owner sees the suggested split here and
// still places/adjusts the real order manually.
const SIZE_CURVE_LOOKBACK_DAYS = 90 // same recency window Dead Stock Clearance already established

export interface SizeCurveReorderRow {
  variantId: string; size: string | null; color: string | null; width: string | null
  unitsSoldRecently: number; suggestedQuantity: number
}
export interface SizeCurveReorderSuggestion {
  productId: string; totalReorderQty: number; lookbackDays: number
  rows: SizeCurveReorderRow[]
}

export async function getSizeCurveReorderSuggestion(productId: string, totalReorderQty?: number): Promise<{ success: boolean; data?: SizeCurveReorderSuggestion; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    // Phase 67 §9.1 — Footwear item 1: width included so two variants that
    // share a size and color but differ only by width (a real, common
    // footwear case) are never conflated in this row's own identity.
    const variants = await db.productVariant.findMany({ where: { productId, isActive: true }, select: { id: true, size: true, color: true, width: true } })
    if (variants.length === 0) return { success: false, error: { code: 'VAR-011', message: 'This product has no active variants to suggest a reorder split for.' } }

    let qty = totalReorderQty
    if (qty === undefined) {
      const inv = await db.inventory.findUnique({ where: { productId }, select: { reorderQuantity: true } })
      qty = inv?.reorderQuantity ?? 0
    }
    if (!qty || qty <= 0) return { success: false, error: { code: 'VAR-012', message: 'Enter a reorder quantity greater than zero, or set one on this product’s reorder settings.' } }

    const since = new Date(Date.now() - SIZE_CURVE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    const items = await db.invoiceItem.findMany({
      where: { productId, variantId: { not: null }, invoice: { status: 'ACTIVE', invoiceDate: { gte: since } } },
      select: { variantId: true, quantity: true, invoice: { select: { invoiceType: true } } }
    })
    const soldByVariant = new Map<string, number>()
    for (const it of items) {
      // Same RETURN sign correction every other report/aggregation in this
      // codebase already uses — a returned unit is real negative signal,
      // clamped at 0 per variant so it can never flip a suggestion negative.
      const sign = it.invoice.invoiceType === 'RETURN' ? -1 : 1
      const key = it.variantId!
      soldByVariant.set(key, Math.max(0, (soldByVariant.get(key) ?? 0) + sign * it.quantity))
    }
    const totalSold = Array.from(soldByVariant.values()).reduce((s, n) => s + n, 0)

    // No sales signal at all (brand-new product, or nothing sold in the
    // window) — fall back to a neutral even split rather than suggesting
    // zero for every size, which would be actively unhelpful.
    const weights = totalSold > 0
      ? variants.map(v => ({ variantId: v.id, weight: (soldByVariant.get(v.id) ?? 0) / totalSold }))
      : variants.map(v => ({ variantId: v.id, weight: 1 / variants.length }))

    // Largest-remainder rounding so the suggested quantities always sum
    // exactly to qty, never drift a unit or two short/over from rounding.
    const exact = weights.map(w => ({ variantId: w.variantId, value: w.weight * qty! }))
    const floors = exact.map(e => ({ variantId: e.variantId, floor: Math.floor(e.value), remainder: e.value - Math.floor(e.value) }))
    const allocated = floors.reduce((s, f) => s + f.floor, 0)
    const remaining = qty - allocated
    const byRemainder = [...floors].sort((a, b) => b.remainder - a.remainder)
    const bonus = new Map<string, number>()
    for (let i = 0; i < remaining; i++) bonus.set(byRemainder[i].variantId, (bonus.get(byRemainder[i].variantId) ?? 0) + 1)

    const rows: SizeCurveReorderRow[] = variants
      .map(v => {
        const floor = floors.find(f => f.variantId === v.id)!.floor
        return {
          variantId: v.id, size: v.size, color: v.color, width: v.width,
          unitsSoldRecently: soldByVariant.get(v.id) ?? 0,
          suggestedQuantity: floor + (bonus.get(v.id) ?? 0)
        }
      })
      .sort((a, b) => b.suggestedQuantity - a.suggestedQuantity)

    return { success: true, data: { productId, totalReorderQty: qty, lookbackDays: SIZE_CURVE_LOOKBACK_DAYS, rows } }
  } catch (err) {
    return { success: false, error: { code: 'VAR-013', message: err instanceof Error ? err.message : 'Failed to compute size-curve reorder suggestion.' } }
  }
}

// Real bug found live (2026-07-28 core-commerce audit): this used to
// silently clamp at `Math.max(0, ...)` — never rejecting insufficient
// stock, never distinguishing "just enough" from "not enough," and ignoring
// the `allow_negative_inventory` setting entirely for the variant
// dimension, unlike reduceStockTx's identical check for the parent
// Inventory.quantity total. Two near-simultaneous sales of the same
// size/colour could each pass a stale pre-transaction read, then both
// decrement here with no error — overselling a specific variant while its
// stockQty sat at a deceptive 0 instead of the true negative deficit.
export async function decrementVariantStockTx(
  tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
  variantId: string,
  quantity: number
): Promise<void> {
  const variant = await tx.productVariant.findUnique({ where: { id: variantId } })
  if (!variant) return
  const allowNegative = await getAllowNegative()
  if (!allowNegative && variant.stockQty < quantity) {
    throw new ServiceError('VAR-009', `Insufficient stock for this variant. Available: ${variant.stockQty}, required: ${quantity}.`)
  }
  await tx.productVariant.update({
    where: { id: variantId },
    data: { stockQty: variant.stockQty - quantity }
  })
}

// Real bug found 2026-07-16: returns.service.ts restored the parent
// Inventory.quantity total on every return, but never had a counterpart to
// decrementVariantStockTx to put stock back into the SPECIFIC variant
// (size/colour) it was sold from — so a returned item's per-variant stock
// count silently drifted low forever, even though the shared aggregate
// looked correct. This is the increment mirror of decrementVariantStockTx
// above; deliberately does NOT touch Inventory.quantity itself (the caller
// already does that via tx.inventory.upsert, same "parent handled
// separately" split billing.service.ts's decrement side already uses).
export async function restoreVariantStockTx(
  tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
  variantId: string,
  quantity: number
): Promise<void> {
  const variant = await tx.productVariant.findUnique({ where: { id: variantId } })
  if (!variant) return
  await tx.productVariant.update({
    where: { id: variantId },
    data: { stockQty: variant.stockQty + quantity }
  })
}

function toRecord(v: { id: string; productId: string; product: { productName: string }; size: string | null; color: string | null; width: string | null; sku: string | null; barcode: string | null; additionalPrice: number; stockQty: number; isActive: boolean; createdAt: Date }): VariantRecord {
  return {
    id: v.id,
    productId: v.productId,
    productName: v.product.productName,
    size: v.size,
    color: v.color,
    width: v.width,
    sku: v.sku,
    barcode: v.barcode,
    additionalPrice: v.additionalPrice,
    stockQty: v.stockQty,
    isActive: v.isActive,
    createdAt: v.createdAt.toISOString()
  }
}
