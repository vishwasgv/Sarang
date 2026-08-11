import { journalEntryService } from '../../services/journal-entry.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { transactionLockService } from '../../services/transaction-lock.service'
import { CreateJournalEntrySchema, ReverseJournalEntrySchema } from '../../validation/journal-entry.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('journalEntries:list', async (payload) => {
    const deny = await requirePermission('journalEntries.view'); if (deny) return deny
    return journalEntryService.listJournalEntries(payload as { sourceType?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number } | undefined)
  })

  handle('journalEntries:get', async (id) => {
    const deny = await requirePermission('journalEntries.view'); if (deny) return deny
    return journalEntryService.getJournalEntry(id as string)
  })

  handle('journalEntries:create', async (payload) => {
    const deny = await requirePermission('journalEntries.create'); if (deny) return deny
    const parsed = CreateJournalEntrySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return journalEntryService.createJournalEntry(parsed.data, getCurrentSession()?.userId)
  })

  handle('journalEntries:reverse', async (payload) => {
    const deny = await requirePermission('journalEntries.reverse'); if (deny) return deny
    const parsed = ReverseJournalEntrySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return journalEntryService.reverseJournalEntry(parsed.data.id, parsed.data.reason, getCurrentSession()?.userId)
  })

  // ── Transaction Locking (admin-only, per Section 4.1 item 5) ──
  handle('transactionLock:getLockDate', async () => {
    const deny = await requirePermission('transactionLock.manage'); if (deny) return deny
    return transactionLockService.getLockDate()
  })

  handle('transactionLock:setLockDate', async (payload) => {
    const deny = await requirePermission('transactionLock.manage'); if (deny) return deny
    const p = payload as { lockDate: string | null }
    return transactionLockService.setLockDate(p.lockDate, getCurrentSession()?.userId)
  })
}
