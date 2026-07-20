import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

export interface VariantRecord {
  id: string
  productId: string
  productName: string
  size: string | null
  color: string | null
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
    const variant = await db.productVariant.findUnique({ where: { id: payload.variantId } })
    if (!variant) return { success: false, error: { code: 'VAR-005', message: 'Variant not found.' } }

    const newQty = variant.stockQty + payload.quantityDelta
    if (newQty < 0) return { success: false, error: { code: 'VAR-007', message: 'Insufficient variant stock.' } }

    await db.$transaction(async (tx) => {
      await tx.productVariant.update({ where: { id: payload.variantId }, data: { stockQty: newQty } })
      await tx.inventory.upsert({
        where: { productId: variant.productId },
        create: { productId: variant.productId, quantity: Math.max(0, newQty) },
        update: { quantity: { increment: payload.quantityDelta } }
      })
    })
    await logAction(userId, 'VARIANT_STOCK_ADJUSTED', 'ProductVariant', payload.variantId, String(variant.stockQty), String(newQty))
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'VAR-008', message: err instanceof Error ? err.message : 'Failed to adjust variant stock.' } }
  }
}

export async function getVariantSummary(productId: string): Promise<{ success: boolean; data?: { totalVariants: number; totalStock: number; sizes: string[]; colors: string[] } }> {
  try {
    const db = getPrisma()
    const variants = await db.productVariant.findMany({ where: { productId, isActive: true } })
    return {
      success: true,
      data: {
        totalVariants: variants.length,
        totalStock: variants.reduce((sum, v) => sum + v.stockQty, 0),
        sizes: [...new Set(variants.map(v => v.size).filter(Boolean) as string[])],
        colors: [...new Set(variants.map(v => v.color).filter(Boolean) as string[])]
      }
    }
  } catch {
    return { success: true, data: { totalVariants: 0, totalStock: 0, sizes: [], colors: [] } }
  }
}

export async function decrementVariantStockTx(
  tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
  variantId: string,
  quantity: number
): Promise<void> {
  const variant = await tx.productVariant.findUnique({ where: { id: variantId } })
  if (!variant) return
  await tx.productVariant.update({
    where: { id: variantId },
    data: { stockQty: Math.max(0, variant.stockQty - quantity) }
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

function toRecord(v: { id: string; productId: string; product: { productName: string }; size: string | null; color: string | null; sku: string | null; barcode: string | null; additionalPrice: number; stockQty: number; isActive: boolean; createdAt: Date }): VariantRecord {
  return {
    id: v.id,
    productId: v.productId,
    productName: v.product.productName,
    size: v.size,
    color: v.color,
    sku: v.sku,
    barcode: v.barcode,
    additionalPrice: v.additionalPrice,
    stockQty: v.stockQty,
    isActive: v.isActive,
    createdAt: v.createdAt.toISOString()
  }
}
