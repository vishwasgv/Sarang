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
    const db = makeMockDb({ tableOrderRequest: { findUnique: vi.fn().mockResolvedValue({ ...makePendingRequest(), status: 'ACCEPTED' }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await acceptOrderRequest('req-1', { paymentMethod: 'CASH' })
    expect(res.success).toBe(false)
  })

  it('rejects if a product in the order is no longer active', async () => {
    const db = makeMockDb({
      tableOrderRequest: { findUnique: vi.fn().mockResolvedValue(makePendingRequest()) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'prod-1', sellingPrice: 100, taxRate: 5, isActive: false }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await acceptOrderRequest('req-1', { paymentMethod: 'CASH' })
    expect(res.success).toBe(false)
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('builds invoice line items from the CURRENT Product price, never anything from the original request', async () => {
    const db = makeMockDb({ tableOrderRequest: { findUnique: vi.fn().mockResolvedValue(makePendingRequest()), update: vi.fn().mockResolvedValue({}) } })
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
    const db = makeMockDb({ tableOrderRequest: { findUnique: vi.fn().mockResolvedValue(makePendingRequest()), update: updateSpy } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)
    vi.mocked(createKOT).mockResolvedValue({ success: true } as never)

    await acceptOrderRequest('req-1', { paymentMethod: 'CASH' })
    expect(updateSpy).toHaveBeenCalledWith({ where: { id: 'req-1' }, data: expect.objectContaining({ status: 'ACCEPTED', invoiceId: 'inv-1' }) })
  })

  it('does not mark the request resolved if invoice creation fails', async () => {
    const updateSpy = vi.fn()
    const db = makeMockDb({ tableOrderRequest: { findUnique: vi.fn().mockResolvedValue(makePendingRequest()), update: updateSpy } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'INV-002', message: 'Insufficient stock' } } as never)

    const res = await acceptOrderRequest('req-1', { paymentMethod: 'CASH' })
    expect(res.success).toBe(false)
    expect(createKOT).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('rejectOrderRequest', () => {
  it('rejects a PENDING request', async () => {
    const updateSpy = vi.fn().mockResolvedValue({})
    const db = makeMockDb({ tableOrderRequest: { findUnique: vi.fn().mockResolvedValue({ id: 'req-1', status: 'PENDING' }), update: updateSpy } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await rejectOrderRequest('req-1')
    expect(res.success).toBe(true)
    expect(updateSpy).toHaveBeenCalledWith({ where: { id: 'req-1' }, data: expect.objectContaining({ status: 'REJECTED' }) })
  })

  it('refuses to reject an already-resolved request', async () => {
    const db = makeMockDb({ tableOrderRequest: { findUnique: vi.fn().mockResolvedValue({ id: 'req-1', status: 'ACCEPTED' }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await rejectOrderRequest('req-1')
    expect(res.success).toBe(false)
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
