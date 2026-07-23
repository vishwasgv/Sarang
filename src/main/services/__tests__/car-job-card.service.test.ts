import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../notification-queue.service', () => ({ buildWhatsAppLink: vi.fn().mockResolvedValue('https://wa.me/919999999999?text=test') }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import {
  listCarJobCards, getCarJobCard, createCarJobCard, updateCarJobCard, generateCarJobInvoice,
  getVehicleServiceHistory, listVehiclesDueForService, scheduleNextServiceReminder,
} from '../car-job-card.service'

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
      // Atomic invoiceId claim (see generateCarJobInvoice) — succeeds only
      // while the row's invoiceId is genuinely still null, mirroring the
      // real `where: { id, invoiceId: null }` conditional update.
      updateMany: vi.fn().mockImplementation(() => Promise.resolve({ count: existing && !existing.invoiceId ? 1 : 0 })),
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

// Real bug found 2026-07-23: generateCarJobInvoice had no atomic claim on
// invoiceId (unlike every sibling generate*Invoice function elsewhere in
// this codebase) — two concurrent calls for the same job card could both
// pass a stale "already invoiced?" check and each create a real, separate
// Invoice. Fixed with the same atomic conditional-claim + release-on-
// failure shape used by membership/session-pack/driving/retainer.

describe('generateCarJobInvoice — invoice-claim atomicity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects without calling billingService.createInvoice when the claim fails (already invoiced)', async () => {
    const card = makeCard({ invoiceId: 'invoice-existing' })
    const db = makeMockDb(card)
    db.carJobCard.updateMany = vi.fn().mockResolvedValue({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateCarJobInvoice('cjc-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CJC-003')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('claims invoiceId atomically before calling billingService.createInvoice', async () => {
    const card = makeCard()
    const db = makeMockDb(card)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    await generateCarJobInvoice('cjc-1')

    expect(db.carJobCard.updateMany).toHaveBeenCalledWith({ where: { id: 'cjc-1', invoiceId: null }, data: { invoiceId: 'PENDING_INVOICE_GENERATION' } })
    const claimCallOrder = db.carJobCard.updateMany.mock.invocationCallOrder[0]
    const createInvoiceCallOrder = vi.mocked(billingService.createInvoice).mock.invocationCallOrder[0]
    expect(claimCallOrder).toBeLessThan(createInvoiceCallOrder)
  })

  it('releases the claim (sets invoiceId back to null) when billingService.createInvoice fails', async () => {
    const card = makeCard()
    const db = makeMockDb(card)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateCarJobInvoice('cjc-1')

    expect(res.success).toBe(false)
    expect(db.carJobCard.update).toHaveBeenCalledWith({ where: { id: 'cjc-1' }, data: { invoiceId: null } })
  })
})

// Phase 58 §2 — Car Service Center: next-service-due tracking + grouped
// vehicle service-history view. There is no separate Vehicle master table,
// so "the vehicle's current state" is always derived from its MOST RECENT
// (by createdAt) job card — the real non-trivial logic worth testing here.

describe('car-job-card.service.getVehicleServiceHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('normalizes the registration number the same way createCarJobCard does before querying', async () => {
    const db = makeMockDb(makeCard())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getVehicleServiceHistory('ka 01  ab 1234')

    expect(db.carJobCard.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { vehicleNumber: 'KA 01 AB 1234' },
    }))
  })

  it('returns every job card for that vehicle serialized (no raw Decimal instances)', async () => {
    const db = makeMockDb(makeCard())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVehicleServiceHistory('KA01AB1234')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ laborTotal: unknown }> }).data[0].laborTotal).toBe('number')
  })
})

