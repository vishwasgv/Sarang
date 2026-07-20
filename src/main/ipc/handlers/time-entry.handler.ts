import { requirePermission } from '../permission-guard'
import {
  listTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  markTimeEntriesBilled,
  generateTimeEntryInvoice,
} from '../../services/time-entry.service'
import { CreateTimeEntrySchema, UpdateTimeEntrySchema, DeleteTimeEntrySchema, TimeEntryIdsSchema } from '../../validation/time-entry.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('timeEntry:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { caseId?: string; projectId?: string; retainerId?: string; employeeId?: string; isBilled?: boolean; fromDate?: string; toDate?: string }
    return listTimeEntries(payload)
  })

  handle('timeEntry:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateTimeEntrySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createTimeEntry(parsed.data)
  })

  handle('timeEntry:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateTimeEntrySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateTimeEntry(parsed.data)
  })

  handle('timeEntry:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeleteTimeEntrySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteTimeEntry(parsed.data.id)
  })

  handle('timeEntry:markBilled', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = TimeEntryIdsSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return markTimeEntriesBilled(parsed.data.ids)
  })

  handle('timeEntry:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = TimeEntryIdsSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateTimeEntryInvoice(parsed.data.ids)
  })
}
