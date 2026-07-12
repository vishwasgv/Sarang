import * as expenseService from '../../services/expense.service'
import { requirePermission, requireSession } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { getPrisma } from '../../database/db'
import { CreateExpenseSchema, UpdateExpenseSchema, CreateExpenseCategorySchema } from '../../validation/expenses.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('expenses:list', async (payload) => {
    const deny = await requirePermission('expenses.view'); if (deny) return deny
    const p = (payload ?? {}) as { categoryId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }
    return expenseService.listExpenses(p)
  })

  handle('expenses:create', async (payload) => {
    const deny = await requirePermission('expenses.create'); if (deny) return deny
    const parsed = CreateExpenseSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return expenseService.createExpense(parsed.data, getCurrentSession()?.userId)
  })

  handle('expenses:update', async (payload) => {
    const deny = await requirePermission('expenses.modify'); if (deny) return deny
    const parsed = UpdateExpenseSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return expenseService.updateExpense(parsed.data, getCurrentSession()?.userId)
  })

  handle('expenses:delete', async (id) => {
    const deny = await requirePermission('expenses.delete'); if (deny) return deny
    const bad = validateId(id, 'expense ID'); if (bad) return bad
    return expenseService.deleteExpense(id as string, getCurrentSession()?.userId)
  })

  handle('expenses:summary', async (payload) => {
    const deny = await requirePermission('expenses.view'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string }
    if (!p.dateFrom || !p.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo required.' } }
    return expenseService.getExpenseSummary(p.dateFrom, p.dateTo)
  })

  handle('expenses:listCategories', async () => {
    const deny = requireSession(); if (deny) return deny
    const db = getPrisma()
    const cats = await db.expenseCategory.findMany({ orderBy: { categoryName: 'asc' } })
    return { success: true, data: cats }
  })

  handle('expenses:createCategory', async (payload) => {
    const deny = await requirePermission('expenses.create'); if (deny) return deny
    const parsed = CreateExpenseCategorySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const p = parsed.data
    const db = getPrisma()
    const existing = await db.expenseCategory.findFirst({ where: { categoryName: p.categoryName.trim() } })
    if (existing) return { success: false, error: { code: 'EXP-009', message: 'Category already exists.' } }
    const cat = await db.expenseCategory.create({ data: { categoryName: p.categoryName.trim(), description: p.description ?? null } })
    return { success: true, data: cat }
  })
}
