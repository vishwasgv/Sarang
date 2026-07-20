import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createReturn, getTodayReturnsSummary, listReturns } from '../returns.service'

const ORIGINAL_INVOICE_ID = 'inv-orig-1'

function makeOriginalInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: ORIGINAL_INVOICE_ID,
    invoiceNumber: 'INV-000001',
    invoiceType: 'RETAIL',
    customerId: 'cust-1',
    customer: { id: 'cust-1' },
    items: [
      {
        id: 'item-1', productId: 'prod-1', quantity: 5, unitPrice: 100,
        discountAmount: 50, taxRate: 18, // 5 units, ₹50 total discount, 18% GST
        product: { id: 'prod-1', productName: 'Widget', productType: 'STANDARD' }
      }
    ],
    ...overrides
  }
}

function makeMockDb(opts: { original?: Record<string, unknown>; priorReturns?: unknown[]; originalBalance?: number; variants?: Array<{ id: string; stockQty: number }> } = {}) {
  const original = makeOriginalInvoice(opts.original)
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    invoice: {
      findUnique: vi.fn().mockResolvedValue(original),
      // Re-read of the original invoice inside the transaction, used to apply
      // the return credit to its own balanceAmount (see createReturn).
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        balanceAmount: opts.originalBalance ?? 0,
        paymentStatus: 'PAID',
      }),
      update: vi.fn(),
      // Two different findMany queries share this one mock: the prior-returns
      // lookup (`where.originalInvoiceId` present, a real FK per the
      // fresh-audit fix replacing the old notes-substring match) and the
      // RET-number bootstrap scan (`where` is just `{invoiceType: 'RETURN'}`,
      // no `originalInvoiceId`) — route by shape so the bootstrap scan (which
      // expects `{invoiceNumber}` rows) never receives priorReturns's
      // `{items}` rows and vice versa.
      findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => {
        if (where && 'originalInvoiceId' in where) return opts.priorReturns ?? []
        return []
      }),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'ret-inv-1', ...data })
      ),
    },
    inventoryMovement: { create: vi.fn() },
    inventory: { upsert: vi.fn() },
    productBatch: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    // restoreVariantStockTx (variant.service.ts) takes `tx` directly rather
    // than calling getPrisma() itself, so it runs for real against this same
    // mock db via db.$transaction below — no separate module mock needed.
    productVariant: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        (opts.variants ?? []).find(v => v.id === where.id) ?? null),
      update: vi.fn(),
    },
    customerLedger: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    customer: { update: vi.fn() },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow })
    },
  }
  db.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(db))
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('returns.service.createReturn', () => {
  it('includes tax in totalAmount/balanceAmount, not just the pre-tax net', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // Returning all 5 units: gross = 5*100 = 500, discount reversed = 50 (full),
    // net before tax = -(500 - 50) = -450, tax = 450 * 0.18 = 81
    // Correct tax-inclusive total = -450 - 81 = -531
    await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-1', quantity: 5 }], 'Defective')

    const createCall = db.invoice.create.mock.calls[0][0]
    expect(createCall.data.totalAmount).toBeCloseTo(-531, 2)
    expect(createCall.data.balanceAmount).toBeCloseTo(-531, 2)
    expect(createCall.data.taxAmount).toBeCloseTo(81, 2)
    expect(createCall.data.discountAmount).toBeCloseTo(50, 2)
  })

  // Regression: generateOutstandingReport (report.service.ts) sums
  // invoice.balanceAmount directly rather than reading CustomerLedger — before
  // this fix, a return against a still-unpaid original invoice left that
  // invoice's own balanceAmount untouched, so the Outstanding Report kept
  // showing the full original balance as owed even though the Dashboard/
  // Customer Ledger (which do read the ledger credit posted below) correctly
  // showed it reduced.
  it('reduces the ORIGINAL invoice balanceAmount by the returned amount when it still has one outstanding', async () => {
    const db = makeMockDb({ originalBalance: 700 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // Returning all 5 units nets to -531 (see tax-inclusive test above).
    await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-1', quantity: 5 }], 'Defective')

    const updateCall = db.invoice.update.mock.calls[0][0]
    expect(updateCall.where.id).toBe(ORIGINAL_INVOICE_ID)
    expect(updateCall.data.balanceAmount).toBeCloseTo(700 - 531, 2)
  })

  it('caps the original invoice balance at zero and marks it PAID when the return exceeds what was still owed', async () => {
    const db = makeMockDb({ originalBalance: 100 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-1', quantity: 5 }], 'Defective')

    const updateCall = db.invoice.update.mock.calls[0][0]
    expect(updateCall.data.balanceAmount).toBe(0)
    expect(updateCall.data.paymentStatus).toBe('PAID')
  })

  it('does not touch the original invoice balance when it was already fully paid (zero balance)', async () => {
    const db = makeMockDb({ originalBalance: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-1', quantity: 5 }], 'Defective')

    expect(db.invoice.update).not.toHaveBeenCalled()
  })

  it('credits the customer ledger with the full tax-inclusive refund amount', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-1', quantity: 5 }], 'Defective')

    const ledgerCall = db.customerLedger.create.mock.calls[0][0]
    expect(ledgerCall.data.creditAmount).toBeCloseTo(531, 2)
    const customerUpdateCall = db.customer.update.mock.calls[0][0]
    expect(customerUpdateCall.data.outstandingBalance.decrement).toBeCloseTo(531, 2)
  })

  it('rejects a return that exceeds the ORIGINAL quantity outright', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-1', quantity: 6 }], 'Defective')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RET-007')
  })

  it('rejects a second return that would exceed the REMAINING quantity after a prior return — the over-return bug', async () => {
    // 3 of the 5 units were already returned in a prior transaction for this
    // same invoice. Only 2 remain returnable.
    const db = makeMockDb({
      priorReturns: [
        { items: [{ productId: 'prod-1', quantity: 3 }] }
      ]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // Trying to return 3 more (5 - 3 already returned = only 2 remaining) must fail
    const res = await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-1', quantity: 3 }], 'Second visit')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RET-007')
  })

  it('allows a second return that stays within the remaining quantity', async () => {
    const db = makeMockDb({
      priorReturns: [
        { items: [{ productId: 'prod-1', quantity: 3 }] }
      ]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 2 units remain returnable (5 - 3) — returning exactly 2 must succeed
    const res = await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-1', quantity: 2 }], 'Second visit')

    expect(res.success).toBe(true)
  })

  // Fresh-audit fix (2026-07-12): originalInvoiceId is now a real FK column,
  // replacing the old `notes: { contains: originalInvoiceId } }` substring
  // match, which could false-match if one invoice's cuid ever appeared as a
  // substring of another's notes text.
  it('sets originalInvoiceId to the real invoice id on the created return row', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-1', quantity: 5 }], 'Defective')

    const createCall = db.invoice.create.mock.calls[0][0]
    expect(createCall.data.originalInvoiceId).toBe(ORIGINAL_INVOICE_ID)
  })

  // Real bug found 2026-07-16: a return only ever restored the shared
  // product-level Inventory.quantity, never the specific ProductVariant's
  // stockQty it was sold from — silently drifting per-size/colour stock
  // counts low forever on Clothing/Footwear. These four tests cover the fix.
  describe('variant-aware returns (real bug fix)', () => {
    function makeVariantInvoice() {
      return makeOriginalInvoice({
        items: [
          {
            id: 'item-black-m', productId: 'prod-shirt', quantity: 3, unitPrice: 500,
            discountAmount: 0, taxRate: 18, variantId: 'var-black-m', variantInfo: 'Black / M',
            product: { id: 'prod-shirt', productName: 'T-Shirt', productType: 'STANDARD' }
          },
          {
            id: 'item-red-l', productId: 'prod-shirt', quantity: 4, unitPrice: 500,
            discountAmount: 0, taxRate: 18, variantId: 'var-red-l', variantInfo: 'Red / L',
            product: { id: 'prod-shirt', productName: 'T-Shirt', productType: 'STANDARD' }
          },
        ]
      })
    }

    it('restores stock to the SPECIFIC variant sold, not just the shared product total', async () => {
      const db = makeMockDb({
        original: makeVariantInvoice(),
        variants: [{ id: 'var-black-m', stockQty: 2 }, { id: 'var-red-l', stockQty: 1 }],
      })
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-shirt', quantity: 2, variantId: 'var-black-m' }], 'Wrong size')

      expect(res.success).toBe(true)
      // Product-level aggregate still goes up (unchanged prior behavior)...
      expect(db.inventory.upsert).toHaveBeenCalledWith(expect.objectContaining({
        update: { quantity: { increment: 2 } },
      }))
      // ...AND now the exact variant that was sold gets its stock back too —
      // this call didn't exist at all before the fix.
      expect(db.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-black-m' },
        data: { stockQty: 2 + 2 }, // starting stockQty 2 + returned 2
      })
    })

    it('never touches ProductVariant when the returned product has no variant (plain products unaffected)', async () => {
      const db = makeMockDb() // default single-item, non-variant invoice
      vi.mocked(getPrisma).mockReturnValue(db as never)

      await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-1', quantity: 5 }], 'Defective')

      expect(db.productVariant.update).not.toHaveBeenCalled()
    })

    it('matches the correct line and restores the correct variant when the SAME product was sold as two different variants on one invoice', async () => {
      const db = makeMockDb({
        original: makeVariantInvoice(),
        variants: [{ id: 'var-black-m', stockQty: 0 }, { id: 'var-red-l', stockQty: 0 }],
      })
      vi.mocked(getPrisma).mockReturnValue(db as never)

      // Return 1 Red/L specifically — must not be confused with the Black/M line.
      const res = await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-shirt', quantity: 1, variantId: 'var-red-l' }], 'Damaged')

      expect(res.success).toBe(true)
      expect(db.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-red-l' },
        data: { stockQty: 1 },
      })
      expect(db.productVariant.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'var-black-m' } }))
    })

    it('tracks already-returned quantity PER VARIANT, not per product — returning all of one variant must not block returning the other', async () => {
      const db = makeMockDb({
        original: makeVariantInvoice(),
        // All 3 Black/M units were already returned in a prior transaction.
        priorReturns: [{ items: [{ productId: 'prod-shirt', variantId: 'var-black-m', quantity: 3 }] }],
        variants: [{ id: 'var-black-m', stockQty: 3 }, { id: 'var-red-l', stockQty: 0 }],
      })
      vi.mocked(getPrisma).mockReturnValue(db as never)

      // Red/L was never returned — all 4 units should still be returnable,
      // even though Black/M (same product) is fully exhausted.
      const res = await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-shirt', quantity: 4, variantId: 'var-red-l' }], 'Second visit')

      expect(res.success).toBe(true)
    })

    it('still rejects over-returning a specific variant once ITS quantity is exhausted, independent of the other variant', async () => {
      const db = makeMockDb({
        original: makeVariantInvoice(),
        priorReturns: [{ items: [{ productId: 'prod-shirt', variantId: 'var-black-m', quantity: 3 }] }],
      })
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await createReturn(ORIGINAL_INVOICE_ID, [{ productId: 'prod-shirt', quantity: 1, variantId: 'var-black-m' }], 'Second visit')

      expect(res.success).toBe(false)
      expect((res as { error: { code: string } }).error.code).toBe('RET-007')
    })
  })
})

describe('returns.service.listReturns', () => {
  it('filters by the real originalInvoiceId column, not a notes substring match', async () => {
    const db: Record<string, any> = {
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listReturns(ORIGINAL_INVOICE_ID)

    expect(db.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { invoiceType: 'RETURN', originalInvoiceId: ORIGINAL_INVOICE_ID },
    }))
  })
})

describe('returns.service.getTodayReturnsSummary', () => {
  it('sums today\'s return invoices for the Retail dashboard widget', async () => {
    const db: Record<string, any> = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          { totalAmount: -531 },
          { totalAmount: -118 },
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTodayReturnsSummary()

    expect(res.success).toBe(true)
    expect((res as { data: { count: number; totalRefunded: number } }).data).toEqual({ count: 2, totalRefunded: 649 })
  })
})
