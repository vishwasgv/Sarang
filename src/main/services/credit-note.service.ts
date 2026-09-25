import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'
import { customerLedgerService } from './customer-ledger.service'
import { generateSequenceNumber } from './sequence.service'
import { computeNoteTotals } from '../../shared/utils/money'
import { dominantTaxRate, defaultBusinessTaxRate, postCreditNoteJournalTx, noteHasJournalTx, reverseNoteJournalTx } from './note-tax.util'
import { getBusinessCurrencyDecimals } from './settings.service'
import { roundCurrency, moneyEpsilon } from './currency.service'

import { resolveDocumentGstType, customerStateOf } from './gst-type.util'
export interface CreditNoteItemPayload {
  productId?: string
  serviceDescription?: string
  serviceCategoryId?: string
  quantity: number
  unitPrice: number
  taxRate: number
}

export interface CreateCreditNotePayload {
  customerId?: string
  invoiceId?: string
  reason: string
  amount?: number
  items?: CreditNoteItemPayload[]
  // false: no tax on this note (tax 0, total = taxable amount). Unset: itemised notes tax by their lines, plain notes
  // tax only when a taxRate is given.
  taxApplied?: boolean
  // Plain-amount notes only; unset falls back to the linked invoice's dominant rate, else the business default.
  taxRate?: number
  // Line unit prices already include tax (omitted: inherits the linked invoice's setting, else exclusive).
  pricesIncludeTax?: boolean
  gstType?: 'CGST_SGST' | 'IGST' | 'GST'
  notes?: string
}

export interface UpdateCreditNotePayload {
  customerId?: string | null
  invoiceId?: string | null
  reason?: string
  amount?: number
  taxApplied?: boolean
  taxRate?: number | null
  pricesIncludeTax?: boolean
  notes?: string | null
}

