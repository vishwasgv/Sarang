import { getPrisma } from '../database/db'
import type { ApiResponse } from '../ipc/channels'
import { roundCurrency } from './currency.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

/** Returns outstanding balance = SUM(debit) - SUM(credit). Optionally scoped to a transaction. */
// Real bug found live (core-commerce audit): unlike supplier-ledger.service.ts's
// own calculateBalance (which already routes its result through
// roundCurrency, with a comment explaining exactly why), this one returned
// the raw SUM(debit)-SUM(credit) float unrounded. That value is not just
// display — addEntry() below persists it verbatim as both CustomerLedger.balance
// and, more importantly, the denormalised Customer.outstandingBalance field
// that billing.service.ts's credit-limit enforcement compares directly
// against Customer.creditLimit (`projectedBalance > customer.creditLimit`).
// A float artifact like 15999.999999999998 sitting a hair under an exact
// creditLimit of 16000 would silently let a sale through that should have
// been blocked — a real boundary bug, not a cosmetic one.
async function calculateBalance(customerId: string, tx?: TxClient): Promise<number> {
  const db = tx ?? getPrisma()
  const agg = await db.customerLedger.aggregate({
    where: { customerId },
    _sum: { debitAmount: true, creditAmount: true }
  })
  return roundCurrency((agg._sum.debitAmount ?? 0) - (agg._sum.creditAmount ?? 0))
}

async function addEntry(
  params: {
    customerId: string
    referenceType: string
    referenceId?: string
    debitAmount: number
    creditAmount: number
    remarks?: string
  },
  tx?: TxClient
): Promise<void> {
  const db = tx ?? getPrisma()
  const currentBalance = await calculateBalance(params.customerId, tx)
  const newBalance = roundCurrency(currentBalance + params.debitAmount - params.creditAmount)
  await db.customerLedger.create({
    data: {
      customerId: params.customerId,
      referenceType: params.referenceType,
      referenceId: params.referenceId ?? null,
      debitAmount: params.debitAmount,
      creditAmount: params.creditAmount,
      balance: newBalance,
      remarks: params.remarks ?? null
    }
  })
  // Keep denormalised outstandingBalance in sync so credit limit checks are correct
  await db.customer.update({
    where: { id: params.customerId },
    data: { outstandingBalance: newBalance }
  })
}

/** Paginated ledger entries. Max 200/page. Uses denormalized outstandingBalance for O(1) balance lookup. */
async function getLedger(customerId: string, opts?: { page?: number; limit?: number }): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const page = opts?.page ?? 1
    const limit = Math.min(opts?.limit ?? 50, 200)
    const skip = (page - 1) * limit

    const [entries, total] = await db.$transaction([
      db.customerLedger.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.customerLedger.count({ where: { customerId } })
    ])

    // Use denormalized field for O(1) outstanding balance — avoids SUM over whole ledger
    const customer = await db.customer.findUnique({ where: { id: customerId }, select: { outstandingBalance: true } })
    const outstanding = customer?.outstandingBalance ?? await calculateBalance(customerId)

    return { success: true, data: { ledger: entries, outstanding, total, page, limit } }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export const customerLedgerService = { addEntry, calculateBalance, getLedger }
