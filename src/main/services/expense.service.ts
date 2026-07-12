import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

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

    return { success: true, data: { expenses, total, page, limit } }
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

    const expenseDate = payload.expenseDate ? new Date(payload.expenseDate) : new Date()

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

    return { success: true, data: expense }
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

    const expenseDate = payload.expenseDate ? new Date(payload.expenseDate) : existing.expenseDate

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

    return { success: true, data: expense }
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

    const totalAmount = expenses.reduce((s, e) => s + e.amount, 0)
    const byCategory: Record<string, { categoryName: string; total: number; count: number }> = {}

    for (const e of expenses) {
      const key = e.categoryId
      if (!byCategory[key]) byCategory[key] = { categoryName: e.category.categoryName, total: 0, count: 0 }
      byCategory[key].total += e.amount
      byCategory[key].count++
    }

    return { success: true, data: { totalAmount, count: expenses.length, byCategory: Object.values(byCategory) } }
  } catch (err) {
    return { success: false, error: { code: 'EXP-008', message: err instanceof Error ? err.message : 'Failed to get expense summary.' } }
  }
}
