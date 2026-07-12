import { requirePermission } from '../permission-guard'
import {
  listTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  markTimeEntriesBilled,
  generateTimeEntryInvoice,
} from '../../services/time-entry.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('timeEntry:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { caseId?: string; projectId?: string; employeeId?: string; isBilled?: boolean; fromDate?: string; toDate?: string }
    return listTimeEntries(payload)
  })

  handle('timeEntry:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { caseId?: string; projectId?: string; employeeId?: string; date: string; description: string; hours: number; ratePerHour: number }
    return createTimeEntry(payload)
  })

  handle('timeEntry:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; date?: string; description?: string; hours?: number; ratePerHour?: number }
    return updateTimeEntry(payload)
  })

  handle('timeEntry:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteTimeEntry(payload.id)
  })

  handle('timeEntry:markBilled', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { ids: string[] }
    return markTimeEntriesBilled(payload.ids)
  })

  handle('timeEntry:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { ids: string[] }
    return generateTimeEntryInvoice(payload.ids)
  })
}
