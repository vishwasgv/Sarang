import { getPrisma } from '../database/db'

// Money invariants that must hold after every scenario. Each check returns a list of human-readable
// problems; an empty list means the books are consistent.
const EPS = 0.005

export async function journalBalanceProblems(): Promise<string[]> {
  const db = getPrisma()
  const rows = await db.journalEntryLine.groupBy({ by: ['journalEntryId'], _sum: { debitAmount: true, creditAmount: true } })
  const out: string[] = []
  for (const r of rows) {
    const d = r._sum.debitAmount ?? 0
    const c = r._sum.creditAmount ?? 0
    if (Math.abs(d - c) > EPS) out.push(`journal entry ${r.journalEntryId}: debit ${d} != credit ${c}`)
  }
  return out
}

export async function trialBalanceProblems(): Promise<string[]> {
  const db = getPrisma()
  const agg = await db.journalEntryLine.aggregate({ _sum: { debitAmount: true, creditAmount: true } })
  const d = agg._sum.debitAmount ?? 0
  const c = agg._sum.creditAmount ?? 0
  return Math.abs(d - c) > EPS ? [`trial balance: total debit ${d} != total credit ${c}`] : []
}

export async function invoiceProblems(): Promise<string[]> {
  const db = getPrisma()
  const invoices = await db.invoice.findMany({ include: { payments: true } })
  const out: string[] = []
  for (const inv of invoices) {
    if (inv.status === 'CANCELLED' || inv.invoiceType === 'RETURN') continue
    // A split payment that fell a few minor units short is closed with a rounding write-off, which counts as paid.
    const writeOffs = await db.journalEntry.findMany({ where: { sourceType: 'PAYMENT_ROUNDING', sourceId: inv.id, isReversed: false }, include: { lines: true } })
    const writtenOff = writeOffs.reduce((s, e) => s + e.lines.reduce((t, l) => t + l.creditAmount, 0), 0)
    const paid = inv.payments.filter((p) => !p.isReversed).reduce((s, p) => s + p.amount, 0) + writtenOff
    if (Math.abs(paid - inv.paidAmount) > EPS) out.push(`${inv.invoiceNumber}: paidAmount ${inv.paidAmount} != sum of live payments ${paid}`)
    // Returns against the invoice reduce its open balance, so paid + balance may fall short of the total by up to the returned value.
    const returned = await db.invoice.aggregate({ where: { originalInvoiceId: inv.id, invoiceType: 'RETURN' }, _sum: { totalAmount: true } })
    const returnedValue = Math.abs(returned._sum.totalAmount ?? 0)
    const gap = inv.totalAmount - (inv.paidAmount + inv.balanceAmount)
    if (gap < -EPS || gap > returnedValue + EPS) out.push(`${inv.invoiceNumber}: paid ${inv.paidAmount} + balance ${inv.balanceAmount} vs total ${inv.totalAmount} (returned ${returnedValue})`)
    if (inv.balanceAmount < -EPS) out.push(`${inv.invoiceNumber}: negative balance ${inv.balanceAmount}`)
    const expected = inv.balanceAmount <= EPS ? 'PAID' : inv.paidAmount > EPS ? 'PARTIAL' : 'UNPAID'
    if (inv.paymentStatus !== expected && !(returnedValue > 0 && inv.paymentStatus === 'PARTIAL')) out.push(`${inv.invoiceNumber}: status ${inv.paymentStatus}, expected ${expected}`)
    if (Math.abs(inv.subtotal - inv.discountAmount + inv.taxAmount + inv.roundingAmount - inv.totalAmount) > EPS && !inv.pricesIncludeTax) {
      out.push(`${inv.invoiceNumber}: subtotal ${inv.subtotal} - discount ${inv.discountAmount} + tax ${inv.taxAmount} + rounding ${inv.roundingAmount} != total ${inv.totalAmount}`)
    }
  }
  return out
}

export async function customerBalanceProblems(): Promise<string[]> {
  const db = getPrisma()
  const customers = await db.customer.findMany({ select: { id: true, customerName: true, outstandingBalance: true } })
  const out: string[] = []
  for (const c of customers) {
    // A return credits the customer and also reduces the original invoice's balance; the RETURN invoice itself is not a receivable.
    const agg = await db.invoice.aggregate({ where: { customerId: c.id, status: { not: 'CANCELLED' }, invoiceType: { not: 'RETURN' } }, _sum: { balanceAmount: true } })
    const owed = agg._sum.balanceAmount ?? 0
    // A customer can hold a general credit (a return on a paid invoice), so what they owe can be lower than the open invoices, never higher.
    if (c.outstandingBalance > owed + EPS) out.push(`${c.customerName}: outstandingBalance ${c.outstandingBalance} is more than the open invoices ${owed}`)
  }
  return out
}

export async function stockProblems(): Promise<string[]> {
  const db = getPrisma()
  const inv = await db.inventory.findMany({ include: { product: { select: { productName: true } } } })
  const out: string[] = []
  for (const i of inv) {
    if (i.quantity < -EPS) out.push(`${i.product.productName}: negative stock ${i.quantity}`)
  }
  return out
}

export async function receivableLedgerProblems(): Promise<string[]> {
  const db = getPrisma()
  const acct = await db.chartOfAccounts.findUnique({ where: { accountCode: '1100' } })
  if (!acct) return []
  const gl = await db.journalEntryLine.aggregate({ where: { accountId: acct.id }, _sum: { debitAmount: true, creditAmount: true } })
  const glBalance = (gl._sum.debitAmount ?? 0) - (gl._sum.creditAmount ?? 0)
  // Receivable = what customers owe (their ledger balance, which can go negative for a credit) plus open invoices with no customer.
  const cust = await db.customer.aggregate({ _sum: { outstandingBalance: true } })
  const walkIn = await db.invoice.aggregate({ where: { customerId: null, status: { not: 'CANCELLED' }, invoiceType: { not: 'RETURN' } }, _sum: { balanceAmount: true } })
  const expected = (cust._sum.outstandingBalance ?? 0) + (walkIn._sum.balanceAmount ?? 0)
  return Math.abs(glBalance - expected) > EPS ? [`Accounts Receivable ledger ${glBalance} != customer balances plus walk-in open invoices ${expected}`] : []
}

export async function balanceSheetProblems(): Promise<string[]> {
  const { financialStatementsService } = await import('../services/financial-statements.service')
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const bs = await financialStatementsService.generateBalanceSheet({ asOf: iso })
  return bs.balanced ? [] : [`balance sheet does not balance: difference ${bs.difference}`]
}

export async function allProblems(): Promise<string[]> {
  return [
    ...(await journalBalanceProblems()),
    ...(await trialBalanceProblems()),
    ...(await invoiceProblems()),
    ...(await customerBalanceProblems()),
    ...(await stockProblems()),
    ...(await receivableLedgerProblems()),
    ...(await balanceSheetProblems())
  ]
}
