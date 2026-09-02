import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { chartOfAccountsService } from '../chart-of-accounts.service'

function makeAccount(overrides: Record<string, unknown> = {}) {
  return { id: 'coa-1', accountCode: '4000', accountName: 'Sales Revenue', accountType: 'INCOME', isSystem: false, isActive: true, ...overrides }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    chartOfAccounts: {
      count: vi.fn().mockResolvedValue(13),
      createMany: vi.fn().mockResolvedValue({ count: 13 }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(makeAccount()),
      update: vi.fn().mockResolvedValue(makeAccount()),
    },
    ...overrides,
  }
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('chartOfAccountsService.createAccount', () => {
  it('rejects a duplicate account code', async () => {
    const db = makeDb()
    db.chartOfAccounts.findUnique = vi.fn().mockResolvedValue(makeAccount())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await chartOfAccountsService.createAccount({ accountCode: '4000', accountName: 'Dup', accountType: 'INCOME' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('COA-002')
  })

  it('rejects when the given parent account does not exist', async () => {
    const db = makeDb()
    db.chartOfAccounts.findUnique = vi.fn()
      .mockResolvedValueOnce(null) // accountCode uniqueness check
      .mockResolvedValueOnce(null) // parent lookup
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await chartOfAccountsService.createAccount({ accountCode: '4100', accountName: 'Sub', accountType: 'INCOME', parentId: 'ghost' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('COA-003')
  })

  it('rejects a child account whose type does not match its parent\'s', async () => {
    const db = makeDb()
    db.chartOfAccounts.findUnique = vi.fn()
      .mockResolvedValueOnce(null) // accountCode uniqueness check
      .mockResolvedValueOnce(makeAccount({ accountType: 'EXPENSE' })) // parent lookup
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await chartOfAccountsService.createAccount({ accountCode: '4100', accountName: 'Sub', accountType: 'INCOME', parentId: 'coa-parent' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('COA-004')
  })

  it('creates a valid top-level account', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await chartOfAccountsService.createAccount({ accountCode: '4200', accountName: 'Other Income', accountType: 'INCOME' })

    expect(res.success).toBe(true)
    expect(db.chartOfAccounts.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accountCode: '4200', accountType: 'INCOME', isSystem: false })
    }))
  })
})

describe('chartOfAccountsService.updateAccount', () => {
  it('rejects deactivating a system account', async () => {
    const db = makeDb()
    db.chartOfAccounts.findUnique = vi.fn().mockResolvedValue(makeAccount({ isSystem: true }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await chartOfAccountsService.updateAccount({ id: 'coa-1', isActive: false })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('COA-005')
  })
})

describe('chartOfAccountsService.listAccounts', () => {
  it('lazy-seeds the 13 standard system accounts on a fresh install with zero accounts', async () => {
    const db = makeDb()
    db.chartOfAccounts.count = vi.fn().mockResolvedValue(0)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await chartOfAccountsService.listAccounts()

    expect(db.chartOfAccounts.createMany).toHaveBeenCalledTimes(1)
    const seeded = vi.mocked(db.chartOfAccounts.createMany).mock.calls[0][0].data as Array<{ accountCode: string; isSystem: boolean }>
    expect(seeded).toHaveLength(14)
    expect(seeded.every((a) => a.isSystem)).toBe(true)
  })

  it('does not re-seed when accounts already exist', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await chartOfAccountsService.listAccounts()

    expect(db.chartOfAccounts.createMany).not.toHaveBeenCalled()
  })
})

describe('chartOfAccountsService.getSystemAccountByCode', () => {
  it('throws a ServiceError when the system account is missing', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await expect(chartOfAccountsService.getSystemAccountByCode('9999', db)).rejects.toThrow('9999')
  })

  it('resolves the account when it exists', async () => {
    const db = makeDb()
    db.chartOfAccounts.findUnique = vi.fn().mockResolvedValue(makeAccount({ accountCode: '1000' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const account = await chartOfAccountsService.getSystemAccountByCode('1000', db)
    expect(account.accountCode).toBe('1000')
  })
})
