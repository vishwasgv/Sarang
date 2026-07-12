import * as supplierService from '../../services/supplier.service'
import { supplierLedgerService } from '../../services/supplier-ledger.service'
import { requirePermission } from '../permission-guard'
import { CreateSupplierSchema, UpdateSupplierSchema } from '../../validation/supplier.validation'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('suppliers:list', async (payload) => {
    const deny = await requirePermission('suppliers.view'); if (deny) return deny
    const f = (payload ?? {}) as { page?: number; limit?: number; search?: string }
    return supplierService.listSuppliers(f)
  })

  handle('suppliers:get', async (id) => {
    const deny = await requirePermission('suppliers.view'); if (deny) return deny
    const bad = validateId(id, 'supplier ID'); if (bad) return bad
    return supplierService.getSupplier(id as string)
  })

  handle('suppliers:create', async (payload) => {
    const deny = await requirePermission('suppliers.create'); if (deny) return deny
    const parsed = CreateSupplierSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    return supplierService.createSupplier(parsed.data)
  })

  handle('suppliers:update', async (payload) => {
    const deny = await requirePermission('suppliers.update'); if (deny) return deny
    const parsed = UpdateSupplierSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    return supplierService.updateSupplier(parsed.data)
  })

  handle('suppliers:archive', async (id) => {
    const deny = await requirePermission('suppliers.archive'); if (deny) return deny
    const bad = validateId(id, 'supplier ID'); if (bad) return bad
    return supplierService.archiveSupplier(id as string)
  })

  handle('suppliers:getLedger', async (id) => {
    const deny = await requirePermission('suppliers.viewLedger'); if (deny) return deny
    const bad = validateId(id, 'supplier ID'); if (bad) return bad
    return supplierService.getSupplierLedger(id as string)
  })

  handle('suppliers:search', async (query) => {
    const deny = await requirePermission('suppliers.view'); if (deny) return deny
    return supplierService.searchSuppliers((query as string) ?? '')
  })

  handle('suppliers:recordPayment', async (payload) => {
    const deny = await requirePermission('suppliers.recordPayment'); if (deny) return deny
    const p = (payload ?? {}) as { supplierId?: string; amount?: number; paymentMethod?: string; referenceNumber?: string; remarks?: string }
    if (!p.supplierId) return { success: false, error: { code: 'VAL-001', message: 'supplierId is required.' } }
    if (!p.amount || p.amount <= 0) return { success: false, error: { code: 'VAL-001', message: 'amount must be > 0.' } }
    return supplierLedgerService.recordPayment({ supplierId: p.supplierId, amount: p.amount, paymentMethod: p.paymentMethod ?? 'CASH', referenceNumber: p.referenceNumber, remarks: p.remarks }, getCurrentSession()?.userId)
  })
}
