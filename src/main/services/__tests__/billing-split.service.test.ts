import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { generateLicenseKey } from '../license.service'

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
    // customerLedgerService is the REAL module here (not mocked) — addEntry()
    // internally reads customerLedger.aggregate (calculateBalance) then
    // writes customerLedger.create + customer.update.
    customerLedger: {
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }),
      create: vi.fn().mockResolvedValue({}),
    },
    customer: { update: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('billingService.splitInvoice', () => {
  // REAL BUG found+fixed 2026-07-30: createInvoice() correctly blocks new
  // invoices on an EXPIRED license, but splitInvoice() creates brand-new,
  // independently-payable Invoice rows too (fresh invoice numbers,
  // printable/exportable, appearing in every report) and had no license
  // check at all — letting an EXPIRED install mint unlimited new billable
  // documents by repeatedly splitting any existing unpaid invoice. Same
  // check, same pattern, as billing.service.test.ts's createInvoice license
  // enforcement tests.
  it('blocks splitting when the license has genuinely expired', async () => {
    const db = makeDb()
    const expiredKey = generateLicenseKey('TRIAL', 'IN', new Date(Date.now() - 400 * 86_400_000))
    db.setting.findUnique = vi.fn().mockImplementation(({ where }: { where: { settingKey: string } }) =>
      Promise.resolve(where.settingKey === 'license_key' ? { settingKey: 'license_key', settingValue: expiredKey } : null)
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
        { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
      ],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('LIC-002')
    expect(db.invoice.create).not.toHaveBeenCalled()
  })

  it('does NOT block splitting for a PAID license still within its paid year', async () => {
    const db = makeDb()
    const paidKey = generateLicenseKey('PAID', 'IN', new Date(Date.now() - 10 * 86_400_000))
    db.setting.findUnique = vi.fn().mockImplementation(({ where }: { where: { settingKey: string } }) =>
      Promise.resolve(where.settingKey === 'license_key' ? { settingKey: 'license_key', settingValue: paidKey } : null)
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
        { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
      ],
    })

    expect(res.success).toBe(true)
  })

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

  // Real bug found+fixed in the zero-logical-errors audit: this function
  // zeroed the original invoice's own totals but never touched
  // CustomerLedger. If the original was a CREDIT sale (a real debit posted
  // at createInvoice time), that debit stayed on the original customer's
  // ledger forever even though the value "moved" to the new split invoices
  // — permanently overstating outstandingBalance, the exact field
  // credit-limit enforcement compares against. And since every split
  // invoice starts UNPAID and is only ever settled later via
  // payment.service.ts's recordPayment (which unconditionally CREDITS the
  // ledger whenever customerId is set), a split invoice with no matching
  // debit drove that customer's balance negative the moment it was paid.
  describe('splitInvoice — CustomerLedger correctness', () => {
    it('reverses the original customer\'s existing CREDIT-sale ledger debit before creating split invoices', async () => {
      const db = makeDb()
      db.customerLedger.findMany = vi.fn().mockImplementation(({ where }: { where: { referenceType: string; referenceId: string } }) =>
        Promise.resolve(where.referenceType === 'INVOICE' && where.referenceId === 'inv-1'
          ? [{ id: 'led-1', customerId: 'cust-1', referenceType: 'INVOICE', referenceId: 'inv-1', debitAmount: 798, creditAmount: 0 }]
          : [])
      )
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await billingService.splitInvoice({
        invoiceId: 'inv-1',
        splits: [
          { allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
          { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
        ],
      })

      expect(res.success).toBe(true)
      const reversalCall = vi.mocked(db.customerLedger.create).mock.calls.find(
        (c: any) => c[0].data.referenceType === 'INVOICE_SPLIT'
      )
      expect(reversalCall).toBeDefined()
      expect(reversalCall![0].data).toMatchObject({ customerId: 'cust-1', debitAmount: 0, creditAmount: 798 })
    })

    it('does not attempt a reversal when the original had no ledger entry (a plain non-credit sale)', async () => {
      const db = makeDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)

      await billingService.splitInvoice({
        invoiceId: 'inv-1',
        splits: [
          { allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
          { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
        ],
      })

      const reversalCalls = vi.mocked(db.customerLedger.create).mock.calls.filter(
        (c: any) => c[0].data.referenceType === 'INVOICE_SPLIT'
      )
      expect(reversalCalls).toHaveLength(0)
    })

    it('posts a matching CustomerLedger debit for each split invoice\'s own customer', async () => {
      const db = makeDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)

      await billingService.splitInvoice({
        invoiceId: 'inv-1',
        splits: [
          { customerId: 'cust-2', allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
          { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
        ],
      })

      const debitCalls = vi.mocked(db.customerLedger.create).mock.calls
        .filter((c: any) => c[0].data.referenceType === 'INVOICE')
        .map((c: any) => c[0].data)
      expect(debitCalls).toHaveLength(2)
      expect(debitCalls.find((d: any) => d.customerId === 'cust-2')).toMatchObject({ debitAmount: 630, creditAmount: 0 })
      expect(debitCalls.find((d: any) => d.customerId === 'cust-1')).toMatchObject({ debitAmount: 168, creditAmount: 0 })
    })

    it('does not post a ledger debit for a split with no customerId (walk-in)', async () => {
      const db = makeDb({ customerId: null })
      vi.mocked(getPrisma).mockReturnValue(db as never)

      await billingService.splitInvoice({
        invoiceId: 'inv-1',
        splits: [
          { allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
          { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
        ],
      })

      expect(db.customerLedger.create).not.toHaveBeenCalled()
    })
  })
})

describe('billingService.splitInvoice: invoice-level discount and stored proration (gap 3.27)', () => {
  const discounted = {
    pricesIncludeTax: false,
    subtotal: 760, discountAmount: 76, taxAmount: 34.2, roundingAmount: -0.2, totalAmount: 718,
    items: [
      { id: 'item-1', productId: 'prod-1', productName: 'Butter Chicken', productSku: null, hsnCode: null, quantity: 2, unitPrice: 300, discountAmount: 0, taxRate: 5, taxAmount: 27, lineTotal: 567, variantId: null, variantInfo: null, weightUnit: null },
      { id: 'item-2', productId: 'prod-2', productName: 'Naan', productSku: null, hsnCode: null, quantity: 4, unitPrice: 40, discountAmount: 0, taxRate: 5, taxAmount: 7.2, lineTotal: 151.2, variantId: null, variantInfo: null, weightUnit: null },
    ],
  }

  it('keeps the invoice-level discount share in each part', async () => {
    const db = makeDb(discounted)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [
        { allocations: [{ invoiceItemId: 'item-1', quantity: 2 }] },
        { allocations: [{ invoiceItemId: 'item-2', quantity: 4 }] },
      ],
    })
    expect(res.success).toBe(true)
    const created = vi.mocked(db.invoice.create).mock.calls.map((c: any) => c[0].data)
    expect(created[0]).toMatchObject({ subtotal: 600, discountAmount: 60, taxAmount: 27, totalAmount: 567 })
    expect(created[1]).toMatchObject({ subtotal: 160, discountAmount: 16, taxAmount: 7.2, totalAmount: 151 })
    const items = vi.mocked(db.invoiceItem.create).mock.calls.map((c: any) => c[0].data)
    expect(items[0]).toMatchObject({ taxAmount: 27, lineTotal: 567 })
  })

  it('a shared line splits its stored taxable and tax and the last piece takes the remainder', async () => {
    const db = makeDb({ ...discounted, items: [{ ...discounted.items[0], quantity: 3, unitPrice: 100, taxAmount: 1.33, lineTotal: 26.67 + 1.33 }] })
    db.invoice.findUnique = vi.fn().mockResolvedValue(makeOriginalInvoice({ ...discounted, items: [{ ...discounted.items[0], quantity: 3, unitPrice: 100, taxAmount: 1.33, lineTotal: 28 }] }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.splitInvoice({
      invoiceId: 'inv-1',
      splits: [1, 1, 1].map(quantity => ({ allocations: [{ invoiceItemId: 'item-1', quantity }] })),
    })
    const items = vi.mocked(db.invoiceItem.create).mock.calls.map((c: any) => c[0].data)
    const taxSum = Math.round(items.reduce((a: number, i: any) => a + i.taxAmount, 0) * 100) / 100
    const totalSum = Math.round(items.reduce((a: number, i: any) => a + i.lineTotal, 0) * 100) / 100
    expect(taxSum).toBe(1.33)
    expect(totalSum).toBe(28)
  })
})
