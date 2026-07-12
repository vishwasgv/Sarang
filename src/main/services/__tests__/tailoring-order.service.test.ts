import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { listTailoringOrders, getTailoringOrder, createTailoringOrder, updateTailoringOrder } from '../tailoring-order.service'

// Regression coverage for the Phase 33 re-audit finding: TailoringOrder.
// unitPrice/totalAmount/advancePaid are Prisma Decimal fields, returned
// unserialized by every function below. Electron's IPC can't serialize a
// Decimal instance and throws "An object could not be cloned". Live-
// verified: creating an order with a real unit price crashed (row silently
// written to the DB anyway), and listTailoringOrders() then also crashed
// with that real row present. The nested `measurement` select only picks
// id/recordDate (no Decimal fields), so it's correctly excluded from the
// serializer and was never a second crash surface.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'to-1', orderNumber: 'TO-00001', clientId: 'cust-1', measurementRecordId: null,
    garmentType: 'SHIRT', fabricDescription: null, fabricSupplied: 'CLIENT', quantity: 2,
    unitPrice: new FakeDecimal(1500) as unknown as number,
    totalAmount: new FakeDecimal(3000) as unknown as number,
    advancePaid: new FakeDecimal(500) as unknown as number,
    trialDate: null, deliveryDate: null, deliveredDate: null, status: 'RECEIVED',
    assignedToId: null, invoiceId: null, specialInstructions: null, notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    client: { id: 'cust-1', customerName: 'Ramesh Kumar', phone: null },
    measurement: null, assignedTo: null,
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeOrder> | null = null) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    tailoringOrder: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findFirst: vi.fn().mockResolvedValue(existing),
      findUnique: vi.fn().mockResolvedValue(existing),
      findUniqueOrThrow: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeOrder({ id: 'to-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeOrder({ ...existing, ...data }))
      ),
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

describe('tailoring-order.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createTailoringOrder returns unitPrice, totalAmount, and advancePaid as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTailoringOrder({ clientId: 'cust-1', garmentType: 'SHIRT', unitPrice: 1500, quantity: 2, advancePaid: 500 })

    expect(res.success).toBe(true)
    const data = (res as { data: { unitPrice: unknown; totalAmount: unknown; advancePaid: unknown } }).data
    expect(typeof data.unitPrice).toBe('number')
    expect(typeof data.totalAmount).toBe('number')
    expect(typeof data.advancePaid).toBe('number')
  })

  it('listTailoringOrders returns totalAmount as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeOrder())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listTailoringOrders({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ totalAmount: unknown }> }).data[0].totalAmount).toBe('number')
  })

  it('getTailoringOrder returns unitPrice as a plain number', async () => {
    const db = makeMockDb(makeOrder())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTailoringOrder('to-1')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { unitPrice: unknown } }).data.unitPrice).toBe('number')
  })

  it('updateTailoringOrder returns totalAmount as a plain number', async () => {
    const db = makeMockDb(makeOrder())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateTailoringOrder({ id: 'to-1', unitPrice: 1800 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { totalAmount: unknown } }).data.totalAmount).toBe('number')
  })
})

describe('tailoring-order.service — Phase 48 gender/styleRegion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createTailoringOrder persists gender and styleRegion', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createTailoringOrder({
      clientId: 'cust-1', garmentType: 'BLOUSE', unitPrice: 1500,
      gender: 'WOMENS', styleRegion: 'INDIAN',
    })

    expect(db.tailoringOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gender: 'WOMENS', styleRegion: 'INDIAN' }) })
    )
  })

  it('createTailoringOrder defaults gender and styleRegion to null when not supplied', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createTailoringOrder({ clientId: 'cust-1', garmentType: 'SHIRT', unitPrice: 1000 })

    expect(db.tailoringOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gender: null, styleRegion: null }) })
    )
  })

  it('updateTailoringOrder passes gender and styleRegion through to the update data', async () => {
    const db = makeMockDb(makeOrder())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateTailoringOrder({ id: 'to-1', gender: 'MENS', styleRegion: 'WESTERN' })

    expect(db.tailoringOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gender: 'MENS', styleRegion: 'WESTERN' }) })
    )
  })
})
