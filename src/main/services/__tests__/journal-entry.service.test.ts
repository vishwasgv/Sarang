import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { logAction } from '../audit.service'
import { journalEntryService } from '../journal-entry.service'

function makeAccount(overrides: Record<string, unknown> = {}) {
  return { id: 'coa-cash', accountCode: '1000', accountName: 'Cash & Bank', accountType: 'ASSET', isActive: true, ...overrides }
}

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'je-1', entryNumber: 'JE-00001', entryDate: new Date(), narration: 'Test entry',
    sourceType: 'MANUAL', isReversed: false,
    lines: [
      { id: 'jel-1', accountId: 'coa-cash', bankAccountId: null, debitAmount: 1000, creditAmount: 0 },
      { id: 'jel-2', accountId: 'coa-sales', bankAccountId: null, debitAmount: 0, creditAmount: 1000 },
    ],
    ...overrides,
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  // tx === db: createJournalEntry/reverseJournalEntry run their writes inside
  // $transaction, so the callback must see the same mocked rows the tests
  // assert against — same shape as bill.service.test.ts's own makeDb().
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ lockDate: null }) },
    chartOfAccounts: {
      findMany: vi.fn().mockResolvedValue([makeAccount({ id: 'coa-cash', accountCode: '1000' }), makeAccount({ id: 'coa-sales', accountCode: '4000', accountType: 'INCOME' })]),
    },
    journalEntry: {
      create: vi.fn().mockResolvedValue(makeEntry()),
      findUnique: vi.fn().mockResolvedValue(makeEntry()),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    bankAccount: { update: vi.fn().mockResolvedValue({}) },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow }),
      updateMany: vi.fn(async ({ data }: { data: { settingValue: string } }) => {
        if (!settingRow) return { count: 0 }
        settingRow = { ...settingRow, settingValue: data.settingValue }
        return { count: 1 }
      }),
    },
    ...overrides,
  }
  db.$transaction = vi.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)
  )
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('journalEntryService.createJournalEntry', () => {
  it('rejects an unbalanced entry before writing anything', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await journalEntryService.createJournalEntry({
      lines: [
        { accountId: 'coa-cash', debitAmount: 1000, creditAmount: 0 },
        { accountId: 'coa-sales', debitAmount: 0, creditAmount: 900 },
      ],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('JE-001')
    expect(db.journalEntry.create).not.toHaveBeenCalled()
  })

  it('rejects a line referencing an account that does not exist', async () => {
    const db = makeDb()
    db.chartOfAccounts.findMany = vi.fn().mockResolvedValue([makeAccount({ id: 'coa-cash' })]) // only one of two resolved
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await journalEntryService.createJournalEntry({
      lines: [
        { accountId: 'coa-cash', debitAmount: 1000, creditAmount: 0 },
        { accountId: 'coa-ghost', debitAmount: 0, creditAmount: 1000 },
      ],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('COA-001')
  })

  it('rejects a line referencing an inactive account', async () => {
    const db = makeDb()
    db.chartOfAccounts.findMany = vi.fn().mockResolvedValue([
      makeAccount({ id: 'coa-cash' }),
      makeAccount({ id: 'coa-sales', accountType: 'INCOME', isActive: false }),
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await journalEntryService.createJournalEntry({
      lines: [
        { accountId: 'coa-cash', debitAmount: 1000, creditAmount: 0 },
        { accountId: 'coa-sales', debitAmount: 0, creditAmount: 1000 },
      ],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('COA-008')
  })

  it('creates a balanced entry and moves a bank-linked line\'s BankAccount.currentBalance', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await journalEntryService.createJournalEntry({
      narration: 'Cash sale',
      lines: [
        { accountId: 'coa-cash', bankAccountId: 'bank-1', debitAmount: 1000, creditAmount: 0 },
        { accountId: 'coa-sales', debitAmount: 0, creditAmount: 1000 },
      ],
    })

    expect(res.success).toBe(true)
    expect(db.journalEntry.create).toHaveBeenCalledTimes(1)
    // Debit on an ASSET (bank) line increases the running balance.
    expect(db.bankAccount.update).toHaveBeenCalledWith({ where: { id: 'bank-1' }, data: { currentBalance: { increment: 1000 } } })
  })
})

describe('journalEntryService.reverseJournalEntry', () => {
  it('rejects reversing an already-reversed entry', async () => {
    const db = makeDb()
    db.journalEntry.findUnique = vi.fn().mockResolvedValue(makeEntry({ isReversed: true }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await journalEntryService.reverseJournalEntry('je-1', 'Mistake')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('JE-004')
  })

  it('posts a real mirrored reversing entry (debit/credit swapped) and marks the original reversed', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await journalEntryService.reverseJournalEntry('je-1', 'Wrong account used')

    expect(res.success).toBe(true)
    expect(db.journalEntry.update).toHaveBeenCalledWith({ where: { id: 'je-1' }, data: { isReversed: true, reversalReason: 'Wrong account used' } })
    const reversalCreate = vi.mocked(db.journalEntry.create).mock.calls[0][0] as { data: { lines: { create: Array<{ accountId: string; debitAmount: number; creditAmount: number }> } } }
    const lines = reversalCreate.data.lines.create
    // Original: coa-cash debit 1000 / coa-sales credit 1000 — reversal swaps both.
    expect(lines.find((l) => l.accountId === 'coa-cash')).toMatchObject({ debitAmount: 0, creditAmount: 1000 })
    expect(lines.find((l) => l.accountId === 'coa-sales')).toMatchObject({ debitAmount: 1000, creditAmount: 0 })
  })

  // Real bug found live 2026-08-12 (Phase 62 UAT against the real running
  // app — not this mock, which can't reproduce SQLite locking at all):
  // reverseEntryTx runs INSIDE the caller's own $transaction, so calling
  // plain logAction() from there opened a SECOND, separate transaction
  // against the same SQLite file and self-deadlocked against the still-open
  // first one, silently burning ~5s (SQLite's busy_timeout) and then
  // blowing the outer transaction's own interactive-timeout budget — every
  // void/cancel/reversal with a posted GL entry failed with an opaque
  // SYS-001. This test can't reproduce the deadlock itself, but it locks in
  // the contract that actually fixes it: logAction must always receive the
  // caller's own tx here, never be called bare.
  it('passes its own transaction client through to logAction, not a bare call', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await journalEntryService.reverseJournalEntry('je-1', 'Wrong account used')

    expect(vi.mocked(logAction)).toHaveBeenCalledWith(expect.objectContaining({ action: 'JOURNAL_ENTRY_REVERSED', tx: db }))
  })
})
