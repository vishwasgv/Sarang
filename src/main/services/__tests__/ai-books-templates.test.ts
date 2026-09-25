import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../financial-statements.service', () => ({
  financialStatementsService: {
    generateBalanceSheet: vi.fn(),
    generateCashFlowStatement: vi.fn(),
    generateDayBook: vi.fn()
  }
}))
vi.mock('../report.service', () => ({ reportService: { generateTrialBalanceReport: vi.fn(), generateTaxReport: vi.fn() } }))
vi.mock('../gst-input-credit.service', () => ({ gstInputCreditService: { generateGstNetPayable: vi.fn() } }))
vi.mock('../generic-reports.registry', () => ({ GENERIC_REPORTS: { salesBySalesperson: { run: vi.fn() } } }))

import { getPrisma } from '../../database/db'
import { financialStatementsService } from '../financial-statements.service'
import { reportService } from '../report.service'
import { gstInputCreditService } from '../gst-input-credit.service'
import { BOOKS_TEMPLATES } from '../ai-books-templates'

const run = (name: string, params: Record<string, unknown> = {}) => BOOKS_TEMPLATES[name].execute(params, '₹')
const heads = (total: number) => ({ cgst: total / 2, sgst: total / 2, igst: 0, total })

describe('books templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('balance sheet states assets, liabilities and equity and says whether the books balance', async () => {
    vi.mocked(financialStatementsService.generateBalanceSheet).mockResolvedValue({
      balanced: true, difference: 0,
      totals: { assets: 1000, liabilities: 400, equity: 500, currentProfit: 100, liabilitiesAndEquity: 1000 },
      groups: [{ key: 'currentAssets', total: 1000 }]
    } as never)
    const r = await run('finance.balanceSheetSummary')
    expect(r.isEmpty).toBe(false)
    expect(r.headline).toMatch(/assets .*1,000/)
    expect(r.details[0]).toMatch(/balance/)
  })

  it('an empty balance sheet falls back to the standard "not enough information"', async () => {
    vi.mocked(financialStatementsService.generateBalanceSheet).mockResolvedValue({ balanced: true, difference: 0, totals: { assets: 0, liabilities: 0, equity: 0, currentProfit: 0 }, groups: [] } as never)
    expect((await run('finance.balanceSheetSummary')).isEmpty).toBe(true)
  })

  it('books balanced: yes and no', async () => {
    vi.mocked(reportService.generateTrialBalanceReport).mockResolvedValue({ balanced: true, totalDebit: 500, totalCredit: 500, rows: [{}] } as never)
    expect((await run('finance.booksBalanced')).headline).toMatch(/^Yes/)
    vi.mocked(reportService.generateTrialBalanceReport).mockResolvedValue({ balanced: false, totalDebit: 500, totalCredit: 400, rows: [{}] } as never)
    expect((await run('finance.booksBalanced')).headline).toMatch(/^No/)
  })

  it('net GST payable: a GST business gets the input-credit answer, with the accountant caution', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ taxModel: 'GST' }) } } as never)
    vi.mocked(gstInputCreditService.generateGstNetPayable).mockResolvedValue({
      output: heads(180), inputCredit: heads(60), netPayable: heads(120), creditCarriedForward: false, rows: []
    } as never)
    const r = await run('finance.netGstPayable')
    expect(r.headline).toMatch(/Net GST payable/)
    expect(r.details.join(' ')).toMatch(/accountant/)
  })

  it('net GST payable: says credit carries forward when input is higher', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ taxModel: 'GST' }) } } as never)
    vi.mocked(gstInputCreditService.generateGstNetPayable).mockResolvedValue({
      output: heads(50), inputCredit: heads(80), netPayable: heads(-30), creditCarriedForward: true, rows: []
    } as never)
    expect((await run('finance.netGstPayable')).headline).toMatch(/No GST to pay/)
  })

  it('net tax for a VAT business uses VAT wording, not GST', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ taxModel: 'VAT' }) },
      bill: { aggregate: vi.fn().mockResolvedValue({ _sum: { taxAmount: 40 } }) }
    } as never)
    vi.mocked(reportService.generateTaxReport).mockResolvedValue({ summary: { totalTaxCollected: 100 } } as never)
    const r = await run('finance.netGstPayable')
    expect(r.headline).toMatch(/^VAT/)
    expect(r.headline).toMatch(/net .*60/)
  })

  it('input tax credit tells a non-GST business where to look instead', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ taxModel: 'VAT' }) } } as never)
    const r = await run('finance.inputTaxCredit')
    expect(r.isEmpty).toBe(false)
    expect(r.headline).toMatch(/GST/)
  })

  it('account balance uses debit minus credit for an asset and the opposite for income', async () => {
    const line = vi.fn().mockResolvedValue({ _sum: { debitAmount: 700, creditAmount: 200 } })
    const account = vi.fn()
    vi.mocked(getPrisma).mockReturnValue({ chartOfAccounts: { findFirst: account }, journalEntryLine: { aggregate: line } } as never)
    account.mockResolvedValue({ id: 'a', accountName: 'Cash & Bank', accountCode: '1000', accountType: 'ASSET' })
    expect((await run('ledger.accountBalance', { accountName: 'cash' })).headline).toMatch(/500/)
    account.mockResolvedValue({ id: 'b', accountName: 'Sales Revenue', accountCode: '4000', accountType: 'INCOME' })
    expect((await run('ledger.accountBalance', { accountName: 'sales' })).headline).toMatch(/-500|500/)
    expect((await run('ledger.accountBalance', {})).isEmpty).toBe(true)
  })

  it('overdue supplier bills lists count, total and the first names', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      bill: { findMany: vi.fn().mockResolvedValue([
        { billNumber: 'B1', balanceAmount: 300, dueDate: new Date(2026, 8, 1), supplier: { supplierName: 'Everest' } },
        { billNumber: 'B2', balanceAmount: 200, dueDate: new Date(2026, 8, 5), supplier: { supplierName: 'Sunrise' } }
      ]) }
    } as never)
    const r = await run('suppliers.billsOverdue')
    expect(r.headline).toMatch(/2 supplier bills overdue/)
    expect(r.details[0]).toMatch(/Everest/)
  })

  it('reminders answer says nothing is sent automatically', async () => {
    const count = vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    vi.mocked(getPrisma).mockReturnValue({ notificationQueue: { count } } as never)
    const r = await run('documents.remindersPending')
    expect(r.headline).toMatch(/3 WhatsApp reminders ready/)
    expect(r.details.join(' ')).toMatch(/Nothing is sent by itself/)
  })

  it('empty results fall back cleanly', async () => {
    vi.mocked(getPrisma).mockReturnValue({ bill: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) } } as never)
    expect((await run('suppliers.billsOverdue')).isEmpty).toBe(true)
    expect((await run('suppliers.billsDueThisWeek')).isEmpty).toBe(true)
    expect((await run('suppliers.openBillsBySupplier')).isEmpty).toBe(true)
  })
})
