import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'
import { journalEntryService } from './journal-entry.service'

// Two small journal helpers: entries that undo themselves on a chosen date, and memorandum notes that never touch the books.

/** Reverses every journal entry whose "reverse on" date has arrived. Locked periods and failures are skipped and retried next time. */
export async function processDueReversals(now: Date = new Date()): Promise<{ reversed: number; skipped: number }> {
  const db = getPrisma()
  const due = await db.journalEntry.findMany({ where: { autoReverseOn: { lte: now }, isReversed: false }, select: { id: true, entryNumber: true } })
  let reversed = 0
  let skipped = 0
  for (const e of due) {
    const res = await journalEntryService.reverseJournalEntry(e.id, `Automatic reversal of ${e.entryNumber}`)
    if (res.success) reversed++
    else skipped++
  }
  return { reversed, skipped }
}

function fail(err: unknown) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Something unexpected happened. Please try again.' } }
}

export const journalMemoService = {
  async list() {
    try {
      const rows = await getPrisma().journalMemo.findMany({ orderBy: { memoDate: 'desc' }, take: 200 })
      return { success: true, data: rows.map((r) => ({ ...r, memoDate: r.memoDate.toISOString(), createdAt: r.createdAt.toISOString() })) }
    } catch (err) {
      return fail(err)
    }
  },

  async add(p: { title: string; notes?: string; memoDate?: string }, userId?: string) {
    try {
      const title = p.title.trim()
      if (!title) throw new ServiceError('MEMO-001', 'Give the memo a title.')
      const row = await getPrisma().journalMemo.create({
        data: { title: title.slice(0, 120), notes: p.notes?.trim() || null, memoDate: p.memoDate ? new Date(p.memoDate) : new Date(), createdById: userId ?? null }
      })
      await logAction({ userId, action: 'JOURNAL_MEMO_ADDED', entityType: 'JournalMemo', entityId: row.id })
      return { success: true, data: { id: row.id } }
    } catch (err) {
      return fail(err)
    }
  },

  async remove(id: string, userId?: string) {
    try {
      await getPrisma().journalMemo.deleteMany({ where: { id } })
      await logAction({ userId, action: 'JOURNAL_MEMO_DELETED', entityType: 'JournalMemo', entityId: id })
      return { success: true }
    } catch (err) {
      return fail(err)
    }
  }
}
