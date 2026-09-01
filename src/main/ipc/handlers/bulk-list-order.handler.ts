import { createBulkListOrder, listBulkListOrders, matchBulkListOrderItem, deleteBulkListOrder, billBulkListOrder, getAnnualReorderReminders } from '../../services/bulk-list-order.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateBulkListOrderSchema, MatchBulkListOrderItemSchema, BillBulkListOrderSchema } from '../../validation/bulk-list-order.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('bulkListOrder:list', async (payload) => {
    const deny = await requirePermission('bulkListOrder.view'); if (deny) return deny
    return listBulkListOrders(payload as Parameters<typeof listBulkListOrders>[0])
  })

  handle('bulkListOrder:create', async (payload) => {
    const deny = await requirePermission('bulkListOrder.manage'); if (deny) return deny
    const parsed = CreateBulkListOrderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return createBulkListOrder({ ...parsed.data, createdById: session?.userId })
  })

  handle('bulkListOrder:matchItem', async (payload) => {
    const deny = await requirePermission('bulkListOrder.manage'); if (deny) return deny
    const parsed = MatchBulkListOrderItemSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return matchBulkListOrderItem(parsed.data.itemId, parsed.data.productId, parsed.data.unitPrice)
  })

  handle('bulkListOrder:delete', async (payload) => {
    const deny = await requirePermission('bulkListOrder.manage'); if (deny) return deny
    const { id } = payload as { id: string }
    return deleteBulkListOrder(id)
  })

  handle('bulkListOrder:bill', async (payload) => {
    const deny = await requirePermission('bulkListOrder.manage'); if (deny) return deny
    const parsed = BillBulkListOrderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return billBulkListOrder(parsed.data.orderId, parsed.data.paymentMethod, session?.userId)
  })

  // Phase 69 — Stationery wow feature: Annual Reorder Reminder.
  handle('bulkListOrder:reorderReminders', async () => {
    const deny = await requirePermission('bulkListOrder.view'); if (deny) return deny
    return getAnnualReorderReminders()
  })
}
