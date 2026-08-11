import { getPrisma } from '../database/db'
import { randomUUID } from 'crypto'
import { logAction } from './audit.service'
import { parseLocalDateStart } from '../utils/date.util'
import { roundCurrency } from './currency.service'
import type { ImportStatementLinesPayload, ReconcileLinePayload } from '../validation/bank-statement.validation'

// Bank reconciliation, Section 4.1 item 2 — no live feed, a manually
// imported statement is confirmed sufficient (even Zoho's own reconciliation
// works this way). Auto-match is deliberately conservative: only marks a
// line reconciled when EXACTLY one real transaction matches both amount and
// a nearby date — an ambiguous multi-match or a zero-match is always left
// for a human to resolve via reconcileLine, never guessed.
const DATE_PROXIMITY_MS = 3 * 24 * 60 * 60 * 1000
const AMOUNT_TOLERANCE = 0.01

function withinWindow(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= DATE_PROXIMITY_MS
}
function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE
}

export const bankStatementService = {
  async importLines(payload: ImportStatementLinesPayload, userId?: string) {
    const db = getPrisma()
    try {
      const account = await db.bankAccount.findUnique({ where: { id: payload.bankAccountId } })
      if (!account) return { success: false, error: { code: 'BANK-001', message: 'Bank account not found.' } }

      const importBatchId = randomUUID()
      await db.bankStatementLine.createMany({
        data: payload.lines.map((line) => ({
          bankAccountId: payload.bankAccountId,
          transactionDate: parseLocalDateStart(line.transactionDate),
          description: line.description,
          referenceNumber: line.referenceNumber ?? null,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          importBatchId
        }))
      })

      await logAction({ userId, action: 'BANK_STATEMENT_IMPORTED', entityType: 'BankAccount', entityId: payload.bankAccountId, newValue: { importBatchId, lineCount: payload.lines.length } })
      return { success: true, data: { importBatchId, lineCount: payload.lines.length } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to import statement lines.' } }
    }
  },

  async listStatementLines(filters: { bankAccountId: string; reconciled?: boolean; page?: number; limit?: number }) {
    try {
      const db = getPrisma()
      const page = filters.page ?? 1
      const limit = filters.limit ?? 50
      const where: Record<string, unknown> = { bankAccountId: filters.bankAccountId }
      if (filters.reconciled !== undefined) where.reconciled = filters.reconciled
      const [lines, total] = await Promise.all([
        db.bankStatementLine.findMany({ where, orderBy: { transactionDate: 'desc' }, skip: (page - 1) * limit, take: limit }),
        db.bankStatementLine.count({ where })
      ])
      return { success: true, data: { lines, total, page, limit } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list statement lines.' } }
    }
  },

  // Best-effort automatic matching — never destructive, only ever moves an
  // unreconciled line to reconciled when confident (exactly one candidate).
  async autoMatch(bankAccountId: string, userId?: string) {
    const db = getPrisma()
    try {
      const unmatched = await db.bankStatementLine.findMany({ where: { bankAccountId, reconciled: false } })
      let matchedCount = 0

      for (const line of unmatched) {
        type Candidate = { matchedType: 'PAYMENT' | 'EXPENSE' | 'SUPPLIER_PAYMENT' | 'JOURNAL_ENTRY'; matchedId: string }
        const candidates: Candidate[] = []

        if (line.creditAmount > 0) {
          // Money IN — a customer payment, or a bank-linked JournalEntryLine debit (ASSET increases on debit).
          const payments = await db.payment.findMany({ where: { isReversed: false } })
          for (const p of payments) {
            if (amountsMatch(p.amount, line.creditAmount) && withinWindow(p.paymentDate, line.transactionDate)) {
              candidates.push({ matchedType: 'PAYMENT', matchedId: p.id })
            }
          }
          const jeLines = await db.journalEntryLine.findMany({ where: { bankAccountId, debitAmount: { gt: 0 } }, include: { journalEntry: true } })
          for (const jl of jeLines) {
            if (amountsMatch(jl.debitAmount, line.creditAmount) && withinWindow(jl.journalEntry.entryDate, line.transactionDate)) {
              candidates.push({ matchedType: 'JOURNAL_ENTRY', matchedId: jl.journalEntryId })
            }
          }
        }

        if (line.debitAmount > 0) {
          // Money OUT — an expense, a supplier payment, or a bank-linked JournalEntryLine credit.
          const expenses = await db.expense.findMany()
          for (const e of expenses) {
            if (amountsMatch(e.amount, line.debitAmount) && withinWindow(e.expenseDate, line.transactionDate)) {
              candidates.push({ matchedType: 'EXPENSE', matchedId: e.id })
            }
          }
          const supplierPayments = await db.supplierPayment.findMany({ where: { isReversed: false } })
          for (const sp of supplierPayments) {
            if (amountsMatch(sp.amount, line.debitAmount) && withinWindow(sp.paymentDate, line.transactionDate)) {
              candidates.push({ matchedType: 'SUPPLIER_PAYMENT', matchedId: sp.id })
            }
          }
          const jeLines = await db.journalEntryLine.findMany({ where: { bankAccountId, creditAmount: { gt: 0 } }, include: { journalEntry: true } })
          for (const jl of jeLines) {
            if (amountsMatch(jl.creditAmount, line.debitAmount) && withinWindow(jl.journalEntry.entryDate, line.transactionDate)) {
              candidates.push({ matchedType: 'JOURNAL_ENTRY', matchedId: jl.journalEntryId })
            }
          }
        }

        if (candidates.length === 1) {
          await db.bankStatementLine.update({
            where: { id: line.id },
            data: { reconciled: true, reconciledAt: new Date(), matchedType: candidates[0].matchedType, matchedId: candidates[0].matchedId }
          })
          matchedCount++
        }
      }

      await logAction({ userId, action: 'BANK_STATEMENT_AUTO_MATCHED', entityType: 'BankAccount', entityId: bankAccountId, newValue: { matchedCount, totalUnmatched: unmatched.length } })
      return { success: true, data: { matchedCount, remainingUnmatched: unmatched.length - matchedCount } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to auto-match statement lines.' } }
    }
  },

  async reconcileLine(payload: ReconcileLinePayload, userId?: string) {
    const db = getPrisma()
    try {
      const line = await db.bankStatementLine.findUnique({ where: { id: payload.lineId } })
      if (!line) return { success: false, error: { code: 'BANK-002', message: 'Statement line not found.' } }
      const updated = await db.bankStatementLine.update({
        where: { id: payload.lineId },
        data: { reconciled: true, reconciledAt: new Date(), matchedType: payload.matchedType, matchedId: payload.matchedId }
      })
      await logAction({ userId, action: 'BANK_STATEMENT_LINE_RECONCILED', entityType: 'BankStatementLine', entityId: payload.lineId, newValue: { matchedType: payload.matchedType, matchedId: payload.matchedId } })
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to reconcile statement line.' } }
    }
  },

  async unreconcileLine(lineId: string, userId?: string) {
    const db = getPrisma()
    try {
      const line = await db.bankStatementLine.findUnique({ where: { id: lineId } })
      if (!line) return { success: false, error: { code: 'BANK-002', message: 'Statement line not found.' } }
      const updated = await db.bankStatementLine.update({
        where: { id: lineId },
        data: { reconciled: false, reconciledAt: null, matchedType: null, matchedId: null }
      })
      await logAction({ userId, action: 'BANK_STATEMENT_LINE_UNRECONCILED', entityType: 'BankStatementLine', entityId: lineId })
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to unreconcile statement line.' } }
    }
  },

  async getReconciliationSummary(bankAccountId: string) {
    try {
      const db = getPrisma()
      const account = await db.bankAccount.findUnique({ where: { id: bankAccountId } })
      if (!account) return { success: false, error: { code: 'BANK-001', message: 'Bank account not found.' } }

      const lines = await db.bankStatementLine.findMany({ where: { bankAccountId } })
      const totalDebits = roundCurrency(lines.reduce((s, l) => s + l.debitAmount, 0))
      const totalCredits = roundCurrency(lines.reduce((s, l) => s + l.creditAmount, 0))
      const reconciledCount = lines.filter((l) => l.reconciled).length
      const unreconciledCount = lines.length - reconciledCount

      return {
        success: true,
        data: {
          bookBalance: account.currentBalance,
          statementNetMovement: roundCurrency(totalCredits - totalDebits),
          totalDebits, totalCredits,
          lineCount: lines.length, reconciledCount, unreconciledCount
        }
      }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to compute reconciliation summary.' } }
    }
  }
}
