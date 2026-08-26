import { getPrisma } from '../database/db'

// Phase 67 §9.1 — Agri Inputs item 3: crop-linked product advisory. Reuses
// Product.recommendedCrop (free text, same convention as Clothing's own
// Product.season) — no separate lookup table needed since the crop names
// live directly on the products themselves, the same way Season/Collection
// values already do for the sell-through report.
export interface CropAdvisoryProduct {
  productId: string
  productName: string
  sellingPrice: number
  stockQty: number
}

export async function listDistinctCrops(): Promise<{ success: boolean; data?: string[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.product.findMany({
      where: { isActive: true, recommendedCrop: { not: null } },
      select: { recommendedCrop: true },
      distinct: ['recommendedCrop']
    })
    const crops = Array.from(new Set(rows.map(r => r.recommendedCrop!.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
    return { success: true, data: crops }
  } catch (err) {
    return { success: false, error: { code: 'CADV-001', message: err instanceof Error ? err.message : 'Failed to list crops.' } }
  }
}

export async function getProductsForCrop(cropName: string): Promise<{ success: boolean; data?: CropAdvisoryProduct[]; error?: { code: string; message: string } }> {
  try {
    if (!cropName?.trim()) return { success: false, error: { code: 'CADV-002', message: 'Crop name is required.' } }

    const db = getPrisma()
    // Product.recommendedCrop is free text — matched case-insensitively in
    // JS, same reasoning (and same SQLite-provider limitation) as
    // SeasonalCycle's own Product.season matching this phase already
    // established, not a Prisma `mode: 'insensitive'` filter.
    const allTagged = await db.product.findMany({
      where: { isActive: true, recommendedCrop: { not: null } },
      select: { id: true, productName: true, sellingPrice: true, recommendedCrop: true, inventory: { select: { quantity: true } }, variants: { where: { isActive: true }, select: { stockQty: true } } }
    })
    const matched = allTagged.filter(p => p.recommendedCrop?.trim().toLowerCase() === cropName.trim().toLowerCase())

    const data: CropAdvisoryProduct[] = matched.map(p => ({
      productId: p.id, productName: p.productName, sellingPrice: p.sellingPrice,
      stockQty: p.variants.length > 0 ? p.variants.reduce((s, v) => s + v.stockQty, 0) : (p.inventory?.quantity ?? 0)
    })).sort((a, b) => a.productName.localeCompare(b.productName))

    return { success: true, data }
  } catch (err) {
    return { success: false, error: { code: 'CADV-003', message: err instanceof Error ? err.message : 'Failed to look up products for this crop.' } }
  }
}
