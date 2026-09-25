import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { supplierLedgerService } from './supplier-ledger.service'
import { generateSequenceNumber } from './sequence.service'
import { computeNoteTotals } from '../../shared/utils/money'
import { getBusinessCurrencyDecimals } from './settings.service'
import { roundCurrency } from './currency.service'
import { ServiceError } from '../errors/service-error'
import { dominantTaxRate, defaultBusinessTaxRate, postDebitNoteJournalTx, noteHasJournalTx, reverseNoteJournalTx } from './note-tax.util'

import { resolveDocumentGstType, supplierStateOf } from './gst-type.util'
export interface DebitNoteItemPayload {
  productId?: string
  serviceDescription?: string
  serviceCategoryId?: string
  quantity: number
  unitPrice: number
  taxRate: number
}

// Phase 63 — relabeled "Vendor Credit" in every user-facing string; kept as
// the existing DebitNote model/service internally, matching this codebase's
// own customerKind-style discriminator convention (a naming decision at the
// UI layer, not a second model).
export interface CreateDebitNotePayload {
  supplierId?: string
  purchaseOrderId?: string
  reason: string
  amount?: number
  items?: DebitNoteItemPayload[]
  // false: no tax on this note (tax 0, total = taxable amount). Unset: itemised notes tax by their lines, plain notes
  // tax only when a taxRate is given.
  taxApplied?: boolean
  // Plain-amount notes only; unset falls back to the linked order's dominant rate, else the business default.
  taxRate?: number
  // Line unit prices already include tax (omitted: inherits the linked PO's setting, else exclusive).
  pricesIncludeTax?: boolean
  gstType?: 'CGST_SGST' | 'IGST' | 'GST'
  notes?: string
}

export interface UpdateDebitNotePayload {
  supplierId?: string | null
  purchaseOrderId?: string | null
  reason?: string
  amount?: number
  taxApplied?: boolean
  taxRate?: number | null
  pricesIncludeTax?: boolean
  notes?: string | null
}

