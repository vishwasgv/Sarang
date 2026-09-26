import { stockValueAndCostOfSales } from '../ratio-stock-cost.util'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../financial-statements.service', async () => {
  const actual = await vi.importActual<typeof import('../financial-statements.service')>('../financial-statements.service')
  return {
    ...actual,
    financialStatementsService: {
      generateBalanceSheet: vi.fn().mockResolvedValue({
        groups: [
          { key: 'currentAssets', total: 1000, rows: [{ accountCode: '1200', amount: 300 }, { accountCode: '1100', amount: 400 }] },
          { key: 'currentLiabilities', total: 500, rows: [{ accountCode: '2000', amount: 250 }] }
        ],
        totals: { liabilities: 500, equity: 400, currentProfit: 100 }
      })
    }
  }
})
vi.mock('../ratio-stock-cost.util', () => ({ stockValueAndCostOfSales: vi.fn().mockResolvedValue({ stockValue: 600, costOfSales: 1200 }) }))
vi.mock('../sales-lines.query', () => ({
  loadSalesLines: vi.fn().mockImplementation(async (p: { dateFrom: string }) => ({
    decimals: 2,
    lines: p.dateFrom.startsWith('2026')
      ? [{ date: '2026-09-05', taxable: 1200 }, { date: '2026-10-05', taxable: 800 }]
      : [{ date: '2025-09-05', taxable: 1000 }]
  }))
}))

import { getPrisma } from '../../database/db'
import { BOOKS_REPORTS } from '../generic-reports.books'

const p = { dateFrom: '2026-09-01', dateTo: '2026-09-30', asOf: '2026-09-30' }
const day = (s: string) => new Date(`${s}T12:00:00`)
const profile = { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) }
const acc = (id: string, code: string, name: string, type: string) => ({ id, accountCode: code, accountName: name, accountType: type })

describe('fund flow', () => {
  it('sources minus applications equals the change in cash', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      journalEntryLine: {
        findMany: vi.fn().mockResolvedValue([
          // cash sale 1000 with 180 tax, buy stock 300 by cash, pay 100 of a supplier bill
          { debitAmount: 1180, creditAmount: 0, account: acc('cash', '1000', 'Cash & Bank', 'ASSET') },
          { debitAmount: 0, creditAmount: 1000, account: acc('inc', '4000', 'Sales Revenue', 'INCOME') },
          { debitAmount: 0, creditAmount: 180, account: acc('tax', '2100', 'Tax Payable', 'LIABILITY') },
          { debitAmount: 300, creditAmount: 0, account: acc('inv', '1200', 'Inventory', 'ASSET') },
          { debitAmount: 0, creditAmount: 300, account: acc('cash', '1000', 'Cash & Bank', 'ASSET') },
          { debitAmount: 100, creditAmount: 0, account: acc('ap', '2000', 'Accounts Payable', 'LIABILITY') },
          { debitAmount: 0, creditAmount: 100, account: acc('cash', '1000', 'Cash & Bank', 'ASSET') }
        ])
      }
    } as never)
    const r = await BOOKS_REPORTS.fundFlow.run(p)
    const [sources, applications, cash] = r.summary.map((s) => Number(s.value))
    expect(cash).toBe(780)
    expect(sources - applications).toBe(cash)
    expect(r.rows.find((x) => x.item === 'fundFlow.netProfit')).toMatchObject({ source: 1000 })
    expect(r.rows.find((x) => String(x.item).includes('Inventory'))).toMatchObject({ application: 300 })
  })
})

