import { purchaseOrderService } from '../../services/purchase-order.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreatePOSchema, CancelPOSchema } from '../../validation/purchase-order.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('purchaseOrders:list', async (payload) => {
    const deny = await requirePermission('purchaseOrders.view'); if (deny) return deny
    return purchaseOrderService.listPOs(payload as { supplierId?: string; status?: string; page?: number; limit?: number } | undefined)
  })

  handle('purchaseOrders:get', async (id) => {
    const deny = await requirePermission('purchaseOrders.view'); if (deny) return deny
    const bad = validateId(id, 'purchase order ID'); if (bad) return bad
    return purchaseOrderService.getPO(id as string)
  })

  handle('purchaseOrders:create', async (payload) => {
    const deny = await requirePermission('purchaseOrders.create'); if (deny) return deny
    const parsed = CreatePOSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return purchaseOrderService.createPO(parsed.data, getCurrentSession()?.userId)
  })

  handle('purchaseOrders:approve', async (id) => {
    const deny = await requirePermission('purchaseOrders.approve'); if (deny) return deny
    const bad = validateId(id, 'purchase order ID'); if (bad) return bad
    return purchaseOrderService.approvePO(id as string)
  })

  handle('purchaseOrders:receive', async (id) => {
    const deny = await requirePermission('purchaseOrders.receive'); if (deny) return deny
    const bad = validateId(id, 'purchase order ID'); if (bad) return bad
    return purchaseOrderService.receivePO(id as string, getCurrentSession()?.userId)
  })

  handle('purchaseOrders:cancel', async (payload) => {
    const deny = await requirePermission('purchaseOrders.cancel'); if (deny) return deny
    const parsed = CancelPOSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return purchaseOrderService.cancelPO(parsed.data.id, parsed.data.reason)
  })
}
