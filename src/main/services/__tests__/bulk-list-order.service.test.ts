import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../sequence.service', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('BLO-00001') }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { createBulkListOrder, matchBulkListOrderItem, billBulkListOrder, getAnnualReorderReminders } from '../bulk-list-order.service'

function makeMockDb() {
  const db: Record<string, any> = {
    bulkListOrder: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'blo-1', ...data, items: [], customer: null })),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    bulkListOrderItem: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    product: { findUnique: vi.fn().mockResolvedValue({ id: 'prod-1', productName: 'Notebook 200pg' }) },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('bulk-list-order.service.createBulkListOrder', () => {
  it('rejects an order with no supply-list lines', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBulkListOrder({ customerName: 'DPS School', listName: 'Grade 5', items: [] })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BLO-003')
  })

  it('rejects when neither a customer nor an institution name is given', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBulkListOrder({ listName: 'Grade 5', items: [{ itemLabel: 'Notebook', requestedQty: 5 }] })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BLO-002')
  })
})

describe('bulk-list-order.service.matchBulkListOrderItem', () => {
  it('rejects matching a line on an order that is no longer DRAFT', async () => {
    const db = makeMockDb()
    db.bulkListOrderItem.findUnique = vi.fn().mockResolvedValue({ id: 'item-1', bulkListOrder: { status: 'BILLED' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await matchBulkListOrderItem('item-1', 'prod-1', 50)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BLO-008')
  })

  it('matches a line with a valid product and price', async () => {
    const db = makeMockDb()
    db.bulkListOrderItem.findUnique = vi.fn().mockResolvedValue({ id: 'item-1', bulkListOrder: { status: 'DRAFT' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await matchBulkListOrderItem('item-1', 'prod-1', 50)

    expect(res.success).toBe(true)
    expect(db.bulkListOrderItem.update).toHaveBeenCalledWith({ where: { id: 'item-1' }, data: { productId: 'prod-1', unitPrice: 50 } })
  })
})

describe('bulk-list-order.service.billBulkListOrder', () => {
  it('refuses to bill when one or more lines are still unmatched', async () => {
    const db = makeMockDb()
    db.bulkListOrder.findUnique.mockResolvedValue({
      id: 'blo-1', orderNumber: 'BLO-00001', listName: 'Grade 5', customerId: 'cust-1',
      items: [{ productId: 'prod-1', unitPrice: 50, requestedQty: 5 }, { productId: null, unitPrice: null, requestedQty: 3 }],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billBulkListOrder('blo-1', 'CREDIT')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BLO-016')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
    // Rolled back to null so a subsequent retry (after matching the rest) can re-claim it.
    expect(db.bulkListOrder.update).toHaveBeenCalledWith({ where: { id: 'blo-1' }, data: { invoiceId: null } })
  })

  it('bills every matched line in one shot once all lines are matched', async () => {
    const db = makeMockDb()
    db.bulkListOrder.findUnique.mockResolvedValue({
      id: 'blo-1', orderNumber: 'BLO-00001', listName: 'Grade 5', customerId: 'cust-1',
      items: [{ productId: 'prod-1', unitPrice: 50, requestedQty: 5 }],
    })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billBulkListOrder('blo-1', 'CREDIT', 'user-1')

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1', items: [{ productId: 'prod-1', quantity: 5, unitPrice: 50 }],
    }))
    expect(db.bulkListOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'blo-1' }, data: { invoiceId: 'inv-1', status: 'BILLED' },
    }))
  })
})

describe('bulk-list-order.service.getAnnualReorderReminders', () => {
  it('flags an institution whose last order was 10-14 months ago as DUE_SOON and >14 as OVERDUE', async () => {
    const db = makeMockDb()
    const now = Date.now()
    db.bulkListOrder.findMany = vi.fn().mockResolvedValue([
      { id: 'o1', orderNumber: 'BLO-001', customerId: 'cust-1', customerName: null, createdAt: new Date(now - 11 * 30 * 86400000), customer: { customerName: 'DPS School' } },
      { id: 'o2', orderNumber: 'BLO-002', customerId: 'cust-2', customerName: null, createdAt: new Date(now - 16 * 30 * 86400000), customer: { customerName: 'City Office' } },
      { id: 'o3', orderNumber: 'BLO-003', customerId: 'cust-3', customerName: null, createdAt: new Date(now - 2 * 30 * 86400000), customer: { customerName: 'Recent Buyer' } },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getAnnualReorderReminders()

    expect(res.success).toBe(true)
    const rows = (res as { data: Array<{ institutionName: string; status: string }> }).data
    expect(rows.find(r => r.institutionName === 'DPS School')?.status).toBe('DUE_SOON')
    expect(rows.find(r => r.institutionName === 'City Office')?.status).toBe('OVERDUE')
    expect(rows.find(r => r.institutionName === 'Recent Buyer')).toBeUndefined()
  })

  it('only considers each institution\'s single most recent order, not every past order', async () => {
    const db = makeMockDb()
    const now = Date.now()
    db.bulkListOrder.findMany = vi.fn().mockResolvedValue([
      { id: 'o2', orderNumber: 'BLO-002', customerId: 'cust-1', customerName: null, createdAt: new Date(now - 1 * 30 * 86400000), customer: { customerName: 'DPS School' } },
      { id: 'o1', orderNumber: 'BLO-001', customerId: 'cust-1', customerName: null, createdAt: new Date(now - 20 * 30 * 86400000), customer: { customerName: 'DPS School' } },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getAnnualReorderReminders()

    const rows = (res as { data: Array<{ institutionName: string }> }).data
    expect(rows.length).toBe(0) // most recent order (1 month ago) is far below the 10-month threshold
  })
})
