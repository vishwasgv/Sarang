import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../inventory.service', () => ({ inventoryService: { reduceStockTx: vi.fn() } }))
vi.mock('../appointment.service', () => ({ createAppointment: vi.fn() }))
vi.mock('../notification-queue.service', () => ({ createAppointmentReminder: vi.fn().mockResolvedValue({ success: true, data: null }) }))

import { getPrisma } from '../../database/db'
import { inventoryService } from '../inventory.service'
import { createAppointment } from '../appointment.service'
import { createAppointmentReminder } from '../notification-queue.service'
import {
  listTailoringOrders, getTailoringOrder, createTailoringOrder, updateTailoringOrder,
  scheduleTrialAppointment, setOrderFabric, clearOrderFabric, generateTailoringInvoice,
} from '../tailoring-order.service'
import { billingService } from '../billing.service'
import { ServiceError } from '../../errors/service-error'

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

// Phase 58 §2 — Tailor Boutique: a real trial/fitting Appointment linked
// back to the order, riding the SAME reminder pipeline every other
// appointment already uses.

describe('tailoring-order.service.scheduleTrialAppointment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing order', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleTrialAppointment({ orderId: 'missing', scheduledDate: '2026-08-01', scheduledTime: '10:00' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TO-005')
  })

  it('rejects an order that already has a trial appointment scheduled', async () => {
    const db = makeMockDb(makeOrder({ trialAppointmentId: 'apt-existing' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleTrialAppointment({ orderId: 'to-1', scheduledDate: '2026-08-01', scheduledTime: '10:00' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TO-006')
  })

  it('propagates a failure from createAppointment (e.g. a real provider conflict) without linking anything', async () => {
    const db = makeMockDb(makeOrder())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(createAppointment).mockResolvedValue({ success: false, error: { code: 'APT-CONFLICT', message: 'conflict' } } as never)

    const res = await scheduleTrialAppointment({ orderId: 'to-1', scheduledDate: '2026-08-01', scheduledTime: '10:00' })

    expect(res.success).toBe(false)
    expect(db.tailoringOrder.update).not.toHaveBeenCalled()
  })

  it('creates a real Appointment, links it back, sets status TRIAL_SCHEDULED, and reuses the existing reminder pipeline', async () => {
    const db = makeMockDb(makeOrder())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(createAppointment).mockResolvedValue({ success: true, data: { id: 'apt-1' } } as never)

    const res = await scheduleTrialAppointment({ orderId: 'to-1', providerId: 'emp-1', scheduledDate: '2026-08-01', scheduledTime: '10:00' })

    expect(res.success).toBe(true)
    expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1', providerId: 'emp-1', scheduledDate: '2026-08-01', scheduledTime: '10:00',
    }))
    expect(db.tailoringOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'to-1' },
      data: expect.objectContaining({ trialAppointmentId: 'apt-1', status: 'TRIAL_SCHEDULED' }),
    }))
    expect(createAppointmentReminder).toHaveBeenCalledWith('apt-1')
  })

  it('does not fail the whole action if the reminder pipeline itself throws', async () => {
    const db = makeMockDb(makeOrder())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(createAppointment).mockResolvedValue({ success: true, data: { id: 'apt-1' } } as never)
    vi.mocked(createAppointmentReminder).mockRejectedValueOnce(new Error('boom'))

    const res = await scheduleTrialAppointment({ orderId: 'to-1', scheduledDate: '2026-08-01', scheduledTime: '10:00' })

    expect(res.success).toBe(true)
  })
})

// Phase 58 §2 — Tailor Boutique: fabric-stock deduction, set-once-then-clear
// pattern (mirrors Repair's JobCardPart add/remove pair) backed by REAL
// inventory deduction via the shared inventoryService.reduceStockTx.

