import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { listFurnitureTradeIns, createFurnitureTradeIn, linkFurnitureTradeInToInvoice, deleteFurnitureTradeIn } from '../furniture-trade-in.service'

function makeMockDb() {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    furnitureTradeIn: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'fti-1', ...data, customer: null })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({}),
    },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      updateMany: vi.fn(async ({ where, data }: { where: { settingValue: string }; data: { settingValue: string } }) => {
        if (!settingRow || settingRow.settingValue !== where.settingValue) return { count: 0 }
        settingRow = { ...settingRow, settingValue: data.settingValue }
        return { count: 1 }
      }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => {
        settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }
        return settingRow
      }),
    },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('furniture-trade-in.service.createFurnitureTradeIn', () => {
  it('rejects a non-positive trade-in value', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createFurnitureTradeIn({ customerName: 'Walk-in', itemDescription: 'Old sofa', tradeInValue: 0 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FTI-003')
  })

  it('rejects when neither customerId nor customerName is given', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createFurnitureTradeIn({ itemDescription: 'Old sofa', tradeInValue: 2000 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FTI-004')
  })

  it('creates a trade-in with a sequence-numbered tradeInNumber', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createFurnitureTradeIn({ customerName: 'Walk-in', itemDescription: '3-seater sofa', condition: 'Good', tradeInValue: 5000 })

    expect(res.success).toBe(true)
    const data = (res as { data: { tradeInNumber: string } }).data
    expect(data.tradeInNumber).toBe('FTI-00001')
  })
})

describe('furniture-trade-in.service.linkFurnitureTradeInToInvoice', () => {
  it('links an unlinked trade-in to an invoice', async () => {
    const db = makeMockDb()
    db.furnitureTradeIn.findUnique = vi.fn().mockResolvedValue({ id: 'fti-1', invoiceId: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await linkFurnitureTradeInToInvoice('fti-1', 'inv-1')

    expect(res.success).toBe(true)
    expect(db.furnitureTradeIn.updateMany).toHaveBeenCalledWith({ where: { id: 'fti-1', invoiceId: null }, data: { invoiceId: 'inv-1' } })
  })

  it('rejects linking an already-linked trade-in', async () => {
    const db = makeMockDb()
    db.furnitureTradeIn.findUnique = vi.fn().mockResolvedValue({ id: 'fti-1', invoiceId: 'inv-existing' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await linkFurnitureTradeInToInvoice('fti-1', 'inv-2')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FTI-007')
  })
})

describe('furniture-trade-in.service.deleteFurnitureTradeIn', () => {
  it('blocks deleting a trade-in already linked to an invoice', async () => {
    const db = makeMockDb()
    db.furnitureTradeIn.findUnique = vi.fn().mockResolvedValue({ id: 'fti-1', invoiceId: 'inv-1' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteFurnitureTradeIn('fti-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FTI-009')
    expect(db.furnitureTradeIn.delete).not.toHaveBeenCalled()
  })

  it('allows deleting an unlinked trade-in', async () => {
    const db = makeMockDb()
    db.furnitureTradeIn.findUnique = vi.fn().mockResolvedValue({ id: 'fti-1', invoiceId: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteFurnitureTradeIn('fti-1')

    expect(res.success).toBe(true)
    expect(db.furnitureTradeIn.delete).toHaveBeenCalledWith({ where: { id: 'fti-1' } })
  })
})

describe('furniture-trade-in.service.listFurnitureTradeIns', () => {
  it('filters by customerId and unlinkedOnly', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listFurnitureTradeIns({ customerId: 'cust-1', unlinkedOnly: true })

    expect(db.furnitureTradeIn.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId: 'cust-1', invoiceId: null },
    }))
  })
})
