import { requirePermission } from '../permission-guard'
import {
  listComplianceTasks,
  createComplianceTask,
  updateComplianceTask,
  deleteComplianceTask,
} from '../../services/compliance-task.service'
import { CreateComplianceTaskSchema, UpdateComplianceTaskSchema, ComplianceTaskIdSchema } from '../../validation/compliance-task.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('complianceTask:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { clientId?: string; staffId?: string; status?: string; category?: string; fromDate?: string; toDate?: string }
    return listComplianceTasks(payload)
  })

  handle('complianceTask:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateComplianceTaskSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createComplianceTask(parsed.data)
  })

  handle('complianceTask:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateComplianceTaskSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateComplianceTask(parsed.data)
  })

  handle('complianceTask:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = ComplianceTaskIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteComplianceTask(parsed.data.id)
  })
}
