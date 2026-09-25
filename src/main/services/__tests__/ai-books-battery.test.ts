import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../../database/ai-readonly-db', () => ({ getReadOnlyPrisma: vi.fn() }))

import { tryFastPathClassify } from '../ai-query.service'
import { BOOKS_TEMPLATES, BOOKS_FAST_PATHS } from '../ai-books-templates'

// Realistic owner questions and the answer type each must reach. New templates first, then questions the older
// templates already answered, which must keep going where they went.
const ALL = Object.keys(BOOKS_TEMPLATES)
const route = (q: string) => tryFastPathClassify(q, [...ALL, 'sales.totalToday', 'sales.totalThisMonth', 'sales.totalThisWeek', 'sales.totalLastMonth', 'finance.profitAndLoss', 'finance.taxCollected', 'suppliers.pendingPayments', 'documents.creditDebitNotesIssued', 'documents.pendingQuotations', 'credit.whoOwesMe', 'inventory.lowStock', 'cashFlow.projectionNextMonth', 'finance.cashInHand', 'customers.topThisPeriod', 'finance.expenseBreakdown', 'inventory.stockValue', 'inventory.deadStock', 'ledger.bankBalance'])?.template ?? null

const NEW: Array<[string, string[]]> = [
  ['finance.balanceSheetSummary', ['show me the balance sheet', 'balance sheet please', "what's my balance sheet", 'balance sheet as of today', 'give me the balance sheet for this year', 'what are my total assets and liabilities', 'open balance sheet summary', 'balance sheet last month', 'i want to see the balance sheet', 'how does my balance sheet look', 'balance sheet as on 31 march', 'summarise the balance sheet', 'balance sheet of the business', 'tell me the balance sheet', 'assets and liabilities']],
  ['finance.cashFlowSummary', ['show cash flow statement', 'cash flow summary', 'what is my cash flow this month', 'cash flow statement for this year', 'cash flow for last month', 'how is my cash flow', 'cashflow summary', 'cash flow statement please', 'operating cash flow this month', 'how much cash came in and went out this month cash flow', 'cash flow this quarter', 'cash flow', 'give me the cash flow summary', 'my cash flow today', 'cash flow statement last year']],
  ['ledger.dayBookForDate', ['show the day book', 'day book for today', 'day book yesterday', 'what is in the day book', 'daybook', 'day book for 12 september', 'open day book', 'day book this week', 'entries in the day book today', 'show me todays day book', 'day book last week', 'how many entries in the day book', 'daybook yesterday', 'day book on 5 september 2026', 'summary of the day book']],
  ['ledger.accountBalance', ['what is the balance of the cash account', 'balance of the sales revenue account', 'balance in accounts receivable account', 'balance of the inventory account', 'what is the balance on the tax payable account', 'total in the input tax credit account', 'balance of tds payable account', 'balance of the operating expenses account', 'balance of owner capital account', 'balance of the fixed assets account', 'what is the balance in the accounts payable ledger', 'balance on the interest income account', 'balance of the depreciation expense account', 'balance of the cost of goods sold account', 'general ledger balance']],
  ['finance.booksBalanced', ['are my books balanced', 'is my books balanced', 'do my books balance', 'do my debits and credits match', 'trial balance check', 'is the trial balance ok', 'does the trial balance balance', 'are the books balanced this year', 'trial balance balanced', 'check if my books are balanced', 'do my debits equal credits', 'is my trial balance correct', 'books balanced?', 'trial balance correct', 'are books balanced']],
  ['finance.inputTaxCredit', ['what is my input tax credit', 'input tax credit this month', 'how much input tax credit do i have', 'itc this month', 'show input tax credit', 'input tax credit for last month', 'my itc', 'input tax credit this year', 'total input tax credit', 'input tax credit on purchases', 'how much itc can i claim', 'itc for september', 'input tax credit balance', 'itc summary', 'input tax credit last quarter']],
  ['finance.netGstPayable', ['net gst payable', 'net gst payable this month', 'how much gst do i have to pay', 'how much gst do i owe', 'gst payable this month', 'how much vat do i owe', 'net vat payable', 'net tax payable this month', 'gst to pay this month', 'how much tax is due', 'what is my gst payable', 'gst payable for last month', 'net sales tax payable', 'how much gst is due this month', 'gst due']],
  ['finance.tdsReceivable', ['tds receivable', 'how much tds have customers kept back', 'tds deducted by customers this year', 'tds kept back this month', 'tds receivable this year', 'tds receivable from customers', 'total tds deducted by customers', 'tax kept back by customers', 'tax deducted by clients this month', 'show tds receivable', 'tds receivable last month', 'my tds receivable', 'tds customers deducted', 'tds receivable summary', 'tds receivable balance']],
  ['suppliers.billsOverdue', ['which supplier bills are overdue', 'overdue bills', 'bills overdue', 'supplier bills overdue', 'show overdue supplier bills', 'any bills past due date', 'how many bills are overdue', 'what bills are overdue', 'overdue supplier bills list', 'are any supplier bills overdue', 'list of overdue bills', 'bills that are overdue', 'which bills are overdue', 'overdue purchase bills', 'total overdue bills']],
  ['suppliers.billsDueThisWeek', ['bills due this week', 'supplier bills due this week', 'which bills are due this week', 'bills due next week', 'what bills are due this week', 'supplier bills coming due soon', 'bills due in 7 days', 'any bills due this week', 'how much do i have to pay this week bills due this week', 'show bills due this week', 'bills coming due this week', 'supplier bills due next week', 'list bills due this week', 'bills due soon', 'bills due this week list']],
  ['suppliers.openBillsBySupplier', ['open bills by supplier', 'unpaid bills', 'open supplier bills', 'show unpaid supplier bills', 'open bills per supplier', 'how much do i owe each supplier', 'unpaid bills by supplier', 'list open bills by supplier', 'what unpaid bills do i have', 'open bills for each supplier', 'unpaid supplier bills', 'open bills', 'show open bills by supplier', 'unpaid bills per supplier', 'my unpaid bills']],
  ['documents.remindersPending', ['how many reminders are pending', 'pending reminders', 'whatsapp reminders waiting', 'reminders to send', 'unsent reminders', 'how many whatsapp reminders are pending', 'are there reminders waiting', 'pending whatsapp reminders', 'reminders due today waiting', 'reminders waiting to send', 'show pending reminders', 'due reminders', 'how many reminders due', 'reminders pending', 'whatsapp reminders pending']],
  ['documents.quotationsExpiringThisWeek', ['which quotations expire this week', 'quotations expiring this week', 'expiring quotations', 'quotations expiring soon', 'any quotations running out this week', 'quotations that expire in 7 days', 'quotations lapsing this week', 'show expiring quotations', 'which quotations are expiring soon', 'quotations expire this week', 'list expiring quotations', 'quotations expiring next week', 'what quotations expire soon', 'quotations expiring', 'expire this week quotations']],
  ['documents.notesWithAndWithoutTax', ['credit notes with tax', 'credit notes without tax', 'debit notes with and without tax', 'how many credit notes with tax this month', 'credit notes with and without tax', 'debit notes without tax', 'credit debit notes with tax', 'show credit notes with and without tax', 'credit notes without tax this year', 'debit notes with tax', 'how many debit notes without tax', 'notes with tax credit notes', 'credit notes with tax last month', 'credit notes without tax this month', 'debit notes with tax this year']],
  ['sales.topSalespersons', ['top salesperson', 'best salesperson this month', 'who is my best salesman', 'top salesman this month', 'which salesperson sold the most', 'sales by salesperson', 'best sales person', 'top salespeople', 'which salesman sold most', 'top salesperson this year', 'best salesperson last month', 'sales by salesman', 'top sales person this week', 'who is the top salesperson', 'best salesman']],
  ['help.grnStockNotUpdating', ['why is my stock not updating after a grn', 'stock not updating after goods receipt', 'inventory did not increase after grn', 'grn posted but stock not added', 'goods receipt not updating stock', 'stock isnt updating after receipt', 'grn no stock change', 'why did stock not update after receiving goods receipt', 'stock is not updating after receiving grn', 'goods received but inventory not changing grn', 'stock not added after goods receipt', 'my grn is not updating inventory', 'grn stock not showing', 'stock not increasing after grn', 'inventory not updating goods receipt']],
  ['help.taxNotAdded', ['why is tax not added to my invoice', 'tax not calculated on bill', 'gst is not showing on invoice', 'why is there no tax on this invoice', 'gst not added', 'vat not charged on sale', 'tax isnt applied', 'why is tax not being charged', 'gst not calculated', 'tax not coming on the invoice', 'why is gst zero on this invoice', 'no gst on invoice why', 'why was no tax added', 'tax not applied to invoice', 'vat isnt calculated']],
  ['help.cannotEditBill', ['why cant i edit this bill', 'cannot edit supplier bill', 'unable to edit purchase invoice', 'i cant edit the bill', 'why is the bill locked', 'bill not editable why', 'cant edit bill', 'why cannot i edit a purchase invoice', 'not able to edit a supplier bill', 'why is my bill not editable', 'cannot edit a bill after payment', 'bill cant be edited', 'why can i not edit the bill', 'cant edit purchase invoice', 'unable to edit a bill']],
  ['help.invoiceRounding', ['how does rounding off work on invoices', 'invoice rounding', 'why is my invoice total rounded', 'round off on the invoice', 'how to change invoice round off', 'rounding off invoice total', 'why is the total rounded off', 'how do i turn off rounding on invoice', 'invoice round-off setting', 'round-off on bill total', 'why total is off by a few paise', 'rounded off invoice', 'invoice roundoff', 'how do i set round off for invoices', 'rounding off in bill']],
  ['help.gstPresentation', ['why does it show igst', 'when is cgst and sgst shown', 'why igst instead of cgst', 'difference between cgst sgst and igst', 'why is igst showing on this invoice', 'which one shows cgst or igst', 'why cgst and sgst', 'why is sgst showing', 'when does igst show', 'cgst sgst igst why', 'why is it igst not cgst', 'how do cgst and sgst show', 'why igst', 'igst showing why', 'cgst why shown']],
  ['help.taxInclusiveExclusive', ['what is tax inclusive pricing', 'gst inclusive or exclusive', 'how do i make prices include tax', 'tax exclusive vs inclusive', 'prices include gst', 'what does inclusive of tax mean', 'vat inclusive prices', 'how to switch prices exclude tax', 'gst exclusive pricing', 'inclusive and exclusive tax', 'prices include tax setting', 'prices exclude tax', 'inclusive tax how it works', 'vat exclusive or inclusive', 'tax inclusive setting']],
  ['help.remindersNotSending', ['why are reminders not sending', 'reminders are not going out', 'whatsapp reminders not sent', 'why reminders not working', 'reminder says no phone number', 'reminders arent sending', 'my reminders never send', 'reminders not sending automatically', 'why dont reminders send', 'reminders are not being sent', 'reminders not sent to customers', 'why are my reminders not working', 'no phone number reminder', 'reminder not sending', 'why is the reminder not going']],
  ['help.askSarangLanguage', ['can ask sarang speak hindi', 'ask sarang in marathi', 'does the assistant understand hindi', 'can i ask in gujarati ask sarang', 'ask sarang language', 'assistant language english only', 'can you understand tamil', 'ask sarang hindi', 'can the assistant answer in marathi', 'does ask sarang work in telugu', 'ask sarang kannada', 'can you speak gujarati', 'assistant only english', 'ask sarang english only', 'language of ask sarang']],
  ['help.reversePayment', ['how do i reverse a payment', 'undo a payment', 'i entered a wrong payment', 'cancel a payment i recorded', 'delete a payment', 'reverse payment on invoice', 'how to remove a payment', 'wrong payment entered', 'mistaken payment', 'how to undo a payment received', 'reverse the payment', 'cancel the payment', 'incorrect payment recorded', 'remove a payment from an invoice', 'how can i reverse a payment']]
]

