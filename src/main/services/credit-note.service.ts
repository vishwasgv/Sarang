import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { customerLedgerService } from './customer-ledger.service'
import { generateSequenceNumber } from './sequence.service'

export interface CreateCreditNotePayload {
  customerId?: string
  invoiceId?: string
  reason: string
  amount: number
  notes?: string
}

export interface UpdateCreditNotePayload {
  customerId?: string | null
  invoiceId?: string | null
  reason?: string
  amount?: number
  notes?: string | null
}

export const creditNoteService = {
  async create(payload: CreateCreditNotePayload, userId: string) {
    const db = getPrisma()

    if (payload.invoiceId) {
      const inv = await db.invoice.findUnique({ where: { id: payload.invoiceId } })
      if (!inv) return { success: false, error: { code: 'INV-001', message: 'Invoice not found.' } }
    }

    const cn = await db.$transaction(async (tx) => {
      // Number generation must happen inside the same transaction as the
      // insert — see sequence.service.ts's header comment for why a plain
      // pre-transaction read is a real race under concurrent creates.
      const creditNoteNumber = await generateSequenceNumber(
        tx, 'credit_note_sequence', 'CN', 5,
        async () => {
          const last = await tx.creditNote.findFirst({ orderBy: { createdAt: 'desc' }, select: { creditNoteNumber: true } })
          return last ? parseInt(last.creditNoteNumber.replace('CN-', ''), 10) : 0
        }
      )

      const created = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          customerId: payload.customerId ?? null,
          invoiceId: payload.invoiceId ?? null,
          reason: payload.reason,
          amount: payload.amount,
          notes: payload.notes ?? null,
          createdBy: userId
        },
        include: { customer: true, invoice: true }
      })

      // Update customer ledger and outstanding balance via the shared ledger
      // service — same balance computation (aggregate SUM, not a running
      // lastEntry.balance) used everywhere else, so it can never drift from
      // the customer's actual outstandingBalance.
      if (payload.customerId) {
        await customerLedgerService.addEntry({
          customerId: payload.customerId,
          referenceType: 'CREDIT_NOTE',
          referenceId: created.id,
          debitAmount: 0,
          creditAmount: payload.amount,
          remarks: `Credit Note ${creditNoteNumber}: ${payload.reason}`
        }, tx)
      }

      return created
    })

    await logAction({ userId, action: 'CREATE_CREDIT_NOTE', entityType: 'CreditNote', entityId: cn.id, newValue: `${cn.creditNoteNumber} — ${payload.reason}` })
    return { success: true, data: cn }
  },

  async list(params: { customerId?: string; invoiceId?: string; page?: number; limit?: number }) {
    const db = getPrisma()
    const { customerId, invoiceId, page = 1, limit = 50 } = params
    const where = {
      ...(customerId ? { customerId } : {}),
      ...(invoiceId ? { invoiceId } : {})
    }
    const [creditNotes, total] = await Promise.all([
      db.creditNote.findMany({
        where,
        include: { customer: true, invoice: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.creditNote.count({ where })
    ])
    return { success: true, data: { creditNotes, total } }
  },

  async getById(id: string) {
    const db = getPrisma()
    const cn = await db.creditNote.findUnique({
      where: { id },
      include: { customer: true, invoice: true }
    })
    if (!cn) return { success: false, error: { code: 'CN-001', message: 'Credit note not found.' } }
    return { success: true, data: cn }
  },

  async update(id: string, payload: UpdateCreditNotePayload, userId: string) {
    const db = getPrisma()

    if (payload.invoiceId) {
      const inv = await db.invoice.findUnique({ where: { id: payload.invoiceId } })
      if (!inv) return { success: false, error: { code: 'INV-001', message: 'Invoice not found.' } }
    }

    let existingSnapshot: { id: string; creditNoteNumber: string; customerId: string | null; amount: number; reason: string } | null = null

    const updated = await db.$transaction(async (tx) => {
      // Lookup must happen INSIDE the transaction — reading the row beforehand and
      // using that snapshot for the reversal math left a window where two concurrent
      // update() calls on the same credit note could both read the same pre-edit
      // amount/customerId and each post a reversal against it, double-reversing the
      // ledger. Same bug class already fixed once in billing.service.ts's
      // cancelInvoice — mirroring that fix here.
      const existing = await tx.creditNote.findUnique({ where: { id } })
      if (!existing) throw new Error('CN-001')
      existingSnapshot = existing

      const newCustomerId = payload.customerId !== undefined ? payload.customerId : existing.customerId
      const newAmount = payload.amount !== undefined ? payload.amount : existing.amount
      // Ledger only needs touching if the party or the amount actually changes —
      // a reason/notes-only edit has no financial effect.
      const ledgerAffected = newCustomerId !== existing.customerId || newAmount !== existing.amount

      const result = await tx.creditNote.update({
        where: { id },
        data: {
          ...(payload.customerId !== undefined ? { customerId: payload.customerId } : {}),
          ...(payload.invoiceId !== undefined ? { invoiceId: payload.invoiceId } : {}),
          ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
          ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
          ...(payload.notes !== undefined ? { notes: payload.notes } : {})
        },
        include: { customer: true, invoice: true }
      })

      if (ledgerAffected) {
        // Never mutate a posted ledger row — reverse the old effect (on the OLD
        // party) with an opposite entry, then apply the new effect (on the NEW
        // party) as a fresh entry, exactly mirroring delete()'s own reversal.
        if (existing.customerId) {
          await customerLedgerService.addEntry({
            customerId: existing.customerId,
            referenceType: 'CREDIT_NOTE_EDIT_REVERSAL',
            referenceId: id,
            debitAmount: existing.amount,
            creditAmount: 0,
            remarks: `Edited Credit Note ${existing.creditNoteNumber}: reversing previous amount`
          }, tx)
        }
        if (newCustomerId) {
          await customerLedgerService.addEntry({
            customerId: newCustomerId,
            referenceType: 'CREDIT_NOTE',
            referenceId: id,
            debitAmount: 0,
            creditAmount: newAmount,
            remarks: `Edited Credit Note ${existing.creditNoteNumber}: ${payload.reason ?? existing.reason}`
          }, tx)
        }
      }

      return result
    }).catch((e) => {
      if (e instanceof Error && e.message === 'CN-001') return null
      throw e
    })

    if (!updated) return { success: false, error: { code: 'CN-001', message: 'Credit note not found.' } }

    await logAction({ userId, action: 'UPDATE_CREDIT_NOTE', entityType: 'CreditNote', entityId: id, oldValue: existingSnapshot, newValue: updated })
    return { success: true, data: updated }
  },

  async delete(id: string, userId: string) {
    const db = getPrisma()
    let cnNumber: string | null = null

    const deleted = await db.$transaction(async (tx) => {
      // Same TOCTOU concern as update() above — lookup happens inside the
      // transaction, not before it, so a concurrent update()/delete() on the same
      // row can't race against a stale snapshot.
      const cn = await tx.creditNote.findUnique({ where: { id } })
      if (!cn) throw new Error('CN-001')
      cnNumber = cn.creditNoteNumber

      // Reverse the ledger effect with a new, opposite entry rather than
      // deleting the original one — deleting the credit note must not
      // silently leave the customer's balance permanently reduced, but a
      // reversal (not erasure) keeps the ledger's own audit trail intact.
      if (cn.customerId) {
        await customerLedgerService.addEntry({
          customerId: cn.customerId,
          referenceType: 'CREDIT_NOTE_VOID',
          referenceId: cn.id,
          debitAmount: cn.amount,
          creditAmount: 0,
          remarks: `Voided Credit Note ${cn.creditNoteNumber}: ${cn.reason}`
        }, tx)
      }
      await tx.creditNote.delete({ where: { id } })
      return true
    }).catch((e) => {
      if (e instanceof Error && e.message === 'CN-001') return null
      throw e
    })

    if (!deleted) return { success: false, error: { code: 'CN-001', message: 'Credit note not found.' } }

    await logAction({ userId, action: 'DELETE_CREDIT_NOTE', entityType: 'CreditNote', entityId: id, newValue: cnNumber })
    return { success: true }
  }
}
