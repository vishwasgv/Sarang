import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../valuation.service', () => ({ getProductCostsBatch: vi.fn().mockResolvedValue(new Map([['p1', 60], ['p2', 10]])) }))
vi.mock('../sales-lines.query', () => ({
  loadSalesLines: vi.fn().mockResolvedValue({
    decimals: 2,
    lines: [
      { invoiceId: 'i1', customerId: 'c1', customerName: 'Acme', productId: 'p1', productName: 'Flour', quantity: 10, taxable: 1000, tax: 180, total: 1180 },
      { invoiceId: 'i2', customerId: 'c2', customerName: 'Beta', productId: 'p2', productName: 'Salt', quantity: 5, taxable: 100, tax: 5, total: 105 },
      { invoiceId: 'i3', customerId: 'c1', customerName: 'Acme', productId: 'p1', productName: 'Flour', quantity: -2, taxable: -200, tax: -36, total: -236 }
    ]
  })
}))

import { getPrisma } from '../../database/db'
import { MONEY_REPORTS } from '../generic-reports.money'

const p = { dateFrom: '2026-09-01', dateTo: '2026-09-30', asOf: '2026-09-30' }
const day = (s: string) => new Date(`${s}T12:00:00`)

describe('profit reports', () => {
  it('profit by item: cost at today\'s cost, returns take back their cost, best profit first', async () => {
    const r = await MONEY_REPORTS.profitByItem.run(p)
    expect(r.rows[0]).toMatchObject({ name: 'Flour', quantity: 8, revenue: 800, cost: 480, profit: 320, margin: 40 })
    expect(r.rows[1]).toMatchObject({ name: 'Salt', revenue: 100, cost: 50, profit: 50, margin: 50 })
    expect(r.totals).toMatchObject({ revenue: 900, cost: 530, profit: 370 })
    expect(r.summary.find((s) => s.labelKey === 'profit.margin')!.value).toBeCloseTo(41.1, 1)
  })
  it('profit by customer groups the same lines by customer', async () => {
    const r = await MONEY_REPORTS.profitByCustomer.run(p)
    expect(r.rows.map((x) => x.name)).toEqual(['Acme', 'Beta'])
    expect(r.rows[0]).toMatchObject({ revenue: 800, profit: 320 })
  })
})

describe('receivables and payables summaries', () => {
  it('splits each party balance into overdue and due within 7 days', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) },
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          { id: '1', customerId: 'c1', customer: { customerName: 'Acme' }, balanceAmount: 500, dueDate: day('2026-09-10'), invoiceDate: day('2026-09-01') },
          { id: '2', customerId: 'c1', customer: { customerName: 'Acme' }, balanceAmount: 300, dueDate: day('2026-10-03'), invoiceDate: day('2026-09-20') },
          { id: '3', customerId: 'c2', customer: { customerName: 'Beta' }, balanceAmount: 200, dueDate: day('2026-11-30'), invoiceDate: day('2026-09-25') },
          { id: '4', customerId: null, customer: null, balanceAmount: 50, dueDate: null, invoiceDate: day('2026-09-29') }
        ])
      }
    } as never)
    const r = await MONEY_REPORTS.receivablesSummary.run(p)
    expect(r.rows[0]).toMatchObject({ name: 'Acme', documents: 2, balance: 800, overdue: 500, dueThisWeek: 300, oldestDays: 20 })
    expect(r.totals).toMatchObject({ balance: 1050, overdue: 550, dueThisWeek: 300 })
  })

  it('payables summary reads bills by supplier', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) },
      bill: { findMany: vi.fn().mockResolvedValue([{ id: 'b', supplierId: 's1', supplier: { supplierName: 'Far Ltd' }, balanceAmount: 900, dueDate: day('2026-09-01'), billDate: day('2026-08-15') }]) }
    } as never)
    const r = await MONEY_REPORTS.payablesSummary.run(p)
    expect(r.rows[0]).toMatchObject({ name: 'Far Ltd', balance: 900, overdue: 900 })
  })
})

describe('expenses and assets', () => {
  it('groups expenses by category and by vendor with shares that add to 100', async () => {
    const expenses = [
      { amount: 600, categoryId: 'k1', category: { categoryName: 'Rent' }, supplierId: 's1', supplier: { supplierName: 'Landlord' } },
      { amount: 300, categoryId: 'k2', category: { categoryName: 'Fuel' }, supplierId: null, supplier: null },
      { amount: 100, categoryId: 'k1', category: { categoryName: 'Rent' }, supplierId: null, supplier: null }
    ]
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) }, expense: { findMany: vi.fn().mockResolvedValue(expenses) } } as never)
    const byCat = await MONEY_REPORTS.expenseByCategory.run(p)
    expect(byCat.rows).toEqual([{ name: 'Rent', count: 2, amount: 700, share: 70 }, { name: 'Fuel', count: 1, amount: 300, share: 30 }])
    const byVendor = await MONEY_REPORTS.expenseByVendor.run(p)
    expect(byVendor.rows.find((x) => x.name === '')).toMatchObject({ amount: 400 })
  })

  it('fixed asset register shows book value as cost less depreciation', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) },
      fixedAsset: { findMany: vi.fn().mockResolvedValue([{ assetCode: 'FA-1', assetName: 'Van', category: 'Vehicle', purchaseDate: day('2025-04-01'), purchaseCost: 500000, accumulatedDepreciation: 120000.5, status: 'ACTIVE' }]) }
    } as never)
    const r = await MONEY_REPORTS.fixedAssetRegister.run(p)
    expect(r.rows[0]).toMatchObject({ code: 'FA-1', cost: 500000, depreciation: 120000.5, bookValue: 379999.5 })
  })

  it('sales register lists returns as negatives', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) },
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          { invoiceNumber: 'A', invoiceDate: day('2026-09-01'), invoiceType: 'RETAIL', subtotal: 100, taxAmount: 18, totalAmount: 118, paidAmount: 118, paymentStatus: 'PAID', customer: { customerName: 'Acme', taxNumber: 'G1' } },
          { invoiceNumber: 'R', invoiceDate: day('2026-09-02'), invoiceType: 'RETURN', subtotal: -20, taxAmount: -3.6, totalAmount: -23.6, paidAmount: 0, paymentStatus: 'PAID', customer: null }
        ])
      }
    } as never)
    const r = await MONEY_REPORTS.salesRegister.run(p)
    expect(r.rows[1]).toMatchObject({ number: 'R', total: -23.6, subtotal: -20 })
    expect(r.totals).toMatchObject({ total: 94.4 })
  })
})