// Questions the older templates already answered. They must not be taken over by the new patterns.
const OLD = [
  "how much did i sell today", "what were today's sales", "this week's sales", 'how much did i sell this month', 'sales last month',
  "what's low on stock", 'what is running low', 'which items are running out', 'dead stock', 'products not sold in 60 days',
  'who owes me money', 'top 5 customers this month', 'best customers', 'what do i owe suppliers', 'pending supplier payments',
  'profit this month', 'p&l this year', 'what is my profit', 'what am i spending the most on', 'expense breakdown this month',
  'how much cash do i have', 'cash in hand', 'bank balance', 'how many customers do i have', 'total customers',
  'look up invoice INV-2026-000123', 'find supplier Everest', 'pending quotations', 'pending purchase orders',
  'average invoice value', 'stock value', 'value of my inventory', 'out of stock items', 'what needs my attention',
  'what can you do', 'projected cash flow next month', 'cash flow projection', 'which customers are slowest to pay',
  'top selling products', 'best selling item this week', 'sales by category', 'sales by hour of day', 'returns this month',
  'cancelled invoices', 'walk-in versus registered sales this month', 'how many products do i have', 'staff on leave today',
  'attendance today', 'total salary paid this month', 'top suppliers', 'purchase register', 'inactive suppliers',
  'supplier lead time', 'credit and debit notes issued', 'open quotations value', 'quotation conversion rate', 'overdue purchase orders',
  'net worth', 'discount impact', 'profit trend', 'expense trend', 'unreconciled transactions', 'depreciation this year',
  'budget variance', 'am i over budget this month', 'how many cold coffee do i have', 'how much rice is left', 'who are my biggest debtors',
  'invoice discount total', 'unique customers served this week', 'average spend per customer', 'repeat customers rate', 'new customers this week',
  'customers by city', 'highest single purchase', 'stock by category', 'near reorder level', 'stock turnover', 'biggest stock adjustment',
  'tax collected this month', 'how much gst did i collect', 'cash vs bank split', 'product cost basis', 'reorder draft',
  'landed cost', 'kit components', 'stock at location warehouse', 'cost centre performance', 'statutory liability this month'
]

