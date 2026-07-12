import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

export interface BomItemInput {
  rawMaterialId: string
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
  rawMaterialId: string
  materialName: string
  materialUnit: string
  quantityNeeded: number
  wastagePercent: number
  effectiveQty: number
  unitCost: number
  lineCost: number
}

export async function listBoms(payload?: { isActive?: boolean }): Promise<{ success: boolean; data?: BomRecord[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.billOfMaterial.findMany({
      where: { isActive: payload?.isActive ?? true },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { productName: true } },
        items: {
          include: { rawMaterial: { select: { name: true, unit: true, unitCost: true } } }
        }
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
        items: {
          include: { rawMaterial: { select: { name: true, unit: true, unitCost: true } } }
        }
      }
    })
    if (!row) return { success: false, error: { code: 'BOM-002', message: 'No BOM found for this product.' } }
    return { success: true, data: toRecord(row) }
  } catch (err) {
    return { success: false, error: { code: 'BOM-003', message: err instanceof Error ? err.message : 'Failed to get BOM.' } }
  }
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
      return { success: false, error: { code: 'BOM-005', message: 'BOM must have at least one raw material.' } }
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
          rawMaterialId: item.rawMaterialId,
          quantityNeeded: item.quantityNeeded,
          wastagePercent: item.wastagePercent ?? 0
        }))
      })

      return tx.billOfMaterial.findUnique({
        where: { id: bom.id },
        include: {
          product: { select: { productName: true } },
          items: { include: { rawMaterial: { select: { name: true, unit: true, unitCost: true } } } }
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
    rawMaterialId: string
    quantityNeeded: number
    wastagePercent: number
    rawMaterial: { name: string; unit: string; unitCost: number }
  }>
}

function toRecord(b: BomRow): BomRecord {
  const items: BomItemRecord[] = b.items.map(i => {
    const effectiveQty = i.quantityNeeded * (1 + i.wastagePercent / 100)
    return {
      id: i.id,
      bomId: i.bomId,
      rawMaterialId: i.rawMaterialId,
      materialName: i.rawMaterial.name,
      materialUnit: i.rawMaterial.unit,
      quantityNeeded: i.quantityNeeded,
      wastagePercent: i.wastagePercent,
      effectiveQty,
      unitCost: i.rawMaterial.unitCost,
      lineCost: effectiveQty * i.rawMaterial.unitCost
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
