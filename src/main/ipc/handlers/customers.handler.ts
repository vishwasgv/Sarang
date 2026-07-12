import * as customerService from '../../services/customer.service'
import { requirePermission } from '../permission-guard'
import { CreateCustomerSchema, UpdateCustomerSchema } from '../../validation/customer.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('customers:list', async (payload) => {
    const deny = await requirePermission('customers.view'); if (deny) return deny
    const f = (payload ?? {}) as { page?: number; limit?: number; search?: string }
    return customerService.listCustomers(f)
  })

  handle('customers:listOutstanding', async () => {
    const deny = await requirePermission('customers.view'); if (deny) return deny
    return customerService.listOutstandingCustomers()
  })

  handle('customers:get', async (id) => {
    const deny = await requirePermission('customers.view'); if (deny) return deny
    const bad = validateId(id, 'customer ID'); if (bad) return bad
    return customerService.getCustomer(id as string)
  })

  handle('customers:create', async (payload) => {
    const deny = await requirePermission('customers.create'); if (deny) return deny
    const parsed = CreateCustomerSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    return customerService.createCustomer(parsed.data)
  })

  handle('customers:update', async (payload) => {
    const deny = await requirePermission('customers.update'); if (deny) return deny
    const parsed = UpdateCustomerSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    return customerService.updateCustomer(parsed.data)
  })

  handle('customers:archive', async (id) => {
    const deny = await requirePermission('customers.archive'); if (deny) return deny
    const bad = validateId(id, 'customer ID'); if (bad) return bad
    return customerService.archiveCustomer(id as string)
  })

  handle('customers:getLedger', async (id) => {
    const deny = await requirePermission('customers.viewLedger'); if (deny) return deny
    const bad = validateId(id, 'customer ID'); if (bad) return bad
    return customerService.getCustomerLedger(id as string)
  })

  handle('customers:search', async (query) => {
    const deny = await requirePermission('customers.view'); if (deny) return deny
    return customerService.searchCustomers((query as string) ?? '')
  })
}
