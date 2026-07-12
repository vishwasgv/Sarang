import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { listCarJobCards, getCarJobCard, createCarJobCard, updateCarJobCard, generateCarJobInvoice } from '../car-job-card.service'

// Regression coverage for the Phase 33 re-audit finding: CarJobCard.
// laborTotal/partsTotal are Prisma Decimal fields, returned unserialized by
// every function below. Electron's IPC can't serialize a Decimal instance
// and throws "An object could not be cloned". Live-verified: creating a job
// card with real service/parts items crashed (row silently written to the
// DB anyway), and listCarJobCards() then also crashed with that real row
// present. A FakeDecimal test double (toString/valueOf only, like a real
// Decimal.js instance) proves serializeCarJobCard actually converts both
// fields to plain numbers.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cjc-1', jobNumber: 'CJC-00001', clientId: 'cust-1',
    vehicleNumber: 'KA01AB1234', vehicleMake: 'Maruti', vehicleModel: 'Swift',
    vehicleYear: null, vehicleType: '4W', kmIn: null, kmOut: null,
    serviceAdvisorId: null, technicianIds: '[]', serviceItems: '[]', partsItems: '[]',
    laborTotal: new FakeDecimal(800) as unknown as number,
    partsTotal: new FakeDecimal(300) as unknown as number,
    estimatedDelivery: null, deliveredDate: null, status: 'RECEIVED', invoiceId: null,
    notes: null, internalNotes: null, createdAt: new Date(), updatedAt: new Date(),
    client: { id: 'cust-1', customerName: 'Ramesh Kumar', phone: null },
    serviceAdvisor: null,
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeCard> | null = null) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    carJobCard: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findFirst: vi.fn().mockResolvedValue(existing),
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeCard({ id: 'cjc-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeCard({ ...existing, ...data }))
      ),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: `auto-${data.hsnCode}`, ...data }))
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
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

describe('car-job-card.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createCarJobCard returns laborTotal and partsTotal as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCarJobCard({
      clientId: 'cust-1', vehicleNumber: 'KA01AB1234', vehicleMake: 'Maruti', vehicleModel: 'Swift',
      serviceItems: [{ name: 'Oil Change', quantity: 1, unitPrice: 800 }],
      partsItems: [{ name: 'Oil Filter', quantity: 1, unitPrice: 300 }],
    })

    expect(res.success).toBe(true)
    const data = (res as { data: { laborTotal: unknown; partsTotal: unknown } }).data
    expect(typeof data.laborTotal).toBe('number')
    expect(typeof data.partsTotal).toBe('number')
  })

  it('listCarJobCards returns laborTotal as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeCard())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listCarJobCards({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ laborTotal: unknown }> }).data[0].laborTotal).toBe('number')
  })

  it('getCarJobCard returns partsTotal as a plain number', async () => {
    const db = makeMockDb(makeCard())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCarJobCard('cjc-1')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { partsTotal: unknown } }).data.partsTotal).toBe('number')
  })

  it('updateCarJobCard returns laborTotal as a plain number', async () => {
    const db = makeMockDb(makeCard())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateCarJobCard({ id: 'cjc-1', serviceItems: [{ name: 'Brake Pad', quantity: 2, unitPrice: 500 }] })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { laborTotal: unknown } }).data.laborTotal).toBe('number')
  })
})

describe('generateCarJobInvoice — catalog-linked parts reach real inventory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('bills a catalog-linked part as its own STANDARD line (so billing.service.ts deducts real inventory) instead of the generic lumped line', async () => {
    const card = makeCard({
      laborTotal: new FakeDecimal(800) as unknown as number,
      partsTotal: new FakeDecimal(450) as unknown as number,
      serviceItems: JSON.stringify([{ name: 'Oil Change', quantity: 1, unitPrice: 800 }]),
      partsItems: JSON.stringify([
        { name: 'Brake Pad Set', productId: 'prod-brake-pad', quantity: 1, unitPrice: 450 }
      ]),
    })
    const db = makeMockDb(card)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    const res = await generateCarJobInvoice('cjc-1')

    expect(res.success).toBe(true)
    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<{ productId: string; quantity: number; unitPrice: number; taxRate?: number }> }
    // Labor line (generic product) + the real catalog part line — no generic
    // "Automobile Parts & Accessories" fallback line since every part was linked.
    expect(call.items).toHaveLength(2)
    expect(call.items).toContainEqual({ productId: 'prod-brake-pad', quantity: 1, unitPrice: 450 })
    expect(db.product.findFirst).not.toHaveBeenCalledWith({ where: { hsnCode: '87089990', isActive: true } })
  })

  it('still lumps parts with no productId into the generic fallback line (free-text parts unaffected)', async () => {
    const card = makeCard({
      laborTotal: new FakeDecimal(0) as unknown as number,
      partsTotal: new FakeDecimal(300) as unknown as number,
      serviceItems: '[]',
      partsItems: JSON.stringify([{ name: 'Generic Bolt Set', quantity: 3, unitPrice: 100 }]),
    })
    const db = makeMockDb(card)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-2' } } as never)

    const res = await generateCarJobInvoice('cjc-1')

    expect(res.success).toBe(true)
    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<{ productId: string; quantity: number; unitPrice: number }> }
    expect(call.items).toHaveLength(1)
    expect(call.items[0]).toMatchObject({ quantity: 1, unitPrice: 300 }) // lumped total, generic fallback product
  })

  it('mixes catalog-linked and free-text parts correctly in the same invoice', async () => {
    const card = makeCard({
      laborTotal: new FakeDecimal(0) as unknown as number,
      partsTotal: new FakeDecimal(650) as unknown as number,
      serviceItems: '[]',
      partsItems: JSON.stringify([
        { name: 'Air Filter', productId: 'prod-air-filter', quantity: 1, unitPrice: 350 },
        { name: 'Misc Fastener', quantity: 3, unitPrice: 100 }
      ]),
    })
    const db = makeMockDb(card)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-3' } } as never)

    const res = await generateCarJobInvoice('cjc-1')

    expect(res.success).toBe(true)
    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<{ productId: string; quantity: number; unitPrice: number }> }
    expect(call.items).toHaveLength(2)
    expect(call.items).toContainEqual({ productId: 'prod-air-filter', quantity: 1, unitPrice: 350 })
    expect(call.items.find(i => i.productId !== 'prod-air-filter')).toMatchObject({ quantity: 1, unitPrice: 300 })
  })
})
