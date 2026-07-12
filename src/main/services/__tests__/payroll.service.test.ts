import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../hr.service', async () => {
  const actual = await vi.importActual<typeof import('../hr.service')>('../hr.service')
  return { ...actual, getMonthlySummaries: vi.fn(), getEmployee: vi.fn() }
})

import { getPrisma } from '../../database/db'
import { getMonthlySummaries } from '../hr.service'
import {
  generatePayrollForPeriod, updateSalaryPayment, markSalaryPaid, listPayrollForPeriod, getSalaryPayment
} from '../payroll.service'

beforeEach(() => vi.clearAllMocks())

function makeSummary(overrides: Partial<{ employeeId: string; basicSalary: number; allowances: { name: string; amount: number }[]; grossSalary: number; netPayable: number }> = {}) {
  return {
    employeeId: overrides.employeeId ?? 'emp-1',
    employeeName: 'Test Employee',
    year: 2026, month: 7, present: 20, absent: 0, halfDay: 0, leave: 0, holiday: 0, weekOff: 8,
    workingDays: 28, effectiveDays: 20,
    salary: {
      basicSalary: overrides.basicSalary ?? 20000,
      allowances: overrides.allowances ?? [],
      totalAllowances: 0,
      grossSalary: overrides.grossSalary ?? 20000,
      workingDays: 28, effectiveDays: 20,
      netPayable: overrides.netPayable ?? 20000,
    },
  }
}

describe('generatePayrollForPeriod', () => {
  it('creates one SalaryPayment row per active employee with no existing row for the period', async () => {
    vi.mocked(getMonthlySummaries).mockResolvedValue({ success: true, data: { summaries: [makeSummary({ employeeId: 'emp-1' }), makeSummary({ employeeId: 'emp-2' })] } })
    const created: unknown[] = []
    const db = {
      salaryPayment: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }) => { created.push(data); return Promise.resolve({ id: 'sp-' + created.length, ...data }) }),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generatePayrollForPeriod({ year: 2026, month: 7 })

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ created: 2, skipped: 0 })
    expect(created).toHaveLength(2)
  })

  it('skips employees who already have a SalaryPayment row for the period (idempotent)', async () => {
    vi.mocked(getMonthlySummaries).mockResolvedValue({ success: true, data: { summaries: [makeSummary({ employeeId: 'emp-1' }), makeSummary({ employeeId: 'emp-2' })] } })
    const db = {
      salaryPayment: {
        findMany: vi.fn().mockResolvedValue([{ employeeId: 'emp-1' }]),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'sp-new', ...data })),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generatePayrollForPeriod({ year: 2026, month: 7 })

    expect(res.data).toEqual({ created: 1, skipped: 1 })
    expect(db.salaryPayment.create).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when there are no active employees', async () => {
    vi.mocked(getMonthlySummaries).mockResolvedValue({ success: true, data: { summaries: [] } })
    const db = { salaryPayment: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generatePayrollForPeriod({ year: 2026, month: 7 })

    expect(res.data).toEqual({ created: 0, skipped: 0 })
    expect(db.salaryPayment.create).not.toHaveBeenCalled()
  })
})

function makeExistingRecord(overrides: Partial<{ status: string; grossSalary: number; deductions: string }> = {}) {
  return {
    id: 'sp-1', employeeId: 'emp-1', periodYear: 2026, periodMonth: 7,
    basicSalary: 20000, allowances: '[]', grossSalary: overrides.grossSalary ?? 20000,
    deductions: overrides.deductions ?? '[]', totalDeductions: 0, netPayable: overrides.grossSalary ?? 20000,
    status: overrides.status ?? 'DRAFT', paidDate: null, paymentMethod: null, expenseId: null, notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    employee: { fullName: 'Test Employee' },
  }
}

