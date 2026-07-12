import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { listPropertyDeals, createPropertyDeal, updatePropertyDeal } from '../property-deal.service'

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
