// GST/tax reports must read the stored taxable value of a tax-inclusive invoice line (line total less tax), never
// unitPrice x quantity, which is the tax-INCLUSIVE amount for those documents.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../blood-bank.service', () => ({ getBloodStock: vi.fn() }))
vi.mock('../logistics-analytics.service', () => ({ getLogisticsAnalytics: vi.fn() }))

import { getPrisma } from '../../database/db'
import { reportService } from '../report.service'

// 3 x 99.99 inclusive at 18%: payable 299.97, tax 45.76, taxable 254.21
const inclusiveItem = { hsnCode: '1006', taxRate: 18, taxAmount: 45.76, quantity: 3, unitPrice: 99.99, discountAmount: 0, lineTotal: 299.97, productName: 'Rice', weightUnit: null, product: { unit: 'KG' }, invoiceId: 'inv-1' }
// return of 1 unit: negative tax-exclusive lineTotal, positive tax (the return-line convention)
const returnItem = { ...inclusiveItem, quantity: 1, taxAmount: 15.25, lineTotal: -84.74, invoiceId: 'inv-r' }

function inv(id: string, over: Record<string, unknown> = {}) {
  return {
    id, invoiceNumber: id, invoiceDate: new Date('2024-01-15'), status: 'ACTIVE', invoiceType: 'RETAIL', pricesIncludeTax: true,
    subtotal: 254.21, discountAmount: 0, taxAmount: 45.76, totalAmount: 299.97, paymentStatus: 'PAID', gstType: 'CGST_SGST', buyerState: 'Maharashtra',
    customer: { customerName: 'X', taxNumber: null, state: 'Maharashtra' }, items: [inclusiveItem], payments: [], ...over
  }
}
function makeDb(over: Record<string, unknown> = {}) {
  return {
    invoice: { findMany: vi.fn().mockResolvedValue([inv('inv-1')]), count: vi.fn().mockResolvedValue(1) },
    invoiceItem: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    taxConfiguration: { findMany: vi.fn().mockResolvedValue([]) },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ taxModel: 'GST' }) },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    inventory: { findMany: vi.fn().mockResolvedValue([]) },
    bill: { findMany: vi.fn().mockResolvedValue([]) },
    expense: { findMany: vi.fn().mockResolvedValue([]) },
    ...over
  }
}
beforeEach(() => vi.clearAllMocks())

describe('tax reports on tax-inclusive invoices', () => {
  it('Tax report: taxable turnover is 254.21 (not 299.97) and a return nets its own taxable value out', async () => {
    const db = makeDb()
    db.invoiceItem.findMany = vi.fn().mockResolvedValue([
      { ...inclusiveItem, invoice: { invoiceDate: new Date(), gstType: 'CGST_SGST', invoiceType: 'RETAIL', pricesIncludeTax: true } },
      { ...returnItem, invoice: { invoiceDate: new Date(), gstType: 'CGST_SGST', invoiceType: 'RETURN', pricesIncludeTax: true } }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await reportService.generateTaxReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    expect(r.summary.totalTaxableAmount).toBeCloseTo(254.21 - 84.74, 6)
    expect(r.summary.totalTaxCollected).toBeCloseTo(45.76 - 15.25, 6)
  })

  it('GSTR-1 and the HSN summary report the stored taxable value', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([inv('inv-1'), inv('inv-r', { invoiceType: 'RETURN', items: [returnItem] })])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const g = await reportService.generateGSTR1({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    const taxable = g.b2cs.reduce((s, r) => s + r.taxableValue, 0)
    expect(taxable).toBeCloseTo(254.21 - 84.74, 6)
    const h = await reportService.generateHSNSummaryReport({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    expect(h.b2c[0].taxableValue).toBeCloseTo(254.21 - 84.74, 6)
  })

  it('GSTR-3B outward taxable supplies and tax use the stored values', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([inv('inv-1')])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await reportService.generateGSTR3BPreview({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    expect(r.table31.taxableOutwardSupplies).toBeCloseTo(254.21, 6)
    expect(r.table31.taxAmount.cgst + r.table31.taxAmount.sgst).toBeCloseTo(45.76, 6)
  })

  it('an exclusive invoice is read exactly as before (unit price x quantity less discount)', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([inv('inv-1', { pricesIncludeTax: false, items: [{ ...inclusiveItem, quantity: 2, unitPrice: 500, taxAmount: 180, lineTotal: 1180 }] })])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await reportService.generateGSTR3BPreview({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    expect(r.table31.taxableOutwardSupplies).toBe(1000)
  })
})
