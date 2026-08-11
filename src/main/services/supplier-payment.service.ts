import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { supplierLedgerService } from './supplier-ledger.service'
import { logAction } from './audit.service'
import { ServiceError } from '../errors/service-error'
import { roundCurrency } from './currency.service'
import { assertNotLockedOrThrow } from './transaction-lock.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService, reverseEntryBySourceTx } from './journal-entry.service'
import type { RecordSupplierPaymentPayload, ReverseSupplierPaymentPayload, RecordBulkSupplierPaymentPayload } from '../validation/supplier-payment.validation'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Same date-only-string-parses-as-UTC-midnight class already fixed across
// ~15 files — see payment.service.ts's own parsePaymentDate for the exact
// precedent this mirrors.
function parsePaymentDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseLocalDateStart(value) : new Date(value)
}

// Phase 62 — GL auto-posting: paying a vendor reduces what we owe them.
// Debit Accounts Payable for the full settlement amount; credit Cash & Bank
// for the actual cash paid out and TDS Payable for whatever was withheld
// instead (tdsAmount, defaulting to 0) — the two credits always sum to the
// same debit, so this balances by construction regardless of tdsAmount.
async function postSupplierPaymentJournalEntry(tx: TxClient, params: { paymentId: string; billNumber: string; amount: number; tdsAmount: number }): Promise<void> {
  if (params.amount <= 0) return
  const [apAccount, cashAccount] = await Promise.all([
    chartOfAccountsService.getSystemAccountByCode('2000', tx),
    chartOfAccountsService.getSystemAccountByCode('1000', tx)
  ])
  const netCash = roundCurrency(params.amount - params.tdsAmount)
  const lines = [{ accountId: apAccount.id, bankAccountId: null, debitAmount: params.amount, creditAmount: 0 }]
  if (netCash > 0) lines.push({ accountId: cashAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: netCash })
  if (params.tdsAmount > 0) {
    const tdsAccount = await chartOfAccountsService.getSystemAccountByCode('2200', tx)
    lines.push({ accountId: tdsAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: params.tdsAmount })
  }
  await journalEntryService.postSystemEntry(tx, { sourceType: 'SUPPLIER_PAYMENT', sourceId: params.paymentId, narration: `Payment for Bill ${params.billNumber}`, lines })
}

// Phase 62 — TDS threshold + rate, configurable (Setting-backed, same
// pattern as billing.service.ts's own max_discount_percent/
// allow_negative_inventory), not hardcoded to one statutory section's
// figures. Defaults (₹30,000 / 10%) match the most common real-world case
// (Section 194J professional/technical fees) as a sensible starting point —
// an owner whose vendors fall under a different section (194C contractors,
// 194H commission, etc.) reconfigures these two Settings, not code.
async function getTdsConfig(): Promise<{ thresholdAmount: number; ratePercent: number }> {
  const db = getPrisma()
  const rows = await db.setting.findMany({ where: { settingKey: { in: ['tds_threshold_amount', 'tds_rate_percent'] } } })
  const map = new Map(rows.map((r) => [r.settingKey, r.settingValue]))
  const threshold = parseFloat(map.get('tds_threshold_amount') ?? '')
  const rate = parseFloat(map.get('tds_rate_percent') ?? '')
  return {
    thresholdAmount: Number.isFinite(threshold) && threshold >= 0 ? threshold : 30000,
    ratePercent: Number.isFinite(rate) && rate >= 0 ? rate : 10
  }
}

// Exposed so the UI can suggest a TDS amount as soon as the owner enters a
// payment amount — always a suggestion the owner can override, never
// silently applied, since TDS applicability genuinely depends on facts
// (vendor PAN status, cumulative payments already made this year, exemption
// certificates) this app doesn't track.
async function suggestTds(amount: number): Promise<{ applicable: boolean; suggestedAmount: number; thresholdAmount: number; ratePercent: number }> {
  const { thresholdAmount, ratePercent } = await getTdsConfig()
  const applicable = amount >= thresholdAmount
  return { applicable, suggestedAmount: applicable ? roundCurrency(amount * ratePercent / 100) : 0, thresholdAmount, ratePercent }
}

