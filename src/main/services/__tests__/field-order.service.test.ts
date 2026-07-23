import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../product.service', () => ({ resolveCustomerPrice: vi.fn() }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { resolveCustomerPrice } from '../product.service'
import {
  createFieldOrderRequest, listFieldOrderRequests, acceptFieldOrderRequest, rejectFieldOrderRequest,
  listFieldOrderCatalog
} from '../field-order.service'

// Regression coverage for Phase 58 §2 — a rep's LAN submission must never be
// able to influence price (server always re-resolves it via
// resolveCustomerPrice, honoring any negotiated customer-class price, at
// accept time), must never create an Invoice directly, and the credit-limit
// check happens exactly once inside billingService.createInvoice, never
// duplicated here — structural mirror of restaurant-order.service.test.ts.

// Regression for a real double-invoice/double-resolve race found
// 2026-07-22: accept/rejectFieldOrderRequest now atomically claim the
// request (updateMany where status: 'PENDING') before doing any real work
// — this stateful mock mirrors that claim/release lifecycle so tests
// exercise the actual guard, not a bypass. `initialStatus` seeds the
// starting state; `updateMany`/`update` both mutate it, `findUnique`
// always reflects the current state.
function makeMockDb(overrides: Record<string, any> = {}) {
  let status = 'PENDING'
  const fieldOrderRequestDefaults = {
    create: vi.fn().mockResolvedValue({ id: 'req-1' }),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockImplementation(() => Promise.resolve({ id: 'req-1', repName: 'Rep A', customerId: null, status, items: [{ productId: 'prod-1', quantity: 2 }, { productId: 'prod-2', quantity: 1 }] })),
    updateMany: vi.fn().mockImplementation(({ where, data }: any) => {
      if (where.status !== undefined && status !== where.status) return Promise.resolve({ count: 0 })
      status = data.status
      return Promise.resolve({ count: 1 })
    }),
    update: vi.fn().mockImplementation(({ data }: any) => {
      if ('status' in data) status = data.status
      return Promise.resolve({ id: 'req-1', status, ...data })
    }),
  }
  const db: Record<string, any> = {
    customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1' }) },
    product: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'prod-1', isActive: true, sellingPrice: 100, taxRate: 5 },
        { id: 'prod-2', isActive: true, sellingPrice: 50, taxRate: 5 },
      ]),
    },
    fieldOrderRequest: fieldOrderRequestDefaults,
    ...overrides,
  }
  db.__setStatus = (s: string) => { status = s }
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(resolveCustomerPrice).mockImplementation(async (productId: string) => (productId === 'prod-1' ? 100 : 50))
})

describe('createFieldOrderRequest (rep-facing, unauthenticated LAN endpoint)', () => {
  it('rejects a missing rep name', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)
    const res = await createFieldOrderRequest('', undefined, undefined, [{ productId: 'prod-1', quantity: 1 }])
    expect(res.success).toBe(false)
  })

  it('rejects an empty order', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)
    const res = await createFieldOrderRequest('Rep A', undefined, undefined, [])
    expect(res.success).toBe(false)
  })

  it('rejects more than 60 line items', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)
    const items = Array.from({ length: 61 }, () => ({ productId: 'prod-1', quantity: 1 }))
    const res = await createFieldOrderRequest('Rep A', undefined, undefined, items)
    expect(res.success).toBe(false)
  })

  it('rejects a non-integer or zero/negative quantity', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)
    expect((await createFieldOrderRequest('Rep A', undefined, undefined, [{ productId: 'prod-1', quantity: 0 }])).success).toBe(false)
    expect((await createFieldOrderRequest('Rep A', undefined, undefined, [{ productId: 'prod-1', quantity: 1.5 }])).success).toBe(false)
  })

  it('rejects an unknown customerId', async () => {
    const db = makeMockDb({ customer: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createFieldOrderRequest('Rep A', 'ghost-cust', 'Ghost', [{ productId: 'prod-1', quantity: 1 }])
    expect(res.success).toBe(false)
  })

  it('rejects a product that no longer exists or is inactive', async () => {
    const db = makeMockDb({ product: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createFieldOrderRequest('Rep A', undefined, undefined, [{ productId: 'prod-1', quantity: 1 }])
    expect(res.success).toBe(false)
  })

  it('accepts a valid order and stores only productId+quantity, never a price', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createFieldOrderRequest('Rep A', undefined, undefined, [{ productId: 'prod-1', quantity: 2 }])
    expect(res.success).toBe(true)
    const createCall = db.fieldOrderRequest.create.mock.calls[0][0]
    expect(createCall.data.status).toBe('PENDING')
    expect(createCall.data.repName).toBe('Rep A')
    expect(createCall.data.items.create).toEqual([{ productId: 'prod-1', quantity: 2 }])
  })

  it('ignores any price/unitPrice field a tampered client might send', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    // @ts-expect-error deliberately sending an extra field a malicious client might add
    await createFieldOrderRequest('Rep A', undefined, undefined, [{ productId: 'prod-1', quantity: 1, unitPrice: 0.01 }])
    const createCall = db.fieldOrderRequest.create.mock.calls[0][0]
    expect(createCall.data.items.create[0]).toEqual({ productId: 'prod-1', quantity: 1 })
  })

  it('computes the estimated amount using the negotiated customer-class price when a customer is attached', async () => {
    vi.mocked(resolveCustomerPrice).mockResolvedValue(75) // negotiated price, not the 100 list price
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createFieldOrderRequest('Rep A', 'cust-1', 'Acme Traders', [{ productId: 'prod-1', quantity: 2 }])
    expect(res.success).toBe(true)
    expect(res.data?.amount).toBe(150) // 2 * 75, not 2 * 100
  })

  it('computes the estimated amount from list price when no customer is attached', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createFieldOrderRequest('Rep A', undefined, undefined, [{ productId: 'prod-1', quantity: 2 }, { productId: 'prod-2', quantity: 3 }])
    expect(res.success).toBe(true)
    expect(res.data?.amount).toBe(2 * 100 + 3 * 50)
    expect(resolveCustomerPrice).not.toHaveBeenCalled()
  })
})

