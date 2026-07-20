import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

export interface BomItemInput {
  rawMaterialId?: string
  componentProductId?: string
  quantityNeeded: number
  wastagePercent?: number
}

export interface BomRecord {
  id: string
  productId: string
  productName: string
  description: string | null
  outputQty: number
  isActive: boolean
  items: BomItemRecord[]
  totalMaterialCost: number
  createdAt: string
}

export interface BomItemRecord {
  id: string
  bomId: string
  rawMaterialId: string | null
  materialName: string | null
  materialUnit: string | null
  // Phase 58 §2 — multi-level BOM: set instead of the material* fields when
  // this line is a component Product (sub-assembly) rather than a raw
  // material.
  componentProductId: string | null
  componentProductName: string | null
  quantityNeeded: number
  wastagePercent: number
  effectiveQty: number
  unitCost: number
  lineCost: number
}

const ITEM_INCLUDE = {
  rawMaterial: { select: { name: true, unit: true, unitCost: true } },
  componentProduct: { select: { productName: true, costPrice: true } }
} as const

export async function listBoms(payload?: { isActive?: boolean }): Promise<{ success: boolean; data?: BomRecord[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.billOfMaterial.findMany({
      where: { isActive: payload?.isActive ?? true },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { productName: true } },
        items: { include: ITEM_INCLUDE }
      }
    })
    return { success: true, data: rows.map(toRecord) }
  } catch (err) {
    return { success: false, error: { code: 'BOM-001', message: err instanceof Error ? err.message : 'Failed to list BOMs.' } }
  }
}

export async function getBom(productId: string): Promise<{ success: boolean; data?: BomRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.billOfMaterial.findUnique({
      where: { productId },
      include: {
        product: { select: { productName: true } },
        items: { include: ITEM_INCLUDE }
      }
    })
    if (!row) return { success: false, error: { code: 'BOM-002', message: 'No BOM found for this product.' } }
    return { success: true, data: toRecord(row) }
  } catch (err) {
    return { success: false, error: { code: 'BOM-003', message: err instanceof Error ? err.message : 'Failed to get BOM.' } }
  }
}

// Phase 58 §2 — multi-level BOM cycle guard. Walks every candidate component
// product's OWN BOM chain (breadth-first, de-duplicated) — if that walk ever
// reaches back to `productId` (the BOM being saved), assembling this product
// would require consuming a chain that eventually needs itself, which can
// never physically resolve. A depth cap (50) is a pure safety backstop
// against a pathological/corrupted chain, not an expected real case — no
// legitimate multi-level BOM should ever nest that deep.
async function wouldCreateCycle(
  db: ReturnType<typeof getPrisma>,
  productId: string,
  candidateComponentIds: string[]
): Promise<string | null> {
  const toVisit = [...new Set(candidateComponentIds)]
  const visited = new Set<string>()
  let depth = 0

  while (toVisit.length > 0 && depth < 50) {
    depth++
    const batch = toVisit.splice(0, toVisit.length)
    const boms = await db.billOfMaterial.findMany({
      where: { productId: { in: batch }, isActive: true },
      include: { items: { select: { componentProductId: true } } }
    })
    for (const bom of boms) {
      for (const item of bom.items) {
        if (!item.componentProductId) continue
        if (item.componentProductId === productId) return bom.productId
        if (!visited.has(item.componentProductId)) {
          visited.add(item.componentProductId)
          toVisit.push(item.componentProductId)
        }
      }
    }
  }
  return null
}