function makeFabricMockDb(order: Record<string, unknown> | null) {
  const db: Record<string, any> = {
    tailoringOrder: {
      findUnique: vi.fn().mockResolvedValue(order),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeOrder({ ...(order ?? {}), ...data }))
      ),
    },
    product: { findUnique: vi.fn().mockResolvedValue({ id: 'prod-1' }) },
    inventory: { update: vi.fn().mockResolvedValue({}) },
    inventoryMovement: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('tailoring-order.service.setOrderFabric', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a non-positive quantity', async () => {
    const res = await setOrderFabric({ orderId: 'to-1', fabricProductId: 'prod-1', fabricQuantity: 0 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TOF-001')
  })

  it('rejects a missing order', async () => {
    const db = makeFabricMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await setOrderFabric({ orderId: 'missing', fabricProductId: 'prod-1', fabricQuantity: 3 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TOF-002')
  })

  it('rejects if the order already has fabric linked — must clear first', async () => {
    const db = makeFabricMockDb({ id: 'to-1', orderNumber: 'TO-00001', fabricProductId: 'prod-existing' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await setOrderFabric({ orderId: 'to-1', fabricProductId: 'prod-1', fabricQuantity: 3 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TOF-003')
  })

  it('rejects a missing fabric product', async () => {
    const db = makeFabricMockDb({ id: 'to-1', orderNumber: 'TO-00001', fabricProductId: null })
    db.product.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await setOrderFabric({ orderId: 'to-1', fabricProductId: 'prod-missing', fabricQuantity: 3 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TOF-004')
  })

  it('deducts real inventory via reduceStockTx and sets fabricSupplied to SHOP', async () => {
    const db = makeFabricMockDb({ id: 'to-1', orderNumber: 'TO-00001', fabricProductId: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(inventoryService.reduceStockTx).mockResolvedValue(undefined as never)

    const res = await setOrderFabric({ orderId: 'to-1', fabricProductId: 'prod-1', fabricQuantity: 4.5 })

    expect(res.success).toBe(true)
    expect(inventoryService.reduceStockTx).toHaveBeenCalledWith(
      db, 'prod-1', 4.5, expect.stringContaining('TO-00001'), 'TAILORING_ORDER', 'TO-00001'
    )
    expect(db.tailoringOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fabricProductId: 'prod-1', fabricQuantity: 4.5, fabricSupplied: 'SHOP' }),
    }))
  })

  it('translates an insufficient-stock ServiceError (INV-002) into a friendly TOF-005', async () => {
    const db = makeFabricMockDb({ id: 'to-1', orderNumber: 'TO-00001', fabricProductId: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(inventoryService.reduceStockTx).mockRejectedValue(new ServiceError('INV-002', 'Insufficient stock.'))

    const res = await setOrderFabric({ orderId: 'to-1', fabricProductId: 'prod-1', fabricQuantity: 999 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TOF-005')
  })
})

describe('tailoring-order.service.clearOrderFabric', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing order', async () => {
    const db = makeFabricMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await clearOrderFabric('missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TOF-002')
  })

  it('rejects an order with no fabric currently linked', async () => {
    const db = makeFabricMockDb({ id: 'to-1', orderNumber: 'TO-00001', fabricProductId: null, fabricQuantity: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await clearOrderFabric('to-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TOF-007')
  })

  it('restores the exact quantity to Inventory and writes a TAILORING_RETURN movement, without touching averageCost', async () => {
    const db = makeFabricMockDb({ id: 'to-1', orderNumber: 'TO-00001', fabricProductId: 'prod-1', fabricQuantity: 4.5 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await clearOrderFabric('to-1')

    expect(res.success).toBe(true)
    expect(db.inventory.update).toHaveBeenCalledWith({ where: { productId: 'prod-1' }, data: { quantity: { increment: 4.5 } } })
    expect(db.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'prod-1', movementType: 'TAILORING_RETURN', quantity: 4.5 }),
    }))
    expect(db.inventory.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ averageCost: expect.anything() }) }))
    expect(db.tailoringOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { fabricProductId: null, fabricQuantity: null, fabricSupplied: 'CLIENT' },
    }))
  })
})

describe('tailoring-order.service.generateTailoringInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeInvoiceMockDb(opts: { invoiceId?: string | null; totalAmount?: number; existingProduct?: { id: string; taxRate: number } | null } = {}) {
    const order = {
      id: 'to-1', orderNumber: 'TO-00001', clientId: 'cust-1', garmentType: 'Suit',
      quantity: 2, unitPrice: 500, totalAmount: opts.totalAmount ?? 1000,
      invoiceId: opts.invoiceId ?? null,
      client: { id: 'cust-1', customerName: 'Test Client' },
    }
    let currentInvoiceId = opts.invoiceId ?? null
    const db: Record<string, any> = {
      tailoringOrder: {
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (currentInvoiceId !== null) return { count: 0 }
          if (where.invoiceId !== null) return { count: 0 }
          currentInvoiceId = data.invoiceId
          return { count: 1 }
        }),
        findUnique: vi.fn(async () => ({ ...order, invoiceId: currentInvoiceId })),
        update: vi.fn(async ({ data }: any) => { currentInvoiceId = data.invoiceId; return { ...order, ...data } }),
      },
      product: {
        findFirst: vi.fn().mockResolvedValue(opts.existingProduct ?? null),
        create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'prod-tailoring', ...data })),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    return db
  }

  it('generates an invoice and does not hardcode a taxRate override on the item — falls through to the product\'s own configurable rate', async () => {
    const db = makeInvoiceMockDb({ existingProduct: { id: 'prod-tailoring', taxRate: 5 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    const res = await generateTailoringInvoice('to-1')

    expect(res.success).toBe(true)
    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0]
    expect(call.items[0]).not.toHaveProperty('taxRate')
    expect(call.items[0]).toMatchObject({ productId: 'prod-tailoring', quantity: 2, unitPrice: 500 })
  })

  it('rejects generating a second invoice for an already-invoiced order', async () => {
    const db = makeInvoiceMockDb({ invoiceId: 'inv-existing' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTailoringInvoice('to-1')

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('TO-003')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects a zero-total order', async () => {
    const db = makeInvoiceMockDb({ totalAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTailoringInvoice('to-1')

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('TO-004')
    // The claim must be released, not left stuck on the sentinel, so the
    // order can still be invoiced later once a price is set.
    expect(db.tailoringOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: { invoiceId: null } }))
  })

  // Regression for a real double-invoice race found 2026-07-22: the old
  // code checked `order.invoiceId` then wrote it later with no atomic claim
  // in between. Simulates a second concurrent call arriving while the first
  // call's claim is already in place — it must be rejected outright, never
  // reach billingService.createInvoice a second time.
  it('rejects a concurrent second call while the first call\'s invoice generation is still in progress (atomic claim)', async () => {
    const db = makeInvoiceMockDb()
    // Simulate the claim already being held by another in-flight call.
    db.tailoringOrder.updateMany = vi.fn().mockResolvedValue({ count: 0 })
    db.tailoringOrder.findUnique = vi.fn().mockResolvedValue({ id: 'to-1', invoiceId: 'CLAIMING' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTailoringInvoice('to-1')

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('TO-005')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('releases the claim (resets invoiceId to null) if billing invoice creation fails', async () => {
    const db = makeInvoiceMockDb({ existingProduct: { id: 'prod-tailoring', taxRate: 5 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'INVOC-001', message: 'boom' } } as never)

    const res = await generateTailoringInvoice('to-1')

    expect(res.success).toBe(false)
    expect(db.tailoringOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: { invoiceId: null } }))
  })
})