describe('acceptFieldOrderRequest (staff-facing, permissioned)', () => {
  it('rejects accepting a request that is not PENDING', async () => {
    const db = makeMockDb()
    db.__setStatus('ACCEPTED')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await acceptFieldOrderRequest('req-1', { paymentMethod: 'CASH' })
    expect(res.success).toBe(false)
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects if a product in the order is no longer active, and releases the claim back to PENDING', async () => {
    const db = makeMockDb({
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'prod-1', taxRate: 5, isActive: false }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await acceptFieldOrderRequest('req-1', { paymentMethod: 'CASH' })
    expect(res.success).toBe(false)
    expect(billingService.createInvoice).not.toHaveBeenCalled()
    expect(db.fieldOrderRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'PENDING' } }))
  })

  it('builds invoice line items from resolveCustomerPrice, never anything from the original request', async () => {
    const db = makeMockDb({
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1' }) },
    })
    db.fieldOrderRequest.findUnique = vi.fn().mockResolvedValue({ id: 'req-1', repName: 'Rep A', customerId: 'cust-1', status: 'PENDING', items: [{ productId: 'prod-1', quantity: 2 }, { productId: 'prod-2', quantity: 1 }] })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    const res = await acceptFieldOrderRequest('req-1', { paymentMethod: 'UPI' }, 'user-1')
    expect(res.success).toBe(true)
    expect(resolveCustomerPrice).toHaveBeenCalledWith('prod-1', 'cust-1')
    expect(resolveCustomerPrice).toHaveBeenCalledWith('prod-2', 'cust-1')
    const invoiceArg = vi.mocked(billingService.createInvoice).mock.calls[0][0]
    expect(invoiceArg.paymentMethod).toBe('UPI')
    expect(invoiceArg.customerId).toBe('cust-1')
    expect(invoiceArg.items).toEqual([
      { productId: 'prod-1', quantity: 2, unitPrice: 100, discountAmount: 0, taxRate: 5 },
      { productId: 'prod-2', quantity: 1, unitPrice: 50, discountAmount: 0, taxRate: 5 },
    ])
  })

  it('uses the negotiated class price at accept time, even if the original estimate used list price', async () => {
    vi.mocked(resolveCustomerPrice).mockResolvedValue(75)
    const db = makeMockDb()
    db.fieldOrderRequest.findUnique = vi.fn().mockResolvedValue({ id: 'req-1', repName: 'Rep A', customerId: 'cust-1', status: 'PENDING', items: [{ productId: 'prod-1', quantity: 2 }, { productId: 'prod-2', quantity: 1 }] })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    await acceptFieldOrderRequest('req-1', { paymentMethod: 'CASH' })
    const invoiceArg = vi.mocked(billingService.createInvoice).mock.calls[0][0]
    expect(invoiceArg.items[0].unitPrice).toBe(75)
  })

  it('marks the request ACCEPTED with the resulting invoiceId on success', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    await acceptFieldOrderRequest('req-1', { paymentMethod: 'CASH' })
    expect(db.fieldOrderRequest.update).toHaveBeenCalledWith({ where: { id: 'req-1' }, data: expect.objectContaining({ status: 'ACCEPTED', invoiceId: 'inv-1' }) })
  })

  it('releases the claim back to PENDING if invoice creation fails — this is where the ONE credit-limit check happens', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'INV-003', message: 'Credit limit exceeded' } } as never)

    const res = await acceptFieldOrderRequest('req-1', { paymentMethod: 'CREDIT' })
    expect(res.success).toBe(false)
    expect(db.fieldOrderRequest.update).toHaveBeenCalledWith({ where: { id: 'req-1' }, data: { status: 'PENDING' } })
  })

  // Regression for a real double-invoice race found 2026-07-22: the status
  // check used to run against a pre-transaction snapshot with no atomic
  // claim before creating a real invoice. Simulates the actual race: the
  // initial read sees PENDING (as it would for the second of two
  // near-simultaneous calls, since neither has committed yet), but a
  // concurrent call has already won the atomic claim by the time
  // updateMany actually runs.
  it('rejects a concurrent second accept call that loses the atomic claim race, even though its own initial read saw PENDING', async () => {
    const db = makeMockDb()
    db.fieldOrderRequest.findUnique = vi.fn()
      .mockResolvedValueOnce({ id: 'req-1', repName: 'Rep A', customerId: null, status: 'PENDING', items: [{ productId: 'prod-1', quantity: 2 }, { productId: 'prod-2', quantity: 1 }] }) // initial pre-check read
      .mockResolvedValueOnce({ id: 'req-1', status: 'PROCESSING' }) // re-read after losing the claim
    db.fieldOrderRequest.updateMany = vi.fn().mockResolvedValue({ count: 0 }) // lost the race to a concurrent winner
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await acceptFieldOrderRequest('req-1', { paymentMethod: 'CASH' })

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('FOR-025')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })
})

