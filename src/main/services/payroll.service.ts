import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { getMonthlySummaries } from './hr.service'
import type { Allowance } from './hr.service'

// Deliberately owner-configurable deductions (name+amount pairs), not computed
// statutory formulas — see PHASE_54F_16_TECHNICAL_SPEC.md Section 1 for why.

export interface DeductionLine {
  name: string
  amount: number
}

export interface SalaryPaymentRecord {
  id: string
  employeeId: string
  employeeName: string
  periodYear: number
  periodMonth: number
  basicSalary: number
  allowances: Allowance[]
  grossSalary: number
  deductions: DeductionLine[]
  totalDeductions: number
  netPayable: number
  status: 'DRAFT' | 'PAID'
  paidDate: string | null
  paymentMethod: string | null
  expenseId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

type Result<T> = Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }>

function parseLines(raw: string): DeductionLine[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function serializeRecord(row: {
  id: string; employeeId: string; employee: { fullName: string }
  periodYear: number; periodMonth: number; basicSalary: number; allowances: string
  grossSalary: number; deductions: string; totalDeductions: number; netPayable: number
  status: string; paidDate: Date | null; paymentMethod: string | null; expenseId: string | null
  notes: string | null; createdAt: Date; updatedAt: Date
}): SalaryPaymentRecord {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.fullName,
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    basicSalary: row.basicSalary,
    allowances: parseLines(row.allowances),
    grossSalary: row.grossSalary,
    deductions: parseLines(row.deductions),
    totalDeductions: row.totalDeductions,
    netPayable: row.netPayable,
    status: row.status as 'DRAFT' | 'PAID',
    paidDate: row.paidDate ? row.paidDate.toISOString() : null,
    paymentMethod: row.paymentMethod,
    expenseId: row.expenseId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const includeEmployee = { employee: { select: { fullName: true } } } as const

export async function listPayrollForPeriod(payload: { year: number; month: number }): Result<{ records: SalaryPaymentRecord[] }> {
  try {
    const db = getPrisma()
    const rows = await db.salaryPayment.findMany({
      where: { periodYear: payload.year, periodMonth: payload.month },
      include: includeEmployee,
      orderBy: { employee: { fullName: 'asc' } },
    })
    return { success: true, data: { records: rows.map(serializeRecord) } }
  } catch (e) {
    return { success: false, error: { code: 'PAY-001', message: e instanceof Error ? e.message : 'Could not load payroll for this period.' } }
  }
}

// Reuses hr.service.ts's getMonthlySummaries() for the attendance-based gross
// calculation — same computation the "reference" screen already did, now
// persisted rather than recomputed every time. Idempotent: only creates a row
// for an employee who doesn't already have one for this period; the
// @@unique([employeeId, periodYear, periodMonth]) constraint is the real
// backstop against a race duplicating a row.
export async function generatePayrollForPeriod(payload: { year: number; month: number }): Result<{ created: number; skipped: number }> {
  try {
    const db = getPrisma()
    const summariesRes = await getMonthlySummaries({ year: payload.year, month: payload.month })
    if (!summariesRes.success || !summariesRes.data) {
      return { success: false, error: { code: 'PAY-002', message: 'Could not compute payroll summaries for this period.' } }
    }

    const existing = await db.salaryPayment.findMany({
      where: { periodYear: payload.year, periodMonth: payload.month },
      select: { employeeId: true },
    })
    const existingIds = new Set(existing.map((r) => r.employeeId))

    let created = 0
    let skipped = 0
    for (const summary of summariesRes.data.summaries) {
      if (existingIds.has(summary.employeeId)) { skipped++; continue }
      try {
        await db.salaryPayment.create({
          data: {
            employeeId: summary.employeeId,
            periodYear: payload.year,
            periodMonth: payload.month,
            basicSalary: summary.salary.basicSalary,
            allowances: JSON.stringify(summary.salary.allowances),
            grossSalary: summary.salary.grossSalary,
            deductions: '[]',
            totalDeductions: 0,
            netPayable: summary.salary.netPayable,
          },
        })
        created++
      } catch {
        // Unique-constraint race (two concurrent "Generate Payroll" clicks) —
        // the other request already created this employee's row; not an error.
        skipped++
      }
    }

    if (created > 0) {
      await logAction({ action: 'PAYROLL_GENERATED', entityType: 'SalaryPayment', entityId: `${payload.year}-${payload.month}`, newValue: { created, skipped } })
    }
    return { success: true, data: { created, skipped } }
  } catch (e) {
    return { success: false, error: { code: 'PAY-003', message: e instanceof Error ? e.message : 'Could not generate payroll for this period.' } }
  }
}

// Recomputes totals server-side from the submitted deduction lines — never
// trusts a client-computed net figure. Rejects mutation once PAID (a paid
// payslip is a historical document, not an editable draft — matches
// VisitNote.isFinalized / Quotation status locking mutable documents
// elsewhere in this app).
export async function updateSalaryPayment(payload: { id: string; deductions: DeductionLine[]; notes?: string }): Result<SalaryPaymentRecord> {
  try {
    const db = getPrisma()
    const existing = await db.salaryPayment.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'PAY-004', message: 'Payroll record not found.' } }
    if (existing.status === 'PAID') {
      return { success: false, error: { code: 'PAY-005', message: 'This payslip has already been paid and can no longer be edited.' } }
    }

    const cleanDeductions = (payload.deductions ?? [])
      .map((d) => ({ name: (d.name ?? '').trim(), amount: Number(d.amount) || 0 }))
      .filter((d) => d.name.length > 0)
    const totalDeductions = cleanDeductions.reduce((s, d) => s + d.amount, 0)
    const netPayable = existing.grossSalary - totalDeductions

    const updated = await db.salaryPayment.update({
      where: { id: payload.id },
      data: {
        deductions: JSON.stringify(cleanDeductions),
        totalDeductions,
        netPayable,
        notes: payload.notes?.trim() || null,
      },
      include: includeEmployee,
    })
    return { success: true, data: serializeRecord(updated) }
  } catch (e) {
    return { success: false, error: { code: 'PAY-006', message: e instanceof Error ? e.message : 'Could not update deductions.' } }
  }
}

