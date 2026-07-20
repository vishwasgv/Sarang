import { listVariants, upsertVariants, deleteVariant, adjustVariantStock, getVariantSummary } from '../../services/variant.service'
import { generateVariantBarcode, bulkGenerateMissingVariantBarcodes } from '../../services/barcode.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { UpsertVariantsSchema, DeleteVariantSchema, AdjustVariantStockSchema } from '../../validation/variant.validation'
import { GenerateVariantBarcodeSchema, BulkGenerateMissingVariantBarcodesSchema } from '../../validation/product.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('variants:list', async (payload) => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    const p = (payload ?? {}) as { productId: string }
    return listVariants(p.productId)
  })

  handle('variants:upsert', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    const parsed = UpsertVariantsSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return upsertVariants(parsed.data, getCurrentSession()?.userId)
  })

  handle('variants:delete', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    const parsed = DeleteVariantSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteVariant(parsed.data.id, getCurrentSession()?.userId)
  })

  handle('variants:adjustStock', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const parsed = AdjustVariantStockSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return adjustVariantStock(parsed.data, getCurrentSession()?.userId)
  })

  handle('variants:summary', async (payload) => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    const p = (payload ?? {}) as { productId: string }
    return getVariantSummary(p.productId)
  })

  // Phase 58 §2 — Clothing/Footwear variant barcode generation
  handle('variants:generateBarcode', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    const parsed = GenerateVariantBarcodeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateVariantBarcode(parsed.data.variantId)
  })

  handle('variants:bulkGenerateMissingBarcodes', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    const parsed = BulkGenerateMissingVariantBarcodesSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return bulkGenerateMissingVariantBarcodes(parsed.data.productId)
  })
}