export async function upsertBom(payload: {
  productId: string
  description?: string
  outputQty?: number
  items: BomItemInput[]
}, userId?: string): Promise<{ success: boolean; data?: BomRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    const product = await db.product.findUnique({ where: { id: payload.productId }, select: { productName: true } })
    if (!product) return { success: false, error: { code: 'BOM-004', message: 'Product not found.' } }

    if (payload.items.length === 0) {
      return { success: false, error: { code: 'BOM-005', message: 'BOM must have at least one line.' } }
    }
    for (const item of payload.items) {
      if (!!item.rawMaterialId === !!item.componentProductId) {
        return { success: false, error: { code: 'BOM-009', message: 'Each BOM line must be either a raw material or a component product, not both or neither.' } }
      }
      if (item.componentProductId === payload.productId) {
        return { success: false, error: { code: 'BOM-010', message: 'A product cannot be a component of its own BOM.' } }
      }
    }

    const componentIds = payload.items.map(i => i.componentProductId).filter((id): id is string => !!id)
    if (componentIds.length > 0) {
      const cyclePoint = await wouldCreateCycle(db, payload.productId, componentIds)
      if (cyclePoint) {
        return { success: false, error: { code: 'BOM-011', message: 'This would create a circular BOM — a component\'s own assembly chain eventually requires this product back.' } }
      }
    }

    const result = await db.$transaction(async (tx) => {
      let bom = await tx.billOfMaterial.findUnique({ where: { productId: payload.productId } })

      if (bom) {
        bom = await tx.billOfMaterial.update({
          where: { productId: payload.productId },
          data: {
            description: payload.description ?? bom.description,
            outputQty: payload.outputQty ?? bom.outputQty
          }
        })
        // Replace all items
        await tx.billOfMaterialItem.deleteMany({ where: { bomId: bom.id } })
      } else {
        bom = await tx.billOfMaterial.create({
          data: {
            productId: payload.productId,
            description: payload.description ?? null,
            outputQty: payload.outputQty ?? 1
          }
        })
      }

      await tx.billOfMaterialItem.createMany({
        data: payload.items.map(item => ({
          bomId: bom!.id,
          rawMaterialId: item.rawMaterialId ?? null,
          componentProductId: item.componentProductId ?? null,
          quantityNeeded: item.quantityNeeded,
          wastagePercent: item.wastagePercent ?? 0
        }))
      })

      return tx.billOfMaterial.findUnique({
        where: { id: bom.id },
        include: {
          product: { select: { productName: true } },
          items: { include: ITEM_INCLUDE }
        }
      })
    })

    await logAction(userId, 'BOM_UPSERTED', 'BillOfMaterial', result!.id, undefined, { productId: payload.productId, itemCount: payload.items.length })
    return { success: true, data: toRecord(result!) }
  } catch (err) {
    return { success: false, error: { code: 'BOM-006', message: err instanceof Error ? err.message : 'Failed to save BOM.' } }
  }
}

export async function deleteBom(productId: string, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const bom = await db.billOfMaterial.findUnique({ where: { productId } })
    if (!bom) return { success: false, error: { code: 'BOM-002', message: 'BOM not found.' } }

    const inUse = await db.productionOrder.count({ where: { bomId: bom.id, status: { in: ['DRAFT', 'IN_PROGRESS'] } } })
    if (inUse > 0) return { success: false, error: { code: 'BOM-007', message: 'Cannot delete: BOM is used in active production orders.' } }

    await db.billOfMaterial.update({ where: { productId }, data: { isActive: false } })
    await logAction(userId, 'BOM_DELETED', 'BillOfMaterial', bom.id)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'BOM-008', message: err instanceof Error ? err.message : 'Failed to delete BOM.' } }
  }
}

type BomRow = {
  id: string
  productId: string
  description: string | null
  outputQty: number
  isActive: boolean
  createdAt: Date
  product: { productName: string }
  items: Array<{
    id: string
    bomId: string
    rawMaterialId: string | null
    componentProductId: string | null
    quantityNeeded: number
    wastagePercent: number
    rawMaterial: { name: string; unit: string; unitCost: number } | null
    componentProduct: { productName: string; costPrice: number } | null
  }>
}

function toRecord(b: BomRow): BomRecord {
  const items: BomItemRecord[] = b.items.map(i => {
    const effectiveQty = i.quantityNeeded * (1 + i.wastagePercent / 100)
    const unitCost = i.rawMaterial?.unitCost ?? i.componentProduct?.costPrice ?? 0
    return {
      id: i.id,
      bomId: i.bomId,
      rawMaterialId: i.rawMaterialId,
      materialName: i.rawMaterial?.name ?? null,
      materialUnit: i.rawMaterial?.unit ?? null,
      componentProductId: i.componentProductId,
      componentProductName: i.componentProduct?.productName ?? null,
      quantityNeeded: i.quantityNeeded,
      wastagePercent: i.wastagePercent,
      effectiveQty,
      unitCost,
      lineCost: effectiveQty * unitCost
    }
  })
  return {
    id: b.id,
    productId: b.productId,
    productName: b.product.productName,
    description: b.description,
    outputQty: b.outputQty,
    isActive: b.isActive,
    items,
    totalMaterialCost: items.reduce((sum, i) => sum + i.lineCost, 0),
    createdAt: b.createdAt.toISOString()
  }
}
