import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listMetalExchanges, createMetalExchange, linkMetalExchangeToInvoice, deleteMetalExchange } from '../metal-exchange.service'

function makeMockDb(rate: { ratePerGram: number } | null = { ratePerGram: 6500 }) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    metalRate: {
      findUnique: vi.fn().mockResolvedValue(rate),
    },
    metalExchange: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'mx-1', ...data, customer: null })
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'mx-1', ...data })),
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

describe('metal-exchange.service — createMetalExchange', () => {
  it('computes valueGiven as netWeight * ratePerGram, netting out the deduction weight', async () => {
    const db = makeMockDb({ ratePerGram: 6500 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 10g gross, 0.5g deduction (wastage) -> 9.5g net * 6500/g = 61750
    const res = await createMetalExchange({
      customerName: 'Walk-in', metalType: 'GOLD', purity: '22K', grossWeight: 10, deductionWeight: 0.5,
    })

    expect(res.success).toBe(true)
    const data = (res as { data: { netWeight: number; valueGiven: number; ratePerGram: number } }).data
    expect(data.netWeight).toBeCloseTo(9.5, 5)
    expect(data.valueGiven).toBeCloseTo(61750, 2)
    expect(data.ratePerGram).toBe(6500)
  })

  it('defaults deductionWeight to zero when omitted', async () => {
    const db = makeMockDb({ ratePerGram: 85 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createMetalExchange({ customerName: 'Walk-in', metalType: 'SILVER', purity: '999', grossWeight: 100 })

    expect(res.success).toBe(true)
    const data = (res as { data: { netWeight: number; valueGiven: number } }).data
    expect(data.netWeight).toBe(100)
    expect(data.valueGiven).toBe(8500)
  })

  it('rejects a non-positive gross weight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createMetalExchange({ customerName: 'Walk-in', metalType: 'GOLD', purity: '22K', grossWeight: 0 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MX-002')
  })

  it('rejects a deduction weight greater than or equal to the gross weight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createMetalExchange({ customerName: 'Walk-in', metalType: 'GOLD', purity: '22K', grossWeight: 5, deductionWeight: 5 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MX-003')
  })

  it('rejects when neither a customerId nor a walk-in customerName is given', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createMetalExchange({ metalType: 'GOLD', purity: '22K', grossWeight: 5 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MX-004')
  })

  it('rejects when no rate is configured for the requested metalType+purity', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createMetalExchange({ customerName: 'Walk-in', metalType: 'PLATINUM', purity: '950', grossWeight: 5 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MX-005')
  })
})

describe('metal-exchange.service — linkMetalExchangeToInvoice', () => {
  it('links an unlinked exchange to an invoice', async () => {
    const db = makeMockDb()
    db.metalExchange.findUnique = vi.fn().mockResolvedValue({ id: 'mx-1', invoiceId: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await linkMetalExchangeToInvoice('mx-1', 'inv-1')

    expect(res.success).toBe(true)
    expect(db.metalExchange.update).toHaveBeenCalledWith({ where: { id: 'mx-1' }, data: { invoiceId: 'inv-1' } })
  })

  it('rejects linking an exchange that is already linked', async () => {
    const db = makeMockDb()
    db.metalExchange.findUnique = vi.fn().mockResolvedValue({ id: 'mx-1', invoiceId: 'inv-existing' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await linkMetalExchangeToInvoice('mx-1', 'inv-2')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MX-008')
  })
})

describe('metal-exchange.service — deleteMetalExchange', () => {
  it('blocks deleting an exchange already linked to an invoice', async () => {
    const db = makeMockDb()
    db.metalExchange.findUnique = vi.fn().mockResolvedValue({ id: 'mx-1', invoiceId: 'inv-1' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteMetalExchange('mx-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MX-010')
    expect(db.metalExchange.delete).not.toHaveBeenCalled()
  })

  it('allows deleting an unlinked exchange', async () => {
    const db = makeMockDb()
    db.metalExchange.findUnique = vi.fn().mockResolvedValue({ id: 'mx-1', invoiceId: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteMetalExchange('mx-1')

    expect(res.success).toBe(true)
    expect(db.metalExchange.delete).toHaveBeenCalledWith({ where: { id: 'mx-1' } })
  })
})

describe('metal-exchange.service — listMetalExchanges', () => {
  it('filters by customerId and unlinkedOnly', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listMetalExchanges({ customerId: 'cust-1', unlinkedOnly: true })

    expect(db.metalExchange.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId: 'cust-1', invoiceId: null },
    }))
  })
})
