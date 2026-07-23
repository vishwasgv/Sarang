import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../inventory.service', () => ({ inventoryService: { reduceStockTx: vi.fn() } }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn() } }))
vi.mock('../industry-template.service', () => ({ isModuleEnabled: vi.fn().mockResolvedValue(false) }))
vi.mock('../notification.service', () => ({ createNotification: vi.fn() }))

import { getPrisma } from '../../database/db'
import { isModuleEnabled } from '../industry-template.service'
import { billingService } from '../billing.service'

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1', productName: 'Widget', sku: 'W-001', hsnCode: null,
    productType: 'STANDARD', taxRate: 0, isActive: true,
    inventory: { quantity: 50 },
    ...overrides
  }
}

function makeMockDb(productOverrides: Record<string, unknown> = {}) {
  // tx === db: the credit-limit check (and invoice number sequence) now read
  // fresh INSIDE the transaction, so the callback must see the same mocked
  // customer/setting/etc. the tests assert against or override.
  const db: Record<string, any> = {
    setting: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ settingKey: 'k', settingValue: '1', settingType: 'NUMBER' }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    product: {
      findUnique: vi.fn().mockResolvedValue(makeProduct(productOverrides)),
    },
    customer: { findUnique: vi.fn().mockResolvedValue(null) },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) },
    invoice: {
      create: vi.fn().mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2024-000001', paidAmount: 0 }),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    invoiceItem: { create: vi.fn() },
    payment: { create: vi.fn() },
    // No batches/serials in these fixtures — FIFO deduction is a no-op, matching a plain, untracked product.
    // aggregate() returning a null sum is what hasEnoughNonExpiredBatchStock reads as
    // "no batch tracking in use for this product" — same untracked-product case.
    productBatch: {
      findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantityRemaining: null } }),
    },
    productSerial: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    metalExchange: {
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    restaurantTable: {
      // Claims every requested table by default (tests that want a partial
      // claim — simulating an already-occupied table — override this). The
      // release call shape (releaseTablesForInvoiceTx) has no `where.id.in`
      // at all — just returns a fixed count for that case.
      updateMany: vi.fn().mockImplementation(({ where }: { where: { id?: { in: string[] } } }) =>
        Promise.resolve({ count: where.id ? where.id.in.length : 1 })
      ),
    },
  }
  // listInvoices uses the array form db.$transaction([...]) instead of the
  // callback form createInvoice/cancelInvoice use — support both.
  db.$transaction = vi.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)
  )
  return db
}

