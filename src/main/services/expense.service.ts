import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { parseLocalDateStart, toLocalDateOnlyIso } from '../utils/date.util'
import { sumCurrency, roundCurrency } from './currency.service'
import { assertNotLocked } from './transaction-lock.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService, reverseEntryBySourceTx } from './journal-entry.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Phase 62 — GL auto-posting: an expense is money going straight out.
// Debit Operating Expenses / Credit Cash & Bank.
async function postExpenseJournalEntry(tx: TxClient, params: { expenseId: string; expenseName: string; amount: number }): Promise<void> {
  if (params.amount <= 0) return
  const [expenseAccount, cashAccount] = await Promise.all([
    chartOfAccountsService.getSystemAccountByCode('6000', tx),
    chartOfAccountsService.getSystemAccountByCode('1000', tx)
  ])
  await journalEntryService.postSystemEntry(tx, {
    sourceType: 'EXPENSE', sourceId: params.expenseId, narration: `Expense: ${params.expenseName}`,
    lines: [
      { accountId: expenseAccount.id, bankAccountId: null, debitAmount: params.amount, creditAmount: 0 },
      { accountId: cashAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: params.amount }
    ]
  })
}

// Phase 61 — when both a mileage distance and a rate/km are given, the
// amount is derived from them rather than trusted as a separately-typed
// number, so the two can never silently disagree (e.g. a form that shows
// "12 km x Rs 12/km = Rs 144" but a stale amount field still holding an
// earlier manual value). Amount stays authoritative when mileage fields are
// absent — the common, non-mileage expense case.
function resolveAmount(payload: { amount: number; mileageKm?: number; mileageRatePerKm?: number }): number {
  if (payload.mileageKm != null && payload.mileageRatePerKm != null) {
    return roundCurrency(payload.mileageKm * payload.mileageRatePerKm)
  }
  return payload.amount
}

// BUG FOUND 2026-07-28 (reports/settings/HR/security/licensing/master-data
// audit pass): Expense.expenseDate is a non-nullable Prisma DateTime.
// Two separate real bugs here, both in this file:
//
// 1. Read side (serialization): createExpense/updateExpense/listExpenses all
//    returned the raw Prisma row, so `expenseDate` crossed the IPC boundary
//    as a real Date instance (structured clone preserves Date, it doesn't
//    coerce it to a string) — but ExpensesScreen.tsx's openEdit() does
//    `exp.expenseDate.slice(0, 10)`, assuming a string. Opening Edit on any
//    expense record threw `TypeError: exp.expenseDate.slice is not a
//    function` and crashed the modal.
// 2. Write side (timezone): createExpense/updateExpense wrote
//    `new Date(payload.expenseDate)` on the bare "YYYY-MM-DD" string
//    `<input type="date">` sends, which the ECMAScript spec parses as UTC
//    midnight rather than local midnight — inconsistent with this very file's
//    own listExpenses/getExpenseSummary, which correctly build local midnight
//    via `new Date(dateStr + 'T00:00:00')`. For any timezone behind UTC this
//    silently shifted a newly-created expense's stored date back one
//    calendar day. parseLocalDateStart (write) / toLocalDateOnlyIso (read)
//    match the rest of this codebase's established fix for this exact bug
//    class — see date.util.ts's own header comments.
function serializeExpenseDate<T extends { expenseDate: Date }>(row: T): Omit<T, 'expenseDate'> & { expenseDate: string } {
  return { ...row, expenseDate: toLocalDateOnlyIso(row.expenseDate) }
}

export interface ExpensePayload {
  categoryId: string
  expenseName: string
  amount: number
  expenseDate?: string
  paymentMethod?: string
  remarks?: string
  supplierId?: string
  mileageKm?: number
  mileageRatePerKm?: number
  billableCustomerId?: string
  isReverseCharge?: boolean
}

export interface UpdateExpensePayload extends ExpensePayload {
  id: string
}

