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
  // tx === db: createExpense/updateExpense/deleteExpense now wrap their
  // write + GL posting in $transaction, so the callback must see the same
  // mocked expense/etc. the tests assert against.
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    // Phase 62 — Transaction Locking's assertNotLocked reads this before
    // every dated write; a null lockDate means "not locked."
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ lockDate: null }) },
    // Phase 62 — GL auto-posting: postExpenseJournalEntry resolves the
    // system Operating-Expenses/Cash accounts and posts a JournalEntry;
    // updateExpense/deleteExpense reverse the prior one first
    // (reverseEntryBySourceTx -> journalEntry.findFirst).
    chartOfAccounts: {
      findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '6000', accountName: 'Operating Expenses', accountType: 'EXPENSE', isActive: true }),
    },
    journalEntry: {
      create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-00001' }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow }),
      updateMany: vi.fn(async ({ data }: { data: { settingValue: string } }) => {
        if (!settingRow) return { count: 0 }
        settingRow = { ...settingRow, settingValue: data.settingValue }
        return { count: 1 }
      }),
    },
    expenseCategory: { findUnique: vi.fn().mockResolvedValue(makeCategory()) },
    expense: {
      findMany: vi.fn().mockResolvedValue([makeExpenseRow()]),
      findUnique: vi.fn().mockResolvedValue(makeExpenseRow()),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(makeExpenseRow()),
      update: vi.fn().mockResolvedValue(makeExpenseRow()),
      delete: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  }
  db.$transaction = vi.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)
  )
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

  it('posts a real balanced JournalEntry: Debit Operating Expenses, Credit Cash & Bank, for the expense amount', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createExpense({ categoryId: 'cat-1', expenseName: 'July rent', amount: 5000 })

    expect(res.success).toBe(true)
    expect(db.journalEntry.create).toHaveBeenCalledTimes(1)
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    expect(jeArgs.data.sourceType).toBe('EXPENSE')
    const lines = jeArgs.data.lines.create as Array<{ debitAmount: number; creditAmount: number }>
    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ debitAmount: 5000, creditAmount: 0 }),
      expect.objectContaining({ debitAmount: 0, creditAmount: 5000 }),
    ]))
  })

  it('updateExpense returns expenseDate as a string', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const res = await updateExpense({ id: 'exp-1', categoryId: 'cat-1', expenseName: 'July rent', amount: 5500, expenseDate: '2026-07-29' })
    expect(res.success).toBe(true)
    expect(typeof (res.data as { expenseDate: unknown }).expenseDate).toBe('string')
  })

  // Phase 65 — Reporting Tags / Cost & Profit Centres.
  it('passes costCentreId through to the created expense row and every posted GL line', async () => {
    const db = makeDb()
    db.expense.create = vi.fn().mockResolvedValue(makeExpenseRow({ costCentreId: 'cc-branch-1' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createExpense({ categoryId: 'cat-1', expenseName: 'July rent', amount: 5000, costCentreId: 'cc-branch-1' })

    expect(res.success).toBe(true)
    const createCall = db.expense.create.mock.calls[0][0]
    expect(createCall.data.costCentreId).toBe('cc-branch-1')
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    const lines = jeArgs.data.lines.create as Array<{ costCentreId: string | null }>
    expect(lines.every((l) => l.costCentreId === 'cc-branch-1')).toBe(true)
  })

  it('leaves costCentreId null when the expense is not tagged (zero behavior change for the common case)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createExpense({ categoryId: 'cat-1', expenseName: 'July rent', amount: 5000 })

    const createCall = db.expense.create.mock.calls[0][0]
    expect(createCall.data.costCentreId).toBeNull()
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
