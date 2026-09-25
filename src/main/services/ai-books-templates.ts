// Ask Sarang questions about the books, tax, supplier bills and reminders, plus fixed "why is this happening" answers.
// Every answer comes from the same services the screens use (financial statements, GST net payable, reports), or from
// fixed text written here; the language model only chooses which template applies, it never writes an answer.

import { getPrisma } from '../database/db'
import { toLocalISODate, parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'
import { formatAmountForSpeech } from './ai-format.util'
import { financialStatementsService } from './financial-statements.service'
import { reportService } from './report.service'
import { gstInputCreditService } from './gst-input-credit.service'
import { GENERIC_REPORTS } from './generic-reports.registry'

export interface BooksTemplateResult { headline: string; details: string[]; isEmpty: boolean }
export interface BooksTemplateDef {
  category: string
  execute: (params: Record<string, unknown>, sym: string) => Promise<BooksTemplateResult>
}
export interface BooksFastPath {
  template: string
  patterns: RegExp[]
  /** Reads a value out of the question, for templates that need a name. */
  capture?: { pattern: RegExp; param: string }
}

const money = formatAmountForSpeech
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const range = (params: Record<string, unknown>, defaultDay = false) => {
  const now = new Date()
  const today = toLocalISODate(now)
  const monthStart = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
  return {
    dateFrom: (params.dateFrom as string) ?? (defaultDay ? today : monthStart),
    dateTo: (params.dateTo as string) ?? today
  }
}

async function taxModel(): Promise<string> {
  const p = await getPrisma().businessProfile.findFirst({ select: { taxModel: true } })
  return p?.taxModel ?? 'NONE'
}

const empty: BooksTemplateResult = { headline: '', details: [], isEmpty: true }

// A fixed answer with the Manual guide to read next.
const fixed = (headline: string, steps: string[], guide: string): BooksTemplateDef => ({
  category: 'help',
  async execute() {
    return { headline, details: [...steps, `More detail: open the Manual and read "${guide}"`], isEmpty: false }
  }
})

export const BOOKS_TEMPLATES: Record<string, BooksTemplateDef> = {
  // ── The books ────────────────────────────────────────────────────────────────────────────────────────
  'finance.balanceSheetSummary': {
    category: 'finance',
    async execute(params, sym) {
      const asOf = (params.dateTo as string) ?? toLocalISODate(new Date())
      const bs = await financialStatementsService.generateBalanceSheet({ asOf })
      const t = bs.totals
      if (t.assets === 0 && t.liabilities === 0 && t.equity === 0) return empty
      return {
        headline: `Balance sheet as of ${asOf}: assets ${money(t.assets, sym)}, liabilities ${money(t.liabilities, sym)}, equity ${money(t.equity + t.currentProfit, sym)}`,
        details: [
          bs.balanced ? 'Assets equal liabilities plus equity: the books balance' : `The books are out of balance by ${money(Math.abs(bs.difference), sym)}`,
          `Profit for the period included in equity: ${money(t.currentProfit, sym)}`,
          ...bs.groups.filter((g) => g.total !== 0).map((g) => `${g.key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${money(g.total, sym)}`)
        ],
        isEmpty: false
      }
    }
  },

  'finance.cashFlowSummary': {
    category: 'finance',
    async execute(params, sym) {
      const { dateFrom, dateTo } = range(params)
      const cf = await financialStatementsService.generateCashFlowStatement({ dateFrom, dateTo })
      if (cf.openingCash === 0 && cf.closingCash === 0 && cf.netChange === 0) return empty
      return {
        headline: `Cash flow ${dateFrom} to ${dateTo}: cash went ${cf.netChange >= 0 ? 'up' : 'down'} by ${money(Math.abs(cf.netChange), sym)}, closing at ${money(cf.closingCash, sym)}`,
        details: [
          `Operating activities: ${money(cf.operating.total, sym)}`,
          `Investing activities: ${money(cf.investing.total, sym)}`,
          `Financing activities: ${money(cf.financing.total, sym)}`,
          `Opening cash: ${money(cf.openingCash, sym)}`,
          cf.reconciled ? 'The statement agrees with the cash and bank accounts' : 'The statement does not fully agree with the cash and bank accounts; open the Cash Flow report to check'
        ],
        isEmpty: false
      }
    }
  },

  'ledger.dayBookForDate': {
    category: 'ledger',
    async execute(params, sym) {
      const { dateFrom, dateTo } = range(params, true)
      const day = await financialStatementsService.generateDayBook({ dateFrom, dateTo })
      if (day.totalVouchers === 0) return empty
      return {
        headline: `${plural(day.totalVouchers, 'entry')} in the day book ${dateFrom === dateTo ? `on ${dateFrom}` : `from ${dateFrom} to ${dateTo}`}, total ${money(day.totalDebit, sym)}`,
        details: day.byType.filter((x) => x.voucherCount > 0).map((x) => `${x.voucherType.toLowerCase()}: ${plural(x.voucherCount, 'entry')}, ${money(x.total, sym)}`),
        isEmpty: false
      }
    }
  },

  'ledger.accountBalance': {
    category: 'ledger',
    async execute(params, sym) {
      const term = String(params.accountName ?? params.searchTerm ?? '').trim()
      if (!term) return empty
      const db = getPrisma()
      const account = await db.chartOfAccounts.findFirst({ where: { isActive: true, accountName: { contains: term } }, orderBy: { accountCode: 'asc' } })
      if (!account) return empty
      const agg = await db.journalEntryLine.aggregate({ where: { accountId: account.id }, _sum: { debitAmount: true, creditAmount: true } })
      const debit = agg._sum.debitAmount ?? 0
      const credit = agg._sum.creditAmount ?? 0
      const debitNature = account.accountType === 'ASSET' || account.accountType === 'EXPENSE'
      const balance = debitNature ? debit - credit : credit - debit
      return {
        headline: `${account.accountName} (${account.accountCode}) balance: ${money(balance, sym)}`,
        details: [`Total debits ${money(debit, sym)}, total credits ${money(credit, sym)}`, `This is a${/^[AEI]/i.test(account.accountType) ? 'n' : ''} ${account.accountType.toLowerCase()} account`],
        isEmpty: false
      }
    }
  },

  'finance.booksBalanced': {
    category: 'finance',
    async execute(params, sym) {
      const now = new Date()
      const dateFrom = (params.dateFrom as string) ?? toLocalISODate(new Date(now.getFullYear(), 0, 1))
      const dateTo = (params.dateTo as string) ?? toLocalISODate(now)
      const tb = await reportService.generateTrialBalanceReport({ dateFrom, dateTo })
      if (tb.rows.length === 0) return empty
      return {
        headline: tb.balanced
          ? `Yes, your books balance: total debits and total credits are both ${money(tb.totalDebit, sym)}`
          : `No, your books do not balance: debits ${money(tb.totalDebit, sym)} against credits ${money(tb.totalCredit, sym)}`,
        details: [`Checked from ${dateFrom} to ${dateTo} across ${plural(tb.rows.length, 'account')}`],
        isEmpty: false
      }
    }
  },

  // ── Tax (answered in the business's own tax model) ──────────────────────────────────────────────
  'finance.netGstPayable': {
    category: 'finance',
    async execute(params, sym) {
      const { dateFrom, dateTo } = range(params)
      const model = await taxModel()
      if (model === 'GST') {
        const r = await gstInputCreditService.generateGstNetPayable({ dateFrom, dateTo })
        if (r.output.total === 0 && r.inputCredit.total === 0) return empty
        return {
          headline: r.creditCarriedForward
            ? `No GST to pay for ${dateFrom} to ${dateTo}: your input credit is higher, ${money(Math.abs(r.netPayable.total), sym)} carries forward`
            : `Net GST payable for ${dateFrom} to ${dateTo}: ${money(r.netPayable.total, sym)}`,
          details: [
            `GST charged on sales: ${money(r.output.total, sym)}`,
            `Input tax credit from purchases: ${money(r.inputCredit.total, sym)}`,
            `Payable by head: CGST ${money(r.netPayable.cgst, sym)}, SGST ${money(r.netPayable.sgst, sym)}, IGST ${money(r.netPayable.igst, sym)}`,
            'This is a working figure from your records. Confirm with your accountant before filing.'
          ],
          isEmpty: false
        }
      }
      const db = getPrisma()
      const [tax, bills] = await Promise.all([
        reportService.generateTaxReport({ dateFrom, dateTo }),
        db.bill.aggregate({ where: { status: { not: 'VOID' }, billDate: { gte: parseLocalDateStart(dateFrom), lte: parseLocalDateEnd(dateTo) } }, _sum: { taxAmount: true } })
      ])
      const output = tax.summary.totalTaxCollected
      const input = bills._sum.taxAmount ?? 0
      if (output === 0 && input === 0) return empty
      const label = model === 'VAT' ? 'VAT' : model === 'SALES_TAX' ? 'Sales tax' : 'Tax'
      return {
        headline: `${label} for ${dateFrom} to ${dateTo}: collected ${money(output, sym)}, paid on purchases ${money(input, sym)}, net ${money(output - input, sym)}`,
        details: ['This is a working figure from your records. Confirm with your accountant before filing.'],
        isEmpty: false
      }
    }
  },

  'finance.inputTaxCredit': {
    category: 'finance',
    async execute(params, sym) {
      const { dateFrom, dateTo } = range(params)
      if ((await taxModel()) !== 'GST') return { headline: 'Input tax credit in this form applies to businesses on GST. For VAT or sales tax, ask "tax collected" or "net tax payable" instead', details: [], isEmpty: false }
      const r = await gstInputCreditService.generateGstNetPayable({ dateFrom, dateTo })
      if (r.inputCredit.total === 0) return empty
      return {
        headline: `Input tax credit for ${dateFrom} to ${dateTo}: ${money(r.inputCredit.total, sym)}`,
        details: [`CGST ${money(r.inputCredit.cgst, sym)}, SGST ${money(r.inputCredit.sgst, sym)}, IGST ${money(r.inputCredit.igst, sym)}`, `From ${plural(r.rows.length, 'purchase document')}`],
        isEmpty: false
      }
    }
  },

  'finance.tdsReceivable': {
    category: 'finance',
    async execute(params, sym) {
      const { dateFrom, dateTo } = range(params)
      const agg = await getPrisma().payment.aggregate({
        where: { paymentMethod: 'TDS', isReversed: false, paymentDate: { gte: parseLocalDateStart(dateFrom), lte: parseLocalDateEnd(dateTo) } },
        _sum: { amount: true }, _count: true
      })
      if (!agg._count) return empty
      return { headline: `TDS kept back by customers from ${dateFrom} to ${dateTo}: ${money(agg._sum.amount ?? 0, sym)} on ${plural(agg._count, 'payment')}`, details: [], isEmpty: false }
    }
  },

  // ── Supplier bills ───────────────────────────────────────────────────────────────────────────────────
  'suppliers.billsOverdue': {
    category: 'suppliers',
    async execute(_params, sym) {
      const bills = await getPrisma().bill.findMany({
        where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lt: parseLocalDateStart(toLocalISODate(new Date())) }, balanceAmount: { gt: 0 } },
        select: { billNumber: true, balanceAmount: true, dueDate: true, supplier: { select: { supplierName: true } } },
        orderBy: { dueDate: 'asc' }
      })
      if (bills.length === 0) return empty
      const total = bills.reduce((s, b) => s + b.balanceAmount, 0)
      return {
        headline: `${plural(bills.length, 'supplier bill')} overdue, ${money(total, sym)} in total`,
        details: bills.slice(0, 5).map((b) => `${b.supplier.supplierName}: ${b.billNumber}, ${money(b.balanceAmount, sym)}, due ${toLocalISODate(b.dueDate as Date)}`),
        isEmpty: false
      }
    }
  },

  'suppliers.billsDueThisWeek': {
    category: 'suppliers',
    async execute(_params, sym) {
      const start = parseLocalDateStart(toLocalISODate(new Date()))
      const end = parseLocalDateEnd(toLocalISODate(new Date(start.getTime() + 6 * 86400000)))
      const bills = await getPrisma().bill.findMany({
        where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { gte: start, lte: end }, balanceAmount: { gt: 0 } },
        select: { billNumber: true, balanceAmount: true, dueDate: true, supplier: { select: { supplierName: true } } },
        orderBy: { dueDate: 'asc' }
      })
      if (bills.length === 0) return empty
      const total = bills.reduce((s, b) => s + b.balanceAmount, 0)
      return {
        headline: `${plural(bills.length, 'supplier bill')} due in the next 7 days, ${money(total, sym)} in total`,
        details: bills.slice(0, 5).map((b) => `${b.supplier.supplierName}: ${b.billNumber}, ${money(b.balanceAmount, sym)}, due ${toLocalISODate(b.dueDate as Date)}`),
        isEmpty: false
      }
    }
  },

  'suppliers.openBillsBySupplier': {
    category: 'suppliers',
    async execute(_params, sym) {
      const groups = await getPrisma().bill.groupBy({ by: ['supplierId'], where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, balanceAmount: { gt: 0 } }, _sum: { balanceAmount: true }, _count: true })
      if (groups.length === 0) return empty
      const sorted = [...groups].sort((a, b) => (b._sum.balanceAmount ?? 0) - (a._sum.balanceAmount ?? 0)).slice(0, 8)
      const suppliers = await getPrisma().supplier.findMany({ where: { id: { in: sorted.map((g) => g.supplierId) } }, select: { id: true, supplierName: true } })
      const nameOf = new Map(suppliers.map((s) => [s.id, s.supplierName]))
      const total = groups.reduce((s, g) => s + (g._sum.balanceAmount ?? 0), 0)
      return {
        headline: `${money(total, sym)} is open on supplier bills across ${plural(groups.length, 'supplier')}`,
        details: sorted.map((g) => `${nameOf.get(g.supplierId) ?? 'Supplier'}: ${money(g._sum.balanceAmount ?? 0, sym)} on ${plural(g._count, 'bill')}`),
        isEmpty: false
      }
    }
  },

  // ── Reminders, quotations, notes, salespeople ───────────────────────────────────────────────────────
  'documents.remindersPending': {
    category: 'documents',
    async execute() {
      const db = getPrisma()
      const [due, later, failed] = await Promise.all([
        db.notificationQueue.count({ where: { status: 'PENDING', scheduledFor: { lte: new Date() } } }),
        db.notificationQueue.count({ where: { status: 'PENDING', scheduledFor: { gt: new Date() } } }),
        db.notificationQueue.count({ where: { status: 'FAILED' } })
      ])
      if (due + later + failed === 0) return empty
      return {
        headline: `${plural(due, 'WhatsApp reminder')} ready to send now`,
        details: [`${plural(later, 'reminder')} scheduled for later`, ...(failed > 0 ? [`${plural(failed, 'reminder')} could not be sent because the phone number is missing or wrong`] : []), 'Nothing is sent by itself: open WhatsApp Reminders and press Send on each one'],
        isEmpty: false
      }
    }
  },

  'documents.quotationsExpiringThisWeek': {
    category: 'documents',
    async execute(_params, sym) {
      const start = parseLocalDateStart(toLocalISODate(new Date()))
      const end = parseLocalDateEnd(toLocalISODate(new Date(start.getTime() + 6 * 86400000)))
      const q = await getPrisma().quotation.findMany({
        where: { status: { in: ['DRAFT', 'SENT'] }, validUntil: { gte: start, lte: end } },
        select: { quotationNumber: true, totalAmount: true, validUntil: true },
        orderBy: { validUntil: 'asc' }
      })
      if (q.length === 0) return empty
      return {
        headline: `${plural(q.length, 'quotation')} expire in the next 7 days, worth ${money(q.reduce((s, x) => s + x.totalAmount, 0), sym)}`,
        details: q.slice(0, 5).map((x) => `${x.quotationNumber}: ${money(x.totalAmount, sym)}, valid until ${toLocalISODate(x.validUntil as Date)}`),
        isEmpty: false
      }
    }
  },

  'documents.notesWithAndWithoutTax': {
    category: 'documents',
    async execute(params) {
      const { dateFrom, dateTo } = range(params)
      const where = { createdAt: { gte: parseLocalDateStart(dateFrom), lte: parseLocalDateEnd(dateTo) } }
      const db = getPrisma()
      const [cWith, cWithout, dWith, dWithout] = await Promise.all([
        db.creditNote.count({ where: { ...where, taxApplied: true } }), db.creditNote.count({ where: { ...where, taxApplied: false } }),
        db.debitNote.count({ where: { ...where, taxApplied: true } }), db.debitNote.count({ where: { ...where, taxApplied: false } })
      ])
      if (cWith + cWithout + dWith + dWithout === 0) return empty
      return {
        headline: `From ${dateFrom} to ${dateTo}: ${plural(cWith + cWithout, 'credit note')} and ${plural(dWith + dWithout, 'debit note')} issued`,
        details: [`Credit notes: ${cWith} with tax, ${cWithout} without tax`, `Debit notes: ${dWith} with tax, ${dWithout} without tax`],
        isEmpty: false
      }
    }
  },

  'sales.topSalespersons': {
    category: 'sales',
    async execute(params, sym) {
      const { dateFrom, dateTo } = range(params)
      const r = await GENERIC_REPORTS.salesBySalesperson.run({ dateFrom, dateTo })
      const rows = r.rows.filter((x) => String(x.name ?? '') !== '')
      if (rows.length === 0) return empty
      const top = rows.slice(0, 5)
      return {
        headline: `Top salesperson from ${dateFrom} to ${dateTo}: ${String(top[0].name)} with ${money(Number(top[0].sales ?? top[0].taxable ?? 0), sym)}`,
        details: top.map((x) => `${String(x.name)}: ${money(Number(x.sales ?? x.taxable ?? 0), sym)}`),
        isEmpty: false
      }
    }
  },

  // ── Fixed troubleshooting answers (never model-written) ──────────────────────────────────────────
  'help.grnStockNotUpdating': fixed(
    'Stock only goes up when a goods receipt line is linked to a product and the receipt is posted',
    ['Open the goods receipt (GRN) and check that every line shows a product. A line with no product cannot add stock; use "create and link" on the line.', 'Check the receipt is posted, not a draft. A posted receipt shows a warning if lines are still unlinked.', 'Then open Inventory to see the stock for that product and location.'],
    'Buying and suppliers'
  ),
  'help.taxNotAdded': fixed(
    'Tax is missing when the item, the customer or the business settings say so',
    ['Check the item has a tax rate (Products, edit the item).', 'Check the customer is not marked tax exempt, or that an exemption certificate has not expired.', 'On an export sale the "Export sale" box removes tax when ticked. A business on the Composition scheme charges no tax.', 'Credit and debit notes ask whether to add tax or skip it.'],
    'Selling'
  ),
  'help.cannotEditBill': fixed(
    'A supplier bill can be edited until it is paid or a payment is recorded against it',
    ['Open the bill: if it shows Edit, change the lines and save. Totals and the books update together.', 'If payments were recorded, reverse them first, then edit.', 'A bill in a locked period cannot be changed; the lock date is set in Accounting.'],
    'Buying and suppliers'
  ),
  'help.invoiceRounding': fixed(
    'Invoice totals can be rounded to the nearest rupee, 50 paise or 5 paise',
    ['Go to Settings, Business features, and choose the rounding rule for invoices.', 'The rounding amount is shown on its own line on the invoice and is kept in the books.', 'Choose "none" to show the exact total.'],
    'Selling'
  ),
  'help.gstPresentation': fixed(
    'GST is shown as CGST plus SGST for sales inside your state, and IGST for sales to another state',
    ['Sarang decides from your state and the customer\'s state, and you can change it on the sale.', 'A "GST" single line is also available if you prefer one line.', 'The amount of tax is the same whichever way it is shown.'],
    'GST'
  ),
  'help.taxInclusiveExclusive': fixed(
    'Prices can be tax exclusive (tax added on top) or tax inclusive (tax already inside the price)',
    ['Choose in Settings with the "Prices include tax" switch, or per document where offered.', 'With inclusive prices the customer pays the price you show; Sarang works out the tax inside it.', 'With exclusive prices the tax is added to the price.'],
    'GST'
  ),
  'help.remindersNotSending': fixed(
    'Sarang never sends reminders by itself: you press Send on each one in WhatsApp Reminders',
    ['Open WhatsApp Reminders and press Send on the reminder; WhatsApp opens with the message ready.', 'A reminder marked failed has no phone number or a wrong one: fix the number on the customer.', 'A customer marked "do not send messages" gets no reminders.'],
    'Reminders and alerts'
  ),
  'help.askSarangLanguage': fixed(
    'Ask Sarang understands English only, and answers stay on this device',
    ['Type your question in English. Names of your own customers and items can be in any language.', 'Everything else in Sarang can be switched to your language in Settings.'],
    'Ask Sarang'
  ),
  'help.reversePayment': fixed(
    'A wrong payment can be reversed from the invoice, and the books are corrected',
    ['Open the invoice, find the payment in its list and choose Reverse, then give a reason.', 'The invoice goes back to unpaid or part paid and the entry in the books is reversed, not deleted.', 'Then record the payment again correctly.'],
    'Selling'
  )
}

export { BOOKS_FAST_PATHS } from './ai-books-fastpaths'
