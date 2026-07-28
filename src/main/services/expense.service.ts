import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { parseLocalDateStart, toLocalDateOnlyIso } from '../utils/date.util'
import { sumCurrency } from './currency.service'

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

    const expenseDate = payload.expenseDate ? parseLocalDateStart(payload.expenseDate) : new Date()

    const expense = await db.expense.create({
      data: {
        categoryId: payload.categoryId,
        expenseName: payload.expenseName.trim(),
        amount: payload.amount,
        expenseDate,
        paymentMethod: payload.paymentMethod ?? 'CASH',
        remarks: payload.remarks?.trim() ?? null,
        createdById: userId ?? null
      },
      include: { category: { select: { id: true, categoryName: true } } }
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

    const expenseDate = payload.expenseDate ? parseLocalDateStart(payload.expenseDate) : existing.expenseDate

    const expense = await db.expense.update({
      where: { id: payload.id },
      data: {
        categoryId: payload.categoryId,
        expenseName: payload.expenseName.trim(),
        amount: payload.amount,
        expenseDate,
        paymentMethod: payload.paymentMethod ?? existing.paymentMethod,
        remarks: payload.remarks?.trim() ?? null
      },
      include: { category: { select: { id: true, categoryName: true } } }
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

    await db.expense.delete({ where: { id } })
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
