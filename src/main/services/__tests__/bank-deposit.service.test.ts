import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { bankDepositService } from '../bank-deposit.service'

function makeCheque(overrides: Record<string, unknown> = {}) {
  return { id: 'pdc-1', bankAccountId: 'bank-1', chequeNumber: '000123', direction: 'RECEIVED', amount: 5000, status: 'PENDING', ...overrides }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    bankAccount: { findUnique: vi.fn().mockResolvedValue({ id: 'bank-1', accountName: 'HDFC Current' }), update: vi.fn().mockResolvedValue({}) },
    bankDeposit: {
      create: vi.fn().mockResolvedValue({ id: 'dep-1', depositNumber: 'DEP-00001', bankAccountId: 'bank-1', depositDate: new Date('2026-09-02'), denominations: '{}', cashTotal: 0, chequeTotal: 0, totalAmount: 0, notes: null, createdAt: new Date() }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    postDatedCheque: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa-1000', accountCode: '1000', accountName: 'Cash & Bank', accountType: 'ASSET', isActive: true }) },
    journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-00001' }), findMany: vi.fn().mockResolvedValue([]) },
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

describe('bankDepositService.createDeposit', () => {
  it('returns error for a non-existent bank account', async () => {
    const db = makeDb({ bankAccount: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankDepositService.createDeposit({ bankAccountId: 'ghost', depositDate: '2026-09-02', denominations: { '500': 1 } })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BANK-001')
  })

  it('rejects an empty deposit (zero cash, no cheques)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankDepositService.createDeposit({ bankAccountId: 'bank-1', depositDate: '2026-09-02', denominations: { '500': 0 } })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DEP-004')
    expect(db.bankDeposit.create).not.toHaveBeenCalled()
  })

  it('computes cash total correctly from note denominations', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 3×500 + 10×100 + 5×10 = 1500 + 1000 + 50 = 2550
    const res = await bankDepositService.createDeposit({
      bankAccountId: 'bank-1', depositDate: '2026-09-02',
      denominations: { '500': 3, '100': 10, '10': 5 }
    })

    expect(res.success).toBe(true)
    expect(db.bankDeposit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cashTotal: 2550, chequeTotal: 0, totalAmount: 2550 })
    }))
  })

  it('posts a balanced JournalEntry for the cash portion: Debit the destination account, Credit generic cash', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankDepositService.createDeposit({ bankAccountId: 'bank-1', depositDate: '2026-09-02', denominations: { '500': 2 } })

    expect(res.success).toBe(true)
    expect(db.journalEntry.create).toHaveBeenCalledTimes(1)
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    expect(jeArgs.data.sourceType).toBe('BANK_DEPOSIT')
    const lines = jeArgs.data.lines.create as Array<{ debitAmount: number; creditAmount: number; bankAccountId: string | null }>
    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ debitAmount: 1000, creditAmount: 0, bankAccountId: 'bank-1' }),
      expect.objectContaining({ debitAmount: 0, creditAmount: 1000, bankAccountId: null }),
    ]))
  })

  it('rejects a cheque that is not PENDING', async () => {
    const db = makeDb({ postDatedCheque: { findMany: vi.fn().mockResolvedValue([makeCheque({ status: 'CLEARED' })]), updateMany: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankDepositService.createDeposit({ bankAccountId: 'bank-1', depositDate: '2026-09-02', denominations: {}, chequeIds: ['pdc-1'] })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DEP-002')
  })

  it('rejects a cheque belonging to a different bank account', async () => {
    const db = makeDb({ postDatedCheque: { findMany: vi.fn().mockResolvedValue([makeCheque({ bankAccountId: 'bank-2' })]), updateMany: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankDepositService.createDeposit({ bankAccountId: 'bank-1', depositDate: '2026-09-02', denominations: {}, chequeIds: ['pdc-1'] })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DEP-003')
  })

  it('including a valid pending cheque marks it DEPOSITED and links bankDepositId, without posting a JournalEntry for its amount', async () => {
    const db = makeDb({ postDatedCheque: { findMany: vi.fn().mockResolvedValue([makeCheque({ amount: 7000 })]), updateMany: vi.fn().mockResolvedValue({ count: 1 }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankDepositService.createDeposit({ bankAccountId: 'bank-1', depositDate: '2026-09-02', denominations: {}, chequeIds: ['pdc-1'] })

    expect(res.success).toBe(true)
    expect(db.postDatedCheque.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['pdc-1'] } },
      data: expect.objectContaining({ status: 'DEPOSITED', bankDepositId: 'dep-1' })
    }))
    expect(db.bankDeposit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cashTotal: 0, chequeTotal: 7000, totalAmount: 7000 })
    }))
    // Only the cash portion posts a JournalEntry (0 here) — cash-only postSystemEntry
    // call is skipped entirely when cashTotal is 0, so the cheque amount never
    // touches the GL through this path; it posts later when the cheque clears.
    expect(db.journalEntry.create).not.toHaveBeenCalled()
  })

  it('mixed cash + cheque deposit sums both into totalAmount, and only posts the cash portion to the GL', async () => {
    const db = makeDb({ postDatedCheque: { findMany: vi.fn().mockResolvedValue([makeCheque({ amount: 3000 })]), updateMany: vi.fn().mockResolvedValue({ count: 1 }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankDepositService.createDeposit({ bankAccountId: 'bank-1', depositDate: '2026-09-02', denominations: { '500': 4 }, chequeIds: ['pdc-1'] })

    expect(res.success).toBe(true)
    expect(db.bankDeposit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cashTotal: 2000, chequeTotal: 3000, totalAmount: 5000 })
    }))
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    const lines = jeArgs.data.lines.create as Array<{ debitAmount: number; creditAmount: number }>
    expect(lines.reduce((s: number, l: { debitAmount: number }) => s + l.debitAmount, 0)).toBe(2000)
  })
})
