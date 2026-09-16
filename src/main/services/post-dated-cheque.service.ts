import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { chequeBookService } from './cheque-book.service'
import { journalEntryService } from './journal-entry.service'
import type { CreatePDCPayload, UpdatePDCStatusPayload } from '../validation/post-dated-cheque.validation'

// A PDC is a promise, not yet a real transaction — no GL posting at
// creation. Only CLEARED actually moves money (posts a real JournalEntry,
// mirroring a normal payment); BOUNCED/CANCELLED are non-events
// financially, just a status/remarks change.
export const postDatedChequeService = {
  async createPDC(payload: CreatePDCPayload, userId?: string) {
    const db = getPrisma()
    try {
      const account = await db.bankAccount.findUnique({ where: { id: payload.bankAccountId } })
      if (!account) return { success: false, error: { code: 'BANK-001', message: 'Bank account not found.' } }

      const pdc = await db.$transaction(async (tx) => {
        let chequeNumber = payload.chequeNumber ?? null
        let chequeBookId: string | null = null

        // useChequeBook auto-consumes the next number from the bank
        // account's active ChequeBook, inside this same transaction, so the
        // increment and the PDC row it's issued for can never drift apart.
        // Only meaningful for ISSUED cheques — a RECEIVED cheque's number
        // belongs to the payer's own bank, not one of our ChequeBooks.
        if (payload.useChequeBook && payload.direction !== 'ISSUED') {
          throw new ServiceError('CHQ-005', 'A cheque book can only supply the number for a cheque you are issuing, not one you received.')
        }
        if (payload.useChequeBook) {
          const consumed = await chequeBookService.consumeNextChequeNumber(tx, payload.bankAccountId)
          if (!consumed) throw new ServiceError('CHQ-001', 'No active cheque book with numbers remaining for this bank account.')
          chequeNumber = consumed.chequeNumber
          chequeBookId = consumed.chequeBookId
        }
        if (!chequeNumber) throw new ServiceError('CHQ-002', 'Cheque number is required.')

        return tx.postDatedCheque.create({
          data: {
            bankAccountId: payload.bankAccountId,
            chequeNumber,
            chequeBookId,
            direction: payload.direction,
            partyType: payload.partyType ?? null,
            partyId: payload.partyId ?? null,
            dueDate: parseLocalDateStart(payload.dueDate),
            amount: payload.amount,
            status: 'PENDING',
            remarks: payload.remarks ?? null,
            createdById: userId ?? null
          }
        })
      })

      await logAction({ userId, action: 'PDC_CREATED', entityType: 'PostDatedCheque', entityId: pdc.id, newValue: { chequeNumber: pdc.chequeNumber, direction: pdc.direction, amount: pdc.amount } })
      return { success: true, data: pdc }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create post-dated cheque.' } }
    }
  },

  async listPDCs(filters?: { bankAccountId?: string; status?: string; direction?: string; page?: number; limit?: number }) {
    try {
      const db = getPrisma()
      const page = filters?.page ?? 1
      const limit = filters?.limit ?? 50
      const where: Record<string, unknown> = {}
      if (filters?.bankAccountId) where.bankAccountId = filters.bankAccountId
      if (filters?.status) where.status = filters.status
      if (filters?.direction) where.direction = filters.direction
      const [cheques, total] = await Promise.all([
        db.postDatedCheque.findMany({ where, orderBy: { dueDate: 'asc' }, skip: (page - 1) * limit, take: limit }),
        db.postDatedCheque.count({ where })
      ])
      return { success: true, data: { cheques, total, page, limit } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list post-dated cheques.' } }
    }
  },

  async updateStatus(payload: UpdatePDCStatusPayload, userId?: string) {
    const db = getPrisma()
    try {
      // Real bug found+fixed 2026-09-16: the status read + check used to
      // happen OUTSIDE this transaction, then the write (and the GL
      // posting on CLEARED) happened inside using that stale read. Two
      // near-simultaneous "Mark as Cleared" calls (a double-click, a slow
      // UI, two sessions) could both pass the outer check before either had
      // written, then both post the cash-movement JournalEntry for the same
      // cheque — a real double-count. Same class of bug, same fix shape,
      // as receivePO()'s own documented double-receive guard: read, check,
      // and write the status all inside ONE transaction, so a concurrent
      // second call sees the first one's already-committed status.
      const updated = await db.$transaction(async (tx) => {
        const pdc = await tx.postDatedCheque.findUnique({ where: { id: payload.id } })
        if (!pdc) throw new ServiceError('PDC-001', 'Post-dated cheque not found.')
        if (pdc.status === 'CLEARED' || pdc.status === 'CANCELLED') {
          throw new ServiceError('PDC-002', `This cheque is already ${pdc.status.toLowerCase()} and cannot be changed further.`)
        }

        const result = await tx.postDatedCheque.update({
          where: { id: payload.id },
          data: { status: payload.status, remarks: payload.remarks ?? pdc.remarks }
        })

        if (payload.status === 'CLEARED') {
          const cashAccount = await chartOfAccountsService.getSystemAccountByCode('1000', tx)
          const otherAccount = await chartOfAccountsService.getSystemAccountByCode(pdc.direction === 'RECEIVED' ? '1100' : '2000', tx)
          const lines = pdc.direction === 'RECEIVED'
            ? [
                { accountId: cashAccount.id, bankAccountId: pdc.bankAccountId, debitAmount: pdc.amount, creditAmount: 0 },
                { accountId: otherAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: pdc.amount }
              ]
            : [
                { accountId: otherAccount.id, bankAccountId: null, debitAmount: pdc.amount, creditAmount: 0 },
                { accountId: cashAccount.id, bankAccountId: pdc.bankAccountId, debitAmount: 0, creditAmount: pdc.amount }
              ]
          await journalEntryService.postSystemEntry(tx, {
            sourceType: 'PDC_CLEARED', sourceId: pdc.id, narration: `Cheque ${pdc.chequeNumber} cleared`,
            lines
          })
        }

        return { result, oldStatus: pdc.status }
      })

      await logAction({ userId, action: 'PDC_STATUS_UPDATED', entityType: 'PostDatedCheque', entityId: payload.id, oldValue: { status: updated.oldStatus }, newValue: { status: payload.status } })
      return { success: true, data: updated.result }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to update cheque status.' } }
    }
  }
}
