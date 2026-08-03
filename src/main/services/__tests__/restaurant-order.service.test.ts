import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../restaurant.service', () => ({ createKOT: vi.fn() }))
vi.mock('../print.service', () => ({
  generateUpiQr: vi.fn(),
  // Real logic (not a stub) — it's the exact thing this test file verifies
  // restaurant-order.service.ts correctly delegates to instead of
  // re-deriving its own copy.
  canShowUpiQr: (profile: { upiId?: string | null; country?: string | null } | null | undefined) =>
    Boolean(profile?.upiId) && profile?.country === 'IN',
}))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { createKOT } from '../restaurant.service'
import { generateUpiQr } from '../print.service'
import { createOrderRequest, listOrderRequests, acceptOrderRequest, rejectOrderRequest, listMenuProducts } from '../restaurant-order.service'

// Regression coverage for Phase 47: a customer's QR submission must never be
// able to influence price (server always re-derives it from Product at
// accept time), must never create an Invoice/KOT directly, and must be
// re-validated against currently-active products even though the customer's
// phone already validated client-side.

function makeMockDb(overrides: Record<string, any> = {}) {
  const db: Record<string, any> = {
    restaurantTable: { findUnique: vi.fn().mockResolvedValue({ id: 'table-1' }) },
    product: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'prod-1', isActive: true, sellingPrice: 100, taxRate: 5 },
        { id: 'prod-2', isActive: true, sellingPrice: 50, taxRate: 5 },
      ]),
    },
    tableOrderRequest: {
      create: vi.fn().mockResolvedValue({ id: 'req-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'req-1', ...data })),
      // Default: the atomic PENDING-status claim succeeds (count: 1) — every
      // pre-existing test here assumes "no concurrent action already
      // touched this request". Race-condition tests below override this to
      // { count: 0 } to simulate the claim losing.
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessName: 'Test Cafe', currencySymbol: '₹' }) },
    ...overrides,
  }
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('createOrderRequest (customer-facing, unauthenticated)', () => {
  it('rejects an unknown table', async () => {
    const db = makeMockDb({ restaurantTable: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createOrderRequest('bad-table', [{ productId: 'prod-1', quantity: 1 }])
    expect(res.success).toBe(false)
  })

  it('rejects an empty order', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)
    const res = await createOrderRequest('table-1', [])
    expect(res.success).toBe(false)
  })

  it('rejects more than 30 line items', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)
    const items = Array.from({ length: 31 }, () => ({ productId: 'prod-1', quantity: 1 }))
    const res = await createOrderRequest('table-1', items)
    expect(res.success).toBe(false)
  })

  it('rejects a quantity above the per-item cap', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)
    const res = await createOrderRequest('table-1', [{ productId: 'prod-1', quantity: 51 }])
    expect(res.success).toBe(false)
  })

  it('rejects a non-integer or zero/negative quantity', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)
    expect((await createOrderRequest('table-1', [{ productId: 'prod-1', quantity: 0 }])).success).toBe(false)
    expect((await createOrderRequest('table-1', [{ productId: 'prod-1', quantity: 1.5 }])).success).toBe(false)
  })

  it('rejects a product that no longer exists or is inactive', async () => {
    const db = makeMockDb({ product: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createOrderRequest('table-1', [{ productId: 'prod-1', quantity: 1 }])
    expect(res.success).toBe(false)
  })

  it('accepts a valid order and stores only productId+quantity, never a price', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createOrderRequest('table-1', [{ productId: 'prod-1', quantity: 2 }])
    expect(res.success).toBe(true)
    const createCall = db.tableOrderRequest.create.mock.calls[0][0]
    expect(createCall.data.status).toBe('PENDING')
    expect(createCall.data.items.create).toEqual([{ productId: 'prod-1', quantity: 2 }])
  })

  it('ignores any price/unitPrice field a tampered client might send', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    // @ts-expect-error deliberately sending an extra field a malicious client might add
    await createOrderRequest('table-1', [{ productId: 'prod-1', quantity: 1, unitPrice: 0.01 }])
    const createCall = db.tableOrderRequest.create.mock.calls[0][0]
    expect(createCall.data.items.create[0]).toEqual({ productId: 'prod-1', quantity: 1 })
  })

  it('computes the amount from server-side prices, ignoring anything the client sent', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    // prod-1 = 100, prod-2 = 50 per makeMockDb's product.findMany
    const res = await createOrderRequest('table-1', [{ productId: 'prod-1', quantity: 2 }, { productId: 'prod-2', quantity: 3 }])
    expect(res.success).toBe(true)
    expect(res.data?.amount).toBe(2 * 100 + 3 * 50)
  })

  it('returns no UPI QR when the business has no upiId configured', async () => {
    const db = makeMockDb() // businessProfile mock has no upiId field
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createOrderRequest('table-1', [{ productId: 'prod-1', quantity: 1 }])
    expect(res.success).toBe(true)
    expect(res.data?.upiQrDataUrl).toBeUndefined()
    expect(generateUpiQr).not.toHaveBeenCalled()
  })

  it('generates a UPI QR for the computed amount when upiId is configured for an Indian business', async () => {
    const db = makeMockDb({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessName: 'Test Cafe', upiId: 'cafe@upi', country: 'IN' }) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(generateUpiQr).mockResolvedValue('data:image/png;base64,fakeqr')

    const res = await createOrderRequest('table-1', [{ productId: 'prod-1', quantity: 1 }])
    expect(res.success).toBe(true)
    expect(res.data?.upiQrDataUrl).toBe('data:image/png;base64,fakeqr')
    expect(generateUpiQr).toHaveBeenCalledWith('cafe@upi', 'Test Cafe', 100, expect.stringContaining('Order'))
  })

  it('never shows a UPI QR for a non-Indian business, even if upiId happens to be filled in', async () => {
    const db = makeMockDb({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessName: 'Overseas Diner', upiId: 'stale@upi', country: 'US' }) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createOrderRequest('table-1', [{ productId: 'prod-1', quantity: 1 }])
    expect(res.success).toBe(true)
    expect(res.data?.upiQrDataUrl).toBeUndefined()
    expect(generateUpiQr).not.toHaveBeenCalled()
  })

  it('still succeeds if UPI QR generation throws — payment is always optional', async () => {
    const db = makeMockDb({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessName: 'Test Cafe', upiId: 'cafe@upi', country: 'IN' }) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(generateUpiQr).mockRejectedValue(new Error('qrcode failed'))

    const res = await createOrderRequest('table-1', [{ productId: 'prod-1', quantity: 1 }])
    expect(res.success).toBe(true)
    expect(res.data?.upiQrDataUrl).toBeUndefined()
  })

  // REAL BUG found+fixed 2026-07-30: a flaky WiFi connection dropping the
  // response after the POST already reached the server (or a doubled tap)
  // used to create two identical PENDING orders for one physical order at
  // the same table — indistinguishable to staff, who could accept both and
  // bill the guest twice.
  it('treats a resubmission of the exact same pending order (same table, same items) as a duplicate, not a new order', async () => {
    const db = makeMockDb({
      tableOrderRequest: {
        create: vi.fn().mockResolvedValue({ id: 'req-1' }),
        findMany: vi.fn().mockResolvedValue([
          { id: 'existing-req', tableId: 'table-1', status: 'PENDING', items: [{ productId: 'prod-1', quantity: 2 }] }
        ]),
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createOrderRequest('table-1', [{ productId: 'prod-1', quantity: 2 }])

    expect(res.success).toBe(true)
    expect(db.tableOrderRequest.create).not.toHaveBeenCalled()
  })

  it('does NOT treat a different item set at the same table as a duplicate', async () => {
    const db = makeMockDb({
      tableOrderRequest: {
        create: vi.fn().mockResolvedValue({ id: 'req-2' }),
        findMany: vi.fn().mockResolvedValue([
          { id: 'existing-req', tableId: 'table-1', status: 'PENDING', items: [{ productId: 'prod-1', quantity: 2 }] }
        ]),
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createOrderRequest('table-1', [{ productId: 'prod-2', quantity: 1 }])

    expect(res.success).toBe(true)
    expect(db.tableOrderRequest.create).toHaveBeenCalledTimes(1)
  })
})

describe('listMenuProducts', () => {
  it('never exposes costPrice or other internal fields', async () => {
    const db = makeMockDb({
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', productName: 'Burger', sellingPrice: 150, imagePath: null, category: { name: 'Mains' } },
        ]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const menu = await listMenuProducts()
    expect(menu[0]).toEqual({ id: 'p1', productName: 'Burger', sellingPrice: 150, imagePath: null, categoryName: 'Mains' })
  })

  // Phase 58 §2 (2026-07-17) — "86 today" must exclude the item from the
  // customer-facing QR menu, same as isActive:false. The query itself
  // can't distinguish "86'd until later today" from "never 86'd" in a unit
  // test (both compile to the same WHERE clause), so this asserts the
  // WHERE shape itself is correct — that a null unavailableUntil is
  // included but the query genuinely constrains on the field, not that a
  // real 86'd row gets excluded (the real Prisma query engine does that
  // filtering, not this function's own JS).
  it('queries with an isActive + unavailableUntil-not-in-the-future filter, not isActive alone', async () => {
    const db = makeMockDb({ product: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listMenuProducts()

    const call = db.product.findMany.mock.calls[0][0]
    expect(call.where.isActive).toBe(true)
    expect(call.where.OR).toEqual([{ unavailableUntil: null }, { unavailableUntil: { lte: expect.any(Date) } }])
  })
})

describe('acceptOrderRequest (staff-facing, permissioned)', () => {
  function makePendingRequest() {
    return { id: 'req-1', tableId: 'table-1', status: 'PENDING', items: [{ productId: 'prod-1', quantity: 2 }, { productId: 'prod-2', quantity: 1 }] }
  }

  it('rejects accepting a request that is not PENDING', async () => {
    const db = makeMockDb({
      tableOrderRequest: {
        // The atomic claim's WHERE also filters on status: 'PENDING', so a
        // real DB naturally returns count: 0 for an ACCEPTED row — mocked
        // explicitly here since this is not a real DB.
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({ ...makePendingRequest(), status: 'ACCEPTED' }),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await acceptOrderRequest('req-1', { paymentMethod: 'CASH' })
    expect(res.success).toBe(false)
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  // Real bug found live (2026-07-28 product-vertical audit): the
  // `status !== 'PENDING'` check ran against a plain read, with the eventual
  // `status: 'ACCEPTED'` write happening unconditionally afterward — a
  // double-tap on "Accept", or two staff accepting the same QR order
  // moments apart, could both pass the stale check and both create a real
  // invoice + KOT, silently billing the customer twice for one order. Fixed
  // to claim the request atomically first (updateMany with a status guard);
  // the loser fails cleanly instead of double-invoicing.
  it('fails cleanly instead of double-invoicing when another action already claimed the request (concurrent accept race)', async () => {
    const db = makeMockDb({
      tableOrderRequest: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({ status: 'ACCEPTED' }),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await acceptOrderRequest('req-1', { paymentMethod: 'CASH' })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('QRO-021')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
    expect(createKOT).not.toHaveBeenCalled()
  })

  it('rejects if a product in the order is no longer active', async () => {
    const db = makeMockDb({
      tableOrderRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn().mockResolvedValue(makePendingRequest()), update: vi.fn().mockResolvedValue({}) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'prod-1', sellingPrice: 100, taxRate: 5, isActive: false }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await acceptOrderRequest('req-1', { paymentMethod: 'CASH' })
    expect(res.success).toBe(false)
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('builds invoice line items from the CURRENT Product price, never anything from the original request', async () => {
    const db = makeMockDb({ tableOrderRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn().mockResolvedValue(makePendingRequest()), update: vi.fn().mockResolvedValue({}) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)
    vi.mocked(createKOT).mockResolvedValue({ success: true } as never)

    const res = await acceptOrderRequest('req-1', { paymentMethod: 'UPI' }, 'user-1')
    expect(res.success).toBe(true)
    const invoiceArg = vi.mocked(billingService.createInvoice).mock.calls[0][0]
    expect(invoiceArg.paymentMethod).toBe('UPI')
    expect(invoiceArg.items).toEqual([
      { productId: 'prod-1', quantity: 2, unitPrice: 100, discountAmount: 0, taxRate: 5 },
      { productId: 'prod-2', quantity: 1, unitPrice: 50, discountAmount: 0, taxRate: 5 },
    ])
    expect(createKOT).toHaveBeenCalledWith('inv-1', 'table-1', 'user-1')
  })

  it('marks the request ACCEPTED with the resulting invoiceId on success', async () => {
    const updateSpy = vi.fn().mockResolvedValue({})
    const db = makeMockDb({ tableOrderRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn().mockResolvedValue(makePendingRequest()), update: updateSpy } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)
    vi.mocked(createKOT).mockResolvedValue({ success: true } as never)

    await acceptOrderRequest('req-1', { paymentMethod: 'CASH' })
    expect(updateSpy).toHaveBeenCalledWith({ where: { id: 'req-1' }, data: expect.objectContaining({ status: 'ACCEPTED', invoiceId: 'inv-1' }) })
  })

  // Note: unlike the pre-fix version, a failed invoice creation now DOES
  // call `update` once — to revert the atomic PROCESSING claim back to
  // PENDING so the request isn't left permanently stuck and can be retried
  // or rejected. It must never be called with status: 'ACCEPTED'.
  it('does not mark the request ACCEPTED if invoice creation fails, and reverts the claim back to PENDING', async () => {
    const updateSpy = vi.fn().mockResolvedValue({})
    const db = makeMockDb({ tableOrderRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn().mockResolvedValue(makePendingRequest()), update: updateSpy } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'INV-002', message: 'Insufficient stock' } } as never)

    const res = await acceptOrderRequest('req-1', { paymentMethod: 'CASH' })
    expect(res.success).toBe(false)
    expect(createKOT).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) }))
    expect(updateSpy).toHaveBeenCalledWith({ where: { id: 'req-1' }, data: { status: 'PENDING' } })
  })
})

describe('rejectOrderRequest', () => {
  it('rejects a PENDING request', async () => {
    const updateManySpy = vi.fn().mockResolvedValue({ count: 1 })
    const db = makeMockDb({ tableOrderRequest: { updateMany: updateManySpy, findUnique: vi.fn().mockResolvedValue({ id: 'req-1', status: 'PENDING' }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await rejectOrderRequest('req-1')
    expect(res.success).toBe(true)
    expect(updateManySpy).toHaveBeenCalledWith({ where: { id: 'req-1', status: 'PENDING' }, data: expect.objectContaining({ status: 'REJECTED' }) })
  })

  it('refuses to reject an already-resolved request', async () => {
    const db = makeMockDb({
      tableOrderRequest: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({ id: 'req-1', status: 'ACCEPTED' }),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await rejectOrderRequest('req-1')
    expect(res.success).toBe(false)
  })

  // Real bug found live (2026-07-28 product-vertical audit): same TOCTOU
  // shape as acceptOrderRequest — reject used to check status via a plain
  // read, then write unconditionally. A reject racing an accept for the
  // same request could silently overwrite whichever action actually won.
  // Fixed to an atomic updateMany claim.
  it('fails cleanly instead of overwriting an already-accepted request (concurrent reject-vs-accept race)', async () => {
    const db = makeMockDb({
      tableOrderRequest: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({ id: 'req-1', status: 'ACCEPTED' }),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await rejectOrderRequest('req-1')
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('QRO-031')
  })
})

describe('listOrderRequests', () => {
  it('attaches product names and current prices without a schema relation', async () => {
    const db = makeMockDb({
      tableOrderRequest: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'req-1', status: 'PENDING', table: { tableNumber: 'T1' }, items: [{ productId: 'prod-1', quantity: 2 }] },
        ]),
      },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'prod-1', productName: 'Burger', sellingPrice: 100 }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listOrderRequests('PENDING')
    expect(res.success).toBe(true)
    const data = (res as { data: any[] }).data
    expect(data[0].items[0]).toMatchObject({ productId: 'prod-1', quantity: 2, productName: 'Burger', currentPrice: 100 })
  })
})
