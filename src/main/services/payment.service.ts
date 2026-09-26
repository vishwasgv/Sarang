import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { customerLedgerService } from './customer-ledger.service'
import { logAction } from './audit.service'
import { ServiceError } from '../errors/service-error'
import { releaseTablesForInvoiceTx } from './restaurant.service'
import { roundCurrency, moneyEpsilon } from './currency.service'
import { getBusinessCurrencyDecimals } from './settings.service'
import { assertNotLockedOrThrow } from './transaction-lock.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService, reverseEntryBySourceTx } from './journal-entry.service'
import { writeOffSplitShortfallTx } from './split-payment-rounding.util'
import { reversePaymentJournalTx } from './payment-reversal-journal.util'
import type { RecordPaymentPayload, RecordForeignCurrencySettlementPayload, RecordSplitPaymentPayload, ReversePaymentPayload } from '../validation/payment.validation'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Phase 62 — GL auto-posting: a customer payment moves cash in, reduces
// what they owe. Debit Cash & Bank / Credit Accounts Receivable.
async function postPaymentJournalEntry(tx: TxClient, params: { paymentId: string; invoiceNumber: string; amount: number; tds?: boolean }): Promise<void> {
  if (params.amount <= 0) return
  // A TDS deduction settles the invoice like a payment, but no money arrives: the tax kept back becomes a receivable from the tax department.
  const [cashAccount, arAccount] = await Promise.all([
    params.tds ? chartOfAccountsService.getOrCreateSystemAccountByCode('1310', tx) : chartOfAccountsService.getSystemAccountByCode('1000', tx),
    chartOfAccountsService.getSystemAccountByCode('1100', tx)
  ])
  await journalEntryService.postSystemEntry(tx, {
    sourceType: 'PAYMENT', sourceId: params.paymentId, narration: params.tds ? `TDS deducted by customer on Invoice ${params.invoiceNumber}` : `Payment for Invoice ${params.invoiceNumber}`,
    lines: [
      { accountId: cashAccount.id, bankAccountId: null, debitAmount: params.amount, creditAmount: 0 },
      { accountId: arAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: params.amount }
    ]
  })
}