const basePayload = {
  items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100, discountAmount: 0, taxRate: 0 }],
  paymentMethod: 'CASH' as const,
  globalDiscount: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('billingService.createInvoice', () => {
  it('rejects archived products with PRD-005', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb({ isActive: false }) as never)

    const res = await billingService.createInvoice(basePayload)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PRD-005')
  })

  it('rejects negative unit price with INVOC-008', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: -5, discountAmount: 0, taxRate: 0 }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INVOC-008')
  })

  it('rejects a per-line discount that exceeds the line\'s own value with INVOC-010', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 10, discountAmount: 500, taxRate: 0 }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INVOC-010')
  })

  it('rejects when stock below required quantity and allow_negative_inventory is false', async () => {
    const db = makeMockDb({ inventory: { quantity: 1 } })
    // setting findUnique returns null → allow_negative = false
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 5, unitPrice: 10, discountAmount: 0, taxRate: 0 }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INV-002')
  })

  it('allows oversell when allow_negative_inventory setting is true', async () => {
    const db = makeMockDb({ inventory: { quantity: 1 } })
    db.setting.findUnique = vi.fn().mockResolvedValue({ settingKey: 'allow_negative_inventory', settingValue: 'true', settingType: 'BOOLEAN' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 5, unitPrice: 10, discountAmount: 0, taxRate: 0 }],
    })

    expect(res.success).toBe(true)
  })

  it('blocks a sale with BATCH-004 when only expired batch stock covers the requested quantity', async () => {
    const db = makeMockDb()
    db.productBatch.aggregate = vi.fn()
      .mockResolvedValueOnce({ _sum: { quantityRemaining: 20 } }) // total active batch stock exists...
      .mockResolvedValueOnce({ _sum: { quantityRemaining: null } }) // ...but none of it is non-expired
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice(basePayload)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BATCH-004')
  })

  it('allows the sale when allow_expired_batch_sale is explicitly enabled, even with only expired stock', async () => {
    const db = makeMockDb()
    db.setting.findUnique = vi.fn().mockResolvedValue({ settingKey: 'allow_expired_batch_sale', settingValue: 'true', settingType: 'BOOLEAN' })
    db.productBatch.aggregate = vi.fn().mockResolvedValue({ _sum: { quantityRemaining: 20 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice(basePayload)

    expect(res.success).toBe(true)
  })

  // Fresh-audit fix (2026-07-12): a customer marked taxExempt (B2B reverse
  // charge, diplomatic/NGO exemption, etc.) previously had no way to get a
  // 0%-tax invoice — every line always taxed at the product's own rate
  // regardless of who the buyer was.
  it('zeroes tax on every line when the customer is marked taxExempt, regardless of product/item tax rate', async () => {
    const db = makeMockDb({ taxRate: 18 })
    db.customer.findUnique = vi.fn().mockResolvedValue({ taxExempt: true, taxExemptReason: 'Reverse charge — VAT Reg GB123456789' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      customerId: 'cust-exempt',
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100, discountAmount: 0, taxRate: 18 }],
    })

    expect(res.success).toBe(true)
    const createCall = db.invoice.create.mock.calls[0][0]
    expect(createCall.data.taxAmount).toBe(0)
    expect(createCall.data.totalAmount).toBe(200) // 2*100, no tax
    expect(createCall.data.notes).toContain('Tax Exempt')
    expect(createCall.data.notes).toContain('Reverse charge — VAT Reg GB123456789')
    const itemCreateCall = db.invoiceItem.create.mock.calls[0][0]
    expect(itemCreateCall.data.taxRate).toBe(0)
    expect(itemCreateCall.data.taxAmount).toBe(0)
  })

  it('applies normal tax when the customer is not tax-exempt', async () => {
    const db = makeMockDb({ taxRate: 18 })
    db.customer.findUnique = vi.fn().mockResolvedValue({ taxExempt: false, taxExemptReason: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      customerId: 'cust-normal',
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100, discountAmount: 0, taxRate: 18 }],
    })

    expect(res.success).toBe(true)
    const createCall = db.invoice.create.mock.calls[0][0]
    expect(createCall.data.taxAmount).toBeCloseTo(36, 2) // 200 * 18%
    expect(createCall.data.notes).toBeNull()
  })

  it('rejects a discount exceeding the configured max_discount_percent with INVOC-011', async () => {
    const db = makeMockDb()
    db.setting.findUnique = vi.fn().mockResolvedValue({ settingKey: 'max_discount_percent', settingValue: '10', settingType: 'NUMBER' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // Line gross = 2 * 100 = 200; a 50 discount is 25%, above the 10% cap.
    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100, discountAmount: 50, taxRate: 0 }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INVOC-011')
  })

  it('allows a discount at or under the configured max_discount_percent', async () => {
    const db = makeMockDb()
    db.setting.findUnique = vi.fn().mockResolvedValue({ settingKey: 'max_discount_percent', settingValue: '10', settingType: 'NUMBER' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // Line gross = 2 * 100 = 200; a 20 discount is exactly 10%.
    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100, discountAmount: 20, taxRate: 0 }],
    })

    expect(res.success).toBe(true)
  })

  it('does not cap discounts at all when max_discount_percent is unset (default, preserves existing manual-discount flexibility)', async () => {
    const db = makeMockDb() // setting.findUnique defaults to null
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100, discountAmount: 90, taxRate: 0 }],
    })

    expect(res.success).toBe(true)
  })

  it('rejects a negative invoice total with INVOC-002', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      // A large GLOBAL discount (not per-line) drives the total negative without
      // tripping the per-line discount cap — isolates the invoice-level guard.
      globalDiscount: 500,
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 10, discountAmount: 0, taxRate: 0 }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INVOC-002')
  })

  it('enforces credit limit when module is enabled', async () => {
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    const db = makeMockDb()
    db.customer.findUnique = vi.fn().mockResolvedValue({
      id: 'cust-1', creditLimit: 500, outstandingBalance: 400
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      paymentMethod: 'CREDIT',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 200, discountAmount: 0, taxRate: 0 }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CUST-003')
  })

  it('does NOT block a SPLIT payment for credit limit — SPLIT is always paid in full immediately across two methods, not real deferred credit', async () => {
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    const db = makeMockDb()
    // Same over-limit scenario as the CREDIT test above (outstanding 400 +
    // this 200 invoice > limit 500) — if this were still gated on
    // `startsUnpaid` instead of `isCredit`, it would wrongly fail with CUST-003.
    db.customer.findUnique = vi.fn().mockResolvedValue({
      id: 'cust-1', creditLimit: 500, outstandingBalance: 400
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      paymentMethod: 'SPLIT',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 200, discountAmount: 0, taxRate: 0 }],
    })

    expect(res.success).toBe(true)
  })

  it('reads the customer credit limit inside the transaction (no race window)', async () => {
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    const db = makeMockDb()
    db.customer.findUnique = vi.fn().mockResolvedValue({ id: 'cust-1', creditLimit: 500, outstandingBalance: 100 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.createInvoice({
      ...basePayload,
      paymentMethod: 'CREDIT',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 50, discountAmount: 0, taxRate: 0 }],
    })

    // Two calls to customer.findUnique now happen for a CREDIT sale with a
    // customer: an early one for the tax-exempt check (a rarely-changing
    // flag, no meaningful race window, safe to read before the transaction
    // opens) and the credit-limit check, which specifically MUST stay inside
    // the transaction to avoid the TOCTOU race this test guards against —
    // asserts on the LAST call, not the first, so both can coexist.
    const txCallOrder = vi.mocked(db.$transaction).mock.invocationCallOrder[0]
    const findCallOrders = vi.mocked(db.customer.findUnique).mock.invocationCallOrder
    const lastFindCallOrder = findCallOrders[findCallOrders.length - 1]
    expect(txCallOrder).toBeLessThan(lastFindCallOrder)
  })

  it('requires a customer for credit sales', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      paymentMethod: 'CREDIT',
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INVOC-009')
  })

  // Phase 38: loose/weight-based billing — a decimal quantity line must be
  // accepted (not rejected as invalid) and the weightUnit snapshot must reach
  // the InvoiceItem row so a historical invoice still reads correctly even if
  // the product's loose-billing config later changes or is turned off.
  it('accepts a decimal quantity for a loose-billed line and snapshots weightUnit onto the InvoiceItem', async () => {
    const db = makeMockDb({ inventory: { quantity: 50 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 0.25, unitPrice: 80, discountAmount: 0, taxRate: 0, weightUnit: 'kg' }],
    })

    expect(res.success).toBe(true)
    const createCall = vi.mocked(db.invoiceItem.create).mock.calls[0][0] as { data: { quantity: number; weightUnit: string | null } }
    expect(createCall.data.quantity).toBe(0.25)
    expect(createCall.data.weightUnit).toBe('kg')
  })

  it('leaves weightUnit null on a normal fixed-pack line (not a loose sale)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.createInvoice(basePayload)

    const createCall = vi.mocked(db.invoiceItem.create).mock.calls[0][0] as { data: { weightUnit: string | null } }
    expect(createCall.data.weightUnit).toBeNull()
  })

  it('rejects a stock check for a loose item exactly the same way as a whole-unit item — insufficient stock still blocks the sale', async () => {
    const db = makeMockDb({ inventory: { quantity: 0.1 } }) // only 0.1kg in stock
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 0.25, unitPrice: 80, discountAmount: 0, taxRate: 0, weightUnit: 'kg' }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INV-002')
  })
})

