import { getPrisma } from '../database/db'
import { customerLedgerService } from './customer-ledger.service'
import { logAction } from './audit.service'
import { ServiceError } from '../errors/service-error'
import { releaseTablesForInvoiceTx } from './restaurant.service'
import type { RecordPaymentPayload, RecordSplitPaymentPayload, ReversePaymentPayload } from '../validation/payment.validation'

export const paymentService = {
  // RULE PM001: amount > 0 enforced by Zod
  // RULE PM005: records only — never verifies or processes
  async recordPayment(payload: RecordPaymentPayload, userId?: string) {
    const db = getPrisma()

    try {
      const payment = await db.$transaction(async (tx) => {
        // Lookup + balance checks must happen INSIDE the transaction. Reading the
        // invoice beforehand and basing the paidAmount/balanceAmount arithmetic on
        // that stale snapshot left a window where two near-simultaneous payment
        // calls for the same invoice (double-click, two methods recorded at once)
        // could each independently compute a "valid" balance from the same
        // pre-race numbers — corrupting the invoice's recorded balance.
        const invoice = await tx.invoice.findUnique({ where: { id: payload.invoiceId } })
        if (!invoice) throw new ServiceError('INVOC-005', 'Invoice not found.')
        if (invoice.status === 'CANCELLED') {
          throw new ServiceError('PM-001', 'Cannot record payment for a cancelled invoice.')
        }
        if (invoice.balanceAmount <= 0) {
          throw new ServiceError('PM-002', 'This invoice is already fully paid.')
        }
        // RULE PM002: payment cannot exceed outstanding balance
        if (payload.amount > invoice.balanceAmount + 0.01) { // small tolerance for floating point
          throw new ServiceError('PM-003', `Payment amount (${payload.amount.toFixed(2)}) exceeds outstanding balance (${invoice.balanceAmount.toFixed(2)}).`)
        }

        const pmt = await tx.payment.create({
          data: {
            invoiceId: payload.invoiceId,
            customerId: invoice.customerId ?? null,
            paymentMethod: payload.paymentMethod,
            amount: payload.amount,
            referenceNumber: payload.referenceNumber ?? null,
            remarks: payload.remarks ?? null,
            paymentDate: payload.paymentDate ? new Date(payload.paymentDate) : undefined,
            recordedById: userId ?? null
          }
        })

        const newPaidAmount = invoice.paidAmount + payload.amount
        const newBalance = invoice.balanceAmount - payload.amount
        const newPaymentStatus = newBalance <= 0.01 ? 'PAID' : 'PARTIAL'

        await tx.invoice.update({
          where: { id: payload.invoiceId },
          data: {
            paidAmount: newPaidAmount,
            balanceAmount: Math.max(0, newBalance),
            paymentStatus: newPaymentStatus
          }
        })

        // Phase 58 §2 — a restaurant table's currentInvoiceId only ever
        // means "still running an unpaid tab"; the moment that flips to
        // PAID, free the table(s) for the next party in the same
        // transaction that settled the bill.
        if (newPaymentStatus === 'PAID') {
          await releaseTablesForInvoiceTx(tx, payload.invoiceId)
        }

        // Credit customer ledger — they paid this amount
        if (invoice.customerId) {
          await customerLedgerService.addEntry({
            customerId: invoice.customerId,
            referenceType: 'PAYMENT',
            referenceId: pmt.id,
            debitAmount: 0,
            creditAmount: payload.amount,
            remarks: `Payment for Invoice ${invoice.invoiceNumber}`
          }, tx)
        }

        return pmt
      })

      await logAction({ userId, action: 'PAYMENT_RECORDED', entityType: 'Payment', entityId: payment.id, newValue: { invoiceId: payload.invoiceId, amount: payload.amount, method: payload.paymentMethod } })
      return { success: true, data: payment }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      const msg = err instanceof Error ? err.message : 'Failed to record payment.'
      return { success: false, error: { code: 'SYS-001', message: msg } }
    }
  },

  // Atomic split payment — both legs commit or both fail (fixes silent partial failure)
  async recordSplitPayment(payload: RecordSplitPaymentPayload, userId?: string) {
    const db = getPrisma()

    try {
      const payments = await db.$transaction(async (tx) => {
        // Same reasoning as recordPayment — lookup and balance validation must
        // happen inside the transaction, not against a pre-read snapshot.
        const invoice = await tx.invoice.findUnique({ where: { id: payload.invoiceId } })
        if (!invoice) throw new ServiceError('INVOC-005', 'Invoice not found.')
        if (invoice.status === 'CANCELLED') {
          throw new ServiceError('PM-001', 'Cannot record payment for a cancelled invoice.')
        }
        if (invoice.balanceAmount <= 0) {
          throw new ServiceError('PM-002', 'This invoice is already fully paid.')
        }

        const splitTotal = payload.legs.reduce((s, l) => s + l.amount, 0)
        if (Math.abs(splitTotal - invoice.balanceAmount) > 0.05) {
          throw new ServiceError('PM-007', `Split total ${splitTotal.toFixed(2)} must equal outstanding balance ${invoice.balanceAmount.toFixed(2)}.`)
        }

        const created = []
        for (const leg of payload.legs) {
          const pmt = await tx.payment.create({
            data: {
              invoiceId: payload.invoiceId,
              customerId: invoice.customerId ?? null,
              paymentMethod: leg.paymentMethod,
              amount: leg.amount,
              referenceNumber: leg.referenceNumber ?? null,
              recordedById: userId ?? null
            }
          })
          created.push(pmt)

          if (invoice.customerId) {
            await customerLedgerService.addEntry({
              customerId: invoice.customerId,
              referenceType: 'PAYMENT',
              referenceId: pmt.id,
              debitAmount: 0,
              creditAmount: leg.amount,
              remarks: `Split payment for Invoice ${invoice.invoiceNumber}`
            }, tx)
          }
        }

        await tx.invoice.update({
          where: { id: payload.invoiceId },
          data: {
            paidAmount: invoice.paidAmount + splitTotal,
            balanceAmount: 0,
            paymentStatus: 'PAID'
          }
        })

        // Phase 58 §2 — see the same call in recordPayment above.
        await releaseTablesForInvoiceTx(tx, payload.invoiceId)

        return created
      })

      for (const p of payments) {
        await logAction({ userId, action: 'PAYMENT_RECORDED', entityType: 'Payment', entityId: p.id, newValue: { invoiceId: payload.invoiceId, amount: p.amount, method: p.paymentMethod } })
      }
      return { success: true, data: payments }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      const msg = err instanceof Error ? err.message : 'Failed to record split payment.'
      return { success: false, error: { code: 'SYS-001', message: msg } }
    }
  },

  // RULE PM004: reversal requires audit log
  async reversePayment(payload: ReversePaymentPayload, userId?: string) {
    const db = getPrisma()

    try {
      await db.$transaction(async (tx) => {
        // Lookup + guard checks inside the transaction — same TOCTOU class as
        // recordPayment: reading the payment/invoice beforehand and reversing
        // the stale snapshot's amounts could double-reverse under a race.
        const payment = await tx.payment.findUnique({ where: { id: payload.paymentId }, include: { invoice: true } })
        if (!payment) throw new ServiceError('PM-004', 'Payment not found.')
        if (payment.isReversed) throw new ServiceError('PM-005', 'This payment has already been reversed.')
        if (payment.invoice.status === 'CANCELLED') {
          throw new ServiceError('PM-006', 'Cannot reverse payment on a cancelled invoice.')
        }

        await tx.payment.update({ where: { id: payload.paymentId }, data: { isReversed: true, reversalReason: payload.reason } })

        const newPaidAmount = Math.max(0, payment.invoice.paidAmount - payment.amount)
        const newBalance = payment.invoice.balanceAmount + payment.amount
        const newPaymentStatus = newPaidAmount <= 0.01 ? 'UNPAID' : 'PARTIAL'

        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: { paidAmount: newPaidAmount, balanceAmount: newBalance, paymentStatus: newPaymentStatus }
        })

        // Debit customer ledger to reverse the credit
        if (payment.customerId) {
          await customerLedgerService.addEntry({
            customerId: payment.customerId,
            referenceType: 'PAYMENT_REVERSAL',
            referenceId: payload.paymentId,
            debitAmount: payment.amount,
            creditAmount: 0,
            remarks: `Reversal: ${payload.reason} (Invoice ${payment.invoice.invoiceNumber})`
          }, tx)
        }
      })

      await logAction({ userId, action: 'PAYMENT_REVERSED', entityType: 'Payment', entityId: payload.paymentId, newValue: { reason: payload.reason } })
      return { success: true }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      const msg = err instanceof Error ? err.message : 'Failed to reverse payment.'
      return { success: false, error: { code: 'SYS-001', message: msg } }
    }
  },

  async getPayments(filters?: {
    invoiceId?: string; customerId?: string; method?: string
    dateFrom?: string; dateTo?: string; search?: string
    page?: number; limit?: number
  }) {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 50
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters?.invoiceId) where.invoiceId = filters.invoiceId
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.method) where.paymentMethod = filters.method
    // Filter/sort by paymentDate (the date the payment actually happened —
    // explicitly indexed for this in the schema), not createdAt (when the
    // record was data-entered). They're identical for normal same-day entry,
    // but diverge for a backdated payment, and paymentDate is the field that
    // means "when did this payment happen" for reporting purposes.
    if (filters?.dateFrom || filters?.dateTo) {
      where.paymentDate = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo + 'T23:59:59.999') } : {})
      }
    }
    if (filters?.search) {
      where.OR = [
        { referenceNumber: { contains: filters.search } },
        { invoice: { invoiceNumber: { contains: filters.search } } },
        { customer: { customerName: { contains: filters.search } } }
      ]
    }

    const [payments, total] = await db.$transaction([
      db.payment.findMany({
        where,
        include: {
          invoice: { select: { id: true, invoiceNumber: true, totalAmount: true } },
          customer: { select: { id: true, customerName: true } },
          recordedBy: { select: { id: true, fullName: true } }
        },
        orderBy: { paymentDate: 'desc' },
        skip,
        take: limit
      }),
      db.payment.count({ where })
    ])

    return { success: true, data: { payments, total } }
  }
}
