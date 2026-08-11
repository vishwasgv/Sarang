import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { sumCurrency, roundCurrency } from './currency.service'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { assertNotLocked } from './transaction-lock.service'
import { ServiceError } from '../errors/service-error'
import type { CreateJournalEntryPayload } from '../validation/journal-entry.validation'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

type EntryLine = { accountId: string; bankAccountId?: string | null; debitAmount: number; creditAmount: number; remarks?: string | null }

async function generateEntryNumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'journal_entry_number_sequence', 'JE', 5,
    async () => {
      const rows = await tx.journalEntry.findMany({ select: { entryNumber: true } })
      let max = 0
      for (const row of rows) {
        const n = parseInt(row.entryNumber.replace('JE-', ''), 10)
        if (Number.isFinite(n) && n > max) max = n
      }
      return max
    }
  )
}

// Every ASSET-type bank/cash line moves BankAccount.currentBalance the same
// direction a real ASSET account moves on debit/credit (debit increases,
// credit decreases) — this is what keeps a bank account's running balance in
// sync purely from Journal postings, not just from Payment/Expense rows
// (per Section 4.1 item 4's own JournalEntryLine.bankAccountId design).
async function applyBankBalanceDeltas(tx: TxClient, lines: EntryLine[]): Promise<void> {
  for (const line of lines) {
    if (!line.bankAccountId) continue
    const delta = roundCurrency(line.debitAmount - line.creditAmount)
    if (delta === 0) continue
    await tx.bankAccount.update({
      where: { id: line.bankAccountId },
      data: { currentBalance: { increment: delta } }
    })
  }
}

function assertBalanced(lines: EntryLine[]): void {
  const totalDebit = sumCurrency(lines.map((l) => l.debitAmount))
  const totalCredit = sumCurrency(lines.map((l) => l.creditAmount))
  if (totalDebit !== totalCredit) {
    throw new ServiceError('JE-001', `Journal entry is not balanced — total debit (${totalDebit}) must equal total credit (${totalCredit}).`)
  }
  if (totalDebit === 0) {
    throw new ServiceError('JE-002', 'Journal entry cannot have a zero total.')
  }
}

async function postSystemEntryTx(
  tx: TxClient,
  params: { sourceType: string; sourceId?: string; narration?: string; entryDate?: Date; lines: EntryLine[] }
) {
  assertBalanced(params.lines)
  const entryNumber = await generateEntryNumber(tx)
  const created = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: params.entryDate ?? new Date(),
      narration: params.narration || null,
      sourceType: params.sourceType,
      sourceId: params.sourceId ?? null,
      lines: { create: params.lines.map((l) => ({ accountId: l.accountId, bankAccountId: l.bankAccountId ?? null, debitAmount: l.debitAmount, creditAmount: l.creditAmount, remarks: l.remarks || null })) }
    }
  })
  await applyBankBalanceDeltas(tx, params.lines)
  return created
}

async function reverseEntryTx(tx: TxClient, original: { id: string; entryNumber: string; sourceType: string; lines: EntryLine[] }, reason: string, userId?: string) {
  const reversedLines: EntryLine[] = original.lines.map((l) => ({
    accountId: l.accountId,
    bankAccountId: l.bankAccountId,
    debitAmount: l.creditAmount,
    creditAmount: l.debitAmount,
    remarks: l.remarks
  }))
  const reversal = await postSystemEntryTx(tx, {
    sourceType: original.sourceType,
    sourceId: original.id,
    narration: `Reversal of ${original.entryNumber}: ${reason}`,
    lines: reversedLines
  })
  await tx.journalEntry.update({ where: { id: original.id }, data: { isReversed: true, reversalReason: reason } })
  // Passing `tx` here is load-bearing, not stylistic — see audit.service.ts's
  // LogActionParams.tx doc comment. reverseEntryTx runs INSIDE the caller's
  // own transaction; a plain logAction() call here previously opened a
  // second, separate transaction against the same SQLite file and
  // self-deadlocked against this still-open one.
  await logAction({ userId, action: 'JOURNAL_ENTRY_REVERSED', entityType: 'JournalEntry', entityId: original.id, newValue: { reversalEntryId: reversal.id, reason }, tx })
  return reversal
}

// Used by every existing money-movement service (billing/bill/payment/
// supplier-payment/expense) that posted its own original entry with
// sourceType/sourceId set to itself (e.g. sourceType: 'INVOICE', sourceId:
// invoice.id) — finds that entry and reverses it WITHIN the caller's own
// $transaction, so a cancel/void/reversal and its GL reversal commit or roll
// back together atomically, never independently. Silently no-ops if no
// active (non-reversed) entry exists for that source — callers that predate
// this GL-posting pass, or whose own posting failed validation and was
// never written, must not block the underlying business operation on a GL
// entry that was never there to begin with.
export async function reverseEntryBySourceTx(tx: TxClient, sourceType: string, sourceId: string, reason: string, userId?: string): Promise<void> {
  const original = await tx.journalEntry.findFirst({ where: { sourceType, sourceId, isReversed: false }, include: { lines: true } })
  if (!original) return
  await reverseEntryTx(tx, original, reason, userId)
}

