import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { listShootBookings, getShootBooking, createShootBooking, updateShootBooking, generateShootInvoice } from '../shoot-booking.service'

// Regression coverage for the Phase 32 re-audit finding: ShootBooking.
// estimatedDurationHours is a Prisma Decimal field, returned unserialized by
// every function below. Electron's IPC can't serialize a Decimal instance
// and throws "An object could not be cloned". Live-verified: creating a
// booking with a real duration crashed (row silently written to the DB
// anyway), and listShootBookings() then also crashed with that real row
// present. A FakeDecimal test double (toString/valueOf only, like a real
// Decimal.js instance) proves serializeShootBooking actually converts the
// field to a plain number.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shoot-1', clientId: 'cust-1', shootType: 'WEDDING', shootDate: new Date(),
    shootTime: null, shootLocation: 'Test Venue',
    estimatedDurationHours: new FakeDecimal(6.5) as unknown as number,
    deliverableType: 'DIGITAL_ONLY', expectedPhotosCount: null, deliveryDeadline: null,
    photographerIds: '[]', editorAssignedId: null, status: 'INQUIRY', invoiceId: null, notes: null,
    client: { id: 'cust-1', customerName: 'Ramesh Kumar', phone: null },
    editor: null, delivery: null,
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeBooking> | null = null) {
  const db: Record<string, any> = {
    shootBooking: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeBooking({ id: 'shoot-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeBooking({ ...existing, ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('shoot-booking.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createShootBooking returns estimatedDurationHours as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createShootBooking({
      clientId: 'cust-1', shootType: 'WEDDING', shootDate: '2026-07-01',
      shootLocation: 'Test Venue', estimatedDurationHours: 6.5,
    })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { estimatedDurationHours: unknown } }).data.estimatedDurationHours).toBe('number')
  })

  it('listShootBookings returns estimatedDurationHours as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listShootBookings({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ estimatedDurationHours: unknown }> }).data[0].estimatedDurationHours).toBe('number')
  })

  it('getShootBooking returns estimatedDurationHours as a plain number', async () => {
    const db = makeMockDb(makeBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getShootBooking('shoot-1')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { estimatedDurationHours: unknown } }).data.estimatedDurationHours).toBe('number')
  })

  it('updateShootBooking returns estimatedDurationHours as a plain number', async () => {
    const db = makeMockDb(makeBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateShootBooking({ id: 'shoot-1', estimatedDurationHours: 8 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { estimatedDurationHours: unknown } }).data.estimatedDurationHours).toBe('number')
  })

  it('rejects a negative finalAmount before touching the database', async () => {
    const db = makeMockDb(makeBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateShootBooking({ id: 'shoot-1', finalAmount: -100 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SHT-006')
    expect(db.shootBooking.update).not.toHaveBeenCalled()
  })
})

// Phase 40 — generateShootInvoice

function makeBookingForInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shoot-1', clientId: 'cust-1', shootType: 'WEDDING', shootLocation: 'Test Venue',
    finalAmount: 50000, invoiceId: null, addOnItems: [],
    ...overrides,
  }
}

function makeInvoiceMockDb(booking: ReturnType<typeof makeBookingForInvoice> | null) {
  // Mirrors the real atomic claim: UPDATE...WHERE invoiceId IS NULL only
  // matches (and only "wins") when the booking exists and isn't already
  // invoiced/claimed.
  const canClaim = !!booking && !booking.invoiceId
  let productSeq = 0
  return {
    shootBooking: {
      updateMany: vi.fn().mockResolvedValue({ count: canClaim ? 1 : 0 }),
      findUnique: vi.fn().mockResolvedValue(booking),
      update: vi.fn().mockResolvedValue({}),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: { data: { productName: string } }) =>
        Promise.resolve({ id: `product-${++productSeq}`, hsnCode: '998314', productName: data.productName })
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('shoot-booking.service — generateShootInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing booking', async () => {
    const db = makeInvoiceMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateShootInvoice('shoot-missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SHT-003')
  })

  it('rejects a booking that already has an invoice', async () => {
    const db = makeInvoiceMockDb(makeBookingForInvoice({ invoiceId: 'invoice-existing' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateShootInvoice('shoot-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SHT-004')
  })

  it('rejects a booking with no final amount set', async () => {
    const db = makeInvoiceMockDb(makeBookingForInvoice({ finalAmount: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateShootInvoice('shoot-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SHT-005')
  })

  it('generates an invoice and links it back to the booking', async () => {
    const db = makeInvoiceMockDb(makeBookingForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateShootInvoice('shoot-1')

    expect(res.success).toBe(true)
    expect((res as { data: { invoiceId: string } }).data.invoiceId).toBe('invoice-1')
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [expect.objectContaining({ productId: 'product-1', unitPrice: 50000 })],
    }))
    expect(db.shootBooking.update).toHaveBeenCalledWith({ where: { id: 'shoot-1' }, data: { invoiceId: 'invoice-1' } })
  })

  it('propagates a billing failure without linking an invoice, and releases the claim', async () => {
    const db = makeInvoiceMockDb(makeBookingForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateShootInvoice('shoot-1')

    expect(res.success).toBe(false)
    expect(db.shootBooking.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: { invoiceId: 'invoice-1' } }))
    expect(db.shootBooking.update).toHaveBeenCalledWith({ where: { id: 'shoot-1' }, data: { invoiceId: null } })
  })

  it('rejects and releases the claim when a concurrent call wins the race', async () => {
    const db = makeInvoiceMockDb(makeBookingForInvoice())
    db.shootBooking.updateMany = vi.fn().mockResolvedValueOnce({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateShootInvoice('shoot-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SHT-004')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  // Phase 58 §2 — Photo Studio: itemized add-ons feed into the invoice as
  // their own lines, alongside (not instead of) the base package fee.
  it('adds each itemized add-on as its own invoice line, in addition to the base package line', async () => {
    const db = makeInvoiceMockDb(makeBookingForInvoice({
      addOnItems: [
        { id: 'addon-1', description: 'Extra prints (6x4)', quantity: 20, unitPrice: 15 },
        { id: 'addon-2', description: 'Leather album copy', quantity: 1, unitPrice: 3000 },
      ],
    }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateShootInvoice('shoot-1')

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      items: [
        expect.objectContaining({ productId: 'product-1', unitPrice: 50000, quantity: 1 }),
        expect.objectContaining({ unitPrice: 15, quantity: 20 }),
        expect.objectContaining({ unitPrice: 3000, quantity: 1 }),
      ],
    }))
    // Regression for a real bug found 2026-07-22: taxRate used to be
    // hardcoded on every item here, permanently overriding the product's
    // own configurable rate.
    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0]
    for (const item of call.items) expect(item).not.toHaveProperty('taxRate')
    // Each add-on gets looked up/created by its OWN description text, not
    // folded into the base product or a single generic "add-on" line.
    expect(db.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ productName: 'Extra prints (6x4)' }) }))
    expect(db.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ productName: 'Leather album copy' }) }))
  })

  it('generates an invoice with only the base line when there are no add-ons', async () => {
    const db = makeInvoiceMockDb(makeBookingForInvoice({ addOnItems: [] }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    await generateShootInvoice('shoot-1')

    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ unitPrice: 50000 })],
    }))
  })
})