describe('rejectFieldOrderRequest', () => {
  it('rejects a PENDING request', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await rejectFieldOrderRequest('req-1')
    expect(res.success).toBe(true)
    expect(db.fieldOrderRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'req-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'REJECTED' }),
    }))
  })

  it('refuses to reject an already-resolved request', async () => {
    const db = makeMockDb()
    db.__setStatus('ACCEPTED')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await rejectFieldOrderRequest('req-1')
    expect(res.success).toBe(false)
  })

  // Regression for the same double-resolve race class fixed in
  // acceptFieldOrderRequest, applied here too for consistency.
  it('rejects a concurrent second call once the request has already been claimed/resolved', async () => {
    const db = makeMockDb()
    db.__setStatus('ACCEPTED') // already resolved by a concurrent accept
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await rejectFieldOrderRequest('req-1')

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('FOR-031')
  })
})

describe('listFieldOrderRequests', () => {
  it('attaches product names and current prices without a schema relation', async () => {
    const db = makeMockDb({
      fieldOrderRequest: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'req-1', status: 'PENDING', repName: 'Rep A', items: [{ productId: 'prod-1', quantity: 2 }] },
        ]),
      },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'prod-1', productName: 'Widget', sellingPrice: 100 }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listFieldOrderRequests('PENDING')
    expect(res.success).toBe(true)
    const data = (res as { data: any[] }).data
    expect(data[0].items[0]).toMatchObject({ productId: 'prod-1', quantity: 2, productName: 'Widget', currentPrice: 100 })
  })
})

describe('listFieldOrderCatalog', () => {
  it('returns list price when no customer is given', async () => {
    const db = makeMockDb({
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'prod-1', productName: 'Widget', sellingPrice: 100, imagePath: null, category: null }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const catalog = await listFieldOrderCatalog()
    expect(catalog[0].price).toBe(100)
    expect(resolveCustomerPrice).not.toHaveBeenCalled()
  })

  it('resolves the negotiated customer-class price when a customer is given', async () => {
    vi.mocked(resolveCustomerPrice).mockResolvedValue(80)
    const db = makeMockDb({
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'prod-1', productName: 'Widget', sellingPrice: 100, imagePath: null, category: null }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const catalog = await listFieldOrderCatalog('cust-1')
    expect(catalog[0].price).toBe(80)
    expect(resolveCustomerPrice).toHaveBeenCalledWith('prod-1', 'cust-1')
  })
})
