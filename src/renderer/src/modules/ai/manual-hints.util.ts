// Plain words owners use for a job, and the Manual chapters that explain it. A question that contains one of these
// phrases gets those chapters moved to the top, so "how do I enter a purchase invoice" reaches the supplier-bill
// chapter even though the Manual calls it a "Supplier Bill". Purely a lookup: it never writes navigation help.
// The first slug listed for a phrase is the best home for it.

export interface ManualHint {
  pattern: RegExp
  slugs: string[]
}

export const MANUAL_HINTS: ManualHint[] = [
  // Buying
  { pattern: /purchase (invoice|bill)|supplier bill|vendor bill|bill from (a |my )?supplier|record (a )?bill|enter (a )?bill|supplier invoice/i, slugs: ['bills-purchases', 'guide-buying'] },
  { pattern: /pay (a |my |the )?(supplier|vendor)|supplier payment|payment to (a )?supplier/i, slugs: ['bills-purchases', 'guide-buying'] },
  { pattern: /purchase orders?|order from (a )?supplier|\bpo\b/i, slugs: ['guide-buying', 'inventory'] },
  { pattern: /\bgrn\b|goods? (received|receipt)|receive (stock|goods)/i, slugs: ['guide-buying', 'inventory'] },
  { pattern: /debit notes?|purchase return|return goods to (a )?supplier/i, slugs: ['guide-buying', 'billing'] },
  // Selling
  { pattern: /credit notes?|sales return|customer return/i, slugs: ['guide-selling', 'billing'] },
  { pattern: /proforma|pro forma|advance invoice/i, slugs: ['guide-selling', 'billing'] },
  { pattern: /free (sample|item|gift)|give (it |something )?free|freebie/i, slugs: ['guide-selling', 'billing'] },
  { pattern: /shipping|delivery charge|packing charge|other charge|extra charge/i, slugs: ['guide-selling', 'billing'] },
  { pattern: /customer statement|statement of account|account statement/i, slugs: ['customers-suppliers', 'guide-selling'] },
  { pattern: /duplicate (customer|supplier|record)|merge (customer|supplier|record)/i, slugs: ['customers-suppliers', 'guide-find-your-way'] },
  { pattern: /(late|overdue) (fee|interest|payment charge)|interest on (overdue|late)/i, slugs: ['guide-selling', 'ledger-journal-entries'] },
  { pattern: /payment terms|due date (for|of) (a )?customer|credit days/i, slugs: ['guide-selling', 'customers-suppliers'] },
  { pattern: /(another|other|second|ship.?to|delivery) address/i, slugs: ['customers-suppliers', 'guide-selling'] },
  // Money and books
  { pattern: /day ?book|balance sheet|trial balance|cash ?flow (statement|report)|general ledger|profit and loss|\bp ?& ?l\b/i, slugs: ['guide-money-books', 'ledger-journal-entries', 'reports'] },
  { pattern: /journal entr|reversing entry|accrual|memo(randum)? (note|entry)/i, slugs: ['ledger-journal-entries', 'guide-money-books'] },
  { pattern: /bank rule|match (a )?(bank )?statement|reconcil/i, slugs: ['banking-reconciliation', 'guide-money-books'] },
  { pattern: /expense claim|reimburs|staff (spent|paid) (from|out of) (their )?(own )?pocket/i, slugs: ['guide-money-books', 'ledger-journal-entries'] },
  { pattern: /exchange rate|foreign currency|other currency|currency rate/i, slugs: ['guide-money-books', 'billing', 'guide-tax-international'] },
  { pattern: /budget|what.?if plan|cost categor|cost cent(re|er)/i, slugs: ['cost-centres-budgets-cashflow', 'guide-money-books'] },
  { pattern: /branch(es)? summar|several shops|multiple shops|consolidat/i, slugs: ['guide-money-books', 'reports'] },
  // Tax
  { pattern: /\btds\b|withholding tax|tax (kept|deducted) (back|by)/i, slugs: ['guide-buying', 'ledger-journal-entries', 'guide-tax-gst'] },
  { pattern: /gstr|gst return|input tax credit|\bitc\b|gst payment|e-?way ?bill|e-?invoice|\birn\b|gst (paid|payable)/i, slugs: ['guide-tax-gst'] },
  { pattern: /export sale|zero.?rated|exempt(ion)? certificate|tax.?exempt/i, slugs: ['guide-tax-gst', 'guide-tax-international'] },
  { pattern: /\bvat\b|sales tax|tax by part|tax part|split (a )?(tax )?rate/i, slugs: ['guide-tax-international', 'guide-tax-gst'] },
  { pattern: /(prices?|price) (include|inclusive|exclusive)|tax.?(inclusive|exclusive)|round(ing)?.?off|\bround(ing)?\b.*\b(invoice|bill|total)/i, slugs: ['guide-tax-gst', 'guide-selling'] },
  { pattern: /cgst|sgst|igst/i, slugs: ['guide-tax-gst'] },
  // Stock
  { pattern: /stock ?take|stock count|count(ing)? (the )?stock|physical (stock )?count|variance/i, slugs: ['guide-products-stock', 'inventory'] },
  { pattern: /\bbin\b|rack|shelf location|stock journal|break(ing)? (a )?(carton|pack)/i, slugs: ['guide-products-stock', 'inventory'] },
  { pattern: /negative stock|sell (below|without) stock|out of stock but/i, slugs: ['guide-products-stock', 'guide-selling'] },
  { pattern: /reserved|promised (on )?order/i, slugs: ['guide-selling', 'guide-products-stock'] },
  // Reminders, dashboard, settings, people
  { pattern: /reminders?|whatsapp (message|template)|message template|powered by sarang|do not (send|message)/i, slugs: ['guide-reminders-alerts', 'whatsapp-messaging'] },
  { pattern: /alert rule|notif(y|ied|ication)s? (me )?(when|if)|alert me/i, slugs: ['guide-reminders-alerts', 'settings'] },
  { pattern: /dashboard (tile|widget|section)|custom(ise|ize) (the )?dashboard|hide (a )?dashboard|add (my |your )?own tile|\bkpi\b/i, slugs: ['dashboard', 'guide-routine'] },
  { pattern: /custom field|required field|field (rule|validation)/i, slugs: ['settings'] },
  { pattern: /password (rule|policy|strength)|strong password/i, slugs: ['users-permissions'] },
  { pattern: /accountant (login|access|role)|read.?only (login|access|user)|give my accountant/i, slugs: ['users-permissions', 'guide-money-books'] },
  { pattern: /ask sarang|assistant/i, slugs: ['ai-assistant', 'guide-find-your-way'] },
  { pattern: /schedule(d)? report|save (a )?report (automatically|every)/i, slugs: ['reports', 'settings'] }
]

/** Chapters the plain words in a question point to, best first, without repeats. */
export function hintedSlugs(question: string): string[] {
  const out: string[] = []
  for (const h of MANUAL_HINTS) {
    if (!h.pattern.test(question)) continue
    for (const s of h.slugs) if (!out.includes(s)) out.push(s)
  }
  return out
}
