import { getPrisma } from '../database/db'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService, reverseEntryBySourceTx } from './journal-entry.service'
import { roundMoney } from '../../shared/utils/money'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

/** The rate with the most taxable value among a linked document's lines; null when none is taxed. */
export function dominantTaxRate(lines: Array<{ taxRate?: number | null; quantity?: number | null; unitPrice?: number | null; lineTotal?: number | null; total?: number | null; taxAmount?: number | null }> | null | undefined): number | null {
  const byRate = new Map<number, number>()
  for (const l of lines ?? []) {
    const rate = Number(l.taxRate) || 0
    if (rate <= 0) continue
    const value = Math.abs(Number(l.lineTotal ?? l.total) || (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0))
    byRate.set(rate, (byRate.get(rate) ?? 0) + value)
  }
  let best: number | null = null
  let bestValue = -1
  for (const [rate, value] of byRate) {
    if (value > bestValue) { best = rate; bestValue = value }
  }
  return best
}

/** The business's default tax rate (Settings > Tax Configuration), 0 when none is configured. */
export async function defaultBusinessTaxRate(): Promise<number> {
  try {
    const cfg = await getPrisma().taxConfiguration.findFirst({ where: { isDefault: true, isActive: true }, select: { rate: true } })
    return Number(cfg?.rate) || 0
  } catch {
    return 0
  }
}

// A credit note reverses a sale: Dr Sales Revenue (taxable) and Dr Tax Payable (tax, only when tax was applied),
// Cr Accounts Receivable (total). Balanced by construction (taxable = total - tax, both to 3 places).
export async function postCreditNoteJournalTx(tx: TxClient, note: { id: string; creditNoteNumber: string; amount: number; taxAmount: number }): Promise<void> {
  if (!(note.amount > 0)) return
  const [arAccount, salesAccount] = await Promise.all([
    chartOfAccountsService.getSystemAccountByCode('1100', tx),
    chartOfAccountsService.getSystemAccountByCode('4000', tx)
  ])
  const tax = note.taxAmount > 0 ? note.taxAmount : 0
  const taxable = roundMoney(note.amount - tax, 3)
  const lines = [{ accountId: arAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: note.amount }]
  if (taxable > 0) lines.push({ accountId: salesAccount.id, bankAccountId: null, debitAmount: taxable, creditAmount: 0 })
  if (tax > 0) {
    const taxAccount = await chartOfAccountsService.getSystemAccountByCode('2100', tx)
    lines.push({ accountId: taxAccount.id, bankAccountId: null, debitAmount: tax, creditAmount: 0 })
  }
  await journalEntryService.postSystemEntry(tx, { sourceType: 'CREDIT_NOTE', sourceId: note.id, narration: `Credit Note ${note.creditNoteNumber}`, lines })
}

// A debit note (vendor credit) reverses a purchase: Dr Accounts Payable (total), Cr Purchases (total). Bills post
// their input tax inside the purchase cost, so the reversal takes the tax out of the same account.
export async function postDebitNoteJournalTx(tx: TxClient, note: { id: string; debitNoteNumber: string; amount: number }): Promise<void> {
  if (!(note.amount > 0)) return
  const [apAccount, expenseAccount] = await Promise.all([
    chartOfAccountsService.getSystemAccountByCode('2000', tx),
    chartOfAccountsService.getSystemAccountByCode('6000', tx)
  ])
  await journalEntryService.postSystemEntry(tx, {
    sourceType: 'DEBIT_NOTE', sourceId: note.id, narration: `Debit Note ${note.debitNoteNumber}`,
    lines: [
      { accountId: apAccount.id, bankAccountId: null, debitAmount: note.amount, creditAmount: 0 },
      { accountId: expenseAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: note.amount }
    ]
  })
}

/** True when a live (not reversed) journal entry exists for the note; notes made before postings existed have none. */
export async function noteHasJournalTx(tx: TxClient, sourceType: 'CREDIT_NOTE' | 'DEBIT_NOTE', id: string): Promise<boolean> {
  const found = await tx.journalEntry.findFirst({ where: { sourceType, sourceId: id, isReversed: false }, select: { id: true } })
  return !!found
}

export async function reverseNoteJournalTx(tx: TxClient, sourceType: 'CREDIT_NOTE' | 'DEBIT_NOTE', id: string, reason: string, userId?: string): Promise<void> {
  await reverseEntryBySourceTx(tx, sourceType, id, reason, userId)
}