export const journalEntryService = {
  async createJournalEntry(payload: CreateJournalEntryPayload, userId?: string) {
    const db = getPrisma()
    try {
      const entryDate = payload.entryDate ? parseLocalDateStart(payload.entryDate) : new Date()
      const lockError = await assertNotLocked(entryDate)
      if (lockError) return lockError

      assertBalanced(payload.lines)

      const accountIds = [...new Set(payload.lines.map((l) => l.accountId))]
      const accounts = await db.chartOfAccounts.findMany({ where: { id: { in: accountIds } } })
      if (accounts.length !== accountIds.length) return { success: false, error: { code: 'COA-001', message: 'One or more accounts were not found.' } }
      const inactive = accounts.find((a) => !a.isActive)
      if (inactive) return { success: false, error: { code: 'COA-008', message: `Account "${inactive.accountName}" is inactive and cannot receive new postings.` } }

      const entry = await db.$transaction(async (tx) => {
        const entryNumber = await generateEntryNumber(tx)
        const created = await tx.journalEntry.create({
          data: {
            entryNumber,
            entryDate,
            narration: payload.narration || null,
            sourceType: 'MANUAL',
            createdById: userId ?? null,
            lines: {
              create: payload.lines.map((l) => ({
                accountId: l.accountId,
                bankAccountId: l.bankAccountId ?? null,
                debitAmount: l.debitAmount,
                creditAmount: l.creditAmount,
                remarks: l.remarks || null
              }))
            }
          },
          include: { lines: true }
        })
        await applyBankBalanceDeltas(tx, payload.lines)
        return created
      })

      await logAction({ userId, action: 'JOURNAL_ENTRY_CREATED', entityType: 'JournalEntry', entityId: entry.id, newValue: { entryNumber: entry.entryNumber, lineCount: entry.lines.length } })
      return { success: true, data: entry }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create journal entry.' } }
    }
  },

  async reverseJournalEntry(id: string, reason: string, userId?: string) {
    const db = getPrisma()
    try {
      const original = await db.journalEntry.findUnique({ where: { id }, include: { lines: true } })
      if (!original) return { success: false, error: { code: 'JE-003', message: 'Journal entry not found.' } }
      if (original.isReversed) return { success: false, error: { code: 'JE-004', message: 'This journal entry has already been reversed.' } }
      const lockError = await assertNotLocked(original.entryDate)
      if (lockError) return lockError

      const reversal = await db.$transaction((tx) => reverseEntryTx(tx, original, reason, userId))
      return { success: true, data: reversal }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to reverse journal entry.' } }
    }
  },

  async listJournalEntries(filters?: { sourceType?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) {
    try {
      const db = getPrisma()
      const page = filters?.page ?? 1
      const limit = filters?.limit ?? 20
      const where: Record<string, unknown> = {}
      if (filters?.sourceType) where.sourceType = filters.sourceType
      if (filters?.dateFrom || filters?.dateTo) {
        where.entryDate = {
          ...(filters.dateFrom ? { gte: parseLocalDateStart(filters.dateFrom) } : {}),
          ...(filters.dateTo ? { lte: parseLocalDateStart(filters.dateTo) } : {})
        }
      }
      const [entries, total] = await Promise.all([
        db.journalEntry.findMany({ where, include: { lines: { include: { account: true } } }, orderBy: { entryDate: 'desc' }, skip: (page - 1) * limit, take: limit }),
        db.journalEntry.count({ where })
      ])
      return { success: true, data: { entries, total, page, limit } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list journal entries.' } }
    }
  },

  async getJournalEntry(id: string) {
    try {
      const db = getPrisma()
      const entry = await db.journalEntry.findUnique({ where: { id }, include: { lines: { include: { account: true, bankAccount: true } }, createdBy: { select: { id: true, fullName: true } } } })
      if (!entry) return { success: false, error: { code: 'JE-003', message: 'Journal entry not found.' } }
      return { success: true, data: entry }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to fetch journal entry.' } }
    }
  },

  // Used by fixed-asset depreciation/disposal, credit-interest, year-end-
  // close, AND every existing money-movement service (billing/bill/payment/
  // supplier-payment/expense) to post a system-generated, already-balanced
  // entry inside their own $transaction. Skips the public create-schema
  // (callers build already-validated lines programmatically) but still runs
  // the same debit=credit safety check, never trusted blind even internally.
  postSystemEntry: postSystemEntryTx
}