describe('bank book', () => {
  it('opens each bank with the balance before the period and runs a balance', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      bankAccount: { findMany: vi.fn().mockResolvedValue([{ id: 'b1', accountName: 'HDFC' }, { id: 'b2', accountName: 'Empty' }]) },
      journalEntryLine: {
        groupBy: vi.fn().mockResolvedValue([{ bankAccountId: 'b1', _sum: { debitAmount: 5000, creditAmount: 1000 } }]),
        findMany: vi.fn().mockResolvedValue([
          { bankAccountId: 'b1', debitAmount: 700, creditAmount: 0, journalEntry: { entryDate: day('2026-09-02'), narration: 'Payment', entryNumber: 'JE-1' } },
          { bankAccountId: 'b1', debitAmount: 0, creditAmount: 200, journalEntry: { entryDate: day('2026-09-03'), narration: null, entryNumber: 'JE-2' } }
        ])
      }
    } as never)
    const r = await BOOKS_REPORTS.bankBook.run(p)
    expect(r.rows.map((x) => x.balance)).toEqual([4000, 4700, 4500])
    expect(r.rows).toHaveLength(3)
    expect(r.chartRows).toEqual([{ bank: 'HDFC', balance: 4500 }])
    expect(r.summary.map((s) => s.value)).toEqual([700, 200, 4500])
  })
})

describe('bank reconciliation summary', () => {
  it('counts matched and open statement lines per bank', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      bankAccount: { findMany: vi.fn().mockResolvedValue([{ id: 'b1', accountName: 'HDFC' }]) },
      bankStatementLine: {
        findMany: vi.fn().mockResolvedValue([
          { bankAccountId: 'b1', debitAmount: 100, creditAmount: 0, reconciled: true, reconciledAt: day('2026-09-10') },
          { bankAccountId: 'b1', debitAmount: 0, creditAmount: 250, reconciled: false, reconciledAt: null }
        ])
      }
    } as never)
    const r = await BOOKS_REPORTS.bankReconciliationSummary.run(p)
    expect(r.rows[0]).toMatchObject({ bank: 'HDFC', lines: 2, matched: 1, unmatched: 1, unmatchedAmount: 250, lastReconciled: '2026-09-10' })
  })
})

describe('ratio analysis', () => {
  it('works out liquidity, margins and days from the balance sheet and the period', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      journalEntryLine: {
        findMany: vi.fn().mockResolvedValue([
          { debitAmount: 0, creditAmount: 2000, account: { accountCode: '4000', accountType: 'INCOME' } },
          { debitAmount: 1200, creditAmount: 0, account: { accountCode: '5000', accountType: 'EXPENSE' } },
          { debitAmount: 300, creditAmount: 0, account: { accountCode: '6000', accountType: 'EXPENSE' } }
        ])
      },
      bill: { findMany: vi.fn().mockResolvedValue([{ totalAmount: 1000 }]) }
    } as never)
    const r = await BOOKS_REPORTS.ratioAnalysis.run(p)
    const v = (name: string) => r.rows.find((x) => x.ratio === `ratios.name.${name}`)!.value
    expect(v('current')).toBe(2)
    expect(v('quick')).toBe(1.4)
    expect(v('debtToEquity')).toBe(1)
    expect(v('grossMargin')).toBe(40)
    expect(v('netMargin')).toBe(25)
    expect(v('debtorDays')).toBe(6)
    expect(r.chartRows).toEqual([{ name: 'ratios.name.grossMargin', value: 40 }, { name: 'ratios.name.netMargin', value: 25 }])
  })
  it('leaves a ratio blank when there is nothing to divide by', async () => {
    vi.mocked(stockValueAndCostOfSales).mockResolvedValueOnce({ stockValue: 0, costOfSales: 0 })
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: profile, journalEntryLine: { findMany: vi.fn().mockResolvedValue([]) }, bill: { findMany: vi.fn().mockResolvedValue([]) } } as never)
    const r = await BOOKS_REPORTS.ratioAnalysis.run(p)
    expect(r.rows.find((x) => x.ratio === 'ratios.name.grossMargin')!.value).toBeNull()
    expect(r.rows.find((x) => x.ratio === 'ratios.name.creditorDays')!.value).toBeNull()
  })
})

