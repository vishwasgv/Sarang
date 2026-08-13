import {
  listProductionOrders,
  getProductionOrder,
  createProductionOrder,
  startProductionOrder,
  completeProductionOrder,
  cancelProductionOrder,
  addProductionLaborEntry,
  removeProductionLaborEntry
} from '../../services/production-order.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  CreateProductionOrderSchema, ProductionOrderIdSchema, CompleteProductionOrderSchema, CancelProductionOrderSchema,
  AddProductionLaborEntrySchema, ProductionLaborEntryIdSchema
} from '../../validation/production.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('production:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return listProductionOrders(payload as Parameters<typeof listProductionOrders>[0])
  })

  handle('production:get', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { id: string }
    return getProductionOrder(p.id)
  })

  handle('production:create', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = CreateProductionOrderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createProductionOrder(parsed.data, getCurrentSession()?.userId)
  })

  handle('production:start', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = ProductionOrderIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return startProductionOrder(parsed.data.id, getCurrentSession()?.userId)
  })

  handle('production:complete', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = CompleteProductionOrderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return completeProductionOrder(parsed.data, getCurrentSession()?.userId)
  })

  handle('production:cancel', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = CancelProductionOrderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return cancelProductionOrder(parsed.data, getCurrentSession()?.userId)
  })

  // Phase 64 — job costing
  handle('production:addLaborEntry', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = AddProductionLaborEntrySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return addProductionLaborEntry(parsed.data, getCurrentSession()?.userId)
  })

  handle('production:removeLaborEntry', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = ProductionLaborEntryIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return removeProductionLaborEntry(parsed.data.id, getCurrentSession()?.userId)
  })
}