describe('car-job-card.service.listVehiclesDueForService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('only takes the MOST RECENT job card per vehicle, not every job card', async () => {
    const older = makeCard({ id: 'cjc-old', vehicleNumber: 'KA01AB1234', createdAt: new Date('2026-01-01'), nextServiceDueKm: 10000, kmOut: 20000 })
    const newer = makeCard({ id: 'cjc-new', vehicleNumber: 'KA01AB1234', createdAt: new Date('2026-06-01'), nextServiceDueKm: 60000, kmOut: 55000 })
    const db = makeMockDb()
    db.carJobCard.findMany = vi.fn().mockResolvedValue([newer, older]) // already ordered desc by createdAt
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listVehiclesDueForService()

    expect(res.success).toBe(true)
    const data = (res as { data: Array<{ vehicleNumber: string; nextServiceDueKm: number }> }).data
    expect(data).toHaveLength(1)
    expect(data[0].nextServiceDueKm).toBe(60000) // the newer job's value, not the older
  })

  it('flags dueForService when the odometer has already crossed nextServiceDueKm', async () => {
    const card = makeCard({ nextServiceDueKm: 50000, kmOut: 51000, nextServiceDueDate: null })
    const db = makeMockDb()
    db.carJobCard.findMany = vi.fn().mockResolvedValue([card])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listVehiclesDueForService()

    const data = (res as { data: Array<{ dueForService: boolean; overdue: boolean }> }).data
    expect(data[0].dueForService).toBe(true)
    expect(data[0].overdue).toBe(true)
  })

  it('does not flag a vehicle whose odometer has not yet reached the threshold', async () => {
    const card = makeCard({ nextServiceDueKm: 50000, kmOut: 40000, nextServiceDueDate: null })
    const db = makeMockDb()
    db.carJobCard.findMany = vi.fn().mockResolvedValue([card])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listVehiclesDueForService()

    expect((res as { data: Array<{ dueForService: boolean }> }).data[0].dueForService).toBe(false)
  })

  it('flags dueForService (but not overdue) when the due date falls within the dueSoonDays window', async () => {
    const inFiveDays = new Date(Date.now() + 5 * 86400000)
    const card = makeCard({ nextServiceDueDate: inFiveDays, nextServiceDueKm: null })
    const db = makeMockDb()
    db.carJobCard.findMany = vi.fn().mockResolvedValue([card])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listVehiclesDueForService(14)

    const data = (res as { data: Array<{ dueForService: boolean; overdue: boolean }> }).data
    expect(data[0].dueForService).toBe(true)
    expect(data[0].overdue).toBe(false)
  })

  it('excludes vehicles with neither a due date nor a due-km set', async () => {
    const card = makeCard({ nextServiceDueDate: null, nextServiceDueKm: null })
    const db = makeMockDb()
    db.carJobCard.findMany = vi.fn().mockResolvedValue([card])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listVehiclesDueForService()

    expect((res as { data: unknown[] }).data).toHaveLength(0)
  })

  it('excludes CANCELLED job cards from the query entirely', async () => {
    const db = makeMockDb()
    db.carJobCard.findMany = vi.fn().mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listVehiclesDueForService()

    expect(db.carJobCard.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { not: 'CANCELLED' } },
    }))
  })
})

describe('car-job-card.service.scheduleNextServiceReminder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing job card', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleNextServiceReminder('missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CJC-007')
  })

  it('rejects when no nextServiceDueDate is set', async () => {
    const db = makeMockDb(makeCard({ nextServiceDueDate: null, client: { customerName: 'Test', phone: '9999999999' } }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleNextServiceReminder('cjc-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CJC-008')
  })

  it('succeeds with no queued reminder (not an error) when the client has no phone on file', async () => {
    const futureDate = new Date(Date.now() + 30 * 86400000)
    const db = makeMockDb(makeCard({ nextServiceDueDate: futureDate, client: { customerName: 'Test', phone: null } }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleNextServiceReminder('cjc-1')
    expect(res.success).toBe(true)
    expect((res as { data: unknown }).data).toBeNull()
  })

  it('rejects when daysBefore would schedule the reminder in the past (due date too close)', async () => {
    const tomorrow = new Date(Date.now() + 1 * 86400000)
    const db = makeMockDb(makeCard({ nextServiceDueDate: tomorrow, client: { customerName: 'Test', phone: '9999999999' } }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleNextServiceReminder('cjc-1', 3) // 3 days before a due date that's only 1 day away

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CJC-009')
  })

  it('schedules a real notificationQueue entry exactly daysBefore the due date', async () => {
    const dueDate = new Date(Date.now() + 30 * 86400000)
    const db = makeMockDb(makeCard({ nextServiceDueDate: dueDate, client: { customerName: 'Test', phone: '9999999999' } }))
    db.notificationQueue = { create: vi.fn().mockResolvedValue({}) }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleNextServiceReminder('cjc-1', 3)

    expect(res.success).toBe(true)
    expect(db.notificationQueue.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ notificationType: 'CAR_SERVICE_DUE_REMINDER', status: 'PENDING' }),
    }))
    const scheduledFor = db.notificationQueue.create.mock.calls[0][0].data.scheduledFor as Date
    expect(dueDate.getTime() - scheduledFor.getTime()).toBe(3 * 86400000)
  })
})