export async function listExpenses(params?: {
  categoryId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}) {
  try {
    const db = getPrisma()
    const page = params?.page ?? 1
    const limit = Math.min(params?.limit ?? 50, 200)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (params?.categoryId) where.categoryId = params.categoryId
    if (params?.dateFrom || params?.dateTo) {
      const dateFilter: Record<string, Date> = {}
      if (params.dateFrom) dateFilter.gte = new Date(params.dateFrom + 'T00:00:00')
      if (params.dateTo) dateFilter.lte = new Date(params.dateTo + 'T23:59:59.999')
      where.expenseDate = dateFilter
    }

    const [expenses, total] = await Promise.all([
      db.expense.findMany({
        where,
        include: { category: { select: { id: true, categoryName: true } } },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit
      }),
      db.expense.count({ where })
    ])

    return { success: true, data: { expenses: expenses.map(serializeExpenseDate), total, page, limit } }
  } catch (err) {
    return { success: false, error: { code: 'EXP-001', message: err instanceof Error ? err.message : 'Failed to list expenses.' } }
  }
}

export async function createExpense(payload: ExpensePayload, userId?: string) {
  try {
    const db = getPrisma()

    const cat = await db.expenseCategory.findUnique({ where: { id: payload.categoryId } })
    if (!cat) return { success: false, error: { code: 'EXP-002', message: 'Expense category not found.' } }

    if (payload.amount <= 0) return { success: false, error: { code: 'EXP-003', message: 'Amount must be greater than zero.' } }

    if (payload.supplierId) {
      const supplier = await db.supplier.findUnique({ where: { id: payload.supplierId } })
      if (!supplier) return { success: false, error: { code: 'SUP-001', message: 'Supplier not found.' } }
    }
    if (payload.billableCustomerId) {
      const customer = await db.customer.findUnique({ where: { id: payload.billableCustomerId } })
      if (!customer) return { success: false, error: { code: 'CUS-001', message: 'Customer not found.' } }
    }

    const expenseDate = payload.expenseDate ? parseLocalDateStart(payload.expenseDate) : new Date()
    const amount = resolveAmount(payload)

    // Phase 62 — Transaction Locking.
    const lockError = await assertNotLocked(expenseDate)
    if (lockError) return lockError

    const expense = await db.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          categoryId: payload.categoryId,
          expenseName: payload.expenseName.trim(),
          amount,
          expenseDate,
          paymentMethod: payload.paymentMethod ?? 'CASH',
          remarks: payload.remarks?.trim() ?? null,
          createdById: userId ?? null,
          supplierId: payload.supplierId ?? null,
          mileageKm: payload.mileageKm ?? null,
          mileageRatePerKm: payload.mileageRatePerKm ?? null,
          billableCustomerId: payload.billableCustomerId ?? null,
          isReverseCharge: payload.isReverseCharge ?? false
        },
        include: { category: { select: { id: true, categoryName: true } } }
      })
      // Phase 62 — GL auto-posting.
      await postExpenseJournalEntry(tx, { expenseId: created.id, expenseName: created.expenseName, amount: created.amount })
      return created
    })

    await logAction({ userId, action: 'EXPENSE_CREATED', entityType: 'Expense', entityId: expense.id, newValue: { expenseName: expense.expenseName, amount: expense.amount } })

    return { success: true, data: serializeExpenseDate(expense) }
  } catch (err) {
    return { success: false, error: { code: 'EXP-004', message: err instanceof Error ? err.message : 'Failed to create expense.' } }
  }
}

