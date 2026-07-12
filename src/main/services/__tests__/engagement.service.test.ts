import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { listEngagements, createEngagement, updateEngagement, deleteEngagement, generateEngagementInvoice } from '../engagement.service'

// Regression coverage for the Phase 29 re-audit finding: Engagement.feeAmount
// is a Prisma Decimal field, returned unserialized by listEngagements/
// createEngagement/updateEngagement. Electron's IPC can't serialize a
// Decimal instance and throws "An object could not be cloned". Live-verified:
// creating an engagement with a real fee crashed (row silently written to
// the DB anyway), and listEngagements() then also crashed with that real row
// present — the Engagements screen's KPI tiles and table stayed stuck on
// "Loading…" forever. A FakeDecimal test double (toString/valueOf only, like
// a real Decimal.js instance) proves serializeEngagement actually converts
// the field to a plain number.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeEngagement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'eng-1', clientId: 'cust-1', staffId: null, title: 'GST Retainer',
    engagementType: 'RETAINER', status: 'ACTIVE', startDate: null, endDate: null,
    feeType: 'RETAINER_MONTHLY',
    feeAmount: new FakeDecimal(15000) as unknown as number,
    billingDay: 5, notes: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeEngagement> | null = null) {
  const db: Record<string, any> = {
    engagement: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeEngagement({ id: 'eng-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeEngagement({ ...existing, ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('engagement.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createEngagement returns feeAmount as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createEngagement({ clientId: 'cust-1', title: 'GST Retainer', feeType: 'RETAINER_MONTHLY', feeAmount: 15000, billingDay: 5 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { feeAmount: unknown } }).data.feeAmount).toBe('number')
  })

  it('createEngagement returns feeAmount as null when unset, not a Decimal', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.engagement.create = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeEngagement({ id: 'eng-new', ...data, feeAmount: null }))
    )

    const res = await createEngagement({ clientId: 'cust-1', title: 'One-time advisory' })

    expect(res.success).toBe(true)
    expect((res as { data: { feeAmount: unknown } }).data.feeAmount).toBeNull()
  })

  it('listEngagements returns feeAmount as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeEngagement())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listEngagements({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ feeAmount: unknown }> }).data[0].feeAmount).toBe('number')
  })

  it('updateEngagement returns feeAmount as a plain number, clamping billingDay too', async () => {
    const db = makeMockDb(makeEngagement())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateEngagement({ id: 'eng-1', billingDay: 45 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { feeAmount: unknown } }).data.feeAmount).toBe('number')
    expect(db.engagement.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ billingDay: 28 }) })
    )
  })

  it('rejects a negative fee amount', async () => {
    const db = makeMockDb(makeEngagement())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateEngagement({ id: 'eng-1', feeAmount: -500 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EN29-005')
    expect(db.engagement.update).not.toHaveBeenCalled()
  })
})

// Fresh-audit fix (2026-07-12): the original one-shot nullable invoiceId
// claim-sentinel design permanently blocked re-invoicing after the FIRST
// month — invoiceId never returns to null, so a CA/CS retainer engagement
// could only ever be billed once, ever. Replaced with the exact
// period-keyed ("YYYY-MM") claim pattern retainer.service.ts's
// generateInvoiceForRetainer already established (see
// retainer.service.test.ts for the pattern this mirrors).

function makeEngagementForInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'eng-1', clientId: 'cust-1', title: 'GST Retainer',
    feeAmount: 15000, invoiceId: null, lastInvoicedPeriod: null,
    client: { id: 'cust-1', customerName: 'Ramesh Kumar' },
    ...overrides,
  }
}

function makeInvoiceMockDb(engagement: ReturnType<typeof makeEngagementForInvoice> | null) {
  return {
    engagement: {
      findUnique: vi.fn().mockResolvedValue(engagement),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'product-1', hsnCode: '998311' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('engagement.service — generateEngagementInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing engagement', async () => {
    const db = makeInvoiceMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateEngagementInvoice('eng-missing', '2026-07')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EN29-007')
  })

  it('rejects an engagement already invoiced for the requested period', async () => {
    const db = makeInvoiceMockDb(makeEngagementForInvoice({ lastInvoicedPeriod: '2026-07' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateEngagementInvoice('eng-1', '2026-07')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EN29-008')
    expect(db.engagement.updateMany).not.toHaveBeenCalled()
  })

  it('allows invoicing the NEXT period after a prior period was already invoiced — the actual bug being fixed', async () => {
    const db = makeInvoiceMockDb(makeEngagementForInvoice({ lastInvoicedPeriod: '2026-06', invoiceId: 'invoice-june' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-july' } } as never)

    const res = await generateEngagementInvoice('eng-1', '2026-07')

    expect(res.success).toBe(true)
    expect(db.engagement.updateMany).toHaveBeenCalledWith({
      where: { id: 'eng-1', lastInvoicedPeriod: '2026-06' },
      data: { lastInvoicedPeriod: '2026-07' },
    })
  })

  it('rejects an engagement with no fee amount set', async () => {
    const db = makeInvoiceMockDb(makeEngagementForInvoice({ feeAmount: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateEngagementInvoice('eng-1', '2026-07')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EN29-009')
    expect(db.engagement.updateMany).not.toHaveBeenCalled()
  })

  it('generates an invoice and links it back to the engagement', async () => {
    const db = makeInvoiceMockDb(makeEngagementForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateEngagementInvoice('eng-1', '2026-07')

    expect(res.success).toBe(true)
    expect((res as { data: { invoiceId: string; period: string } }).data).toEqual({ invoiceId: 'invoice-1', period: '2026-07' })
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [expect.objectContaining({ productId: 'product-1', unitPrice: 15000 })],
    }))
    expect(db.engagement.update).toHaveBeenCalledWith({ where: { id: 'eng-1' }, data: { invoiceId: 'invoice-1' } })
  })

  it('propagates a billing failure without linking an invoice, and rolls lastInvoicedPeriod back to its prior value', async () => {
    const db = makeInvoiceMockDb(makeEngagementForInvoice({ lastInvoicedPeriod: '2026-06' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateEngagementInvoice('eng-1', '2026-07')

    expect(res.success).toBe(false)
    expect(db.engagement.update).toHaveBeenCalledWith({ where: { id: 'eng-1' }, data: { lastInvoicedPeriod: '2026-06' } })
  })

  it('rejects and releases the claim when a concurrent call wins the race', async () => {
    const db = makeInvoiceMockDb(makeEngagementForInvoice())
    db.engagement.updateMany = vi.fn().mockResolvedValueOnce({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateEngagementInvoice('eng-1', '2026-07')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EN29-008')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })
})

describe('engagement.service — deleteEngagement invoice guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('blocks deleting an engagement that has already been invoiced', async () => {
    const db = {
      engagement: {
        findUnique: vi.fn().mockResolvedValue({ lastInvoicedPeriod: '2026-06' }),
        delete: vi.fn(),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteEngagement('eng-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EN29-006')
    expect(db.engagement.delete).not.toHaveBeenCalled()
  })

  it('allows deleting an engagement never invoiced', async () => {
    const db = {
      engagement: {
        findUnique: vi.fn().mockResolvedValue({ lastInvoicedPeriod: null }),
        delete: vi.fn().mockResolvedValue({}),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteEngagement('eng-1')

    expect(res.success).toBe(true)
    expect(db.engagement.delete).toHaveBeenCalledWith({ where: { id: 'eng-1' } })
  })
})
