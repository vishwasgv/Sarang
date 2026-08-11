import { billService } from '../../services/bill.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateBillSchema, VoidBillSchema } from '../../validation/bill.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('bills:list', async (payload) => {
    const deny = await requirePermission('bills.view'); if (deny) return deny
    return billService.listBills(payload as { supplierId?: string; status?: string; page?: number; limit?: number } | undefined)
  })

  handle('bills:get', async (id) => {
    const deny = await requirePermission('bills.view'); if (deny) return deny
    const bad = validateId(id, 'bill ID'); if (bad) return bad
    return billService.getBill(id as string)
  })

  handle('bills:create', async (payload) => {
    const deny = await requirePermission('bills.create'); if (deny) return deny
    const parsed = CreateBillSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return billService.createBill(parsed.data, getCurrentSession()?.userId)
  })

  handle('bills:void', async (payload) => {
    const deny = await requirePermission('bills.void'); if (deny) return deny
    const parsed = VoidBillSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return billService.voidBill(parsed.data.id, parsed.data.reason, getCurrentSession()?.userId)
  })
}