// 2026-09 — realized FX gain/loss on fully settling a foreign-currency
// invoice at a different rate than it was raised at. Deliberately a
// SEPARATE function from recordPayment above, not an extra branch inside
// it: recordPayment's existing amount/balance math (RULE PM002, partial
// payments, split payments) is unchanged and untouched by this feature —
// every non-foreign-currency invoice, and even a foreign-currency invoice
// paid the plain way, behaves exactly as before. This path is opt-in, only
// for a foreign-currency invoice (foreignCurrencyCode set) being settled IN
// FULL via its own foreign currency.
//
// The two-branch split below isn't arbitrary — it's the actual double-entry
// difference between the two directions:
//   - Rate moved favorably (settlementRate > invoice's own rate): the bank
//     genuinely received MORE base-currency value than the invoice's book
//     value — the excess is real cash the normal payment posting doesn't
//     account for (Dr Cash excess / Cr Realized FX Gain excess), on top of
//     the invoice's own book value being cleared as a normal payment.
//   - Rate moved unfavorably: the bank received LESS than book value, but
//     the foreign-currency obligation is still fully discharged — the
//     shortfall is uncollectible book value being written off, which comes
//     out of Accounts Receivable, not Cash (Dr Realized FX Loss shortfall /
//     Cr Accounts Receivable shortfall) — no cash was ever going to arrive
//     for that portion.
async function recordForeignCurrencySettlement(
  payload: RecordForeignCurrencySettlementPayload,
  userId?: string
) {
  const db = getPrisma()
  const dp = await getBusinessCurrencyDecimals()
  try {
    const payment = await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: payload.invoiceId } })
      if (!invoice) throw new ServiceError('INVOC-005', 'Invoice not found.')
      if (invoice.status === 'CANCELLED') throw new ServiceError('PM-001', 'Cannot record payment for a cancelled invoice.')
      if (!invoice.foreignCurrencyCode || invoice.foreignExchangeRate == null) {
        throw new ServiceError('PM-008', 'This invoice was not raised in a foreign currency.')
      }
      const balanceBefore = invoice.balanceAmount
      if (balanceBefore <= 0) throw new ServiceError('PM-002', 'This invoice is already fully paid.')

      const resolvedPaymentDate = payload.paymentDate ? parsePaymentDate(payload.paymentDate) : new Date()
      await assertNotLockedOrThrow(tx, resolvedPaymentDate)

      const computedBaseAmount = roundCurrency(payload.foreignAmount * payload.settlementRate, dp)
      const appliedAmount = Math.min(computedBaseAmount, balanceBefore)

      const pmt = await tx.payment.create({
        data: {
          invoiceId: payload.invoiceId,
          customerId: invoice.customerId ?? null,
          paymentMethod: payload.paymentMethod,
          amount: appliedAmount,
          referenceNumber: payload.referenceNumber ?? null,
          remarks: payload.remarks ?? null,
          paymentDate: resolvedPaymentDate,
          recordedById: userId ?? null,
          foreignCurrencyCode: invoice.foreignCurrencyCode,
          foreignAmount: payload.foreignAmount,
          foreignExchangeRate: payload.settlementRate
        }
      })

      // This invoice is being settled IN FULL via its foreign-currency
      // amount — balanceAmount always reaches exactly zero here, regardless
      // of which direction the rate moved (the gain/loss postings below
      // account for the difference, whichever side it lands on). paidAmount
      // absorbs the full old balance (not just appliedAmount) to preserve
      // the paidAmount + balanceAmount = totalAmount invariant every other
      // report relies on — see this function's own header comment for why
      // a write-off is still considered "paid" for that purpose.
      await tx.invoice.update({
        where: { id: payload.invoiceId },
        data: { paidAmount: roundCurrency(invoice.paidAmount + balanceBefore, dp), balanceAmount: 0, paymentStatus: 'PAID' }
      })

      if (invoice.customerId) {
        await customerLedgerService.addEntry({
          customerId: invoice.customerId,
          referenceType: 'PAYMENT',
          referenceId: pmt.id,
          debitAmount: 0,
          creditAmount: balanceBefore,
          remarks: `Foreign-currency settlement for Invoice ${invoice.invoiceNumber}`
        }, tx)
      }

      await postPaymentJournalEntry(tx, { paymentId: pmt.id, invoiceNumber: invoice.invoiceNumber, amount: appliedAmount })

      const gainLoss = roundCurrency(computedBaseAmount - balanceBefore, dp)
      if (Math.abs(gainLoss) >= Math.pow(10, -dp) - 1e-12) {
        const fxAccount = await chartOfAccountsService.getOrCreateSystemAccountByCode('4200', tx)
        const isGain = gainLoss > 0
        const magnitude = Math.abs(gainLoss)
        if (isGain) {
          const cashAccount = await chartOfAccountsService.getSystemAccountByCode('1000', tx)
          await journalEntryService.postSystemEntry(tx, {
            sourceType: 'REALIZED_FX_GAIN_LOSS', sourceId: pmt.id,
            narration: `Realized gain on Invoice ${invoice.invoiceNumber} settlement (rate ${invoice.foreignExchangeRate} → ${payload.settlementRate})`,
            lines: [
              { accountId: cashAccount.id, bankAccountId: null, debitAmount: magnitude, creditAmount: 0 },
              { accountId: fxAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: magnitude }
            ]
          })
        } else {
          const arAccount = await chartOfAccountsService.getSystemAccountByCode('1100', tx)
          await journalEntryService.postSystemEntry(tx, {
            sourceType: 'REALIZED_FX_GAIN_LOSS', sourceId: pmt.id,
            narration: `Realized loss on Invoice ${invoice.invoiceNumber} settlement (rate ${invoice.foreignExchangeRate} → ${payload.settlementRate})`,
            lines: [
              { accountId: fxAccount.id, bankAccountId: null, debitAmount: magnitude, creditAmount: 0 },
              { accountId: arAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: magnitude }
            ]
          })
        }
      }

      return pmt
    })

    await logAction({
      userId, action: 'PAYMENT_RECORDED', entityType: 'Payment', entityId: payment.id,
      newValue: { invoiceId: payload.invoiceId, foreignAmount: payload.foreignAmount, settlementRate: payload.settlementRate, method: payload.paymentMethod }
    })
    return { success: true, data: payment }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    const msg = err instanceof Error ? err.message : 'Failed to record foreign-currency settlement.'
    return { success: false, error: { code: 'SYS-001', message: msg } }
  }
}

