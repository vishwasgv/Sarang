import {
  listJobOrders, getJobOrder, createJobOrder, updateJobOrder, deleteJobOrder
} from '../../services/job-order.service'
import { requirePermission } from '../permission-guard'
import { CreateJobOrderSchema, UpdateJobOrderSchema, JobOrderIdSchema } from '../../validation/job-order.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerJobOrder(handle: HandleFn): void {
  handle('jobOrder:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listJobOrders(raw as Parameters<typeof listJobOrders>[0])
  })

  handle('jobOrder:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getJobOrder(raw as string)
  })

  handle('jobOrder:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateJobOrderSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createJobOrder(parsed.data)
  })

  handle('jobOrder:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateJobOrderSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateJobOrder(parsed.data)
  })

  handle('jobOrder:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = JobOrderIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteJobOrder(parsed.data)
  })
}
