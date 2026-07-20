import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { listPropertyDeals, createPropertyDeal, updatePropertyDeal, serializeDeal } from '../property-deal.service'

// Regression coverage for the Phase 32 re-audit finding: PropertyDeal.
// dealValue/brokeragePercent/brokerageAmount are Prisma Decimal fields,
// returned unserialized by listPropertyDeals/createPropertyDeal/
// updatePropertyDeal. Electron's IPC can't serialize a Decimal instance and
// throws "An object could not be cloned". serializeDeal is also exported
// and reused by property.service.ts to serialize deals[] nested under a
// property — covered separately in property.service.test.ts.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'deal-1', propertyId: 'prop-1', buyerClientId: 'cust-buyer', sellerClientId: 'cust-seller',
    dealValue: new FakeDecimal(5000000) as unknown as number,
    brokeragePercent: new FakeDecimal(2) as unknown as number,
    brokerageAmount: new FakeDecimal(100000) as unknown as number,
    expectedRegistrationDate: null, status: 'IN_PROGRESS', invoiceId: null, notes: null,
    coBrokerName: null, coBrokerSharePercent: null, coBrokerShareAmount: null,
    property: { id: 'prop-1', propertyType: 'RESIDENTIAL_FLAT', location: 'Test Location', listingType: 'SALE' },
    buyer: { id: 'cust-buyer', customerName: 'Buyer Name', phone: null },
    seller: { id: 'cust-seller', customerName: 'Seller Name', phone: null },
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeDeal> | null = null) {
  const db: Record<string, any> = {
    propertyDeal: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findUniqueOrThrow: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeDeal({ id: 'deal-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeDeal({ ...existing, ...data }))
      ),
    },
    property: { update: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('property-deal.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createPropertyDeal returns dealValue/brokeragePercent/brokerageAmount as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createPropertyDeal({ propertyId: 'prop-1', buyerClientId: 'cust-buyer', sellerClientId: 'cust-seller', dealValue: 5000000, brokeragePercent: 2 })

    expect(res.success).toBe(true)
    const data = (res as { data: { dealValue: unknown; brokeragePercent: unknown; brokerageAmount: unknown } }).data
    expect(typeof data.dealValue).toBe('number')
    expect(typeof data.brokeragePercent).toBe('number')
    expect(typeof data.brokerageAmount).toBe('number')
  })

  it('listPropertyDeals returns brokerageAmount as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeDeal())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listPropertyDeals({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ brokerageAmount: unknown }> }).data[0].brokerageAmount).toBe('number')
  })

  it('updatePropertyDeal returns brokerageAmount as a plain number', async () => {
    const db = makeMockDb(makeDeal())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePropertyDeal({ id: 'deal-1', dealValue: 6000000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { brokerageAmount: unknown } }).data.brokerageAmount).toBe('number')
  })
})

// Phase 58 §2 — Real Estate: co-broker commission-split tracking.
// coBrokerShareAmount is always computed server-side, never accepted
// directly, so it can't silently drift out of sync with brokerageAmount/
// coBrokerSharePercent.

describe('property-deal.service — co-broker commission split', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createPropertyDeal computes coBrokerShareAmount from brokerageAmount * coBrokerSharePercent / 100', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createPropertyDeal({
      propertyId: 'prop-1', buyerClientId: 'cust-buyer', sellerClientId: 'cust-seller',
      dealValue: 5000000, brokeragePercent: 2, coBrokerName: 'Rahul Realty', coBrokerSharePercent: 40,
    })

    expect(res.success).toBe(true)
    // brokerageAmount = 5,000,000 * 2% = 100,000; coBroker share = 100,000 * 40% = 40,000
    expect(db.propertyDeal.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ coBrokerName: 'Rahul Realty', coBrokerSharePercent: 40, coBrokerShareAmount: 40000 }),
    }))
  })

  it('createPropertyDeal with no co-broker leaves all 3 fields null — never guesses a split', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createPropertyDeal({ propertyId: 'prop-1', buyerClientId: 'cust-buyer', sellerClientId: 'cust-seller', dealValue: 5000000, brokeragePercent: 2 })

    expect(res.success).toBe(true)
    expect(db.propertyDeal.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ coBrokerName: null, coBrokerSharePercent: null, coBrokerShareAmount: null }),
    }))
  })

  it('updatePropertyDeal recomputes coBrokerShareAmount when coBrokerSharePercent alone changes', async () => {
    const db = makeMockDb(makeDeal({ brokerageAmount: new FakeDecimal(100000) as unknown as number, coBrokerSharePercent: new FakeDecimal(40) as unknown as number, coBrokerShareAmount: new FakeDecimal(40000) as unknown as number }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePropertyDeal({ id: 'deal-1', coBrokerSharePercent: 50 })

    expect(res.success).toBe(true)
    expect(db.propertyDeal.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ coBrokerSharePercent: 50, coBrokerShareAmount: 50000 }),
    }))
  })

  it('updatePropertyDeal recomputes coBrokerShareAmount when dealValue changes even though coBrokerSharePercent was not touched — no stale split left behind', async () => {
    const db = makeMockDb(makeDeal({
      dealValue: new FakeDecimal(5000000) as unknown as number, brokeragePercent: new FakeDecimal(2) as unknown as number,
      coBrokerSharePercent: new FakeDecimal(40) as unknown as number,
    }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePropertyDeal({ id: 'deal-1', dealValue: 10000000 })

    expect(res.success).toBe(true)
    // new brokerageAmount = 10,000,000 * 2% = 200,000; coBroker share = 200,000 * 40% = 80,000
    expect(db.propertyDeal.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ coBrokerShareAmount: 80000 }),
    }))
  })

  it('serializeDeal converts coBrokerSharePercent/coBrokerShareAmount Decimals to plain numbers, and leaves null as null', async () => {
    const withCoBroker = serializeDeal(makeDeal({ coBrokerSharePercent: new FakeDecimal(40) as unknown as number, coBrokerShareAmount: new FakeDecimal(40000) as unknown as number }))
    expect(typeof withCoBroker.coBrokerSharePercent).toBe('number')
    expect(typeof withCoBroker.coBrokerShareAmount).toBe('number')

    const withoutCoBroker = serializeDeal(makeDeal())
    expect(withoutCoBroker.coBrokerSharePercent).toBeNull()
    expect(withoutCoBroker.coBrokerShareAmount).toBeNull()
  })
})