// Phase 58 §2 — Pharmacy Schedule H/H1 prescription capture. A prescription-
// flagged product must never be sold without a patient + doctor name
// captured on the line — enforced server-side, never trusting the UI alone.
describe('billingService.createInvoice — Pharmacy Schedule H/H1 prescription capture', () => {
  it('rejects a prescription-required product with no prescription details at all', async () => {
    const db = makeMockDb({ isPrescriptionRequired: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice(basePayload)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RX-001')
    expect(db.invoiceItem.create).not.toHaveBeenCalled()
  })

  it('rejects when only the patient name is provided (doctor name still missing)', async () => {
    const db = makeMockDb({ isPrescriptionRequired: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100, discountAmount: 0, taxRate: 0, prescriptionPatientName: 'Ravi Kumar' }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RX-001')
  })

  it('rejects when patient/doctor names are present but whitespace-only', async () => {
    const db = makeMockDb({ isPrescriptionRequired: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100, discountAmount: 0, taxRate: 0, prescriptionPatientName: '   ', prescriptionDoctorName: '   ' }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RX-001')
  })

  it('accepts and snapshots the prescription details onto the InvoiceItem when both names are provided', async () => {
    const db = makeMockDb({ isPrescriptionRequired: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100, discountAmount: 0, taxRate: 0, prescriptionPatientName: ' Ravi Kumar ', prescriptionDoctorName: ' Dr. Mehta ', prescriptionDate: '2026-07-10' }],
    })

    expect(res.success).toBe(true)
    const createCall = vi.mocked(db.invoiceItem.create).mock.calls[0][0] as { data: { prescriptionPatientName: string; prescriptionDoctorName: string; prescriptionDate: Date } }
    // Trimmed, not stored with surrounding whitespace
    expect(createCall.data.prescriptionPatientName).toBe('Ravi Kumar')
    expect(createCall.data.prescriptionDoctorName).toBe('Dr. Mehta')
    expect(createCall.data.prescriptionDate).toEqual(new Date('2026-07-10'))
  })

  it('never requires or stores prescription details for a normal (non-flagged) product', async () => {
    const db = makeMockDb() // isPrescriptionRequired defaults to undefined/false
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice(basePayload) // no prescription fields sent at all

    expect(res.success).toBe(true)
    const createCall = vi.mocked(db.invoiceItem.create).mock.calls[0][0] as { data: { prescriptionPatientName: string | null; prescriptionDoctorName: string | null } }
    expect(createCall.data.prescriptionPatientName).toBeNull()
    expect(createCall.data.prescriptionDoctorName).toBeNull()
  })

  it('ignores a prescriptionPatientName/DoctorName sent for a non-flagged product (never trusts an unnecessary client-sent value)', async () => {
    const db = makeMockDb() // isPrescriptionRequired false
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100, discountAmount: 0, taxRate: 0, prescriptionPatientName: 'Someone', prescriptionDoctorName: 'Dr. Someone' }],
    })

    expect(res.success).toBe(true)
    const createCall = vi.mocked(db.invoiceItem.create).mock.calls[0][0] as { data: { prescriptionPatientName: string | null; prescriptionDoctorName: string | null } }
    expect(createCall.data.prescriptionPatientName).toBeNull()
    expect(createCall.data.prescriptionDoctorName).toBeNull()
  })
})

