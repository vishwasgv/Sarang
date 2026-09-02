import { khataReminderService } from '../../services/khata-reminder.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

// 2026-09 §12 — Grocery/Kirana item 3: Khata (credit) auto-reminder. Gated on
// the existing reports.outstanding permission — this is directly an
// extension of the Outstanding report's own action surface, not a new
// permission-catalog entry.
export function register(handle: HandleFn): void {
  handle('khataReminder:listCandidates', async () => {
    const deny = await requirePermission('reports.outstanding'); if (deny) return deny
    return khataReminderService.listKhataReminderCandidates()
  })

  handle('khataReminder:buildLink', async (payload) => {
    const deny = await requirePermission('reports.outstanding'); if (deny) return deny
    const { customerId } = (payload ?? {}) as { customerId?: string }
    const bad = validateId(customerId, 'customer ID'); if (bad) return bad
    return khataReminderService.buildKhataReminderLink(customerId as string)
  })
}
