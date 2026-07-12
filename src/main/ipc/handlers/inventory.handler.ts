import { inventoryService } from '../../services/inventory.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { AddStockSchema, AdjustStockSchema } from '../../validation/inventory.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('inventory:get', async (productId) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const bad = validateId(productId, 'product ID'); if (bad) return bad
    return inventoryService.getInventory(productId as string)
  })

  handle('inventory:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return inventoryService.listInventory(payload as { lowStockOnly?: boolean; page?: number; limit?: number; search?: string } | undefined)
  })

  handle('inventory:addStock', async (payload) => {
    const deny = await requirePermission('inventory.addStock'); if (deny) return deny
    const parsed = AddStockSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return inventoryService.addStock(parsed.data, getCurrentSession()?.userId)
  })

  handle('inventory:adjustStock', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const parsed = AdjustStockSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return inventoryService.adjustStock(parsed.data, getCurrentSession()?.userId)
  })

  handle('inventory:getMovements', async (payload) => {
    const deny = await requirePermission('inventory.viewMovements'); if (deny) return deny
    return inventoryService.getMovements(payload as { productId?: string; movementType?: string; page?: number; limit?: number } | undefined)
  })

  handle('inventory:getInventoryValue', async () => {
    const deny = await requirePermission('inventory.valuation'); if (deny) return deny
    return inventoryService.getInventoryValue()
  })
}
