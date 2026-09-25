import { describe, it, expect } from 'vitest'
import { findManualMatch, scoreManualChapters } from '../manual-match.util'
import { hintedSlugs, MANUAL_HINTS } from '../manual-hints.util'

// "How do I..." questions in the owner's own words, and the chapter that must come first.
const CASES: Array<[string, string]> = [
  ['how do I enter a purchase invoice', 'bills-purchases'],
  ['how do I record a supplier bill', 'bills-purchases'],
  ['how do I pay a supplier', 'bills-purchases'],
  ['how do I create a purchase order', 'guide-buying'],
  ['how do I receive goods from a supplier grn', 'guide-buying'],
  ['how do I make a debit note', 'guide-buying'],
  ['how do I make a credit note', 'guide-selling'],
  ['how do I create a proforma invoice', 'guide-selling'],
  ['how do I give a free sample', 'guide-selling'],
  ['how do I add shipping charges to an invoice', 'guide-selling'],
  ['how do I print a customer statement', 'customers-suppliers'],
  ['how do I merge duplicate customers', 'customers-suppliers'],
  ['how do I charge interest on late payments', 'guide-selling'],
  ['how do I set payment terms for a customer', 'guide-selling'],
  ['how do I add another address for a customer', 'customers-suppliers'],
  ['where is the day book', 'guide-money-books'],
  ['where is the balance sheet', 'guide-money-books'],
  ['how do I see the trial balance', 'guide-money-books'],
  ['where is the cash flow statement', 'guide-money-books'],
  ['how do I make a journal entry that reverses next month', 'ledger-journal-entries'],
  ['how do I use bank rules', 'banking-reconciliation'],
  ['how do I reconcile my bank statement', 'banking-reconciliation'],
  ['where do I see expense claims', 'guide-money-books'],
  ['how do I change the exchange rate', 'guide-money-books'],
  ['how do I set a budget', 'cost-centres-budgets-cashflow'],
  ['how do I make a what-if budget plan', 'cost-centres-budgets-cashflow'],
  ['how do I record tds', 'guide-buying'],
  ['how do I prepare gstr-1', 'guide-tax-gst'],
  ['how do I claim input tax credit', 'guide-tax-gst'],
  ['how do I make an e-way bill', 'guide-tax-gst'],
  ['how do I make an export sale without tax', 'guide-tax-gst'],
  ['how do I file a vat return', 'guide-tax-international'],
  ['how do I split a tax rate into gst and pst', 'guide-tax-international'],
  ['how do I make prices include tax', 'guide-tax-gst'],
  ['how do I turn off rounding on invoices', 'guide-tax-gst'],
  ['why does it show igst', 'guide-tax-gst'],
  ['how do I do a stock take', 'guide-products-stock'],
  ['how do I count my stock', 'guide-products-stock'],
  ['where do I set the bin for an item', 'guide-products-stock'],
  ['how do I sell with negative stock', 'guide-products-stock'],
  ['how do I stop reminders for a customer', 'guide-reminders-alerts'],
  ['how do I remove powered by sarang from messages', 'guide-reminders-alerts'],
  ['how do I change a message template', 'guide-reminders-alerts'],
  ['how do I get notified when a big invoice is made', 'guide-reminders-alerts'],
  ['how do I hide a section of the dashboard', 'dashboard'],
  ['how do I add my own tile to the dashboard', 'dashboard'],
  ['how do I make a custom field required', 'settings'],
  ['how do I set a strong password policy', 'users-permissions'],
  ['how do I give my accountant a login', 'users-permissions'],
  ['how do I turn on ask sarang', 'ai-assistant'],
  ['how do I save a report automatically every week', 'reports']
]

describe('Manual hints for the words owners use', () => {
  for (const [question, slug] of CASES) {
    it(`"${question}" -> ${slug}`, () => {
      expect(scoreManualChapters(question, 'en')[0].slug).toBe(slug)
    })
  }

  it('a hinted question is treated as a confident match, not a weak suggestion list', () => {
    const r = findManualMatch('How do I enter a purchase invoice?', 'en')
    expect(r.kind).toBe('confident')
  })

  it('questions with none of the phrases get no hints', () => {
    expect(hintedSlugs('how do I create an invoice')).toEqual([])
  })

  it('every hint names chapters that exist in the Manual', async () => {
    const { MANUAL_CHAPTERS } = await import('@modules/manual/manifest')
    const known = new Set(MANUAL_CHAPTERS.map((c) => c.slug))
    for (const h of MANUAL_HINTS) for (const s of h.slugs) expect(known.has(s), s).toBe(true)
  })
})
