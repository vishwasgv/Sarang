import {
  listRawMaterials,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
  adjustRawMaterialStock,
  getRawMaterialMovements
} from '../../services/raw-material.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateRawMaterialSchema, UpdateRawMaterialSchema, RawMaterialIdSchema, AdjustRawMaterialStockSchema } from '../../validation/raw-material.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('rawMaterials:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return listRawMaterials(payload as Parameters<typeof listRawMaterials>[0])
  })

  handle('rawMaterials:create', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = CreateRawMaterialSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createRawMaterial(parsed.data, getCurrentSession()?.userId)
  })

  handle('rawMaterials:update', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = UpdateRawMaterialSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateRawMaterial(parsed.data, getCurrentSession()?.userId)
  })

  handle('rawMaterials:delete', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = RawMaterialIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteRawMaterial(parsed.data.id, getCurrentSession()?.userId)
  })

  handle('rawMaterials:adjustStock', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = AdjustRawMaterialStockSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return adjustRawMaterialStock(parsed.data, getCurrentSession()?.userId)
  })

  handle('rawMaterials:movements', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { rawMaterialId: string; limit?: number }
    return getRawMaterialMovements(p.rawMaterialId, p.limit)
  })
}