describe('billingService.createInvoice — Phase 58 §2 credit-terms due date', () => {
  it('stores the provided dueDate on the Invoice', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({ ...basePayload, paymentMethod: 'CREDIT', customerId: 'cust-1', dueDate: '2026-12-01' })

    expect(res.success).toBe(true)
    const createCall = vi.mocked(db.invoice.create).mock.calls[0][0] as { data: { dueDate: Date | null } }
    expect(createCall.data.dueDate).toEqual(new Date('2026-12-01'))
  })

  it('leaves dueDate null when not provided', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice(basePayload)

    expect(res.success).toBe(true)
    const createCall = vi.mocked(db.invoice.create).mock.calls[0][0] as { data: { dueDate: Date | null } }
    expect(createCall.data.dueDate).toBeNull()
  })
})

describe('billingService.createInvoice — Phase 58 §2 restaurant table binding', () => {
  it('stores the first tableId as the invoice\'s primary table', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({ ...basePayload, tableIds: ['table-5', 'table-6'] })

    expect(res.success).toBe(true)
    const createCall = vi.mocked(db.invoice.create).mock.calls[0][0] as { data: { tableId: string | null } }
    expect(createCall.data.tableId).toBe('table-5')
  })

  it('claims every selected table (merge = selecting more than one)', async () => {
    const db = makeMockDb()
    db.restaurantTable.updateMany = vi.fn().mockResolvedValue({ count: 2 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({ ...basePayload, tableIds: ['table-5', 'table-6'] })

    expect(res.success).toBe(true)
    expect(db.restaurantTable.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['table-5', 'table-6'] }, currentInvoiceId: null },
      data: { currentInvoiceId: 'inv-1', status: 'OCCUPIED' }
    })
  })

  it('fails the whole invoice if any selected table is already part of another running order', async () => {
    const db = makeMockDb()
    // Only 1 of the 2 requested tables was actually free to claim.
    db.restaurantTable.updateMany = vi.fn().mockResolvedValue({ count: 1 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({ ...basePayload, tableIds: ['table-5', 'table-6'] })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INVOC-015')
  })

  it('leaves tableId null and never touches RestaurantTable for a non-restaurant/counter sale', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice(basePayload)

    expect(res.success).toBe(true)
    const createCall = vi.mocked(db.invoice.create).mock.calls[0][0] as { data: { tableId: string | null } }
    expect(createCall.data.tableId).toBeNull()
    expect(db.restaurantTable.updateMany).not.toHaveBeenCalled()
  })

  it('releases the table immediately for a CASH order — it was fully paid in this same call, no later recordPayment is coming', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({ ...basePayload, paymentMethod: 'CASH', tableIds: ['table-5'] })

    expect(res.success).toBe(true)
    // First call is the claim (sets OCCUPIED), second is the release
    // (releaseTablesForInvoiceTx — clears currentInvoiceId, back to
    // AVAILABLE) — both against the same invoice within the one transaction.
    expect(db.restaurantTable.updateMany).toHaveBeenCalledTimes(2)
    expect(db.restaurantTable.updateMany).toHaveBeenLastCalledWith({
      where: { currentInvoiceId: 'inv-1' },
      data: { currentInvoiceId: null, status: 'AVAILABLE' }
    })
  })

  it('leaves the table occupied for a CREDIT order — it\'s a real running tab until paid later', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({ ...basePayload, paymentMethod: 'CREDIT', customerId: 'cust-1', tableIds: ['table-5'] })

    expect(res.success).toBe(true)
    // Only the claim call — no release, since paymentStatus stays UNPAID.
    expect(db.restaurantTable.updateMany).toHaveBeenCalledTimes(1)
  })
})

