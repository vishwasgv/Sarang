import { getPrisma } from '../database/db'
import { defaultGstTypeForPlaceOfSupply, resolvePartyState, isGstType, resolveLineTaxCategory, type GstType } from '../../shared/utils/gst-presentation'

// Presentation lookups (state, category) never decide an amount, so a failed lookup falls back to the
// neutral default instead of blocking the document.

/** The presentation stored on a new document: the caller's choice, else from business state against the party's state. */
export async function resolveDocumentGstType(explicit: unknown, partyState: string | null | undefined): Promise<GstType> {
  if (isGstType(explicit)) return explicit
  try {
    const profile = await getPrisma().businessProfile.findFirst({ select: { state: true, taxNumber: true } })
    return defaultGstTypeForPlaceOfSupply(resolvePartyState(profile?.state, profile?.taxNumber), partyState)
  } catch {
    return 'CGST_SGST'
  }
}

export async function customerStateOf(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null
  try {
    const c = await getPrisma().customer.findUnique({ where: { id: customerId }, select: { state: true, taxNumber: true } })
    return c ? resolvePartyState(c.state, c.taxNumber) || null : null
  } catch {
    return null
  }
}

export async function supplierStateOf(supplierId: string | null | undefined): Promise<string | null> {
  if (!supplierId) return null
  try {
    const s = await getPrisma().supplier.findUnique({ where: { id: supplierId }, select: { state: true, taxNumber: true } })
    return s ? resolvePartyState(s.state, s.taxNumber) || null : null
  } catch {
    return null
  }
}

/** Category to snapshot on a document line, from the product's own category and the tax actually charged. */
export async function lineTaxCategories(items: Array<{ productId?: string | null; taxRate?: number | null }>): Promise<string[]> {
  const ids = Array.from(new Set(items.map(i => i.productId).filter((x): x is string => !!x)))
  const map = new Map<string, string>()
  if (ids.length > 0) {
    try {
      const rows = await getPrisma().product.findMany({ where: { id: { in: ids } }, select: { id: true, taxCategory: true } })
      for (const r of rows) map.set(r.id, r.taxCategory)
    } catch { /* fall back to the tax rate alone */ }
  }
  return items.map(i => resolveLineTaxCategory(i.productId ? map.get(i.productId) : undefined, i.taxRate ?? 0))
}