export const debitNoteService = {
  async create(payload: CreateDebitNotePayload, userId: string) {
    const db = getPrisma()

    let linkedIncludesTax = false
    let linkedGstType: string | undefined
    let linkedRate: number | null = null
    if (payload.purchaseOrderId) {
      const po = await db.purchaseOrder.findUnique({ where: { id: payload.purchaseOrderId }, include: { items: true } })
      if (!po) return { success: false, error: { code: 'PO-001', message: 'Purchase order not found.' } }
      linkedIncludesTax = po.pricesIncludeTax === true
      linkedGstType = po.gstType
      linkedRate = dominantTaxRate((po as { items?: Array<{ taxRate?: number }> }).items)
    }
    // The note is presented like the order it corrects unless told otherwise; else from the supplier's state.
    const gstType = await resolveDocumentGstType(payload.gstType ?? linkedGstType, await supplierStateOf(payload.supplierId))
    const pricesIncludeTax = payload.pricesIncludeTax ?? linkedIncludesTax

    // Phase 63 - Account-based line items. Same "server recomputes, never
    // trusts a parallel scalar" discipline as credit-note.service.ts's own
    // identical change.
    const decimals = await getBusinessCurrencyDecimals()
    const itemised = !!payload.items && payload.items.length > 0
    const taxApplied = payload.taxApplied ?? (itemised ? true : (payload.taxRate ?? 0) > 0)
    const plainRate = itemised || !taxApplied ? null : (payload.taxRate ?? linkedRate ?? await defaultBusinessTaxRate())
    const noteTotals = computeNoteTotals({ items: itemised ? payload.items : undefined, amount: payload.amount, taxApplied, taxRate: plainRate, pricesIncludeTax, decimals })
    const lineRows = itemised
      ? payload.items!.map((item, idx) => ({ item, taxAmount: noteTotals.lines[idx].tax, lineTotal: noteTotals.lines[idx].total }))
      : null
    const computedAmount = noteTotals.totalAmount

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
          amount: computedAmount,
          pricesIncludeTax: itemised || taxApplied ? pricesIncludeTax : false,
          gstType,
          taxApplied,
          taxRate: noteTotals.taxRate,
          taxAmount: noteTotals.taxAmount,
          notes: payload.notes ?? null,
          createdBy: userId,
          ...(lineRows && {
            items: {
              create: lineRows.map(({ item, taxAmount, lineTotal }) => ({
                productId: item.productId || null,
                serviceDescription: item.serviceDescription || null,
                serviceCategoryId: item.serviceCategoryId || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate,
                taxAmount,
                lineTotal
              }))
            }
          })
        },
        include: { supplier: true, purchaseOrder: true, items: true }
      })

      // Debit note reduces what we owe the supplier — via the shared ledger
      // service, same balance computation (aggregate SUM) used everywhere else.
      if (payload.supplierId) {
        await supplierLedgerService.addEntry({
          supplierId: payload.supplierId,
          referenceType: 'DEBIT_NOTE',
          referenceId: created.id,
          debitAmount: computedAmount,
          creditAmount: 0,
          remarks: `Debit Note ${debitNoteNumber}: ${payload.reason}`
        }, tx)
      }

      await postDebitNoteJournalTx(tx, { id: created.id, debitNoteNumber, amount: computedAmount })

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
        include: { supplier: true, purchaseOrder: true, items: true },
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
      include: { supplier: true, purchaseOrder: true, items: { include: { product: { select: { productName: true } } } } }
    })
    if (!dn) return { success: false, error: { code: 'DN-001', message: 'Debit note not found.' } }
    return { success: true, data: dn }
  },

  async update(id: string, payload: UpdateDebitNotePayload, userId: string) {
    const db = getPrisma()
    const dp = await getBusinessCurrencyDecimals()

    if (payload.purchaseOrderId) {
      const po = await db.purchaseOrder.findUnique({ where: { id: payload.purchaseOrderId } })
      if (!po) return { success: false, error: { code: 'PO-001', message: 'Purchase order not found.' } }
    }

    let existingSnapshot: { id: string; debitNoteNumber: string; supplierId: string | null; amount: number; reason: string } | null = null

    const updated = await db.$transaction(async (tx) => {
      // Lookup must happen INSIDE the transaction — see credit-note.service.ts's
      // update() for why (mirrors the same fix already applied there, and the
      // established precedent in billing.service.ts's cancelInvoice).
      const existing = await tx.debitNote.findUnique({ where: { id }, include: { items: true } })
      if (!existing) throw new Error('DN-001')
      existingSnapshot = existing

      const newSupplierId = payload.supplierId !== undefined ? payload.supplierId : existing.supplierId
      const existingLines = (existing as { items?: Array<{ id: string; quantity: number; unitPrice: number; taxRate: number }> }).items ?? []
      const wasApplied = (existing as { taxApplied?: boolean }).taxApplied ?? false
      const existingTax = (existing as { taxAmount?: number }).taxAmount ?? 0
      const newApplied = payload.taxApplied ?? wasApplied
      const newIncl = payload.pricesIncludeTax ?? (existing as { pricesIncludeTax?: boolean }).pricesIncludeTax === true
      const taxTouched = payload.taxApplied !== undefined || payload.taxRate !== undefined || payload.pricesIncludeTax !== undefined
      let newAmount = existing.amount
      let newTaxAmount = existingTax
      let newTaxRate = (existing as { taxRate?: number | null }).taxRate ?? null
      let itemUpdates: Array<{ id: string; taxAmount: number; lineTotal: number }> = []
      if (existingLines.length > 0) {
        if (payload.amount !== undefined && payload.amount !== existing.amount) {
          throw new ServiceError('DN-005', 'This debit note has lines, so its amount follows them and cannot be typed over.')
        }
        if (taxTouched) {
          const t = computeNoteTotals({ items: existingLines, taxApplied: newApplied, pricesIncludeTax: newIncl, decimals: dp })
          newAmount = t.totalAmount
          newTaxAmount = t.taxAmount
          itemUpdates = existingLines.map((l, i) => ({ id: l.id, taxAmount: t.lines[i].tax, lineTotal: t.lines[i].total }))
        }
      } else if (payload.amount !== undefined || taxTouched) {
        const stored = wasApplied ? ((existing as { pricesIncludeTax?: boolean }).pricesIncludeTax === true ? existing.amount : roundCurrency(existing.amount - existingTax, dp)) : existing.amount
        if (newApplied) newTaxRate = payload.taxRate ?? newTaxRate ?? await defaultBusinessTaxRate()
        else if (payload.taxRate !== undefined) newTaxRate = payload.taxRate
        const t = computeNoteTotals({ amount: payload.amount ?? stored, taxApplied: newApplied, taxRate: newTaxRate, pricesIncludeTax: newIncl, decimals: dp })
        newAmount = t.totalAmount
        newTaxAmount = t.taxAmount
      }
      // Ledger only needs touching if the party or the amount actually changes —
      // a reason/notes-only edit has no financial effect.
      const ledgerAffected = newSupplierId !== existing.supplierId || newAmount !== existing.amount

      const result = await tx.debitNote.update({
        where: { id },
        data: {
          ...(payload.supplierId !== undefined ? { supplierId: payload.supplierId } : {}),
          ...(payload.purchaseOrderId !== undefined ? { purchaseOrderId: payload.purchaseOrderId } : {}),
          ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
          ...(newAmount !== existing.amount ? { amount: newAmount } : {}),
          ...(taxTouched || newTaxAmount !== existingTax ? { taxApplied: newApplied, taxAmount: newTaxAmount, taxRate: newTaxRate, pricesIncludeTax: newIncl } : {}),
          ...(payload.notes !== undefined ? { notes: payload.notes } : {})
        },
        include: { supplier: true, purchaseOrder: true, items: true }
      })
      for (const u of itemUpdates) await tx.debitNoteItem.update({ where: { id: u.id }, data: { taxAmount: u.taxAmount, lineTotal: u.lineTotal } })

      if ((newAmount !== existing.amount || newTaxAmount !== existingTax) && await noteHasJournalTx(tx, 'DEBIT_NOTE', id)) {
        await reverseNoteJournalTx(tx, 'DEBIT_NOTE', id, `Debit Note ${existing.debitNoteNumber} edited`, userId)
        await postDebitNoteJournalTx(tx, { id, debitNoteNumber: existing.debitNoteNumber, amount: newAmount })
      }

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
      if (e instanceof ServiceError) return e
      throw e
    })

    if (!updated) return { success: false, error: { code: 'DN-001', message: 'Debit note not found.' } }
    if (updated instanceof ServiceError) return { success: false, error: { code: updated.code, message: updated.message } }

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
      await reverseNoteJournalTx(tx, 'DEBIT_NOTE', id, `Debit Note ${dn.debitNoteNumber} voided`, userId)
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
