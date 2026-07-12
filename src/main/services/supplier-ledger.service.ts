import { getPrisma } from '../database/db'
import type { ApiResponse } from '../ipc/channels'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

async function calculateBalance(supplierId: string, tx?: TxClient): Promise<number> {
  const db = tx ?? getPrisma()
  const agg = await db.supplierLedger.aggregate({
    where: { supplierId },
    _sum: { debitAmount: true, creditAmount: true }
  })
  return (agg._sum.debitAmount ?? 0) - (agg._sum.creditAmount ?? 0)
}

async function addEntry(
  params: {
    supplierId: string
    referenceType: string
    referenceId?: string
    debitAmount: number
    creditAmount: number
    remarks?: string
  },
  tx?: TxClient
): Promise<void> {
  const db = tx ?? getPrisma()
  const currentBalance = await calculateBalance(params.supplierId, tx)
  const newBalance = currentBalance + params.debitAmount - params.creditAmount
  await db.supplierLedger.create({
    data: {
      supplierId: params.supplierId,
      referenceType: params.referenceType,
      referenceId: params.referenceId ?? null,
      debitAmount: params.debitAmount,
      creditAmount: params.creditAmount,
      balance: newBalance,
      remarks: params.remarks ?? null
    }
  })
}

async function getLedger(supplierId: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const entries = await db.supplierLedger.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
    const outstanding = await calculateBalance(supplierId)
    return { success: true, data: { ledger: entries, outstanding } }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

// Record a manual payment made to a supplier (credit = we owe LESS)
// RULE PM005: records only — never processes or verifies payment
async function recordPayment(params: {
  supplierId: string
  amount: number
  paymentMethod: string
  referenceNumber?: string
  remarks?: string
}, userId?: string): Promise<ApiResponse> {
  try {
    if (!params.supplierId) return { success: false, error: { code: 'SUP-010', message: 'Supplier ID is required.' } }
    if (!params.amount || params.amount <= 0) return { success: false, error: { code: 'SUP-011', message: 'Payment amount must be greater than zero.' } }

    const db = getPrisma()
    const supplier = await db.supplier.findUnique({ where: { id: params.supplierId } })
    if (!supplier) return { success: false, error: { code: 'SUP-012', message: 'Supplier not found.' } }

    // Was the one addEntry call site in the codebase not passing tx — every
    // other caller (billing, returns, credit-note, debit-note, payment,
    // purchase-order, logistics-grn) does. Without it, calculateBalance's
    // aggregate read and the ledger create() run as two separate
    // non-transactional round-trips with no snapshot-isolation protection,
    // so two recordPayment calls close together (double-submitted form, a
    // bulk-payment script) can both read the same base balance and each
    // persist a stored running balance that silently omits the other's
    // effect — printed as-is by generateSupplierLedgerReport's balance column.
    await db.$transaction(async (tx) => {
      await addEntry({
        supplierId: params.supplierId,
        referenceType: 'PAYMENT',
        debitAmount: 0,
        creditAmount: params.amount,
        remarks: [
          `Payment to ${supplier.supplierName}`,
          params.paymentMethod ? `via ${params.paymentMethod}` : null,
          params.referenceNumber ? `Ref: ${params.referenceNumber}` : null,
          params.remarks ?? null
        ].filter(Boolean).join(' | ')
      }, tx)
    })

    // Audit
    const { logAction } = await import('./audit.service')
    await logAction({ userId, action: 'SUPPLIER_PAYMENT_RECORDED', entityType: 'Supplier', entityId: params.supplierId, newValue: { amount: params.amount, paymentMethod: params.paymentMethod } })

    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to record supplier payment.' } }
  }
}

export const supplierLedgerService = { addEntry, calculateBalance, getLedger, recordPayment }
