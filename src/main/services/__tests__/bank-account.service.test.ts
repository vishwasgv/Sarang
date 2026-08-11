import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { bankAccountService } from '../bank-account.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  // tx === db: createAccount posts its opening-balance JournalEntry inside
  // its own $transaction, so the callback must see the same mocked rows.
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    bankAccount: {
      create: vi.fn().mockResolvedValue({ id: 'bank-1', accountName: 'HDFC Current', accountType: 'BANK', openingBalance: 0, currentBalance: 0 }),
      findUnique: vi.fn().mockResolvedValue({ id: 'bank-1', accountName: 'HDFC Current', isActive: true }),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    chartOfAccounts: {
      findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '1000', accountName: 'Cash & Bank', accountType: 'ASSET', isActive: true }),
    },
    journalEntry: {
      create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-00001' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
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

describe('bankAccountService.createAccount', () => {
  it('creates a zero-balance account without posting any JournalEntry', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankAccountService.createAccount({ accountName: 'HDFC Current', accountType: 'BANK', openingBalance: 0 })

    expect(res.success).toBe(true)
    expect(db.journalEntry.create).not.toHaveBeenCalled()
  })

  it('posts a real balanced opening-balance JournalEntry (Debit bank-linked Cash & Bank, Credit Owner\'s Capital), and lets that entry\'s own bank-balance-delta move currentBalance rather than double-setting it', async () => {
    // Real bug found live via the E2E suite, not by this test originally:
    // create() used to set currentBalance: payload.openingBalance directly
    // AND post a bankAccountId-linked JournalEntryLine, whose own
    // applyBankBalanceDeltas then incremented it a second time — a real
    // ₹15,000 opening balance landed as ₹30,000. This test asserts the
    // actual create() call args (currentBalance must start at 0) and the
    // actual bankAccount.update increment call, not a mock's canned return
    // value — asserting against the mock's own fixture is exactly what let
    // the double-count bug slip past this test's first version.
    const db = makeDb()
    db.bankAccount.create = vi.fn().mockResolvedValue({ id: 'bank-1', accountName: 'HDFC Current', accountType: 'BANK', openingBalance: 5000, currentBalance: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankAccountService.createAccount({ accountName: 'HDFC Current', accountType: 'BANK', openingBalance: 5000 })

    expect(res.success).toBe(true)
    const createArgs = db.bankAccount.create.mock.calls[0][0]
    expect(createArgs.data.currentBalance).toBe(0)
    expect(db.bankAccount.update).toHaveBeenCalledWith({ where: { id: 'bank-1' }, data: { currentBalance: { increment: 5000 } } })
    expect(db.journalEntry.create).toHaveBeenCalledTimes(1)
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    expect(jeArgs.data.sourceType).toBe('BANK_ACCOUNT_OPENING')
    const lines = jeArgs.data.lines.create as Array<{ debitAmount: number; creditAmount: number; bankAccountId: string | null }>
    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ debitAmount: 5000, creditAmount: 0, bankAccountId: 'bank-1' }),
      expect.objectContaining({ debitAmount: 0, creditAmount: 5000, bankAccountId: null }),
    ]))
  })
})

describe('bankAccountService.updateAccount', () => {
  it('returns error for a non-existent account', async () => {
    const db = makeDb()
    db.bankAccount.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankAccountService.updateAccount({ id: 'ghost', accountName: 'Renamed' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BANK-001')
  })

  it('updates the account fields', async () => {
    const db = makeDb()
    db.bankAccount.update = vi.fn().mockResolvedValue({ id: 'bank-1', accountName: 'Renamed Account' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankAccountService.updateAccount({ id: 'bank-1', accountName: 'Renamed Account' })

    expect(res.success).toBe(true)
    expect(db.bankAccount.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'bank-1' },
      data: expect.objectContaining({ accountName: 'Renamed Account' })
    }))
  })
})
