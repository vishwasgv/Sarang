import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { listProperties, getProperty, createProperty, updateProperty } from '../property.service'

// Regression coverage for the Phase 32 re-audit finding: Property has FIVE
// Decimal-crash surfaces in a single response — its own area, askingPrice,
// monthlyRent, securityDeposit, brokeragePercent — plus getProperty nests
// `deals[]` (its own 3 Decimal fields: dealValue, brokeragePercent,
// brokerageAmount) via `include: { deals }`, a sixth crash surface. Live-
// verified: creating a property with real values crashed, and once real
// data existed, list/get both crashed too. A FakeDecimal test double
// (toString/valueOf only, like a real Decimal.js instance) proves
// serializeProperty converts every surface to plain numbers, reusing the
// exported serializeDeal from property-deal.service.ts rather than
// duplicating conversion logic.

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
    buyer: { id: 'cust-buyer', customerName: 'Buyer Name', phone: null },
    seller: { id: 'cust-seller', customerName: 'Seller Name', phone: null },
    ...overrides,
  }
}

function makeProperty(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop-1', propertyType: 'RESIDENTIAL_FLAT', listingType: 'SALE', status: 'AVAILABLE',
    location: 'Test Location',
    area: new FakeDecimal(1200) as unknown as number,
    floorNumber: null, totalFloors: null,
    askingPrice: new FakeDecimal(5000000) as unknown as number,
    monthlyRent: null, securityDeposit: null,
    brokeragePercent: new FakeDecimal(2) as unknown as number,
    ownerClientId: 'cust-owner', photos: '[]', amenities: '[]', description: null, notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    owner: { id: 'cust-owner', customerName: 'Owner Name', phone: null },
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeProperty> | null = null) {
  const db: Record<string, any> = {
    property: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeProperty({ id: 'prop-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeProperty({ ...existing, ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('property.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createProperty returns area, askingPrice, and brokeragePercent as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createProperty({ propertyType: 'RESIDENTIAL_FLAT', listingType: 'SALE', location: 'Test Location', area: 1200, ownerClientId: 'cust-owner', askingPrice: 5000000, brokeragePercent: 2 })

    expect(res.success).toBe(true)
    const data = (res as { data: Record<string, unknown> }).data
    expect(typeof data.area).toBe('number')
    expect(typeof data.askingPrice).toBe('number')
    expect(typeof data.brokeragePercent).toBe('number')
  })

  it('createProperty returns monthlyRent/securityDeposit as null when unset, not Decimals', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.property.create = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeProperty({ id: 'prop-new', ...data, monthlyRent: null, securityDeposit: null }))
    )

    const res = await createProperty({ propertyType: 'COMMERCIAL_SHOP', listingType: 'SALE', location: 'Somewhere', area: 500, ownerClientId: 'cust-owner' })

    expect(res.success).toBe(true)
    const data = (res as { data: { monthlyRent: unknown; securityDeposit: unknown } }).data
    expect(data.monthlyRent).toBeNull()
    expect(data.securityDeposit).toBeNull()
  })

  it('listProperties returns area as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeProperty())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listProperties({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ area: unknown }> }).data[0].area).toBe('number')
  })

  it('getProperty serializes area/askingPrice AND nested deals[].dealValue/brokeragePercent/brokerageAmount', async () => {
    const db = makeMockDb(makeProperty({ deals: [makeDeal()], inquiries: [] }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getProperty('prop-1')

    expect(res.success).toBe(true)
    const property = (res as { data: { area: unknown; askingPrice: unknown; deals: Array<{ dealValue: unknown; brokeragePercent: unknown; brokerageAmount: unknown }> } }).data
    expect(typeof property.area).toBe('number')
    expect(typeof property.askingPrice).toBe('number')
    expect(typeof property.deals[0].dealValue).toBe('number')
    expect(typeof property.deals[0].brokeragePercent).toBe('number')
    expect(typeof property.deals[0].brokerageAmount).toBe('number')
  })

  it('updateProperty returns area as a plain number', async () => {
    const db = makeMockDb(makeProperty())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateProperty({ id: 'prop-1', area: 1500 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { area: unknown } }).data.area).toBe('number')
  })
})
