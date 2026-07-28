import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listExpenses, createExpense, updateExpense, getExpenseSummary } from '../expense.service'

// Real bugs found 2026-07-28 (reports/settings/HR/security/licensing/
// master-data audit pass), both in this file:
//
// 1. Read side: Expense.expenseDate is a non-nullable Prisma DateTime.
//    listExpenses/createExpense/updateExpense used to return the raw Prisma
//    row, so `expenseDate` crossed Electron's IPC boundary (structured
//    clone — preserves a Date instance, doesn't coerce to a string) as a
//    real Date object. ExpensesScreen.tsx's openEdit() does
//    `exp.expenseDate.slice(0, 10)`, assuming a string — this threw at
//    runtime for every expense record.
// 2. Write side: createExpense/updateExpense built the stored date via
//    `new Date(payload.expenseDate)` on the bare "YYYY-MM-DD" string
//    `<input type="date">` sends — parsed as UTC midnight, not local
//    midnight, inconsistent with this same file's listExpenses/
//    getExpenseSummary (which correctly append 'T00:00:00' for local time).

function makeCategory() {
  return { id: 'cat-1', categoryName: 'Rent' }
}

function makeExpenseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exp-1', categoryId: 'cat-1', expenseName: 'July rent', amount: 5000,
    expenseDate: new Date(2026, 6, 28), paymentMethod: 'CASH', remarks: null,
    createdById: null, category: makeCategory(),
    ...overrides,
  }
}

function makeDb(overrides: Record<string, any> = {}) {
  const db: Record<string, any> = {
    expenseCategory: { findUnique: vi.fn().mockResolvedValue(makeCategory()) },
    expense: {
      findMany: vi.fn().mockResolvedValue([makeExpenseRow()]),
      findUnique: vi.fn().mockResolvedValue(makeExpenseRow()),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(makeExpenseRow()),
      update: vi.fn().mockResolvedValue(makeExpenseRow()),
    },
    ...overrides,
  }
  return db
}

describe('expense.service — expenseDate across the IPC boundary and timezone-correct writes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listExpenses returns expenseDate as a string the renderer can .slice(0, 10) on', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const res = await listExpenses({})
    expect(res.success).toBe(true)
    const row = (res.data as { expenses: Array<{ expenseDate: unknown }> }).expenses[0]
    expect(typeof row.expenseDate).toBe('string')
    expect(() => (row.expenseDate as string).slice(0, 10)).not.toThrow()
    expect((row.expenseDate as string).slice(0, 10)).toBe('2026-07-28')
  })

  it('createExpense returns expenseDate as a string', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const res = await createExpense({ categoryId: 'cat-1', expenseName: 'July rent', amount: 5000, expenseDate: '2026-07-28' })
    expect(res.success).toBe(true)
    expect(typeof (res.data as { expenseDate: unknown }).expenseDate).toBe('string')
  })

  it('createExpense stores the exact local calendar date typed, not shifted by a UTC round-trip', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createExpense({ categoryId: 'cat-1', expenseName: 'July rent', amount: 5000, expenseDate: '2026-07-28' })
    const createCall = db.expense.create.mock.calls[0][0]
    const storedDate: Date = createCall.data.expenseDate
    expect(storedDate.getFullYear()).toBe(2026)
    expect(storedDate.getMonth()).toBe(6)
    expect(storedDate.getDate()).toBe(28)
    expect(storedDate.getHours()).toBe(0)
  })

  it('updateExpense returns expenseDate as a string', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const res = await updateExpense({ id: 'exp-1', categoryId: 'cat-1', expenseName: 'July rent', amount: 5500, expenseDate: '2026-07-29' })
    expect(res.success).toBe(true)
    expect(typeof (res.data as { expenseDate: unknown }).expenseDate).toBe('string')
  })
})

// Fresh-audit fix (2026-07-28): getExpenseSummary used to sum with raw
// float `reduce((s, x) => s + x, 0)`, which accumulates binary
// floating-point drift — routed through currency.service.ts's Decimal-backed
// sumCurrency instead.
describe('expense.service — getExpenseSummary money math', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sums amounts that are float-drift-prone without producing a drifted total', async () => {
    const db = makeDb({
      expense: {
        findMany: vi.fn().mockResolvedValue([
          makeExpenseRow({ id: 'e1', amount: 0.1, categoryId: 'cat-1' }),
          makeExpenseRow({ id: 'e2', amount: 0.2, categoryId: 'cat-1' }),
        ]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getExpenseSummary('2026-07-01', '2026-07-31')
    expect(res.success).toBe(true)
    const data = res.data as { totalAmount: number; byCategory: Array<{ total: number }> }
    // Plain JS float addition gives 0.30000000000000004 here — must be exact.
    expect(data.totalAmount).toBe(0.3)
    expect(data.byCategory[0].total).toBe(0.3)
  })
})
