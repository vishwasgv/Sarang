import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { roundCurrency } from './currency.service'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService } from './journal-entry.service'
import { DENOMINATION_VALUES } from '../validation/bank-deposit.validation'
import type { CreateBankDepositPayload } from '../validation/bank-deposit.validation'

// Cash/cheque deposit-slip generation from note denominations. Only the
// cash portion posts real money immediately (physically counting cash and
// handing it to the teller IS the realization event, same reasoning a real
// cash sale posts immediately) — a Debit to the destination BankAccount,
// Credit to the system Cash-in-hand account (code 1000), exactly the same
// two-line shape bank-account.service.ts's own opening-balance posting
// already uses. Cheques attached are only linked for the paper trail
// (status -> DEPOSITED) — they still post their own real GL entry later,
// once each one actually clears, via post-dated-cheque.service.ts's
// pre-existing updateStatus('CLEARED') flow. Counting a cheque's amount
// into this slip's own GL posting would double it once it clears too.
export const bankDepositService = {
  async createDeposit(payload: CreateBankDepositPayload, userId?: string) {
    const db = getPrisma()
    try {
      const account = await db.bankAccount.findUnique({ where: { id: payload.bankAccountId } })
      if (!account) return { success: false, error: { code: 'BANK-001', message: 'Bank account not found.' } }

      const cashTotal = roundCurrency(
        DENOMINATION_VALUES.reduce((sum, value) => sum + Number(value) * (payload.denominations[value] ?? 0), 0)
      )

      const chequeIds = payload.chequeIds ?? []
      let cheques: { id: string; amount: number; status: string; bankAccountId: string }[] = []
      if (chequeIds.length > 0) {
        cheques = await db.postDatedCheque.findMany({ where: { id: { in: chequeIds } } })
        if (cheques.length !== chequeIds.length) {
          return { success: false, error: { code: 'DEP-001', message: 'One or more selected cheques could not be found.' } }
        }
        for (const c of cheques) {
          if (c.status !== 'PENDING') {
            return { success: false, error: { code: 'DEP-002', message: `Cheque is not pending (currently ${c.status}) and cannot be added to a deposit slip.` } }
          }
          if (c.bankAccountId !== payload.bankAccountId) {
            return { success: false, error: { code: 'DEP-003', message: 'Every cheque on a deposit slip must belong to the same bank account.' } }
          }
        }
      }
      const chequeTotal = roundCurrency(cheques.reduce((sum, c) => sum + c.amount, 0))
      const totalAmount = roundCurrency(cashTotal + chequeTotal)

      if (totalAmount <= 0) {
        return { success: false, error: { code: 'DEP-004', message: 'A deposit slip must include at least some cash or at least one cheque.' } }
      }

      const deposit = await db.$transaction(async (tx) => {
        const depositNumber = await generateSequenceNumber(
          tx, 'bank_deposit_number_sequence', 'DEP', 5,
          async () => {
            const last = await tx.bankDeposit.findFirst({ orderBy: { createdAt: 'desc' }, select: { depositNumber: true } })
            return last ? parseInt(last.depositNumber.replace('DEP-', ''), 10) : 0
          }
        )

        const created = await tx.bankDeposit.create({
          data: {
            depositNumber,
            bankAccountId: payload.bankAccountId,
            depositDate: parseLocalDateStart(payload.depositDate),
            denominations: JSON.stringify(payload.denominations),
            cashTotal,
            chequeTotal,
            totalAmount,
            notes: payload.notes ?? null,
            createdById: userId ?? null
          }
        })

        if (chequeIds.length > 0) {
          await tx.postDatedCheque.updateMany({
            where: { id: { in: chequeIds } },
            data: { status: 'DEPOSITED', bankDepositId: created.id }
          })
        }

        if (cashTotal > 0) {
          const cashAccount = await chartOfAccountsService.getSystemAccountByCode('1000', tx)
          await journalEntryService.postSystemEntry(tx, {
            sourceType: 'BANK_DEPOSIT', sourceId: created.id, narration: `Cash deposit ${created.depositNumber} to ${account.accountName}`,
            lines: [
              { accountId: cashAccount.id, bankAccountId: payload.bankAccountId, debitAmount: cashTotal, creditAmount: 0 },
              { accountId: cashAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: cashTotal }
            ]
          })
        }

        return created
      })

      await logAction({ userId, action: 'BANK_DEPOSIT_CREATED', entityType: 'BankDeposit', entityId: deposit.id, newValue: { depositNumber: deposit.depositNumber, cashTotal, chequeTotal, totalAmount } })
      return { success: true, data: { ...deposit, denominations: payload.denominations, chequeIds } }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create bank deposit.' } }
    }
  },

  async listDeposits(filters?: { bankAccountId?: string; page?: number; limit?: number }) {
    try {
      const db = getPrisma()
      const page = filters?.page ?? 1
      const limit = filters?.limit ?? 50
      const where: Record<string, unknown> = {}
      if (filters?.bankAccountId) where.bankAccountId = filters.bankAccountId
      const [rows, total] = await Promise.all([
        db.bankDeposit.findMany({
          where, orderBy: { depositDate: 'desc' }, skip: (page - 1) * limit, take: limit,
          include: { bankAccount: { select: { accountName: true } }, cheques: { select: { id: true, chequeNumber: true, amount: true } } }
        }),
        db.bankDeposit.count({ where })
      ])
      return { success: true, data: { deposits: rows.map(toRecord), total, page, limit } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list bank deposits.' } }
    }
  },

  async getDeposit(id: string) {
    try {
      const db = getPrisma()
      const row = await db.bankDeposit.findUnique({
        where: { id },
        include: { bankAccount: { select: { accountName: true, bankName: true, accountNumberMasked: true } }, cheques: { select: { id: true, chequeNumber: true, amount: true, partyType: true, partyId: true } } }
      })
      if (!row) return { success: false, error: { code: 'DEP-005', message: 'Bank deposit not found.' } }
      return { success: true, data: toRecord(row) }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to get bank deposit.' } }
    }
  },

  // Pending, undeposited RECEIVED cheques for a bank account — the pool a
  // deposit slip's cheque picker draws from.
  async listAvailableCheques(bankAccountId: string) {
    try {
      const db = getPrisma()
      const rows = await db.postDatedCheque.findMany({
        where: { bankAccountId, status: 'PENDING', direction: 'RECEIVED' },
        orderBy: { dueDate: 'asc' }
      })
      return { success: true, data: rows }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list available cheques.' } }
    }
  }
}

type DepositRow = {
  id: string
  depositNumber: string
  bankAccountId: string
  depositDate: Date
  denominations: string
  cashTotal: number
  chequeTotal: number
  totalAmount: number
  notes: string | null
  createdAt: Date
  bankAccount: { accountName: string; bankName?: string | null; accountNumberMasked?: string | null }
  cheques: { id: string; chequeNumber: string; amount: number; partyType?: string | null; partyId?: string | null }[]
}

function toRecord(d: DepositRow) {
  return {
    id: d.id,
    depositNumber: d.depositNumber,
    bankAccountId: d.bankAccountId,
    bankAccountName: d.bankAccount.accountName,
    bankName: d.bankAccount.bankName ?? null,
    accountNumberMasked: d.bankAccount.accountNumberMasked ?? null,
    depositDate: d.depositDate.toISOString(),
    denominations: JSON.parse(d.denominations) as Record<string, number>,
    cashTotal: d.cashTotal,
    chequeTotal: d.chequeTotal,
    totalAmount: d.totalAmount,
    notes: d.notes,
    cheques: d.cheques,
    createdAt: d.createdAt.toISOString()
  }
}
