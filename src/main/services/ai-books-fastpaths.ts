import type { BooksFastPath } from './ai-books-templates'

// Phrasings that reach each books, tax, supplier-bill or help template without the language model.
// Checked before the older patterns, so the narrower question wins. The battery in
// __tests__/ai-books-battery.test.ts holds the questions each one must catch.
export const BOOKS_FAST_PATHS: BooksFastPath[] = [
  { template: 'help.grnStockNotUpdating', patterns: [/^(?=.*\b(grn|goods? receipts?|goods? received|receipts?|receiving)\b)(?=.*\b(stock|inventory)\b)(?=.*\b(not|no|isn'?t|didn'?t|doesn'?t|never|without)\b)/i] },
  { template: 'help.gstPresentation', patterns: [/(cgst|sgst|igst)\b.*\b(cgst|sgst|igst)\b/i, /(cgst|sgst|igst).*(show|why|differen|instead|which|when)/i, /why.*(igst|cgst|sgst)/i] },
  { template: 'help.taxNotAdded', patterns: [/(tax|gst|vat)\b.*\b(not|isn'?t|didn'?t|doesn'?t|no)\b.*(added|calculat|charged|showing|applied|coming)/i, /why (is|was|did).*\b(no|zero|0|nil)\b.*(tax|gst|vat)/i, /why.*(tax|gst|vat).*\b(zero|0|nil)\b/i, /\b(no|zero)\s+(tax|gst|vat)\b.*why/i] },
  { template: 'help.cannotEditBill', patterns: [/(can'?t|cannot|unable to|not able to).*edit.*(bill|purchase invoice)/i, /why.*(bill|purchase invoice).*(locked|not editable|can'?t edit)/i, /(bill|purchase invoice).*(not editable|can'?t be edited|cannot be edited|cant be edited)/i, /why can i not edit/i] },
  { template: 'help.invoiceRounding', patterns: [/round(ing|ed)?[- ]?off.*(invoice|bill|total)/i, /(invoice|bill|total).*round(ing|ed)?[- ]?off/i, /why.*(total|amount).*(rounded|off by (a few )?(paise|cents))/i, /(invoice|bill)s?\b.*\brounding\b/i, /\brounding\b.*\b(invoice|bill)/i] },
  { template: 'help.taxInclusiveExclusive', patterns: [/(tax|gst|vat).*(inclusive|exclusive)/i, /(inclusive|exclusive).*(tax|gst|vat)/i, /prices? (include|exclude)/i] },
  { template: 'help.remindersNotSending', patterns: [/reminders?.*(not|isn'?t|aren'?t|don'?t|dont|doesn'?t|never).*(send|sent|sending|going|working|going out)/i, /why.*reminders?.*(not|no|don'?t|dont|never)/i, /why (don'?t|dont|do not|won'?t|wont)\b.*reminders?/i, /no phone number/i] },
  { template: 'help.askSarangLanguage', patterns: [/(ask sarang|assistant|you).*(hindi|marathi|tamil|gujarati|telugu|kannada|malayalam|language|english only|english)/i, /(hindi|marathi|tamil|gujarati|telugu|kannada|malayalam).*(ask sarang|assistant)/i, /language.*(ask sarang|assistant)/i] },
  { template: 'help.reversePayment', patterns: [/(reverse|undo|cancel|delete|remove).*(a |the |my )?payment/i, /(wrong|mistaken|incorrect) payment/i] },

  { template: 'finance.booksBalanced', patterns: [/\bbooks?\b.*\bbalanc(e|ed)\b/i, /trial balance.*(balanc|check|ok|correct)/i, /do (my )?(debits|books).*(match|equal|balance)/i] },
  { template: 'finance.balanceSheetSummary', patterns: [/balance sheet/i, /(total )?assets and liabilities/i, /what (do|does) (i|the business) (own|owe) (and|&) (own|owe)/i] },
  { template: 'finance.cashFlowSummary', patterns: [/cash ?flow (statement|summary)/i, /\bcash ?flow\b(?!.*(projection|next month|forecast))/i] },
  { template: 'ledger.dayBookForDate', patterns: [/day ?book/i] },
  { template: 'ledger.accountBalance', patterns: [/(balance|total) (of|in|on) (the )?(.+?) (account|ledger)/i, /(general )?ledger balance/i], capture: { pattern: /(?:balance|total)\s+(?:of|in|on)\s+(?:the\s+)?(.+?)\s+(?:account|ledger)/i, param: 'accountName' } },
  { template: 'finance.inputTaxCredit', patterns: [/input tax credit/i, /\bitc\b/i] },
  { template: 'finance.netGstPayable', patterns: [/net (gst|vat|sales tax|tax) (payable|due|to pay)/i, /how much (gst|vat|tax).*(pay|owe|due)/i, /(gst|vat|tax).*(payable|to pay|due)/i] },
  { template: 'finance.tdsReceivable', patterns: [/\btds\b.*(receivable|kept back|deducted by|customers?)/i, /\btds receivable\b/i, /tax.*(kept back|deducted).*(customers?|clients?)/i, /(customers?|clients?).*(kept back|deducted).*(tax|tds)/i] },
  { template: 'suppliers.billsOverdue', patterns: [/(supplier )?bills?.*overdue/i, /overdue.*(supplier |purchase )?bills?/i, /bills?.*(past|after).*due/i] },
  { template: 'suppliers.billsDueThisWeek', patterns: [/bills?.*due (this|next) week/i, /(due|payable).*this week.*(supplier|bills?)/i, /(supplier )?bills?.*(due|coming due).*(soon|week|7 days)/i] },
  { template: 'suppliers.openBillsBySupplier', patterns: [/open bills?.*(by|per|each) supplier/i, /(unpaid|open) (supplier )?bills?/i, /how much.*owe.*each supplier/i] },
  { template: 'documents.remindersPending', patterns: [/(pending|waiting|due|unsent|how many) (whatsapp )?reminders?/i, /reminders?.*(pending|waiting|to send|unsent)/i] },
  { template: 'documents.quotationsExpiringThisWeek', patterns: [/quotations?.*(expir|running out|lapse|lapsing)/i, /(expiring|expire).*quotations?/i] },
  { template: 'documents.notesWithAndWithoutTax', patterns: [/(credit|debit) notes?.*(with|without).*tax/i, /(with|without) tax.*(credit|debit) notes?/i] },
  { template: 'sales.topSalespersons', patterns: [/(top|best) (salesperson|salesman|salespeople|sales ?person)/i, /which (salesperson|salesman|sales ?person).*(sold|best|most)/i, /sales by (salesperson|salesman)/i] }
]