// Creates the real Expense row this audit flagged as missing — payroll is
// now visible to Expense Report / P&L instead of an invisible parallel ledger.
export async function markSalaryPaid(payload: { id: string; paymentMethod: string; paidDate?: string; userId?: string }): Result<SalaryPaymentRecord> {
  try {
    const db = getPrisma()
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.salaryPayment.findUnique({ where: { id: payload.id }, include: includeEmployee })
      if (!existing) return { ok: false as const, error: { code: 'PAY-004', message: 'Payroll record not found.' } }
      if (existing.status === 'PAID') return { ok: false as const, error: { code: 'PAY-007', message: 'This payslip has already been marked as paid.' } }

      let category = await tx.expenseCategory.findUnique({ where: { categoryName: 'Salary' } })
      if (!category) {
        category = await tx.expenseCategory.create({ data: { categoryName: 'Salary' } })
      }

      const paidDate = payload.paidDate ? new Date(payload.paidDate) : new Date()
      const monthLabel = `${existing.periodMonth}/${existing.periodYear}`
      const expense = await tx.expense.create({
        data: {
          categoryId: category.id,
          expenseName: `Salary — ${existing.employee.fullName} — ${monthLabel}`,
          amount: existing.netPayable,
          expenseDate: paidDate,
          paymentMethod: payload.paymentMethod || 'CASH',
          createdById: payload.userId ?? null,
        },
      })

      const updated = await tx.salaryPayment.update({
        where: { id: payload.id },
        data: { status: 'PAID', paidDate, paymentMethod: payload.paymentMethod || 'CASH', expenseId: expense.id },
        include: includeEmployee,
      })
      return { ok: true as const, record: updated }
    })

    if (!result.ok) return { success: false, error: result.error }
    await logAction({ userId: payload.userId, action: 'SALARY_PAID', entityType: 'SalaryPayment', entityId: payload.id, newValue: { netPayable: result.record.netPayable } })
    return { success: true, data: serializeRecord(result.record) }
  } catch (e) {
    return { success: false, error: { code: 'PAY-008', message: e instanceof Error ? e.message : 'Could not mark salary as paid.' } }
  }
}

export async function getSalaryPayment(id: string): Result<SalaryPaymentRecord> {
  try {
    const db = getPrisma()
    const row = await db.salaryPayment.findUnique({ where: { id }, include: includeEmployee })
    if (!row) return { success: false, error: { code: 'PAY-004', message: 'Payroll record not found.' } }
    return { success: true, data: serializeRecord(row) }
  } catch (e) {
    return { success: false, error: { code: 'PAY-009', message: e instanceof Error ? e.message : 'Could not load payroll record.' } }
  }
}
