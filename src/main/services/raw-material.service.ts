import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

export interface RawMaterialRecord {
  id: string
  name: string
  unit: string
  currentStock: number
  reorderLevel: number
  unitCost: number
  supplierId: string | null
  supplierName: string | null
  isActive: boolean
  isLowStock: boolean
  createdAt: string
}

export interface RawMaterialMovementRecord {
  id: string
  rawMaterialId: string
  materialName: string
  type: string
  quantity: number
  balanceAfter: number
  reference: string | null
  unitCost: number
  notes: string | null
  createdAt: string
}

export async function listRawMaterials(payload?: {
  isActive?: boolean
  lowStock?: boolean
  supplierId?: string
  search?: string
  limit?: number
}): Promise<{ success: boolean; data?: { materials: RawMaterialRecord[]; total: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = { isActive: payload?.isActive ?? true }
    if (payload?.supplierId) where.supplierId = payload.supplierId
    if (payload?.search) where.name = { contains: payload.search }

    const rows = await db.rawMaterial.findMany({
      where,
      orderBy: { name: 'asc' },
      take: payload?.limit ?? 500,
      include: { supplier: { select: { supplierName: true } } }
    })

    let materials = rows.map(toRecord)
    if (payload?.lowStock) materials = materials.filter(m => m.isLowStock)

    return { success: true, data: { materials, total: materials.length } }
  } catch (err) {
    return { success: false, error: { code: 'RM-001', message: err instanceof Error ? err.message : 'Failed to list raw materials.' } }
  }
}

export async function createRawMaterial(payload: {
  name: string
  unit?: string
  currentStock?: number
  reorderLevel?: number
  unitCost?: number
  supplierId?: string
}, userId?: string): Promise<{ success: boolean; data?: RawMaterialRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    const created = await db.$transaction(async (tx) => {
      const mat = await tx.rawMaterial.create({
        data: {
          name: payload.name.trim(),
          unit: payload.unit ?? 'kg',
          currentStock: payload.currentStock ?? 0,
          reorderLevel: payload.reorderLevel ?? 0,
          unitCost: payload.unitCost ?? 0,
          supplierId: payload.supplierId ?? null
        },
        include: { supplier: { select: { supplierName: true } } }
      })
      if ((payload.currentStock ?? 0) > 0) {
        await tx.rawMaterialMovement.create({
          data: {
            rawMaterialId: mat.id,
            type: 'PURCHASE',
            quantity: payload.currentStock!,
            balanceAfter: payload.currentStock!,
            unitCost: payload.unitCost ?? 0,
            notes: 'Opening stock',
            createdById: userId ?? null
          }
        })
      }
      return mat
    })

    await logAction(userId, 'RAW_MATERIAL_CREATED', 'RawMaterial', created.id, undefined, { name: created.name })
    return { success: true, data: toRecord(created) }
  } catch (err) {
    return { success: false, error: { code: 'RM-002', message: err instanceof Error ? err.message : 'Failed to create raw material.' } }
  }
}

export async function updateRawMaterial(payload: {
  id: string
  name?: string
  unit?: string
  reorderLevel?: number
  unitCost?: number
  supplierId?: string | null
}, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.rawMaterial.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'RM-003', message: 'Raw material not found.' } }

    await db.rawMaterial.update({
      where: { id: payload.id },
      data: {
        ...(payload.name ? { name: payload.name.trim() } : {}),
        ...(payload.unit ? { unit: payload.unit } : {}),
        ...(payload.reorderLevel !== undefined ? { reorderLevel: payload.reorderLevel } : {}),
        ...(payload.unitCost !== undefined ? { unitCost: payload.unitCost } : {}),
        ...(payload.supplierId !== undefined ? { supplierId: payload.supplierId } : {})
      }
    })
    await logAction(userId, 'RAW_MATERIAL_UPDATED', 'RawMaterial', payload.id)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'RM-004', message: err instanceof Error ? err.message : 'Failed to update raw material.' } }
  }
}