describe('updateSalaryPayment', () => {
  it('recomputes totalDeductions and netPayable server-side from submitted lines', async () => {
    const db = {
      salaryPayment: {
        findUnique: vi.fn().mockResolvedValue(makeExistingRecord({ grossSalary: 20000 })),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...makeExistingRecord({ grossSalary: 20000 }), ...data, employee: { fullName: 'Test Employee' } })),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSalaryPayment({ id: 'sp-1', deductions: [{ name: 'PF', amount: 2400 }, { name: 'ESI', amount: 150 }] })

    expect(res.success).toBe(true)
    expect(res.data?.totalDeductions).toBe(2550)
    expect(res.data?.netPayable).toBe(20000 - 2550)
  })

  it('ignores a client-submitted netPayable and always derives it from gross minus deductions', async () => {
    const db = {
      salaryPayment: {
        findUnique: vi.fn().mockResolvedValue(makeExistingRecord({ grossSalary: 15000 })),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...makeExistingRecord({ grossSalary: 15000 }), ...data, employee: { fullName: 'Test Employee' } })),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSalaryPayment({ id: 'sp-1', deductions: [{ name: 'TDS', amount: 1000 }] })

    expect(res.data?.netPayable).toBe(14000)
  })

  it('rejects mutation once the record is already PAID', async () => {
    const db = { salaryPayment: { findUnique: vi.fn().mockResolvedValue(makeExistingRecord({ status: 'PAID' })), update: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSalaryPayment({ id: 'sp-1', deductions: [{ name: 'PF', amount: 100 }] })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('PAY-005')
    expect(db.salaryPayment.update).not.toHaveBeenCalled()
  })

  it('filters out blank-named deduction lines', async () => {
    const db = {
      salaryPayment: {
        findUnique: vi.fn().mockResolvedValue(makeExistingRecord({ grossSalary: 10000 })),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...makeExistingRecord({ grossSalary: 10000 }), ...data, employee: { fullName: 'Test Employee' } })),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSalaryPayment({ id: 'sp-1', deductions: [{ name: '  ', amount: 500 }, { name: 'PF', amount: 100 }] })

    expect(res.data?.totalDeductions).toBe(100)
  })
})

describe('markSalaryPaid', () => {
  function makeMarkPaidDb(existing: ReturnType<typeof makeExistingRecord>, categoryExists = true) {
    const txClient = {
      salaryPayment: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...existing, ...data, employee: existing.employee })),
      },
      expenseCategory: {
        findUnique: vi.fn().mockResolvedValue(categoryExists ? { id: 'cat-salary', categoryName: 'Salary' } : null),
        create: vi.fn().mockResolvedValue({ id: 'cat-salary', categoryName: 'Salary' }),
      },
      expense: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'exp-1', ...data })),
      },
    }
    return { $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(txClient)), __tx: txClient }
  }

  it('creates a real Expense row with the correct amount and category, and marks the record PAID', async () => {
    const existing = makeExistingRecord({ grossSalary: 20000 })
    const db = makeMarkPaidDb(existing)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await markSalaryPaid({ id: 'sp-1', paymentMethod: 'BANK_TRANSFER', userId: 'user-1' })

    expect(res.success).toBe(true)
    expect(db.__tx.expense.create).toHaveBeenCalledOnce()
    const expenseCall = db.__tx.expense.create.mock.calls[0][0]
    expect(expenseCall.data.categoryId).toBe('cat-salary')
    expect(expenseCall.data.amount).toBe(existing.netPayable)
    expect(db.__tx.salaryPayment.update).toHaveBeenCalledOnce()
    const updateCall = db.__tx.salaryPayment.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('PAID')
    expect(updateCall.data.expenseId).toBe('exp-1')
  })

  it('creates the Salary expense category if it does not already exist (self-healing, matches seedDefaultData convention)', async () => {
    const existing = makeExistingRecord()
    const db = makeMarkPaidDb(existing, false)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await markSalaryPaid({ id: 'sp-1', paymentMethod: 'CASH' })

    expect(db.__tx.expenseCategory.create).toHaveBeenCalledOnce()
  })

  it('rejects marking an already-PAID record a second time', async () => {
    const existing = makeExistingRecord({ status: 'PAID' })
    const db = makeMarkPaidDb(existing)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await markSalaryPaid({ id: 'sp-1', paymentMethod: 'CASH' })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('PAY-007')
    expect(db.__tx.expense.create).not.toHaveBeenCalled()
  })

  it('returns an error for a non-existent record', async () => {
    const db = makeMarkPaidDb(makeExistingRecord())
    db.__tx.salaryPayment.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await markSalaryPaid({ id: 'missing', paymentMethod: 'CASH' })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('PAY-004')
  })
})

describe('listPayrollForPeriod / getSalaryPayment', () => {
  it('lists and serializes records for a period, parsing JSON allowances/deductions', async () => {
    const row = makeExistingRecord({ deductions: JSON.stringify([{ name: 'PF', amount: 500 }]) })
    const db = { salaryPayment: { findMany: vi.fn().mockResolvedValue([row]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listPayrollForPeriod({ year: 2026, month: 7 })

    expect(res.success).toBe(true)
    expect(res.data?.records).toHaveLength(1)
    expect(res.data?.records[0].deductions).toEqual([{ name: 'PF', amount: 500 }])
  })

  it('getSalaryPayment returns not-found for a missing id', async () => {
    const db = { salaryPayment: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSalaryPayment('missing')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('PAY-004')
  })
})
