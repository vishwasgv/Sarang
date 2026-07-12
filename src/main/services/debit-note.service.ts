import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { supplierLedgerService } from './supplier-ledger.service'
import { generateSequenceNumber } from './sequence.service'

export interface CreateDebitNotePayload {
  supplierId?: string
  purchaseOrderId?: string
  reason: string
  amount: number
  notes?: string
}

export interface UpdateDebitNotePayload {
  supplierId?: string | null
  purchaseOrderId?: string | null
  reason?: string
  amount?: number
  notes?: string | null
}

export const debitNoteService = {
  async create(payload: CreateDebitNotePayload, userId: string) {
    const db = getPrisma()

    if (payload.purchaseOrderId) {
      const po = await db.purchaseOrder.findUnique({ where: { id: payload.purchaseOrderId } })
      if (!po) return { success: false, error: { code: 'PO-001', message: 'Purchase order not found.' } }
    }

    const dn = await db.$transaction(async (tx) => {
      // Number generation must happen inside the same transaction as the
      // insert — see sequence.service.ts's header comment for why a plain
      // pre-transaction read is a real race under concurrent creates.
      const debitNoteNumber = await generateSequenceNumber(
        tx, 'debit_note_sequence', 'DN', 5,
        async () => {
          const last = await tx.debitNote.findFirst({ orderBy: { createdAt: 'desc' }, select: { debitNoteNumber: true } })
          return last ? parseInt(last.debitNoteNumber.replace('DN-', ''), 10) : 0
        }
      )

      const created = await tx.debitNote.create({
        data: {
          debitNoteNumber,
          supplierId: payload.supplierId ?? null,
          purchaseOrderId: payload.purchaseOrderId ?? null,
          reason: payload.reason,
          amount: payload.amount,
          notes: payload.notes ?? null,
          createdBy: userId
        },
        include: { supplier: true, purchaseOrder: true }
      })

      // Debit note reduces what we owe the supplier — via the shared ledger
      // service, same balance computation (aggregate SUM) used everywhere else.
      if (payload.supplierId) {
        await supplierLedgerService.addEntry({
          supplierId: payload.supplierId,
          referenceType: 'DEBIT_NOTE',
          referenceId: created.id,
          debitAmount: payload.amount,
          creditAmount: 0,
          remarks: `Debit Note ${debitNoteNumber}: ${payload.reason}`
        }, tx)
      }

      return created
    })

    await logAction({ userId, action: 'CREATE_DEBIT_NOTE', entityType: 'DebitNote', entityId: dn.id, newValue: `${dn.debitNoteNumber} — ${payload.reason}` })
    return { success: true, data: dn }
  },

  async list(params: { supplierId?: string; purchaseOrderId?: string; page?: number; limit?: number }) {
    const db = getPrisma()
    const { supplierId, purchaseOrderId, page = 1, limit = 50 } = params
    const where = {
      ...(supplierId ? { supplierId } : {}),
      ...(purchaseOrderId ? { purchaseOrderId } : {})
    }
    const [debitNotes, total] = await Promise.all([
      db.debitNote.findMany({
        where,
        include: { supplier: true, purchaseOrder: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.debitNote.count({ where })
    ])
    return { success: true, data: { debitNotes, total } }
  },

  async getById(id: string) {
    const db = getPrisma()
    const dn = await db.debitNote.findUnique({
      where: { id },
      include: { supplier: true, purchaseOrder: true }
    })
    if (!dn) return { success: false, error: { code: 'DN-001', message: 'Debit note not found.' } }
    return { success: true, data: dn }
  },

  async update(id: string, payload: UpdateDebitNotePayload, userId: string) {
    const db = getPrisma()

    if (payload.purchaseOrderId) {
      const po = await db.purchaseOrder.findUnique({ where: { id: payload.purchaseOrderId } })
      if (!po) return { success: false, error: { code: 'PO-001', message: 'Purchase order not found.' } }
    }

    let existingSnapshot: { id: string; debitNoteNumber: string; supplierId: string | null; amount: number; reason: string } | null = null

    const updated = await db.$transaction(async (tx) => {
      // Lookup must happen INSIDE the transaction — see credit-note.service.ts's
      // update() for why (mirrors the same fix already applied there, and the
      // established precedent in billing.service.ts's cancelInvoice).
      const existing = await tx.debitNote.findUnique({ where: { id } })
      if (!existing) throw new Error('DN-001')
      existingSnapshot = existing

      const newSupplierId = payload.supplierId !== undefined ? payload.supplierId : existing.supplierId
      const newAmount = payload.amount !== undefined ? payload.amount : existing.amount
      // Ledger only needs touching if the party or the amount actually changes —
      // a reason/notes-only edit has no financial effect.
      const ledgerAffected = newSupplierId !== existing.supplierId || newAmount !== existing.amount

      const result = await tx.debitNote.update({
        where: { id },
        data: {
          ...(payload.supplierId !== undefined ? { supplierId: payload.supplierId } : {}),
          ...(payload.purchaseOrderId !== undefined ? { purchaseOrderId: payload.purchaseOrderId } : {}),
          ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
          ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
          ...(payload.notes !== undefined ? { notes: payload.notes } : {})
        },
        include: { supplier: true, purchaseOrder: true }
      })

      if (ledgerAffected) {
        // Never mutate a posted ledger row — reverse the old effect (on the OLD
        // party) with an opposite entry, then apply the new effect (on the NEW
        // party) as a fresh entry, exactly mirroring delete()'s own reversal.
        if (existing.supplierId) {
          await supplierLedgerService.addEntry({
            supplierId: existing.supplierId,
            referenceType: 'DEBIT_NOTE_EDIT_REVERSAL',
            referenceId: id,
            debitAmount: 0,
            creditAmount: existing.amount,
            remarks: `Edited Debit Note ${existing.debitNoteNumber}: reversing previous amount`
          }, tx)
        }
        if (newSupplierId) {
          await supplierLedgerService.addEntry({
            supplierId: newSupplierId,
            referenceType: 'DEBIT_NOTE',
            referenceId: id,
            debitAmount: newAmount,
            creditAmount: 0,
            remarks: `Edited Debit Note ${existing.debitNoteNumber}: ${payload.reason ?? existing.reason}`
          }, tx)
        }
      }

      return result
    }).catch((e) => {
      if (e instanceof Error && e.message === 'DN-001') return null
      throw e
    })

    if (!updated) return { success: false, error: { code: 'DN-001', message: 'Debit note not found.' } }

    await logAction({ userId, action: 'UPDATE_DEBIT_NOTE', entityType: 'DebitNote', entityId: id, oldValue: existingSnapshot, newValue: updated })
    return { success: true, data: updated }
  },

  async delete(id: string, userId: string) {
    const db = getPrisma()
    let dnNumber: string | null = null

    const deleted = await db.$transaction(async (tx) => {
      // Same TOCTOU concern as update() above — lookup happens inside the
      // transaction, not before it.
      const dn = await tx.debitNote.findUnique({ where: { id } })
      if (!dn) throw new Error('DN-001')
      dnNumber = dn.debitNoteNumber

      // Reverse the ledger effect with a new, opposite entry rather than
      // deleting the original one — see credit-note.service.ts for why.
      if (dn.supplierId) {
        await supplierLedgerService.addEntry({
          supplierId: dn.supplierId,
          referenceType: 'DEBIT_NOTE_VOID',
          referenceId: dn.id,
          debitAmount: 0,
          creditAmount: dn.amount,
          remarks: `Voided Debit Note ${dn.debitNoteNumber}: ${dn.reason}`
        }, tx)
      }
      await tx.debitNote.delete({ where: { id } })
      return true
    }).catch((e) => {
      if (e instanceof Error && e.message === 'DN-001') return null
      throw e
    })

    if (!deleted) return { success: false, error: { code: 'DN-001', message: 'Debit note not found.' } }

    await logAction({ userId, action: 'DELETE_DEBIT_NOTE', entityType: 'DebitNote', entityId: id, newValue: dnNumber })
    return { success: true }
  }
}
