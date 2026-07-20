import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    customer: { findMany: vi.fn().mockResolvedValue([]) },
    supplier: { findMany: vi.fn().mockResolvedValue([]) },
    supplierLedger: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
    payment: { findMany: vi.fn().mockResolvedValue([]) },
    expense: { findMany: vi.fn().mockResolvedValue([]) },
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

  it('always discloses ITC/reverse-charge as not tracked rather than a fabricated zero', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateGSTR3BPreview({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    expect(result.notes.some(n => /Input Tax Credit/.test(n))).toBe(true)
    expect(result.notes.some(n => /[Rr]everse-charge/.test(n))).toBe(true)
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
  it('sums unpaid/partial invoice balances per customer and skips fully paid ones', async () => {
    const db = makeDb()
    db.customer.findMany = vi.fn().mockResolvedValue([{ id: 'cust-1', customerName: 'ABC Corp', phone: '111' }])
    db.invoice.findMany = vi.fn().mockResolvedValue([
      { customerId: 'cust-1', balanceAmount: 300, invoiceDate: new Date(), dueDate: null },
      { customerId: 'cust-1', balanceAmount: 200, invoiceDate: new Date(), dueDate: null }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateOutstandingReport()

    expect(result.customers.rows).toHaveLength(1)
    expect(result.customers.rows[0].outstanding).toBe(500)
    expect(result.customers.totalOutstanding).toBe(500)
  })

  it('ages customer balances from dueDate when set, not invoiceDate', async () => {
    const db = makeDb()
    const now = new Date()
    const fortyDaysAgo = new Date(now.getTime() - 40 * 86400000)
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000)
    db.customer.findMany = vi.fn().mockResolvedValue([{ id: 'cust-1', customerName: 'ABC Corp', phone: null }])
    // Invoiced 40 days ago (would be days31to60 by invoiceDate) but due only 5 days ago
    // (days1to30 by dueDate) — proves dueDate, not invoiceDate, drives the bucket.
    db.invoice.findMany = vi.fn().mockResolvedValue([
      { customerId: 'cust-1', balanceAmount: 100, invoiceDate: fortyDaysAgo, dueDate: fiveDaysAgo }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateOutstandingReport()

    expect(result.customers.rows[0].aging.days1to30).toBe(100)
    expect(result.customers.rows[0].aging.days31to60).toBe(0)
  })

  it('falls back to invoiceDate when dueDate is null', async () => {
    const db = makeDb()
    const now = new Date()
    const fortyDaysAgo = new Date(now.getTime() - 40 * 86400000)
    db.customer.findMany = vi.fn().mockResolvedValue([{ id: 'cust-1', customerName: 'ABC Corp', phone: null }])
    db.invoice.findMany = vi.fn().mockResolvedValue([
      { customerId: 'cust-1', balanceAmount: 100, invoiceDate: fortyDaysAgo, dueDate: null }
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

// ─── Profit & Loss Statement (fresh-audit fix, 2026-07-12) ─────────────────────

describe('reportService.generateProfitAndLossReport', () => {
  function makePLInvoice(overrides: Record<string, unknown> = {}) {
    return {
      totalAmount: 1000, invoiceType: 'SALE',
      items: [{ quantity: 2, product: { costPrice: 100 } }],
      ...overrides,
    }
  }

  it('computes revenue, COGS, and gross profit correctly for a single sale invoice', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([makePLInvoice()]) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
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
        makePLInvoice({ invoiceType: 'RETURN', totalAmount: -400, items: [{ quantity: 1, product: { costPrice: 100 } }] }), // RETURN: revenue -400, cogs -100
      ]) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
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
  it('always balances (total debit === total credit) via the Capital & Retained Earnings plug line', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([
        { totalAmount: 1180, invoiceType: 'SALE', taxAmount: 180, items: [{ quantity: 2, product: { costPrice: 100 } }] },
      ]) },
      expense: { findMany: vi.fn().mockResolvedValue([{ amount: 150, category: { categoryName: 'Rent' } }]) },
      payment: { findMany: vi.fn().mockResolvedValue([
        { paymentDate: new Date('2026-01-10'), amount: 1180, paymentMethod: 'CASH', referenceNumber: null, invoice: { invoiceNumber: 'INV-1' } },
      ]) },
      customer: { findMany: vi.fn().mockResolvedValue([{ outstandingBalance: 250 }, { outstandingBalance: 400 }]) },
      supplierLedger: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([
          { supplierId: 's1', _sum: { debitAmount: 600, creditAmount: 100 } }, // net payable 500
          { supplierId: 's2', _sum: { debitAmount: 50, creditAmount: 200 } },  // net -150, excluded (not payable)
        ]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTrialBalanceReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.balanced).toBe(true)
    expect(result.totalDebit).toBe(result.totalCredit)

    const byAccount = Object.fromEntries(result.rows.map(r => [r.account, r]))
    expect(byAccount['Accounts Receivable'].debit).toBe(650) // 250 + 400
    expect(byAccount['Accounts Payable'].credit).toBe(500) // only the positive net balance
    expect(byAccount['Sales Revenue'].credit).toBe(1000) // 1180 total - 180 tax
    expect(byAccount['Tax Payable (Output)'].credit).toBe(180)
    expect(byAccount['Cost of Goods Sold'].debit).toBe(200) // 2 * 100
    expect(byAccount['Operating Expenses'].debit).toBe(150)
    expect(byAccount['Cash & Bank'].debit).toBe(1180 - 150) // payments in - expenses out
  })

  it('produces a balanced trial balance even with zero activity', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      payment: { findMany: vi.fn().mockResolvedValue([]) },
      customer: { findMany: vi.fn().mockResolvedValue([]) },
      supplierLedger: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTrialBalanceReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.balanced).toBe(true)
    expect(result.totalDebit).toBe(0)
    expect(result.totalCredit).toBe(0)
  })

  it('puts a negative Cash & Bank balance on the credit side (never a negative number in either column), and still balances', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      expense: { findMany: vi.fn().mockResolvedValue([{ amount: 5000, category: { categoryName: 'Salary' } }]) },
      payment: { findMany: vi.fn().mockResolvedValue([
        { paymentDate: new Date('2026-01-05'), amount: 1000, paymentMethod: 'CASH', referenceNumber: null, invoice: { invoiceNumber: 'INV-1' } },
      ]) }, // 1000 in, 5000 out -> cash = -4000
      customer: { findMany: vi.fn().mockResolvedValue([]) },
      supplierLedger: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTrialBalanceReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    const cashRow = result.rows.find(r => r.account === 'Cash & Bank')!
    expect(cashRow.debit).toBe(0)
    expect(cashRow.credit).toBe(4000) // -(-4000), shown positive on the correct side
    for (const row of result.rows) {
      expect(row.debit).toBeGreaterThanOrEqual(0)
      expect(row.credit).toBeGreaterThanOrEqual(0)
    }
    expect(result.balanced).toBe(true)
    expect(result.totalDebit).toBe(result.totalCredit)
  })

  it('puts negative COGS and negative net Revenue on the correct side when RETURN invoices outweigh SALEs in the period, and the Total row matches what is actually visible', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([
        // A single big RETURN with no offsetting SALE: revenue goes negative,
        // and so does COGS (goods came back into stock) — the same sign case
        // generateProfitAndLossReport's own RETURN correction handles.
        { totalAmount: -1180, invoiceType: 'RETURN', taxAmount: -180, items: [{ quantity: 1, product: { costPrice: 100 } }] },
      ]) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      payment: { findMany: vi.fn().mockResolvedValue([]) },
      customer: { findMany: vi.fn().mockResolvedValue([]) },
      supplierLedger: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generateTrialBalanceReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    // No row anywhere shows a negative number in either column — this is
    // the exact bug a live-app check caught: a negative row's total was
    // silently correct while the row itself vanished from both columns.
    for (const row of result.rows) {
      expect(row.debit).toBeGreaterThanOrEqual(0)
      expect(row.credit).toBeGreaterThanOrEqual(0)
    }
    // The Total row must equal the sum of what's actually visible in each
    // column — not just "some number that happens to balance."
    const sumDebit = result.rows.reduce((s, r) => s + r.debit, 0)
    const sumCredit = result.rows.reduce((s, r) => s + r.credit, 0)
    expect(Math.round(sumDebit * 100) / 100).toBe(result.totalDebit)
    expect(Math.round(sumCredit * 100) / 100).toBe(result.totalCredit)
    expect(result.balanced).toBe(true)
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

  it('returns a zero-value summary and empty rows when there are no prescription sales in range', async () => {
    const db = { invoiceItem: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reportService.generatePrescriptionDrugSalesReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    expect(result.summary).toEqual({ totalSales: 0, totalAmount: 0, missingPrescriptionDetails: 0 })
    expect(result.rows).toEqual([])
  })
})
