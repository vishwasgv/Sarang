import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../blood-bank.service', () => ({ getBloodStock: vi.fn() }))
vi.mock('../logistics-analytics.service', () => ({ getLogisticsAnalytics: vi.fn() }))

import { getPrisma } from '../../database/db'
import { reportService } from '../report.service'
import { getBloodStock } from '../blood-bank.service'
import { getLogisticsAnalytics } from '../logistics-analytics.service'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1', invoiceNumber: 'INV-2024-000001',
    invoiceDate: new Date('2024-01-15'),
    status: 'ACTIVE',
    subtotal: 1000, discountAmount: 0, taxAmount: 100, totalAmount: 1100,
    paymentStatus: 'PAID', gstType: 'CGST_SGST', buyerState: null,
    customer: null, items: [{ quantity: 2 }], payments: [],
    ...overrides
  }
}

function makeInvoiceItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1', invoiceId: 'inv-1', productId: 'prod-1',
    quantity: 2, unitPrice: 500, discountAmount: 0, taxRate: 18, taxAmount: 180,
    lineTotal: 1180,
    invoice: { invoiceDate: new Date('2024-01-15'), gstType: 'CGST_SGST' },
    ...overrides
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    invoice: {
      findMany: vi.fn().mockResolvedValue([makeInvoice()]),
      count: vi.fn().mockResolvedValue(1)
    },
    invoiceItem: {
      findMany: vi.fn().mockResolvedValue([makeInvoiceItem()]),
      count: vi.fn().mockResolvedValue(1)
    },
    taxConfiguration: { findMany: vi.fn().mockResolvedValue([]) },
    businessProfile: { findFirst: vi.fn().mockResolvedValue(null) },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    // generateCategorySellThroughReport() — empty default is safe for every
    // report test that doesn't itself deal in product categories.
    productCategory: { findMany: vi.fn().mockResolvedValue([]) },
    // Phase 64 — getProductCostsBatch() (valuation.service) reads this for
    // every report that resolves product cost; empty default is safe for
    // every report test that doesn't itself deal in product cost lines.
    inventory: { findMany: vi.fn().mockResolvedValue([]) },
    // getDishIngredientCostsBatch() (restaurant.service) — empty defaults
    // are safe for every report test that doesn't itself deal in dish
    // recipe costs.
    kitComponent: { findMany: vi.fn().mockResolvedValue([]) },
    recipe: { findMany: vi.fn().mockResolvedValue([]) },
    // generateTableTurnoverByHourReport() — empty default is safe for
    // every report test that doesn't itself deal in KOT/table data.
    kOT: { findMany: vi.fn().mockResolvedValue([]) },
    // generateFoodCostReport() / generateRecipeWasteVarianceReport() —
    // empty default is safe for every report test that doesn't itself deal
    // in ingredient-deduction movements.
    inventoryMovement: { findMany: vi.fn().mockResolvedValue([]) },
    customer: { findMany: vi.fn().mockResolvedValue([]) },
    customerLedger: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
    supplier: { findMany: vi.fn().mockResolvedValue([]) },
    supplierLedger: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
    bill: { findMany: vi.fn().mockResolvedValue([]) },
    billItem: { findMany: vi.fn().mockResolvedValue([]) },
    payment: { findMany: vi.fn().mockResolvedValue([]) },
    expense: { findMany: vi.fn().mockResolvedValue([]) },
    chartOfAccounts: { findMany: vi.fn().mockResolvedValue([]) },
    journalEntryLine: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0)
    },
    ...overrides
  }
}

beforeEach(() => vi.clearAllMocks())

// ─── Sales Report ─────────────────────────────────────────────────────────────

describe('reportService.generateSalesReport', () => {
  it('returns correct summary for a single active invoice', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await reportService.generateSalesReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalInvoices).toBe(1)
    expect(result.summary.totalRevenue).toBe(1100)
    expect(result.summary.totalTax).toBe(100)
    expect(result.summary.cancelledInvoices).toBe(0)
  })

  it('excludes cancelled invoices from revenue totals', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice(),
      makeInvoice({ id: 'inv-2', invoiceNumber: 'INV-2024-000002', status: 'CANCELLED', totalAmount: 500 })
    ])
    db.invoice.count = vi.fn().mockResolvedValue(2)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSalesReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalInvoices).toBe(1)
    expect(result.summary.cancelledInvoices).toBe(1)
    expect(result.summary.totalRevenue).toBe(1100)
  })

  it('groups by day correctly', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({ invoiceDate: new Date('2024-01-15'), totalAmount: 1000 }),
      makeInvoice({ id: 'inv-2', invoiceDate: new Date('2024-01-16'), totalAmount: 500 })
    ])
    db.invoice.count = vi.fn().mockResolvedValue(2)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSalesReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31', groupBy: 'day' })

    expect(result.groups).toHaveLength(2)
    expect(result.groups[0].label).toBe('2024-01-15')
    expect(result.groups[1].label).toBe('2024-01-16')
  })

  // "Sales by time" — a business owner should be able to see sales broken
  // down by hour of day across the whole selected range, not just "today".
  it('buckets revenue by hour of day across the whole date range, not just a single day', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({ invoiceDate: new Date('2024-01-15T09:30:00'), totalAmount: 1000 }),
      makeInvoice({ id: 'inv-2', invoiceDate: new Date('2024-01-16T09:45:00'), totalAmount: 500 }),
      makeInvoice({ id: 'inv-3', invoiceDate: new Date('2024-01-16T18:00:00'), totalAmount: 200 })
    ])
    db.invoice.count = vi.fn().mockResolvedValue(3)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSalesReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.byHour).toEqual(expect.arrayContaining([
      { hour: '09:00', revenue: 1500, invoiceCount: 2 },
      { hour: '18:00', revenue: 200, invoiceCount: 1 },
    ]))
  })

  it('excludes cancelled invoices from the by-hour breakdown', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({ invoiceDate: new Date('2024-01-15T09:30:00'), totalAmount: 1000, status: 'CANCELLED' }),
    ])
    db.invoice.count = vi.fn().mockResolvedValue(1)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSalesReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.byHour).toEqual([])
  })

  it('groups by month correctly', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({ invoiceDate: new Date('2024-01-10') }),
      makeInvoice({ id: 'inv-2', invoiceDate: new Date('2024-02-15') })
    ])
    db.invoice.count = vi.fn().mockResolvedValue(2)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSalesReport({ dateFrom: '2024-01-01', dateTo: '2024-02-28', groupBy: 'month' })

    expect(result.groups).toHaveLength(2)
    expect(result.groups.map(g => g.label)).toContain('2024-01')
    expect(result.groups.map(g => g.label)).toContain('2024-02')
  })

  it('supports paymentDate grouping', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({ payments: [{ paymentMethod: 'CASH', paymentDate: new Date('2024-01-20') }] })
    ])
    db.invoice.count = vi.fn().mockResolvedValue(1)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSalesReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31', dateGroupBy: 'paymentDate' })

    expect(result.groups[0].label).toBe('2024-01-20')
  })

  it('never truncates summary totals to a page size — aggregates over every matching invoice', async () => {
    const db = makeDb()
    const many = Array.from({ length: 150 }, (_, i) =>
      makeInvoice({ id: `inv-${i}`, invoiceNumber: `INV-2024-${i}`, totalAmount: 100, taxAmount: 10 })
    )
    db.invoice.findMany = vi.fn().mockResolvedValue(many)
    db.invoice.count = vi.fn().mockResolvedValue(150)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSalesReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalInvoices).toBe(150)
    expect(result.summary.totalRevenue).toBe(15000)
    expect(result.total).toBe(150)
  })

  it('does not paginate the underlying query — the full date range must be aggregated', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateSalesReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const call = vi.mocked(db.invoice.findMany).mock.calls[0][0] as { skip?: number; take?: number }
    expect(call.skip).toBeUndefined()
    expect(call.take).toBeUndefined()
  })

  it('calculates average order value correctly', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({ totalAmount: 200 }),
      makeInvoice({ id: 'inv-2', totalAmount: 400 })
    ])
    db.invoice.count = vi.fn().mockResolvedValue(2)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSalesReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.averageOrderValue).toBe(300)
  })

  // A RETURN invoice stores discountAmount/taxAmount as a positive
  // magnitude (only subtotal/totalAmount are pre-signed negative) — summing
  // raw values without a sign correction double-counted a return's tax as
  // an ADDITIONAL sale's tax instead of netting it out.
  it('nets a RETURN invoice out of totalDiscount/totalTax instead of adding to them', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({ subtotal: 1000, discountAmount: 100, taxAmount: 162, totalAmount: 1062 }),
      makeInvoice({
        id: 'inv-return', invoiceNumber: 'RET-000001', invoiceType: 'RETURN',
        subtotal: -1000, discountAmount: 100, taxAmount: 162, totalAmount: -1062
      })
    ])
    db.invoice.count = vi.fn().mockResolvedValue(2)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSalesReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalRevenue).toBe(0) // 1062 + (-1062)
    expect(result.summary.totalDiscount).toBe(0) // 100 - 100
    expect(result.summary.totalTax).toBe(0) // 162 - 162
  })
})

// ─── Tax Report ───────────────────────────────────────────────────────────────

describe('reportService.generateTaxReport', () => {
  it('splits GST into CGST and SGST for CGST_SGST invoices', async () => {
    const db = makeDb()
    db.businessProfile.findFirst = vi.fn().mockResolvedValue({ taxModel: 'GST' })
    db.invoiceItem.findMany = vi.fn().mockResolvedValue([
      makeInvoiceItem({ taxRate: 18, taxAmount: 180, invoice: { invoiceDate: new Date(), gstType: 'CGST_SGST' } })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTaxReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const cgstRow = result.rows.find(r => r.taxType === 'CGST')
    const sgstRow = result.rows.find(r => r.taxType === 'SGST')
    expect(cgstRow).toBeDefined()
    expect(sgstRow).toBeDefined()
    expect(cgstRow!.rate).toBe(9)
    expect(cgstRow!.taxCollected).toBe(90)
    expect(sgstRow!.taxCollected).toBe(90)
  })

  it('shows IGST row for inter-state IGST invoices', async () => {
    const db = makeDb()
    db.businessProfile.findFirst = vi.fn().mockResolvedValue({ taxModel: 'GST' })
    db.invoiceItem.findMany = vi.fn().mockResolvedValue([
      makeInvoiceItem({ taxRate: 18, taxAmount: 360, invoice: { invoiceDate: new Date(), gstType: 'IGST' } })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTaxReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const igstRow = result.rows.find(r => r.taxType === 'IGST')
    expect(igstRow).toBeDefined()
    expect(igstRow!.rate).toBe(18)
    expect(igstRow!.taxCollected).toBe(360)
  })

  it('does not split when taxModel is not GST', async () => {
    const db = makeDb()
    db.businessProfile.findFirst = vi.fn().mockResolvedValue({ taxModel: 'VAT' })
    db.invoiceItem.findMany = vi.fn().mockResolvedValue([
      makeInvoiceItem({ taxRate: 12, taxAmount: 120 })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTaxReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].taxType).toBe('SALES_TAX')
    expect(result.rows[0].rate).toBe(12)
  })

  it('totals are correct across multiple rates', async () => {
    const db = makeDb()
    db.businessProfile.findFirst = vi.fn().mockResolvedValue(null)
    db.invoiceItem.findMany = vi.fn().mockResolvedValue([
      makeInvoiceItem({ taxRate: 5, taxAmount: 50, invoice: { invoiceDate: new Date(), gstType: 'CGST_SGST' } }),
      makeInvoiceItem({ id: 'item-2', taxRate: 12, taxAmount: 120, invoice: { invoiceDate: new Date(), gstType: 'CGST_SGST' } })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTaxReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalTaxCollected).toBe(170)
  })

  it('never truncates tax totals to a page size — aggregates over every matching item', async () => {
    const db = makeDb()
    db.businessProfile.findFirst = vi.fn().mockResolvedValue(null)
    const many = Array.from({ length: 250 }, (_, i) =>
      makeInvoiceItem({ id: `item-${i}`, invoiceId: `inv-${i}`, taxRate: 10, taxAmount: 10 })
    )
    db.invoiceItem.findMany = vi.fn().mockResolvedValue(many)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTaxReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalTaxCollected).toBe(2500)
    expect(result.total).toBe(250)
  })

  it('does not paginate the underlying query — every matching item must be aggregated', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateTaxReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const call = vi.mocked(db.invoiceItem.findMany).mock.calls[0][0] as { skip?: number; take?: number }
    expect(call.skip).toBeUndefined()
    expect(call.take).toBeUndefined()
  })

  it('nets a RETURN invoice item out of taxableAmount/taxCollected instead of adding to them', async () => {
    const db = makeDb()
    db.businessProfile.findFirst = vi.fn().mockResolvedValue(null)
    db.invoiceItem.findMany = vi.fn().mockResolvedValue([
      makeInvoiceItem({ taxRate: 18, unitPrice: 500, quantity: 2, discountAmount: 0, taxAmount: 180, invoice: { invoiceDate: new Date(), gstType: 'CGST_SGST', invoiceType: 'RETAIL' } }),
      makeInvoiceItem({ id: 'item-return', taxRate: 18, unitPrice: 500, quantity: 2, discountAmount: 0, taxAmount: 180, invoice: { invoiceDate: new Date(), gstType: 'CGST_SGST', invoiceType: 'RETURN' } })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTaxReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalTaxableAmount).toBe(0) // 1000 + (-1000)
    expect(result.summary.totalTaxCollected).toBe(0) // 180 + (-180)
  })
})

// ─── GSTR-1 ───────────────────────────────────────────────────────────────────

describe('reportService.generateGSTR1', () => {
  it('classifies B2B invoice by customer taxNumber (GSTIN)', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({
        customer: { customerName: 'ABC Corp', taxNumber: '22AAAAA0000A1Z5', state: 'Maharashtra' },
        items: [{ taxRate: 18, taxAmount: 180, quantity: 2, unitPrice: 500, discountAmount: 0, invoiceId: 'inv-1' }]
      })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateGSTR1({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.b2b).toHaveLength(1)
    expect(result.b2b[0].gstin).toBe('22AAAAA0000A1Z5')
    expect(result.b2b[0].reverseCharge).toBe('N')
    expect(result.b2cs).toHaveLength(0)
  })

  it('classifies B2C invoice by place of supply when no GSTIN', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({
        customer: { customerName: 'Retail', taxNumber: null, state: 'Gujarat' },
        gstType: 'CGST_SGST',
        items: [{ taxRate: 5, taxAmount: 50, quantity: 1, unitPrice: 1000, discountAmount: 0, invoiceId: 'inv-1' }]
      })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateGSTR1({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.b2b).toHaveLength(0)
    expect(result.b2cs).toHaveLength(1)
    expect(result.b2cs[0].cgstAmount).toBe(25)
    expect(result.b2cs[0].sgstAmount).toBe(25)
    expect(result.b2cs[0].igstAmount).toBe(0)
  })

  it('shows full IGST for inter-state B2C invoice', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({
        customer: { customerName: 'Retail', taxNumber: null, state: 'Delhi' },
        gstType: 'IGST', buyerState: 'Delhi',
        items: [{ taxRate: 18, taxAmount: 360, quantity: 1, unitPrice: 2000, discountAmount: 0, invoiceId: 'inv-1' }]
      })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateGSTR1({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.b2cs[0].igstAmount).toBe(360)
    expect(result.b2cs[0].cgstAmount).toBe(0)
    expect(result.b2cs[0].sgstAmount).toBe(0)
  })

  it('returns correct summary totals', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateGSTR1({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalB2BValue).toBe(0)
    expect(result.summary.totalIgst).toBe(0)
    expect(result.period).toContain('2024-01-01')
  })

  it('nets a RETURN invoice out of B2CS taxableValue/tax instead of adding to them', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({
        customer: { customerName: 'Retail', taxNumber: null, state: 'Gujarat' },
        gstType: 'CGST_SGST',
        items: [{ taxRate: 5, taxAmount: 50, quantity: 1, unitPrice: 1000, discountAmount: 0, invoiceId: 'inv-1' }]
      }),
      makeInvoice({
        id: 'inv-return', invoiceNumber: 'RET-000001', invoiceType: 'RETURN',
        customer: { customerName: 'Retail', taxNumber: null, state: 'Gujarat' },
        gstType: 'CGST_SGST',
        items: [{ taxRate: 5, taxAmount: 50, quantity: 1, unitPrice: 1000, discountAmount: 0, invoiceId: 'inv-return' }]
      })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateGSTR1({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.b2cs[0].taxableValue).toBe(0)
    expect(result.b2cs[0].cgstAmount).toBe(0)
    expect(result.b2cs[0].sgstAmount).toBe(0)
  })
})

// ─── HSN Summary Report ─────────────────────────────────────────────────────

describe('reportService.generateHSNSummaryReport', () => {
  it('groups invoice items by HSN code and tax rate, splitting B2B/B2C by customer taxNumber', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({
        customer: { taxNumber: '22AAAAA0000A1Z5' },
        items: [
          { hsnCode: '1006', taxRate: 5, taxAmount: 50, quantity: 2, unitPrice: 500, discountAmount: 0, lineTotal: 1050, productName: 'Rice', weightUnit: null, product: { unit: 'KG' }, invoiceId: 'inv-1' }
        ]
      }),
      makeInvoice({
        id: 'inv-2', customer: { taxNumber: null },
        items: [
          { hsnCode: '1006', taxRate: 5, taxAmount: 25, quantity: 1, unitPrice: 500, discountAmount: 0, lineTotal: 525, productName: 'Rice', weightUnit: null, product: { unit: 'KG' }, invoiceId: 'inv-2' }
        ]
      })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateHSNSummaryReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.b2b).toHaveLength(1)
    expect(result.b2b[0].hsnCode).toBe('1006')
    expect(result.b2b[0].totalQuantity).toBe(2)
    expect(result.b2c).toHaveLength(1)
    expect(result.b2c[0].totalQuantity).toBe(1)
  })

  it('buckets items with a missing HSN code under "No HSN Code" instead of dropping them', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({
        customer: null,
        items: [{ hsnCode: null, taxRate: 18, taxAmount: 90, quantity: 1, unitPrice: 500, discountAmount: 0, lineTotal: 590, productName: 'Misc Item', weightUnit: null, product: { unit: 'PCS' }, invoiceId: 'inv-1' }]
      })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateHSNSummaryReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.b2c[0].hsnCode).toBe('No HSN Code')
  })

  it('excludes cancelled invoices', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateHSNSummaryReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.rowCount).toBe(0)
    expect(result.summary.totalTaxableValue).toBe(0)
  })

  it('nets a RETURN invoice out of totalQuantity/taxableValue instead of adding to them', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({
        customer: null,
        items: [{ hsnCode: '1006', taxRate: 5, taxAmount: 50, quantity: 2, unitPrice: 500, discountAmount: 0, lineTotal: 1050, productName: 'Rice', weightUnit: null, product: { unit: 'KG' }, invoiceId: 'inv-1' }]
      }),
      makeInvoice({
        id: 'inv-return', invoiceNumber: 'RET-000001', invoiceType: 'RETURN', customer: null,
        items: [{ hsnCode: '1006', taxRate: 5, taxAmount: 50, quantity: 2, unitPrice: 500, discountAmount: 0, lineTotal: -1050, productName: 'Rice', weightUnit: null, product: { unit: 'KG' }, invoiceId: 'inv-return' }]
      })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateHSNSummaryReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.b2c[0].totalQuantity).toBe(0) // 2 + (-2)
    expect(result.b2c[0].taxableValue).toBe(0) // 1000 + (-1000)
    expect(result.summary.totalTax).toBe(0)
  })
})

// ─── Document Summary Report ────────────────────────────────────────────────

describe('reportService.generateDocumentSummaryReport', () => {
  it('reports from/to number range and cancelled count per document series', async () => {
    const db = makeDb({
      creditNote: { findMany: vi.fn().mockResolvedValue([{ creditNoteNumber: 'CN-2024-000001' }]) },
      debitNote: { findMany: vi.fn().mockResolvedValue([]) },
    })
    db.invoice.findMany = vi.fn().mockResolvedValue([
      { invoiceNumber: 'INV-2024-000001', status: 'ACTIVE' },
      { invoiceNumber: 'INV-2024-000002', status: 'CANCELLED' },
      { invoiceNumber: 'INV-2024-000003', status: 'ACTIVE' },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDocumentSummaryReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const invoiceRow = result.rows.find(r => r.documentType === 'Invoice')
    expect(invoiceRow?.fromNumber).toBe('INV-2024-000001')
    expect(invoiceRow?.toNumber).toBe('INV-2024-000003')
    expect(invoiceRow?.totalCount).toBe(3)
    expect(invoiceRow?.cancelledCount).toBe(1)

    const cnRow = result.rows.find(r => r.documentType === 'Credit Note')
    expect(cnRow?.totalCount).toBe(1)
    expect(cnRow?.cancelledCount).toBe(0) // CreditNote has no cancellation concept — reported as 0, not fabricated

    expect(result.rows.find(r => r.documentType === 'Debit Note')).toBeUndefined() // zero rows -> omitted, not a fake zero row
  })
})

// ─── GSTR-3B Reconciliation Preview ─────────────────────────────────────────

describe('reportService.generateGSTR3BPreview', () => {
  it('splits taxable vs exempt (0% rate) outward supplies', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({
        customer: { taxNumber: null, state: 'Maharashtra' },
        items: [
          { taxRate: 18, taxAmount: 90, quantity: 1, unitPrice: 500, discountAmount: 0, invoiceId: 'inv-1' },
          { taxRate: 0, taxAmount: 0, quantity: 1, unitPrice: 200, discountAmount: 0, invoiceId: 'inv-1' }
        ]
      })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateGSTR3BPreview({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.table31.taxableOutwardSupplies).toBe(500)
    expect(result.table31.exemptNilNonGstSupplies).toBe(200)
    expect(result.table31.taxAmount.cgst).toBe(45)
    expect(result.table31.taxAmount.sgst).toBe(45)
  })

  it('groups Table 3.2 inter-state B2C supplies by destination state', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({
        customer: { taxNumber: null, state: 'Delhi' }, gstType: 'IGST', buyerState: 'Delhi',
        items: [{ taxRate: 18, taxAmount: 90, quantity: 1, unitPrice: 500, discountAmount: 0, invoiceId: 'inv-1' }]
      })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateGSTR3BPreview({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.table32).toHaveLength(1)
    expect(result.table32[0].state).toBe('Delhi')
    expect(result.table32[0].igstAmount).toBe(90)
  })

  it('always discloses Input Tax Credit as not tracked rather than a fabricated zero', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateGSTR3BPreview({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.notes.some(n => /Input Tax Credit/.test(n))).toBe(true)
  })

  // Phase 62 — Table 3.1(d) (reverse-charge inward supplies) is now real,
  // computed from Bill/Expense isReverseCharge data, not a "not tracked"
  // disclaimer. Bill carries a proper tax split; Expense doesn't (a single
  // flat `amount`, no rate field), so an RCM Expense contributes to taxable
  // value but not to the computed tax total, and triggers its own note.
  it('computes Table 3.1(d) from real RCM Bill + Expense data, with Bill contributing both value and tax, Expense only value', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([])
    db.bill.findMany = vi.fn().mockResolvedValue([{ totalAmount: 1000, taxAmount: 180 }])
    db.expense.findMany = vi.fn().mockResolvedValue([{ amount: 500 }])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateGSTR3BPreview({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.table31d.taxableValue).toBe(1500) // 1000 (Bill) + 500 (Expense)
    expect(result.table31d.taxAmount).toBe(180) // only the Bill's real computed tax
    expect(result.table31d.expenseTaxNotComputable).toBe(true)
    expect(result.notes.some(n => /reverse-charge Expenses/.test(n))).toBe(true)
  })

  it('omits the RCM-expense caveat note when no reverse-charge Expense exists in the period', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([])
    db.bill.findMany = vi.fn().mockResolvedValue([{ totalAmount: 1000, taxAmount: 180 }])
    db.expense.findMany = vi.fn().mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateGSTR3BPreview({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.table31d.taxableValue).toBe(1000)
    expect(result.table31d.expenseTaxNotComputable).toBe(false)
    expect(result.notes.some(n => /reverse-charge Expenses/.test(n))).toBe(false)
  })

  it('nets a RETURN invoice out of taxableOutwardSupplies/tax instead of adding to them', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      makeInvoice({
        customer: { taxNumber: null, state: 'Maharashtra' },
        items: [{ taxRate: 18, taxAmount: 90, quantity: 1, unitPrice: 500, discountAmount: 0, invoiceId: 'inv-1' }]
      }),
      makeInvoice({
        id: 'inv-return', invoiceNumber: 'RET-000001', invoiceType: 'RETURN',
        customer: { taxNumber: null, state: 'Maharashtra' },
        items: [{ taxRate: 18, taxAmount: 90, quantity: 1, unitPrice: 500, discountAmount: 0, invoiceId: 'inv-return' }]
      })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateGSTR3BPreview({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.table31.taxableOutwardSupplies).toBe(0) // 500 + (-500)
    expect(result.table31.taxAmount.cgst).toBe(0)
    expect(result.table31.taxAmount.sgst).toBe(0)
  })
})

// ─── Outstanding Report ─────────────────────────────────────────────────────

describe('reportService.generateOutstandingReport', () => {
  // REAL BUG found+fixed 2026-07-30: this report's customer branch used to
  // sum unpaid Invoice.balanceAmount directly instead of the CustomerLedger
  // (RULE AN001 — the same rule the Dashboard's outstanding tile and
  // getTopOutstanding()/getOutstandingAmount() already follow; the sibling
  // supplier branch just below was already ledger-based, so only customers
  // diverged). Rewritten to be ledger-based, mirroring the supplier branch
  // exactly — these tests now exercise that real behavior instead of the
  // old invoice-balance shortcut.
  it('sums customer ledger debit minus credit, skipping customers with a zero/settled balance', async () => {
    const db = makeDb()
    db.customer.findMany = vi.fn().mockResolvedValue([{ id: 'cust-1', customerName: 'ABC Corp', phone: '111' }])
    db.customerLedger.findMany = vi.fn().mockResolvedValue([
      { customerId: 'cust-1', debitAmount: 300, creditAmount: 0, createdAt: new Date() },
      { customerId: 'cust-1', debitAmount: 200, creditAmount: 0, createdAt: new Date() }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateOutstandingReport()

    expect(result.customers.rows).toHaveLength(1)
    expect(result.customers.rows[0].outstanding).toBe(500)
    expect(result.customers.totalOutstanding).toBe(500)
  })

  // Directly proves the fix: a standalone OPENING_BALANCE or CREDIT_NOTE
  // ledger entry (debt with no Invoice row at all) must appear here exactly
  // like it already does in the Dashboard's outstanding tile — this is the
  // exact scenario the old invoice-only version silently omitted.
  it('includes a customer whose outstanding balance comes entirely from a non-invoice ledger entry (e.g. an imported opening balance)', async () => {
    const db = makeDb()
    db.customer.findMany = vi.fn().mockResolvedValue([{ id: 'cust-1', customerName: 'Legacy Customer', phone: null }])
    db.customerLedger.findMany = vi.fn().mockResolvedValue([
      { customerId: 'cust-1', debitAmount: 8000, creditAmount: 0, createdAt: new Date() }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateOutstandingReport()

    expect(result.customers.rows).toHaveLength(1)
    expect(result.customers.rows[0].outstanding).toBe(8000)
  })

  it('ages customer balance from when the ledger debit was recorded', async () => {
    const db = makeDb()
    const now = new Date()
    const fortyDaysAgo = new Date(now.getTime() - 40 * 86400000)
    db.customer.findMany = vi.fn().mockResolvedValue([{ id: 'cust-1', customerName: 'ABC Corp', phone: null }])
    db.customerLedger.findMany = vi.fn().mockResolvedValue([
      { customerId: 'cust-1', debitAmount: 100, creditAmount: 0, createdAt: fortyDaysAgo }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateOutstandingReport()

    expect(result.customers.rows[0].aging.days31to60).toBe(100)
  })

  it('computes supplier payable from ledger debit minus credit', async () => {
    const db = makeDb()
    db.supplier.findMany = vi.fn().mockResolvedValue([{ id: 'sup-1', supplierName: 'Acme Supplies', phone: null }])
    db.supplierLedger.findMany = vi.fn().mockResolvedValue([
      { supplierId: 'sup-1', debitAmount: 500, creditAmount: 0, createdAt: new Date() },
      { supplierId: 'sup-1', debitAmount: 0, creditAmount: 100, createdAt: new Date() }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateOutstandingReport()

    expect(result.suppliers.rows).toHaveLength(1)
    expect(result.suppliers.rows[0].outstanding).toBe(400)
  })
})

// ─── Phase 61: AP Aging ──────────────────────────────────────────────────────

describe('reportService.generateApAgingReport', () => {
  // Genuinely reuses generateOutstandingReport's supplier-aging computation
  // (computeAgingRows) rather than a re-typed copy — this test proves both
  // report entry points agree on the same figure for the same ledger data.
  it('matches generateOutstandingReport\'s supplier-side figures for the same data', async () => {
    const db = makeDb()
    db.supplier.findMany = vi.fn().mockResolvedValue([{ id: 'sup-1', supplierName: 'Acme Supplies', phone: null }])
    db.supplierLedger.findMany = vi.fn().mockResolvedValue([
      { supplierId: 'sup-1', debitAmount: 500, creditAmount: 0, createdAt: new Date() },
      { supplierId: 'sup-1', debitAmount: 0, creditAmount: 100, createdAt: new Date() }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateApAgingReport()

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].outstanding).toBe(400)
    expect(result.summary.totalOutstanding).toBe(400)
  })

  it('excludes a supplier with a zero/settled balance', async () => {
    const db = makeDb()
    db.supplier.findMany = vi.fn().mockResolvedValue([{ id: 'sup-1', supplierName: 'Settled Co', phone: null }])
    db.supplierLedger.findMany = vi.fn().mockResolvedValue([
      { supplierId: 'sup-1', debitAmount: 500, creditAmount: 500, createdAt: new Date() }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateApAgingReport()

    expect(result.rows).toHaveLength(0)
  })

  it('sorts rows by outstanding balance, highest first', async () => {
    const db = makeDb()
    db.supplier.findMany = vi.fn().mockResolvedValue([
      { id: 'sup-1', supplierName: 'Small Balance', phone: null },
      { id: 'sup-2', supplierName: 'Large Balance', phone: null }
    ])
    db.supplierLedger.findMany = vi.fn().mockResolvedValue([
      { supplierId: 'sup-1', debitAmount: 100, creditAmount: 0, createdAt: new Date() },
      { supplierId: 'sup-2', debitAmount: 900, creditAmount: 0, createdAt: new Date() }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateApAgingReport()

    expect(result.rows[0].supplierName).toBe('Large Balance')
    expect(result.rows[1].supplierName).toBe('Small Balance')
  })
})

// ─── Phase 61: Purchase Register / by Vendor / by Item ──────────────────────

function makeBill(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bill-1', billNumber: 'BILL-00001', supplierId: 'sup-1',
    billDate: new Date('2024-01-15'), status: 'OPEN',
    subtotal: 1000, discountAmount: 0, taxAmount: 180, totalAmount: 1180,
    supplier: { supplierName: 'Acme Supplies' },
    items: [{ id: 'bi-1' }],
    ...overrides
  }
}

describe('reportService.generatePurchaseRegisterReport', () => {
  it('excludes VOID bills and totals the rest', async () => {
    const db = makeDb()
    db.bill.findMany = vi.fn().mockResolvedValue([makeBill()])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePurchaseRegisterReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toHaveLength(1)
    expect(result.summary.totalPurchases).toBe(1180)
    expect(result.summary.billCount).toBe(1)
    // The where clause itself must filter VOID out at the DB level, not rely
    // on post-filtering — assert the query was actually built that way.
    const call = vi.mocked(db.bill.findMany).mock.calls[0][0] as { where: { status: { not: string } } }
    expect(call.where.status).toEqual({ not: 'VOID' })
  })

  it('groups spend by vendor, ranked highest first', async () => {
    const db = makeDb()
    db.bill.findMany = vi.fn().mockResolvedValue([
      makeBill({ id: 'b1', supplierId: 'sup-1', totalAmount: 300, supplier: { supplierName: 'Small Vendor' } }),
      makeBill({ id: 'b2', supplierId: 'sup-2', totalAmount: 900, supplier: { supplierName: 'Big Vendor' } })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePurchaseRegisterReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.byVendor[0].supplierName).toBe('Big Vendor')
    expect(result.byVendor[0].totalAmount).toBe(900)
  })
})

describe('reportService.generatePurchasesByVendorReport', () => {
  it('aggregates total spend and bill count per vendor', async () => {
    const db = makeDb()
    db.bill.findMany = vi.fn().mockResolvedValue([
      { totalAmount: 500, supplierId: 'sup-1', supplier: { supplierName: 'Acme' } },
      { totalAmount: 300, supplierId: 'sup-1', supplier: { supplierName: 'Acme' } }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePurchasesByVendorReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual(expect.objectContaining({ supplierName: 'Acme', totalAmount: 800, billCount: 2 }))
  })
})

describe('reportService.generatePurchasesByItemReport', () => {
  it('aggregates product lines by productId and service lines by description separately', async () => {
    const db = makeDb()
    db.billItem.findMany = vi.fn().mockResolvedValue([
      { quantity: 5, total: 500, productId: 'prod-1', serviceDescription: null, product: { productName: 'Widget' } },
      { quantity: 3, total: 300, productId: 'prod-1', serviceDescription: null, product: { productName: 'Widget' } },
      { quantity: 1, total: 5000, productId: null, serviceDescription: 'AMC — quarterly', product: null }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePurchasesByItemReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toHaveLength(2)
    const widgetRow = result.rows.find(r => r.itemName === 'Widget')
    expect(widgetRow).toEqual(expect.objectContaining({ isService: false, quantity: 8, totalAmount: 800, billCount: 2 }))
    const serviceRow = result.rows.find(r => r.itemName === 'AMC — quarterly')
    expect(serviceRow).toEqual(expect.objectContaining({ isService: true, quantity: 1, totalAmount: 5000 }))
  })
})

// ─── Audit Report ────────────────────────────────────────────────────────────

describe('reportService.generateAuditReport', () => {
  function makeAuditLog(overrides: Record<string, unknown> = {}) {
    return {
      id: 'log-1', createdAt: new Date('2024-01-15'), userId: 'user-1',
      user: { fullName: 'Jane Doe', username: 'jane' },
      action: 'CREATE_INVOICE', entityType: 'Invoice', entityId: 'inv-1',
      newValue: null, oldValue: null,
      ...overrides
    }
  }

  it('reports the true count via a separate count() query, not rows.length', async () => {
    const db = makeDb()
    // Simulate 5000 matching logs, but the page only returns 200 rows.
    db.auditLog.findMany = vi.fn().mockResolvedValue(Array.from({ length: 200 }, (_, i) => makeAuditLog({ id: `log-${i}` })))
    db.auditLog.count = vi.fn().mockResolvedValue(5000)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateAuditReport({})

    expect(result.rows).toHaveLength(200)
    expect(result.totalRecords).toBe(5000)
  })

  it('paginates via skip/take derived from page/limit', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateAuditReport({ page: 3, limit: 50 })

    const call = vi.mocked(db.auditLog.findMany).mock.calls[0][0] as { skip: number; take: number }
    expect(call.skip).toBe(100)
    expect(call.take).toBe(50)
  })

  it('caps limit at 1000 even if a larger value is requested', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateAuditReport({ limit: 5000 })

    const call = vi.mocked(db.auditLog.findMany).mock.calls[0][0] as { take: number }
    expect(call.take).toBe(1000)
  })
})

// ─── Supplier Ledger Statement ──────────────────────────────────────────────

describe('reportService.generateSupplierLedgerReport', () => {
  it('computes closing balance as debit minus credit — matching supplier-ledger.service.ts and the stored balance column', async () => {
    // A purchase (debit 10000, "we owe more") followed by a partial payment
    // (credit 3000, "we owe less") must leave a closing balance of +7000 —
    // the same sign supplierLedgerService.calculateBalance and the per-row
    // `balance` column already use. A negative result here is the inverted-sign bug.
    const db = makeDb({
      supplier: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'sup-1', supplierName: 'Acme Supplies', phone: null, email: null }) },
      supplierLedger: {
        findMany: vi.fn().mockResolvedValue([
          { createdAt: new Date('2024-01-05'), referenceType: 'PURCHASE_ORDER', referenceId: 'po-1', debitAmount: 10000, creditAmount: 0, balance: 10000, remarks: null },
          { createdAt: new Date('2024-01-10'), referenceType: 'PAYMENT', referenceId: 'pmt-1', debitAmount: 0, creditAmount: 3000, balance: 7000, remarks: null }
        ]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } })
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSupplierLedgerReport({ supplierId: 'sup-1' })

    expect(result.closingBalance).toBe(7000)
    // The last row's own stored balance must agree in sign with the summary.
    expect(result.rows[result.rows.length - 1].balance).toBe(7000)
  })

  it('carries opening balance forward using the same debit-minus-credit sign', async () => {
    const db = makeDb({
      supplier: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'sup-1', supplierName: 'Acme Supplies', phone: null, email: null }) },
      supplierLedger: {
        findMany: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 5000, creditAmount: 1000 } })
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSupplierLedgerReport({ supplierId: 'sup-1', dateFrom: '2024-02-01' })

    expect(result.openingBalance).toBe(4000)
    expect(result.closingBalance).toBe(4000)
  })
})

// ─── Appointment Utilisation Report (Phase 35) ─────────────────────────────────

function makeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appt-1', appointmentNumber: 'APT-00001', customerId: 'cust-1', customerName: null,
    providerId: 'emp-1', serviceTitle: 'Haircut', scheduledDate: new Date('2026-07-02'),
    scheduledTime: '09:05', durationMinutes: 30, status: 'COMPLETED',
    provider: { fullName: 'Stylist One' }, customer: { customerName: 'Client A' },
    ...overrides,
  }
}

describe('reportService.generateAppointmentUtilisationReport', () => {
  it('computes summary counts, completionRate, and the active (non-terminal) residual', async () => {
    const db = {
      appointment: {
        findMany: vi.fn().mockResolvedValue([
          makeAppointment({ id: 'a1', status: 'COMPLETED' }),
          makeAppointment({ id: 'a2', status: 'CANCELLED' }),
          makeAppointment({ id: 'a3', status: 'NO_SHOW' }),
          makeAppointment({ id: 'a4', status: 'SCHEDULED' }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateAppointmentUtilisationReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.summary).toEqual({ total: 4, completed: 1, cancelled: 1, noShow: 1, active: 1, completionRate: 25 })
  })

  it('pads single-digit hours correctly in the byHour bucket (regression: "9:30" must become "09:00", not "9::00")', async () => {
    const db = {
      appointment: {
        findMany: vi.fn().mockResolvedValue([
          makeAppointment({ id: 'a1', scheduledTime: '9:30' }),
          makeAppointment({ id: 'a2', scheduledTime: '14:00' }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateAppointmentUtilisationReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.byHour).toEqual([{ hour: '09:00', count: 1 }, { hour: '14:00', count: 1 }])
  })

  it('groups appointments with no assigned provider under "Unassigned"', async () => {
    const db = {
      appointment: {
        findMany: vi.fn().mockResolvedValue([
          makeAppointment({ id: 'a1', providerId: null, provider: null }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateAppointmentUtilisationReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.byProvider).toEqual([{ providerName: 'Unassigned', total: 1, completed: 1, cancelled: 0, noShow: 0, completionRate: 100 }])
  })
})

// ─── Client Retention Report (Phase 35) ────────────────────────────────────────

describe('reportService.generateClientRetentionReport', () => {
  it('excludes CANCELLED and NO_SHOW appointments from visit counts', async () => {
    const inPeriod = [{ customerId: 'cust-1', scheduledDate: new Date('2026-07-05') }]
    const allVisits = [{ customerId: 'cust-1', scheduledDate: new Date('2026-07-05') }]
    const db = {
      appointment: {
        findMany: vi.fn()
          .mockResolvedValueOnce(inPeriod)
          .mockResolvedValueOnce(allVisits),
      },
      customer: { findMany: vi.fn().mockResolvedValue([{ id: 'cust-1', customerName: 'Client A', phone: '9000000000' }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateClientRetentionReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    // The status filter itself is asserted via the where clause the mock received —
    // both appointment.findMany calls must have excluded CANCELLED/NO_SHOW.
    const calls = db.appointment.findMany.mock.calls
    expect(calls[0][0].where.status).toEqual({ notIn: ['CANCELLED', 'NO_SHOW'] })
    expect(calls[1][0].where.status).toEqual({ notIn: ['CANCELLED', 'NO_SHOW'] })
    expect(result.rows[0].visitsInPeriod).toBe(1)
  })

  it('computes atRisk relative to the report\'s own dateTo, not wall-clock "now" (regression: historical reports must not mark every client at-risk)', async () => {
    // A client whose only visit is 2026-04-03, viewed via a report scoped to
    // 2026-04-01 – 2026-04-05 (i.e. squarely inside the report's own window).
    // Regardless of what today's real date is, this client visited within the
    // report's period and must NOT be flagged at-risk for that historical view.
    const visitDate = new Date('2026-04-03')
    const db = {
      appointment: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ customerId: 'cust-1', scheduledDate: visitDate }])
          .mockResolvedValueOnce([{ customerId: 'cust-1', scheduledDate: visitDate }]),
      },
      customer: { findMany: vi.fn().mockResolvedValue([{ id: 'cust-1', customerName: 'Client A', phone: null }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateClientRetentionReport({ dateFrom: '2026-04-01', dateTo: '2026-04-05' })

    expect(result.rows[0].atRisk).toBe(false)
    expect(result.summary.atRiskCount).toBe(0)
  })

  it('flags atRisk when the last visit is more than 30 days before the report\'s dateTo', async () => {
    const visitDate = new Date('2026-01-01')
    const db = {
      appointment: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ customerId: 'cust-1', scheduledDate: visitDate }])
          .mockResolvedValueOnce([{ customerId: 'cust-1', scheduledDate: visitDate }]),
      },
      customer: { findMany: vi.fn().mockResolvedValue([{ id: 'cust-1', customerName: 'Client A', phone: null }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // dateTo is 2026-01-01 – 2026-03-01, i.e. visit is at the very start, more
    // than 30 days before the period's own end.
    const result = await reportService.generateClientRetentionReport({ dateFrom: '2026-01-01', dateTo: '2026-03-01' })

    expect(result.rows[0].atRisk).toBe(true)
  })
})

// ─── Commission Report (Phase 35) ──────────────────────────────────────────────

function makeCommissionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sc-1', staffId: 'emp-1', appointmentId: 'appt-1', serviceRevenue: 1000,
    commissionType: 'PERCENT', commissionRate: 20, commissionAmount: 200, tipAmount: 100,
    period: '2026-07', isPaid: false, paidDate: null, createdAt: new Date('2026-07-05'),
    staff: { fullName: 'Stylist One' },
    ...overrides,
  }
}

describe('reportService.generateCommissionReport', () => {
  it('filters by period range, not createdAt (regression: a record created after month-end for a prior period must still be included)', async () => {
    // Payroll processed on 2026-08-05 for the June billing period — createdAt
    // falls outside a June date-range query, but period='2026-06' must match.
    const db = {
      staffCommission: {
        findMany: vi.fn().mockResolvedValue([
          makeCommissionRecord({ period: '2026-06', createdAt: new Date('2026-08-05') }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCommissionReport({ dateFrom: '2026-06-01', dateTo: '2026-06-30' })

    const call = db.staffCommission.findMany.mock.calls[0][0]
    expect(call.where.period).toEqual({ gte: '2026-06', lte: '2026-06' })
    expect(result.summary.recordCount).toBe(1)
  })

  it('computes byStaff rollup with correct paid/unpaid split', async () => {
    const db = {
      staffCommission: {
        findMany: vi.fn().mockResolvedValue([
          makeCommissionRecord({ id: 'sc-1', commissionAmount: 200, isPaid: true }),
          makeCommissionRecord({ id: 'sc-2', commissionAmount: 300, isPaid: false }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCommissionReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.summary.totalCommission).toBe(500)
    expect(result.summary.paidAmount).toBe(200)
    expect(result.summary.unpaidAmount).toBe(300)
    expect(result.byStaff).toEqual([{ staffName: 'Stylist One', serviceRevenue: 2000, commissionAmount: 500, tipAmount: 200, paidAmount: 200, unpaidAmount: 300, recordCount: 2 }])
  })
})

// ─── Order Volume Report (Phase 54 — Restaurant QR) ────────────────────────────

function makeOrderRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1', status: 'PENDING', createdAt: new Date('2026-07-05T10:00:00'), resolvedAt: null,
    table: { tableNumber: '4', tableName: null },
    items: [{ quantity: 2 }],
    ...overrides,
  }
}

describe('reportService.generateOrderVolumeReport', () => {
  it('counts accepted/rejected/pending and computes acceptanceRate over resolved orders only', async () => {
    const db = {
      tableOrderRequest: {
        findMany: vi.fn().mockResolvedValue([
          makeOrderRequest({ id: 'r1', status: 'ACCEPTED' }),
          makeOrderRequest({ id: 'r2', status: 'ACCEPTED' }),
          makeOrderRequest({ id: 'r3', status: 'REJECTED' }),
          makeOrderRequest({ id: 'r4', status: 'PENDING' }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateOrderVolumeReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.summary).toEqual({ totalOrders: 4, accepted: 2, rejected: 1, pending: 1, acceptanceRate: 67 })
  })

  it('groups orders by calendar day', async () => {
    const db = {
      tableOrderRequest: {
        findMany: vi.fn().mockResolvedValue([
          makeOrderRequest({ id: 'r1', status: 'ACCEPTED', createdAt: new Date('2026-07-05T09:00:00') }),
          makeOrderRequest({ id: 'r2', status: 'REJECTED', createdAt: new Date('2026-07-06T09:00:00') }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateOrderVolumeReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.byDay).toEqual([
      { date: '2026-07-05', pending: 0, accepted: 1, rejected: 0, total: 1 },
      { date: '2026-07-06', pending: 0, accepted: 0, rejected: 1, total: 1 },
    ])
  })

  it('falls back to "Table {number}" when tableName is not set', async () => {
    const db = {
      tableOrderRequest: {
        findMany: vi.fn().mockResolvedValue([makeOrderRequest({ table: { tableNumber: '7', tableName: null } })]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateOrderVolumeReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.rows[0].tableLabel).toBe('Table 7')
  })
})

// ─── Batch & Expiry Report (Phase 54) ──────────────────────────────────────────

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1', batchNumber: 'BATCH-1', quantityRemaining: 10, unitCost: 50,
    expiryDate: new Date(Date.now() + 100 * 86400000),
    product: { productName: 'Widget' }, supplier: null,
    ...overrides,
  }
}

describe('reportService.generateBatchExpiryReport', () => {
  it('buckets an already-expired batch as "expired" and values it at qty * unitCost', async () => {
    const db = {
      productBatch: {
        findMany: vi.fn().mockResolvedValue([
          makeBatch({ expiryDate: new Date(Date.now() - 5 * 86400000), quantityRemaining: 4, unitCost: 25 }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBatchExpiryReport()

    expect(result.summary.expiredCount).toBe(1)
    expect(result.summary.expiredValue).toBe(100)
    expect(result.rows[0].bucket).toBe('expired')
  })

  it('buckets a batch expiring in exactly 7 days as "critical", not "warning"', async () => {
    const db = {
      productBatch: {
        findMany: vi.fn().mockResolvedValue([
          makeBatch({ expiryDate: new Date(Date.now() + 6.5 * 86400000) }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBatchExpiryReport()

    expect(result.rows[0].bucket).toBe('critical')
  })

  it('buckets a batch expiring in 200 days as "safe"', async () => {
    const db = {
      productBatch: {
        findMany: vi.fn().mockResolvedValue([makeBatch({ expiryDate: new Date(Date.now() + 200 * 86400000) })]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBatchExpiryReport()

    expect(result.rows[0].bucket).toBe('safe')
    expect(result.summary.safeCount).toBe(1)
  })

  // Phase 67 §9.1 — Pharmacy's "Expiry-risk value" signature win: every
  // bucket now carries a real ₹ value (previously only `expired` did), and
  // `atRiskValue` sums critical+warning only — expired stock is a sunk loss,
  // not something still actionable, so it's deliberately excluded.
  it('computes a real value per bucket and an atRiskValue excluding the expired (sunk-loss) bucket', async () => {
    const db = {
      productBatch: {
        findMany: vi.fn().mockResolvedValue([
          makeBatch({ expiryDate: new Date(Date.now() - 5 * 86400000), quantityRemaining: 4, unitCost: 25 }), // expired, value 100
          makeBatch({ expiryDate: new Date(Date.now() + 3 * 86400000), quantityRemaining: 2, unitCost: 50 }), // critical, value 100
          makeBatch({ expiryDate: new Date(Date.now() + 20 * 86400000), quantityRemaining: 3, unitCost: 10 }), // warning, value 30
          makeBatch({ expiryDate: new Date(Date.now() + 200 * 86400000), quantityRemaining: 5, unitCost: 1000 }), // safe, value 5000
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBatchExpiryReport()

    const byBucket = Object.fromEntries(result.buckets.map(b => [b.bucket, b.value]))
    expect(byBucket.expired).toBe(100)
    expect(byBucket.critical).toBe(100)
    expect(byBucket.warning).toBe(30)
    expect(byBucket.safe).toBe(5000)
    expect(result.summary.expiredValue).toBe(100)
    expect(result.summary.atRiskValue).toBe(130) // critical + warning, NOT safe or expired
  })
})

// ─── Lab Test Throughput Report (Phase 54) ─────────────────────────────────────

function makeLabOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lo-1', orderNumber: 'LAB-0001', patientName: 'John Doe', status: 'DELIVERED',
    createdAt: new Date('2026-07-01T08:00:00'), reportedAt: new Date('2026-07-02T08:00:00'),
    ...overrides,
  }
}

describe('reportService.generateLabThroughputReport', () => {
  it('computes delivered/cancelled/pending counts and average turnaround in hours', async () => {
    const db = {
      labTestOrder: {
        findMany: vi.fn().mockResolvedValue([
          makeLabOrder({ id: 'lo-1', status: 'DELIVERED', createdAt: new Date('2026-07-01T00:00:00'), reportedAt: new Date('2026-07-01T12:00:00') }),
          makeLabOrder({ id: 'lo-2', status: 'CANCELLED', reportedAt: null }),
          makeLabOrder({ id: 'lo-3', status: 'IN_PROCESS', reportedAt: null }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLabThroughputReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.summary).toEqual({ totalOrders: 3, delivered: 1, cancelled: 1, pendingCount: 1, avgTurnaroundHours: 12 })
  })

  it('groups counts by every workflow stage including CANCELLED', async () => {
    const db = {
      labTestOrder: {
        findMany: vi.fn().mockResolvedValue([
          makeLabOrder({ id: 'lo-1', status: 'ORDERED', reportedAt: null }),
          makeLabOrder({ id: 'lo-2', status: 'CANCELLED', reportedAt: null }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLabThroughputReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    const orderedStage = result.byStatus.find(s => s.status === 'ORDERED')
    const cancelledStage = result.byStatus.find(s => s.status === 'CANCELLED')
    expect(orderedStage?.count).toBe(1)
    expect(cancelledStage?.count).toBe(1)
  })

  it('returns null avgTurnaroundHours when no order has been reported yet', async () => {
    const db = {
      labTestOrder: {
        findMany: vi.fn().mockResolvedValue([makeLabOrder({ status: 'SAMPLE_COLLECTED', reportedAt: null })]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLabThroughputReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.summary.avgTurnaroundHours).toBeNull()
  })
})

// ─── Blood Stock Report (Phase 54 — reuses bloodBankService.getBloodStock) ─────

describe('reportService.generateBloodStockReport', () => {
  it('aggregates units into all 8 blood groups, defaulting empty groups to zero', async () => {
    vi.mocked(getBloodStock).mockResolvedValue({
      success: true,
      data: {
        units: [
          { donationRecordId: 'd1', donationNumber: 'DON-1', bloodGroup: 'O+', componentType: 'WHOLE_BLOOD', collectionDate: '2026-06-01', expiryDate: '2026-08-01', daysToExpiry: 20, isExpired: false, isExpiringSoon: false },
          { donationRecordId: 'd2', donationNumber: 'DON-2', bloodGroup: 'O+', componentType: 'WHOLE_BLOOD', collectionDate: '2026-06-01', expiryDate: '2026-07-10', daysToExpiry: 2, isExpired: false, isExpiringSoon: true },
          { donationRecordId: 'd3', donationNumber: 'DON-3', bloodGroup: 'A-', componentType: 'PLASMA', collectionDate: '2026-01-01', expiryDate: '2026-06-01', daysToExpiry: -10, isExpired: true, isExpiringSoon: false },
        ],
        summary: {},
      },
    } as never)

    const result = await reportService.generateBloodStockReport()

    expect(result.byGroup).toHaveLength(8)
    const oPos = result.byGroup.find(g => g.bloodGroup === 'O+')
    expect(oPos).toEqual({ bloodGroup: 'O+', available: 2, expiringSoon: 1 })
    const aNeg = result.byGroup.find(g => g.bloodGroup === 'A-')
    expect(aNeg).toEqual({ bloodGroup: 'A-', available: 0, expiringSoon: 0 })
    expect(result.summary.totalAvailable).toBe(2)
    expect(result.summary.totalExpiringSoon).toBe(1)
  })

  it('excludes expired units from the rows list', async () => {
    vi.mocked(getBloodStock).mockResolvedValue({
      success: true,
      data: {
        units: [
          { donationRecordId: 'd1', donationNumber: 'DON-1', bloodGroup: 'B+', componentType: 'WHOLE_BLOOD', collectionDate: '2026-01-01', expiryDate: '2026-06-01', daysToExpiry: -5, isExpired: true, isExpiringSoon: false },
        ],
        summary: {},
      },
    } as never)

    const result = await reportService.generateBloodStockReport()

    expect(result.rows).toHaveLength(0)
  })

  it('lists groups with zero available stock in groupsWithNoStock', async () => {
    vi.mocked(getBloodStock).mockResolvedValue({ success: true, data: { units: [], summary: {} } } as never)

    const result = await reportService.generateBloodStockReport()

    expect(result.summary.groupsWithNoStock).toHaveLength(8)
  })
})

// Phase 67 §9.1 — Blood Bank item 4: Donation-to-Issue Cycle Time.
describe('reportService.generateDonationToIssueCycleTimeReport', () => {
  function makeItem(overrides: Record<string, unknown> = {}) {
    return {
      componentType: 'PACKED_RBC',
      createdAt: new Date('2026-07-10'),
      donationRecord: { collectionDate: new Date('2026-07-01') },
      ...overrides
    }
  }

  it('returns an honest empty result when no units have been issued', async () => {
    const db = { bloodIssueItem: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDonationToIssueCycleTimeReport()

    expect(result.summary).toEqual({ totalIssuedUnits: 0, overallAvgDays: 0 })
    expect(result.byComponent).toEqual([])
  })

  it('computes the correct cycle time in days between collection and issue', async () => {
    const db = { bloodIssueItem: { findMany: vi.fn().mockResolvedValue([makeItem()]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDonationToIssueCycleTimeReport()

    expect(result.summary.totalIssuedUnits).toBe(1)
    expect(result.summary.overallAvgDays).toBe(9)
    expect(result.byComponent).toEqual([{ componentType: 'PACKED_RBC', unitCount: 1, avgDays: 9, minDays: 9, maxDays: 9 }])
  })

  it('breaks down by component type, ranked slowest (highest avg) first', async () => {
    const db = {
      bloodIssueItem: {
        findMany: vi.fn().mockResolvedValue([
          makeItem({ componentType: 'PLATELETS', createdAt: new Date('2026-07-03'), donationRecord: { collectionDate: new Date('2026-07-01') } }), // 2 days
          makeItem({ componentType: 'PLASMA', createdAt: new Date('2026-08-01'), donationRecord: { collectionDate: new Date('2026-07-01') } }), // 31 days
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDonationToIssueCycleTimeReport()

    expect(result.byComponent[0].componentType).toBe('PLASMA')
    expect(result.byComponent[1].componentType).toBe('PLATELETS')
  })

  it('aggregates min/max/avg correctly across multiple units of the same component', async () => {
    const db = {
      bloodIssueItem: {
        findMany: vi.fn().mockResolvedValue([
          makeItem({ createdAt: new Date('2026-07-05') }), // 4 days
          makeItem({ createdAt: new Date('2026-07-11') }), // 10 days
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDonationToIssueCycleTimeReport()

    const row = result.byComponent[0]
    expect(row.unitCount).toBe(2)
    expect(row.minDays).toBe(4)
    expect(row.maxDays).toBe(10)
    expect(row.avgDays).toBe(7)
  })

  it('excludes items whose blood issue was cancelled', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { bloodIssueItem: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateDonationToIssueCycleTimeReport()

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ bloodIssue: { status: { not: 'CANCELLED' } } })
    }))
  })
})

// ─── Profit & Loss Statement (fresh-audit fix, 2026-07-12) ─────────────────────

describe('reportService.generateProfitAndLossReport', () => {
  // Phase 64 — invoice items now carry only productId (getProductCostsBatch
  // resolves cost separately), not a nested product.costPrice selection —
  // see report.service.ts's own generateProfitAndLossReport.
  function makePLInvoice(overrides: Record<string, unknown> = {}) {
    return {
      totalAmount: 1000, invoiceType: 'SALE',
      items: [{ quantity: 2, productId: 'prod-1' }],
      ...overrides,
    }
  }

  // Every test below resolves 'prod-1' to cost 100 via the default
  // WEIGHTED_AVERAGE method with no Inventory row (falls back to
  // costPrice), matching the flat cost every one of these tests assumes.
  function makeCostDb(overrides: Record<string, unknown> = {}) {
    return {
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'prod-1', costPrice: 100, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([]) },
      ...overrides
    }
  }

  it('computes revenue, COGS, and gross profit correctly for a single sale invoice', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([makePLInvoice()]) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      ...makeCostDb(),
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProfitAndLossReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.revenue).toBe(1000)
    expect(result.summary.cogs).toBe(200) // 2 * 100
    expect(result.summary.grossProfit).toBe(800)
    expect(result.summary.grossMarginPercent).toBe(80)
  })

  it('subtracts expenses (grouped by category) to reach net profit', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([makePLInvoice()]) },
      expense: { findMany: vi.fn().mockResolvedValue([
        { amount: 100, category: { categoryName: 'Rent' } },
        { amount: 50, category: { categoryName: 'Rent' } },
        { amount: 30, category: { categoryName: 'Utilities' } },
      ]) },
      ...makeCostDb(),
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProfitAndLossReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalExpenses).toBe(180)
    expect(result.summary.netProfit).toBe(800 - 180) // grossProfit - totalExpenses
    expect(result.expensesByCategory).toEqual([
      { category: 'Rent', amount: 150 },
      { category: 'Utilities', amount: 30 },
    ])
  })

  it('applies the same RETURN-invoice sign correction to COGS as analytics.service.ts\'s computeProfit, so both never disagree for the same period', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([
        makePLInvoice(), // SALE: revenue +1000, cogs +200
        makePLInvoice({ invoiceType: 'RETURN', totalAmount: -400, items: [{ quantity: 1, productId: 'prod-1' }] }), // RETURN: revenue -400, cogs -100
      ]) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      ...makeCostDb(),
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProfitAndLossReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.revenue).toBe(600) // 1000 - 400
    expect(result.summary.cogs).toBe(100) // 200 - 100, not 200 + 100
  })

  it('reports zero margins instead of dividing by zero when there is no revenue in the period', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      expense: { findMany: vi.fn().mockResolvedValue([{ amount: 50, category: { categoryName: 'Rent' } }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProfitAndLossReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.grossMarginPercent).toBe(0)
    expect(result.summary.netMarginPercent).toBe(0)
    expect(result.summary.netProfit).toBe(-50)
  })
})

// Phase 64 — first-ever dedicated coverage for this function; it had zero
// unit tests before this phase touched its cost-resolution math (was
// m.product.costPrice, now getProductCostsBatch()).
describe('reportService.generateFoodCostReport', () => {
  function makeIngredientMovement(overrides: Record<string, unknown> = {}) {
    return {
      productId: 'ing-1', quantity: -3,
      remarks: 'Ingredient deduction for KOT KOT-001',
      product: { productName: 'Tomato', unit: 'KG' },
      ...overrides
    }
  }

  it('aggregates ingredient usage by product and computes cost via getProductCostsBatch, not the static costPrice', async () => {
    const db = makeDb({
      inventoryMovement: { findMany: vi.fn().mockResolvedValue([makeIngredientMovement()]) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'ing-1', costPrice: 5, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'ing-1', averageCost: 8, quantity: 50 }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFoodCostReport()

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].totalQuantityUsed).toBe(3)
    // 8 (live averageCost), not 5 (static costPrice) — the exact bug this phase closed.
    expect(result.rows[0].costPrice).toBe(8)
    expect(result.rows[0].totalCost).toBe(24)
    expect(result.totalCost).toBe(24)
  })

  it('sums multiple deduction movements for the same ingredient into one row', async () => {
    const db = makeDb({
      inventoryMovement: { findMany: vi.fn().mockResolvedValue([
        makeIngredientMovement({ quantity: -2 }),
        makeIngredientMovement({ quantity: -1 }),
      ]) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'ing-1', costPrice: 5, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'ing-1', averageCost: 10, quantity: 50 }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFoodCostReport()

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].totalQuantityUsed).toBe(3)
    expect(result.rows[0].totalCost).toBe(30)
  })
})

// Phase 67 §9.1 — Restaurant: Dish-Wise Contribution Margin. Distinct from
// generateFoodCostReport above — this is per-DISH recipe-formula margin
// (revenue minus theoretical ingredient cost), not aggregate real
// consumption spend.
describe('reportService.generateDishContributionMarginReport', () => {
  function makeDishItem(overrides: Record<string, unknown> = {}) {
    return {
      productId: 'dish-1', quantity: 2, lineTotal: 400,
      invoice: { invoiceType: 'SALE' },
      product: { productName: 'Butter Chicken' },
      ...overrides
    }
  }

  it('computes revenue, ingredient cost, and margin for a dish with a real recipe', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([makeDishItem()]) },
      recipe: { findMany: vi.fn().mockResolvedValue([
        { productId: 'dish-1', items: [{ ingredientProductId: 'ing-1', quantity: 3 }] }
      ]) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'ing-1', costPrice: 10, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'ing-1', averageCost: 20, quantity: 50 }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDishContributionMarginReport()

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].productName).toBe('Butter Chicken')
    expect(result.rows[0].quantitySold).toBe(2)
    expect(result.rows[0].revenue).toBe(400)
    // recipe cost per unit = 3 ingredient units * 20 averageCost = 60; * 2 sold = 120
    expect(result.rows[0].ingredientCost).toBe(120)
    expect(result.rows[0].contributionMargin).toBe(280)
    expect(result.rows[0].marginPercent).toBe(70)
  })

  it('shows a dish with no recipe as 0 cost / 100% margin, not a guess', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([makeDishItem({ productId: 'dish-2', product: { productName: 'Bottled Water' }, lineTotal: 100 })]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDishContributionMarginReport()

    expect(result.rows[0].ingredientCost).toBe(0)
    expect(result.rows[0].contributionMargin).toBe(100)
    expect(result.rows[0].marginPercent).toBe(100)
  })

  it('expands a combo/kit dish into its real component dishes\' recipes, mirroring deductIngredients\' own kit-expansion', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([makeDishItem({ productId: 'combo-1', product: { productName: 'Family Thali' }, quantity: 1, lineTotal: 500 })]) },
      kitComponent: { findMany: vi.fn().mockResolvedValue([
        { kitProductId: 'combo-1', componentProductId: 'dish-1', quantity: 1 },
        { kitProductId: 'combo-1', componentProductId: 'dish-2', quantity: 1 },
      ]) },
      recipe: { findMany: vi.fn().mockResolvedValue([
        { productId: 'dish-1', items: [{ ingredientProductId: 'ing-1', quantity: 2 }] },
        { productId: 'dish-2', items: [{ ingredientProductId: 'ing-1', quantity: 1 }] },
      ]) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'ing-1', costPrice: 10, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'ing-1', averageCost: 15, quantity: 50 }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDishContributionMarginReport()

    // dish-1: 2 * 15 = 30, dish-2: 1 * 15 = 15, combo total = 45
    expect(result.rows[0].ingredientCost).toBe(45)
    expect(result.rows[0].contributionMargin).toBe(455)
  })

  it('applies the RETURN sign correction to both revenue and quantity, same as getTopProducts', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([
        makeDishItem({ quantity: 3, lineTotal: 600 }),
        makeDishItem({ quantity: 1, lineTotal: -200, invoice: { invoiceType: 'RETURN' } }),
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDishContributionMarginReport()

    expect(result.rows[0].quantitySold).toBe(2)
    expect(result.rows[0].revenue).toBe(400)
  })

  it('sorts rows by contribution margin, highest first', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([
        makeDishItem({ productId: 'low-margin', product: { productName: 'Low' }, lineTotal: 100 }),
        makeDishItem({ productId: 'high-margin', product: { productName: 'High' }, lineTotal: 900 }),
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDishContributionMarginReport()

    expect(result.rows.map(r => r.productName)).toEqual(['High', 'Low'])
  })

  it('returns an honest empty result when nothing sold in the date range', async () => {
    const db = makeDb({ invoiceItem: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDishContributionMarginReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toEqual([])
  })
})

// Phase 67 §9.1 — Restaurant: Table Turnover by Hour. Only KOTs with a real
// tableId count as a "table turn" — a counter/takeaway sale (tableId null)
// is correctly excluded, since a table-turnover report can only honestly
// speak to actual dine-in seatings.
describe('reportService.generateTableTurnoverByHourReport', () => {
  it('buckets a KOT by its real local day-of-week and hour-of-day', async () => {
    // 2024-01-08 was a Monday; 14:30 local -> hour bucket 14.
    const db = makeDb({ kOT: { findMany: vi.fn().mockResolvedValue([{ createdAt: new Date(2024, 0, 8, 14, 30) }]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTableTurnoverByHourReport()

    expect(result.cells).toHaveLength(168)
    const cell = result.cells.find(c => c.dayOfWeek === 1 && c.hour === 14)
    expect(cell?.count).toBe(1)
    expect(result.summary.totalTurns).toBe(1)
    expect(result.summary.peakDayOfWeek).toBe(1)
    expect(result.summary.peakHour).toBe(14)
    expect(result.summary.peakCount).toBe(1)
  })

  it('sums multiple KOTs landing in the same day/hour bucket', async () => {
    const db = makeDb({ kOT: { findMany: vi.fn().mockResolvedValue([
      { createdAt: new Date(2024, 0, 8, 19, 5) },
      { createdAt: new Date(2024, 0, 8, 19, 50) },
      { createdAt: new Date(2024, 0, 8, 19, 20) },
    ]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTableTurnoverByHourReport()

    const cell = result.cells.find(c => c.dayOfWeek === 1 && c.hour === 19)
    expect(cell?.count).toBe(3)
    expect(result.summary.totalTurns).toBe(3)
    expect(result.summary.peakCount).toBe(3)
  })

  it('excludes KOTs with no table (counter/takeaway sales) via the query filter itself', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = makeDb({ kOT: { findMany } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateTableTurnoverByHourReport()

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tableId: { not: null } })
    }))
  })

  it('returns the full 7x24 grid, zero-filled, when nothing in range — an honest empty result, not a gap', async () => {
    const db = makeDb({ kOT: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTableTurnoverByHourReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.cells).toHaveLength(168)
    expect(result.cells.every(c => c.count === 0)).toBe(true)
    expect(result.summary).toEqual({ totalTurns: 0, peakDayOfWeek: null, peakHour: null, peakCount: 0 })
  })
})

// Phase 67 §9.1 — Restaurant: Recipe-vs-Actual Waste Variance. Pairs
// recipe-implied ingredient usage (from dishes sold) against actual
// InventoryMovement drawdown — the same movement source generateFoodCostReport
// reads, deliberately distinct data (quantity variance, not aggregate cost).
describe('reportService.generateRecipeWasteVarianceReport', () => {
  function makeDishSaleItem(overrides: Record<string, unknown> = {}) {
    return { productId: 'dish-1', quantity: 2, invoice: { invoiceType: 'SALE' }, ...overrides }
  }
  function makeMovement(overrides: Record<string, unknown> = {}) {
    return { productId: 'ing-1', quantity: -10, ...overrides }
  }

  it('computes a positive variance when actual usage exceeds what the recipe implies (overage/waste)', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([makeDishSaleItem()]) },
      recipe: { findMany: vi.fn().mockResolvedValue([{ productId: 'dish-1', items: [{ ingredientProductId: 'ing-1', quantity: 3 }] }]) },
      inventoryMovement: { findMany: vi.fn().mockResolvedValue([makeMovement({ quantity: -10 })]) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'ing-1', productName: 'Ghee', unit: 'KG' }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRecipeWasteVarianceReport()

    expect(result.rows).toHaveLength(1)
    // implied = 3 * 2 = 6; actual = 10; variance = +4 (overage)
    expect(result.rows[0].impliedQuantity).toBe(6)
    expect(result.rows[0].actualQuantity).toBe(10)
    expect(result.rows[0].varianceQuantity).toBe(4)
    expect(result.rows[0].ingredientName).toBe('Ghee')
  })

  it('gives an ingredient with real movements but no recipe a null variancePercent, not a division-by-zero artifact', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
      inventoryMovement: { findMany: vi.fn().mockResolvedValue([makeMovement({ quantity: -5 })]) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'ing-1', productName: 'Ghee', unit: 'KG' }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRecipeWasteVarianceReport()

    expect(result.rows[0].impliedQuantity).toBe(0)
    expect(result.rows[0].actualQuantity).toBe(5)
    expect(result.rows[0].variancePercent).toBeNull()
  })

  it('sorts rows by absolute variance, largest discrepancy first', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
      inventoryMovement: { findMany: vi.fn().mockResolvedValue([
        makeMovement({ productId: 'ing-small', quantity: -1 }),
        makeMovement({ productId: 'ing-big', quantity: -50 }),
      ]) },
      product: { findMany: vi.fn().mockResolvedValue([
        { id: 'ing-small', productName: 'Small Variance', unit: 'KG' },
        { id: 'ing-big', productName: 'Big Variance', unit: 'KG' },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRecipeWasteVarianceReport()

    expect(result.rows.map(r => r.ingredientName)).toEqual(['Big Variance', 'Small Variance'])
  })

  it('returns an honest empty result when nothing in range', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
      inventoryMovement: { findMany: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRecipeWasteVarianceReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toEqual([])
  })
})

// Phase 67 §9.1 — Retail: Dead-Stock Clearance List. `db.product.findMany`
// is called TWICE per report run — once for this report's own
// product/inventory/invoiceItems query, once internally by
// getProductCostsBatch's own cost lookup — so these tests chain
// mockResolvedValueOnce in that exact call order rather than a single
// mockResolvedValue (which would answer both calls identically and break
// one of the two shapes).
describe('reportService.generateDeadStockClearanceReport', () => {
  function makeDeadProduct(overrides: Record<string, unknown> = {}) {
    return {
      id: 'prod-1', productName: 'Old Sweater', sku: 'SW-1', unit: 'PCS',
      inventory: { quantity: 20 },
      invoiceItems: [],
      ...overrides
    }
  }

  it('includes a product with stock and no sale within the lookback window, computing capital locked', async () => {
    const db = makeDb()
    db.product.findMany = vi.fn()
      .mockResolvedValueOnce([makeDeadProduct()])
      .mockResolvedValueOnce([{ id: 'prod-1', costPrice: 50, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }])
    db.inventory.findMany = vi.fn().mockResolvedValue([{ productId: 'prod-1', averageCost: 50, quantity: 20 }])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDeadStockClearanceReport()

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].currentStock).toBe(20)
    expect(result.rows[0].unitCost).toBe(50)
    expect(result.rows[0].capitalLocked).toBe(1000)
    expect(result.rows[0].lastSoldDate).toBeNull()
    expect(result.summary.totalCapitalLocked).toBe(1000)
    expect(result.summary.itemCount).toBe(1)
  })

  it('excludes a product with stock that sold recently (inside the lookback window)', async () => {
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 5)
    const db = makeDb()
    db.product.findMany = vi.fn()
      .mockResolvedValueOnce([makeDeadProduct({ invoiceItems: [{ invoice: { invoiceDate: recentDate } }] })])
      .mockResolvedValueOnce([{ id: 'prod-1', costPrice: 50, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }])
    db.inventory.findMany = vi.fn().mockResolvedValue([{ productId: 'prod-1', averageCost: 50, quantity: 20 }])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDeadStockClearanceReport()

    expect(result.rows).toHaveLength(0)
  })

  it('excludes a product that sold recently but happens to have 0 stock left', async () => {
    const db = makeDb()
    db.product.findMany = vi.fn()
      .mockResolvedValueOnce([makeDeadProduct({ inventory: { quantity: 0 } })])
      .mockResolvedValueOnce([])
    db.inventory.findMany = vi.fn().mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDeadStockClearanceReport()

    expect(result.rows).toHaveLength(0)
  })

  it('sorts rows by capital locked, highest first', async () => {
    const db = makeDb()
    db.product.findMany = vi.fn()
      .mockResolvedValueOnce([
        makeDeadProduct({ id: 'prod-low', productName: 'Low Value', inventory: { quantity: 5 } }),
        makeDeadProduct({ id: 'prod-high', productName: 'High Value', inventory: { quantity: 100 } }),
      ])
      .mockResolvedValueOnce([
        { id: 'prod-low', costPrice: 10, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null },
        { id: 'prod-high', costPrice: 10, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null },
      ])
    db.inventory.findMany = vi.fn().mockResolvedValue([
      { productId: 'prod-low', averageCost: 10, quantity: 5 },
      { productId: 'prod-high', averageCost: 10, quantity: 100 },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDeadStockClearanceReport()

    expect(result.rows.map(r => r.productName)).toEqual(['High Value', 'Low Value'])
  })

  it('returns an honest empty result when nothing qualifies as dead stock', async () => {
    const db = makeDb()
    db.product.findMany = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDeadStockClearanceReport()

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalCapitalLocked: 0, itemCount: 0 })
  })
})

// Phase 67 §9.1 — Retail: Category Sell-Through Rate. Every month in the
// requested range is compared against the SAME current stock-on-hand figure
// per category (a deliberate, disclosed simplification — see
// report.service.ts's own comment) rather than a reconstructed historical
// opening balance, so `currentStock` never varies month to month within one
// report run.
describe('reportService.generateCategorySellThroughReport', () => {
  function stub(overrides: Record<string, unknown> = {}) {
    return {
      productCategory: { findMany: vi.fn().mockResolvedValue([{ id: 'cat-1', name: 'Snacks' }]) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'prod-1', categoryId: 'cat-1' }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'prod-1', quantity: 30 }]) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
      ...overrides
    }
  }

  it('computes sell-through rate as unitsSold / (unitsSold + currentStock) for the category', async () => {
    const db = makeDb(stub({
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeInvoiceItem({ productId: 'prod-1', quantity: 10, invoice: { invoiceDate: new Date('2024-01-15'), invoiceType: 'SALE' }, product: { categoryId: 'cat-1' } })
        ])
      }
    }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategorySellThroughReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const row = result.rows.find(r => r.month === '2024-01' && r.categoryId === 'cat-1')
    expect(row).toBeDefined()
    expect(row!.unitsSold).toBe(10)
    expect(row!.currentStock).toBe(30)
    expect(row!.sellThroughRate).toBe(25) // 10 / (10 + 30) * 100
  })

  it('zero-fills a month with no sales for a category, rather than omitting it', async () => {
    const db = makeDb(stub())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategorySellThroughReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const row = result.rows.find(r => r.month === '2024-01' && r.categoryId === 'cat-1')
    expect(row).toBeDefined()
    expect(row!.unitsSold).toBe(0)
    expect(row!.sellThroughRate).toBe(0)
  })

  it('zero-fills every month across a multi-month range', async () => {
    const db = makeDb(stub())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategorySellThroughReport({ dateFrom: '2024-01-01', dateTo: '2024-03-31' })

    const months = new Set(result.rows.map(r => r.month))
    expect(months).toEqual(new Set(['2024-01', '2024-02', '2024-03']))
  })

  it('applies the same RETURN sign correction as every other report — a return reduces unitsSold, never inflates it', async () => {
    const db = makeDb(stub({
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeInvoiceItem({ productId: 'prod-1', quantity: 10, invoice: { invoiceDate: new Date('2024-01-15'), invoiceType: 'SALE' }, product: { categoryId: 'cat-1' } }),
          makeInvoiceItem({ productId: 'prod-1', quantity: 3, invoice: { invoiceDate: new Date('2024-01-20'), invoiceType: 'RETURN' }, product: { categoryId: 'cat-1' } })
        ])
      }
    }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategorySellThroughReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const row = result.rows.find(r => r.month === '2024-01' && r.categoryId === 'cat-1')
    expect(row!.unitsSold).toBe(7) // 10 - 3
  })

  it('clamps a month where returns exceed sales to a 0% rate, never a negative one', async () => {
    const db = makeDb(stub({
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeInvoiceItem({ productId: 'prod-1', quantity: 2, invoice: { invoiceDate: new Date('2024-01-15'), invoiceType: 'SALE' }, product: { categoryId: 'cat-1' } }),
          makeInvoiceItem({ productId: 'prod-1', quantity: 5, invoice: { invoiceDate: new Date('2024-01-20'), invoiceType: 'RETURN' }, product: { categoryId: 'cat-1' } })
        ])
      }
    }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategorySellThroughReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const row = result.rows.find(r => r.month === '2024-01' && r.categoryId === 'cat-1')
    expect(row!.unitsSold).toBe(-3) // raw figure shown honestly, not hidden
    expect(row!.sellThroughRate).toBe(0) // but the rate itself never goes negative
  })

  it('returns an honest empty result when no product categories exist', async () => {
    const db = makeDb(stub({ productCategory: { findMany: vi.fn().mockResolvedValue([]) } }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategorySellThroughReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toEqual([])
  })
})

// Phase 67 §9.1 — Clothing: Season/Collection Sell-Through. Byte-for-byte
// the same shape/behavior as CategorySellThroughReport above, grouped by
// the new free-text Product.season field instead of ProductCategory.
describe('reportService.generateSeasonSellThroughReport', () => {
  function stub(overrides: Record<string, unknown> = {}) {
    return {
      product: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ season: 'Summer 2026' }])
          .mockResolvedValueOnce([{ id: 'prod-1', season: 'Summer 2026' }])
      },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'prod-1', quantity: 30 }]) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
      ...overrides
    }
  }

  it('computes sell-through rate as unitsSold / (unitsSold + currentStock) for the season', async () => {
    const db = makeDb(stub({
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeInvoiceItem({ productId: 'prod-1', quantity: 10, invoice: { invoiceDate: new Date('2024-01-15'), invoiceType: 'SALE' }, product: { season: 'Summer 2026' } })
        ])
      }
    }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSeasonSellThroughReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const row = result.rows.find(r => r.month === '2024-01' && r.season === 'Summer 2026')
    expect(row).toBeDefined()
    expect(row!.unitsSold).toBe(10)
    expect(row!.currentStock).toBe(30)
    expect(row!.sellThroughRate).toBe(25) // 10 / (10 + 30) * 100
  })

  it('zero-fills every month across a multi-month range', async () => {
    const db = makeDb(stub())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSeasonSellThroughReport({ dateFrom: '2024-01-01', dateTo: '2024-03-31' })

    const months = new Set(result.rows.map(r => r.month))
    expect(months).toEqual(new Set(['2024-01', '2024-02', '2024-03']))
  })

  it('applies the same RETURN sign correction as every other report', async () => {
    const db = makeDb(stub({
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeInvoiceItem({ productId: 'prod-1', quantity: 10, invoice: { invoiceDate: new Date('2024-01-15'), invoiceType: 'SALE' }, product: { season: 'Summer 2026' } }),
          makeInvoiceItem({ productId: 'prod-1', quantity: 3, invoice: { invoiceDate: new Date('2024-01-20'), invoiceType: 'RETURN' }, product: { season: 'Summer 2026' } })
        ])
      }
    }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSeasonSellThroughReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const row = result.rows.find(r => r.month === '2024-01' && r.season === 'Summer 2026')
    expect(row!.unitsSold).toBe(7) // 10 - 3
  })

  it('clamps a month where returns exceed sales to a 0% rate, never a negative one', async () => {
    const db = makeDb(stub({
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeInvoiceItem({ productId: 'prod-1', quantity: 2, invoice: { invoiceDate: new Date('2024-01-15'), invoiceType: 'SALE' }, product: { season: 'Summer 2026' } }),
          makeInvoiceItem({ productId: 'prod-1', quantity: 5, invoice: { invoiceDate: new Date('2024-01-20'), invoiceType: 'RETURN' }, product: { season: 'Summer 2026' } })
        ])
      }
    }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSeasonSellThroughReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const row = result.rows.find(r => r.month === '2024-01' && r.season === 'Summer 2026')
    expect(row!.unitsSold).toBe(-3)
    expect(row!.sellThroughRate).toBe(0)
  })

  it('returns an honest empty result when no product has a season set', async () => {
    const db = makeDb({
      product: { findMany: vi.fn().mockResolvedValueOnce([]) },
      inventory: { findMany: vi.fn().mockResolvedValue([]) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSeasonSellThroughReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toEqual([])
  })
})

// Phase 67 §9.1 — Clothing: Size × Style Heatmap.
describe('reportService.generateSizeStyleHeatmapReport', () => {
  function makeItem(overrides: Record<string, unknown> = {}) {
    return {
      quantity: 5, variantId: 'var-m',
      invoice: { invoiceType: 'SALE' },
      product: { productName: 'Cotton T-Shirt' },
      ...overrides
    }
  }

  it('groups units sold by style (product name) and size (via a real ProductVariant join)', async () => {
    const db = {
      invoiceItem: { findMany: vi.fn().mockResolvedValue([makeItem({ quantity: 10, variantId: 'var-m' })]) },
      productVariant: { findMany: vi.fn().mockResolvedValue([{ id: 'var-m', size: 'M' }]) }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeStyleHeatmapReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.cells).toEqual([{ style: 'Cotton T-Shirt', size: 'M', unitsSold: 10 }])
    expect(result.styles).toEqual(['Cotton T-Shirt'])
    expect(result.sizes).toEqual(['M'])
  })

  it('resolves size via ProductVariant, not the free-text InvoiceItem.variantInfo snapshot', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'var-m', size: 'M' }])
    const db = {
      invoiceItem: { findMany: vi.fn().mockResolvedValue([makeItem({ variantId: 'var-m' })]) },
      productVariant: { findMany }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateSizeStyleHeatmapReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['var-m'] } } }))
  })

  it('applies the same RETURN sign correction as every other report, clamped at zero', async () => {
    const db = {
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeItem({ quantity: 10, variantId: 'var-m', invoice: { invoiceType: 'SALE' } }),
          makeItem({ quantity: 3, variantId: 'var-m', invoice: { invoiceType: 'RETURN' } }),
        ])
      },
      productVariant: { findMany: vi.fn().mockResolvedValue([{ id: 'var-m', size: 'M' }]) }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeStyleHeatmapReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.cells[0].unitsSold).toBe(7) // 10 - 3
  })

  it('caps the grid to the top 15 styles by net units sold', async () => {
    const items = Array.from({ length: 20 }, (_, i) => makeItem({
      quantity: 20 - i, variantId: `var-${i}`, product: { productName: `Style ${i}` }
    }))
    const variants = Array.from({ length: 20 }, (_, i) => ({ id: `var-${i}`, size: 'M' }))
    const db = {
      invoiceItem: { findMany: vi.fn().mockResolvedValue(items) },
      productVariant: { findMany: vi.fn().mockResolvedValue(variants) }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeStyleHeatmapReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.styles).toHaveLength(15)
    expect(result.styles).toContain('Style 0') // the highest-selling style
    expect(result.styles).not.toContain('Style 19') // the lowest-selling, cut off
  })

  it('computes the summary — total units sold and the single top-selling cell', async () => {
    const db = {
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeItem({ quantity: 10, variantId: 'var-m', product: { productName: 'Cotton T-Shirt' } }),
          makeItem({ quantity: 25, variantId: 'var-l', product: { productName: 'Cotton T-Shirt' } }),
        ])
      },
      productVariant: { findMany: vi.fn().mockResolvedValue([{ id: 'var-m', size: 'M' }, { id: 'var-l', size: 'L' }]) }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeStyleHeatmapReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary).toEqual({ totalUnitsSold: 35, topCellStyle: 'Cotton T-Shirt', topCellSize: 'L', topCellUnitsSold: 25 })
  })

  it('sorts sizes using a clothing-size-aware order (XS through 3XL), not plain alphabetical', async () => {
    const db = {
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeItem({ quantity: 1, variantId: 'var-xl' }),
          makeItem({ quantity: 1, variantId: 'var-s' }),
          makeItem({ quantity: 1, variantId: 'var-m' }),
        ])
      },
      productVariant: { findMany: vi.fn().mockResolvedValue([{ id: 'var-xl', size: 'XL' }, { id: 'var-s', size: 'S' }, { id: 'var-m', size: 'M' }]) }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeStyleHeatmapReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.sizes).toEqual(['S', 'M', 'XL']) // not alphabetical (M, S, XL)
  })

  it('returns an honest empty result when no variant-tracked sales exist in range', async () => {
    const db = { invoiceItem: { findMany: vi.fn().mockResolvedValue([]) }, productVariant: { findMany: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeStyleHeatmapReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.cells).toEqual([])
    expect(result.summary).toEqual({ totalUnitsSold: 0, topCellStyle: null, topCellSize: null, topCellUnitsSold: 0 })
  })

  it('queries only ACTIVE invoices with a variantId set, within the requested date range', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { invoiceItem: { findMany }, productVariant: { findMany: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateSizeStyleHeatmapReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ variantId: { not: null }, invoice: expect.objectContaining({ status: 'ACTIVE' }) })
    }))
  })
})

// Phase 67 §9.1 — Footwear item 4: Size Availability Heatmap. A live
// CURRENT-STATE stock snapshot (no date range), deliberately separate from
// generateSizeStyleHeatmapReport above despite the similar grid shape.
describe('reportService.generateSizeAvailabilityHeatmapReport', () => {
  function makeVariant(overrides: Record<string, unknown> = {}) {
    return { size: 'M', stockQty: 5, product: { productName: 'Trail Runner' }, ...overrides }
  }

  it('sums stock across colour/width for a given style×size cell', async () => {
    const db = {
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          makeVariant({ size: '9', stockQty: 3 }),
          makeVariant({ size: '9', stockQty: 4 }), // e.g. a different colour, same style+size
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeAvailabilityHeatmapReport()

    expect(result.cells).toEqual([{ style: 'Trail Runner', size: '9', stockQty: 7, status: 'IN' }])
  })

  it('classifies a cell OUT when stock is zero, LOW when at/under the threshold, IN otherwise', async () => {
    const db = {
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          makeVariant({ size: '8', stockQty: 0, product: { productName: 'Style A' } }),
          makeVariant({ size: '9', stockQty: 2, product: { productName: 'Style A' } }),
          makeVariant({ size: '10', stockQty: 20, product: { productName: 'Style A' } }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeAvailabilityHeatmapReport({ lowStockThreshold: 3 })

    const byS = Object.fromEntries(result.cells.map(c => [c.size, c.status]))
    expect(byS).toEqual({ '8': 'OUT', '9': 'LOW', '10': 'IN' })
  })

  it('respects a custom lowStockThreshold', async () => {
    const db = { productVariant: { findMany: vi.fn().mockResolvedValue([makeVariant({ size: '9', stockQty: 5 })]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeAvailabilityHeatmapReport({ lowStockThreshold: 10 })

    expect(result.cells[0].status).toBe('LOW')
    expect(result.lowStockThreshold).toBe(10)
  })

  it('defaults lowStockThreshold to 3 when not provided', async () => {
    const db = { productVariant: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeAvailabilityHeatmapReport()

    expect(result.lowStockThreshold).toBe(3)
  })

  it('surfaces the style with the most out-of-stock sizes first, ranked by gap count not stock volume', async () => {
    const db = {
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          // Style A: 1 gap
          makeVariant({ size: '8', stockQty: 0, product: { productName: 'Style A' } }),
          makeVariant({ size: '9', stockQty: 50, product: { productName: 'Style A' } }),
          // Style B: 2 gaps
          makeVariant({ size: '8', stockQty: 0, product: { productName: 'Style B' } }),
          makeVariant({ size: '9', stockQty: 0, product: { productName: 'Style B' } }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeAvailabilityHeatmapReport()

    expect(result.styles[0]).toBe('Style B')
    expect(result.summary.styleWithMostGaps).toBe('Style B')
    expect(result.summary.styleGapCount).toBe(2)
  })

  it('counts out-of-stock and low-stock cells correctly in the summary', async () => {
    const db = {
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          makeVariant({ size: '8', stockQty: 0 }),
          makeVariant({ size: '9', stockQty: 1 }),
          makeVariant({ size: '10', stockQty: 100 }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeAvailabilityHeatmapReport()

    expect(result.summary.outOfStockCells).toBe(1)
    expect(result.summary.lowStockCells).toBe(1)
  })

  it('sorts sizes using a clothing-size-aware order, not plain alphabetical', async () => {
    const db = {
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          makeVariant({ size: 'XL' }), makeVariant({ size: 'S' }), makeVariant({ size: 'M' }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeAvailabilityHeatmapReport()

    expect(result.sizes).toEqual(['S', 'M', 'XL'])
  })

  it('returns an honest empty result when no variant-tracked stock exists', async () => {
    const db = { productVariant: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSizeAvailabilityHeatmapReport()

    expect(result.cells).toEqual([])
    expect(result.styles).toEqual([])
    expect(result.summary).toEqual({ totalStyles: 0, outOfStockCells: 0, lowStockCells: 0, styleWithMostGaps: null, styleGapCount: 0 })
  })

  it('queries only active variants of active products with a size set', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { productVariant: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateSizeAvailabilityHeatmapReport()

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isActive: true, size: { not: null }, product: { isActive: true } })
    }))
  })
})

// Phase 67 §9.1 — Retail: Basket Composition. RETURN invoices are excluded
// entirely (not sign-corrected) — a returned basket's pairing was never a
// genuine co-purchase decision.
describe('reportService.generateBasketCompositionReport', () => {
  function makeBasketInvoice(overrides: Record<string, unknown> = {}) {
    return {
      totalAmount: 100, invoiceType: 'RETAIL',
      items: [
        { productId: 'p1', product: { productName: 'Bread' } },
        { productId: 'p2', product: { productName: 'Butter' } },
      ],
      ...overrides
    }
  }

  it('counts a pair from a single 2-item basket', async () => {
    const db = makeDb({ invoice: { findMany: vi.fn().mockResolvedValue([makeBasketInvoice()]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBasketCompositionReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ productAId: 'p1', productAName: 'Bread', productBId: 'p2', productBName: 'Butter', basketCount: 1 })
  })

  it('collapses the same pair seen in reversed item order across two baskets into one row, not two', async () => {
    const db = makeDb({
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeBasketInvoice({ items: [{ productId: 'p1', product: { productName: 'Bread' } }, { productId: 'p2', product: { productName: 'Butter' } }] } ),
          makeBasketInvoice({ items: [{ productId: 'p2', product: { productName: 'Butter' } }, { productId: 'p1', product: { productName: 'Bread' } }] } ),
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBasketCompositionReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].basketCount).toBe(2)
  })

  it('produces exactly 3 pairs for a 3-item basket (combinatorial correctness)', async () => {
    const db = makeDb({
      invoice: {
        findMany: vi.fn().mockResolvedValue([makeBasketInvoice({
          items: [
            { productId: 'p1', product: { productName: 'Bread' } },
            { productId: 'p2', product: { productName: 'Butter' } },
            { productId: 'p3', product: { productName: 'Jam' } },
          ]
        })])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBasketCompositionReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toHaveLength(3)
    expect(result.rows.every(r => r.basketCount === 1)).toBe(true)
  })

  it('counts a single-item basket toward totalBaskets/avgItemsPerBasket but produces no pairing row', async () => {
    const db = makeDb({
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeBasketInvoice(), // 2-item
          makeBasketInvoice({ items: [{ productId: 'p3', product: { productName: 'Jam' } }] }), // 1-item, unpairable
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBasketCompositionReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalBaskets).toBe(2)
    expect(result.rows).toHaveLength(1) // only the 2-item basket pairs
  })

  it('sorts rows by basketCount descending', async () => {
    const db = makeDb({
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeBasketInvoice({ items: [{ productId: 'p1', product: { productName: 'Bread' } }, { productId: 'p2', product: { productName: 'Butter' } }] }),
          makeBasketInvoice({ items: [{ productId: 'p3', product: { productName: 'Milk' } }, { productId: 'p4', product: { productName: 'Cereal' } }] }),
          makeBasketInvoice({ items: [{ productId: 'p3', product: { productName: 'Milk' } }, { productId: 'p4', product: { productName: 'Cereal' } }] }),
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBasketCompositionReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows[0]).toMatchObject({ productAId: 'p3', basketCount: 2 })
    expect(result.rows[1]).toMatchObject({ productAId: 'p1', basketCount: 1 })
  })

  it('returns an honest empty result when nothing is in range', async () => {
    const db = makeDb({ invoice: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBasketCompositionReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalBaskets: 0, avgItemsPerBasket: 0, avgBasketValue: 0 })
  })

  it('queries with RETURN invoices excluded, not sign-corrected', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = makeDb({ invoice: { findMany } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateBasketCompositionReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'ACTIVE', invoiceType: { not: 'RETURN' } })
    }))
  })
})

// Phase 67 §9.1 — General: Category Mix. A single-period revenue+units
// breakdown by ProductCategory — distinct from Category Sell-Through's own
// month-by-month rate-vs-stock view tested above.
describe('reportService.generateCategoryMixReport', () => {
  function makeCategories() {
    return [{ id: 'c1', name: 'Beverages' }, { id: 'c2', name: 'Snacks' }]
  }
  function makeMixItem(overrides: Record<string, unknown> = {}) {
    return {
      quantity: 5, lineTotal: 500,
      invoice: { invoiceType: 'SALE' },
      product: { categoryId: 'c1' },
      ...overrides
    }
  }

  it('groups revenue and units by category', async () => {
    const db = makeDb({
      productCategory: { findMany: vi.fn().mockResolvedValue(makeCategories()) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([makeMixItem()]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategoryMixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ categoryId: 'c1', categoryName: 'Beverages', unitsSold: 5, revenue: 500, revenuePercent: 100 })
    expect(result.summary).toEqual({ totalRevenue: 500, categoryCount: 1 })
  })

  it('sign-corrects RETURN quantity but not lineTotal (lineTotal is already signed at the DB level)', async () => {
    const db = makeDb({
      productCategory: { findMany: vi.fn().mockResolvedValue(makeCategories()) },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMixItem({ quantity: 10, lineTotal: 1000, invoice: { invoiceType: 'SALE' } }),
          makeMixItem({ quantity: 2, lineTotal: -200, invoice: { invoiceType: 'RETURN' } }),
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategoryMixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows[0].unitsSold).toBe(8) // 10 - 2
    expect(result.rows[0].revenue).toBe(800) // 1000 + (-200), no extra sign applied
  })

  it('computes revenuePercent as each category share of total revenue, rounded to 1 decimal', async () => {
    const db = makeDb({
      productCategory: { findMany: vi.fn().mockResolvedValue(makeCategories()) },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMixItem({ quantity: 1, lineTotal: 300, product: { categoryId: 'c1' } }),
          makeMixItem({ quantity: 1, lineTotal: 700, product: { categoryId: 'c2' } }),
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategoryMixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const byId = Object.fromEntries(result.rows.map(r => [r.categoryId, r]))
    expect(byId.c1.revenuePercent).toBe(30)
    expect(byId.c2.revenuePercent).toBe(70)
  })

  it('sorts rows by revenue descending', async () => {
    const db = makeDb({
      productCategory: { findMany: vi.fn().mockResolvedValue(makeCategories()) },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMixItem({ lineTotal: 100, product: { categoryId: 'c1' } }),
          makeMixItem({ lineTotal: 900, product: { categoryId: 'c2' } }),
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategoryMixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows[0].categoryId).toBe('c2')
    expect(result.rows[1].categoryId).toBe('c1')
  })

  it('returns an honest empty result when there are no categories at all', async () => {
    const db = makeDb({
      productCategory: { findMany: vi.fn().mockResolvedValue([]) },
      invoiceItem: { findMany: vi.fn() }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategoryMixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalRevenue: 0, categoryCount: 0 })
  })

  it('returns revenuePercent 0 for every row when total revenue is zero (avoids division by zero)', async () => {
    const db = makeDb({
      productCategory: { findMany: vi.fn().mockResolvedValue(makeCategories()) },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMixItem({ quantity: 3, lineTotal: 300, product: { categoryId: 'c1' } }),
          makeMixItem({ quantity: 3, lineTotal: -300, invoice: { invoiceType: 'RETURN' }, product: { categoryId: 'c1' } }),
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategoryMixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalRevenue).toBe(0)
    expect(result.rows[0].revenuePercent).toBe(0)
  })

  it('excludes items whose product has no category assigned', async () => {
    const db = makeDb({
      productCategory: { findMany: vi.fn().mockResolvedValue(makeCategories()) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const findManySpy = db.invoiceItem.findMany as ReturnType<typeof vi.fn>
    await reportService.generateCategoryMixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(findManySpy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ product: { categoryId: { not: null } } })
    }))
  })

  it('only counts ACTIVE invoices within the date range', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = makeDb({
      productCategory: { findMany: vi.fn().mockResolvedValue(makeCategories()) },
      invoiceItem: { findMany }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateCategoryMixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ invoice: expect.objectContaining({ status: 'ACTIVE' }) })
    }))
  })

  it('rounds revenue to currency precision', async () => {
    const db = makeDb({
      productCategory: { findMany: vi.fn().mockResolvedValue(makeCategories()) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([makeMixItem({ lineTotal: 100.005 })]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCategoryMixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(Number.isInteger(result.rows[0].revenue * 100)).toBe(true)
  })
})

// Phase 67 §9.1 — Clothing item 5: Margin by Brand/Vendor Report, the
// vertical's 5th and final signature item. Structurally the same grouping
// shape as generateCategoryMixReport's own tests above, keyed by supplier
// instead of category, with COGS added via the real getProductCostsBatch()
// (valuation.service) rather than a static cost field.
describe('reportService.generateVendorMarginReport', () => {
  function makeSuppliers() {
    return [{ id: 's1', supplierName: 'Acme Apparel' }, { id: 's2', supplierName: 'Bright Threads' }]
  }
  function makeMarginItem(overrides: Record<string, unknown> = {}) {
    return {
      productId: 'p1', quantity: 5, lineTotal: 500,
      invoice: { invoiceType: 'SALE' },
      product: { defaultSupplierId: 's1' },
      ...overrides
    }
  }
  // costPrice 60, WEIGHTED_AVERAGE with no inventory row (falls back to
  // costPrice directly) — same simplification generateProfitAndLossReport's
  // own tests already lean on for getProductCostsBatch.
  function makeProducts() {
    return [{ id: 'p1', costPrice: 60, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]
  }

  it('groups revenue, COGS, and margin by vendor/supplier', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue(makeSuppliers()) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([makeMarginItem()]) },
      product: { findMany: vi.fn().mockResolvedValue(makeProducts()) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVendorMarginReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    // revenue 500, cogs = 5 * 60 = 300, margin = 200
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ supplierId: 's1', supplierName: 'Acme Apparel', revenue: 500, cogs: 300, margin: 200, marginPercent: 40 })
    expect(result.summary).toEqual({ totalRevenue: 500, totalCogs: 300, totalMargin: 200, vendorCount: 1 })
  })

  it('sign-corrects RETURN quantity for COGS but not lineTotal (already signed at the DB level)', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue(makeSuppliers()) },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMarginItem({ quantity: 10, lineTotal: 1000, invoice: { invoiceType: 'SALE' } }),
          makeMarginItem({ quantity: 2, lineTotal: -200, invoice: { invoiceType: 'RETURN' } }),
        ])
      },
      product: { findMany: vi.fn().mockResolvedValue(makeProducts()) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVendorMarginReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    // revenue: 1000 + (-200) = 800; cogs: (10 - 2) * 60 = 480
    expect(result.rows[0].revenue).toBe(800)
    expect(result.rows[0].cogs).toBe(480)
    expect(result.rows[0].margin).toBe(320)
  })

  it('sorts rows by margin descending', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue(makeSuppliers()) },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMarginItem({ productId: 'p1', lineTotal: 200, product: { defaultSupplierId: 's1' } }),
          makeMarginItem({ productId: 'p2', lineTotal: 900, product: { defaultSupplierId: 's2' } }),
        ])
      },
      product: { findMany: vi.fn().mockResolvedValue([...makeProducts(), { id: 'p2', costPrice: 10, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVendorMarginReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    // s1 margin: 200 - 5*60 = -100; s2 margin: 900 - 5*10 = 850 — s2 leads
    expect(result.rows[0].supplierId).toBe('s2')
    expect(result.rows[1].supplierId).toBe('s1')
  })

  it('can report a negative margin honestly for a loss-making vendor', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue(makeSuppliers()) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([makeMarginItem({ quantity: 5, lineTotal: 100 })]) },
      product: { findMany: vi.fn().mockResolvedValue(makeProducts()) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVendorMarginReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    // revenue 100, cogs 300 -> margin -200, marginPercent -200%
    expect(result.rows[0].margin).toBe(-200)
    expect(result.rows[0].marginPercent).toBe(-200)
  })

  it('returns an honest empty result when there are no suppliers at all', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue([]) },
      invoiceItem: { findMany: vi.fn() }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVendorMarginReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalRevenue: 0, totalCogs: 0, totalMargin: 0, vendorCount: 0 })
  })

  it('returns marginPercent 0 when revenue is zero (avoids division by zero)', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue(makeSuppliers()) },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMarginItem({ quantity: 3, lineTotal: 300 }),
          makeMarginItem({ quantity: 3, lineTotal: -300, invoice: { invoiceType: 'RETURN' } }),
        ])
      },
      product: { findMany: vi.fn().mockResolvedValue(makeProducts()) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVendorMarginReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalRevenue).toBe(0)
    expect(result.rows[0].marginPercent).toBe(0)
  })

  it('excludes items whose product has no vendor/supplier assigned', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue(makeSuppliers()) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const findManySpy = db.invoiceItem.findMany as ReturnType<typeof vi.fn>
    await reportService.generateVendorMarginReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(findManySpy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ product: { defaultSupplierId: { not: null } } })
    }))
  })

  it('only counts ACTIVE invoices within the date range', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue(makeSuppliers()) },
      invoiceItem: { findMany }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateVendorMarginReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ invoice: expect.objectContaining({ status: 'ACTIVE' }) })
    }))
  })
})

// Phase 67 §9.1 — Footwear item 2: Brand-Wise Margin & Return-Rate Report.
// Structurally similar to generateVendorMarginReport's own tests above, but
// units-sold/units-returned are tracked separately (not net-summed) so the
// return rate reflects the real numerator/denominator, not a masked net.
describe('reportService.generateBrandMarginReturnRateReport', () => {
  function makeSuppliers() {
    return [{ id: 's1', supplierName: 'Acme Footwear' }, { id: 's2', supplierName: 'Bright Soles' }]
  }
  function makeMarginItem(overrides: Record<string, unknown> = {}) {
    return {
      productId: 'p1', quantity: 5, lineTotal: 500,
      invoice: { invoiceType: 'SALE' },
      product: { defaultSupplierId: 's1' },
      ...overrides
    }
  }
  function makeProducts() {
    return [{ id: 'p1', costPrice: 60, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]
  }

  it('groups revenue, margin, units sold, units returned, and return rate by brand — tracked separately, not netted', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue(makeSuppliers()) },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMarginItem({ quantity: 10, lineTotal: 1000, invoice: { invoiceType: 'SALE' } }),
          makeMarginItem({ quantity: 2, lineTotal: -200, invoice: { invoiceType: 'RETURN' } }),
        ])
      },
      product: { findMany: vi.fn().mockResolvedValue(makeProducts()) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBrandMarginReturnRateReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    // revenue: 1000 + (-200) = 800; cogs: (10 - 2) * 60 = 480; margin: 320
    expect(result.rows[0]).toMatchObject({
      supplierId: 's1', supplierName: 'Acme Footwear',
      revenue: 800, cogs: 480, margin: 320,
      unitsSold: 10, unitsReturned: 2,
      returnRatePercent: 20 // 2/10 * 100
    })
  })

  it('computes overall return rate across all brands combined', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue(makeSuppliers()) },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMarginItem({ productId: 'p1', quantity: 20, lineTotal: 2000, invoice: { invoiceType: 'SALE' }, product: { defaultSupplierId: 's1' } }),
          makeMarginItem({ productId: 'p1', quantity: 4, lineTotal: -400, invoice: { invoiceType: 'RETURN' }, product: { defaultSupplierId: 's1' } }),
          makeMarginItem({ productId: 'p2', quantity: 10, lineTotal: 1000, invoice: { invoiceType: 'SALE' }, product: { defaultSupplierId: 's2' } }),
        ])
      },
      product: { findMany: vi.fn().mockResolvedValue([...makeProducts(), { id: 'p2', costPrice: 10, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBrandMarginReturnRateReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    // total sold 30, total returned 4 -> 13.3%
    expect(result.summary.overallReturnRatePercent).toBeCloseTo(13.3, 1)
  })

  it('returns a 0% return rate for a brand with no units sold at all yet (avoids division by zero)', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue(makeSuppliers()) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
      product: { findMany: vi.fn().mockResolvedValue(makeProducts()) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBrandMarginReturnRateReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalRevenue: 0, totalMargin: 0, overallReturnRatePercent: 0, vendorCount: 0 })
  })

  it('sorts rows by margin descending, same convention as generateVendorMarginReport', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue(makeSuppliers()) },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMarginItem({ productId: 'p1', lineTotal: 200, product: { defaultSupplierId: 's1' } }),
          makeMarginItem({ productId: 'p2', lineTotal: 900, product: { defaultSupplierId: 's2' } }),
        ])
      },
      product: { findMany: vi.fn().mockResolvedValue([...makeProducts(), { id: 'p2', costPrice: 10, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBrandMarginReturnRateReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows[0].supplierId).toBe('s2')
    expect(result.rows[1].supplierId).toBe('s1')
  })

  it('returns an honest empty result when there are no suppliers at all', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue([]) },
      invoiceItem: { findMany: vi.fn() }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBrandMarginReturnRateReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalRevenue: 0, totalMargin: 0, overallReturnRatePercent: 0, vendorCount: 0 })
  })

  it('excludes items whose product has no vendor/supplier assigned', async () => {
    const db = makeDb({
      supplier: { findMany: vi.fn().mockResolvedValue(makeSuppliers()) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const findManySpy = db.invoiceItem.findMany as ReturnType<typeof vi.fn>
    await reportService.generateBrandMarginReturnRateReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(findManySpy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ product: { defaultSupplierId: { not: null } } })
    }))
  })
})

// Phase 67 §9.1 — Hardware: Fast-Mover vs. Slow-Mover Matrix. Quadrant split
// by the MEDIAN of each axis, computed only over products that actually sold
// — not a fixed threshold, since that would be meaningless across
// differently-sized stores.
describe('reportService.generateFastSlowMoverMatrixReport', () => {
  function makeMoverItem(overrides: Record<string, unknown> = {}) {
    return {
      productId: 'p1', quantity: 10,
      invoice: { invoiceType: 'SALE' },
      product: { productName: 'Hammer', sku: 'HM-1', sellingPrice: 100 },
      ...overrides
    }
  }

  it('computes velocity as quantity sold divided by days in range', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([makeMoverItem({ quantity: 30 })]) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', costPrice: 60, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'p1', averageCost: 60, quantity: 50 }]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 30 days inclusive (Jan 1 - Jan 30) -> 30 units / 30 days = 1/day
    const result = await reportService.generateFastSlowMoverMatrixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-30' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].velocity).toBe(1)
    expect(result.rows[0].marginPercent).toBe(40) // (100-60)/100 * 100
  })

  it('sign-corrects RETURN quantities the same way every other report does', async () => {
    const db = makeDb({
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMoverItem({ quantity: 10, invoice: { invoiceType: 'SALE' } }),
          makeMoverItem({ quantity: 4, invoice: { invoiceType: 'RETURN' } })
        ])
      },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', costPrice: 60, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'p1', averageCost: 60, quantity: 50 }]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFastSlowMoverMatrixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows[0].quantitySold).toBe(6) // 10 - 4
  })

  it('excludes a product whose net quantity sold is zero or negative after returns', async () => {
    const db = makeDb({
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMoverItem({ quantity: 3, invoice: { invoiceType: 'SALE' } }),
          makeMoverItem({ quantity: 3, invoice: { invoiceType: 'RETURN' } })
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFastSlowMoverMatrixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toEqual([])
  })

  it('splits products into quadrants by the median of velocity and margin, not a fixed threshold', async () => {
    const db = makeDb({
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          makeMoverItem({ productId: 'fast-high', quantity: 100, product: { productName: 'Fast High', sku: null, sellingPrice: 100 } }),
          makeMoverItem({ productId: 'fast-low', quantity: 90, product: { productName: 'Fast Low', sku: null, sellingPrice: 100 } }),
          makeMoverItem({ productId: 'slow-high', quantity: 10, product: { productName: 'Slow High', sku: null, sellingPrice: 100 } }),
          makeMoverItem({ productId: 'slow-low', quantity: 5, product: { productName: 'Slow Low', sku: null, sellingPrice: 100 } })
        ])
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'fast-high', costPrice: 20, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }, // 80% margin
          { id: 'fast-low', costPrice: 90, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }, // 10% margin
          { id: 'slow-high', costPrice: 20, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }, // 80% margin
          { id: 'slow-low', costPrice: 90, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null } // 10% margin
        ])
      },
      inventory: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFastSlowMoverMatrixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const byId = new Map(result.rows.map(r => [r.productId, r]))
    expect(byId.get('fast-high')!.quadrant).toBe('FAST_HIGH_MARGIN')
    expect(byId.get('fast-low')!.quadrant).toBe('FAST_LOW_MARGIN')
    expect(byId.get('slow-high')!.quadrant).toBe('SLOW_HIGH_MARGIN')
    expect(byId.get('slow-low')!.quadrant).toBe('SLOW_LOW_MARGIN')
  })

  it('returns an honest empty result when nothing sold in range', async () => {
    const db = makeDb({ invoiceItem: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFastSlowMoverMatrixReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.rows).toEqual([])
    expect(result.velocityMedian).toBe(0)
    expect(result.marginMedian).toBe(0)
  })
})

// Phase 67 §9.1 — Hardware: smart carton-break reorder trigger's other half —
// reframing the flat piece count into carton terms for display. Floor
// division (this is "how much do I actually have," the opposite rounding
// direction from purchase-order.service.ts's own roundUpToCartonMultiple,
// which answers "how much should I order").
function makeInventoryProduct(overrides: Record<string, unknown> = {}) {
  return {
    sku: 'SKU-1', productName: 'Screws (Box of 24)', productType: 'STANDARD',
    costPrice: 100, sellingPrice: 150, sellByWeight: false, weightUnit: null, unit: 'PCS',
    sellByPack: false, unitsPerPack: null,
    category: { name: 'Fasteners' },
    inventory: { quantity: 100, reorderLevel: 20, averageCost: 100 },
    ...overrides
  }
}

describe('reportService.generateInventoryReport — carton breakdown', () => {
  it('leaves cartonBreakdown null for a product not sold by pack', async () => {
    const db = makeDb({ product: { findMany: vi.fn().mockResolvedValue([makeInventoryProduct()]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateInventoryReport()

    expect(result.rows[0].cartonBreakdown).toBeNull()
  })

  it('computes fullCartons/loosePieces via floor division for a sellByPack product', async () => {
    const db = makeDb({
      product: { findMany: vi.fn().mockResolvedValue([
        makeInventoryProduct({ sellByPack: true, unitsPerPack: 24, inventory: { quantity: 100, reorderLevel: 20, averageCost: 100 } })
      ]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateInventoryReport()

    expect(result.rows[0].cartonBreakdown).toEqual({ unitsPerPack: 24, fullCartons: 4, loosePieces: 4 }) // 100 = 4*24 + 4
  })

  it('leaves cartonBreakdown null when sellByPack is true but unitsPerPack is not set (defensive)', async () => {
    const db = makeDb({
      product: { findMany: vi.fn().mockResolvedValue([makeInventoryProduct({ sellByPack: true, unitsPerPack: null })]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateInventoryReport()

    expect(result.rows[0].cartonBreakdown).toBeNull()
  })
})

describe('reportService.generateCashBookReport', () => {
  it('computes an opening balance from movements strictly before dateFrom, then a running balance across in-range entries', async () => {
    const db = makeDb({
      payment: { findMany: vi.fn().mockResolvedValue([
        { paymentDate: new Date('2025-12-20'), amount: 1000, paymentMethod: 'CASH', referenceNumber: null, invoice: { invoiceNumber: 'INV-1' } }, // before range -> opening balance
        { paymentDate: new Date('2026-01-10'), amount: 500, paymentMethod: 'UPI', referenceNumber: null, invoice: { invoiceNumber: 'INV-2' } }, // in range
      ]) },
      expense: { findMany: vi.fn().mockResolvedValue([
        { expenseDate: new Date('2025-12-25'), amount: 200, paymentMethod: 'CASH', expenseName: 'Rent' }, // before range
        { expenseDate: new Date('2026-01-15'), amount: 100, paymentMethod: 'CASH', expenseName: 'Utilities' }, // in range
      ]) },
      supplierLedger: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashBookReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    // Opening balance = 1000 (payment before range) - 200 (expense before range) = 800
    expect(result.openingBalance).toBe(800)
    expect(result.entries).toHaveLength(2)
    expect(result.entries[0].type).toBe('IN')
    expect(result.entries[0].runningBalance).toBe(1300) // 800 + 500
    expect(result.entries[1].type).toBe('OUT')
    expect(result.entries[1].runningBalance).toBe(1200) // 1300 - 100
    expect(result.totalIn).toBe(500)
    expect(result.totalOut).toBe(100)
    expect(result.closingBalance).toBe(1200) // openingBalance + totalIn - totalOut
  })

  it('includes supplier payments (SupplierLedger PAYMENT entries) as cash-out, but not PURCHASE_ORDER entries which are only an obligation, not cash movement', async () => {
    const db = makeDb({
      payment: { findMany: vi.fn().mockResolvedValue([]) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      supplierLedger: {
        findMany: vi.fn().mockImplementation((args: { where?: { referenceType?: string } }) => {
          // Real Prisma would filter server-side; the mock simulates that by
          // honoring the where.referenceType filter the service passes.
          const all = [
            { createdAt: new Date('2026-01-05'), creditAmount: 300, referenceType: 'PAYMENT', supplier: { supplierName: 'Acme Supplies' } },
          ]
          return Promise.resolve(args?.where?.referenceType === 'PAYMENT' ? all : [])
        }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashBookReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].type).toBe('OUT')
    expect(result.entries[0].paymentMethod).toBe('SUPPLIER_PAYMENT')
    expect(result.entries[0].amount).toBe(300)
    expect(result.closingBalance).toBe(-300)
  })

  it('filters entries by paymentMethod when provided, without affecting the opening balance calculation for a different method', async () => {
    const db = makeDb({
      payment: { findMany: vi.fn().mockResolvedValue([
        { paymentDate: new Date('2026-01-05'), amount: 500, paymentMethod: 'CASH', referenceNumber: null, invoice: { invoiceNumber: 'INV-1' } },
        { paymentDate: new Date('2026-01-06'), amount: 700, paymentMethod: 'UPI', referenceNumber: null, invoice: { invoiceNumber: 'INV-2' } },
      ]) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashBookReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31', paymentMethod: 'CASH' })

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].amount).toBe(500)
  })
})

describe('reportService.generateTrialBalanceReport', () => {
  // Phase 62 rewrite: reads real ChartOfAccounts + JournalEntryLine rows
  // posted by the GL auto-posting services, instead of synthesizing figures
  // from invoices/expenses/customer balances. See report.service.ts's own
  // comment above the function for the full reasoning.

  const CASH = { id: 'coa-cash', accountCode: '1000', accountName: 'Cash & Bank', accountType: 'ASSET', isActive: true }
  const AR = { id: 'coa-ar', accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'ASSET', isActive: true }
  const AP = { id: 'coa-ap', accountCode: '2000', accountName: 'Accounts Payable', accountType: 'LIABILITY', isActive: true }
  const REVENUE = { id: 'coa-rev', accountCode: '4000', accountName: 'Sales Revenue', accountType: 'INCOME', isActive: true }
  const UNUSED = { id: 'coa-unused', accountCode: '6100', accountName: 'Depreciation Expense', accountType: 'EXPENSE', isActive: true }

  it('sums real posted JournalEntryLine rows per account and balances by construction', async () => {
    const db = makeDb({
      chartOfAccounts: { findMany: vi.fn().mockResolvedValue([CASH, AR, AP, REVENUE, UNUSED]) },
      journalEntryLine: { findMany: vi.fn().mockResolvedValue([
        // Invoice: Debit Cash 1180, Credit Sales Revenue 1000, Credit AP... no — use a
        // realistic pair: Debit Cash 1180 / Credit Sales Revenue 1180 (tax-inclusive kept simple here)
        { accountId: CASH.id, debitAmount: 1180, creditAmount: 0 },
        { accountId: REVENUE.id, debitAmount: 0, creditAmount: 1180 },
        // Bill: Debit... skipped; separate AP movement instead — Credit AP 500, Debit Cash side already covered
        { accountId: AP.id, debitAmount: 0, creditAmount: 500 },
        { accountId: AR.id, debitAmount: 500, creditAmount: 0 },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTrialBalanceReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.balanced).toBe(true)
    expect(result.totalDebit).toBe(result.totalCredit)

    const byAccount = Object.fromEntries(result.rows.map(r => [r.account, r]))
    expect(byAccount['1000 — Cash & Bank'].debit).toBe(1180)
    expect(byAccount['4000 — Sales Revenue'].credit).toBe(1180)
    expect(byAccount['2000 — Accounts Payable'].credit).toBe(500)
    expect(byAccount['1100 — Accounts Receivable'].debit).toBe(500)
    // UNUSED had no postings at all — omitted, not shown as an all-zero row.
    expect(byAccount['6100 — Depreciation Expense']).toBeUndefined()
  })

  it('produces an empty, balanced trial balance when the GL has no postings at all', async () => {
    const db = makeDb({
      chartOfAccounts: { findMany: vi.fn().mockResolvedValue([CASH, AR, AP, REVENUE]) },
      journalEntryLine: { findMany: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTrialBalanceReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.rows).toHaveLength(0)
    expect(result.balanced).toBe(true)
    expect(result.totalDebit).toBe(0)
    expect(result.totalCredit).toBe(0)
  })

  it('puts an overdrawn (net-credit) asset account on the credit side, never a negative number in either column, and still balances', async () => {
    const db = makeDb({
      chartOfAccounts: { findMany: vi.fn().mockResolvedValue([CASH, REVENUE]) },
      journalEntryLine: { findMany: vi.fn().mockResolvedValue([
        // More paid out of Cash than ever came in: Debit Cash 1000, Credit Cash 5000 -> net -4000
        { accountId: CASH.id, debitAmount: 1000, creditAmount: 0 },
        { accountId: CASH.id, debitAmount: 0, creditAmount: 5000 },
        { accountId: REVENUE.id, debitAmount: 4000, creditAmount: 0 },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTrialBalanceReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    const cashRow = result.rows.find(r => r.account === '1000 — Cash & Bank')!
    expect(cashRow.debit).toBe(0)
    expect(cashRow.credit).toBe(4000) // -(-4000), shown positive on the correct side
    for (const row of result.rows) {
      expect(row.debit).toBeGreaterThanOrEqual(0)
      expect(row.credit).toBeGreaterThanOrEqual(0)
    }
    expect(result.balanced).toBe(true)
    expect(result.totalDebit).toBe(result.totalCredit)
  })

  it('is cumulative as-of dateTo — includes postings before dateFrom, excludes postings after dateTo', async () => {
    const db = makeDb({
      chartOfAccounts: { findMany: vi.fn().mockResolvedValue([CASH, REVENUE]) },
      journalEntryLine: {
        findMany: vi.fn(async ({ where }: { where: { journalEntry: { entryDate: { lte: Date } } } }) => {
          const cutoff = where.journalEntry.entryDate.lte
          const allLines = [
            { entryDate: new Date('2025-06-01'), accountId: CASH.id, debitAmount: 300, creditAmount: 0 },
            { entryDate: new Date('2025-06-01'), accountId: REVENUE.id, debitAmount: 0, creditAmount: 300 },
            { entryDate: new Date('2026-02-15'), accountId: CASH.id, debitAmount: 9999, creditAmount: 0 }, // after dateTo
            { entryDate: new Date('2026-02-15'), accountId: REVENUE.id, debitAmount: 0, creditAmount: 9999 },
          ]
          return allLines.filter((l) => l.entryDate.getTime() <= cutoff.getTime())
        })
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTrialBalanceReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    const byAccount = Object.fromEntries(result.rows.map(r => [r.account, r]))
    expect(byAccount['1000 — Cash & Bank'].debit).toBe(300) // the pre-dateFrom posting still counts
    expect(byAccount['4000 — Sales Revenue'].credit).toBe(300) // the post-dateTo posting is excluded
    expect(result.balanced).toBe(true)
  })
})

// ─── Cost Centre Treemap P&L (Phase 65) ────────────────────────────────────

describe('reportService.generateCostCentreTreemapReport', () => {
  const REVENUE = { accountType: 'INCOME' }
  const EXPENSE = { accountType: 'EXPENSE' }
  const ASSET = { accountType: 'ASSET' }

  it('computes revenue/expense/margin per cost centre from real tagged JournalEntryLine rows — unlike Trial Balance, this is a PERIOD sum (bounded by dateFrom too), not cumulative-as-of', async () => {
    const db = makeDb({
      costCentre: { findMany: vi.fn().mockResolvedValue([{ id: 'cc-1', name: 'Downtown Branch' }, { id: 'cc-2', name: 'Uptown Branch' }]) },
      journalEntryLine: { findMany: vi.fn().mockResolvedValue([
        { costCentreId: 'cc-1', debitAmount: 0, creditAmount: 5000, account: REVENUE },
        { costCentreId: 'cc-1', debitAmount: 2000, creditAmount: 0, account: EXPENSE },
        { costCentreId: 'cc-2', debitAmount: 0, creditAmount: 3000, account: REVENUE },
        { costCentreId: 'cc-2', debitAmount: 4000, creditAmount: 0, account: EXPENSE }, // running at a loss
        { costCentreId: 'cc-1', debitAmount: 1000, creditAmount: 0, account: ASSET }, // non-P&L line, ignored
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCostCentreTreemapReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    const byId = Object.fromEntries(result.rows.map(r => [r.costCentreId, r]))
    expect(byId['cc-1']).toMatchObject({ costCentreName: 'Downtown Branch', revenue: 5000, expense: 2000, margin: 3000 })
    expect(byId['cc-2']).toMatchObject({ costCentreName: 'Uptown Branch', revenue: 3000, expense: 4000, margin: -1000 })
  })

  it('buckets untagged revenue/expense separately instead of silently dropping them', async () => {
    const db = makeDb({
      costCentre: { findMany: vi.fn().mockResolvedValue([{ id: 'cc-1', name: 'Downtown Branch' }]) },
      journalEntryLine: { findMany: vi.fn().mockResolvedValue([
        { costCentreId: 'cc-1', debitAmount: 0, creditAmount: 1000, account: REVENUE },
        { costCentreId: null, debitAmount: 0, creditAmount: 500, account: REVENUE },
        { costCentreId: null, debitAmount: 200, creditAmount: 0, account: EXPENSE },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCostCentreTreemapReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.untaggedRevenue).toBe(500)
    expect(result.untaggedExpense).toBe(200)
    expect(result.rows).toHaveLength(1)
  })

  it('omits a cost centre nobody has tagged anything against yet, rather than padding with a zero rectangle', async () => {
    const db = makeDb({
      costCentre: { findMany: vi.fn().mockResolvedValue([{ id: 'cc-1', name: 'Downtown Branch' }, { id: 'cc-empty', name: 'Never Used' }]) },
      journalEntryLine: { findMany: vi.fn().mockResolvedValue([
        { costCentreId: 'cc-1', debitAmount: 0, creditAmount: 1000, account: REVENUE },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCostCentreTreemapReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.rows.map(r => r.costCentreId)).toEqual(['cc-1'])
  })

  it('returns zero rows for a fresh install with no cost centres and no GL postings', async () => {
    const db = makeDb({ costCentre: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCostCentreTreemapReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.rows).toHaveLength(0)
    expect(result.untaggedRevenue).toBe(0)
    expect(result.untaggedExpense).toBe(0)
  })
})

// ─── Budget vs. Actual (Phase 65) ──────────────────────────────────────────

describe('reportService.generateBudgetVsActualReport', () => {
  const REVENUE = { accountType: 'INCOME' }
  const EXPENSE = { accountType: 'EXPENSE' }

  it('computes actual spend for a whole-cost-centre budget (no accountId) by summing all EXPENSE lines in scope', async () => {
    const db = makeDb({
      budget: { findMany: vi.fn().mockResolvedValue([
        { id: 'bud-1', costCentreId: 'cc-1', accountId: null, periodYear: 2026, periodMonth: 8, amount: 50000, costCentre: { id: 'cc-1', name: 'Marketing' }, account: null },
      ]) },
      journalEntryLine: { findMany: vi.fn().mockResolvedValue([
        { costCentreId: 'cc-1', accountId: 'coa-6000', debitAmount: 62000, creditAmount: 0, account: EXPENSE },
        { costCentreId: 'cc-1', accountId: 'coa-4000', debitAmount: 0, creditAmount: 10000, account: REVENUE }, // revenue on this centre, ignored for a whole-centre spend budget
        { costCentreId: 'cc-2', accountId: 'coa-6000', debitAmount: 5000, creditAmount: 0, account: EXPENSE }, // different cost centre, out of scope
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBudgetVsActualReport({ periodYear: 2026, periodMonth: 8 })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ budgeted: 50000, actual: 62000, variance: -12000 })
  })

  it('computes actual for a specific-account budget by matching both costCentreId and accountId', async () => {
    const db = makeDb({
      budget: { findMany: vi.fn().mockResolvedValue([
        { id: 'bud-1', costCentreId: 'cc-1', accountId: 'coa-6000', periodYear: 2026, periodMonth: 8, amount: 20000, costCentre: { id: 'cc-1', name: 'Marketing' }, account: { id: 'coa-6000', accountName: 'Operating Expenses', accountType: 'EXPENSE' } },
      ]) },
      journalEntryLine: { findMany: vi.fn().mockResolvedValue([
        { costCentreId: 'cc-1', accountId: 'coa-6000', debitAmount: 15000, creditAmount: 0, account: EXPENSE },
        { costCentreId: 'cc-1', accountId: 'coa-6100', debitAmount: 9000, creditAmount: 0, account: EXPENSE }, // different account, out of scope
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBudgetVsActualReport({ periodYear: 2026, periodMonth: 8 })

    expect(result.rows[0]).toMatchObject({ budgeted: 20000, actual: 15000, variance: 5000 })
  })

  it('honestly reports ₹0 actual for a budget whose scope has never had a single tagged transaction', async () => {
    const db = makeDb({
      budget: { findMany: vi.fn().mockResolvedValue([
        { id: 'bud-1', costCentreId: 'cc-never-used', accountId: null, periodYear: 2026, periodMonth: 8, amount: 10000, costCentre: { id: 'cc-never-used', name: 'Unused' }, account: null },
      ]) },
      journalEntryLine: { findMany: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBudgetVsActualReport({ periodYear: 2026, periodMonth: 8 })

    expect(result.rows[0]).toMatchObject({ budgeted: 10000, actual: 0, variance: 10000 })
  })

  it('computes a company-wide budget (no costCentreId, no accountId) across all EXPENSE lines regardless of cost centre', async () => {
    const db = makeDb({
      budget: { findMany: vi.fn().mockResolvedValue([
        { id: 'bud-1', costCentreId: null, accountId: null, periodYear: 2026, periodMonth: 8, amount: 100000, costCentre: null, account: null },
      ]) },
      journalEntryLine: { findMany: vi.fn().mockResolvedValue([
        { costCentreId: 'cc-1', accountId: 'coa-6000', debitAmount: 40000, creditAmount: 0, account: EXPENSE },
        { costCentreId: 'cc-2', accountId: 'coa-6000', debitAmount: 30000, creditAmount: 0, account: EXPENSE },
        { costCentreId: null, accountId: 'coa-6000', debitAmount: 5000, creditAmount: 0, account: EXPENSE },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBudgetVsActualReport({ periodYear: 2026, periodMonth: 8 })

    expect(result.rows[0].actual).toBe(75000)
  })

  it('returns zero rows for a period with no budgets set, without querying JournalEntryLine at all', async () => {
    const db = makeDb({ budget: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateBudgetVsActualReport({ periodYear: 2026, periodMonth: 8 })

    expect(result.rows).toHaveLength(0)
    expect(db.journalEntryLine.findMany).not.toHaveBeenCalled()
  })
})

// ─── Statutory (PF/ESI/PT) Summary Report (Phase 65) ───────────────────────

describe('reportService.generateStatutoryComplianceSummaryReport', () => {
  it('sums deduction amounts across all employees for the period, grouped by deduction name', async () => {
    const db = makeDb({
      salaryPayment: { findMany: vi.fn().mockResolvedValue([
        { deductions: JSON.stringify([{ name: 'PF', amount: 2400 }, { name: 'ESI', amount: 150 }]) },
        { deductions: JSON.stringify([{ name: 'PF', amount: 1800 }]) },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateStatutoryComplianceSummaryReport({ periodYear: 2026, periodMonth: 8 })

    const byName = Object.fromEntries(result.rows.map(r => [r.name, r]))
    expect(byName.PF).toMatchObject({ totalAmount: 4200, employeeCount: 2 })
    expect(byName.ESI).toMatchObject({ totalAmount: 150, employeeCount: 1 })
    expect(result.totalEmployees).toBe(2)
  })

  it('ignores a malformed/legacy deductions field instead of throwing', async () => {
    const db = makeDb({
      salaryPayment: { findMany: vi.fn().mockResolvedValue([
        { deductions: 'not valid json' },
        { deductions: JSON.stringify([{ name: 'PF', amount: 1000 }]) },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateStatutoryComplianceSummaryReport({ periodYear: 2026, periodMonth: 8 })

    expect(result.rows).toEqual([{ name: 'PF', totalAmount: 1000, employeeCount: 1 }])
  })

  it('returns zero rows when no payroll exists for the period', async () => {
    const db = makeDb({ salaryPayment: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateStatutoryComplianceSummaryReport({ periodYear: 2026, periodMonth: 8 })

    expect(result.rows).toHaveLength(0)
    expect(result.totalEmployees).toBe(0)
  })

  it('sorts rows by total amount descending', async () => {
    const db = makeDb({
      salaryPayment: { findMany: vi.fn().mockResolvedValue([
        { deductions: JSON.stringify([{ name: 'Professional Tax', amount: 200 }, { name: 'PF', amount: 5000 }]) },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateStatutoryComplianceSummaryReport({ periodYear: 2026, periodMonth: 8 })

    expect(result.rows.map(r => r.name)).toEqual(['PF', 'Professional Tax'])
  })
})

// ─── Cash-Flow Projection (Phase 65) ───────────────────────────────────────

// Phase 67 §9.1 — General: Combined Cash Position Trend. Reads real
// ChartOfAccounts + JournalEntryLine rows against the single "Cash & Bank"
// (accountCode '1000') account — same GL-based approach generateTrialBalanceReport
// established above, not a synthesized figure like generateCashBookReport.
describe('reportService.generateCashPositionTrendReport', () => {
  const CASH = { id: 'coa-cash', accountCode: '1000', accountName: 'Cash & Bank' }

  function mockGl(priorLines: { debitAmount: number; creditAmount: number }[], rangeLinesByDate: Record<string, { debitAmount: number; creditAmount: number }[]>) {
    const findMany = vi.fn(async ({ where }: { where: { journalEntry: { entryDate: Record<string, Date> } } }) => {
      const cond = where.journalEntry.entryDate
      if ('lt' in cond) return priorLines
      // range query: gte/lte — flatten the by-date map with a fabricated entryDate
      const out: { debitAmount: number; creditAmount: number; journalEntry: { entryDate: Date } }[] = []
      for (const [date, lines] of Object.entries(rangeLinesByDate)) {
        for (const l of lines) out.push({ ...l, journalEntry: { entryDate: new Date(`${date}T12:00:00`) } })
      }
      return out
    })
    return makeDb({
      chartOfAccounts: { findFirst: vi.fn().mockResolvedValue(CASH) },
      journalEntryLine: { findMany }
    })
  }

  it('computes opening balance from prior lines and a running daily balance across the range', async () => {
    const db = mockGl(
      [{ debitAmount: 1000, creditAmount: 0 }], // opening = 1000
      {
        '2026-01-01': [{ debitAmount: 500, creditAmount: 0 }], // +500 -> 1500
        '2026-01-02': [{ debitAmount: 0, creditAmount: 200 }], // -200 -> 1300
      }
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashPositionTrendReport({ dateFrom: '2026-01-01', dateTo: '2026-01-02' })

    expect(result.openingBalance).toBe(1000)
    expect(result.points).toEqual([
      { date: '2026-01-01', balance: 1500 },
      { date: '2026-01-02', balance: 1300 },
    ])
    expect(result.closingBalance).toBe(1300)
    expect(result.netChange).toBe(300) // 1300 - 1000
  })

  it('excludes lines dated on or after dateFrom from the opening balance', async () => {
    const findMany = vi.fn(async ({ where }: { where: { journalEntry: { entryDate: Record<string, Date> } } }) => {
      const cond = where.journalEntry.entryDate
      if ('lt' in cond) {
        // toDate() parses "YYYY-MM-DD" at LOCAL midnight, not UTC — assert
        // via getters (timezone-agnostic) rather than a hardcoded UTC ISO
        // string, same gotcha this codebase's own report.service.ts comment
        // above toDate() documents.
        expect(cond.lt.getFullYear()).toBe(2026); expect(cond.lt.getMonth()).toBe(0); expect(cond.lt.getDate()).toBe(1); expect(cond.lt.getHours()).toBe(0)
        return [{ debitAmount: 700, creditAmount: 0 }]
      }
      return []
    })
    const db = makeDb({ chartOfAccounts: { findFirst: vi.fn().mockResolvedValue(CASH) }, journalEntryLine: { findMany } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashPositionTrendReport({ dateFrom: '2026-01-01', dateTo: '2026-01-01' })

    expect(result.openingBalance).toBe(700)
    expect(result.points[0].balance).toBe(700)
  })

  it('produces a flat line at the opening balance when nothing moved during the range', async () => {
    const db = mockGl([{ debitAmount: 500, creditAmount: 0 }], {})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashPositionTrendReport({ dateFrom: '2026-01-01', dateTo: '2026-01-03' })

    expect(result.points).toEqual([
      { date: '2026-01-01', balance: 500 },
      { date: '2026-01-02', balance: 500 },
      { date: '2026-01-03', balance: 500 },
    ])
    expect(result.netChange).toBe(0)
  })

  it('produces exactly one point per day in the range, inclusive of both ends', async () => {
    const db = mockGl([], {})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashPositionTrendReport({ dateFrom: '2026-01-01', dateTo: '2026-01-05' })

    expect(result.points).toHaveLength(5)
    expect(result.points.map(p => p.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'])
  })

  it('sums multiple same-day lines into a single net movement for that day', async () => {
    const db = mockGl([], {
      '2026-01-01': [
        { debitAmount: 1000, creditAmount: 0 },
        { debitAmount: 0, creditAmount: 300 },
        { debitAmount: 50, creditAmount: 0 },
      ]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashPositionTrendReport({ dateFrom: '2026-01-01', dateTo: '2026-01-01' })

    expect(result.points[0].balance).toBe(750) // 1000 - 300 + 50
  })

  it('allows a negative running balance (overdrawn) without flooring at zero', async () => {
    const db = mockGl([], { '2026-01-01': [{ debitAmount: 0, creditAmount: 1000 }] })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashPositionTrendReport({ dateFrom: '2026-01-01', dateTo: '2026-01-01' })

    expect(result.points[0].balance).toBe(-1000)
  })

  it('returns an honest empty result when no "Cash & Bank" account exists at all', async () => {
    const db = makeDb({ chartOfAccounts: { findFirst: vi.fn().mockResolvedValue(null) }, journalEntryLine: { findMany: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashPositionTrendReport({ dateFrom: '2026-01-01', dateTo: '2026-01-01' })

    expect(result.points).toEqual([])
    expect(result.openingBalance).toBe(0)
    expect(result.closingBalance).toBe(0)
    expect(result.netChange).toBe(0)
  })

  it('rounds balances to currency precision', async () => {
    const db = mockGl([{ debitAmount: 100.005, creditAmount: 0 }], {})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashPositionTrendReport({ dateFrom: '2026-01-01', dateTo: '2026-01-01' })

    expect(Number.isInteger(result.points[0].balance * 100)).toBe(true)
  })
})

describe('reportService.generateCashFlowProjection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 13)) // 2026-08-13, a Thursday
  })
  afterEach(() => vi.useRealTimers())

  it('produces one bucket per day across daysBack + today + daysForward, with actual/projected only on the correct side', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      bill: { findMany: vi.fn().mockResolvedValue([]) },
      supplierPayment: { findMany: vi.fn().mockResolvedValue([]) },
      recurringProfile: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashFlowProjection({ daysBack: 5, daysForward: 5 })

    expect(result.days).toHaveLength(11)
    expect(result.asOf).toBe('2026-08-13')
    const past = result.days.find(d => d.date === '2026-08-10')!
    expect(past.actualNet).not.toBeNull()
    expect(past.projectedNet).toBeNull()
    const future = result.days.find(d => d.date === '2026-08-16')!
    expect(future.projectedNet).not.toBeNull()
    expect(future.actualNet).toBeNull()
    const seam = result.days.find(d => d.date === '2026-08-13')!
    expect(seam.actualNet).not.toBeNull()
    expect(seam.projectedNet).not.toBeNull()
  })

  it('nets real Payment (in) against Expense and SupplierPayment (out) per day for actuals', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      bill: { findMany: vi.fn().mockResolvedValue([]) },
      payment: { findMany: vi.fn().mockResolvedValue([{ amount: 10000, paymentDate: new Date(2026, 7, 12) }]) },
      expense: { findMany: vi.fn().mockResolvedValue([{ amount: 3000, expenseDate: new Date(2026, 7, 12) }]) },
      supplierPayment: { findMany: vi.fn().mockResolvedValue([{ amount: 2000, paymentDate: new Date(2026, 7, 12) }]) },
      recurringProfile: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashFlowProjection({ daysBack: 5, daysForward: 5 })

    const day = result.days.find(d => d.date === '2026-08-12')!
    expect(day.actualNet).toBe(5000)
  })

  it('adds an open Invoice balance to its dueDate bucket and subtracts an open Bill balance from its own', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([{ balanceAmount: 8000, dueDate: new Date(2026, 7, 18) }]) },
      bill: { findMany: vi.fn().mockResolvedValue([{ balanceAmount: 3000, dueDate: new Date(2026, 7, 18) }]) },
      supplierPayment: { findMany: vi.fn().mockResolvedValue([]) },
      recurringProfile: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashFlowProjection({ daysBack: 5, daysForward: 10 })

    const day = result.days.find(d => d.date === '2026-08-18')!
    expect(day.projectedNet).toBe(5000)
  })

  it('forecasts an active EXPENSE recurring profile on its threshold day within the window', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      bill: { findMany: vi.fn().mockResolvedValue([]) },
      supplierPayment: { findMany: vi.fn().mockResolvedValue([]) },
      recurringProfile: { findMany: vi.fn().mockResolvedValue([{
        cadence: 'MONTHLY', dayOfPeriod: 20, startDate: new Date(2026, 0, 1), endDate: null,
        lastGeneratedPeriod: null, payloadJson: JSON.stringify({ amount: 5000, expenseName: 'Rent' })
      }]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashFlowProjection({ daysBack: 5, daysForward: 10 })

    const day = result.days.find(d => d.date === '2026-08-20')!
    expect(day.projectedNet).toBe(-5000)
  })

  it('skips a recurring profile whose current period has already been generated', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      bill: { findMany: vi.fn().mockResolvedValue([]) },
      supplierPayment: { findMany: vi.fn().mockResolvedValue([]) },
      recurringProfile: { findMany: vi.fn().mockResolvedValue([{
        cadence: 'MONTHLY', dayOfPeriod: 20, startDate: new Date(2026, 0, 1), endDate: null,
        lastGeneratedPeriod: '2026-08', payloadJson: JSON.stringify({ amount: 5000, expenseName: 'Rent' })
      }]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashFlowProjection({ daysBack: 5, daysForward: 10 })

    const day = result.days.find(d => d.date === '2026-08-20')!
    expect(day.projectedNet).toBe(0)
  })

  it('does not throw on a malformed recurring-profile payload snapshot', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      bill: { findMany: vi.fn().mockResolvedValue([]) },
      supplierPayment: { findMany: vi.fn().mockResolvedValue([]) },
      recurringProfile: { findMany: vi.fn().mockResolvedValue([{
        cadence: 'MONTHLY', dayOfPeriod: 20, startDate: new Date(2026, 0, 1), endDate: null,
        lastGeneratedPeriod: null, payloadJson: 'not valid json'
      }]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await expect(reportService.generateCashFlowProjection({ daysBack: 5, daysForward: 10 })).resolves.toBeDefined()
  })

  it('defaults to a 30/30 day window when no params are given', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      bill: { findMany: vi.fn().mockResolvedValue([]) },
      supplierPayment: { findMany: vi.fn().mockResolvedValue([]) },
      recurringProfile: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCashFlowProjection({})

    expect(result.daysBack).toBe(30)
    expect(result.daysForward).toBe(30)
    expect(result.days).toHaveLength(61)
  })
})

// ─── Payment Performance Report (Phase 65) ─────────────────────────────────

describe('reportService.generatePaymentPerformanceReport', () => {
  it('computes days-to-pay from invoiceDate to the LAST payment, not the first, for a multi-partial-payment invoice', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([
        {
          invoiceDate: new Date(2026, 6, 1), balanceAmount: 0, customerId: 'cust-1',
          customer: { customerName: 'Acme Traders' },
          payments: [{ paymentDate: new Date(2026, 6, 5) }, { paymentDate: new Date(2026, 6, 11) }]
        }
      ]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePaymentPerformanceReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ customerId: 'cust-1', customerName: 'Acme Traders', paidInvoiceCount: 1, avgDaysToPay: 10 })
    expect(result.overallAvgDaysToPay).toBe(10)
  })

  it('routes a still-outstanding invoice to outstandingAmount instead of the days-to-pay average', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([
        { invoiceDate: new Date(2026, 6, 1), balanceAmount: 4000, customerId: 'cust-1', customer: { customerName: 'Acme Traders' }, payments: [] }
      ]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePaymentPerformanceReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.rows[0]).toMatchObject({ paidInvoiceCount: 0, avgDaysToPay: null, outstandingInvoiceCount: 1, outstandingAmount: 4000 })
    expect(result.overallAvgDaysToPay).toBeNull()
  })

  it('computes overallAvgDaysToPay from the flat list of invoices, not an average of per-customer averages', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([
        { invoiceDate: new Date(2026, 6, 1), balanceAmount: 0, customerId: 'cust-1', customer: { customerName: 'Small Customer' }, payments: [{ paymentDate: new Date(2026, 6, 21) }] }, // 20 days
        { invoiceDate: new Date(2026, 6, 1), balanceAmount: 0, customerId: 'cust-2', customer: { customerName: 'Big Customer' }, payments: [{ paymentDate: new Date(2026, 6, 3) }] }, // 2 days
        { invoiceDate: new Date(2026, 6, 5), balanceAmount: 0, customerId: 'cust-2', customer: { customerName: 'Big Customer' }, payments: [{ paymentDate: new Date(2026, 6, 7) }] }, // 2 days
        { invoiceDate: new Date(2026, 6, 10), balanceAmount: 0, customerId: 'cust-2', customer: { customerName: 'Big Customer' }, payments: [{ paymentDate: new Date(2026, 6, 12) }] } // 2 days
      ]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePaymentPerformanceReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    // (20 + 2 + 2 + 2) / 4 = 6.5 — NOT (20 + 2) / 2 = 11, which is what averaging per-customer averages would give.
    expect(result.overallAvgDaysToPay).toBe(6.5)
  })

  it('returns zero rows when no invoices exist for the period', async () => {
    const db = makeDb({ invoice: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePaymentPerformanceReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.rows).toHaveLength(0)
    expect(result.overallAvgDaysToPay).toBeNull()
  })
})

// ─── Jewellery Report (fresh-audit fix, 2026-07-12) ────────────────────────────

describe('reportService.generateJewelleryReport', () => {
  it('values stock as netWeight × today\'s rate, grouped by metalType+purity, not quantity × costPrice', async () => {
    const db = makeDb({
      product: { findMany: vi.fn().mockResolvedValue([
        { metalType: 'GOLD', purity: '22K', netWeight: 10 },
        { metalType: 'GOLD', purity: '22K', netWeight: 5 },
        { metalType: 'SILVER', purity: '925', netWeight: 20 },
      ]) },
      metalRate: { findMany: vi.fn().mockResolvedValue([
        { metalType: 'GOLD', purity: '22K', ratePerGram: 6000 },
        { metalType: 'SILVER', purity: '925', ratePerGram: 80 },
      ]) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
      metalExchange: { findMany: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateJewelleryReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    const gold = result.stockByMetal.find(g => g.metalType === 'GOLD' && g.purity === '22K')
    expect(gold).toEqual({ metalType: 'GOLD', purity: '22K', netWeightGrams: 15, ratePerGram: 6000, valuationAmount: 90000 })
    const silver = result.stockByMetal.find(g => g.metalType === 'SILVER')
    expect(silver!.valuationAmount).toBe(1600)
    expect(result.summary.totalStockValuationAmount).toBe(91600)
  })

  it('flags a metal+purity combination with no rate set instead of silently valuing it at zero', async () => {
    const db = makeDb({
      product: { findMany: vi.fn().mockResolvedValue([{ metalType: 'PLATINUM', purity: '950', netWeight: 8 }]) },
      metalRate: { findMany: vi.fn().mockResolvedValue([]) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
      metalExchange: { findMany: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateJewelleryReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.stockByMetal[0].ratePerGram).toBeNull()
    expect(result.stockByMetal[0].valuationAmount).toBe(0)
    expect(result.summary.metalsWithNoRateSet).toEqual(['PLATINUM 950'])
  })

  it('sums making-charge revenue from the snapshotted per-item value, weighted by quantity, over the date range', async () => {
    const db = makeDb({
      product: { findMany: vi.fn().mockResolvedValue([]) },
      metalRate: { findMany: vi.fn().mockResolvedValue([]) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([
        { jewelleryMakingCharge: 500, quantity: 1 },
        { jewelleryMakingCharge: 200, quantity: 2 },
      ]) },
      metalExchange: { findMany: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateJewelleryReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalMakingChargeRevenue).toBe(900)
  })

  it('summarizes old-metal exchanges (count + total value given) over the date range', async () => {
    const db = makeDb({
      product: { findMany: vi.fn().mockResolvedValue([]) },
      metalRate: { findMany: vi.fn().mockResolvedValue([]) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
      metalExchange: { findMany: vi.fn().mockResolvedValue([{ valueGiven: 720 }, { valueGiven: 1500 }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateJewelleryReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalExchangeCount).toBe(2)
    expect(result.summary.totalExchangeValueGiven).toBe(2220)
  })
})

// Phase 67 §9.1 — Jewellery item 2: Making-Charge vs. Metal-Value Margin, per sale.
describe('reportService.generateMakingChargeMarginReport', () => {
  it('splits each invoice into its metal-value and making-charge components, keyed per invoice', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([
        { jewelleryNetWeight: 10, jewelleryRatePerGram: 6000, jewelleryMakingCharge: 500, quantity: 1,
          invoice: { id: 'inv-1', invoiceNumber: 'INV-001', invoiceDate: new Date('2026-01-05'), customer: { customerName: 'Asha' } } },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateMakingChargeMarginReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ invoiceNumber: 'INV-001', customerName: 'Asha', metalValue: 60000, makingCharge: 500, totalValue: 60500 })
    expect(result.rows[0].makingChargePercent).toBeCloseTo(0.8, 1)
  })

  it('sums multiple items on the same invoice into one row', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([
        { jewelleryNetWeight: 5, jewelleryRatePerGram: 6000, jewelleryMakingCharge: 300, quantity: 1,
          invoice: { id: 'inv-1', invoiceNumber: 'INV-001', invoiceDate: new Date('2026-01-05'), customer: { customerName: 'Asha' } } },
        { jewelleryNetWeight: 5, jewelleryRatePerGram: 6000, jewelleryMakingCharge: 300, quantity: 1,
          invoice: { id: 'inv-1', invoiceNumber: 'INV-001', invoiceDate: new Date('2026-01-05'), customer: { customerName: 'Asha' } } },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateMakingChargeMarginReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].metalValue).toBe(60000)
    expect(result.rows[0].makingCharge).toBe(600)
  })

  it('returns an honest empty result when there are no jewellery sales in range', async () => {
    const db = makeDb({ invoiceItem: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateMakingChargeMarginReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.rows).toHaveLength(0)
    expect(result.summary.avgMakingChargePercent).toBe(0)
  })
})

// Phase 67 §9.1 — Jewellery item 3: Hallmarking/HUID compliance register.
describe('reportService.generateHallmarkComplianceReport', () => {
  it('flags items missing a hallmark number as non-compliant', async () => {
    const db = makeDb({
      product: { findMany: vi.fn().mockResolvedValue([
        { id: 'p1', productName: 'Ring', metalType: 'GOLD', purity: '22K', hallmarkNumber: 'HUID123' },
        { id: 'p2', productName: 'Chain', metalType: 'GOLD', purity: '22K', hallmarkNumber: null },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateHallmarkComplianceReport()

    expect(result.summary).toEqual({ totalItems: 2, compliantCount: 1, nonCompliantCount: 1, compliancePercent: 50 })
  })

  it('sorts non-compliant items first — the actionable list', async () => {
    const db = makeDb({
      product: { findMany: vi.fn().mockResolvedValue([
        { id: 'p1', productName: 'Ring', metalType: 'GOLD', purity: '22K', hallmarkNumber: 'HUID123' },
        { id: 'p2', productName: 'Chain', metalType: 'GOLD', purity: '22K', hallmarkNumber: null },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateHallmarkComplianceReport()

    expect(result.rows[0].compliant).toBe(false)
  })

  it('reports 100% compliance when there are no jewellery items at all — an honest default, not a false alarm', async () => {
    const db = makeDb({ product: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateHallmarkComplianceReport()

    expect(result.summary.compliancePercent).toBe(100)
  })
})

// Phase 67 §9.1 — Jewellery item 4: Metal Rate vs. Sales Volume.
describe('reportService.generateMetalRateVsSalesVolumeReport', () => {
  it('auto-selects the metal+purity combination with the most sales weight in range', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([
        { jewelleryMetalType: 'GOLD', jewelleryPurity: '22K', jewelleryNetWeight: 50, quantity: 1, invoice: { invoiceDate: new Date('2026-01-10') } },
        { jewelleryMetalType: 'SILVER', jewelleryPurity: '999', jewelleryNetWeight: 5, quantity: 1, invoice: { invoiceDate: new Date('2026-01-10') } },
      ]) },
      metalRateHistory: { findMany: vi.fn().mockResolvedValue([
        { metalType: 'GOLD', purity: '22K', ratePerGram: 6000, recordedAt: new Date('2026-01-05') },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateMetalRateVsSalesVolumeReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.metalType).toBe('GOLD')
    expect(result.purity).toBe('22K')
    expect(result.rows[0]).toMatchObject({ month: '2026-01', avgRatePerGram: 6000, salesWeightGrams: 50 })
  })

  it('falls back to whichever combination has the most rate-history entries when there were no sales at all', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
      metalRateHistory: {
        findMany: vi.fn().mockResolvedValue([{ metalType: 'GOLD', purity: '22K', ratePerGram: 6000, recordedAt: new Date('2026-01-05') }]),
        groupBy: vi.fn().mockResolvedValue([{ metalType: 'GOLD', purity: '22K', _count: { _all: 3 } }]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateMetalRateVsSalesVolumeReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.metalType).toBe('GOLD')
    expect(result.purity).toBe('22K')
  })

  it('returns an honest empty result when there is neither sales nor rate history in range', async () => {
    const db = makeDb({
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
      metalRateHistory: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateMetalRateVsSalesVolumeReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.metalType).toBe('')
    expect(result.rows).toHaveLength(0)
  })
})

// Phase 67 §9.1 — Jewellery item 5: Purity-adjusted old-gold exchange analytics.
describe('reportService.generatePurityAdjustedExchangeReport', () => {
  it('normalizes a karat purity to its pure-metal-equivalent weight', async () => {
    const db = makeDb({
      metalExchange: { findMany: vi.fn().mockResolvedValue([
        { metalType: 'GOLD', purity: '22K', netWeight: 24, valueGiven: 100000, createdAt: new Date('2026-01-05') },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePurityAdjustedExchangeReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    // 24g at 22K (22/24 fine) = 22g pure-equivalent
    expect(result.byMetal[0].pureEquivalentGrams).toBeCloseTo(22, 3)
  })

  it('normalizes a per-mille (fineness) purity to its pure-metal-equivalent weight', async () => {
    const db = makeDb({
      metalExchange: { findMany: vi.fn().mockResolvedValue([
        { metalType: 'SILVER', purity: '999', netWeight: 100, valueGiven: 8500, createdAt: new Date('2026-01-05') },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePurityAdjustedExchangeReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.byMetal[0].pureEquivalentGrams).toBeCloseTo(99.9, 3)
  })

  it('counts an unparseable purity string honestly rather than crashing or silently zeroing the whole report', async () => {
    const db = makeDb({
      metalExchange: { findMany: vi.fn().mockResolvedValue([
        { metalType: 'GOLD', purity: 'unknown', netWeight: 10, valueGiven: 5000, createdAt: new Date('2026-01-05') },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePurityAdjustedExchangeReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.unparsablePurityCount).toBe(1)
    expect(result.byMetal[0].pureEquivalentGrams).toBe(0)
  })

  it('sorts by pureEquivalentGrams descending — the metal actually recovered, most first', async () => {
    const db = makeDb({
      metalExchange: { findMany: vi.fn().mockResolvedValue([
        { metalType: 'SILVER', purity: '999', netWeight: 10, valueGiven: 850, createdAt: new Date('2026-01-05') },
        { metalType: 'GOLD', purity: '22K', netWeight: 24, valueGiven: 100000, createdAt: new Date('2026-01-06') },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePurityAdjustedExchangeReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.byMetal[0].metalType).toBe('GOLD')
  })
})

// ─── Logistics Report (Phase 54B — reuses logisticsAnalyticsService) ───────────

describe('reportService.generateLogisticsReport', () => {
  it('reshapes getLogisticsAnalytics output into the report summary shape', async () => {
    vi.mocked(getLogisticsAnalytics).mockResolvedValue({
      success: true,
      data: {
        period: { from: '2026-07-01', to: '2026-07-31' },
        shipments: { total: 10, byStatus: { DELIVERED: 7, IN_TRANSIT: 3 }, avgDeliveryDays: 2.5, deliveryRate: 70 },
        challans: { total: 5, delivered: 4, returned: 1 },
        grns: { total: 3, posted: 2, totalValue: 50000 },
        freight: { total: 12000, paid: 9000, pending: 3000, avgPerShipment: 1200 },
        fleet: { total: 4, byStatus: { AVAILABLE: 3, IN_USE: 1 }, activeCarriers: 2 },
        monthlyShipments: [{ month: 'Jul 2026', count: 10, freight: 12000 }],
        topCarriers: [{ carrierId: 'c1', name: 'Speedy Logistics', count: 6 }],
      },
    } as never)

    const result = await reportService.generateLogisticsReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.summary).toEqual({
      totalShipments: 10, deliveryRate: 70, avgDeliveryDays: 2.5,
      totalFreight: 12000, freightPending: 3000, totalGRNValue: 50000, activeCarriers: 2,
    })
    expect(result.topCarriers).toEqual([{ name: 'Speedy Logistics', count: 6 }])
    expect(result.shipmentsByStatus).toEqual(expect.arrayContaining([{ status: 'DELIVERED', count: 7 }, { status: 'IN_TRANSIT', count: 3 }]))
  })

  it('throws when the underlying analytics call fails, so the IPC layer surfaces a real error', async () => {
    vi.mocked(getLogisticsAnalytics).mockResolvedValue({ success: false, error: { code: 'LOG-060', message: 'DB error' } } as never)

    await expect(reportService.generateLogisticsReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })).rejects.toThrow('DB error')
  })
})

// ─── Attendance Report (Phase 54B — universal HR coverage) ─────────────────────

function makeAttendance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'att-1', date: new Date('2026-07-05'), status: 'PRESENT', checkIn: '09:00', checkOut: '18:00',
    employee: { fullName: 'Jane Doe' },
    ...overrides,
  }
}

describe('reportService.generateAttendanceReport', () => {
  it('computes present/absent/leave counts and an attendance rate excluding holidays/week-offs', async () => {
    const db = {
      attendance: {
        findMany: vi.fn().mockResolvedValue([
          makeAttendance({ id: 'a1', status: 'PRESENT' }),
          makeAttendance({ id: 'a2', status: 'ABSENT' }),
          makeAttendance({ id: 'a3', status: 'HOLIDAY' }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateAttendanceReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.summary).toEqual({ totalRecords: 3, presentCount: 1, absentCount: 1, leaveCount: 0, overallAttendanceRate: 50 })
  })

  it('rolls up per-employee attendance rate treating HALF_DAY as 0.5', async () => {
    const db = {
      attendance: {
        findMany: vi.fn().mockResolvedValue([
          makeAttendance({ id: 'a1', status: 'PRESENT' }),
          makeAttendance({ id: 'a2', status: 'HALF_DAY' }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateAttendanceReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.byEmployee).toEqual([{ employeeName: 'Jane Doe', present: 1, absent: 0, halfDay: 1, leave: 0, attendanceRate: 75 }])
  })
})

// ─── Production Report (Phase 54B — closes MANUFACTURING's zero-report gap) ───

function makeProductionOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-1', orderNumber: 'PO-0001', plannedQty: 100, producedQty: 80, status: 'IN_PROGRESS',
    startDate: new Date('2026-07-01'), completedDate: null,
    product: { productName: 'Steel Bracket' },
    ...overrides,
  }
}

describe('reportService.generateProductionReport', () => {
  it('computes completion rate and planned/produced totals', async () => {
    const db = {
      productionOrder: {
        findMany: vi.fn().mockResolvedValue([
          makeProductionOrder({ id: 'po-1', status: 'COMPLETED', plannedQty: 100, producedQty: 100 }),
          makeProductionOrder({ id: 'po-2', status: 'IN_PROGRESS', plannedQty: 50, producedQty: 20 }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProductionReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.summary).toEqual({ totalOrders: 2, completed: 1, inProgress: 1, totalPlannedQty: 150, totalProducedQty: 120, completionRate: 50 })
  })

  it('groups counts by every status present', async () => {
    const db = {
      productionOrder: {
        findMany: vi.fn().mockResolvedValue([
          makeProductionOrder({ id: 'po-1', status: 'DRAFT' }),
          makeProductionOrder({ id: 'po-2', status: 'CANCELLED' }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProductionReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.byStatus).toEqual(expect.arrayContaining([{ status: 'DRAFT', count: 1 }, { status: 'CANCELLED', count: 1 }]))
  })
})

// Phase 67 §9.1 — Manufacturing item 2: True Landed Cost per Finished Unit.
// Deliberately backs material cost OUT of ProductCostHistory.unitCost
// (totalCost - laborCost - overheadCost) rather than recomputing it from
// CURRENT RawMaterial.unitCost, since that's the real historically-accurate
// number that actually set the finished good's own inventory.averageCost.
describe('reportService.generateLandedCostPerUnitReport', () => {
  it('backs material cost out of the persisted ProductCostHistory.unitCost, not current RawMaterial prices', async () => {
    const db = {
      productionOrder: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'po-1', productId: 'p1', producedQty: 10, laborCost: 200, overheadCost: 50, product: { productName: 'Steel Bracket' } },
        ])
      },
      productCostHistory: {
        findMany: vi.fn().mockResolvedValue([{ sourceId: 'po-1', unitCost: 100 }]) // totalCost = 1000
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLandedCostPerUnitReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    // totalCost 1000 - labor 200 - overhead 50 = material 750, /10 units = 75/unit
    expect(result.rows).toEqual([{
      productId: 'p1', productName: 'Steel Bracket', producedQty: 10,
      materialCostPerUnit: 75, laborCostPerUnit: 20, overheadCostPerUnit: 5, totalCostPerUnit: 100
    }])
  })

  it('weight-averages across multiple completed orders for the same product', async () => {
    const db = {
      productionOrder: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'po-1', productId: 'p1', producedQty: 10, laborCost: 0, overheadCost: 0, product: { productName: 'Steel Bracket' } },
          { id: 'po-2', productId: 'p1', producedQty: 10, laborCost: 0, overheadCost: 0, product: { productName: 'Steel Bracket' } },
        ])
      },
      productCostHistory: {
        findMany: vi.fn().mockResolvedValue([
          { sourceId: 'po-1', unitCost: 50 },
          { sourceId: 'po-2', unitCost: 100 },
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLandedCostPerUnitReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    // (10*50 + 10*100) / 20 = 75/unit
    expect(result.rows[0].totalCostPerUnit).toBe(75)
    expect(result.rows[0].producedQty).toBe(20)
  })

  it('sorts rows by total cost per unit, highest first', async () => {
    const db = {
      productionOrder: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'po-1', productId: 'cheap', producedQty: 10, laborCost: 0, overheadCost: 0, product: { productName: 'Cheap Widget' } },
          { id: 'po-2', productId: 'expensive', producedQty: 10, laborCost: 0, overheadCost: 0, product: { productName: 'Expensive Widget' } },
        ])
      },
      productCostHistory: {
        findMany: vi.fn().mockResolvedValue([
          { sourceId: 'po-1', unitCost: 10 },
          { sourceId: 'po-2', unitCost: 500 },
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLandedCostPerUnitReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.rows.map(r => r.productId)).toEqual(['expensive', 'cheap'])
  })

  it('returns an honest empty result when there are no completed orders in range', async () => {
    const db = { productionOrder: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLandedCostPerUnitReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalOrders: 0, totalProducedQty: 0 })
  })

  it('queries only COMPLETED orders within the date range', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { productionOrder: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateLandedCostPerUnitReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'COMPLETED' })
    }))
  })
})

// Phase 67 §9.1 — Manufacturing item 4: Rejection Rate Trend. Reuses item
// 3's own per-stage qtyInspected/qtyRejected fields — a QC step with neither
// set (every pre-item-3 row, and every non-QC step) is correctly excluded.
describe('reportService.generateRejectionRateTrendReport', () => {
  function makeQcStep(overrides: Record<string, unknown> = {}) {
    return { taskName: 'Final Inspection', qtyInspected: 100, qtyRejected: 5, completedAt: new Date('2026-07-15'), ...overrides }
  }

  it('computes a monthly trend point with the correct rejection rate', async () => {
    const db = { workOrder: { findMany: vi.fn().mockResolvedValue([makeQcStep()]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRejectionRateTrendReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.trend).toEqual([{ month: '2026-07', qtyInspected: 100, qtyRejected: 5, rejectionRatePercent: 5 }])
  })

  it('groups by stage (taskName), ranking the highest rejection rate first', async () => {
    const db = {
      workOrder: {
        findMany: vi.fn().mockResolvedValue([
          makeQcStep({ taskName: 'Cutting', qtyInspected: 100, qtyRejected: 2 }),
          makeQcStep({ taskName: 'Assembly', qtyInspected: 100, qtyRejected: 20 }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRejectionRateTrendReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.byStage[0]).toEqual({ taskName: 'Assembly', qtyInspected: 100, qtyRejected: 20, rejectionRatePercent: 20 })
    expect(result.byStage[1]).toEqual({ taskName: 'Cutting', qtyInspected: 100, qtyRejected: 2, rejectionRatePercent: 2 })
  })

  it('aggregates the same stage across multiple months into separate trend points', async () => {
    const db = {
      workOrder: {
        findMany: vi.fn().mockResolvedValue([
          makeQcStep({ completedAt: new Date('2026-06-15'), qtyInspected: 50, qtyRejected: 5 }),
          makeQcStep({ completedAt: new Date('2026-07-15'), qtyInspected: 50, qtyRejected: 10 }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRejectionRateTrendReport({ dateFrom: '2026-06-01', dateTo: '2026-07-31' })

    expect(result.trend).toEqual([
      { month: '2026-06', qtyInspected: 50, qtyRejected: 5, rejectionRatePercent: 10 },
      { month: '2026-07', qtyInspected: 50, qtyRejected: 10, rejectionRatePercent: 20 },
    ])
  })

  it('computes an honest overall summary across all included steps', async () => {
    const db = {
      workOrder: {
        findMany: vi.fn().mockResolvedValue([
          makeQcStep({ qtyInspected: 100, qtyRejected: 10 }),
          makeQcStep({ qtyInspected: 100, qtyRejected: 20 }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRejectionRateTrendReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.summary).toEqual({ totalInspected: 200, totalRejected: 30, overallRejectionRatePercent: 15 })
  })

  it('returns an honest empty result when no QC steps with inspection counts exist in range', async () => {
    const db = { workOrder: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRejectionRateTrendReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.trend).toEqual([])
    expect(result.byStage).toEqual([])
    expect(result.summary).toEqual({ totalInspected: 0, totalRejected: 0, overallRejectionRatePercent: 0 })
  })

  it('queries only isQcStep rows with qtyInspected set, within the completedAt range', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { workOrder: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateRejectionRateTrendReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isQcStep: true, qtyInspected: { not: null } })
    }))
  })
})

describe('reportService.generateSeasonalCreditExposureReport', () => {
  function makeCreditInvoice(overrides: Record<string, unknown> = {}) {
    return { balanceAmount: 1000, dueDate: new Date('2026-04-15'), cropSeason: { name: 'Wheat Harvest' }, ...overrides }
  }

  it('returns an honest empty result when there is no outstanding credit', async () => {
    const db = { invoice: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSeasonalCreditExposureReport()

    expect(result.byMonth).toHaveLength(12)
    expect(result.byMonth.every(m => m.outstandingAmount === 0)).toBe(true)
    expect(result.bySeason).toEqual([])
    expect(result.summary).toEqual({ totalOutstanding: 0, totalInvoices: 0, peakMonth: null, peakMonthAmount: 0 })
  })

  it('buckets outstanding balances by the calendar month of dueDate', async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeCreditInvoice({ balanceAmount: 1000, dueDate: new Date('2026-04-15') }),
          makeCreditInvoice({ balanceAmount: 500, dueDate: new Date('2026-04-20') }),
          makeCreditInvoice({ balanceAmount: 300, dueDate: new Date('2026-10-01') }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSeasonalCreditExposureReport()

    const apr = result.byMonth.find(m => m.month === 'Apr')
    const oct = result.byMonth.find(m => m.month === 'Oct')
    expect(apr).toEqual({ month: 'Apr', outstandingAmount: 1500, invoiceCount: 2 })
    expect(oct).toEqual({ month: 'Oct', outstandingAmount: 300, invoiceCount: 1 })
  })

  it('separately breaks down by linked CropSeason name, sorted by outstanding amount descending', async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeCreditInvoice({ balanceAmount: 200, cropSeason: { name: 'Cotton Season' } }),
          makeCreditInvoice({ balanceAmount: 900, cropSeason: { name: 'Wheat Harvest' } }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSeasonalCreditExposureReport()

    expect(result.bySeason).toEqual([
      { seasonName: 'Wheat Harvest', outstandingAmount: 900, invoiceCount: 1 },
      { seasonName: 'Cotton Season', outstandingAmount: 200, invoiceCount: 1 },
    ])
  })

  it('omits invoices with no linked CropSeason from the bySeason breakdown, but still counts them in byMonth', async () => {
    const db = { invoice: { findMany: vi.fn().mockResolvedValue([makeCreditInvoice({ cropSeason: null })]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSeasonalCreditExposureReport()

    expect(result.bySeason).toEqual([])
    expect(result.byMonth.find(m => m.month === 'Apr')?.invoiceCount).toBe(1)
  })

  it('identifies the peak month correctly', async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeCreditInvoice({ balanceAmount: 100, dueDate: new Date('2026-01-01') }),
          makeCreditInvoice({ balanceAmount: 5000, dueDate: new Date('2026-04-15') }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSeasonalCreditExposureReport()

    expect(result.summary.peakMonth).toBe('Apr')
    expect(result.summary.peakMonthAmount).toBe(5000)
  })

  it('queries only ACTIVE, non-RETURN invoices with a positive balance and a set dueDate', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { invoice: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateSeasonalCreditExposureReport()

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'ACTIVE', invoiceType: { not: 'RETURN' }, balanceAmount: { gt: 0 }, dueDate: { not: null } })
    }))
  })
})

describe('reportService.generateFarmerRepaymentReport', () => {
  function makeFarmerInvoice(overrides: Record<string, unknown> = {}) {
    return {
      customerId: 'cust-1', totalAmount: 1000, paidAmount: 800, balanceAmount: 200,
      customer: { customerName: 'Ramesh Farms', phone: '9999999999' },
      ...overrides
    }
  }

  it('returns an honest empty result when there are no credit-eligible invoices', async () => {
    const db = { invoice: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFarmerRepaymentReport()

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalFarmers: 0, totalOutstanding: 0, overallRepaymentRatePercent: 0 })
  })

  it('aggregates purchases/repayments per customer across multiple invoices', async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeFarmerInvoice({ totalAmount: 1000, paidAmount: 800, balanceAmount: 200 }),
          makeFarmerInvoice({ totalAmount: 500, paidAmount: 500, balanceAmount: 0 }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFarmerRepaymentReport()

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({
      customerId: 'cust-1', customerName: 'Ramesh Farms', phone: '9999999999',
      totalPurchased: 1500, totalRepaid: 1300, outstandingBalance: 200,
      repaymentRatePercent: Math.round((1300 / 1500) * 1000) / 10
    })
  })

  it('sorts riskiest (lowest repayment rate) farmers first', async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeFarmerInvoice({ customerId: 'good', totalAmount: 1000, paidAmount: 1000, balanceAmount: 0, customer: { customerName: 'Reliable Farmer', phone: null } }),
          makeFarmerInvoice({ customerId: 'risky', totalAmount: 1000, paidAmount: 100, balanceAmount: 900, customer: { customerName: 'Risky Farmer', phone: null } }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFarmerRepaymentReport()

    expect(result.rows.map(r => r.customerId)).toEqual(['risky', 'good'])
  })

  it('computes an honest overall summary', async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeFarmerInvoice({ customerId: 'a', totalAmount: 1000, paidAmount: 500, balanceAmount: 500 }),
          makeFarmerInvoice({ customerId: 'b', totalAmount: 1000, paidAmount: 1000, balanceAmount: 0 }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFarmerRepaymentReport()

    expect(result.summary).toEqual({ totalFarmers: 2, totalOutstanding: 500, overallRepaymentRatePercent: 75 })
  })

  it('queries only ACTIVE, non-RETURN invoices with a customer and a recognized paymentStatus', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { invoice: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateFarmerRepaymentReport()

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'ACTIVE', invoiceType: { not: 'RETURN' }, customerId: { not: null }, paymentStatus: { in: ['UNPAID', 'PARTIAL', 'PAID'] } })
    }))
  })
})

// ─── Serial & Warranty Report (Phase 54B — closes ELECTRONICS's zero-report gap) ─

function makeSerial(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ser-1', serialNumber: 'SN-0001', status: 'AVAILABLE', warrantyExpiryDate: null,
    product: { productName: 'Smartphone X' },
    ...overrides,
  }
}

describe('reportService.generateSerialWarrantyReport', () => {
  it('buckets an already-expired warranty as "expired"', async () => {
    const db = {
      productSerial: {
        findMany: vi.fn().mockResolvedValue([
          makeSerial({ warrantyExpiryDate: new Date(Date.now() - 5 * 86400000) }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSerialWarrantyReport()

    expect(result.rows[0].daysToExpiry).toBeLessThan(0)
    expect(result.summary.warrantyExpired).toBe(1)
  })

  it('buckets a warranty expiring within 30 days as expiringSoon, and one with no warranty date separately', async () => {
    const db = {
      productSerial: {
        findMany: vi.fn().mockResolvedValue([
          makeSerial({ id: 's1', warrantyExpiryDate: new Date(Date.now() + 10 * 86400000) }),
          makeSerial({ id: 's2', warrantyExpiryDate: null }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSerialWarrantyReport()

    expect(result.summary.warrantyExpiringSoon).toBe(1)
    const noWarrantyBucket = result.buckets.find(b => b.bucket === 'noWarranty')
    expect(noWarrantyBucket?.count).toBe(1)
  })
})

// Phase 67 §9.1 — Electronics: RMA Aging Report. Reuses the exact same
// daysWithVendor/isOverdue definitions repair-ticket.service.ts's own
// toRecord() already established (VENDOR_SLA_DAYS = 30), not a second,
// driftable copy of the same rule.
describe('reportService.generateRmaAgingReport', () => {
  function makeTicket(overrides: Record<string, unknown> = {}) {
    return {
      claimNumber: 'RMA-00001', sentToVendorDate: new Date(), vendorSlaDueDate: new Date(Date.now() + 30 * 86400000),
      product: { productName: 'Galaxy S24' }, vendor: { supplierName: 'ABC Distributors' },
      ...overrides
    }
  }

  it('computes daysWithVendor from sentToVendorDate to now', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([
      makeTicket({ sentToVendorDate: new Date(Date.now() - 10 * 86400000) })
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRmaAgingReport()

    expect(result.rows[0].daysWithVendor).toBe(10)
  })

  it('marks a ticket overdue once past its vendorSlaDueDate', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([
      makeTicket({ sentToVendorDate: new Date(Date.now() - 45 * 86400000), vendorSlaDueDate: new Date(Date.now() - 15 * 86400000) })
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRmaAgingReport()

    expect(result.rows[0].isOverdue).toBe(true)
    expect(result.summary.overdueCount).toBe(1)
  })

  it('sorts rows by daysWithVendor descending', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([
      makeTicket({ claimNumber: 'RMA-00001', sentToVendorDate: new Date(Date.now() - 5 * 86400000) }),
      makeTicket({ claimNumber: 'RMA-00002', sentToVendorDate: new Date(Date.now() - 20 * 86400000) }),
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRmaAgingReport()

    expect(result.rows[0].claimNumber).toBe('RMA-00002')
    expect(result.rows[1].claimNumber).toBe('RMA-00001')
  })

  it('queries only currently-open tickets (SENT_TO_VENDOR / AWAITING_PARTS)', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { repairTicket: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateRmaAgingReport()

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { in: ['SENT_TO_VENDOR', 'AWAITING_PARTS'] } })
    }))
  })

  it('returns null vendorName when no vendor is recorded yet', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([makeTicket({ vendor: null })]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRmaAgingReport()

    expect(result.rows[0].vendorName).toBeNull()
  })

  it('returns an honest empty result when nothing is currently with a vendor', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRmaAgingReport()

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalOpen: 0, overdueCount: 0 })
  })
})

describe('reportService.generateVendorRecoveryLedgerReport', () => {
  function makeClaimTicket(overrides: Record<string, unknown> = {}) {
    return {
      claimNumber: 'RMA-00001', vendorClaimAmount: 1000, vendorRecoveredAmount: 0, vendorClaimClosedAt: null,
      product: { productName: 'Galaxy S24' }, vendor: { supplierName: 'ABC Distributors' },
      ...overrides
    }
  }

  it('computes outstandingAmount as claimed minus recovered', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([
      makeClaimTicket({ vendorClaimAmount: 1000, vendorRecoveredAmount: 400 })
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVendorRecoveryLedgerReport()

    expect(result.rows[0].outstandingAmount).toBe(600)
  })

  it('marks isClosed true when vendorClaimClosedAt is set', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([
      makeClaimTicket({ vendorClaimClosedAt: new Date('2026-08-01') })
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVendorRecoveryLedgerReport()

    expect(result.rows[0].isClosed).toBe(true)
    expect(result.rows[0].closedAt).toBe(new Date('2026-08-01').toISOString())
  })

  it('sorts open claims before closed claims, then by outstandingAmount descending', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([
      makeClaimTicket({ claimNumber: 'RMA-CLOSED', vendorClaimAmount: 5000, vendorRecoveredAmount: 5000, vendorClaimClosedAt: new Date() }),
      makeClaimTicket({ claimNumber: 'RMA-LOW', vendorClaimAmount: 500, vendorRecoveredAmount: 0 }),
      makeClaimTicket({ claimNumber: 'RMA-HIGH', vendorClaimAmount: 2000, vendorRecoveredAmount: 0 }),
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVendorRecoveryLedgerReport()

    expect(result.rows.map(r => r.claimNumber)).toEqual(['RMA-HIGH', 'RMA-LOW', 'RMA-CLOSED'])
  })

  it('only includes tickets with a non-null vendorClaimAmount', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { repairTicket: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateVendorRecoveryLedgerReport()

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { vendorClaimAmount: { not: null } }
    }))
  })

  it('returns null vendorName when no vendor is recorded yet', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([makeClaimTicket({ vendor: null })]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVendorRecoveryLedgerReport()

    expect(result.rows[0].vendorName).toBeNull()
  })

  it('computes summary totals across claimed, recovered, outstanding, and open/closed counts', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([
      makeClaimTicket({ claimNumber: 'RMA-1', vendorClaimAmount: 1000, vendorRecoveredAmount: 300 }),
      makeClaimTicket({ claimNumber: 'RMA-2', vendorClaimAmount: 500, vendorRecoveredAmount: 500, vendorClaimClosedAt: new Date() }),
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVendorRecoveryLedgerReport()

    expect(result.summary).toEqual({
      totalClaimed: 1500, totalRecovered: 800, totalOutstanding: 700, openCount: 1, closedCount: 1
    })
  })

  it('returns an honest empty result when no vendor claims have been recorded', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVendorRecoveryLedgerReport()

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalClaimed: 0, totalRecovered: 0, totalOutstanding: 0, openCount: 0, closedCount: 0 })
  })
})

describe('reportService.generateRepairTurnaroundByTechnicianReport', () => {
  function makeCompletedTicket(overrides: Record<string, unknown> = {}) {
    return {
      technicianId: 'tech-1', technician: { fullName: 'Ravi Kumar' },
      receivedDate: new Date('2026-08-01T00:00:00Z'), deliveredDate: new Date('2026-08-04T00:00:00Z'),
      ...overrides
    }
  }

  it('computes avg/min/max turnaround days per technician', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([
      makeCompletedTicket({ receivedDate: new Date('2026-08-01T00:00:00Z'), deliveredDate: new Date('2026-08-03T00:00:00Z') }), // 2 days
      makeCompletedTicket({ receivedDate: new Date('2026-08-01T00:00:00Z'), deliveredDate: new Date('2026-08-05T00:00:00Z') }), // 4 days
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepairTurnaroundByTechnicianReport()

    expect(result.rows).toEqual([
      { technicianId: 'tech-1', technicianName: 'Ravi Kumar', ticketCount: 2, avgTurnaroundDays: 3, minTurnaroundDays: 2, maxTurnaroundDays: 4 }
    ])
  })

  it('groups by technician, keeping distinct technicians in separate rows', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([
      makeCompletedTicket({ technicianId: 'tech-1', technician: { fullName: 'Ravi Kumar' } }),
      makeCompletedTicket({ technicianId: 'tech-2', technician: { fullName: 'Sana Sheikh' } }),
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepairTurnaroundByTechnicianReport()

    expect(result.rows.map(r => r.technicianId).sort()).toEqual(['tech-1', 'tech-2'])
  })

  it('sorts by avgTurnaroundDays ascending — fastest technician first', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([
      makeCompletedTicket({ technicianId: 'tech-slow', technician: { fullName: 'Slow Tech' }, receivedDate: new Date('2026-08-01T00:00:00Z'), deliveredDate: new Date('2026-08-10T00:00:00Z') }),
      makeCompletedTicket({ technicianId: 'tech-fast', technician: { fullName: 'Fast Tech' }, receivedDate: new Date('2026-08-01T00:00:00Z'), deliveredDate: new Date('2026-08-02T00:00:00Z') }),
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepairTurnaroundByTechnicianReport()

    expect(result.rows.map(r => r.technicianId)).toEqual(['tech-fast', 'tech-slow'])
  })

  it('queries only tickets with a technician assigned AND a real completion date', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { repairTicket: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateRepairTurnaroundByTechnicianReport()

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { technicianId: { not: null }, deliveredDate: { not: null } }
    }))
  })

  it('computes an overall average across every completed ticket, regardless of technician', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([
      makeCompletedTicket({ technicianId: 'tech-1', receivedDate: new Date('2026-08-01T00:00:00Z'), deliveredDate: new Date('2026-08-02T00:00:00Z') }), // 1 day
      makeCompletedTicket({ technicianId: 'tech-2', technician: { fullName: 'Sana Sheikh' }, receivedDate: new Date('2026-08-01T00:00:00Z'), deliveredDate: new Date('2026-08-06T00:00:00Z') }), // 5 days
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepairTurnaroundByTechnicianReport()

    expect(result.summary).toEqual({ technicianCount: 2, totalTicketsCompleted: 2, overallAvgTurnaroundDays: 3 })
  })

  it('returns an honest empty result when no ticket has both a technician and a completion date', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepairTurnaroundByTechnicianReport()

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ technicianCount: 0, totalTicketsCompleted: 0, overallAvgTurnaroundDays: 0 })
  })
})

// ─── Variant Stock Report (Phase 54B — closes CLOTHING/FOOTWEAR's zero-report gap) ─

describe('reportService.generateVariantStockReport', () => {
  it('aggregates total stock and counts out-of-stock variants', async () => {
    const db = {
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'v1', size: 'M', color: 'Blue', sku: 'SKU-1', stockQty: 5, isActive: true, product: { productName: 'T-Shirt' } },
          { id: 'v2', size: 'L', color: 'Red', sku: 'SKU-2', stockQty: 0, isActive: true, product: { productName: 'T-Shirt' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVariantStockReport()

    expect(result.summary).toEqual({ totalVariants: 2, totalStockQty: 5, outOfStockVariants: 1 })
  })
})

// ─── Test Score Report (Phase 54F — F.14's report companion) ────────────────

describe('reportService.generateTestScoreReport', () => {
  function makeScoreRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'sts-1', testName: 'Unit Test 1', subject: 'Mathematics',
      marksObtained: 42, maxMarks: 50, testDate: new Date('2026-07-01'), grade: 'A',
      enrollment: { student: { customerName: 'Riya Sharma' }, batch: { batchName: 'Batch A' } },
      ...overrides,
    }
  }

  it('computes percentage per row, an overall average, and flags below-50% count', async () => {
    const db = {
      studentTestScore: {
        findMany: vi.fn().mockResolvedValue([
          makeScoreRow({ marksObtained: 42, maxMarks: 50 }), // 84%
          makeScoreRow({ id: 'sts-2', marksObtained: 15, maxMarks: 50, enrollment: { student: { customerName: 'Aman Verma' }, batch: { batchName: 'Batch A' } } }), // 30%
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTestScoreReport({})

    expect(result.summary.totalTests).toBe(2)
    expect(result.summary.belowFiftyCount).toBe(1)
    expect(result.summary.studentCount).toBe(2)
    expect(result.rows.find(r => r.studentName === 'Riya Sharma')?.percentage).toBe(84)
    expect(result.rows.find(r => r.studentName === 'Aman Verma')?.percentage).toBe(30)
  })

  it('averages multiple scores for the same student into one studentSummaries entry, ranked highest first', async () => {
    const db = {
      studentTestScore: {
        findMany: vi.fn().mockResolvedValue([
          makeScoreRow({ id: 'sts-1', marksObtained: 40, maxMarks: 50 }), // 80%
          makeScoreRow({ id: 'sts-2', marksObtained: 45, maxMarks: 50 }), // 90%
          makeScoreRow({ id: 'sts-3', marksObtained: 10, maxMarks: 50, enrollment: { student: { customerName: 'Aman Verma' }, batch: { batchName: 'Batch A' } } }), // 20%
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTestScoreReport({})

    expect(result.studentSummaries).toHaveLength(2)
    expect(result.studentSummaries[0]).toMatchObject({ studentName: 'Riya Sharma', testCount: 2, averagePercentage: 85 })
    expect(result.studentSummaries[1]).toMatchObject({ studentName: 'Aman Verma', testCount: 1, averagePercentage: 20 })
  })

  it('filters by batchId via the enrollment relation', async () => {
    const db = { studentTestScore: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateTestScoreReport({ batchId: 'batch-1' })

    expect(db.studentTestScore.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ enrollment: { batchId: 'batch-1' } })
    }))
  })

  it('returns zeroed summary when there are no test scores', async () => {
    const db = { studentTestScore: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTestScoreReport({})

    expect(result.summary).toEqual({ totalTests: 0, averagePercentage: 0, belowFiftyCount: 0, studentCount: 0 })
  })
})

// ─── Compliance Task Report (Phase 54F — F.9's report companion) ────────────

describe('reportService.generateComplianceTaskReport', () => {
  function makeTaskRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ct-1', title: 'GSTR-3B Filing', category: 'GST',
      dueDate: new Date(Date.now() + 3 * 86400000), status: 'PENDING', priority: 'NORMAL',
      client: { customerName: 'Acme Pvt Ltd' },
      ...overrides,
    }
  }

  it('only queries open-status tasks (PENDING/IN_PROGRESS/OVERDUE)', async () => {
    const db = { complianceTask: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateComplianceTaskReport()

    expect(db.complianceTask.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] } }
    }))
  })

  it('reclassifies a past-due PENDING task as OVERDUE for display, without requiring the stored status to already say so', async () => {
    const db = {
      complianceTask: {
        findMany: vi.fn().mockResolvedValue([
          makeTaskRow({ dueDate: new Date(Date.now() - 5 * 86400000), status: 'PENDING' }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateComplianceTaskReport()

    expect(result.rows[0].status).toBe('OVERDUE')
    expect(result.summary.overdueCount).toBe(1)
  })

  it('counts tasks due within 7 days (and not already overdue) as dueThisWeek', async () => {
    const db = {
      complianceTask: {
        findMany: vi.fn().mockResolvedValue([
          makeTaskRow({ id: 'ct-1', dueDate: new Date(Date.now() + 3 * 86400000), status: 'PENDING' }),
          makeTaskRow({ id: 'ct-2', dueDate: new Date(Date.now() + 20 * 86400000), status: 'PENDING' }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateComplianceTaskReport()

    expect(result.summary.dueThisWeekCount).toBe(1)
    expect(result.summary.totalOpen).toBe(2)
  })

  it('counts distinct clients, not distinct tasks', async () => {
    const db = {
      complianceTask: {
        findMany: vi.fn().mockResolvedValue([
          makeTaskRow({ id: 'ct-1', client: { customerName: 'Acme Pvt Ltd' } }),
          makeTaskRow({ id: 'ct-2', client: { customerName: 'Acme Pvt Ltd' } }),
          makeTaskRow({ id: 'ct-3', client: { customerName: 'Beta LLP' } }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateComplianceTaskReport()

    expect(result.summary.clientCount).toBe(2)
  })
})

describe('reportService.generateRentalStatusReport', () => {
  function makeCheckedOutBooking(overrides: Record<string, unknown> = {}) {
    return {
      bookingNumber: 'RENT-00001', customerId: 'cust-1',
      startDateTime: new Date('2026-07-01T00:00:00Z'), endDateTime: new Date('2026-07-10T00:00:00Z'),
      customer: { customerName: 'Test Customer' },
      items: [{ product: { productName: 'Party Tent' }, rentalUnit: null }],
      ...overrides,
    }
  }

  it('only queries CHECKED_OUT bookings', async () => {
    const db = { rentalBooking: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateRentalStatusReport()

    expect(db.rentalBooking.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'CHECKED_OUT' } }))
  })

  it('flags a booking past its endDateTime as overdue with the correct day count, computed live (never from a stored flag)', async () => {
    const db = {
      rentalBooking: {
        findMany: vi.fn().mockResolvedValue([
          makeCheckedOutBooking({ endDateTime: new Date(Date.now() - 3 * 86_400_000 - 1000) }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRentalStatusReport()

    expect(result.rows[0].isOverdue).toBe(true)
    expect(result.rows[0].daysOverdue).toBe(4)
    expect(result.summary.overdueCount).toBe(1)
  })

  it('does not flag a booking whose return date is still in the future', async () => {
    const db = {
      rentalBooking: {
        findMany: vi.fn().mockResolvedValue([
          makeCheckedOutBooking({ endDateTime: new Date(Date.now() + 5 * 86_400_000) }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRentalStatusReport()

    expect(result.rows[0].isOverdue).toBe(false)
    expect(result.summary.overdueCount).toBe(0)
  })

  it('emits one row per booking item, not one row per booking, for a multi-item booking', async () => {
    const db = {
      rentalBooking: {
        findMany: vi.fn().mockResolvedValue([
          makeCheckedOutBooking({
            items: [
              { product: { productName: 'Party Tent' }, rentalUnit: null },
              { product: { productName: 'Chairs' }, rentalUnit: null },
            ],
          }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRentalStatusReport()

    expect(result.rows).toHaveLength(2)
    expect(result.summary.totalCheckedOut).toBe(1) // booking count, not item-row count
  })

  // Phase 67 §9.1 — Rental item 4: Overdue Returns aging bar.
  it('buckets an overdue booking into the correct aging bucket, one per BOOKING not per item row', async () => {
    const db = {
      rentalBooking: {
        findMany: vi.fn().mockResolvedValue([
          makeCheckedOutBooking({
            endDateTime: new Date(Date.now() - 5 * 86_400_000 - 1000), // 6 days overdue -> "4-7 days"
            items: [
              { product: { productName: 'Party Tent' }, rentalUnit: null },
              { product: { productName: 'Chairs' }, rentalUnit: null },
            ],
          }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRentalStatusReport()

    const bucket47 = result.agingBuckets.find((b) => b.bucket === '4-7 days')
    expect(bucket47?.count).toBe(1) // one booking, not two (despite 2 item rows)
    expect(result.agingBuckets.filter((b) => b.bucket !== '4-7 days').every((b) => b.count === 0)).toBe(true)
  })

  it('excludes non-overdue bookings from every aging bucket', async () => {
    const db = {
      rentalBooking: {
        findMany: vi.fn().mockResolvedValue([
          makeCheckedOutBooking({ endDateTime: new Date(Date.now() + 5 * 86_400_000) }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRentalStatusReport()

    expect(result.agingBuckets.every((b) => b.count === 0)).toBe(true)
  })

  it('places a booking 20 days overdue in the 15+ days bucket', async () => {
    const db = {
      rentalBooking: {
        findMany: vi.fn().mockResolvedValue([
          makeCheckedOutBooking({ endDateTime: new Date(Date.now() - 20 * 86_400_000 - 1000) }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRentalStatusReport()

    expect(result.agingBuckets.find((b) => b.bucket === '15+ days')?.count).toBe(1)
  })
})

describe('reportService.generateRentalRevenueReport', () => {
  it('queries only CHECKED_OUT/RETURNED bookings overlapping the requested range', async () => {
    const db = {
      rentalBookingItem: { findMany: vi.fn().mockResolvedValue([]) },
      product: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateRentalRevenueReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(db.rentalBookingItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ booking: expect.objectContaining({ status: { in: ['CHECKED_OUT', 'RETURNED'] } }) }),
    }))
  })

  it('sums totalRevenue and bookingCount per product across multiple items of the same product', async () => {
    const db = {
      rentalBookingItem: {
        findMany: vi.fn().mockResolvedValue([
          { lineTotal: 1500, product: { productName: 'Party Tent', rentalTrackingType: 'BULK' }, booking: { startDateTime: new Date('2026-07-05T00:00:00Z'), endDateTime: new Date('2026-07-08T00:00:00Z') } },
          { lineTotal: 2000, product: { productName: 'Party Tent', rentalTrackingType: 'BULK' }, booking: { startDateTime: new Date('2026-07-10T00:00:00Z'), endDateTime: new Date('2026-07-12T00:00:00Z') } },
        ]),
      },
      product: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRentalRevenueReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].bookingCount).toBe(2)
    expect(result.rows[0].totalRevenue).toBe(3500)
    expect(result.summary.totalRevenue).toBe(3500)
    expect(result.summary.totalBookings).toBe(2)
  })

  it('computes utilizationPercent from real day-overlap with the requested range, not a naive booking-count ratio', async () => {
    // Booking spans the FULL 10-day range; a naive "1 booking = 1 day" formula
    // would badly understate this. 1 unit x 10 range-days = 10 unit-days
    // available; the booking covers all 10 -> 100% utilization.
    const db = {
      rentalBookingItem: {
        findMany: vi.fn().mockResolvedValue([
          { lineTotal: 20000, product: { productName: 'Sedan Car', rentalTrackingType: 'UNIT' }, booking: { startDateTime: new Date('2026-07-01T00:00:00Z'), endDateTime: new Date('2026-07-11T00:00:00Z') } },
        ]),
      },
      product: { findMany: vi.fn().mockResolvedValue([{ productName: 'Sedan Car', rentalUnits: [{ id: 'unit-1' }] }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRentalRevenueReport({ dateFrom: '2026-07-01', dateTo: '2026-07-10' })

    // Naive "bookingCount / (unitCount * rangeDays)" formula would give
    // 1/(1*10)*100 = 10% here — the real overlap-based formula must land
    // far above that, close to full utilization (exact value shifts a
    // couple points with local-timezone end-of-day rounding, per the
    // to.setHours(23,59,59,999) convention shared by every report in this file).
    expect(result.rows[0].unitCount).toBe(1)
    expect(result.rows[0].utilizationPercent!).toBeGreaterThan(90)
    expect(result.rows[0].utilizationPercent!).toBeLessThanOrEqual(100)
  })

  it('clips overlap to the requested range when the booking extends beyond it on either side', async () => {
    // Range is 10 days (Jul 1-10); booking runs Jun 25 - Jul 5, so only 5
    // of those days (Jul 1-5) fall inside the requested range.
    const db = {
      rentalBookingItem: {
        findMany: vi.fn().mockResolvedValue([
          { lineTotal: 10000, product: { productName: 'Sedan Car', rentalTrackingType: 'UNIT' }, booking: { startDateTime: new Date('2026-06-25T00:00:00Z'), endDateTime: new Date('2026-07-05T00:00:00Z') } },
        ]),
      },
      product: { findMany: vi.fn().mockResolvedValue([{ productName: 'Sedan Car', rentalUnits: [{ id: 'unit-1' }] }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRentalRevenueReport({ dateFrom: '2026-07-01', dateTo: '2026-07-10' })

    // Roughly 5 of the 10 range-days are covered (~30-50% after end-of-day
    // rounding) — well below the ~98% seen when the booking covers the
    // whole range, and well above the naive formula's 10%, confirming the
    // overlap is genuinely being clipped to the requested range.
    expect(result.rows[0].utilizationPercent!).toBeGreaterThan(20)
    expect(result.rows[0].utilizationPercent!).toBeLessThan(60)
  })

  it('leaves utilizationPercent null for BULK products (no unit-count denominator applies)', async () => {
    const db = {
      rentalBookingItem: {
        findMany: vi.fn().mockResolvedValue([
          { lineTotal: 1500, product: { productName: 'Party Tent', rentalTrackingType: 'BULK' }, booking: { startDateTime: new Date('2026-07-05T00:00:00Z'), endDateTime: new Date('2026-07-08T00:00:00Z') } },
        ]),
      },
      product: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRentalRevenueReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.rows[0].unitCount).toBeNull()
    expect(result.rows[0].utilizationPercent).toBeNull()
  })

  it('sorts rows by totalRevenue descending', async () => {
    const db = {
      rentalBookingItem: {
        findMany: vi.fn().mockResolvedValue([
          { lineTotal: 500, product: { productName: 'Chairs', rentalTrackingType: 'BULK' }, booking: { startDateTime: new Date('2026-07-05T00:00:00Z'), endDateTime: new Date('2026-07-06T00:00:00Z') } },
          { lineTotal: 5000, product: { productName: 'Sedan Car', rentalTrackingType: 'UNIT' }, booking: { startDateTime: new Date('2026-07-05T00:00:00Z'), endDateTime: new Date('2026-07-06T00:00:00Z') } },
        ]),
      },
      product: { findMany: vi.fn().mockResolvedValue([{ productName: 'Sedan Car', rentalUnits: [{ id: 'unit-1' }] }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRentalRevenueReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.rows.map((r) => r.productName)).toEqual(['Sedan Car', 'Chairs'])
  })
})

// Phase 67 §9.1 — Rental item 3: Asset Utilization Rate, per individual
// unit — deliberately distinct from generateRentalRevenueReport's own
// per-PRODUCT utilizationPercent, which averages across every unit of a
// product and can't surface one specific idle asset hiding behind a busy
// sibling of the same product.
describe('reportService.generateAssetUtilizationReport', () => {
  function makeUnit(overrides: Record<string, unknown> = {}) {
    return { id: 'unit-1', unitLabel: 'KA01AB1234', status: 'AVAILABLE', product: { productName: 'Sedan Car' }, ...overrides }
  }

  it('excludes RETIRED units from the query', async () => {
    const db = { rentalUnit: { findMany: vi.fn().mockResolvedValue([]) }, rentalBookingItem: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateAssetUtilizationReport({ dateFrom: '2026-07-01', dateTo: '2026-07-10' })

    expect(db.rentalUnit.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: { not: 'RETIRED' } } }))
  })

  it('returns an honest empty result when there are no tracked units', async () => {
    const db = { rentalUnit: { findMany: vi.fn().mockResolvedValue([]) }, rentalBookingItem: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateAssetUtilizationReport({ dateFrom: '2026-07-01', dateTo: '2026-07-10' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalUnits: 0, avgUtilizationPercent: 0, idleUnitCount: 0 })
  })

  it('computes near-100% utilization for a unit booked across the entire requested range', async () => {
    const db = {
      rentalUnit: { findMany: vi.fn().mockResolvedValue([makeUnit()]) },
      rentalBookingItem: {
        findMany: vi.fn().mockResolvedValue([
          { rentalUnitId: 'unit-1', booking: { startDateTime: new Date('2026-07-01T00:00:00Z'), endDateTime: new Date('2026-07-11T00:00:00Z') } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateAssetUtilizationReport({ dateFrom: '2026-07-01', dateTo: '2026-07-10' })

    expect(result.rows[0].utilizationPercent).toBeGreaterThan(90)
  })

  it('reports 0% utilization for a unit with no bookings in range — a genuinely idle asset', async () => {
    const db = {
      rentalUnit: { findMany: vi.fn().mockResolvedValue([makeUnit()]) },
      rentalBookingItem: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateAssetUtilizationReport({ dateFrom: '2026-07-01', dateTo: '2026-07-10' })

    expect(result.rows[0].utilizationPercent).toBe(0)
    expect(result.summary.idleUnitCount).toBe(1)
  })

  it('keeps two units of the same product distinct, rather than averaging them like the per-product report does', async () => {
    const db = {
      rentalUnit: { findMany: vi.fn().mockResolvedValue([makeUnit({ id: 'unit-1', unitLabel: 'Car A' }), makeUnit({ id: 'unit-2', unitLabel: 'Car B' })]) },
      rentalBookingItem: {
        findMany: vi.fn().mockResolvedValue([
          // Only unit-1 gets a booking — unit-2 stays fully idle.
          { rentalUnitId: 'unit-1', booking: { startDateTime: new Date('2026-07-01T00:00:00Z'), endDateTime: new Date('2026-07-11T00:00:00Z') } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateAssetUtilizationReport({ dateFrom: '2026-07-01', dateTo: '2026-07-10' })

    const carA = result.rows.find((r) => r.unitLabel === 'Car A')
    const carB = result.rows.find((r) => r.unitLabel === 'Car B')
    expect(carA!.utilizationPercent).toBeGreaterThan(90)
    expect(carB!.utilizationPercent).toBe(0)
  })

  it('sorts rows by utilizationPercent ascending — worst-earning assets first, the actionable list', async () => {
    const db = {
      rentalUnit: { findMany: vi.fn().mockResolvedValue([makeUnit({ id: 'unit-1', unitLabel: 'Busy Car' }), makeUnit({ id: 'unit-2', unitLabel: 'Idle Car' })]) },
      rentalBookingItem: {
        findMany: vi.fn().mockResolvedValue([
          { rentalUnitId: 'unit-1', booking: { startDateTime: new Date('2026-07-01T00:00:00Z'), endDateTime: new Date('2026-07-11T00:00:00Z') } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateAssetUtilizationReport({ dateFrom: '2026-07-01', dateTo: '2026-07-10' })

    expect(result.rows.map((r) => r.unitLabel)).toEqual(['Idle Car', 'Busy Car'])
  })
})

// ─── Service Project Report (fresh-audit fix, 2026-07-12; renamed + kept ────
// unchanged in the 2026-07-16 real-bug-fix split) — for the six ServiceProject
// -using verticals (Independent Consultant/Architect/Civil Engineer/Marketing
// Agency/Software Agency/Real Estate), gated on the `service_projects` module.
// This was formerly called generateProjectReport but was wired to the wrong
// tile gate (`projects`, the legacy SERVICE/CONSULTANT module) — see
// generateProjectReport below for the corrected legacy-model report.

describe('reportService.generateServiceProjectReport', () => {
  function makeProjectRow(overrides: Record<string, unknown> = {}) {
    return {
      projectName: 'Website Revamp', status: 'ACTIVE', projectType: 'GENERAL',
      totalContractValue: 50000,
      startDate: new Date('2026-01-05'), expectedEndDate: new Date('2026-03-05'), completedDate: null,
      client: { customerName: 'Acme Pvt Ltd' },
      ...overrides,
    }
  }

  it('summarizes projects by status and total contract value', async () => {
    const db = {
      serviceProject: {
        findMany: vi.fn().mockResolvedValue([
          makeProjectRow(),
          makeProjectRow({ projectName: 'Brand Refresh', status: 'COMPLETED', totalContractValue: 20000 }),
          makeProjectRow({ projectName: 'Paused Project', status: 'ON_HOLD', totalContractValue: 10000 }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateServiceProjectReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })

    expect(result.summary.totalProjects).toBe(3)
    expect(result.summary.active).toBe(1)
    expect(result.summary.completed).toBe(1)
    expect(result.summary.onHold).toBe(1)
    expect(result.summary.totalContractValue).toBe(80000)
  })

  it('treats a null totalContractValue as zero in the summary total without crashing', async () => {
    const db = {
      serviceProject: { findMany: vi.fn().mockResolvedValue([makeProjectRow({ totalContractValue: null })]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateServiceProjectReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })

    expect(result.summary.totalContractValue).toBe(0)
    expect(result.rows[0].totalContractValue).toBeNull()
  })

  it('reads the client name from the required client relation', async () => {
    const db = { serviceProject: { findMany: vi.fn().mockResolvedValue([makeProjectRow()]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateServiceProjectReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })

    expect(result.rows[0].clientName).toBe('Acme Pvt Ltd')
  })
})

// ─── Project Report (real bug fix, 2026-07-16) — for the legacy SERVICE/ ────
// CONSULTANT `Project` model, gated on the `projects` module. Previously this
// name/gate pointed at ServiceProject data (see above) and was permanently
// empty for these two business types; now genuinely queries `db.project`.

describe('reportService.generateProjectReport', () => {
  function makeLegacyProjectRow(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Website Revamp', status: 'OPEN', priority: 'MEDIUM',
      estimatedAmount: 50000,
      startDate: new Date('2026-01-05'), dueDate: new Date('2026-03-05'), completedDate: null,
      customer: { customerName: 'Acme Pvt Ltd' },
      ...overrides,
    }
  }

  it('summarizes projects by status and total estimated amount', async () => {
    const db = {
      project: {
        findMany: vi.fn().mockResolvedValue([
          makeLegacyProjectRow(),
          makeLegacyProjectRow({ title: 'Brand Refresh', status: 'COMPLETED', estimatedAmount: 20000 }),
          makeLegacyProjectRow({ title: 'Paused Project', status: 'ON_HOLD', estimatedAmount: 10000 }),
          makeLegacyProjectRow({ title: 'Kickoff Pending', status: 'IN_PROGRESS', estimatedAmount: 5000 }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProjectReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })

    expect(result.summary.totalProjects).toBe(4)
    expect(result.summary.open).toBe(1)
    expect(result.summary.inProgress).toBe(1)
    expect(result.summary.completed).toBe(1)
    expect(result.summary.onHold).toBe(1)
    expect(result.summary.totalEstimatedAmount).toBe(85000)
  })

  it('treats a project with no linked customer (freestanding) without crashing', async () => {
    const db = {
      project: { findMany: vi.fn().mockResolvedValue([makeLegacyProjectRow({ customer: null })]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProjectReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })

    expect(result.rows[0].clientName).toBeNull()
  })

  it('reads the client name from the optional customer relation when present', async () => {
    const db = { project: { findMany: vi.fn().mockResolvedValue([makeLegacyProjectRow()]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProjectReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })

    expect(result.rows[0].clientName).toBe('Acme Pvt Ltd')
    expect(result.rows[0].title).toBe('Website Revamp')
    expect(result.rows[0].priority).toBe('MEDIUM')
  })
})

// Phase 67 §9.1 — Service item 2: Resolution Time by Category.
describe('reportService.generateServiceResolutionTimeReport', () => {
  it('groups resolved tickets by category with avg/min/max resolution hours', async () => {
    const db = {
      serviceTicket: {
        findMany: vi.fn().mockResolvedValue([
          { category: 'Plumbing', createdAt: new Date('2026-08-01T00:00:00'), resolvedAt: new Date('2026-08-01T10:00:00') }, // 10h
          { category: 'Plumbing', createdAt: new Date('2026-08-02T00:00:00'), resolvedAt: new Date('2026-08-02T20:00:00') }, // 20h
          { category: 'Electrical', createdAt: new Date('2026-08-03T00:00:00'), resolvedAt: new Date('2026-08-03T05:00:00') }, // 5h
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateServiceResolutionTimeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    const plumbing = result.rows.find(r => r.category === 'Plumbing')
    expect(plumbing).toEqual({ category: 'Plumbing', ticketCount: 2, avgHours: 15, minHours: 10, maxHours: 20 })
    expect(result.summary.totalResolved).toBe(3)
  })

  it('groups a ticket with no category under "Uncategorized" rather than dropping it', async () => {
    const db = {
      serviceTicket: { findMany: vi.fn().mockResolvedValue([
        { category: null, createdAt: new Date('2026-08-01T00:00:00'), resolvedAt: new Date('2026-08-01T02:00:00') },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateServiceResolutionTimeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0].category).toBe('Uncategorized')
  })

  it('sorts categories by average resolution time descending — the slowest first', async () => {
    const db = {
      serviceTicket: { findMany: vi.fn().mockResolvedValue([
        { category: 'Fast', createdAt: new Date('2026-08-01T00:00:00'), resolvedAt: new Date('2026-08-01T01:00:00') },
        { category: 'Slow', createdAt: new Date('2026-08-01T00:00:00'), resolvedAt: new Date('2026-08-03T02:00:00') }, // 50h later
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateServiceResolutionTimeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0].category).toBe('Slow')
  })

  it('returns an honest empty result when nothing was resolved in range', async () => {
    const db = { serviceTicket: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateServiceResolutionTimeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toHaveLength(0)
    expect(result.summary.overallAvgHours).toBe(0)
  })
})

// Phase 67 §9.1 — Service item 4: Repeat-Business Rate.
describe('reportService.generateRepeatBusinessRateReport', () => {
  it('treats a customer with an earlier ticket before the month as repeat business', async () => {
    const db = {
      serviceTicket: { findMany: vi.fn().mockResolvedValue([
        { customerId: 'cust-1', createdAt: new Date('2026-07-01') }, // first-ever ticket, before range
        { customerId: 'cust-1', createdAt: new Date('2026-08-10') }, // repeat, in range
        { customerId: 'cust-2', createdAt: new Date('2026-08-15') }, // new, in range
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepeatBusinessRateReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([{ month: '2026-08', newCustomers: 1, repeatCustomers: 1, repeatRatePercent: 50 }])
  })

  it('does not count a customer\'s very first ticket (within the range) as repeat business', async () => {
    const db = {
      serviceTicket: { findMany: vi.fn().mockResolvedValue([
        { customerId: 'cust-1', createdAt: new Date('2026-08-05') },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepeatBusinessRateReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0]).toEqual({ month: '2026-08', newCustomers: 1, repeatCustomers: 0, repeatRatePercent: 0 })
  })

  it('ignores tickets with no linked customer entirely', async () => {
    const db = {
      serviceTicket: { findMany: vi.fn().mockResolvedValue([
        { customerId: null, createdAt: new Date('2026-08-05') },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepeatBusinessRateReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toHaveLength(0)
  })

  it('buckets each month separately across a multi-month range', async () => {
    const db = {
      serviceTicket: { findMany: vi.fn().mockResolvedValue([
        { customerId: 'cust-1', createdAt: new Date('2026-07-05') },
        { customerId: 'cust-2', createdAt: new Date('2026-08-05') },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepeatBusinessRateReport({ dateFrom: '2026-07-01', dateTo: '2026-08-31' })

    expect(result.rows.map(r => r.month)).toEqual(['2026-07', '2026-08'])
  })
})

// Phase 67 §9.1 — Consultant item 2: Utilization Rate.
describe('reportService.generateConsultantUtilizationReport', () => {
  it('splits billable vs. non-billable hours per staff member', async () => {
    const db = {
      workLog: {
        findMany: vi.fn().mockResolvedValue([
          { hours: 6, billable: true, userId: 'u1', user: { fullName: 'Asha' } },
          { hours: 2, billable: false, userId: 'u1', user: { fullName: 'Asha' } },
          { hours: 4, billable: true, userId: 'u2', user: { fullName: 'Ravi' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateConsultantUtilizationReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    const asha = result.rows.find(r => r.userName === 'Asha')
    expect(asha).toEqual({ userName: 'Asha', billableHours: 6, nonBillableHours: 2, totalHours: 8, utilizationPercent: 75 })
    expect(result.summary.totalBillableHours).toBe(10)
    expect(result.summary.totalNonBillableHours).toBe(2)
  })

  it('sorts staff ascending by utilization — the least-utilized consultant first', async () => {
    const db = {
      workLog: {
        findMany: vi.fn().mockResolvedValue([
          { hours: 10, billable: true, userId: 'u1', user: { fullName: 'FullyBooked' } },
          { hours: 1, billable: true, userId: 'u2', user: { fullName: 'Underutilized' } },
          { hours: 9, billable: false, userId: 'u2', user: { fullName: 'Underutilized' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateConsultantUtilizationReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0].userName).toBe('Underutilized')
  })

  it('returns an honest empty result when no billable work was logged', async () => {
    const db = { workLog: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateConsultantUtilizationReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toHaveLength(0)
    expect(result.summary.overallUtilizationPercent).toBe(0)
  })
})

// Phase 67 §9.1 — Consultant item 4: Client Profitability.
describe('reportService.generateClientProfitabilityReport', () => {
  it('computes revenue-per-hour from a customer\'s invoiced projects and logged hours', async () => {
    const db = {
      project: {
        findMany: vi.fn().mockResolvedValue([
          { customerId: 'c1', customer: { customerName: 'Acme Co' }, invoiceId: 'inv-1', workLogs: [{ hours: 10 }, { hours: 10 }] },
        ]),
      },
      invoice: { findMany: vi.fn().mockResolvedValue([{ id: 'inv-1', totalAmount: 40000 }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateClientProfitabilityReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([{ customerName: 'Acme Co', revenue: 40000, hoursSpent: 20, revenuePerHour: 2000 }])
  })

  it('sorts clients ascending by revenue-per-hour — the least-profitable client first', async () => {
    const db = {
      project: {
        findMany: vi.fn().mockResolvedValue([
          { customerId: 'c1', customer: { customerName: 'HighValue' }, invoiceId: 'inv-1', workLogs: [{ hours: 1 }] },
          { customerId: 'c2', customer: { customerName: 'LowValue' }, invoiceId: 'inv-2', workLogs: [{ hours: 100 }] },
        ]),
      },
      invoice: { findMany: vi.fn().mockResolvedValue([{ id: 'inv-1', totalAmount: 10000 }, { id: 'inv-2', totalAmount: 10000 }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateClientProfitabilityReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0].customerName).toBe('LowValue')
  })

  it('handles a project with hours logged but never invoiced — revenue 0, not NaN', async () => {
    const db = {
      project: {
        findMany: vi.fn().mockResolvedValue([
          { customerId: 'c1', customer: { customerName: 'Prospect Inc' }, invoiceId: null, workLogs: [{ hours: 5 }] },
        ]),
      },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateClientProfitabilityReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0]).toEqual({ customerName: 'Prospect Inc', revenue: 0, hoursSpent: 5, revenuePerHour: 0 })
  })

  it('returns an honest empty result when no customer-linked projects exist in range', async () => {
    const db = { project: { findMany: vi.fn().mockResolvedValue([]) }, invoice: { findMany: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateClientProfitabilityReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toHaveLength(0)
    expect(db.invoice.findMany).not.toHaveBeenCalled()
  })
})

// Phase 67 §9.1 — Repair item 2: Turnaround by Technician (generic JobCard).
describe('reportService.generateJobCardTurnaroundByTechnicianReport', () => {
  it('groups delivered job cards by technician with avg/fastest/slowest turnaround', async () => {
    const db = {
      jobCard: {
        findMany: vi.fn().mockResolvedValue([
          { assignedTo: { fullName: 'Ravi' }, receivedDate: new Date('2026-08-01T00:00:00'), deliveredDate: new Date('2026-08-01T10:00:00') }, // 10h
          { assignedTo: { fullName: 'Ravi' }, receivedDate: new Date('2026-08-02T00:00:00'), deliveredDate: new Date('2026-08-02T20:00:00') }, // 20h
          { assignedTo: { fullName: 'Asha' }, receivedDate: new Date('2026-08-03T00:00:00'), deliveredDate: new Date('2026-08-03T05:00:00') }, // 5h
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateJobCardTurnaroundByTechnicianReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    const ravi = result.rows.find(r => r.technicianName === 'Ravi')
    expect(ravi).toEqual({ technicianName: 'Ravi', jobCount: 2, avgTurnaroundHours: 15, fastestHours: 10, slowestHours: 20 })
    expect(result.summary.totalDelivered).toBe(3)
  })

  it('groups an unassigned job card under "Unassigned" rather than dropping it', async () => {
    const db = {
      jobCard: { findMany: vi.fn().mockResolvedValue([
        { assignedTo: null, receivedDate: new Date('2026-08-01T00:00:00'), deliveredDate: new Date('2026-08-01T02:00:00') },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateJobCardTurnaroundByTechnicianReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0].technicianName).toBe('Unassigned')
  })

  it('sorts technicians by average turnaround descending — the slowest first', async () => {
    const db = {
      jobCard: { findMany: vi.fn().mockResolvedValue([
        { assignedTo: { fullName: 'Fast' }, receivedDate: new Date('2026-08-01T00:00:00'), deliveredDate: new Date('2026-08-01T01:00:00') },
        { assignedTo: { fullName: 'Slow' }, receivedDate: new Date('2026-08-01T00:00:00'), deliveredDate: new Date('2026-08-03T02:00:00') }, // 50h later
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateJobCardTurnaroundByTechnicianReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0].technicianName).toBe('Slow')
  })

  it('returns an honest empty result when nothing was delivered in range', async () => {
    const db = { jobCard: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateJobCardTurnaroundByTechnicianReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toHaveLength(0)
    expect(result.summary.overallAvgTurnaroundHours).toBe(0)
  })
})

// Phase 67 §9.1 — Repair item 4: Repair Category Volume Trend.
describe('reportService.generateRepairCategoryVolumeTrendReport', () => {
  it('buckets job cards by month and category', async () => {
    const db = {
      jobCard: { findMany: vi.fn().mockResolvedValue([
        { category: 'Screen Repair', createdAt: new Date('2026-08-05') },
        { category: 'Screen Repair', createdAt: new Date('2026-08-10') },
        { category: 'Battery Replacement', createdAt: new Date('2026-08-15') },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepairCategoryVolumeTrendReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual(expect.arrayContaining([
      { month: '2026-08', category: 'Screen Repair', count: 2 },
      { month: '2026-08', category: 'Battery Replacement', count: 1 },
    ]))
    expect(result.categories).toEqual(['Battery Replacement', 'Screen Repair'])
    expect(result.summary.totalJobs).toBe(3)
  })

  it('groups a job card with no category under "Uncategorized" rather than dropping it', async () => {
    const db = {
      jobCard: { findMany: vi.fn().mockResolvedValue([{ category: null, createdAt: new Date('2026-08-05') }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepairCategoryVolumeTrendReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0].category).toBe('Uncategorized')
  })

  it('buckets each month separately across a multi-month range', async () => {
    const db = {
      jobCard: { findMany: vi.fn().mockResolvedValue([
        { category: 'Screen Repair', createdAt: new Date('2026-07-05') },
        { category: 'Screen Repair', createdAt: new Date('2026-08-05') },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepairCategoryVolumeTrendReport({ dateFrom: '2026-07-01', dateTo: '2026-08-31' })

    expect(result.rows.map(r => r.month)).toEqual(['2026-07', '2026-08'])
  })

  it('returns an honest empty result when nothing was received in range', async () => {
    const db = { jobCard: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRepairCategoryVolumeTrendReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toHaveLength(0)
    expect(result.categories).toHaveLength(0)
    expect(result.summary.totalJobs).toBe(0)
  })
})

// Phase 67 §9.1 — Distributor item 3: Field-Rep Performance Leaderboard.
// Sorted DESCENDING by value (best-first), deliberately the opposite of
// this phase's usual worst-first convention — a leaderboard celebrates top
// performers. hitRatePercent is null (not 0) for a rep with no active beat.
describe('reportService.generateFieldRepLeaderboardReport', () => {
  it('groups accepted field orders by rep, summing value via the linked invoice', async () => {
    const db = {
      fieldOrderRequest: {
        findMany: vi.fn().mockResolvedValue([
          { repName: 'Ravi', customerId: 'c1', invoiceId: 'inv-1' },
          { repName: 'Ravi', customerId: 'c2', invoiceId: 'inv-2' },
          { repName: 'Asha', customerId: 'c3', invoiceId: 'inv-3' },
        ]),
      },
      invoice: { findMany: vi.fn().mockResolvedValue([{ id: 'inv-1', totalAmount: 5000 }, { id: 'inv-2', totalAmount: 3000 }, { id: 'inv-3', totalAmount: 20000 }]) },
      distributorBeat: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFieldRepLeaderboardReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    const ravi = result.rows.find(r => r.repName === 'Ravi')
    expect(ravi).toMatchObject({ ordersBooked: 2, totalValue: 8000, distinctCustomersVisited: 2 })
    expect(result.summary.totalOrdersBooked).toBe(3)
    expect(result.summary.totalValue).toBe(28000)
  })

  it('sorts reps by total value descending — best-first, the deliberate exception to this phase\'s worst-first convention', async () => {
    const db = {
      fieldOrderRequest: {
        findMany: vi.fn().mockResolvedValue([
          { repName: 'LowValue', customerId: 'c1', invoiceId: 'inv-1' },
          { repName: 'HighValue', customerId: 'c2', invoiceId: 'inv-2' },
        ]),
      },
      invoice: { findMany: vi.fn().mockResolvedValue([{ id: 'inv-1', totalAmount: 1000 }, { id: 'inv-2', totalAmount: 50000 }]) },
      distributorBeat: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFieldRepLeaderboardReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0].repName).toBe('HighValue')
  })

  it('computes hit-rate against the rep\'s own active beat stops, null (not 0) when the rep has no active beat', async () => {
    const db = {
      fieldOrderRequest: {
        findMany: vi.fn().mockResolvedValue([
          { repName: 'Ravi', customerId: 'c1', invoiceId: null },
          { repName: 'NoBeat', customerId: 'c9', invoiceId: null },
        ]),
      },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      distributorBeat: {
        findMany: vi.fn().mockResolvedValue([
          { repName: 'Ravi', stops: [{ customerId: 'c1' }, { customerId: 'c2' }] },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFieldRepLeaderboardReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    const ravi = result.rows.find(r => r.repName === 'Ravi')
    expect(ravi?.plannedStops).toBe(2)
    expect(ravi?.hitRatePercent).toBe(50)
    const noBeat = result.rows.find(r => r.repName === 'NoBeat')
    expect(noBeat?.plannedStops).toBeNull()
    expect(noBeat?.hitRatePercent).toBeNull()
  })

  // Real bug caught during Phase 67's own final audit: distinctCustomersVisited
  // was wrongly filtered to only customers ALSO on the rep's beat plan,
  // silently undercounting a rep's true activity whenever they picked up a
  // genuine off-plan customer. It must always be the rep's real total —
  // the hit-rate (a SEPARATE figure) is the only thing that should be
  // narrowed to the planned/visited intersection.
  it('distinctCustomersVisited counts every real customer the rep ordered from, including ones NOT on their beat plan', async () => {
    const db = {
      fieldOrderRequest: {
        findMany: vi.fn().mockResolvedValue([
          { repName: 'Ravi', customerId: 'c1', invoiceId: null }, // on-plan
          { repName: 'Ravi', customerId: 'c9', invoiceId: null }, // OFF-plan
        ]),
      },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      distributorBeat: {
        findMany: vi.fn().mockResolvedValue([
          { repName: 'Ravi', stops: [{ customerId: 'c1' }, { customerId: 'c2' }] },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFieldRepLeaderboardReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    const ravi = result.rows.find(r => r.repName === 'Ravi')
    // Real total: 2 distinct customers (c1 + c9), NOT narrowed to the 1 that's on-plan.
    expect(ravi?.distinctCustomersVisited).toBe(2)
    // Hit-rate stays correctly scoped to the plan: only c1 of the 2 planned stops (c1, c2) was hit.
    expect(ravi?.plannedStops).toBe(2)
    expect(ravi?.hitRatePercent).toBe(50)
  })

  it('returns an honest empty result when no field orders were accepted in range', async () => {
    const db = {
      fieldOrderRequest: { findMany: vi.fn().mockResolvedValue([]) },
      invoice: { findMany: vi.fn() },
      distributorBeat: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFieldRepLeaderboardReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toHaveLength(0)
    expect(db.invoice.findMany).not.toHaveBeenCalled()
  })
})

// ─── Job Card Report (fresh-audit fix, 2026-07-12) — closes the zero-report ─
// gap for the REPAIR business type ──────────────────────────────────────────

describe('reportService.generateJobCardReport', () => {
  function makeJobRow(overrides: Record<string, unknown> = {}) {
    return {
      jobNumber: 'JOB-0001', title: 'Laptop screen replacement', status: 'RECEIVED', priority: 'MEDIUM',
      estimatedCost: 3000, actualCost: 0,
      receivedDate: new Date('2026-01-10'), expectedDate: new Date('2026-01-15'), deliveredDate: null,
      customer: { customerName: 'Walk-in Customer' },
      ...overrides,
    }
  }

  it('counts delivered vs. pending vs. cancelled jobs correctly', async () => {
    const db = {
      jobCard: {
        findMany: vi.fn().mockResolvedValue([
          makeJobRow(),
          makeJobRow({ jobNumber: 'JOB-0002', status: 'DELIVERED', deliveredDate: new Date('2026-01-20') }),
          makeJobRow({ jobNumber: 'JOB-0003', status: 'CANCELLED' }),
          makeJobRow({ jobNumber: 'JOB-0004', status: 'IN_REPAIR' }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateJobCardReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalJobs).toBe(4)
    expect(result.summary.delivered).toBe(1)
    expect(result.summary.cancelled).toBe(1)
    // pending = not DELIVERED and not CANCELLED (RECEIVED + IN_REPAIR here)
    expect(result.summary.pending).toBe(2)
  })

  it('sums estimated and actual cost across all jobs in the period', async () => {
    const db = {
      jobCard: {
        findMany: vi.fn().mockResolvedValue([
          makeJobRow({ estimatedCost: 3000, actualCost: 2800 }),
          makeJobRow({ jobNumber: 'JOB-0002', estimatedCost: 1500, actualCost: 1600 }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateJobCardReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalEstimatedCost).toBe(4500)
    expect(result.summary.totalActualCost).toBe(4400)
  })

  it('handles a job with no linked customer (walk-in) without crashing', async () => {
    const db = { jobCard: { findMany: vi.fn().mockResolvedValue([makeJobRow({ customer: null })]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateJobCardReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.rows[0].customerName).toBeNull()
  })
})

// ─── Phase 58 §1 — 10 new reports (2026-07-17) ────────────────────────────

describe('reportService.generateCarJobCardReport', () => {
  it('fans out technicianIds (JSON array) so a job with 2 techs counts once per tech', async () => {
    const db = {
      carJobCard: {
        findMany: vi.fn().mockResolvedValue([
          { jobNumber: 'CJ-1', client: { customerName: 'Ravi' }, vehicleNumber: 'MH01AB1234', vehicleMake: 'Maruti', vehicleModel: 'Swift', status: 'DELIVERED', laborTotal: 500, partsTotal: 200, technicianIds: JSON.stringify(['emp-1', 'emp-2']), createdAt: new Date('2026-01-05'), deliveredDate: new Date('2026-01-06') },
          { jobNumber: 'CJ-2', client: { customerName: 'Sana' }, vehicleNumber: 'MH02CD5678', vehicleMake: 'Hyundai', vehicleModel: 'i20', status: 'IN_PROGRESS', laborTotal: 300, partsTotal: 100, technicianIds: JSON.stringify(['emp-1']), createdAt: new Date('2026-01-10'), deliveredDate: null },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCarJobCardReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalJobs).toBe(2)
    expect(result.summary.delivered).toBe(1)
    expect(result.summary.totalLaborRevenue).toBe(800)
    expect(result.summary.totalPartsRevenue).toBe(300)
    const emp1 = result.byTechnician.find(t => t.technicianId === 'emp-1')
    const emp2 = result.byTechnician.find(t => t.technicianId === 'emp-2')
    expect(emp1?.jobCount).toBe(2)
    expect(emp2?.jobCount).toBe(1)
  })

  it('treats an unparsable technicianIds value as no technicians rather than crashing', async () => {
    const db = {
      carJobCard: {
        findMany: vi.fn().mockResolvedValue([
          { jobNumber: 'CJ-3', client: { customerName: 'X' }, vehicleNumber: 'MH03', vehicleMake: 'M', vehicleModel: 'X', status: 'RECEIVED', laborTotal: 0, partsTotal: 0, technicianIds: 'not-json', createdAt: new Date('2026-01-05'), deliveredDate: null },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCarJobCardReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.byTechnician).toEqual([])
  })
})

describe('reportService.generateTailoringOrderReport', () => {
  it('aggregates count and total amount per garment type', async () => {
    const db = {
      tailoringOrder: {
        findMany: vi.fn().mockResolvedValue([
          { orderNumber: 'TO-1', client: { customerName: 'A' }, garmentType: 'SHIRT', status: 'DELIVERED', quantity: 1, totalAmount: 800, createdAt: new Date('2026-01-05'), deliveryDate: new Date('2026-01-10') },
          { orderNumber: 'TO-2', client: { customerName: 'B' }, garmentType: 'SHIRT', status: 'READY', quantity: 2, totalAmount: 1600, createdAt: new Date('2026-01-06'), deliveryDate: null },
          { orderNumber: 'TO-3', client: { customerName: 'C' }, garmentType: 'SUIT', status: 'IN_CUTTING', quantity: 1, totalAmount: 5000, createdAt: new Date('2026-01-07'), deliveryDate: null },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTailoringOrderReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalOrders).toBe(3)
    expect(result.summary.delivered).toBe(1)
    const shirt = result.byGarmentType.find(g => g.garmentType === 'SHIRT')
    expect(shirt).toEqual({ garmentType: 'SHIRT', count: 2, totalAmount: 2400 })
  })
})

describe('reportService.generatePestContractReport', () => {
  it('flags only contracts with endDate within the next 30 days as expiring', async () => {
    const now = Date.now()
    const in10Days = new Date(now + 10 * 86400000)
    const in60Days = new Date(now + 60 * 86400000)
    const db = {
      pestServiceContract: {
        findMany: vi.fn().mockResolvedValue([
          { contractNumber: 'PC-1', client: { customerName: 'Soon' }, pestTypes: JSON.stringify(['RODENTS']), endDate: in10Days, contractValue: 12000 },
          { contractNumber: 'PC-2', client: { customerName: 'Later' }, pestTypes: JSON.stringify(['TERMITES']), endDate: in60Days, contractValue: 20000 },
        ]),
      },
      pestJobSheet: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePestContractReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.activeContracts).toBe(2)
    expect(result.summary.expiringWithin30Days).toBe(1)
    expect(result.expiring[0].contractNumber).toBe('PC-1')
  })

  it('attributes a completed visit\'s revenue to every pest type listed on its parent contract', async () => {
    const db = {
      pestServiceContract: { findMany: vi.fn().mockResolvedValue([]) },
      pestJobSheet: {
        findMany: vi.fn().mockResolvedValue([
          { jobAmount: 1000, contract: { pestTypes: JSON.stringify(['COCKROACHES', 'ANTS']) } },
          { jobAmount: 500, contract: { pestTypes: JSON.stringify(['COCKROACHES']) } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePestContractReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    const cockroaches = result.byPestType.find(p => p.pestType === 'COCKROACHES')
    const ants = result.byPestType.find(p => p.pestType === 'ANTS')
    expect(cockroaches).toEqual({ pestType: 'COCKROACHES', revenue: 1500, visitCount: 2 })
    expect(ants).toEqual({ pestType: 'ANTS', revenue: 1000, visitCount: 1 })
  })
})

describe('reportService.generateRealEstatePipelineReport', () => {
  it('only counts REGISTERED deals toward brokerage earned, and IN_PROGRESS toward the pipeline count', async () => {
    const db = {
      property: { findMany: vi.fn().mockResolvedValue([{ status: 'AVAILABLE' }, { status: 'SOLD' }]) },
      propertyInquiry: { findMany: vi.fn().mockResolvedValue([{ status: 'SHORTLISTED' }, { status: 'SHORTLISTED' }, { status: 'NEGOTIATION' }]) },
      propertyDeal: {
        findMany: vi.fn().mockResolvedValue([
          { property: { location: 'A' }, buyer: { customerName: 'B1' }, seller: { customerName: 'S1' }, dealValue: 5000000, brokerageAmount: 50000, status: 'REGISTERED', createdAt: new Date('2026-01-05') },
          { property: { location: 'B' }, buyer: { customerName: 'B2' }, seller: { customerName: 'S2' }, dealValue: 3000000, brokerageAmount: 30000, status: 'IN_PROGRESS', createdAt: new Date('2026-01-06') },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRealEstatePipelineReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalListings).toBe(2)
    expect(result.summary.availableListings).toBe(1)
    expect(result.summary.dealsInProgress).toBe(1)
    expect(result.summary.totalBrokerageEarned).toBe(50000)
    const shortlisted = result.byInquiryStage.find(s => s.stage === 'SHORTLISTED')
    expect(shortlisted?.count).toBe(2)
  })
})

describe('reportService.generateRetainerReport', () => {
  it('derives targetPeriod from dateTo and flags only retainers invoiced for that exact period', async () => {
    const db = {
      retainerAgreement: {
        findMany: vi.fn().mockResolvedValue([
          { title: 'Billed', client: { customerName: 'C1' }, status: 'ACTIVE', monthlyAmount: 15000, lastInvoicedPeriod: '2026-03' },
          { title: 'Not billed yet', client: { customerName: 'C2' }, status: 'ACTIVE', monthlyAmount: 20000, lastInvoicedPeriod: '2026-02' },
          { title: 'Paused', client: { customerName: 'C3' }, status: 'PAUSED', monthlyAmount: 10000, lastInvoicedPeriod: null },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRetainerReport({ dateFrom: '2026-03-01', dateTo: '2026-03-31' })

    expect(result.targetPeriod).toBe('2026-03')
    expect(result.summary.activeRetainers).toBe(2) // PAUSED excluded from "active"
    expect(result.summary.totalMRR).toBe(35000) // sum of ACTIVE only
    expect(result.summary.billedThisPeriodCount).toBe(1)
    expect(result.summary.billedThisPeriodAmount).toBe(15000)
    expect(result.rows.find(r => r.title === 'Billed')?.billedThisPeriod).toBe(true)
    expect(result.rows.find(r => r.title === 'Not billed yet')?.billedThisPeriod).toBe(false)
  })
})

describe('reportService.generateShootBookingReport', () => {
  it('treats a null finalAmount as zero in the revenue total without crashing', async () => {
    const db = {
      shootBooking: {
        findMany: vi.fn().mockResolvedValue([
          { client: { customerName: 'A' }, shootType: 'WEDDING', shootDate: new Date('2026-01-10'), status: 'DELIVERED', finalAmount: 50000 },
          { client: { customerName: 'B' }, shootType: 'WEDDING', shootDate: new Date('2026-01-15'), status: 'INQUIRY', finalAmount: null },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateShootBookingReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalRevenue).toBe(50000)
    expect(result.rows.find(r => r.clientName === 'B')?.finalAmount).toBeNull()
    expect(result.byShootType.find(s => s.shootType === 'WEDDING')?.count).toBe(2)
  })
})

describe('reportService.generateEventBookingReport', () => {
  it('groups bookings by status and sums revenue treating null finalAmount as zero', async () => {
    const db = {
      eventBooking: {
        findMany: vi.fn().mockResolvedValue([
          { client: { customerName: 'A' }, eventName: 'Wedding A', eventType: 'WEDDING', eventDate: new Date('2026-01-10'), status: 'COMPLETED', finalAmount: 200000 },
          { client: { customerName: 'B' }, eventName: 'Corp B', eventType: 'CORPORATE', eventDate: new Date('2026-01-12'), status: 'INQUIRY', finalAmount: null },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateEventBookingReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalBookings).toBe(2)
    expect(result.summary.completed).toBe(1)
    expect(result.summary.totalRevenue).toBe(200000)
    expect(result.byStatus.find(s => s.status === 'INQUIRY')?.count).toBe(1)
  })
})

describe('reportService.generatePlacementReport', () => {
  it('counts both JOINED and INVOICED as "joined", but only INVOICED as "invoiced"', async () => {
    const db = {
      placement: {
        findMany: vi.fn().mockResolvedValue([
          { placementNumber: 'PL-1', candidate: { fullName: 'Cand A' }, jobOrder: { jobTitle: 'Dev' }, client: { customerName: 'Client A' }, status: 'JOINED', joiningDate: new Date('2026-01-05'), offeredSalary: 800000, commissionAmount: 80000 },
          { placementNumber: 'PL-2', candidate: { fullName: 'Cand B' }, jobOrder: { jobTitle: 'QA' }, client: { customerName: 'Client B' }, status: 'INVOICED', joiningDate: new Date('2026-01-10'), offeredSalary: 600000, commissionAmount: 60000 },
          { placementNumber: 'PL-3', candidate: { fullName: 'Cand C' }, jobOrder: { jobTitle: 'PM' }, client: { customerName: 'Client C' }, status: 'CANCELLED', joiningDate: new Date('2026-01-12'), offeredSalary: 900000, commissionAmount: 0 },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePlacementReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalPlacements).toBe(3)
    expect(result.summary.joined).toBe(2)
    expect(result.summary.invoiced).toBe(1)
    expect(result.summary.totalCommission).toBe(140000)
  })
})

describe('reportService.generateDrawingRegisterReport', () => {
  it('reads the project name via the nested project relation and groups by status', async () => {
    const db = {
      drawingRevision: {
        findMany: vi.fn().mockResolvedValue([
          { drawingNumber: 'DWG-1', title: 'Ground Floor', project: { projectName: 'Villa Project' }, discipline: 'ARCHITECTURAL', revisionNumber: 'A', status: 'APPROVED', issuedDate: new Date('2026-01-05') },
          { drawingNumber: 'DWG-2', title: 'First Floor', project: { projectName: 'Villa Project' }, discipline: 'ARCHITECTURAL', revisionNumber: 'B', status: 'ISSUED_FOR_REVIEW', issuedDate: null },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDrawingRegisterReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalDrawings).toBe(2)
    expect(result.summary.approved).toBe(1)
    expect(result.summary.pendingReview).toBe(1)
    expect(result.rows[0].projectName).toBe('Villa Project')
  })
})

describe('reportService.generateSiteVisitLogReport', () => {
  it('filters by visitDate (not createdAt) and groups by visit type', async () => {
    const db = {
      siteVisit: {
        findMany: vi.fn().mockResolvedValue([
          { project: { projectName: 'Bridge Project' }, visitDate: new Date('2026-01-10'), visitType: 'INSPECTION', recordedBy: { fullName: 'Eng A' }, findings: 'All good' },
          { project: { projectName: 'Bridge Project' }, visitDate: new Date('2026-01-15'), visitType: 'INSPECTION', recordedBy: null, findings: null },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSiteVisitLogReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })
    const call = (db.siteVisit.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]

    expect(call.where).toHaveProperty('visitDate')
    expect(result.summary.totalVisits).toBe(2)
    expect(result.byVisitType.find(v => v.visitType === 'INSPECTION')?.count).toBe(2)
    expect(result.rows[1].recordedByName).toBeNull()
  })
})

// Phase 58 §2 — Pharmacy Schedule H/H1 prescription-drug sales register.
// Sourced from InvoiceItem's prescription snapshot (captured at sale time
// by billing.service.ts) filtered to isPrescriptionRequired products only,
// excluding cancelled invoices.
describe('reportService.generatePrescriptionDrugSalesReport', () => {
  it('filters to isPrescriptionRequired products and excludes cancelled invoices in the query', async () => {
    const db = {
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            invoice: { invoiceNumber: 'INV-001', createdAt: new Date('2026-01-10'), customer: { customerName: 'Ravi Kumar' } },
            productName: 'Amoxicillin 500mg', quantity: 10,
            prescriptionPatientName: 'Ravi Kumar', prescriptionDoctorName: 'Dr. Mehta',
            prescriptionDate: new Date('2026-01-09'), lineTotal: 250,
          },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePrescriptionDrugSalesReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })
    const call = (db.invoiceItem.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]

    expect(call.where.product).toEqual({ isPrescriptionRequired: true })
    expect(call.where.invoice).toEqual({ status: { not: 'CANCELLED' } })
    expect(result.summary.totalSales).toBe(1)
    expect(result.summary.totalAmount).toBe(250)
    expect(result.rows[0]).toMatchObject({
      invoiceNumber: 'INV-001', productName: 'Amoxicillin 500mg', quantity: 10,
      patientName: 'Ravi Kumar', doctorName: 'Dr. Mehta', customerName: 'Ravi Kumar', lineTotal: 250,
    })
  })

  it('flags rows missing patient/doctor details in the summary without excluding them from the register', async () => {
    const db = {
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          { invoice: { invoiceNumber: 'INV-001', createdAt: new Date('2026-01-10'), customer: null }, productName: 'Drug A', quantity: 1, prescriptionPatientName: 'Patient A', prescriptionDoctorName: 'Doc A', prescriptionDate: null, lineTotal: 100 },
          { invoice: { invoiceNumber: 'INV-002', createdAt: new Date('2026-01-11'), customer: null }, productName: 'Drug B', quantity: 1, prescriptionPatientName: null, prescriptionDoctorName: null, prescriptionDate: null, lineTotal: 50 },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePrescriptionDrugSalesReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalSales).toBe(2)
    expect(result.summary.missingPrescriptionDetails).toBe(1)
    expect(result.rows[1].patientName).toBeNull()
  })

  // Phase 67 §9.1 — Pharmacy's "Doctor-wise prescription volume" signature
  // win: extends this existing report with a doctor-grouped aggregation.
  it('groups sales by doctor, sorted by sales count descending, excluding rows with no doctor name', async () => {
    const db = {
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          { invoice: { invoiceNumber: 'INV-001', createdAt: new Date('2026-01-10'), customer: null }, productName: 'Drug A', quantity: 1, prescriptionPatientName: 'P1', prescriptionDoctorName: 'Dr. Mehta', prescriptionDate: null, lineTotal: 100 },
          { invoice: { invoiceNumber: 'INV-002', createdAt: new Date('2026-01-11'), customer: null }, productName: 'Drug B', quantity: 1, prescriptionPatientName: 'P2', prescriptionDoctorName: 'Dr. Mehta', prescriptionDate: null, lineTotal: 150 },
          { invoice: { invoiceNumber: 'INV-003', createdAt: new Date('2026-01-12'), customer: null }, productName: 'Drug C', quantity: 1, prescriptionPatientName: 'P3', prescriptionDoctorName: 'Dr. Rao', prescriptionDate: null, lineTotal: 200 },
          { invoice: { invoiceNumber: 'INV-004', createdAt: new Date('2026-01-13'), customer: null }, productName: 'Drug D', quantity: 1, prescriptionPatientName: null, prescriptionDoctorName: null, prescriptionDate: null, lineTotal: 999 },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePrescriptionDrugSalesReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.byDoctor).toEqual([
      { doctorName: 'Dr. Mehta', salesCount: 2, totalAmount: 250 },
      { doctorName: 'Dr. Rao', salesCount: 1, totalAmount: 200 },
    ])
  })

  it('returns an empty byDoctor array when no prescription sales have a doctor name', async () => {
    const db = {
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          { invoice: { invoiceNumber: 'INV-001', createdAt: new Date('2026-01-10'), customer: null }, productName: 'Drug A', quantity: 1, prescriptionPatientName: null, prescriptionDoctorName: null, prescriptionDate: null, lineTotal: 100 },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePrescriptionDrugSalesReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.byDoctor).toEqual([])
  })

  it('returns a zero-value summary and empty rows when there are no prescription sales in range', async () => {
    const db = { invoiceItem: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePrescriptionDrugSalesReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary).toEqual({ totalSales: 0, totalAmount: 0, missingPrescriptionDetails: 0 })
    expect(result.rows).toEqual([])
  })
})

// Phase 67 §9.1 — Pharmacy item 1: Schedule H1/X Narcotic Register — a
// STRICTER subcategory of the Prescription Drug Sales register above
// (filtered on Product.isScheduleH1X, not isPrescriptionRequired).
describe('reportService.generateScheduleH1XRegisterReport', () => {
  it('filters to isScheduleH1X products (not the broader isPrescriptionRequired flag) and excludes cancelled invoices', async () => {
    const db = {
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            invoice: { invoiceNumber: 'INV-001', createdAt: new Date('2026-01-10'), customer: { customerName: 'Ravi Kumar' } },
            productName: 'Alprazolam 0.5mg', quantity: 10,
            prescriptionPatientName: 'Ravi Kumar', prescriptionDoctorName: 'Dr. Mehta',
            prescriptionDate: new Date('2026-01-09'), lineTotal: 250,
          },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateScheduleH1XRegisterReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })
    const call = (db.invoiceItem.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]

    expect(call.where.product).toEqual({ isScheduleH1X: true })
    expect(call.where.invoice).toEqual({ status: { not: 'CANCELLED' } })
    expect(result.summary.totalSales).toBe(1)
    expect(result.summary.totalQuantity).toBe(10)
    expect(result.rows[0]).toMatchObject({
      invoiceNumber: 'INV-001', productName: 'Alprazolam 0.5mg', quantity: 10,
      patientName: 'Ravi Kumar', doctorName: 'Dr. Mehta', customerName: 'Ravi Kumar',
    })
  })

  it('flags rows missing patient/doctor details in the summary without excluding them from the register', async () => {
    const db = {
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          { invoice: { invoiceNumber: 'INV-001', createdAt: new Date('2026-01-10'), customer: null }, productName: 'Drug A', quantity: 1, prescriptionPatientName: 'Patient A', prescriptionDoctorName: 'Doc A', prescriptionDate: null, lineTotal: 100 },
          { invoice: { invoiceNumber: 'INV-002', createdAt: new Date('2026-01-11'), customer: null }, productName: 'Drug B', quantity: 2, prescriptionPatientName: null, prescriptionDoctorName: null, prescriptionDate: null, lineTotal: 50 },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateScheduleH1XRegisterReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.totalSales).toBe(2)
    expect(result.summary.totalQuantity).toBe(3)
    expect(result.summary.missingPrescriptionDetails).toBe(1)
    expect(result.rows[1].patientName).toBeNull()
  })

  it('returns a zero-value summary and empty rows when there are no Schedule H1/X sales in range', async () => {
    const db = { invoiceItem: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateScheduleH1XRegisterReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary).toEqual({ totalSales: 0, totalQuantity: 0, missingPrescriptionDetails: 0 })
    expect(result.rows).toEqual([])
  })
})

// Phase 67 §9.1 — Distributor: Scheme Cost vs. Incremental Volume Report.
// The report itself is a CORRELATION view, not a causal claim — see the
// function's own comment in report.service.ts. These tests verify the real
// computable pieces: FOC lines valued at current cost basis (via the same
// getProductCostsBatch() Phase 64 formalized), SLAB_DISCOUNT lines valued at
// their own discountAmount, and total covered-product volume tracked
// regardless of whether a given line carried a schemeId.
describe('reportService.generateSchemeCostVsVolumeReport', () => {
  function makeSchemeDb(overrides: {
    schemes?: unknown[]
    volumeItems?: unknown[]
    schemeItems?: unknown[]
    products?: unknown[]
    inventories?: unknown[]
  } = {}) {
    const invoiceItemFindMany = vi.fn().mockImplementation((args: { where: { schemeId?: unknown } }) => {
      if (args.where.schemeId) return Promise.resolve(overrides.schemeItems ?? [])
      return Promise.resolve(overrides.volumeItems ?? [])
    })
    return {
      pricingScheme: { findMany: vi.fn().mockResolvedValue(overrides.schemes ?? []) },
      invoiceItem: { findMany: invoiceItemFindMany },
      product: { findMany: vi.fn().mockResolvedValue(overrides.products ?? []) },
      inventory: { findMany: vi.fn().mockResolvedValue(overrides.inventories ?? []) },
    }
  }

  it('values a BUY_X_GET_Y_FREE FOC line at the current cost basis (getProductCostsBatch), not at sale price', async () => {
    const db = makeSchemeDb({
      schemes: [{ id: 's1', isActive: true, productId: 'p1', category: null, startDate: null, endDate: null }],
      volumeItems: [
        { quantity: 10, invoice: { invoiceDate: new Date('2026-08-03') } }, // paid units of the covered product
      ],
      schemeItems: [
        { productId: 'p1', quantity: 2, isFreeOfCost: true, discountAmount: 0, schemeId: 's1', invoice: { invoiceDate: new Date('2026-08-03') }, scheme: { name: 'Buy 10 Get 2 Free', ruleType: 'BUY_X_GET_Y_FREE' } },
      ],
      products: [{ id: 'p1', costPrice: 50, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }],
      inventories: [{ productId: 'p1', averageCost: 40, quantity: 100 }],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSchemeCostVsVolumeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-07' })

    // 2 FOC units * 40 (weighted-average cost basis) = 80, NOT the sale price
    expect(result.summary.totalSchemeCost).toBe(80)
    expect(result.summary.totalFocUnitsGiven).toBe(2)
    expect(result.summary.activeSchemeCount).toBe(1)
    expect(result.summary.coveredProductCount).toBe(1)
    expect(result.rows).toEqual([{ schemeId: 's1', schemeName: 'Buy 10 Get 2 Free', ruleType: 'BUY_X_GET_Y_FREE', totalCost: 80, focUnitsGiven: 2 }])
  })

  it('values a SLAB_DISCOUNT line at its own real discountAmount, not a computed cost basis', async () => {
    const db = makeSchemeDb({
      schemes: [{ id: 's2', isActive: true, productId: 'p2', category: null, startDate: null, endDate: null }],
      volumeItems: [{ quantity: 5, invoice: { invoiceDate: new Date('2026-08-04') } }],
      schemeItems: [
        { productId: 'p2', quantity: 5, isFreeOfCost: false, discountAmount: 250, schemeId: 's2', invoice: { invoiceDate: new Date('2026-08-04') }, scheme: { name: 'Slab 10% off 5+', ruleType: 'SLAB_DISCOUNT' } },
      ],
      products: [], inventories: [],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSchemeCostVsVolumeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-07' })

    expect(result.summary.totalSchemeCost).toBe(250)
    expect(result.summary.totalFocUnitsGiven).toBe(0)
    expect(result.rows[0]).toMatchObject({ schemeId: 's2', totalCost: 250, focUnitsGiven: 0 })
  })

  it('resolves a category-scoped scheme to every product in that category for the volume trend', async () => {
    const db = makeSchemeDb({
      schemes: [{ id: 's3', isActive: true, productId: null, category: { products: [{ id: 'p3' }, { id: 'p4' }] }, startDate: null, endDate: null }],
      volumeItems: [
        { quantity: 3, invoice: { invoiceDate: new Date('2026-08-05') } },
        { quantity: 4, invoice: { invoiceDate: new Date('2026-08-05') } },
      ],
      schemeItems: [],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSchemeCostVsVolumeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-07' })

    expect(result.summary.coveredProductCount).toBe(2)
    expect(result.byPeriod[0].totalVolume).toBe(7)
  })

  it('buckets scheme cost and volume by ISO week (Monday start)', async () => {
    const db = makeSchemeDb({
      schemes: [{ id: 's1', isActive: true, productId: 'p1', category: null, startDate: null, endDate: null }],
      volumeItems: [
        { quantity: 10, invoice: { invoiceDate: new Date('2026-08-03') } }, // Monday
        { quantity: 5, invoice: { invoiceDate: new Date('2026-08-05') } },  // same week, Wednesday
        { quantity: 6, invoice: { invoiceDate: new Date('2026-08-11') } },  // next week, Tuesday
      ],
      schemeItems: [],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSchemeCostVsVolumeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-14' })

    expect(result.byPeriod).toEqual([
      { period: '2026-08-03', schemeCost: 0, totalVolume: 15 },
      { period: '2026-08-10', schemeCost: 0, totalVolume: 6 },
    ])
  })

  it('returns an honest empty result when no scheme overlapped the date range', async () => {
    const db = makeSchemeDb({})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSchemeCostVsVolumeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-07' })

    expect(result.summary).toEqual({ totalSchemeCost: 0, totalFocUnitsGiven: 0, activeSchemeCount: 0, coveredProductCount: 0 })
    expect(result.byPeriod).toEqual([])
    expect(result.rows).toEqual([])
  })
})

// Phase 67 §9.1 item 19.2 — GP Clinic Recall Compliance report. This is a
// thin date-range adapter over chronic-condition-record.service.ts's own
// generateChronicRecallComplianceReport (already unit-tested there against a
// mocked `chronicRecallComplianceLog`) — these tests exercise it through the
// SAME globally-mocked getPrisma() this file already uses for every other
// report, confirming the adapter's unwrap/throw behavior end-to-end rather
// than re-mocking the sibling service.
describe('reportService.generateChronicRecallComplianceReport', () => {
  it('unwraps the underlying service result into the bare shape every other report function returns', async () => {
    const db = {
      chronicRecallComplianceLog: {
        findMany: vi.fn().mockResolvedValue([
          { onTime: true, record: { conditionName: 'Diabetes' } },
          { onTime: false, record: { conditionName: 'Diabetes' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateChronicRecallComplianceReport({ dateFrom: '2026-08-01', dateTo: '2026-08-07' })

    expect(result.totalRecallsClosed).toBe(2)
    expect(result.overallPercent).toBe(50)
    expect(result.byCondition).toEqual([{ conditionName: 'Diabetes', total: 2, onTime: 1, percent: 50 }])
    // The adapter passed the date range through, not the trailing-months default.
    // Local midnight, not new Date('2026-08-01') (UTC midnight) — a date-only
    // ISO string parses as UTC, the wrong calendar day in a positive-UTC-offset
    // timezone (this app's primary market is IST).
    const callArgs = db.chronicRecallComplianceLog.findMany.mock.calls[0][0]
    expect(callArgs.where.scheduledDate.gte).toEqual(new Date(2026, 7, 1))
  })

  it('throws when the underlying service reports failure, so the IPC handler surfaces a real error instead of silently returning undefined', async () => {
    const db = { chronicRecallComplianceLog: { findMany: vi.fn().mockRejectedValue(new Error('disk full')) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await expect(reportService.generateChronicRecallComplianceReport({ dateFrom: '2026-08-01', dateTo: '2026-08-07' })).rejects.toThrow('disk full')
  })

  it('returns an honest empty result when no recall periods closed in range', async () => {
    const db = { chronicRecallComplianceLog: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateChronicRecallComplianceReport({ dateFrom: '2026-08-01', dateTo: '2026-08-07' })

    expect(result.totalRecallsClosed).toBe(0)
    expect(result.overallPercent).toBeNull()
    expect(result.byCondition).toEqual([])
  })
})

// Phase 67 §9.1 item 19.3 — GP Clinic Walk-in vs. Appointment Ratio. TokenQueue
// rows are counted as walk-ins regardless of their (in-practice-always-null)
// appointmentId, and Appointment rows are counted independently by their own
// scheduledDate — see the report function's own header comment for why this
// avoids double-counting even in the theoretical case a token is ever linked.
describe('reportService.generateWalkInVsAppointmentRatioReport', () => {
  it('counts TokenQueue rows as walk-ins and Appointment rows as appointments, bucketed by local day', async () => {
    const db = {
      tokenQueue: { findMany: vi.fn().mockResolvedValue([
        { queueDate: new Date('2026-08-03') },
        { queueDate: new Date('2026-08-03') },
        { queueDate: new Date('2026-08-04') },
      ]) },
      appointment: { findMany: vi.fn().mockResolvedValue([
        { scheduledDate: new Date('2026-08-03') },
        { scheduledDate: new Date('2026-08-05') },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateWalkInVsAppointmentRatioReport({ dateFrom: '2026-08-01', dateTo: '2026-08-07' })

    expect(result.summary).toEqual({ totalWalkIns: 3, totalAppointments: 2, walkInPercent: 60 })
    expect(result.byDay).toEqual([
      { date: '2026-08-03', walkIns: 2, appointments: 1 },
      { date: '2026-08-04', walkIns: 1, appointments: 0 },
      { date: '2026-08-05', walkIns: 0, appointments: 1 },
    ])
  })

  it('returns an honest empty result with walkInPercent 0 (not NaN) when there are no visits at all', async () => {
    const db = {
      tokenQueue: { findMany: vi.fn().mockResolvedValue([]) },
      appointment: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateWalkInVsAppointmentRatioReport({ dateFrom: '2026-08-01', dateTo: '2026-08-07' })

    expect(result.summary).toEqual({ totalWalkIns: 0, totalAppointments: 0, walkInPercent: 0 })
    expect(result.byDay).toEqual([])
  })
})

// Phase 67 §9.1 item 19.4 — GP Clinic Diagnosis-Category Trend. Grounding
// check found `VisitNote.assessment` has no existing categorization, so this
// reads the new `diagnosisCategory` free-text field instead — visits with no
// category set are counted toward `uncategorizedCount` but deliberately
// excluded from `byMonth`/`categories`, since an uncategorized visit has
// nothing to plot a line for.
describe('reportService.generateDiagnosisCategoryTrendReport', () => {
  it('pivots into one row per month with one column per category, sorted categories', async () => {
    const db = {
      visitNote: { findMany: vi.fn().mockResolvedValue([
        { createdAt: new Date('2026-07-05'), diagnosisCategory: 'Infection' },
        { createdAt: new Date('2026-07-10'), diagnosisCategory: 'Infection' },
        { createdAt: new Date('2026-07-12'), diagnosisCategory: 'Injury' },
        { createdAt: new Date('2026-08-02'), diagnosisCategory: 'Infection' },
        { createdAt: new Date('2026-08-03'), diagnosisCategory: null },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDiagnosisCategoryTrendReport({ dateFrom: '2026-07-01', dateTo: '2026-08-31' })

    expect(result.categories).toEqual(['Infection', 'Injury'])
    expect(result.byMonth).toEqual([
      { month: '2026-07', Infection: 2, Injury: 1 },
      { month: '2026-08', Infection: 1, Injury: 0 },
    ])
    expect(result.summary).toEqual({ totalVisits: 5, categorizedCount: 4, uncategorizedCount: 1, distinctCategoryCount: 2 })
  })

  it('treats a whitespace-only category the same as uncategorized, not as a real category', async () => {
    const db = {
      visitNote: { findMany: vi.fn().mockResolvedValue([
        { createdAt: new Date('2026-07-05'), diagnosisCategory: '   ' },
        { createdAt: new Date('2026-07-06'), diagnosisCategory: 'Infection' },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDiagnosisCategoryTrendReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.categories).toEqual(['Infection'])
    expect(result.summary.uncategorizedCount).toBe(1)
  })

  it('returns an honest empty result when there are no visit notes at all', async () => {
    const db = { visitNote: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDiagnosisCategoryTrendReport({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })

    expect(result.categories).toEqual([])
    expect(result.byMonth).toEqual([])
    expect(result.summary).toEqual({ totalVisits: 0, categorizedCount: 0, uncategorizedCount: 0, distinctCategoryCount: 0 })
  })
})

// Phase 67 §9.1 item 19.5 — GP Clinic Referral-Out Outcome. The "outcome" is
// the referred-to provider's own finalized VisitNote.assessment — a draft
// (unfinalized) note is deliberately NOT surfaced as an outcome, since it
// isn't a real clinical conclusion yet.
describe('reportService.generateReferralOutcomeReport', () => {
  function makeReferral(overrides: Record<string, unknown> = {}) {
    return {
      appointmentNumber: 'APT-001', customerName: 'Test Patient', scheduledDate: new Date('2026-08-10'),
      status: 'COMPLETED', provider: { fullName: 'Dr. Specialist' },
      visitNote: { assessment: 'Confirmed diagnosis X', isFinalized: true },
      ...overrides,
    }
  }

  it('surfaces the outcome only when the referred-to note is finalized', async () => {
    const db = {
      appointment: { findMany: vi.fn().mockResolvedValue([
        makeReferral(),
        makeReferral({ appointmentNumber: 'APT-002', status: 'COMPLETED', visitNote: { assessment: 'Draft note', isFinalized: false } }),
        makeReferral({ appointmentNumber: 'APT-003', status: 'SCHEDULED', visitNote: null }),
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateReferralOutcomeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toHaveLength(3)
    expect(result.rows[0].outcomeSummary).toBe('Confirmed diagnosis X')
    expect(result.rows[1].outcomeSummary).toBeNull() // draft note, not finalized
    expect(result.rows[2].outcomeSummary).toBeNull() // no visit note at all yet
    expect(result.summary).toEqual({ totalReferrals: 3, completedCount: 2, outcomeRecordedCount: 1, pendingCount: 1 })
  })

  it('returns an honest empty result when no referrals were made in range', async () => {
    const db = { appointment: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateReferralOutcomeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalReferrals: 0, completedCount: 0, outcomeRecordedCount: 0, pendingCount: 0 })
  })
})

// Phase 67 §9.1 item 22.4 — Physio Clinic Pack Utilization, explicitly tagged
// as a shared component with Gym/Studio (both use ClientSessionPack). Reads
// packs by purchaseDate regardless of active/inactive status — a fully-used,
// deactivated pack is still real utilization history.
describe('reportService.generatePackUtilizationReport', () => {
  it('computes remaining sessions and utilization percent per pack, plus an overall rollup', async () => {
    const db = {
      clientSessionPack: { findMany: vi.fn().mockResolvedValue([
        { id: 'pack-1', packName: '10-Session Pack', totalSessions: 10, usedSessions: 7, expiryDate: new Date('2026-12-01'), isActive: true, customer: { customerName: 'Asha Rao' } },
        { id: 'pack-2', packName: '5-Session Pack', totalSessions: 5, usedSessions: 5, expiryDate: null, isActive: false, customer: { customerName: 'Vikram Shah' } },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePackUtilizationReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([
      { packId: 'pack-1', customerName: 'Asha Rao', packName: '10-Session Pack', totalSessions: 10, usedSessions: 7, remainingSessions: 3, utilizationPercent: 70, expiryDate: '2026-12-01', isActive: true },
      { packId: 'pack-2', customerName: 'Vikram Shah', packName: '5-Session Pack', totalSessions: 5, usedSessions: 5, remainingSessions: 0, utilizationPercent: 100, expiryDate: null, isActive: false },
    ])
    expect(result.summary).toEqual({ totalPacks: 2, totalSessionsSold: 15, totalSessionsUsed: 12, overallUtilizationPercent: 80 })
  })

  it('never reports negative remaining sessions even if usedSessions somehow exceeds totalSessions', async () => {
    const db = {
      clientSessionPack: { findMany: vi.fn().mockResolvedValue([
        { id: 'pack-1', packName: 'Overused Pack', totalSessions: 5, usedSessions: 7, expiryDate: null, isActive: true, customer: { customerName: 'Test' } },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePackUtilizationReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0].remainingSessions).toBe(0)
  })

  it('returns an honest empty result when no packs were purchased in range', async () => {
    const db = { clientSessionPack: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePackUtilizationReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalPacks: 0, totalSessionsSold: 0, totalSessionsUsed: 0, overallUtilizationPercent: 0 })
  })
})

describe('reportService.generateLabTATReport', () => {
  it('computes average actual TAT and on-time/late counts per test name', async () => {
    const db = {
      labTestOrderItem: { findMany: vi.fn().mockResolvedValue([
        { testName: 'CBC', category: 'Hematology', targetTATHours: 24, resultReadyAt: new Date('2026-08-02T10:00:00Z'), labTestOrder: { sampleCollectedAt: new Date('2026-08-01T10:00:00Z') } }, // exactly 24h — on time
        { testName: 'CBC', category: 'Hematology', targetTATHours: 24, resultReadyAt: new Date('2026-08-03T14:00:00Z'), labTestOrder: { sampleCollectedAt: new Date('2026-08-01T10:00:00Z') } }, // 52h — late
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLabTATReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([
      { testName: 'CBC', category: 'Hematology', ordersCount: 2, avgActualTATHours: 38, targetTATHours: 24, onTimeCount: 1, lateCount: 1, onTimePercent: 50 },
    ])
    expect(result.summary).toEqual({ totalCompleted: 2, withTargetCount: 2, onTimeCount: 1, overallOnTimePercent: 50 })
  })

  it('excludes items with no target from on-time/late counting but still counts them as completed', async () => {
    const db = {
      labTestOrderItem: { findMany: vi.fn().mockResolvedValue([
        { testName: 'X-Ray', category: 'Radiology', targetTATHours: null, resultReadyAt: new Date('2026-08-02T10:00:00Z'), labTestOrder: { sampleCollectedAt: new Date('2026-08-01T10:00:00Z') } },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLabTATReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0].targetTATHours).toBeNull()
    expect(result.rows[0].onTimePercent).toBe(0)
    expect(result.summary).toEqual({ totalCompleted: 1, withTargetCount: 0, onTimeCount: 0, overallOnTimePercent: 0 })
  })

  it('returns an honest empty result when nothing completed in range', async () => {
    const db = { labTestOrderItem: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLabTATReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalCompleted: 0, withTargetCount: 0, onTimeCount: 0, overallOnTimePercent: 0 })
  })
})

describe('reportService.generateTestVolumeByPanelReport', () => {
  it('pivots test counts into a month × panel wide table', async () => {
    const db = {
      labTestOrderItem: { findMany: vi.fn().mockResolvedValue([
        { category: 'Hematology', createdAt: new Date('2026-08-05') },
        { category: 'Hematology', createdAt: new Date('2026-08-15') },
        { category: 'Biochemistry', createdAt: new Date('2026-08-20') },
        { category: null, createdAt: new Date('2026-08-22') },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTestVolumeByPanelReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.summary).toEqual({ totalTests: 4, distinctPanelCount: 3 })
    expect(result.panels.sort()).toEqual(['Biochemistry', 'Hematology', 'Uncategorized'])
    expect(result.byMonth).toHaveLength(1)
    expect(result.byMonth[0]).toMatchObject({ Hematology: 2, Biochemistry: 1, Uncategorized: 1 })
  })

  it('returns an honest empty result when nothing ordered in range', async () => {
    const db = { labTestOrderItem: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTestVolumeByPanelReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.summary).toEqual({ totalTests: 0, distinctPanelCount: 0 })
    expect(result.panels).toEqual([])
    expect(result.byMonth).toEqual([])
  })
})

describe('reportService.generateReferralLeaderboardReport', () => {
  it('ranks lab referring providers by order count for DIAGNOSTIC_LAB', async () => {
    const db = {
      labTestOrder: { findMany: vi.fn().mockResolvedValue([
        { referredByProvider: { fullName: 'Dr. Mehta' } },
        { referredByProvider: { fullName: 'Dr. Mehta' } },
        { referredByProvider: { fullName: 'Dr. Iyer' } },
        { referredByProvider: null },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateReferralLeaderboardReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31', businessType: 'DIAGNOSTIC_LAB' })

    expect(result.rows).toEqual([{ referrerName: 'Dr. Mehta', count: 2 }, { referrerName: 'Dr. Iyer', count: 1 }])
    expect(result.summary).toEqual({ totalReferrals: 3, distinctReferrerCount: 2, topReferrerName: 'Dr. Mehta' })
    expect(db.labTestOrder.findMany).toHaveBeenCalled()
  })

  it('ranks free-text referredBy names for SPECIALIST_CLINIC (a different query path)', async () => {
    const db = {
      visitNote: { findMany: vi.fn().mockResolvedValue([
        { referredBy: 'Dr. Rao' },
        { referredBy: '  ' }, // whitespace-only should not count as a real referrer
        { referredBy: 'Dr. Rao' },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateReferralLeaderboardReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31', businessType: 'SPECIALIST_CLINIC' })

    expect(result.rows).toEqual([{ referrerName: 'Dr. Rao', count: 2 }])
    expect(result.summary).toEqual({ totalReferrals: 2, distinctReferrerCount: 1, topReferrerName: 'Dr. Rao' })
    expect(db.visitNote.findMany).toHaveBeenCalled()
  })

  it('returns an honest empty result when no referrals exist', async () => {
    const db = { labTestOrder: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateReferralLeaderboardReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31', businessType: 'DIAGNOSTIC_LAB' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalReferrals: 0, distinctReferrerCount: 0, topReferrerName: null })
  })
})

// Phase 67 §9.1 item 20.2 — Specialist Clinic: Second-Opinion Conversion.
describe('reportService.generateSecondOpinionConversionReport', () => {
  it('marks a patient converted when they have a later COMPLETED appointment', async () => {
    const db = {
      visitNote: {
        findMany: vi.fn().mockResolvedValue([
          { patientName: 'Anita Rao', appointment: { customerId: 'cust-1', scheduledDate: new Date('2026-08-02') } },
        ]),
      },
      appointment: {
        findFirst: vi.fn().mockResolvedValue({ scheduledDate: new Date('2026-08-15') }),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSecondOpinionConversionReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([{ patientName: 'Anita Rao', visitDate: '2026-08-02', converted: true, nextVisitDate: '2026-08-15' }])
    expect(result.summary).toEqual({ totalSecondOpinionVisits: 1, convertedCount: 1, conversionPercent: 100, distinctPatientCount: 1 })
    expect(db.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ customerId: 'cust-1', status: 'COMPLETED' }),
    }))
  })

  it('marks a patient NOT converted when no later completed appointment exists', async () => {
    const db = {
      visitNote: {
        findMany: vi.fn().mockResolvedValue([
          { patientName: 'Vikram Shah', appointment: { customerId: 'cust-2', scheduledDate: new Date('2026-08-05') } },
        ]),
      },
      appointment: { findFirst: vi.fn().mockResolvedValue(null) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSecondOpinionConversionReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([{ patientName: 'Vikram Shah', visitDate: '2026-08-05', converted: false, nextVisitDate: null }])
    expect(result.summary.convertedCount).toBe(0)
    expect(result.summary.conversionPercent).toBe(0)
  })

  it('excludes walk-ins with no customerId from tracking entirely', async () => {
    const db = {
      visitNote: {
        findMany: vi.fn().mockResolvedValue([
          { patientName: 'Walk-in Patient', appointment: { customerId: null, scheduledDate: new Date('2026-08-06') } },
        ]),
      },
      appointment: { findFirst: vi.fn() },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSecondOpinionConversionReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalSecondOpinionVisits: 0, convertedCount: 0, conversionPercent: null, distinctPatientCount: 0 })
    expect(db.appointment.findFirst).not.toHaveBeenCalled()
  })

  it('returns an honest empty result when no second-opinion visits exist', async () => {
    const db = {
      visitNote: { findMany: vi.fn().mockResolvedValue([]) },
      appointment: { findFirst: vi.fn() },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSecondOpinionConversionReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalSecondOpinionVisits: 0, convertedCount: 0, conversionPercent: null, distinctPatientCount: 0 })
  })
})

// Phase 67 §9.1 item 20.3 — Specialist Clinic: Case-Complexity Mix.
describe('reportService.generateCaseComplexityMixReport', () => {
  it('splits ROUTINE and COMPLEX counts into a month pivot', async () => {
    const db = {
      visitNote: {
        findMany: vi.fn().mockResolvedValue([
          { caseComplexity: 'ROUTINE', appointment: { scheduledDate: new Date('2026-08-05') } },
          { caseComplexity: 'ROUTINE', appointment: { scheduledDate: new Date('2026-08-10') } },
          { caseComplexity: 'COMPLEX', appointment: { scheduledDate: new Date('2026-08-12') } },
          { caseComplexity: 'COMPLEX', appointment: { scheduledDate: new Date('2026-07-20') } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCaseComplexityMixReport({ dateFrom: '2026-07-01', dateTo: '2026-08-31' })

    expect(result.summary).toEqual({ totalTagged: 4, routineCount: 2, complexCount: 2, complexPercent: 50 })
    expect(result.byMonth).toEqual([
      { month: '2026-07', ROUTINE: 0, COMPLEX: 1 },
      { month: '2026-08', ROUTINE: 2, COMPLEX: 1 },
    ])
    expect(db.visitNote.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ caseComplexity: { in: ['ROUTINE', 'COMPLEX'] } }),
    }))
  })

  it('returns an honest empty result when no cases are tagged', async () => {
    const db = { visitNote: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCaseComplexityMixReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.summary).toEqual({ totalTagged: 0, routineCount: 0, complexCount: 0, complexPercent: null })
    expect(result.byMonth).toEqual([])
  })
})

// Phase 67 §9.1 item 21.2 — Dental Clinic: Treatment Acceptance Rate.
describe('reportService.generateTreatmentAcceptanceRateReport', () => {
  it('narrows the funnel: proposed -> accepted (not PROPOSED/DECLINED) -> billed (invoiceId set)', async () => {
    const db = {
      treatmentPlan: {
        findMany: vi.fn().mockResolvedValue([
          { status: 'PROPOSED', invoiceId: null },
          { status: 'DECLINED', invoiceId: null },
          { status: 'ACCEPTED', invoiceId: null },
          { status: 'IN_PROGRESS', invoiceId: 'inv-1' },
          { status: 'COMPLETED', invoiceId: 'inv-2' },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTreatmentAcceptanceRateReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.summary).toEqual({ proposedCount: 5, acceptedCount: 3, billedCount: 2, acceptanceRatePercent: 60, billedRatePercent: 40 })
    expect(result.funnel).toEqual([
      { stage: 'Proposed', count: 5 },
      { stage: 'Accepted', count: 3 },
      { stage: 'Billed', count: 2 },
    ])
  })

  it('returns an honest empty result when no plans exist', async () => {
    const db = { treatmentPlan: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTreatmentAcceptanceRateReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.summary).toEqual({ proposedCount: 0, acceptedCount: 0, billedCount: 0, acceptanceRatePercent: null, billedRatePercent: null })
    expect(result.funnel).toEqual([{ stage: 'Proposed', count: 0 }, { stage: 'Accepted', count: 0 }, { stage: 'Billed', count: 0 }])
  })
})

describe('reportService.generateVaccinationComplianceReport', () => {
  it('classifies a dose as on-time when given on or before its prior due date', async () => {
    const db = {
      vaccinationRecord: {
        findMany: vi.fn().mockResolvedValue([
          { petId: 'pet-1', vaccineName: 'Rabies', administeredAt: new Date('2026-08-10') },
        ]),
        findFirst: vi.fn().mockResolvedValue({ nextDueDate: new Date('2026-08-15') }),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVaccinationComplianceReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.totalDosesEvaluated).toBe(1)
    expect(result.overallOnTime).toBe(1)
    expect(result.overallPercent).toBe(100)
    expect(result.byVaccine).toEqual([{ vaccineName: 'Rabies', total: 1, onTime: 1, percent: 100 }])
  })

  it('classifies a dose as late when given after its prior due date', async () => {
    const db = {
      vaccinationRecord: {
        findMany: vi.fn().mockResolvedValue([
          { petId: 'pet-1', vaccineName: 'Rabies', administeredAt: new Date('2026-08-20') },
        ]),
        findFirst: vi.fn().mockResolvedValue({ nextDueDate: new Date('2026-08-15') }),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVaccinationComplianceReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.overallOnTime).toBe(0)
    expect(result.overallPercent).toBe(0)
  })

  // Phase 67 §9.1 item 18.2 — a pet's first-ever dose of a vaccine has no
  // prior due date to be judged against, so it must not silently count as
  // either on-time or late.
  it('excludes a first-ever dose (no prior record at all) from on-time/late counting', async () => {
    const db = {
      vaccinationRecord: {
        findMany: vi.fn().mockResolvedValue([
          { petId: 'pet-1', vaccineName: 'Rabies', administeredAt: new Date('2026-08-10') },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVaccinationComplianceReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.totalDosesEvaluated).toBe(0)
    expect(result.overallPercent).toBeNull()
  })

  it('excludes a dose whose prior record exists but never had a nextDueDate set', async () => {
    const db = {
      vaccinationRecord: {
        findMany: vi.fn().mockResolvedValue([
          { petId: 'pet-1', vaccineName: 'Rabies', administeredAt: new Date('2026-08-10') },
        ]),
        findFirst: vi.fn().mockResolvedValue({ nextDueDate: null }),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVaccinationComplianceReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.totalDosesEvaluated).toBe(0)
  })

  it('groups results by vaccine name, sorted by dose volume', async () => {
    const db = {
      vaccinationRecord: {
        findMany: vi.fn().mockResolvedValue([
          { petId: 'pet-1', vaccineName: 'Rabies', administeredAt: new Date('2026-08-10') },
          { petId: 'pet-2', vaccineName: 'Rabies', administeredAt: new Date('2026-08-20') },
          { petId: 'pet-3', vaccineName: 'DHPP', administeredAt: new Date('2026-08-05') },
        ]),
        findFirst: vi.fn()
          .mockResolvedValueOnce({ nextDueDate: new Date('2026-08-15') })
          .mockResolvedValueOnce({ nextDueDate: new Date('2026-08-15') })
          .mockResolvedValueOnce({ nextDueDate: new Date('2026-08-01') }),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVaccinationComplianceReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.totalDosesEvaluated).toBe(3)
    expect(result.byVaccine).toEqual([
      { vaccineName: 'Rabies', total: 2, onTime: 1, percent: 50 },
      { vaccineName: 'DHPP', total: 1, onTime: 0, percent: 0 },
    ])
  })

  it('returns an honest empty result when nothing administered in range', async () => {
    const db = { vaccinationRecord: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVaccinationComplianceReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.totalDosesEvaluated).toBe(0)
    expect(result.overallPercent).toBeNull()
    expect(result.byVaccine).toEqual([])
  })
})

describe('reportService.generateVetCaseTypeVolumeReport', () => {
  it('pivots appointment counts by Service Catalog category into a month × case-type wide table', async () => {
    const db = {
      appointment: { findMany: vi.fn().mockResolvedValue([
        { scheduledDate: new Date('2026-08-05'), serviceCatalog: { category: 'Consultation' } },
        { scheduledDate: new Date('2026-08-15'), serviceCatalog: { category: 'Consultation' } },
        { scheduledDate: new Date('2026-08-20'), serviceCatalog: { category: 'Grooming' } },
        { scheduledDate: new Date('2026-08-22'), serviceCatalog: null },
      ]) },
      vaccinationRecord: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVetCaseTypeVolumeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.summary).toEqual({ totalCases: 4, distinctCaseTypeCount: 3 })
    expect(result.caseTypes.sort()).toEqual(['Consultation', 'Grooming', 'Other'])
    expect(result.byMonth).toHaveLength(1)
    expect(result.byMonth[0]).toMatchObject({ Consultation: 2, Grooming: 1, Other: 1 })
  })

  it('gives vaccinations their own dedicated series sourced from real administered doses, not appointments', async () => {
    const db = {
      appointment: { findMany: vi.fn().mockResolvedValue([]) },
      vaccinationRecord: { findMany: vi.fn().mockResolvedValue([
        { administeredAt: new Date('2026-08-10') },
        { administeredAt: new Date('2026-08-12') },
      ]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVetCaseTypeVolumeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.summary).toEqual({ totalCases: 2, distinctCaseTypeCount: 1 })
    expect(result.caseTypes).toEqual(['Vaccinations'])
    expect(result.byMonth[0]).toMatchObject({ Vaccinations: 2 })
  })

  it('only counts pet-linked, non-cancelled appointments as real cases (query-level filter, verified via call args)', async () => {
    const db = {
      appointment: { findMany: vi.fn().mockResolvedValue([]) },
      vaccinationRecord: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateVetCaseTypeVolumeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(db.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ petId: { not: null }, status: { not: 'CANCELLED' } })
    }))
  })

  it('returns an honest empty result when nothing recorded in range', async () => {
    const db = {
      appointment: { findMany: vi.fn().mockResolvedValue([]) },
      vaccinationRecord: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateVetCaseTypeVolumeReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.summary).toEqual({ totalCases: 0, distinctCaseTypeCount: 0 })
    expect(result.caseTypes).toEqual([])
    expect(result.byMonth).toEqual([])
  })
})

// ─── Discounts & Bargained Pricing Report ──────────────────────────────────────

function makeDiscountInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1', invoiceNumber: 'INV-2024-000001', invoiceType: 'RETAIL',
    invoiceDate: new Date('2024-01-15'), status: 'ACTIVE',
    customer: { customerName: 'Walk-in' }, createdBy: { fullName: 'Cashier One' },
    items: [{ productName: 'Widget', quantity: 2, unitPrice: 500, discountAmount: 100 }],
    ...overrides
  }
}

describe('reportService.generateDiscountReport', () => {
  it('only counts lines with a positive discount, computing the correct percent per line', async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeDiscountInvoice({
            items: [
              { productName: 'Bargained Widget', quantity: 2, unitPrice: 500, discountAmount: 200 }, // 1000 gross, 20% off
              { productName: 'Full Price Item', quantity: 1, unitPrice: 300, discountAmount: 0 },
            ]
          })
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDiscountReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalLineCount).toBe(2)
    expect(result.summary.discountedLineCount).toBe(1)
    expect(result.summary.totalDiscountGiven).toBe(200)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].discountPercent).toBe(20)
  })

  it('computes discount incidence and average discount percent across multiple invoices', async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeDiscountInvoice({ items: [{ productName: 'A', quantity: 1, unitPrice: 100, discountAmount: 10 }] }), // 10%
          makeDiscountInvoice({ items: [{ productName: 'B', quantity: 1, unitPrice: 100, discountAmount: 30 }] }), // 30%
          makeDiscountInvoice({ items: [{ productName: 'C', quantity: 1, unitPrice: 100, discountAmount: 0 }] }),  // no discount
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDiscountReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalLineCount).toBe(3)
    expect(result.summary.discountedLineCount).toBe(2)
    expect(result.summary.discountIncidencePercent).toBe(66.67)
    expect(result.summary.averageDiscountPercent).toBe(20)
  })

  it('aggregates discount given by staff member and by product', async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeDiscountInvoice({
            createdBy: { fullName: 'Alice' },
            items: [{ productName: 'Widget', quantity: 1, unitPrice: 100, discountAmount: 20 }]
          }),
          makeDiscountInvoice({
            createdBy: { fullName: 'Bob' },
            items: [{ productName: 'Widget', quantity: 1, unitPrice: 100, discountAmount: 30 }]
          }),
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDiscountReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.byStaff).toEqual([
      { staffName: 'Bob', discountGiven: 30, lineCount: 1 },
      { staffName: 'Alice', discountGiven: 20, lineCount: 1 },
    ])
    expect(result.byProduct).toEqual([{ productName: 'Widget', discountGiven: 50, lineCount: 2 }])
  })

  // Same sign-correction idiom as generateSalesReport's totalDiscount — a
  // RETURN invoice's item-level discountAmount is stored as a positive
  // magnitude, so it must be NEGATED when aggregated, or a return would
  // double-count as if it were an additional sale's discount.
  it('negates discount for RETURN invoices so they reverse, not double-count', async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          makeDiscountInvoice({ invoiceType: 'RETURN', items: [{ productName: 'Widget', quantity: 1, unitPrice: 100, discountAmount: 20 }] })
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDiscountReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary.totalDiscountGiven).toBe(-20)
    expect(result.rows[0].discountAmount).toBe(-20)
  })

  it('excludes CANCELLED invoices entirely', async () => {
    const db = { invoice: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateDiscountReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const whereArg = vi.mocked(db.invoice.findMany).mock.calls[0][0] as { where: { status: { not: string } } }
    expect(whereArg.where.status).toEqual({ not: 'CANCELLED' })
  })

  it('returns zero-value summary and empty arrays when nothing matches the range', async () => {
    const db = { invoice: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDiscountReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.summary).toEqual({ totalDiscountGiven: 0, discountedLineCount: 0, totalLineCount: 0, discountIncidencePercent: 0, averageDiscountPercent: 0 })
    expect(result.rows).toEqual([])
    expect(result.byStaff).toEqual([])
    expect(result.byProduct).toEqual([])
  })
})

// Phase 68 §9.1 — Beauty Salon items 1/2: stylist-wise repeat-client rate.
describe('reportService.generateStylistRepeatClientReport', () => {
  it('counts a client as repeat only when they returned to the SAME stylist twice+, not just the salon overall', async () => {
    const db = {
      appointment: {
        findMany: vi.fn().mockResolvedValue([
          { providerId: 'stylist-1', customerId: 'cust-a', provider: { fullName: 'Asha' } },
          { providerId: 'stylist-1', customerId: 'cust-a', provider: { fullName: 'Asha' } }, // repeat with Asha
          { providerId: 'stylist-1', customerId: 'cust-b', provider: { fullName: 'Asha' } }, // one-time with Asha
          { providerId: 'stylist-2', customerId: 'cust-b', provider: { fullName: 'Ravi' } }, // cust-b's FIRST visit with Ravi -- not a repeat for Ravi
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateStylistRepeatClientReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    const asha = result.rows.find((r) => r.providerName === 'Asha')
    const ravi = result.rows.find((r) => r.providerName === 'Ravi')
    expect(asha).toEqual({ providerName: 'Asha', totalClients: 2, repeatClients: 1, repeatRatePercent: 50 })
    expect(ravi).toEqual({ providerName: 'Ravi', totalClients: 1, repeatClients: 0, repeatRatePercent: 0 })
  })

  it('sorts best-first (highest repeat rate) — a leaderboard, not this phase\'s usual worst-first problem list', async () => {
    const db = {
      appointment: {
        findMany: vi.fn().mockResolvedValue([
          { providerId: 'stylist-low', customerId: 'c1', provider: { fullName: 'LowRepeat' } },
          { providerId: 'stylist-high', customerId: 'c2', provider: { fullName: 'HighRepeat' } },
          { providerId: 'stylist-high', customerId: 'c2', provider: { fullName: 'HighRepeat' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateStylistRepeatClientReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows.map((r) => r.providerName)).toEqual(['HighRepeat', 'LowRepeat'])
  })

  it('excludes appointments with no provider or no customer from the computation entirely', async () => {
    const db = {
      appointment: { findMany: vi.fn().mockResolvedValue([]) }, // query itself filters providerId/customerId not-null
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateStylistRepeatClientReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(db.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ providerId: { not: null }, customerId: { not: null }, status: 'COMPLETED' }),
    }))
  })

  it('returns an honest empty result when nothing matches the range', async () => {
    const db = { appointment: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateStylistRepeatClientReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalStylists: 0, overallRepeatRatePercent: 0 })
  })
})

// Phase 68 §9.1 — Beauty Salon items 3/4: retail-product attach rate.
describe('reportService.generateRetailAttachRateReport', () => {
  it('counts an invoice as "attached" only when it has a line whose product is NOT the synthetic SERVICE placeholder', async () => {
    const db = {
      appointment: {
        findMany: vi.fn().mockResolvedValue([
          { providerId: 'stylist-1', invoiceId: 'inv-1', provider: { fullName: 'Asha' } },
          { providerId: 'stylist-1', invoiceId: 'inv-2', provider: { fullName: 'Asha' } },
        ]),
      },
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'inv-1', items: [{ product: { productType: 'SERVICE' } }, { product: { productType: 'STANDARD' } }] }, // has retail line
          { id: 'inv-2', items: [{ product: { productType: 'SERVICE' } }] }, // service only
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRetailAttachRateReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.summary).toEqual({ totalAppointmentInvoices: 2, withRetailAttach: 1, attachRatePercent: 50 })
    expect(result.byProvider).toEqual([{ providerName: 'Asha', totalInvoices: 2, withAttach: 1, attachRatePercent: 50 }])
  })

  it('excludes an appointment with no invoiceId (never billed yet) from the computation', async () => {
    const db = {
      appointment: { findMany: vi.fn().mockResolvedValue([]) }, // query filters invoiceId: { not: null }
      invoice: { findMany: vi.fn() },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateRetailAttachRateReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(db.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ invoiceId: { not: null }, status: 'COMPLETED' }),
    }))
    expect(db.invoice.findMany).not.toHaveBeenCalled()
  })

  it('returns an honest empty result when nothing matches the range', async () => {
    const db = { appointment: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRetailAttachRateReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.byProvider).toEqual([])
    expect(result.summary).toEqual({ totalAppointmentInvoices: 0, withRetailAttach: 0, attachRatePercent: 0 })
  })
})

// Phase 68 §9.1 — Gym/Studio item 4: Class Attendance Heatmap.
describe('reportService.generateClassAttendanceHeatmapReport', () => {
  it('buckets check-ins by className × day-of-week', async () => {
    const db = {
      batchClassAttendance: {
        findMany: vi.fn().mockResolvedValue([
          { sessionDate: new Date(2026, 7, 3), class: { className: 'Yoga' } }, // Mon Aug 3 2026
          { sessionDate: new Date(2026, 7, 3), class: { className: 'Yoga' } },
          { sessionDate: new Date(2026, 7, 4), class: { className: 'Zumba' } }, // Tue Aug 4 2026
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateClassAttendanceHeatmapReport({ dateFrom: '2026-08-01', dateTo: '2026-08-07' })

    expect(result.summary.totalCheckIns).toBe(3)
    expect(result.summary.busiestClassName).toBe('Yoga')
    const yogaMonCell = result.cells.find((c) => c.className === 'Yoga' && c.dayOfWeek === 'Mon')
    expect(yogaMonCell?.checkInCount).toBe(2)
  })

  it('returns an honest empty result when nothing matches the range', async () => {
    const db = { batchClassAttendance: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateClassAttendanceHeatmapReport({ dateFrom: '2026-08-01', dateTo: '2026-08-07' })

    expect(result.cells).toEqual([])
    expect(result.summary).toEqual({ totalCheckIns: 0, busiestClassName: null, busiestDay: null })
  })
})

// Phase 68 §9.1 — Gym/Studio items 1/2: membership renewal funnel.
describe('reportService.generateMembershipRenewalFunnelReport', () => {
  it('counts a membership as renewed only when the SAME client has another membership starting within the grace window', async () => {
    const db = {
      membership: {
        findMany: vi.fn()
          .mockResolvedValueOnce([
            { id: 'mem-1', clientId: 'cust-1', endDate: new Date(2026, 7, 15), plan: { planName: 'Monthly' } },
            { id: 'mem-2', clientId: 'cust-2', endDate: new Date(2026, 7, 15), plan: { planName: 'Monthly' } },
          ])
          .mockResolvedValueOnce([
            { id: 'mem-1', clientId: 'cust-1', startDate: new Date(2026, 6, 1) },
            { id: 'mem-3', clientId: 'cust-1', startDate: new Date(2026, 7, 20) }, // renewed within grace
            { id: 'mem-2', clientId: 'cust-2', startDate: new Date(2026, 6, 1) }, // no renewal
          ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateMembershipRenewalFunnelReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.summary).toEqual({ totalExpired: 2, totalRenewed: 1, overallRenewalRatePercent: 50 })
  })

  it('a renewal starting AFTER the grace window is NOT counted as renewed', async () => {
    const db = {
      membership: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ id: 'mem-1', clientId: 'cust-1', endDate: new Date(2026, 7, 1), plan: { planName: 'Monthly' } }])
          .mockResolvedValueOnce([
            { id: 'mem-1', clientId: 'cust-1', startDate: new Date(2026, 6, 1) },
            { id: 'mem-4', clientId: 'cust-1', startDate: new Date(2026, 8, 1) }, // 31 days later, outside 14-day grace
          ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateMembershipRenewalFunnelReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.summary.totalRenewed).toBe(0)
  })

  it('returns an honest empty result when nothing expired in the range', async () => {
    const db = { membership: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateMembershipRenewalFunnelReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalExpired: 0, totalRenewed: 0, overallRenewalRatePercent: 0 })
  })
})

// Phase 68 §9.1 — Driving School item 4: Learner Progress Funnel.
describe('reportService.generateLearnerProgressFunnelReport', () => {
  it('each stage is a distinct-learner count, monotonically non-increasing down the funnel', async () => {
    const db = {
      learnerProfile: { findMany: vi.fn().mockResolvedValue([{ customerId: 'l1' }, { customerId: 'l2' }, { customerId: 'l3' }]) },
      drivingSession: { findMany: vi.fn().mockResolvedValue([{ learnerId: 'l1' }, { learnerId: 'l2' }]) },
      drivingTest: {
        findMany: vi.fn().mockResolvedValue([
          { learnerId: 'l1', testType: 'LL_TEST', result: 'PASSED' },
          { learnerId: 'l2', testType: 'LL_TEST', result: 'FAILED' },
          { learnerId: 'l1', testType: 'DL_TEST', result: 'PASSED' },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLearnerProgressFunnelReport()

    expect(result.stages).toEqual([
      { stage: 'Enrolled', learnerCount: 3 },
      { stage: 'Sessions Started', learnerCount: 2 },
      { stage: 'LL Test Taken', learnerCount: 2 },
      { stage: 'LL Test Passed', learnerCount: 1 },
      { stage: 'DL Test Passed', learnerCount: 1 },
    ])
    expect(result.summary).toEqual({ totalEnrolled: 3, dlPassedCount: 1, overallCompletionPercent: 33.3 })
  })

  it('a session from a learner with no LearnerProfile row is not counted at "Sessions Started"', async () => {
    const db = {
      learnerProfile: { findMany: vi.fn().mockResolvedValue([{ customerId: 'l1' }]) },
      drivingSession: { findMany: vi.fn().mockResolvedValue([{ learnerId: 'ghost-learner' }]) },
      drivingTest: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLearnerProgressFunnelReport()

    expect(result.stages.find((s) => s.stage === 'Sessions Started')?.learnerCount).toBe(0)
  })

  it('returns an honest all-zero result when there are no learners at all', async () => {
    const db = {
      learnerProfile: { findMany: vi.fn().mockResolvedValue([]) },
      drivingSession: { findMany: vi.fn().mockResolvedValue([]) },
      drivingTest: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLearnerProgressFunnelReport()

    expect(result.summary).toEqual({ totalEnrolled: 0, dlPassedCount: 0, overallCompletionPercent: 0 })
  })
})

// Phase 68 §9.1 — Lawyer item 4: Case Aging.
describe('reportService.generateCaseAgingReport', () => {
  it('sorts worst-first by days stuck in the CURRENT stage, not overall case age', async () => {
    const db = {
      legalCase: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'c1', caseNumber: 'CASE-001', caseTitle: 'Old but moving', caseStage: 'EVIDENCE', caseStageUpdatedAt: new Date(Date.now() - 5 * 86400000), filingDate: new Date(Date.now() - 400 * 86400000), client: { customerName: 'Client A' } },
          { id: 'c2', caseNumber: 'CASE-002', caseTitle: 'Young but stalled', caseStage: 'FILING', caseStageUpdatedAt: new Date(Date.now() - 120 * 86400000), filingDate: new Date(Date.now() - 130 * 86400000), client: { customerName: 'Client B' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCaseAgingReport()

    expect(result.rows.map((r) => r.caseId)).toEqual(['c2', 'c1'])
    expect(result.rows[0].daysInCurrentStage).toBeGreaterThan(result.rows[1].daysInCurrentStage)
  })

  it('excludes CLOSED and DISPOSED cases from the query', async () => {
    const db = { legalCase: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateCaseAgingReport()

    expect(db.legalCase.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { notIn: ['CLOSED', 'DISPOSED'] } }),
    }))
  })

  it('counts a case as stale only at 90+ days in its current stage', async () => {
    const db = {
      legalCase: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'c1', caseNumber: 'C1', caseTitle: 'T1', caseStage: 'FILING', caseStageUpdatedAt: new Date(Date.now() - 95 * 86400000), filingDate: null, client: { customerName: 'A' } },
          { id: 'c2', caseNumber: 'C2', caseTitle: 'T2', caseStage: 'FILING', caseStageUpdatedAt: new Date(Date.now() - 30 * 86400000), filingDate: null, client: { customerName: 'B' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCaseAgingReport()

    expect(result.summary.staleCaseCount).toBe(1)
  })

  it('returns an honest empty result when there are no open cases', async () => {
    const db = { legalCase: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCaseAgingReport()

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalOpenCases: 0, avgDaysInCurrentStage: 0, staleCaseCount: 0 })
  })
})

// Phase 68 §9.1 — Lawyer item 2: Billable Hours.
describe('reportService.generateLawyerBillableHoursReport', () => {
  it('separates billable (ratePerHour > 0) from non-billable (pro-bono) hours', async () => {
    const db = {
      timeEntry: {
        findMany: vi.fn().mockResolvedValue([
          { hours: 3, ratePerHour: 2000, amount: 6000, isBilled: false, employee: { fullName: 'Adv. Sharma' } },
          { hours: 2, ratePerHour: 0, amount: 0, isBilled: false, employee: { fullName: 'Adv. Sharma' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLawyerBillableHoursReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    const row = result.rows[0]
    expect(row.billableHours).toBe(3)
    expect(row.nonBillableHours).toBe(2)
    expect(row.billableAmount).toBe(6000)
  })

  it('splits billable amount into billed vs unbilled', async () => {
    const db = {
      timeEntry: {
        findMany: vi.fn().mockResolvedValue([
          { hours: 3, ratePerHour: 2000, amount: 6000, isBilled: true, employee: { fullName: 'Adv. Sharma' } },
          { hours: 1, ratePerHour: 2000, amount: 2000, isBilled: false, employee: { fullName: 'Adv. Sharma' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLawyerBillableHoursReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows[0].billedAmount).toBe(6000)
    expect(result.rows[0].unbilledAmount).toBe(2000)
    expect(result.summary.totalUnbilledAmount).toBe(2000)
  })

  it('only queries TimeEntry rows linked to a case (caseId not null)', async () => {
    const db = { timeEntry: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateLawyerBillableHoursReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(db.timeEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ caseId: { not: null } }),
    }))
  })

  it('returns an honest empty result when nothing matches the range', async () => {
    const db = { timeEntry: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateLawyerBillableHoursReport({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalBillableHours: 0, totalBillableAmount: 0, totalUnbilledAmount: 0 })
  })
})

// Phase 68 §9.1 — CA Firm item 4: Fee Realization.
describe('reportService.generateFeeRealizationReport', () => {
  it('computes realizationPercent from engagements actually invoiced THIS period (lastInvoicedPeriod)', async () => {
    const now = new Date()
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const db = {
      engagement: {
        findMany: vi.fn().mockResolvedValue([
          { title: 'GST Retainer', feeAmount: 10000, lastInvoicedPeriod: currentPeriod, client: { customerName: 'Client A' } },
          { title: 'Tax Audit', feeAmount: 5000, lastInvoicedPeriod: '2020-01', client: { customerName: 'Client B' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFeeRealizationReport()

    expect(result.summary).toEqual({ totalExpectedFee: 15000, totalRealizedFee: 10000, realizationPercent: 66.7 })
    expect(result.rows.find((r) => r.engagementTitle === 'GST Retainer')?.isInvoicedThisPeriod).toBe(true)
    expect(result.rows.find((r) => r.engagementTitle === 'Tax Audit')?.isInvoicedThisPeriod).toBe(false)
  })

  it('only queries ACTIVE engagements with a real fee amount set', async () => {
    const db = { engagement: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateFeeRealizationReport()

    expect(db.engagement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'ACTIVE', feeAmount: { not: null } },
    }))
  })

  it('returns an honest empty result when there are no priced active engagements', async () => {
    const db = { engagement: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateFeeRealizationReport()

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalExpectedFee: 0, totalRealizedFee: 0, realizationPercent: 0 })
  })
})

describe('reportService.generateDrawingApprovalCycleTimeReport', () => {
  it('computes daysToApprove from issuedDate to approvedDate', async () => {
    const db = {
      drawingRevision: {
        findMany: vi.fn().mockResolvedValue([
          { drawingNumber: 'A-101', revisionNumber: 'B', discipline: 'ARCHITECTURAL', issuedDate: new Date(2026, 7, 1), createdAt: new Date(2026, 7, 1), approvedDate: new Date(2026, 7, 15), project: { projectName: 'Office Fitout' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDrawingApprovalCycleTimeReport()

    expect(result.rows[0].daysToApprove).toBe(14)
    expect(result.summary).toEqual({ totalApproved: 1, avgDaysToApprove: 14 })
  })

  it('falls back to createdAt when issuedDate was never recorded', async () => {
    const db = {
      drawingRevision: {
        findMany: vi.fn().mockResolvedValue([
          { drawingNumber: 'A-102', revisionNumber: 'A', discipline: 'STRUCTURAL', issuedDate: null, createdAt: new Date(2026, 7, 1), approvedDate: new Date(2026, 7, 6), project: { projectName: 'Villa Extension' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDrawingApprovalCycleTimeReport()

    expect(result.rows[0].daysToApprove).toBe(5)
  })

  it('averages days-to-approve per discipline, worst-average first', async () => {
    const db = {
      drawingRevision: {
        findMany: vi.fn().mockResolvedValue([
          { drawingNumber: 'A-101', revisionNumber: 'A', discipline: 'ARCHITECTURAL', issuedDate: new Date(2026, 7, 1), createdAt: new Date(2026, 7, 1), approvedDate: new Date(2026, 7, 3), project: { projectName: 'P1' } },
          { drawingNumber: 'S-101', revisionNumber: 'A', discipline: 'STRUCTURAL', issuedDate: new Date(2026, 7, 1), createdAt: new Date(2026, 7, 1), approvedDate: new Date(2026, 7, 21), project: { projectName: 'P1' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDrawingApprovalCycleTimeReport()

    expect(result.byDiscipline.map((d) => d.discipline)).toEqual(['STRUCTURAL', 'ARCHITECTURAL'])
  })

  it('only queries APPROVED drawings with a real approvedDate', async () => {
    const db = { drawingRevision: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateDrawingApprovalCycleTimeReport()

    expect(db.drawingRevision.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'APPROVED', approvedDate: { not: null } },
    }))
  })

  it('returns an honest empty result when there are no approved drawings', async () => {
    const db = { drawingRevision: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDrawingApprovalCycleTimeReport()

    expect(result.rows).toEqual([])
    expect(result.byDiscipline).toEqual([])
    expect(result.summary).toEqual({ totalApproved: 0, avgDaysToApprove: 0 })
  })
})

describe('reportService.generateProjectStageProgressReport', () => {
  it('computes stageProgressPercent from the recognized Architect pipeline position', async () => {
    const db = {
      serviceProject: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', projectName: 'Office Fitout', stage: 'DRAWINGS', stageUpdatedAt: new Date(), createdAt: new Date(), client: { customerName: 'Client A' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProjectStageProgressReport()

    // DRAWINGS is index 3 (0-based) of 7 Architect stages -> (4/7)*100 = 57%
    expect(result.rows[0].stageProgressPercent).toBe(57)
  })

  it('computes stageProgressPercent from the recognized Civil pipeline when the stage matches that vocabulary instead', async () => {
    const db = {
      serviceProject: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', projectName: 'Road Widening', stage: 'FOUNDATION', stageUpdatedAt: new Date(), createdAt: new Date(), client: { customerName: 'Client A' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProjectStageProgressReport()

    // FOUNDATION is index 2 (0-based) of 6 Civil stages -> (3/6)*100 = 50%
    expect(result.rows[0].stageProgressPercent).toBe(50)
  })

  it('returns null stageProgressPercent for a stage value not in any recognized pipeline', async () => {
    const db = {
      serviceProject: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', projectName: 'Custom Project', stage: 'SOME_CUSTOM_STAGE', stageUpdatedAt: new Date(), createdAt: new Date(), client: { customerName: 'Client A' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProjectStageProgressReport()

    expect(result.rows[0].stageProgressPercent).toBeNull()
  })

  it('sorts worst-first by days stuck in the current stage, and falls back to createdAt when stageUpdatedAt was never set', async () => {
    const db = {
      serviceProject: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', projectName: 'Recently moved', stage: 'CONCEPT', stageUpdatedAt: new Date(Date.now() - 2 * 86400000), createdAt: new Date(Date.now() - 200 * 86400000), client: { customerName: 'Client A' } },
          { id: 'p2', projectName: 'Never tracked', stage: 'SCHEMATIC', stageUpdatedAt: null, createdAt: new Date(Date.now() - 40 * 86400000), client: { customerName: 'Client B' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProjectStageProgressReport()

    expect(result.rows.map((r) => r.projectId)).toEqual(['p2', 'p1'])
    expect(result.rows[0].daysInStage).toBeGreaterThanOrEqual(39)
  })

  it('only queries ACTIVE projects with a stage set', async () => {
    const db = { serviceProject: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateProjectStageProgressReport()

    expect(db.serviceProject.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'ACTIVE', stage: { not: null } },
    }))
  })

  it('returns an honest empty result when there are no active staged projects', async () => {
    const db = { serviceProject: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProjectStageProgressReport()

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalActiveProjects: 0, avgDaysInStage: 0 })
  })
})

describe('reportService.generateSiteVisitBillingReport', () => {
  it('splits billed vs. unbilled by whether invoiceId is set, unbilled first', async () => {
    const db = {
      siteVisit: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'sv1', visitType: 'INSPECTION', visitDate: new Date(2026, 7, 1), billableAmount: 2000, invoiceId: 'inv-1', project: { projectName: 'Bridge Repair' } },
          { id: 'sv2', visitType: 'SURVEY', visitDate: new Date(2026, 7, 5), billableAmount: 1500, invoiceId: null, project: { projectName: 'Bridge Repair' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSiteVisitBillingReport()

    expect(result.rows.map((r) => r.siteVisitId)).toEqual(['sv2', 'sv1'])
    expect(result.summary).toEqual({ totalBillableAmount: 3500, totalBilledAmount: 2000, totalUnbilledAmount: 1500, unbilledCount: 1 })
  })

  it('only queries visits with a real billableAmount set', async () => {
    const db = { siteVisit: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateSiteVisitBillingReport()

    expect(db.siteVisit.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { billableAmount: { not: null } },
    }))
  })

  it('returns an honest empty result when there are no billable visits', async () => {
    const db = { siteVisit: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSiteVisitBillingReport()

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalBillableAmount: 0, totalBilledAmount: 0, totalUnbilledAmount: 0, unbilledCount: 0 })
  })
})

describe('reportService.generateMaterialTestResultsReport', () => {
  it('sorts FAILED results first, then PENDING, then PASS', async () => {
    const db = {
      materialTestResult: {
        findMany: vi.fn().mockResolvedValue([
          { testType: 'CONCRETE_CUBE_STRENGTH', materialDescription: null, testValue: 30, unit: 'MPa', requiredMinValue: 25, result: 'PASS', testedDate: new Date(), siteVisit: { project: { projectName: 'P1' } } },
          { testType: 'SLUMP_TEST', materialDescription: null, testValue: null, unit: null, requiredMinValue: null, result: 'PENDING', testedDate: null, siteVisit: { project: { projectName: 'P1' } } },
          { testType: 'STEEL_TENSILE', materialDescription: null, testValue: 18, unit: 'MPa', requiredMinValue: 25, result: 'FAIL', testedDate: new Date(), siteVisit: { project: { projectName: 'P1' } } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateMaterialTestResultsReport()

    expect(result.rows.map((r) => r.result)).toEqual(['FAIL', 'PENDING', 'PASS'])
  })

  it('computes passRatePercent from decided (PASS+FAIL) tests only, excluding PENDING', async () => {
    const db = {
      materialTestResult: {
        findMany: vi.fn().mockResolvedValue([
          { testType: 'A', materialDescription: null, testValue: 1, unit: null, requiredMinValue: null, result: 'PASS', testedDate: null, siteVisit: { project: { projectName: 'P1' } } },
          { testType: 'B', materialDescription: null, testValue: 1, unit: null, requiredMinValue: null, result: 'PASS', testedDate: null, siteVisit: { project: { projectName: 'P1' } } },
          { testType: 'C', materialDescription: null, testValue: 1, unit: null, requiredMinValue: null, result: 'FAIL', testedDate: null, siteVisit: { project: { projectName: 'P1' } } },
          { testType: 'D', materialDescription: null, testValue: null, unit: null, requiredMinValue: null, result: 'PENDING', testedDate: null, siteVisit: { project: { projectName: 'P1' } } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateMaterialTestResultsReport()

    expect(result.summary).toEqual({ totalTests: 4, passCount: 2, failCount: 1, pendingCount: 1, passRatePercent: 66.7 })
  })

  it('returns an honest empty result when no tests are recorded', async () => {
    const db = { materialTestResult: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateMaterialTestResultsReport()

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalTests: 0, passCount: 0, failCount: 0, pendingCount: 0, passRatePercent: 0 })
  })
})

describe('reportService.generateRetainerUtilizationReport', () => {
  it('computes utilizationPercent from logged hours against the monthly bucket, worst (highest) first', async () => {
    const db = {
      retainerAgreement: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'r1', title: 'Low Usage', hoursPerMonth: 20, monthlyAmount: 20000, lastInvoicedPeriod: null, client: { customerName: 'Client A' } },
          { id: 'r2', title: 'High Usage', hoursPerMonth: 10, monthlyAmount: 15000, lastInvoicedPeriod: null, client: { customerName: 'Client B' } },
        ]),
      },
      timeEntry: {
        findMany: vi.fn().mockImplementation(({ where }: { where: { retainerId: string } }) =>
          Promise.resolve(where.retainerId === 'r1' ? [{ hours: 2 }] : [{ hours: 9 }])
        ),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRetainerUtilizationReport()

    expect(result.rows.map((r) => r.title)).toEqual(['High Usage', 'Low Usage'])
    expect(result.rows[0].utilizationPercent).toBe(90)
  })

  it('marks billedThisPeriod true only when lastInvoicedPeriod matches the current month', async () => {
    const now = new Date()
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const db = {
      retainerAgreement: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'r1', title: 'Billed', hoursPerMonth: 10, monthlyAmount: 20000, lastInvoicedPeriod: currentPeriod, client: { customerName: 'Client A' } },
          { id: 'r2', title: 'Unbilled', hoursPerMonth: 10, monthlyAmount: 20000, lastInvoicedPeriod: '2020-01', client: { customerName: 'Client B' } },
        ]),
      },
      timeEntry: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRetainerUtilizationReport()

    expect(result.rows.find((r) => r.title === 'Billed')?.billedThisPeriod).toBe(true)
    expect(result.rows.find((r) => r.title === 'Unbilled')?.billedThisPeriod).toBe(false)
    expect(result.summary.unbilledCount).toBe(1)
  })

  it('counts a retainer as over-utilized only above 100%', async () => {
    const db = {
      retainerAgreement: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'r1', title: 'Over', hoursPerMonth: 10, monthlyAmount: 20000, lastInvoicedPeriod: null, client: { customerName: 'Client A' } },
        ]),
      },
      timeEntry: { findMany: vi.fn().mockResolvedValue([{ hours: 15 }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRetainerUtilizationReport()

    expect(result.rows[0].utilizationPercent).toBe(150)
    expect(result.summary.overUtilizedCount).toBe(1)
  })

  it('only queries ACTIVE retainers with an hours bucket set', async () => {
    const db = { retainerAgreement: { findMany: vi.fn().mockResolvedValue([]) }, timeEntry: { findMany: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateRetainerUtilizationReport()

    expect(db.retainerAgreement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'ACTIVE', hoursPerMonth: { not: null } },
    }))
  })
})

describe('reportService.generateProposalWinRateReport', () => {
  it('computes winRatePercent from decided (ACCEPTED+EXPIRED) quotations only, excluding still-pending SENT ones', async () => {
    const db = {
      quotation: {
        findMany: vi.fn().mockResolvedValue([
          { status: 'ACCEPTED', totalAmount: 50000 },
          { status: 'ACCEPTED', totalAmount: 30000 },
          { status: 'EXPIRED', totalAmount: 20000 },
          { status: 'SENT', totalAmount: 10000 },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProposalWinRateReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary).toEqual({ wonCount: 2, lostCount: 1, pendingCount: 1, winRatePercent: 66.7, wonValue: 80000 })
  })

  it('excludes DRAFT quotations entirely — never sent, not a decided proposal', async () => {
    const db = { quotation: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateProposalWinRateReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(db.quotation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { in: ['SENT', 'ACCEPTED', 'EXPIRED'] } }),
    }))
  })

  it('returns an honest 0% win rate when nothing has been decided yet', async () => {
    const db = { quotation: { findMany: vi.fn().mockResolvedValue([{ status: 'SENT', totalAmount: 10000 }]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateProposalWinRateReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary.winRatePercent).toBe(0)
    expect(result.summary.pendingCount).toBe(1)
  })
})

describe('reportService.generateClientRevenueConcentrationReport', () => {
  it('computes revenueSharePercent and cumulativeSharePercent, ranked highest-revenue-first', async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          { customerId: 'c1', customer: { customerName: 'Big Client' }, totalAmount: 80000 },
          { customerId: 'c2', customer: { customerName: 'Small Client' }, totalAmount: 20000 },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateClientRevenueConcentrationReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.rows.map((r) => r.clientName)).toEqual(['Big Client', 'Small Client'])
    expect(result.rows[0]).toMatchObject({ revenue: 80000, revenueSharePercent: 80, cumulativeSharePercent: 80 })
    expect(result.rows[1]).toMatchObject({ revenue: 20000, revenueSharePercent: 20, cumulativeSharePercent: 100 })
    expect(result.summary.topClientSharePercent).toBe(80)
  })

  it('sums multiple invoices for the same customer into one row', async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          { customerId: 'c1', customer: { customerName: 'Repeat Client' }, totalAmount: 10000 },
          { customerId: 'c1', customer: { customerName: 'Repeat Client' }, totalAmount: 15000 },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateClientRevenueConcentrationReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].revenue).toBe(25000)
  })

  it('excludes CANCELLED invoices', async () => {
    const db = { invoice: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateClientRevenueConcentrationReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(db.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { not: 'CANCELLED' } }),
    }))
  })

  it('returns an honest empty result when there is no invoiced revenue', async () => {
    const db = { invoice: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateClientRevenueConcentrationReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalRevenue: 0, topClientSharePercent: 0, top3SharePercent: 0 })
  })
})

describe('reportService.generateCampaignROIReport', () => {
  it('computes budgetVariancePercent as overspend/underspend against the planned adSpendBudget', async () => {
    const db = {
      serviceProject: {
        findMany: vi.fn().mockResolvedValue([
          { projectName: 'Diwali Push', client: { customerName: 'Client A' }, targetChannel: 'Meta Ads', adSpendBudget: 10000, campaignPerformanceEntries: [{ actualSpend: 12000, conversions: 20 }] },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCampaignROIReport()

    expect(result.rows[0].budgetVariancePercent).toBe(20)
    expect(result.rows[0].costPerConversion).toBe(600)
    expect(result.summary.overBudgetCount).toBe(1)
  })

  it('leaves budgetVariancePercent null when no budget was ever set — never fabricates a variance', async () => {
    const db = {
      serviceProject: {
        findMany: vi.fn().mockResolvedValue([
          { projectName: 'Untracked Campaign', client: { customerName: 'Client B' }, targetChannel: null, adSpendBudget: null, campaignPerformanceEntries: [{ actualSpend: 5000, conversions: 10 }] },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateCampaignROIReport()

    expect(result.rows[0].budgetVariancePercent).toBeNull()
  })

  it('only queries MARKETING_CAMPAIGN projects', async () => {
    const db = { serviceProject: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateCampaignROIReport()

    expect(db.serviceProject.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectType: 'MARKETING_CAMPAIGN' },
    }))
  })
})

describe('reportService.generateDeliverableStatusPipelineReport', () => {
  it('groups deliverables by status and counts overdue PLANNED/IN_PROGRESS items only', async () => {
    const now = Date.now()
    const db = {
      contentCalendarItem: {
        findMany: vi.fn().mockResolvedValue([
          { status: 'PLANNED', scheduledDate: new Date(now - 5 * 86400000) }, // overdue
          { status: 'IN_PROGRESS', scheduledDate: new Date(now + 5 * 86400000) }, // not yet due
          { status: 'PUBLISHED', scheduledDate: new Date(now - 5 * 86400000) }, // done, not "overdue"
          { status: 'CANCELLED', scheduledDate: new Date(now - 5 * 86400000) }, // cancelled, not "overdue"
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDeliverableStatusPipelineReport()

    expect(result.summary).toEqual({ totalDeliverables: 4, overdueCount: 1 })
    expect(result.stages.find((s) => s.status === 'PLANNED')?.count).toBe(1)
  })

  it('returns an honest empty result when no deliverables are recorded', async () => {
    const db = { contentCalendarItem: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateDeliverableStatusPipelineReport()

    expect(result.stages).toEqual([])
    expect(result.summary).toEqual({ totalDeliverables: 0, overdueCount: 0 })
  })
})

describe('reportService.generateChannelPerformanceReport', () => {
  it('aggregates performance entries across every campaign sharing the same channel', async () => {
    const db = {
      serviceProject: {
        findMany: vi.fn().mockResolvedValue([
          { targetChannel: 'Meta Ads', campaignPerformanceEntries: [{ impressions: 10000, clicks: 500, conversions: 25, actualSpend: 5000 }] },
          { targetChannel: 'Meta Ads', campaignPerformanceEntries: [{ impressions: 20000, clicks: 1000, conversions: 50, actualSpend: 10000 }] },
          { targetChannel: 'Google Ads', campaignPerformanceEntries: [{ impressions: 5000, clicks: 100, conversions: 5, actualSpend: 2000 }] },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateChannelPerformanceReport()

    const meta = result.rows.find((r) => r.channel === 'Meta Ads')
    expect(meta).toMatchObject({ campaignCount: 2, totalImpressions: 30000, totalClicks: 1500, totalConversions: 75, totalActualSpend: 15000 })
    expect(meta?.ctrPercent).toBe(5)
  })

  it('only queries MARKETING_CAMPAIGN projects with a channel set', async () => {
    const db = { serviceProject: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateChannelPerformanceReport()

    expect(db.serviceProject.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectType: 'MARKETING_CAMPAIGN', targetChannel: { not: null } },
    }))
  })
})

describe('reportService.generateRetainerWorkDeliveredReport', () => {
  it('counts only PUBLISHED deliverables within the current period, sorted worst (fewest delivered) first', async () => {
    const db = {
      retainerAgreement: {
        findMany: vi.fn().mockResolvedValue([
          { title: 'High Output', monthlyAmount: 20000, lastInvoicedPeriod: null, client: { customerName: 'Client A', serviceProjects: [{ id: 'proj-a' }] } },
          { title: 'Low Output', monthlyAmount: 20000, lastInvoicedPeriod: null, client: { customerName: 'Client B', serviceProjects: [{ id: 'proj-b' }] } },
        ]),
      },
      contentCalendarItem: {
        count: vi.fn().mockImplementation(({ where }: { where: { projectId: { in: string[] } } }) =>
          Promise.resolve(where.projectId.in[0] === 'proj-a' ? 8 : 1)
        ),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRetainerWorkDeliveredReport()

    expect(result.rows.map((r) => r.title)).toEqual(['Low Output', 'High Output'])
  })

  it('excludes retainers whose client has no MARKETING_CAMPAIGN project at all', async () => {
    const db = {
      retainerAgreement: {
        findMany: vi.fn().mockResolvedValue([
          { title: 'Non-Marketing Retainer', monthlyAmount: 20000, lastInvoicedPeriod: null, client: { customerName: 'Client C', serviceProjects: [] } },
        ]),
      },
      contentCalendarItem: { count: vi.fn() },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRetainerWorkDeliveredReport()

    expect(result.rows).toEqual([])
    expect(db.contentCalendarItem.count).not.toHaveBeenCalled()
  })

  it('flags zeroDeliveredCount for a retainer with no published deliverables this period', async () => {
    const db = {
      retainerAgreement: {
        findMany: vi.fn().mockResolvedValue([
          { title: 'Stalled Retainer', monthlyAmount: 20000, lastInvoicedPeriod: null, client: { customerName: 'Client D', serviceProjects: [{ id: 'proj-d' }] } },
        ]),
      },
      contentCalendarItem: { count: vi.fn().mockResolvedValue(0) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateRetainerWorkDeliveredReport()

    expect(result.summary.zeroDeliveredCount).toBe(1)
  })
})

describe('reportService.generateIssueAgingReport', () => {
  it('flags an SLA breach only once daysOpen exceeds the priority threshold (HIGH=2, MED=5, LOW=10)', async () => {
    const now = Date.now()
    const db = {
      issue: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'i1', title: 'Critical bug', priority: 'HIGH', status: 'OPEN', reportedDate: new Date(now - 3 * 86400000), project: { projectName: 'App' } },
          { id: 'i2', title: 'Minor tweak', priority: 'LOW', status: 'OPEN', reportedDate: new Date(now - 3 * 86400000), project: { projectName: 'App' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateIssueAgingReport()

    expect(result.rows.find((r) => r.issueId === 'i1')?.slaBreached).toBe(true)
    expect(result.rows.find((r) => r.issueId === 'i2')?.slaBreached).toBe(false)
    expect(result.summary.breachedCount).toBe(1)
  })

  it('only queries OPEN/IN_PROGRESS issues', async () => {
    const db = { issue: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateIssueAgingReport()

    expect(db.issue.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
    }))
  })

  it('returns an honest empty result when there are no open issues', async () => {
    const db = { issue: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateIssueAgingReport()

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalOpenIssues: 0, breachedCount: 0 })
  })
})

describe('reportService.generateTeamUtilizationReport', () => {
  it('splits billable (ratePerHour > 0) vs non-billable hours per employee', async () => {
    const db = {
      timeEntry: {
        findMany: vi.fn().mockResolvedValue([
          { hours: 4, ratePerHour: 500, employeeId: 'emp-1', employee: { fullName: 'Dev A' } },
          { hours: 2, ratePerHour: 0, employeeId: 'emp-1', employee: { fullName: 'Dev A' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTeamUtilizationReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.rows[0]).toMatchObject({ employeeName: 'Dev A', billableHours: 4, nonBillableHours: 2, totalHours: 6, utilizationPercent: 66.7 })
  })

  it('only queries TimeEntry rows tied to a ServiceProject', async () => {
    const db = { timeEntry: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateTeamUtilizationReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(db.timeEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ projectId: { not: null } }),
    }))
  })

  it('sorts worst (least utilized) first', async () => {
    const db = {
      timeEntry: {
        findMany: vi.fn().mockResolvedValue([
          { hours: 8, ratePerHour: 500, employeeId: 'emp-1', employee: { fullName: 'Fully Billable' } },
          { hours: 8, ratePerHour: 0, employeeId: 'emp-2', employee: { fullName: 'Never Billable' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTeamUtilizationReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.rows.map((r) => r.employeeName)).toEqual(['Never Billable', 'Fully Billable'])
  })
})

describe('reportService.generateSprintBillingReport', () => {
  it('surfaces unlinked (unbilled) sprints first', async () => {
    const db = {
      sprint: {
        findMany: vi.fn().mockResolvedValue([
          { project: { projectName: 'App' }, sprintNumber: 1, name: 'Sprint 1', milestone: { status: 'INVOICED', milestoneAmount: 20000 } },
          { project: { projectName: 'App' }, sprintNumber: 2, name: 'Sprint 2', milestone: null },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSprintBillingReport()

    expect(result.rows.map((r) => r.sprintNumber)).toEqual([2, 1])
    expect(result.summary.unlinkedCount).toBe(1)
  })

  it('only queries COMPLETED sprints', async () => {
    const db = { sprint: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await reportService.generateSprintBillingReport()

    expect(db.sprint.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'COMPLETED' },
    }))
  })

  it('returns an honest empty result when there are no completed sprints', async () => {
    const db = { sprint: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateSprintBillingReport()

    expect(result.rows).toEqual([])
    expect(result.summary).toEqual({ totalCompletedSprints: 0, unlinkedCount: 0 })
  })
})
