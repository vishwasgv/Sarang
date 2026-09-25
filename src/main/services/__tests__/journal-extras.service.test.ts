import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../journal-entry.service', () => ({ journalEntryService: { reverseJournalEntry: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { journalEntryService } from '../journal-entry.service'
import { processDueReversals, journalMemoService } from '../journal-extras.service'

describe('journal auto-reversal and memos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reverses due entries, counts skipped ones (e.g. locked period)', async () => {
    const db = { journalEntry: { findMany: vi.fn().mockResolvedValue([{ id: 'a', entryNumber: 'JE-1' }, { id: 'b', entryNumber: 'JE-2' }]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(journalEntryService.reverseJournalEntry)
      .mockResolvedValueOnce({ success: true } as never)
      .mockResolvedValueOnce({ success: false, error: { code: 'LOCK-001', message: 'locked' } } as never)
    const now = new Date(2026, 8, 30)
    expect(await processDueReversals(now)).toEqual({ reversed: 1, skipped: 1 })
    expect(db.journalEntry.findMany.mock.calls[0][0].where).toEqual({ autoReverseOn: { lte: now }, isReversed: false })
  })

  it('does nothing when nothing is due', async () => {
    vi.mocked(getPrisma).mockReturnValue({ journalEntry: { findMany: vi.fn().mockResolvedValue([]) } } as never)
    expect(await processDueReversals()).toEqual({ reversed: 0, skipped: 0 })
    expect(journalEntryService.reverseJournalEntry).not.toHaveBeenCalled()
  })

  it('memos need a title and are trimmed', async () => {
    const db = { journalMemo: { create: vi.fn().mockResolvedValue({ id: 'm1' }) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    expect((await journalMemoService.add({ title: '  ' })).success).toBe(false)
    expect((await journalMemoService.add({ title: ' Stock on approval ', notes: ' 20 units ' })).success).toBe(true)
    expect(db.journalMemo.create.mock.calls[0][0].data.title).toBe('Stock on approval')
    expect(db.journalMemo.create.mock.calls[0][0].data.notes).toBe('20 units')
  })
})