// Real bug found live (core-commerce audit): `new Date(payload.paymentDate)`
// below parsed a bare date-only "YYYY-MM-DD" string (exactly what a
// backdated-payment date picker sends) as UTC midnight, not local midnight —
// the same class of bug already fixed across ~15 other files in this app
// (see date.util.ts's own header comments). Currently unreached by the
// shipped UI (no screen sets paymentDate today), but the IPC payload schema
// accepts any string and this is exactly the shape a future caller (or a
// direct IPC call) would send, so it's fixed the same way as every sibling
// date-only field: date-only strings route through parseLocalDateStart,
// anything else (a full ISO timestamp) parses as-is.
function parsePaymentDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseLocalDateStart(value) : new Date(value)
}

export const paymentService = {
  recordForeignCurrencySettlement,

  // RULE PM001: amount > 0 enforced by Zod
  // RULE PM005: records only — never verifies or processes
  async recordPayment(payload: RecordPaymentPayload, userId?: string, opts?: { tds?: boolean }) {
    const db = getPrisma()
    const dp = await getBusinessCurrencyDecimals()

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
        if (payload.amount > invoice.balanceAmount + moneyEpsilon(dp)) { // small tolerance for floating point
          throw new ServiceError('PM-003', `Payment amount (${payload.amount.toFixed(dp)}) exceeds outstanding balance (${invoice.balanceAmount.toFixed(dp)}).`)
        }

        await assertNotLockedOrThrow(tx, payload.paymentDate ? parsePaymentDate(payload.paymentDate) : new Date())

        const pmt = await tx.payment.create({
          data: {
            invoiceId: payload.invoiceId,
            customerId: invoice.customerId ?? null,
            paymentMethod: opts?.tds ? 'TDS' : payload.paymentMethod,
            amount: payload.amount,
            referenceNumber: payload.referenceNumber ?? null,
            remarks: payload.remarks ?? null,
            paymentDate: payload.paymentDate ? parsePaymentDate(payload.paymentDate) : undefined,
            recordedById: userId ?? null
          }
        })

        // Real bug found live (core-commerce audit): plain `+`/`-` on
        // paidAmount/balanceAmount — this is running-balance ledger
        // arithmetic on an invoice that can receive several partial payments
        // over time (each one re-adding its own float error on top of
        // whatever the previous payment already left), the exact pattern
        // this scope's own audit brief calls out for special scrutiny.
        // Routed through roundCurrency, matching every other money
        // computation in this file's sibling services.
        const newPaidAmount = roundCurrency(invoice.paidAmount + payload.amount, dp)
        const newBalance = roundCurrency(invoice.balanceAmount - payload.amount, dp)
        const newPaymentStatus = newBalance <= moneyEpsilon(dp) ? 'PAID' : 'PARTIAL'

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
            remarks: opts?.tds ? `TDS deducted on Invoice ${invoice.invoiceNumber}` : `Payment for Invoice ${invoice.invoiceNumber}`
          }, tx)
        }

        // Phase 62 — GL auto-posting.
        await postPaymentJournalEntry(tx, { paymentId: pmt.id, invoiceNumber: invoice.invoiceNumber, amount: payload.amount, tds: opts?.tds })

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

  /** Records tax the customer kept back when paying (TDS): reduces the invoice balance without any money arriving. */
  async recordTdsDeduction(payload: { invoiceId: string; amount: number; paymentDate?: string; remarks?: string; referenceNumber?: string }, userId?: string) {
    return paymentService.recordPayment({ ...payload, paymentMethod: 'CASH' }, userId, { tds: true })
  },

  // Atomic split payment — both legs commit or both fail (fixes silent partial failure)
  async recordSplitPayment(payload: RecordSplitPaymentPayload, userId?: string) {
    const db = getPrisma()
    const dp = await getBusinessCurrencyDecimals()

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

        const splitTotal = roundCurrency(payload.legs.reduce((s, l) => s + l.amount, 0), dp)
        if (Math.abs(splitTotal - invoice.balanceAmount) > (dp >= 3 ? 0.005 : 0.05)) {
          throw new ServiceError('PM-007', `Split total ${splitTotal.toFixed(dp)} must equal outstanding balance ${invoice.balanceAmount.toFixed(dp)}.`)
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

          // Phase 62 — GL auto-posting: one JournalEntry per leg, same
          // sourceType/sourceId shape as recordPayment's single-payment case.
          await postPaymentJournalEntry(tx, { paymentId: pmt.id, invoiceNumber: invoice.invoiceNumber, amount: leg.amount })
        }

        await writeOffSplitShortfallTx(tx, invoice, roundCurrency(invoice.balanceAmount - splitTotal, dp))

        // paidAmount credits the invoice for its full actual balanceAmount, not
        // the entered splitTotal — the PM-007 check above already tolerates up
        // to 5 paise of mismatch between them as "close enough to call paid".
        // Crediting splitTotal instead (as this used to) while forcing
        // balanceAmount to 0 let that tolerated mismatch quietly vanish: no
        // journal entry, no ledger trail, paidAmount + balanceAmount permanently
        // short of (or over) totalAmount by a few paise. Using balanceAmount
        // here keeps the books exact while preserving the same tolerance.
        await tx.invoice.update({
          where: { id: payload.invoiceId },
          data: {
            paidAmount: roundCurrency(invoice.paidAmount + invoice.balanceAmount, dp),
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
    const dp = await getBusinessCurrencyDecimals()

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
        await assertNotLockedOrThrow(tx, payment.paymentDate)

        // Phase 62 — GL auto-posting: reverse the original payment's JournalEntry.
        await reversePaymentJournalTx(tx, payment, payment.invoice.invoiceNumber, `Payment reversed: ${payload.reason}`, userId)

        // Real bug found in this audit: recordForeignCurrencySettlement's
        // Payment.amount is the APPLIED amount, not necessarily the full
        // invoice balance it discharged — in the loss case it wrote off the
        // shortfall straight out of Accounts Receivable via a separate
        // REALIZED_FX_GAIN_LOSS entry (sourceId: payment.id, a different
        // sourceType from the reversal right above, so it was never reached
        // by it). A plain reversal using only payment.amount both left that
        // FX entry permanently un-reversed AND restored too little balance
        // (silently writing off the shortfall a second time, forever). The
        // FX entry's own AR line carries exactly the missing amount, so it's
        // recoverable here without a schema change.
        let restoreAmount = payment.amount
        if (payment.foreignCurrencyCode) {
          const fxEntry = await tx.journalEntry.findFirst({ where: { sourceType: 'REALIZED_FX_GAIN_LOSS', sourceId: payment.id, isReversed: false }, include: { lines: true } })
          if (fxEntry) {
            const arAccount = await chartOfAccountsService.getSystemAccountByCode('1100', tx)
            const arLine = fxEntry.lines.find((l) => l.accountId === arAccount.id && l.creditAmount > 0)
            if (arLine) restoreAmount = roundCurrency(restoreAmount + arLine.creditAmount, dp)
            await reverseEntryBySourceTx(tx, 'REALIZED_FX_GAIN_LOSS', payment.id, `Payment reversed: ${payload.reason} (Invoice ${payment.invoice.invoiceNumber})`, userId)
          }
        }

        await tx.payment.update({ where: { id: payload.paymentId }, data: { isReversed: true, reversalReason: payload.reason } })

        const newPaidAmount = Math.max(0, roundCurrency(payment.invoice.paidAmount - restoreAmount, dp))
        const newBalance = roundCurrency(payment.invoice.balanceAmount + restoreAmount, dp)
        const newPaymentStatus = newPaidAmount <= moneyEpsilon(dp) ? 'UNPAID' : 'PARTIAL'

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
            debitAmount: restoreAmount,
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
      // BUG FOUND 2026-07-22: gte used to be new Date(filters.dateFrom),
      // parsed as UTC midnight instead of local midnight.
      where.paymentDate = {
        ...(filters.dateFrom ? { gte: parseLocalDateStart(filters.dateFrom) } : {}),
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
