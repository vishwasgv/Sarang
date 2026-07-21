import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'

function makeOriginalInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1', invoiceNumber: 'INV-2024-000001', invoiceType: 'RETAIL',
    status: 'ACTIVE', paidAmount: 0, customerId: 'cust-1',
    gstType: 'CGST_SGST', buyerState: 'KA', tableId: 'table-5',
    items: [
      { id: 'item-1', productId: 'prod-1', productName: 'Butter Chicken', productSku: null, hsnCode: null, quantity: 2, unitPrice: 300, discountAmount: 0, taxRate: 5, taxAmount: 30, lineTotal: 630, variantId: null, variantInfo: null, weightUnit: null },
      { id: 'item-2', productId: 'prod-2', productName: 'Naan', productSku: null, hsnCode: null, quantity: 4, unitPrice: 40, discountAmount: 0, taxRate: 5, taxAmount: 8, lineTotal: 168, variantId: null, variantInfo: null, weightUnit: null },
    ],
    ...overrides,
  }
}

// tx === db, same shape as billing-cancel.service.test.ts — splitInvoice
// reads/writes everything inside a single transaction.
function makeDb(invoiceOverride?: Record<string, unknown>) {
  const db: Record<string, any> = {
    invoice: {
      findUnique: vi.fn().mockResolvedValue(makeOriginalInvoice(invoiceOverride ?? {})),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: `new-${Math.random().toString(36).slice(2, 8)}`, ...data })
      ),
    },
    invoiceItem: { create: vi.fn().mockResolvedValue({}) },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) },
    setting: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ settingKey: 'invoice_sequence_2026', settingValue: '1', settingType: 'NUMBER' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    restaurantTable: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('billingService.splitInvoice', () => {
  it('rejects an invoice that has already had a payment recorded', async () => {
    const db = makeDb({ paidAmount: 200 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
        { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
      ],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPLIT-002')
  })

  it('rejects splitting a RETURN invoice', async () => {
    const db = makeDb({ invoiceType: 'RETURN' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
        { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
      ],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPLIT-003')
  })

  it('rejects when the atomic ACTIVE -> SPLIT claim fails (already split/cancelled)', async () => {
    const db = makeDb()
    db.invoice.updateMany = vi.fn().mockResolvedValue({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
        { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
      ],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPLIT-004')
  })

  it('rejects an allocation referencing an item that does not belong to this invoice', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { allocations: [{ invoiceItemId: 'item-from-another-invoice', quantity: 1 }] },
        { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
      ],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPLIT-005')
  })

  it('rejects allocating more of a line than was originally billed', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { allocations: [{ invoiceItemId: 'item-1', quantity: 3 }] }, // only 2 were billed
        { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
      ],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPLIT-006')
  })

  it('allows splitting a shared line\'s quantity across two checks (1 + 1 of a qty-2 line)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { allocations: [{ invoiceItemId: 'item-1', quantity: 1 }, { invoiceItemId: 'item-2', quantity: 2 }] },
        { allocations: [{ invoiceItemId: 'item-1', quantity: 1 }, { invoiceItemId: 'item-2', quantity: 2 }] },
      ],
    })

    expect(res.success).toBe(true)
    expect((res as { data: { invoiceIds: string[] } }).data.invoiceIds).toHaveLength(2)
  })

  it('creates one new ACTIVE invoice per split, each carrying splitFromInvoiceId back to the original', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
        { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
      ],
    })

    expect(db.invoice.create).toHaveBeenCalledTimes(2)
    for (const call of vi.mocked(db.invoice.create).mock.calls) {
      const data = call[0].data
      expect(data.splitFromInvoiceId).toBe('inv-1')
      expect(data.status).toBe('ACTIVE')
      expect(data.paymentStatus).toBe('UNPAID')
      expect(data.paidAmount).toBe(0)
      expect(data.tableId).toBe('table-5') // inherited from the original
    }
  })

  it('zeroes the original invoice\'s totals and flips it to SPLIT/PAID so it cannot double-count in reports', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
        { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
      ],
    })

    expect(db.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', status: 'ACTIVE' },
      data: { status: 'SPLIT', subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0, balanceAmount: 0, paymentStatus: 'PAID' }
    })
  })

  it('re-points the table from the now-zeroed original onto the first split invoice, keeping it OCCUPIED', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
        { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
      ],
    })

    expect(res.success).toBe(true)
    const [firstSplitId] = (res as { data: { invoiceIds: string[] } }).data.invoiceIds
    expect(db.restaurantTable.updateMany).toHaveBeenCalledWith({
      where: { currentInvoiceId: 'inv-1' },
      data: { currentInvoiceId: firstSplitId }
    })
  })

  it('assigns a different customerId per split when provided, defaulting to the original customer otherwise', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { customerId: 'cust-2', allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
        { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
      ],
    })

    const calls = vi.mocked(db.invoice.create).mock.calls
    expect(calls[0][0].data.customerId).toBe('cust-2')
    expect(calls[1][0].data.customerId).toBe('cust-1') // falls back to original.customerId
  })
})
