import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listGoldSavingsSchemes, createGoldSavingsScheme, recordInstallment, redeemGoldSavingsScheme, linkGoldSavingsSchemeToInvoice } from '../gold-savings.service'

function makeMockDb(scheme: Record<string, unknown> | null = null) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    customer: {
      findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', customerName: 'Test Customer' }),
    },
    // generateSequenceNumber's own claim-based sequence storage — same
    // stateful mock shape metal-exchange.service.test.ts already established.
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
    goldSavingsScheme: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(scheme),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'gss-1', totalDeposited: 0, bonusAmount: 0, redeemedAmount: null, status: 'ACTIVE', ...data, customer: { id: 'cust-1', customerName: 'Test Customer' }, installments: [] })
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'gss-1', ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    goldSavingsInstallment: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'gsi-1', ...data })),
    },
  }
  db.$transaction = vi.fn(async (arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg)
    return (arg as (tx: unknown) => unknown)(db)
  })
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('gold-savings.service — createGoldSavingsScheme', () => {
  it('creates a scheme for a real customer', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createGoldSavingsScheme({ customerId: 'cust-1', metalType: 'GOLD', monthlyAmount: 5000, tenureMonths: 11, startDate: '2026-08-01' })

    expect(res.success).toBe(true)
    expect(db.goldSavingsScheme.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: 'cust-1', metalType: 'GOLD', monthlyAmount: 5000, tenureMonths: 11 }),
    }))
  })

  it('rejects a non-positive monthly amount', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createGoldSavingsScheme({ customerId: 'cust-1', metalType: 'GOLD', monthlyAmount: 0, tenureMonths: 11, startDate: '2026-08-01' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('GSS-002')
  })

  it('rejects a non-whole-number or non-positive tenure', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createGoldSavingsScheme({ customerId: 'cust-1', metalType: 'GOLD', monthlyAmount: 5000, tenureMonths: 0, startDate: '2026-08-01' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('GSS-003')
  })

  it('rejects when the customer does not exist', async () => {
    const db = makeMockDb()
    db.customer.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createGoldSavingsScheme({ customerId: 'ghost', metalType: 'GOLD', monthlyAmount: 5000, tenureMonths: 11, startDate: '2026-08-01' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('GSS-004')
  })
})

describe('gold-savings.service — recordInstallment', () => {
  it('records an installment and increments totalDeposited on an ACTIVE scheme', async () => {
    const db = makeMockDb({ id: 'gss-1', status: 'ACTIVE', totalDeposited: 5000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordInstallment({ schemeId: 'gss-1', amount: 5000 })

    expect(res.success).toBe(true)
    expect(db.goldSavingsInstallment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ schemeId: 'gss-1', amount: 5000 }) }))
    expect(db.goldSavingsScheme.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'gss-1' }, data: { totalDeposited: { increment: 5000 } },
    }))
  })

  it('rejects a non-positive installment amount', async () => {
    const db = makeMockDb({ id: 'gss-1', status: 'ACTIVE' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordInstallment({ schemeId: 'gss-1', amount: 0 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('GSS-006')
  })

  it('rejects recording against a non-ACTIVE scheme', async () => {
    const db = makeMockDb({ id: 'gss-1', status: 'REDEEMED' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordInstallment({ schemeId: 'gss-1', amount: 1000 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('GSS-008')
  })

  it('rejects for a scheme that does not exist', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordInstallment({ schemeId: 'ghost', amount: 1000 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('GSS-007')
  })
})

describe('gold-savings.service — redeemGoldSavingsScheme', () => {
  it('redeems an ACTIVE scheme, summing totalDeposited + bonusAmount', async () => {
    const db = makeMockDb({ id: 'gss-1', status: 'ACTIVE', totalDeposited: 55000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await redeemGoldSavingsScheme({ schemeId: 'gss-1', bonusAmount: 5000 })

    expect(res.success).toBe(true)
    expect(db.goldSavingsScheme.updateMany).toHaveBeenCalledWith({
      where: { id: 'gss-1', status: 'ACTIVE' },
      data: expect.objectContaining({ status: 'REDEEMED', bonusAmount: 5000, redeemedAmount: 60000 }),
    })
  })

  it('defaults bonusAmount to zero when omitted', async () => {
    const db = makeMockDb({ id: 'gss-1', status: 'ACTIVE', totalDeposited: 30000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await redeemGoldSavingsScheme({ schemeId: 'gss-1' })

    expect(res.success).toBe(true)
    expect(db.goldSavingsScheme.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ redeemedAmount: 30000, bonusAmount: 0 }),
    }))
  })

  it('rejects redeeming an already-redeemed scheme', async () => {
    const db = makeMockDb({ id: 'gss-1', status: 'REDEEMED', totalDeposited: 30000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await redeemGoldSavingsScheme({ schemeId: 'gss-1' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('GSS-011')
  })

  // Same TOCTOU-safe conditional-claim shape rentalService's checkoutBooking/
  // returnBooking already established — two near-simultaneous redemptions of
  // the same scheme must not both succeed.
  it('rejects redemption if another action already claimed it inside the race window', async () => {
    const db = makeMockDb({ id: 'gss-1', status: 'ACTIVE', totalDeposited: 30000 })
    db.goldSavingsScheme.updateMany = vi.fn().mockResolvedValue({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await redeemGoldSavingsScheme({ schemeId: 'gss-1' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('GSS-011')
  })

  it('rejects a negative bonus amount', async () => {
    const db = makeMockDb({ id: 'gss-1', status: 'ACTIVE', totalDeposited: 30000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await redeemGoldSavingsScheme({ schemeId: 'gss-1', bonusAmount: -100 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('GSS-010')
  })
})

describe('gold-savings.service — linkGoldSavingsSchemeToInvoice', () => {
  it('links a REDEEMED, unlinked scheme to an invoice', async () => {
    const db = makeMockDb({ id: 'gss-1', status: 'REDEEMED', invoiceId: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await linkGoldSavingsSchemeToInvoice('gss-1', 'inv-1')

    expect(res.success).toBe(true)
    expect(db.goldSavingsScheme.updateMany).toHaveBeenCalledWith({ where: { id: 'gss-1', invoiceId: null }, data: { invoiceId: 'inv-1' } })
  })

  it('rejects linking a scheme that has not been redeemed yet', async () => {
    const db = makeMockDb({ id: 'gss-1', status: 'ACTIVE', invoiceId: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await linkGoldSavingsSchemeToInvoice('gss-1', 'inv-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('GSS-013')
  })

  it('rejects linking an already-linked scheme', async () => {
    const db = makeMockDb({ id: 'gss-1', status: 'REDEEMED', invoiceId: 'inv-existing' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await linkGoldSavingsSchemeToInvoice('gss-1', 'inv-2')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('GSS-014')
  })
})

describe('gold-savings.service — listGoldSavingsSchemes', () => {
  it('filters by customerId and status', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listGoldSavingsSchemes({ customerId: 'cust-1', status: 'ACTIVE' })

    expect(db.goldSavingsScheme.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId: 'cust-1', status: 'ACTIVE' },
    }))
  })
})