describe('Ask Sarang books and help questions', () => {
  const total = NEW.reduce((n, [, qs]) => n + qs.length, 0)

  it('is a battery of hundreds of questions', () => {
    expect(total + OLD.length).toBeGreaterThanOrEqual(300)
  })

  for (const [template, questions] of NEW) {
    it(`${template}: ${questions.length} phrasings reach it`, () => {
      const misses = questions.filter((q) => route(q) !== template)
      expect(misses.map((q) => `${q} -> ${route(q)}`)).toEqual([])
    })
  }

  it('the older questions are not taken over by the new patterns', () => {
    const hijacked = OLD.filter((q) => BOOKS_FAST_PATHS.some((e) => e.patterns.some((p) => p.test(q))))
    expect(hijacked).toEqual([])
  })

  it('reads an account name out of the question', () => {
    const r = tryFastPathClassify('what is the balance of the cash account', ALL)
    expect(r?.params).toEqual({ accountName: 'cash' })
  })

  it('every fixed help answer names a Manual guide and has steps', async () => {
    for (const key of ALL.filter((k) => k.startsWith('help.'))) {
      const r = await BOOKS_TEMPLATES[key].execute({}, '₹')
      expect(r.isEmpty).toBe(false)
      expect(r.details.at(-1)).toMatch(/Manual/)
      expect(r.details.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('every template has a fast path so it can be reached without the model', () => {
    for (const key of ALL) expect(BOOKS_FAST_PATHS.some((e) => e.template === key)).toBe(true)
  })
})
