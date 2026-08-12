import type { Prisma } from '@prisma/client'
import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import type { CreateChequeBookPayload } from '../validation/cheque-book.validation'

type Tx = Prisma.TransactionClient

// Closes a real gap in Phase 62's own spec (Section 4.1 item 7): "cheque-book
// management... simple cheque-number-sequence tracking per account" was
// promised but never built — only a free-text PostDatedCheque.chequeNumber
// ever shipped. This service is the minimal, already-scoped-down version:
// one or more real number ranges per BankAccount, with nextNumber advanced
// only via consumeNextChequeNumber, always inside the caller's own open
// transaction so a crash mid-create can never skip or double-issue a number.
export const chequeBookService = {
  async createChequeBook(payload: CreateChequeBookPayload, userId?: string) {
    const db = getPrisma()
    try {
      const account = await db.bankAccount.findUnique({ where: { id: payload.bankAccountId } })
      if (!account) return { success: false, error: { code: 'BANK-001', message: 'Bank account not found.' } }

      const overlapping = await db.chequeBook.findFirst({
        where: {
          bankAccountId: payload.bankAccountId,
          isActive: true,
          startNumber: { lte: payload.endNumber },
          endNumber: { gte: payload.startNumber }
        }
      })
      if (overlapping) {
        return { success: false, error: { code: 'CHQ-003', message: `This range overlaps an existing active cheque book (${overlapping.startNumber}-${overlapping.endNumber}).` } }
      }

      const chequeBook = await db.chequeBook.create({
        data: {
          bankAccountId: payload.bankAccountId,
          startNumber: payload.startNumber,
          endNumber: payload.endNumber,
          nextNumber: payload.startNumber
        }
      })

      await logAction({ userId, action: 'CHEQUE_BOOK_CREATED', entityType: 'ChequeBook', entityId: chequeBook.id, newValue: { bankAccountId: chequeBook.bankAccountId, startNumber: chequeBook.startNumber, endNumber: chequeBook.endNumber } })
      return { success: true, data: chequeBook }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create cheque book.' } }
    }
  },

  async listChequeBooks(bankAccountId?: string) {
    try {
      const db = getPrisma()
      const where: Record<string, unknown> = {}
      if (bankAccountId) where.bankAccountId = bankAccountId
      const chequeBooks = await db.chequeBook.findMany({ where, orderBy: { createdAt: 'desc' } })
      return { success: true, data: chequeBooks }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list cheque books.' } }
    }
  },

  // Read-only preview for the UI (e.g. "next cheque will be #100234") — never
  // advances nextNumber itself. Returns null when no active book has numbers
  // remaining, which the caller treats as "fall back to manual entry."
  async getNextChequeNumber(bankAccountId: string) {
    try {
      const db = getPrisma()
      // Prisma can't compare two columns (nextNumber vs. endNumber) in a
      // plain where filter, so the exhausted-range check — and picking the
      // oldest active book that still has room, not just the oldest active
      // book period — is done in application code below.
      const books = await db.chequeBook.findMany({ where: { bankAccountId, isActive: true }, orderBy: { createdAt: 'asc' } })
      const candidate = books.find((b) => b.nextNumber <= b.endNumber)
      if (!candidate) return { success: true, data: null }
      return { success: true, data: { chequeBookId: candidate.id, chequeNumber: String(candidate.nextNumber) } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to compute next cheque number.' } }
    }
  },

  // Must be called from inside the caller's own open transaction (mirrors
  // journalEntryService.postSystemEntry's own tx-first convention) — the
  // increment and the PDC row it's issued for commit or roll back together.
  async consumeNextChequeNumber(tx: Tx, bankAccountId: string): Promise<{ chequeBookId: string; chequeNumber: string } | null> {
    const books = await tx.chequeBook.findMany({ where: { bankAccountId, isActive: true }, orderBy: { createdAt: 'asc' } })
    const book = books.find((b) => b.nextNumber <= b.endNumber)
    if (!book) return null

    const chequeNumber = String(book.nextNumber)
    await tx.chequeBook.update({ where: { id: book.id }, data: { nextNumber: book.nextNumber + 1 } })
    return { chequeBookId: book.id, chequeNumber }
  },

  async setActive(id: string, isActive: boolean, userId?: string) {
    const db = getPrisma()
    try {
      const existing = await db.chequeBook.findUnique({ where: { id } })
      if (!existing) return { success: false, error: { code: 'CHQ-004', message: 'Cheque book not found.' } }
      const updated = await db.chequeBook.update({ where: { id }, data: { isActive } })
      await logAction({ userId, action: 'CHEQUE_BOOK_STATUS_UPDATED', entityType: 'ChequeBook', entityId: id, oldValue: { isActive: existing.isActive }, newValue: { isActive } })
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to update cheque book.' } }
    }
  }
}