export async function updateExpense(payload: UpdateExpensePayload, userId?: string) {
  try {
    const db = getPrisma()

    const existing = await db.expense.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'EXP-005', message: 'Expense not found.' } }

    if (payload.amount <= 0) return { success: false, error: { code: 'EXP-003', message: 'Amount must be greater than zero.' } }

    if (payload.supplierId) {
      const supplier = await db.supplier.findUnique({ where: { id: payload.supplierId } })
      if (!supplier) return { success: false, error: { code: 'SUP-001', message: 'Supplier not found.' } }
    }
    if (payload.billableCustomerId) {
      const customer = await db.customer.findUnique({ where: { id: payload.billableCustomerId } })
      if (!customer) return { success: false, error: { code: 'CUS-001', message: 'Customer not found.' } }
    }

    const expenseDate = payload.expenseDate ? parseLocalDateStart(payload.expenseDate) : existing.expenseDate

    // Phase 62 — Transaction Locking. Checked against BOTH the existing
    // (pre-edit) date and the new date — an edit must not be able to escape
    // a lock on either end (editing something out of a locked period, or
    // editing something INTO one).
    const lockError = (await assertNotLocked(existing.expenseDate)) ?? (await assertNotLocked(expenseDate))
    if (lockError) return lockError

    const amount = resolveAmount(payload)

    const expense = await db.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id: payload.id },
        data: {
          categoryId: payload.categoryId,
          expenseName: payload.expenseName.trim(),
          amount,
          expenseDate,
          paymentMethod: payload.paymentMethod ?? existing.paymentMethod,
          remarks: payload.remarks?.trim() ?? null,
          supplierId: payload.supplierId ?? null,
          mileageKm: payload.mileageKm ?? null,
          mileageRatePerKm: payload.mileageRatePerKm ?? null,
          billableCustomerId: payload.billableCustomerId ?? null,
          isReverseCharge: payload.isReverseCharge ?? existing.isReverseCharge
        },
        include: { category: { select: { id: true, categoryName: true } } }
      })
      // Phase 62 — GL auto-posting: an edit can change the amount, so the
      // original entry is reversed and a fresh one posted for the new
      // amount, rather than trying to "adjust" a posted entry in place —
      // matches this codebase's "nothing financial is silently mutated"
      // stance already established for every other reversal in this phase.
      await reverseEntryBySourceTx(tx, 'EXPENSE', existing.id, 'Expense edited', userId)
      await postExpenseJournalEntry(tx, { expenseId: updated.id, expenseName: updated.expenseName, amount: updated.amount })
      return updated
    })

    await logAction({ userId, action: 'EXPENSE_UPDATED', entityType: 'Expense', entityId: expense.id, oldValue: { amount: existing.amount }, newValue: { amount: expense.amount } })

    return { success: true, data: serializeExpenseDate(expense) }
  } catch (err) {
    return { success: false, error: { code: 'EXP-006', message: err instanceof Error ? err.message : 'Failed to update expense.' } }
  }
}

export async function deleteExpense(id: string, userId?: string) {
  try {
    const db = getPrisma()

    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'EXP-005', message: 'Expense not found.' } }

    const lockError = await assertNotLocked(existing.expenseDate)
    if (lockError) return lockError

    await db.$transaction(async (tx) => {
      // Phase 62 — GL auto-posting: reverse before deleting — sourceId isn't
      // a hard FK (same pattern ProductCostHistory's sourceId already uses),
      // but the reversal lookup still needs the expense row's own id to
      // exist logically at the moment it runs, so order matters here even
      // though nothing would break either order at the DB level.
      await reverseEntryBySourceTx(tx, 'EXPENSE', id, 'Expense deleted', userId)
      await tx.expense.delete({ where: { id } })
    })
    await logAction({ userId, action: 'EXPENSE_DELETED', entityType: 'Expense', entityId: id, oldValue: { expenseName: existing.expenseName, amount: existing.amount } })

    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'EXP-007', message: err instanceof Error ? err.message : 'Failed to delete expense.' } }
  }
}

export async function getExpenseSummary(dateFrom: string, dateTo: string) {
  try {
    const db = getPrisma()
    const from = new Date(dateFrom + 'T00:00:00')
    const to = new Date(dateTo + 'T23:59:59.999')

    const expenses = await db.expense.findMany({
      where: { expenseDate: { gte: from, lte: to } },
      include: { category: { select: { categoryName: true } } }
    })

    // Fresh-audit fix (2026-07-28): raw float `reduce((s, x) => s + x, 0)`
    // accumulates binary floating-point drift across many rows (exactly the
    // pattern currency.service.ts's sumCurrency exists to avoid — see its own
    // doc comment). Routed through Decimal-backed sumCurrency instead, same
    // as report.service.ts's report generators and payroll.service.ts's
    // salary math already do.
    const totalAmount = sumCurrency(expenses.map(e => e.amount))
    const byCategoryAmounts: Record<string, { categoryName: string; amounts: number[]; count: number }> = {}

    for (const e of expenses) {
      const key = e.categoryId
      if (!byCategoryAmounts[key]) byCategoryAmounts[key] = { categoryName: e.category.categoryName, amounts: [], count: 0 }
      byCategoryAmounts[key].amounts.push(e.amount)
      byCategoryAmounts[key].count++
    }
    const byCategory: Record<string, { categoryName: string; total: number; count: number }> = {}
    for (const [key, v] of Object.entries(byCategoryAmounts)) {
      byCategory[key] = { categoryName: v.categoryName, total: sumCurrency(v.amounts), count: v.count }
    }

    return { success: true, data: { totalAmount, count: expenses.length, byCategory: Object.values(byCategory) } }
  } catch (err) {
    return { success: false, error: { code: 'EXP-008', message: err instanceof Error ? err.message : 'Failed to get expense summary.' } }
  }
}