// Phase 61 — "Payments Made" against a specific Bill, distinct from
// supplierLedgerService.recordPayment (an ad-hoc payment against a
// supplier's overall balance, not tied to any one bill). Both post to the
// same SupplierLedger so the outstanding-balance figure stays correct
// regardless of which path was used; this one additionally pays down a
// specific Bill's balanceAmount, mirroring paymentService.recordPayment's
// relationship to Invoice.
export const supplierPaymentService = {
  async suggestTds(amount: number) {
    try {
      return { success: true, data: await suggestTds(amount) }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to compute TDS suggestion.' } }
    }
  },

  async recordSupplierPayment(payload: RecordSupplierPaymentPayload, userId?: string) {
    const db = getPrisma()

    try {
      const payment = await db.$transaction(async (tx) => {
        // Lookup + balance checks inside the transaction — same TOCTOU class
        // payment.service.ts's recordPayment guards against: two
        // near-simultaneous payments against the same bill must not both
        // read the same pre-race balance.
        const bill = await tx.bill.findUnique({ where: { id: payload.billId } })
        if (!bill) throw new ServiceError('BILL-002', 'Bill not found.')
        if (bill.status === 'VOID') {
          throw new ServiceError('SPM-001', 'Cannot record payment for a void bill.')
        }
        if (bill.balanceAmount <= 0) {
          throw new ServiceError('SPM-002', 'This bill is already fully paid.')
        }
        if (payload.amount > bill.balanceAmount + 0.01) {
          throw new ServiceError('SPM-003', `Payment amount (${payload.amount.toFixed(2)}) exceeds outstanding balance (${bill.balanceAmount.toFixed(2)}).`)
        }
        // Phase 62 — TDS withheld is still part of the full settlement amount
        // (the vendor's bill is discharged in full: partly by cash, partly by
        // the withheld amount being remitted to the tax authority instead),
        // so it can never exceed the payment amount it's withheld from.
        if (payload.tdsAmount > payload.amount) {
          throw new ServiceError('SPM-007', 'TDS amount cannot exceed the payment amount.')
        }

        const resolvedPaymentDate = payload.paymentDate ? parsePaymentDate(payload.paymentDate) : new Date()
        await assertNotLockedOrThrow(tx, resolvedPaymentDate)

        const pmt = await tx.supplierPayment.create({
          data: {
            billId: payload.billId,
            supplierId: bill.supplierId,
            paymentMethod: payload.paymentMethod,
            amount: payload.amount,
            referenceNumber: payload.referenceNumber ?? null,
            remarks: payload.remarks ?? null,
            paymentDate: resolvedPaymentDate,
            recordedById: userId ?? null,
            tdsAmount: payload.tdsAmount,
            tdsSection: payload.tdsSection ?? null
          }
        })

        const newPaidAmount = roundCurrency(bill.paidAmount + payload.amount)
        const newBalance = roundCurrency(bill.balanceAmount - payload.amount)
        const newStatus = newBalance <= 0.01 ? 'PAID' : 'PARTIALLY_PAID'

        await tx.bill.update({
          where: { id: payload.billId },
          data: { paidAmount: newPaidAmount, balanceAmount: Math.max(0, newBalance), status: newStatus }
        })

        // Credit supplier ledger — we owe less
        await supplierLedgerService.addEntry({
          supplierId: bill.supplierId,
          referenceType: 'BILL_PAYMENT',
          referenceId: pmt.id,
          debitAmount: 0,
          creditAmount: payload.amount,
          remarks: `Payment for Bill ${bill.billNumber}`
        }, tx)

        // Phase 62 — GL auto-posting.
        await postSupplierPaymentJournalEntry(tx, { paymentId: pmt.id, billNumber: bill.billNumber, amount: payload.amount, tdsAmount: payload.tdsAmount })

        return pmt
      })

      await logAction({ userId, action: 'SUPPLIER_PAYMENT_RECORDED', entityType: 'SupplierPayment', entityId: payment.id, newValue: { billId: payload.billId, amount: payload.amount, method: payload.paymentMethod } })
      return { success: true, data: payment }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      const msg = err instanceof Error ? err.message : 'Failed to record supplier payment.'
      return { success: false, error: { code: 'SYS-001', message: msg } }
    }
  },

  // Phase 61 Section 3.5 — one payment run split across several of the same
  // supplier's open Bills, atomically (all-or-nothing, mirroring
  // paymentService.recordSplitPayment's shape — there it's one invoice
  // split across payment methods, here it's one payment method split
  // across bills, but the "everything commits together or nothing does"
  // guarantee is the same).
  async recordBulkPayment(payload: RecordBulkSupplierPaymentPayload, userId?: string) {
    const db = getPrisma()

    try {
      const payments = await db.$transaction(async (tx) => {
        await assertNotLockedOrThrow(tx, new Date())
        const created: Awaited<ReturnType<typeof tx.supplierPayment.create>>[] = []
        for (const alloc of payload.allocations) {
          // Lookup + validation inside the transaction, same TOCTOU-avoidance
          // reasoning as recordSupplierPayment above — every bill in this
          // batch is re-read fresh, not trusted from a pre-race snapshot.
          const bill = await tx.bill.findUnique({ where: { id: alloc.billId } })
          if (!bill) throw new ServiceError('BILL-002', 'Bill not found.')
          if (bill.supplierId !== payload.supplierId) {
            throw new ServiceError('SPM-006', `Bill ${bill.billNumber} does not belong to the selected supplier.`)
          }
          if (bill.status === 'VOID') {
            throw new ServiceError('SPM-001', `Cannot record payment for void bill ${bill.billNumber}.`)
          }
          if (alloc.amount > bill.balanceAmount + 0.01) {
            throw new ServiceError('SPM-003', `Payment amount (${alloc.amount.toFixed(2)}) exceeds outstanding balance (${bill.balanceAmount.toFixed(2)}) for bill ${bill.billNumber}.`)
          }

          const pmt = await tx.supplierPayment.create({
            data: {
              billId: alloc.billId,
              supplierId: payload.supplierId,
              paymentMethod: payload.paymentMethod,
              amount: alloc.amount,
              referenceNumber: payload.referenceNumber ?? null,
              remarks: payload.remarks ?? null,
              recordedById: userId ?? null
            }
          })
          created.push(pmt)

          const newPaidAmount = roundCurrency(bill.paidAmount + alloc.amount)
          const newBalance = roundCurrency(bill.balanceAmount - alloc.amount)
          const newStatus = newBalance <= 0.01 ? 'PAID' : 'PARTIALLY_PAID'

          await tx.bill.update({
            where: { id: alloc.billId },
            data: { paidAmount: newPaidAmount, balanceAmount: Math.max(0, newBalance), status: newStatus }
          })

          await supplierLedgerService.addEntry({
            supplierId: payload.supplierId,
            referenceType: 'BILL_PAYMENT',
            referenceId: pmt.id,
            debitAmount: 0,
            creditAmount: alloc.amount,
            remarks: `Bulk payment for Bill ${bill.billNumber}`
          }, tx)

          // Phase 62 — GL auto-posting: one JournalEntry per allocation,
          // same sourceType/sourceId shape as the single-payment case. Bulk
          // payment has no TDS field of its own (see this schema's own
          // scope), so tdsAmount is always 0 here.
          await postSupplierPaymentJournalEntry(tx, { paymentId: pmt.id, billNumber: bill.billNumber, amount: alloc.amount, tdsAmount: 0 })
        }
        return created
      })

      for (const p of payments) {
        await logAction({ userId, action: 'SUPPLIER_PAYMENT_RECORDED', entityType: 'SupplierPayment', entityId: p.id, newValue: { billId: p.billId, amount: p.amount, method: p.paymentMethod } })
      }
      return { success: true, data: payments }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      const msg = err instanceof Error ? err.message : 'Failed to record bulk supplier payment.'
      return { success: false, error: { code: 'SYS-001', message: msg } }
    }
  },

  async reverseSupplierPayment(payload: ReverseSupplierPaymentPayload, userId?: string) {
    const db = getPrisma()

    try {
      await db.$transaction(async (tx) => {
        const payment = await tx.supplierPayment.findUnique({ where: { id: payload.paymentId }, include: { bill: true } })
        if (!payment) throw new ServiceError('SPM-004', 'Payment not found.')
        if (payment.isReversed) throw new ServiceError('SPM-005', 'This payment has already been reversed.')
        await assertNotLockedOrThrow(tx, payment.paymentDate)

        // Phase 62 — GL auto-posting: reverse the original payment's JournalEntry.
        await reverseEntryBySourceTx(tx, 'SUPPLIER_PAYMENT', payment.id, `Payment reversed: ${payload.reason} (Bill ${payment.bill.billNumber})`, userId)

        await tx.supplierPayment.update({ where: { id: payload.paymentId }, data: { isReversed: true, reversalReason: payload.reason } })

        const newPaidAmount = Math.max(0, roundCurrency(payment.bill.paidAmount - payment.amount))
        const newBalance = roundCurrency(payment.bill.balanceAmount + payment.amount)
        const newStatus = newPaidAmount <= 0.01 ? 'OPEN' : 'PARTIALLY_PAID'

        await tx.bill.update({
          where: { id: payment.billId },
          data: { paidAmount: newPaidAmount, balanceAmount: newBalance, status: newStatus }
        })

        // Debit supplier ledger to reverse the credit
        if (payment.supplierId) {
          await supplierLedgerService.addEntry({
            supplierId: payment.supplierId,
            referenceType: 'BILL_PAYMENT_REVERSAL',
            referenceId: payload.paymentId,
            debitAmount: payment.amount,
            creditAmount: 0,
            remarks: `Reversal: ${payload.reason} (Bill ${payment.bill.billNumber})`
          }, tx)
        }
      })

      await logAction({ userId, action: 'SUPPLIER_PAYMENT_REVERSED', entityType: 'SupplierPayment', entityId: payload.paymentId, newValue: { reason: payload.reason } })
      return { success: true }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      const msg = err instanceof Error ? err.message : 'Failed to reverse supplier payment.'
      return { success: false, error: { code: 'SYS-001', message: msg } }
    }
  },

  async getSupplierPayments(filters?: {
    billId?: string; supplierId?: string; method?: string
    dateFrom?: string; dateTo?: string; search?: string
    page?: number; limit?: number
  }) {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 50
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters?.billId) where.billId = filters.billId
    if (filters?.supplierId) where.supplierId = filters.supplierId
    if (filters?.method) where.paymentMethod = filters.method
    if (filters?.dateFrom || filters?.dateTo) {
      where.paymentDate = {
        ...(filters.dateFrom ? { gte: parseLocalDateStart(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo + 'T23:59:59.999') } : {})
      }
    }
    if (filters?.search) {
      where.OR = [
        { referenceNumber: { contains: filters.search } },
        { bill: { billNumber: { contains: filters.search } } },
        { supplier: { supplierName: { contains: filters.search } } }
      ]
    }

    const [payments, total] = await db.$transaction([
      db.supplierPayment.findMany({
        where,
        include: {
          bill: { select: { id: true, billNumber: true, totalAmount: true } },
          supplier: { select: { id: true, supplierName: true } },
          recordedBy: { select: { id: true, fullName: true } }
        },
        orderBy: { paymentDate: 'desc' },
        skip,
        take: limit
      }),
      db.supplierPayment.count({ where })
    ])

    return { success: true, data: { payments, total } }
  }
}
