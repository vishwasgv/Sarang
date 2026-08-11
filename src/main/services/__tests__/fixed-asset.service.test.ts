import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { fixedAssetService } from '../fixed-asset.service'

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fa-1', assetCode: 'FA-001', assetName: 'Delivery Van', category: 'Vehicles',
    purchaseCost: 120000, usefulLifeMonths: 60, depreciationMethod: 'STRAIGHT_LINE',
    salvageValue: 0, accumulatedDepreciation: 0, status: 'ACTIVE',
    ...overrides,
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    fixedAsset: {
      findUnique: vi.fn().mockResolvedValue(makeAsset()),
      create: vi.fn().mockResolvedValue(makeAsset()),
      update: vi.fn().mockResolvedValue(makeAsset()),
      findMany: vi.fn().mockResolvedValue([]),
    },
    fixedAssetDepreciation: {
      create: vi.fn().mockResolvedValue({ id: 'dep-1', fixedAssetId: 'fa-1', amount: 2000 }),
      update: vi.fn().mockResolvedValue({}),
    },
    chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '6100', accountName: 'Depreciation Expense', accountType: 'EXPENSE', isActive: true }) },
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

describe('fixedAssetService.createAsset', () => {
  it('rejects a duplicate asset code', async () => {
    const db = makeDb({ fixedAsset: { findUnique: vi.fn().mockResolvedValue(makeAsset()), create: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await fixedAssetService.createAsset({ assetCode: 'FA-001', assetName: 'Van', purchaseDate: '2026-01-01', purchaseCost: 100000, usefulLifeMonths: 60, depreciationMethod: 'STRAIGHT_LINE', salvageValue: 0 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FA-001')
  })

  it('rejects salvage value exceeding purchase cost', async () => {
    const db = makeDb({ fixedAsset: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await fixedAssetService.createAsset({ assetCode: 'FA-002', assetName: 'Van', purchaseDate: '2026-01-01', purchaseCost: 100000, usefulLifeMonths: 60, depreciationMethod: 'STRAIGHT_LINE', salvageValue: 200000 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FA-002')
  })

  it('creates the asset with zero accumulated depreciation, no JournalEntry posted', async () => {
    const db = makeDb({ fixedAsset: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(makeAsset()) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await fixedAssetService.createAsset({ assetCode: 'FA-001', assetName: 'Delivery Van', purchaseDate: '2026-01-01', purchaseCost: 120000, usefulLifeMonths: 60, depreciationMethod: 'STRAIGHT_LINE', salvageValue: 0 })

    expect(res.success).toBe(true)
    expect(db.journalEntry.create).not.toHaveBeenCalled()
  })
})

describe('fixedAssetService.runDepreciation', () => {
  it('rejects depreciating a disposed asset', async () => {
    const db = makeDb({ fixedAsset: { findUnique: vi.fn().mockResolvedValue(makeAsset({ status: 'DISPOSED' })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await fixedAssetService.runDepreciation({ fixedAssetId: 'fa-1', periodStart: '2026-08-01', periodEnd: '2026-08-31' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FA-004')
  })

  it('computes correct STRAIGHT_LINE depreciation for a 30-day period and posts a balanced JournalEntry', async () => {
    // (120000 - 0) / 60 months = 2000/month; a 30-day period = 1 month.
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await fixedAssetService.runDepreciation({ fixedAssetId: 'fa-1', periodStart: '2026-07-01', periodEnd: '2026-07-31' })

    expect(res.success).toBe(true)
    const createCall = db.fixedAssetDepreciation.create.mock.calls[0][0]
    expect(createCall.data.amount).toBeCloseTo(2000, 0)
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    expect(jeArgs.data.sourceType).toBe('ASSET_DEPRECIATION')
    const lines = jeArgs.data.lines.create as Array<{ debitAmount: number; creditAmount: number }>
    const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0)
    const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0)
    expect(totalDebit).toBe(totalCredit)
  })

  it('rejects when no depreciable value remains (already fully depreciated)', async () => {
    const db = makeDb({ fixedAsset: { findUnique: vi.fn().mockResolvedValue(makeAsset({ accumulatedDepreciation: 120000 })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await fixedAssetService.runDepreciation({ fixedAssetId: 'fa-1', periodStart: '2026-08-01', periodEnd: '2026-08-31' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FA-005')
  })

  it('maps a real Prisma unique-constraint rerun to FA-006, not a raw DB error', async () => {
    const db = makeDb({
      fixedAssetDepreciation: {
        create: vi.fn().mockRejectedValue(new Error('Unique constraint failed on the fields: (`fixedAssetId`,`periodEnd`)')),
        update: vi.fn(),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await fixedAssetService.runDepreciation({ fixedAssetId: 'fa-1', periodStart: '2026-07-01', periodEnd: '2026-07-31' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FA-006')
  })
})

describe('fixedAssetService.disposeAsset', () => {
  it('rejects disposing an already-disposed asset', async () => {
    const db = makeDb({ fixedAsset: { findUnique: vi.fn().mockResolvedValue(makeAsset({ status: 'DISPOSED' })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await fixedAssetService.disposeAsset({ id: 'fa-1', disposalDate: '2026-08-11', disposalAmount: 5000 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FA-007')
  })

  it('computes a gain correctly and posts a balanced JournalEntry (sold above book value)', async () => {
    // bookValue = 120000 - 100000 = 20000; sold for 30000 -> gain of 10000.
    const db = makeDb({ fixedAsset: { findUnique: vi.fn().mockResolvedValue(makeAsset({ accumulatedDepreciation: 100000 })), update: vi.fn().mockResolvedValue(makeAsset({ status: 'DISPOSED' })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await fixedAssetService.disposeAsset({ id: 'fa-1', disposalDate: '2026-08-11', disposalAmount: 30000 })

    expect(res.success).toBe(true)
    expect((res.data as { gainOrLoss: number }).gainOrLoss).toBe(10000)
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    const lines = jeArgs.data.lines.create as Array<{ debitAmount: number; creditAmount: number }>
    const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0)
    const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0)
    expect(totalDebit).toBe(30000)
    expect(totalCredit).toBe(30000)
  })

  it('computes a loss correctly and posts a balanced JournalEntry (sold below book value)', async () => {
    // bookValue = 120000 - 50000 = 70000; sold for 40000 -> loss of 30000.
    const db = makeDb({ fixedAsset: { findUnique: vi.fn().mockResolvedValue(makeAsset({ accumulatedDepreciation: 50000 })), update: vi.fn().mockResolvedValue(makeAsset({ status: 'DISPOSED' })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await fixedAssetService.disposeAsset({ id: 'fa-1', disposalDate: '2026-08-11', disposalAmount: 40000 })

    expect(res.success).toBe(true)
    expect((res.data as { gainOrLoss: number }).gainOrLoss).toBe(-30000)
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    const lines = jeArgs.data.lines.create as Array<{ debitAmount: number; creditAmount: number }>
    const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0)
    const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(70000) // bookValue, the credit side of removing the asset
  })
})