export async function deleteRawMaterial(id: string, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.rawMaterial.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'RM-003', message: 'Raw material not found.' } }

    // Check if used in any active BOM
    const bomUsage = await db.billOfMaterialItem.count({ where: { rawMaterialId: id } })
    if (bomUsage > 0) {
      return { success: false, error: { code: 'RM-005', message: 'Cannot remove: this material is used in a Bill of Materials.' } }
    }

    await db.rawMaterial.update({ where: { id }, data: { isActive: false } })
    await logAction(userId, 'RAW_MATERIAL_DELETED', 'RawMaterial', id)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'RM-006', message: err instanceof Error ? err.message : 'Failed to delete raw material.' } }
  }
}

export async function adjustRawMaterialStock(payload: {
  id: string
  type: 'PURCHASE' | 'ADJUSTMENT' | 'RETURN'
  quantity: number
  unitCost?: number
  reference?: string
  notes?: string
}, userId?: string): Promise<{ success: boolean; data?: { newStock: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const mat = await db.rawMaterial.findUnique({ where: { id: payload.id } })
    if (!mat) return { success: false, error: { code: 'RM-003', message: 'Raw material not found.' } }

    // For ADJUSTMENT (absolute), validate against current stock before overwrite
    if (payload.type === 'ADJUSTMENT' && payload.quantity < 0) {
      return { success: false, error: { code: 'RM-007', message: 'Adjusted quantity cannot be negative.' } }
    }
    if (payload.type === 'RETURN' && mat.currentStock + payload.quantity < 0) {
      return { success: false, error: { code: 'RM-007', message: 'Insufficient stock for return.' } }
    }

    const result = await db.$transaction(async (tx) => {
      let updated: { currentStock: number }
      if (payload.type === 'ADJUSTMENT') {
        // Set absolute value
        updated = await tx.rawMaterial.update({
          where: { id: payload.id },
          data: { currentStock: payload.quantity },
          select: { currentStock: true }
        })
      } else {
        // PURCHASE or RETURN — use atomic increment (both are positive quantities)
        updated = await tx.rawMaterial.update({
          where: { id: payload.id },
          data: { currentStock: { increment: payload.quantity } },
          select: { currentStock: true }
        })
      }
      const movementQty = payload.type === 'ADJUSTMENT' ? Math.abs(payload.quantity - mat.currentStock) : payload.quantity
      await tx.rawMaterialMovement.create({
        data: {
          rawMaterialId: payload.id,
          type: payload.type,
          quantity: movementQty,
          balanceAfter: updated.currentStock,
          unitCost: payload.unitCost ?? mat.unitCost,
          reference: payload.reference ?? null,
          notes: payload.notes ?? null,
          createdById: userId ?? null
        }
      })
      return updated
    })

    await logAction(userId, 'RAW_MATERIAL_STOCK_ADJUSTED', 'RawMaterial', payload.id, String(mat.currentStock), String(result.currentStock))
    return { success: true, data: { newStock: result.currentStock } }
  } catch (err) {
    return { success: false, error: { code: 'RM-008', message: err instanceof Error ? err.message : 'Failed to adjust stock.' } }
  }
}

export async function getRawMaterialMovements(rawMaterialId: string, limit = 50): Promise<{ success: boolean; data?: RawMaterialMovementRecord[] }> {
  try {
    const db = getPrisma()
    const rows = await db.rawMaterialMovement.findMany({
      where: { rawMaterialId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { rawMaterial: { select: { name: true } } }
    })
    return {
      success: true,
      data: rows.map(r => ({
        id: r.id,
        rawMaterialId: r.rawMaterialId,
        materialName: r.rawMaterial.name,
        type: r.type,
        quantity: r.quantity,
        balanceAfter: r.balanceAfter,
        reference: r.reference,
        unitCost: r.unitCost,
        notes: r.notes,
        createdAt: r.createdAt.toISOString()
      }))
    }
  } catch {
    return { success: true, data: [] }
  }
}

function toRecord(m: { id: string; name: string; unit: string; currentStock: number; reorderLevel: number; unitCost: number; supplierId: string | null; isActive: boolean; createdAt: Date; supplier?: { supplierName: string } | null }): RawMaterialRecord {
  return {
    id: m.id,
    name: m.name,
    unit: m.unit,
    currentStock: m.currentStock,
    reorderLevel: m.reorderLevel,
    unitCost: m.unitCost,
    supplierId: m.supplierId,
    supplierName: m.supplier?.supplierName ?? null,
    isActive: m.isActive,
    isLowStock: m.currentStock <= m.reorderLevel,
    createdAt: m.createdAt.toISOString()
  }
}