describe('billingService.createInvoice — Jewellery hallmark snapshot + atomic old-metal exchange', () => {
  it('snapshots jewelleryHallmarkNumber onto the InvoiceItem when provided', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({
      ...basePayload,
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 0, jewelleryHallmarkNumber: ' HUID123456 ' }],
    })

    expect(res.success).toBe(true)
    const createCall = vi.mocked(db.invoiceItem.create).mock.calls[0][0] as { data: { jewelleryHallmarkNumber: string | null } }
    expect(createCall.data.jewelleryHallmarkNumber).toBe('HUID123456')
  })

  it('leaves jewelleryHallmarkNumber null when not provided', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice(basePayload)

    expect(res.success).toBe(true)
    const createCall = vi.mocked(db.invoiceItem.create).mock.calls[0][0] as { data: { jewelleryHallmarkNumber: string | null } }
    expect(createCall.data.jewelleryHallmarkNumber).toBeNull()
  })

  it('rejects a metalExchangeId that does not exist', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({ ...basePayload, metalExchangeId: 'mex-missing' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INVOC-012')
  })

  it('rejects a metalExchangeId that is already linked to another invoice', async () => {
    const db = makeMockDb()
    db.metalExchange.findUnique.mockResolvedValue({ id: 'mex-1', valueGiven: 5000, customerId: null, invoiceId: 'inv-other' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({ ...basePayload, metalExchangeId: 'mex-1' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INVOC-013')
  })

  it('rejects a metalExchange belonging to a different customer', async () => {
    const db = makeMockDb()
    db.metalExchange.findUnique.mockResolvedValue({ id: 'mex-1', valueGiven: 5000, customerId: 'cust-OTHER', invoiceId: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({ ...basePayload, customerId: 'cust-1', metalExchangeId: 'mex-1' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INVOC-014')
  })

  it('folds a valid unlinked exchange into the discount and atomically claims it', async () => {
    const db = makeMockDb()
    db.metalExchange.findUnique.mockResolvedValue({ id: 'mex-1', valueGiven: 50, customerId: null, invoiceId: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // subtotal 200 (2 x 100), exchange credit 50 -> discountAmount 50, total 150
    const res = await billingService.createInvoice({ ...basePayload, metalExchangeId: 'mex-1' })

    expect(res.success).toBe(true)
    const invoiceCreateCall = vi.mocked(db.invoice.create).mock.calls[0][0] as { data: { discountAmount: number; totalAmount: number } }
    expect(invoiceCreateCall.data.discountAmount).toBe(50)
    expect(invoiceCreateCall.data.totalAmount).toBe(150)
    expect(db.metalExchange.updateMany).toHaveBeenCalledWith({
      where: { id: 'mex-1', invoiceId: null },
      data: { invoiceId: 'inv-1' }
    })
  })

  it('rolls back the whole invoice if the exchange claim loses a concurrent race', async () => {
    const db = makeMockDb()
    db.metalExchange.findUnique.mockResolvedValue({ id: 'mex-1', valueGiven: 50, customerId: null, invoiceId: null })
    db.metalExchange.updateMany.mockResolvedValue({ count: 0 }) // another invoice claimed it first, inside the transaction
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billingService.createInvoice({ ...basePayload, metalExchangeId: 'mex-1' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INVOC-013')
  })
})

describe('billingService.listInvoices', () => {
  it('includes full millisecond precision on the dateTo boundary', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.listInvoices({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    const call = vi.mocked(db.invoice.findMany).mock.calls[0][0] as { where: { invoiceDate: { gte: Date; lte: Date } } }
    // Regression for a real bug found 2026-07-22: gte used to be
    // new Date('2026-01-01') (UTC midnight) — now local midnight
    // (parseLocalDateStart), matching the Y/M/D local constructor.
    expect(call.where.invoiceDate.gte).toEqual(new Date(2026, 0, 1))
    expect(call.where.invoiceDate.lte).toEqual(new Date('2026-01-31T23:59:59.999'))
  })

  // Regression: a search term used to only match invoiceNumber/customer.customerName —
  // a business owner searching "what did this phone number buy" had no way to
  // find bills by phone at all, even though the customer-picker at POS already
  // supports phone search (customer.service.ts's searchCustomers).
  it('searches customer.phone in addition to invoiceNumber and customer name', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.listInvoices({ search: '9876543210' })

    const call = vi.mocked(db.invoice.findMany).mock.calls[0][0] as { where: { OR: Record<string, unknown>[] } }
    expect(call.where.OR).toEqual(expect.arrayContaining([
      { customer: { phone: { contains: '9876543210' } } },
    ]))
  })
})

describe('billingService.getOrCreateTipProduct', () => {
  it('creates the Tip / Service Charge product on first call when none exists yet', async () => {
    const product = { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(makeProduct({ id: 'tip-1', productName: 'Tip / Service Charge', productType: 'SERVICE', sellingPrice: 0, taxRate: 0 })) }
    vi.mocked(getPrisma).mockReturnValue({ product } as never)

    const res = await billingService.getOrCreateTipProduct()

    expect(res.success).toBe(true)
    expect(product.findFirst).toHaveBeenCalledWith({ where: { productName: 'Tip / Service Charge', isActive: true } })
    expect(product.create).toHaveBeenCalledTimes(1)
    expect((res as { data: { productName: string } }).data.productName).toBe('Tip / Service Charge')
  })

  it('reuses the existing Tip / Service Charge product on subsequent calls instead of creating a duplicate', async () => {
    const existing = makeProduct({ id: 'tip-1', productName: 'Tip / Service Charge', productType: 'SERVICE', sellingPrice: 0, taxRate: 0 })
    const product = { findFirst: vi.fn().mockResolvedValue(existing), create: vi.fn() }
    vi.mocked(getPrisma).mockReturnValue({ product } as never)

    const res = await billingService.getOrCreateTipProduct()

    expect(res.success).toBe(true)
    expect(product.create).not.toHaveBeenCalled()
    expect((res as { data: { id: string } }).data.id).toBe('tip-1')
  })
})

describe('billingService.getFrequentlySoldProducts', () => {
  it('returns an empty list without querying products when nothing has ever been sold', async () => {
    const invoiceItem = { groupBy: vi.fn().mockResolvedValue([]) }
    const product = { findMany: vi.fn() }
    vi.mocked(getPrisma).mockReturnValue({ invoiceItem, product } as never)

    const res = await billingService.getFrequentlySoldProducts()
    expect(res.success).toBe(true)
    expect((res as { data: { products: unknown[] } }).data.products).toEqual([])
    expect(product.findMany).not.toHaveBeenCalled()
  })

  it('excludes RETURN invoices from the ranking', async () => {
    const invoiceItem = { groupBy: vi.fn().mockResolvedValue([{ productId: 'p1', _sum: { quantity: 5 } }]) }
    const product = { findMany: vi.fn().mockResolvedValue([{ id: 'p1', productName: 'Widget' }]) }
    vi.mocked(getPrisma).mockReturnValue({ invoiceItem, product } as never)

    await billingService.getFrequentlySoldProducts(10)

    expect(invoiceItem.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { invoice: { status: 'ACTIVE', invoiceType: { not: 'RETURN' } } },
    }))
  })

  it('preserves the quantity-sold order from groupBy, not findMany\'s arbitrary id-list order', async () => {
    const invoiceItem = { groupBy: vi.fn().mockResolvedValue([{ productId: 'p2', _sum: { quantity: 9 } }, { productId: 'p1', _sum: { quantity: 5 } }]) }
    // findMany returns them in a DIFFERENT order than requested — a real
    // risk with `id: { in: [...] }` queries, which don't guarantee order.
    const product = { findMany: vi.fn().mockResolvedValue([{ id: 'p1', productName: 'Widget' }, { id: 'p2', productName: 'Gadget' }]) }
    vi.mocked(getPrisma).mockReturnValue({ invoiceItem, product } as never)

    const res = await billingService.getFrequentlySoldProducts()
    const products = (res as { data: { products: Array<{ id: string }> } }).data.products
    expect(products.map((p) => p.id)).toEqual(['p2', 'p1'])
  })

  it('silently drops a ranked product that has since been deactivated or deleted', async () => {
    const invoiceItem = { groupBy: vi.fn().mockResolvedValue([{ productId: 'p1', _sum: { quantity: 5 } }, { productId: 'p-deleted', _sum: { quantity: 3 } }]) }
    const product = { findMany: vi.fn().mockResolvedValue([{ id: 'p1', productName: 'Widget' }]) } // p-deleted is now inactive, excluded by the isActive:true filter
    vi.mocked(getPrisma).mockReturnValue({ invoiceItem, product } as never)

    const res = await billingService.getFrequentlySoldProducts()
    const products = (res as { data: { products: Array<{ id: string }> } }).data.products
    expect(products).toHaveLength(1)
    expect(products[0].id).toBe('p1')
  })
})
