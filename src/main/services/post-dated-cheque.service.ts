import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { logAction } from './audit.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
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

      const pdc = await db.postDatedCheque.create({
        data: {
          bankAccountId: payload.bankAccountId,
          chequeNumber: payload.chequeNumber,
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

      await logAction({ userId, action: 'PDC_CREATED', entityType: 'PostDatedCheque', entityId: pdc.id, newValue: { chequeNumber: pdc.chequeNumber, direction: pdc.direction, amount: pdc.amount } })
      return { success: true, data: pdc }
    } catch (err) {
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
      const pdc = await db.postDatedCheque.findUnique({ where: { id: payload.id } })
      if (!pdc) return { success: false, error: { code: 'PDC-001', message: 'Post-dated cheque not found.' } }
      if (pdc.status === 'CLEARED' || pdc.status === 'CANCELLED') {
        return { success: false, error: { code: 'PDC-002', message: `This cheque is already ${pdc.status.toLowerCase()} and cannot be changed further.` } }
      }

      const updated = await db.$transaction(async (tx) => {
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

        return result
      })

      await logAction({ userId, action: 'PDC_STATUS_UPDATED', entityType: 'PostDatedCheque', entityId: payload.id, oldValue: { status: pdc.status }, newValue: { status: payload.status } })
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to update cheque status.' } }
    }
  }
}