describe('year over year and registers', () => {
  it('lines up each month with the same month a year earlier', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      bill: {
        findMany: vi.fn().mockImplementation(async (q: { where: { billDate: { gte: Date } } }) =>
          q.where.billDate.gte.getFullYear() === 2026 ? [{ billDate: day('2026-09-09'), subtotal: 500, discountAmount: 0 }] : [{ billDate: day('2025-09-09'), subtotal: 400, discountAmount: 0 }])
      }
    } as never)
    const r = await BOOKS_REPORTS.yearOverYear.run({ dateFrom: '2026-09-01', dateTo: '2026-12-31' })
    expect(r.rows[0]).toMatchObject({ month: '09', salesThis: 1200, salesLast: 1000, salesChange: 20, purchasesThis: 500, purchasesLast: 400 })
    expect(r.rows[1]).toMatchObject({ month: '10', salesThis: 800, salesLast: 0, salesChange: null })
  })

  it('credit note register, debit note register and return register list documents with a monthly count chart', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      creditNote: { findMany: vi.fn().mockResolvedValue([{ creditNoteNumber: 'CN-1', createdAt: day('2026-09-04'), amount: 118, taxAmount: 18, reason: 'Damaged', customer: { customerName: 'Acme' } }]) },
      debitNote: { findMany: vi.fn().mockResolvedValue([{ debitNoteNumber: 'DN-1', createdAt: day('2026-09-06'), amount: 59, taxAmount: 9, reason: 'Short supply', supplier: { supplierName: 'Far Ltd' } }]) },
      invoice: { findMany: vi.fn().mockResolvedValue([{ invoiceNumber: 'R-1', invoiceDate: day('2026-09-07'), taxAmount: -9, totalAmount: -59, customer: null, originalInvoice: { invoiceNumber: 'INV-1' } }]) }
    } as never)
    const cn = await BOOKS_REPORTS.creditNoteRegister.run(p)
    expect(cn.rows[0]).toMatchObject({ number: 'CN-1', party: 'Acme', amount: 118 })
    expect(cn.chartRows).toEqual([{ month: '2026-09', count: 1 }])
    const dn = await BOOKS_REPORTS.debitNoteRegister.run(p)
    expect(dn.rows[0]).toMatchObject({ number: 'DN-1', party: 'Far Ltd', tax: 9 })
    const sr = await BOOKS_REPORTS.salesReturnRegister.run(p)
    expect(sr.rows[0]).toMatchObject({ number: 'R-1', original: 'INV-1', amount: 59, tax: 9 })
  })
})

describe('tax by part', () => {
  it('splits sales and purchase tax of a 12% rate into GST 5% and PST 7%, leaving other rates unassigned', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      taxConfiguration: { findMany: vi.fn().mockResolvedValue([{ rate: 12, isDefault: true, components: JSON.stringify([{ name: 'GST', rate: 5 }, { name: 'PST', rate: 7 }]) }]) },
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          { invoiceType: 'RETAIL', pricesIncludeTax: false, items: [{ quantity: 1, unitPrice: 1000, discountAmount: 0, taxAmount: 120, lineTotal: 1120, taxRate: 12 }, { quantity: 1, unitPrice: 100, discountAmount: 0, taxAmount: 0, lineTotal: 100, taxRate: 0 }] },
          { invoiceType: 'RETURN', pricesIncludeTax: false, items: [{ quantity: 1, unitPrice: 100, discountAmount: 0, taxAmount: 12, lineTotal: 112, taxRate: 12 }] }
        ])
      },
      bill: { findMany: vi.fn().mockResolvedValue([{ items: [{ taxRate: 12, taxAmount: 60, total: 560 }] }]) }
    } as never)

    const r = await BOOKS_REPORTS.taxByPart.run(p)

    const gst = r.rows.find((x) => x.part === 'GST')!
    const pst = r.rows.find((x) => x.part === 'PST')!
    expect(gst.salesTax).toBe(45) // (120 - 12) x 5/12
    expect(pst.salesTax).toBe(63)
    expect(gst.purchaseTax).toBe(25)
    expect(pst.purchaseTax).toBe(35)
    expect(Number(gst.net) + Number(pst.net)).toBe(48) // 108 sales tax - 60 purchase tax
    expect(r.summary[0].value).toBe(108)
  })
})