export const creditNoteService = {
  async create(payload: CreateCreditNotePayload, userId: string) {
    const db = getPrisma()

    let linkedIncludesTax = false
    let linkedGstType: string | undefined
    let linkedRate: number | null = null
    if (payload.invoiceId) {
      const inv = await db.invoice.findUnique({ where: { id: payload.invoiceId }, include: { items: true } })
      if (!inv) return { success: false, error: { code: 'INV-001', message: 'Invoice not found.' } }
      linkedIncludesTax = inv.pricesIncludeTax === true
      linkedGstType = inv.gstType
      linkedRate = dominantTaxRate((inv as { items?: Array<{ taxRate?: number }> }).items)
    }
    // The note is presented like the invoice it corrects unless told otherwise; else from the customer's state.
    const gstType = await resolveDocumentGstType(payload.gstType ?? linkedGstType, await customerStateOf(payload.customerId))
    const pricesIncludeTax = payload.pricesIncludeTax ?? linkedIncludesTax

    // Phase 63 — Account-based line items. When items are provided, amount
    // is always the computed sum of the lines, never trusted from whatever
    // the caller separately sent — same "server recomputes, never trusts a
    // parallel scalar" discipline as Expense's own mileage amount.
    const decimals = await getBusinessCurrencyDecimals()
    const itemised = !!payload.items && payload.items.length > 0
    const taxApplied = payload.taxApplied ?? (itemised ? true : (payload.taxRate ?? 0) > 0)
    const plainRate = itemised || !taxApplied ? null : (payload.taxRate ?? linkedRate ?? await defaultBusinessTaxRate())
    const noteTotals = computeNoteTotals({ items: itemised ? payload.items : undefined, amount: payload.amount, taxApplied, taxRate: plainRate, pricesIncludeTax, decimals })
    const lineRows = itemised
      ? payload.items!.map((item, idx) => ({ item, taxAmount: noteTotals.lines[idx].tax, lineTotal: noteTotals.lines[idx].total }))
      : null
    const computedAmount = noteTotals.totalAmount

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
        include: { customer: true, invoice: true, items: true }
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
          creditAmount: computedAmount,
          remarks: `Credit Note ${creditNoteNumber}: ${payload.reason}`
        }, tx)
      }

      await postCreditNoteJournalTx(tx, { id: created.id, creditNoteNumber, amount: computedAmount, taxAmount: noteTotals.taxAmount })

      // Real bug found live (2026-07-28 core-commerce audit): a credit note
      // linked to an invoice used to only ever touch the Customer Ledger,
      // never the invoice's own balanceAmount/paymentStatus — so
      // generateOutstandingReport (report.service.ts, which sums
      // invoice.balanceAmount directly, not CustomerLedger) kept showing the
      // full original balance owed even after a credit note reduced what the
      // customer actually owes, and a cashier could still collect the full
      // original amount via recordPayment (which validates against
      // invoice.balanceAmount). Mirrors returns.service.ts's own identical
      // fix for the same class of desync — capped at the invoice's current
      // balance; any excess becomes a general customer credit via the ledger
      // entry above, not a negative invoice balance.
      if (payload.invoiceId) {
        const currentInvoice = await tx.invoice.findUniqueOrThrow({
          where: { id: payload.invoiceId },
          select: { balanceAmount: true, paymentStatus: true }
        })
        if (currentInvoice.balanceAmount > 0) {
          const appliedToInvoice = Math.min(currentInvoice.balanceAmount, computedAmount)
          const newBalance = roundCurrency(currentInvoice.balanceAmount - appliedToInvoice, decimals)
          await tx.invoice.update({
            where: { id: payload.invoiceId },
            data: {
              balanceAmount: newBalance,
              paymentStatus: newBalance <= moneyEpsilon(decimals) ? 'PAID' : currentInvoice.paymentStatus
            }
          })
          // Persisted so update()/delete() can reverse exactly this figure
          // later, not the full `amount` — see the field's own schema comment.
          await tx.creditNote.update({ where: { id: created.id }, data: { appliedToInvoiceAmount: appliedToInvoice } })
        }
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
        include: { customer: true, invoice: true, items: true },
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
      include: { customer: true, invoice: true, items: { include: { product: { select: { productName: true } } } } }
    })
    if (!cn) return { success: false, error: { code: 'CN-001', message: 'Credit note not found.' } }
    return { success: true, data: cn }
  },

  async update(id: string, payload: UpdateCreditNotePayload, userId: string) {
    const db = getPrisma()
    const dp = await getBusinessCurrencyDecimals()

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
      const existing = await tx.creditNote.findUnique({ where: { id }, include: { items: true } })
      if (!existing) throw new Error('CN-001')
      existingSnapshot = existing

      const newCustomerId = payload.customerId !== undefined ? payload.customerId : existing.customerId
      // Tax fields: notes made before tax could be skipped carry taxApplied from their migration (true only when
      // they had tax), so an edit keeps behaving exactly as before unless the caller changes them.
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
          throw new ServiceError('CN-005', 'This credit note has lines, so its amount follows them and cannot be typed over.')
        }
        if (taxTouched) {
          const t = computeNoteTotals({ items: existingLines, taxApplied: newApplied, pricesIncludeTax: newIncl, decimals: dp })
          newAmount = t.totalAmount
          newTaxAmount = t.taxAmount
          itemUpdates = existingLines.map((l, i) => ({ id: l.id, taxAmount: t.lines[i].tax, lineTotal: t.lines[i].total }))
        }
      } else if (payload.amount !== undefined || taxTouched) {
        // The entered amount: taxable when prices exclude tax, the tax-inclusive amount when they include it.
        const stored = wasApplied ? ((existing as { pricesIncludeTax?: boolean }).pricesIncludeTax === true ? existing.amount : roundCurrency(existing.amount - existingTax, dp)) : existing.amount
        if (newApplied) newTaxRate = payload.taxRate ?? newTaxRate ?? await defaultBusinessTaxRate()
        else if (payload.taxRate !== undefined) newTaxRate = payload.taxRate
        const t = computeNoteTotals({ amount: payload.amount ?? stored, taxApplied: newApplied, taxRate: newTaxRate, pricesIncludeTax: newIncl, decimals: dp })
        newAmount = t.totalAmount
        newTaxAmount = t.taxAmount
        if (!newApplied) newTaxRate = payload.taxRate ?? newTaxRate
      }
      const newInvoiceId = payload.invoiceId !== undefined ? payload.invoiceId : existing.invoiceId
      // Ledger only needs touching if the party or the amount actually changes —
      // a reason/notes-only edit has no financial effect.
      const ledgerAffected = newCustomerId !== existing.customerId || newAmount !== existing.amount
      // Invoice-side balance (see create()'s comment) needs the same
      // reverse-old / apply-new treatment whenever the linked invoice or the
      // amount changes — independent of whether the ledger's customer party
      // changed, since the invoice being credited can differ from who the
      // ledger credit lands on.
      const invoiceEffectAffected = newInvoiceId !== existing.invoiceId || newAmount !== existing.amount

      const result = await tx.creditNote.update({
        where: { id },
        data: {
          ...(payload.customerId !== undefined ? { customerId: payload.customerId } : {}),
          ...(payload.invoiceId !== undefined ? { invoiceId: payload.invoiceId } : {}),
          ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
          ...(newAmount !== existing.amount ? { amount: newAmount } : {}),
          ...(taxTouched || newTaxAmount !== existingTax ? { taxApplied: newApplied, taxAmount: newTaxAmount, taxRate: newTaxRate, pricesIncludeTax: newIncl } : {}),
          ...(payload.notes !== undefined ? { notes: payload.notes } : {})
        },
        include: { customer: true, invoice: true, items: true }
      })
      for (const u of itemUpdates) await tx.creditNoteItem.update({ where: { id: u.id }, data: { taxAmount: u.taxAmount, lineTotal: u.lineTotal } })

      // Notes that already carry a journal entry are re-posted for the new figures (notes from before postings
      // existed have none and stay that way, so an edit never invents a posting for a document that had none).
      if ((newAmount !== existing.amount || newTaxAmount !== existingTax) && await noteHasJournalTx(tx, 'CREDIT_NOTE', id)) {
        await reverseNoteJournalTx(tx, 'CREDIT_NOTE', id, `Credit Note ${existing.creditNoteNumber} edited`, userId)
        await postCreditNoteJournalTx(tx, { id, creditNoteNumber: existing.creditNoteNumber, amount: newAmount, taxAmount: newTaxAmount })
      }

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

      // Same reverse-old / apply-new treatment for the invoice-side balance
      // (see create()'s comment for why this field needs touching at all).
      if (invoiceEffectAffected) {
        if (existing.invoiceId) {
          const oldInv = await tx.invoice.findUniqueOrThrow({
            where: { id: existing.invoiceId },
            select: { balanceAmount: true, totalAmount: true, paidAmount: true }
          })
          // Reverse exactly what was actually applied at creation/last-edit
          // time (persisted on the row), not the full `amount` — `amount`
          // can exceed what create()/this same block actually applied,
          // since that's capped at the invoice's balance at the time. See
          // the appliedToInvoiceAmount field's own schema comment.
          const restoredBalance = Math.min(oldInv.totalAmount, roundCurrency(oldInv.balanceAmount + (existing.appliedToInvoiceAmount ?? existing.amount), dp))
          await tx.invoice.update({
            where: { id: existing.invoiceId },
            data: {
              balanceAmount: restoredBalance,
              paymentStatus: restoredBalance <= moneyEpsilon(dp) ? 'PAID' : (oldInv.paidAmount > moneyEpsilon(dp) ? 'PARTIAL' : 'UNPAID')
            }
          })
        }
        let newAppliedToInvoice: number | null = null
        if (newInvoiceId) {
          const newInv = await tx.invoice.findUniqueOrThrow({
            where: { id: newInvoiceId },
            select: { balanceAmount: true, paymentStatus: true }
          })
          if (newInv.balanceAmount > 0) {
            newAppliedToInvoice = Math.min(newInv.balanceAmount, newAmount)
            const newBalance = roundCurrency(newInv.balanceAmount - newAppliedToInvoice, dp)
            await tx.invoice.update({
              where: { id: newInvoiceId },
              data: {
                balanceAmount: newBalance,
                paymentStatus: newBalance <= moneyEpsilon(dp) ? 'PAID' : newInv.paymentStatus
              }
            })
          }
        }
        await tx.creditNote.update({ where: { id }, data: { appliedToInvoiceAmount: newAppliedToInvoice } })
      }

      return result
    }).catch((e) => {
      if (e instanceof Error && e.message === 'CN-001') return null
      if (e instanceof ServiceError) return e
      throw e
    })

    if (!updated) return { success: false, error: { code: 'CN-001', message: 'Credit note not found.' } }
    if (updated instanceof ServiceError) return { success: false, error: { code: updated.code, message: updated.message } }

    await logAction({ userId, action: 'UPDATE_CREDIT_NOTE', entityType: 'CreditNote', entityId: id, oldValue: existingSnapshot, newValue: updated })
    return { success: true, data: updated }
  },

  async delete(id: string, userId: string) {
    const db = getPrisma()
    const dp = await getBusinessCurrencyDecimals()
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
      // Restore the invoice-side balance this credit note had reduced (see
      // create()'s matching comment) — capped at the invoice's totalAmount
      // so voiding a credit note can never inflate its balance past what was
      // originally billed.
      if (cn.invoiceId) {
        const inv = await tx.invoice.findUniqueOrThrow({
          where: { id: cn.invoiceId },
          select: { balanceAmount: true, totalAmount: true, paidAmount: true }
        })
        // Reverse exactly what was actually applied, not the full `amount`
        // — see appliedToInvoiceAmount's own schema comment (mirrors update()'s
        // identical fix).
        const restoredBalance = Math.min(inv.totalAmount, roundCurrency(inv.balanceAmount + (cn.appliedToInvoiceAmount ?? cn.amount), dp))
        await tx.invoice.update({
          where: { id: cn.invoiceId },
          data: {
            balanceAmount: restoredBalance,
            paymentStatus: restoredBalance <= moneyEpsilon(dp) ? 'PAID' : (inv.paidAmount > moneyEpsilon(dp) ? 'PARTIAL' : 'UNPAID')
          }
        })
      }
      await reverseNoteJournalTx(tx, 'CREDIT_NOTE', id, `Credit Note ${cn.creditNoteNumber} voided`, userId)
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
