import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Allowance {
  name: string
  amount: number
}

export interface EmployeeRecord {
  id: string
  employeeNumber: string | null
  fullName: string
  phone: string | null
  email: string | null
  department: string | null
  designation: string | null
  employeeType: string
  joinDate: string
  exitDate: string | null
  isActive: boolean
  salaryType: string
  basicSalary: number
  allowances: Allowance[]
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  date: string
  status: string
  checkIn: string | null
  checkOut: string | null
  notes: string | null
}

export interface LeaveTypeRecord {
  id: string
  name: string
  maxDays: number
  isPaid: boolean
  isActive: boolean
}

export interface LeaveRequestRecord {
  id: string
  employeeId: string
  employeeName: string
  leaveTypeId: string
  leaveTypeName: string
  fromDate: string
  toDate: string
  days: number
  reason: string | null
  status: string
  approvedBy: string | null
  approvedAt: string | null
  notes: string | null
  createdAt: string
}

export interface MonthlySummary {
  employeeId: string
  employeeName: string
  year: number
  month: number
  present: number
  absent: number
  halfDay: number
  leave: number
  holiday: number
  weekOff: number
  workingDays: number
  effectiveDays: number // present + halfDay*0.5
  salary: SalaryReference
}

export interface SalaryReference {
  basicSalary: number
  allowances: Allowance[]
  totalAllowances: number
  grossSalary: number
  workingDays: number
  effectiveDays: number
  netPayable: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toEmployee(e: any): EmployeeRecord {
  return {
    id: e.id,
    employeeNumber: e.employeeNumber ?? null,
    fullName: e.fullName,
    phone: e.phone ?? null,
    email: e.email ?? null,
    department: e.department ?? null,
    designation: e.designation ?? null,
    employeeType: e.employeeType,
    joinDate: new Date(e.joinDate).toISOString(),
    exitDate: e.exitDate ? new Date(e.exitDate).toISOString() : null,
    isActive: e.isActive,
    salaryType: e.salaryType,
    basicSalary: e.basicSalary,
    allowances: parseAllowances(e.allowances),
    notes: e.notes ?? null,
    createdAt: new Date(e.createdAt).toISOString(),
    updatedAt: new Date(e.updatedAt).toISOString()
  }
}

function toAttendance(a: any): AttendanceRecord {
  return {
    id: a.id,
    employeeId: a.employeeId,
    employeeName: a.employee?.fullName ?? '',
    date: new Date(a.date).toISOString(),
    status: a.status,
    checkIn: a.checkIn ?? null,
    checkOut: a.checkOut ?? null,
    notes: a.notes ?? null
  }
}

function parseAllowances(raw: string): Allowance[] {
  try { return JSON.parse(raw) } catch { return [] }
}

type Result<T> = Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }>

// ─── Employee CRUD ────────────────────────────────────────────────────────────

export async function listEmployees(payload?: {
  isActive?: boolean
  department?: string
}): Result<{ employees: EmployeeRecord[]; total: number }> {
  try {
    const prisma = getPrisma()
    const where: any = {}
    if (payload?.isActive !== undefined) where.isActive = payload.isActive
    if (payload?.department) where.department = payload.department

    const [employees, total] = await prisma.$transaction([
      prisma.employee.findMany({ where, orderBy: { fullName: 'asc' } }),
      prisma.employee.count({ where })
    ])

    return { success: true, data: { employees: employees.map(toEmployee), total } }
  } catch (e: any) {
    console.error('[HR-001]', e)
    return { success: false, error: { code: 'HR-001', message: 'Something went wrong. Please try again.' } }
  }
}

export async function getEmployee(id: string): Result<EmployeeRecord> {
  try {
    const prisma = getPrisma()
    const e = await prisma.employee.findUniqueOrThrow({ where: { id } })
    return { success: true, data: toEmployee(e) }
  } catch (e: any) {
    console.error('[HR-002]', e)
    return { success: false, error: { code: 'HR-002', message: 'Something went wrong. Please try again.' } }
  }
}

export async function createEmployee(payload: {
  employeeNumber?: string
  fullName: string
  phone?: string
  email?: string
  department?: string
  designation?: string
  employeeType?: string
  joinDate: string
  salaryType?: string
  basicSalary?: number
  allowances?: Allowance[]
  notes?: string
}): Result<EmployeeRecord> {
  try {
    const prisma = getPrisma()
    const e = await prisma.employee.create({
      data: {
        employeeNumber: payload.employeeNumber || null,
        fullName: payload.fullName.trim(),
        phone: payload.phone?.trim() || null,
        email: payload.email?.trim() || null,
        department: payload.department?.trim() || null,
        designation: payload.designation?.trim() || null,
        employeeType: payload.employeeType ?? 'FULL_TIME',
        joinDate: new Date(payload.joinDate),
        salaryType: payload.salaryType ?? 'MONTHLY',
        basicSalary: payload.basicSalary ?? 0,
        allowances: JSON.stringify(payload.allowances ?? []),
        notes: payload.notes?.trim() || null
      }
    })
    return { success: true, data: toEmployee(e) }
  } catch (e: any) {
    if (e.code === 'P2002') return { success: false, error: { code: 'HR-003', message: 'Employee number already exists.' } }
    console.error('[HR-004]', e)
    return { success: false, error: { code: 'HR-004', message: 'Something went wrong. Please try again.' } }
  }
}

export async function updateEmployee(payload: {
  id: string
  employeeNumber?: string
  fullName?: string
  phone?: string
  email?: string
  department?: string
  designation?: string
  employeeType?: string
  joinDate?: string
  exitDate?: string | null
  isActive?: boolean
  salaryType?: string
  basicSalary?: number
  allowances?: Allowance[]
  notes?: string
}): Result<EmployeeRecord> {
  try {
    const prisma = getPrisma()
    const data: any = {}
    if (payload.employeeNumber !== undefined) data.employeeNumber = payload.employeeNumber || null
    if (payload.fullName !== undefined) data.fullName = payload.fullName.trim()
    if (payload.phone !== undefined) data.phone = payload.phone?.trim() || null
    if (payload.email !== undefined) data.email = payload.email?.trim() || null
    if (payload.department !== undefined) data.department = payload.department?.trim() || null
    if (payload.designation !== undefined) data.designation = payload.designation?.trim() || null
    if (payload.employeeType !== undefined) data.employeeType = payload.employeeType
    if (payload.joinDate !== undefined) data.joinDate = new Date(payload.joinDate)
    if (payload.exitDate !== undefined) data.exitDate = payload.exitDate ? new Date(payload.exitDate) : null
    if (payload.isActive !== undefined) data.isActive = payload.isActive
    if (payload.salaryType !== undefined) data.salaryType = payload.salaryType
    if (payload.basicSalary !== undefined) data.basicSalary = payload.basicSalary
    if (payload.allowances !== undefined) data.allowances = JSON.stringify(payload.allowances)
    if (payload.notes !== undefined) data.notes = payload.notes?.trim() || null

    const e = await prisma.employee.update({ where: { id: payload.id }, data })
    return { success: true, data: toEmployee(e) }
  } catch (e: any) {
    console.error('[HR-005]', e)
    return { success: false, error: { code: 'HR-005', message: 'Something went wrong. Please try again.' } }
  }
}

export async function deactivateEmployee(id: string): Result<void> {
  try {
    const prisma = getPrisma()
    await prisma.employee.update({ where: { id }, data: { isActive: false, exitDate: new Date() } })
    return { success: true }
  } catch (e: any) {
    console.error('[HR-006]', e)
    return { success: false, error: { code: 'HR-006', message: 'Something went wrong. Please try again.' } }
  }
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export async function markAttendance(payload: {
  employeeId: string
  date: string
  status: string
  checkIn?: string
  checkOut?: string
  notes?: string
}): Result<AttendanceRecord> {
  try {
    const prisma = getPrisma()
    const date = new Date(payload.date)
    date.setUTCHours(0, 0, 0, 0)

    const a = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: payload.employeeId, date } },
      create: {
        employeeId: payload.employeeId,
        date,
        status: payload.status,
        checkIn: payload.checkIn || null,
        checkOut: payload.checkOut || null,
        notes: payload.notes?.trim() || null
      },
      update: {
        status: payload.status,
        checkIn: payload.checkIn !== undefined ? (payload.checkIn || null) : undefined,
        checkOut: payload.checkOut !== undefined ? (payload.checkOut || null) : undefined,
        notes: payload.notes !== undefined ? (payload.notes?.trim() || null) : undefined
      },
      include: { employee: { select: { fullName: true } } }
    })
    return { success: true, data: toAttendance(a) }
  } catch (e: any) {
    console.error('[HR-010]', e)
    return { success: false, error: { code: 'HR-010', message: 'Something went wrong. Please try again.' } }
  }
}

export async function bulkMarkAttendance(payload: {
  date: string
  records: { employeeId: string; status: string }[]
}): Result<{ count: number }> {
  try {
    const prisma = getPrisma()
    const date = new Date(payload.date)
    date.setUTCHours(0, 0, 0, 0)

    let count = 0
    for (const r of payload.records) {
      await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: r.employeeId, date } },
        create: { employeeId: r.employeeId, date, status: r.status },
        update: { status: r.status }
      })
      count++
    }
    return { success: true, data: { count } }
  } catch (e: any) {
    console.error('[HR-011]', e)
    return { success: false, error: { code: 'HR-011', message: 'Something went wrong. Please try again.' } }
  }
}

export async function getMonthAttendance(payload: {
  year: number
  month: number
  employeeId?: string
}): Result<{ records: AttendanceRecord[] }> {
  try {
    const prisma = getPrisma()
    // BUG FOUND 2026-07-22: markAttendance/bulkMarkAttendance store `date`
    // at UTC midnight (setUTCHours(0,0,0,0)), but this boundary used to be
    // built with the LOCAL Date constructor — a basis mismatch that only
    // manifests for a negative UTC offset (this app's IST-based primary
    // market never triggers it, which is why it went unnoticed), where an
    // attendance record could be pulled into the wrong month's query.
    // Date.UTC matches the actual storage basis, same fix direction as
    // roc-filing.service.ts's fyRange().
    const from = new Date(Date.UTC(payload.year, payload.month - 1, 1))
    const to = new Date(Date.UTC(payload.year, payload.month, 0, 23, 59, 59))

    const where: any = { date: { gte: from, lte: to } }
    if (payload.employeeId) where.employeeId = payload.employeeId

    const records = await prisma.attendance.findMany({
      where,
      include: { employee: { select: { fullName: true } } },
      orderBy: [{ date: 'asc' }, { employee: { fullName: 'asc' } }]
    })
    return { success: true, data: { records: records.map(toAttendance) } }
  } catch (e: any) {
    console.error('[HR-012]', e)
    return { success: false, error: { code: 'HR-012', message: 'Something went wrong. Please try again.' } }
  }
}

export async function getMonthlySummaries(payload: {
  year: number
  month: number
}): Result<{ summaries: MonthlySummary[] }> {
  try {
    const prisma = getPrisma()
    // Same basis-mismatch fix as getMonthAttendance above.
    const from = new Date(Date.UTC(payload.year, payload.month - 1, 1))
    const to = new Date(Date.UTC(payload.year, payload.month, 0, 23, 59, 59))

    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { fullName: 'asc' }
    })

    const records = await prisma.attendance.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' }
    })

    // Group records by employee
    const byEmployee: Record<string, typeof records> = {}
    for (const r of records) {
      if (!byEmployee[r.employeeId]) byEmployee[r.employeeId] = []
      byEmployee[r.employeeId].push(r)
    }

    const daysInMonth = new Date(payload.year, payload.month, 0).getDate()

    const summaries: MonthlySummary[] = employees.map(emp => {
      const empRecords = byEmployee[emp.id] ?? []
      const count = (s: string) => empRecords.filter(r => r.status === s).length
      const present = count('PRESENT')
      const absent = count('ABSENT')
      const halfDay = count('HALF_DAY')
      const leave = count('LEAVE')
      const holiday = count('HOLIDAY')
      const weekOff = count('WEEK_OFF')
      const effectiveDays = present + halfDay * 0.5
      const allowances = parseAllowances(emp.allowances)
      const totalAllowances = allowances.reduce((s, a) => s + a.amount, 0)
      const grossSalary = emp.basicSalary + totalAllowances

      let netPayable: number
      if (emp.salaryType === 'DAILY') {
        // basicSalary is a per-day rate; allowances are fixed monthly additions
        netPayable = emp.basicSalary * effectiveDays + totalAllowances
      } else if (emp.salaryType === 'HOURLY') {
        // basicSalary is per-hour; assume 8-hour workday as reference
        netPayable = emp.basicSalary * effectiveDays * 8 + totalAllowances
      } else {
        // MONTHLY: pro-rate gross by effective days
        netPayable = daysInMonth > 0 ? (grossSalary * effectiveDays) / daysInMonth : 0
      }

      return {
        employeeId: emp.id,
        employeeName: emp.fullName,
        year: payload.year,
        month: payload.month,
        present,
        absent,
        halfDay,
        leave,
        holiday,
        weekOff,
        workingDays: daysInMonth,
        effectiveDays,
        salary: {
          basicSalary: emp.basicSalary,
          allowances,
          totalAllowances,
          grossSalary,
          workingDays: daysInMonth,
          effectiveDays,
          netPayable
        }
      }
    })

    return { success: true, data: { summaries } }
  } catch (e: any) {
    console.error('[HR-013]', e)
    return { success: false, error: { code: 'HR-013', message: 'Something went wrong. Please try again.' } }
  }
}

// ─── Leave Types ──────────────────────────────────────────────────────────────

export async function listLeaveTypes(): Result<{ leaveTypes: LeaveTypeRecord[] }> {
  try {
    const prisma = getPrisma()
    const leaveTypes = await prisma.leaveType.findMany({ orderBy: { name: 'asc' } })
    return {
      success: true,
      data: {
        leaveTypes: leaveTypes.map(lt => ({
          id: lt.id,
          name: lt.name,
          maxDays: lt.maxDays,
          isPaid: lt.isPaid,
          isActive: lt.isActive
        }))
      }
    }
  } catch (e: any) {
    console.error('[HR-020]', e)
    return { success: false, error: { code: 'HR-020', message: 'Something went wrong. Please try again.' } }
  }
}

export async function createLeaveType(payload: {
  name: string
  maxDays?: number
  isPaid?: boolean
}): Result<LeaveTypeRecord> {
  try {
    const prisma = getPrisma()
    const lt = await prisma.leaveType.create({
      data: {
        name: payload.name.trim(),
        maxDays: payload.maxDays ?? 0,
        isPaid: payload.isPaid ?? true
      }
    })
    return { success: true, data: { id: lt.id, name: lt.name, maxDays: lt.maxDays, isPaid: lt.isPaid, isActive: lt.isActive } }
  } catch (e: any) {
    if (e.code === 'P2002') return { success: false, error: { code: 'HR-021', message: 'Leave type name already exists.' } }
    console.error('[HR-022]', e)
    return { success: false, error: { code: 'HR-022', message: 'Something went wrong. Please try again.' } }
  }
}

export async function seedDefaultLeaveTypes(): Promise<void> {
  const prisma = getPrisma()
  const count = await prisma.leaveType.count()
  if (count > 0) return
  await prisma.leaveType.createMany({
    data: [
      { name: 'Casual Leave', maxDays: 12, isPaid: true },
      { name: 'Sick Leave', maxDays: 12, isPaid: true },
      { name: 'Earned Leave', maxDays: 15, isPaid: true },
      { name: 'Unpaid Leave', maxDays: 0, isPaid: false }
    ]
  })
}

// ─── Leave Requests ───────────────────────────────────────────────────────────

export async function listLeaveRequests(payload?: {
  employeeId?: string
  status?: string
  year?: number
}): Result<{ requests: LeaveRequestRecord[] }> {
  try {
    const prisma = getPrisma()
    const where: any = {}
    if (payload?.employeeId) where.employeeId = payload.employeeId
    if (payload?.status) where.status = payload.status
    if (payload?.year) {
      // fromDate is stored via parseLocalDateStart (local midnight) above —
      // match that basis here too, rather than the local-vs-stored mismatch
      // this file had elsewhere for attendance dates.
      where.fromDate = {
        gte: new Date(payload.year, 0, 1),
        lte: new Date(payload.year, 11, 31, 23, 59, 59)
      }
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { fullName: true } },
        leaveType: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return {
      success: true,
      data: {
        requests: requests.map(r => ({
          id: r.id,
          employeeId: r.employeeId,
          employeeName: r.employee?.fullName ?? '',
          leaveTypeId: r.leaveTypeId,
          leaveTypeName: r.leaveType?.name ?? '',
          fromDate: new Date(r.fromDate).toISOString(),
          toDate: new Date(r.toDate).toISOString(),
          days: r.days,
          reason: r.reason ?? null,
          status: r.status,
          approvedBy: r.approvedBy ?? null,
          approvedAt: r.approvedAt ? new Date(r.approvedAt).toISOString() : null,
          notes: r.notes ?? null,
          createdAt: new Date(r.createdAt).toISOString()
        }))
      }
    }
  } catch (e: any) {
    console.error('[HR-030]', e)
    return { success: false, error: { code: 'HR-030', message: 'Something went wrong. Please try again.' } }
  }
}

export async function createLeaveRequest(payload: {
  employeeId: string
  leaveTypeId: string
  fromDate: string
  toDate: string
  days: number
  reason?: string
}): Result<LeaveRequestRecord> {
  try {
    const prisma = getPrisma()
    const r = await prisma.leaveRequest.create({
      data: {
        employeeId: payload.employeeId,
        leaveTypeId: payload.leaveTypeId,
        // BUG FOUND 2026-07-22: new Date(dateOnlyString) parses as UTC
        // midnight, not local midnight — same bug class fixed across many
        // other files this session.
        fromDate: parseLocalDateStart(payload.fromDate),
        toDate: parseLocalDateStart(payload.toDate),
        days: payload.days,
        reason: payload.reason?.trim() || null
      },
      include: {
        employee: { select: { fullName: true } },
        leaveType: { select: { name: true } }
      }
    })
    return {
      success: true,
      data: {
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employee?.fullName ?? '',
        leaveTypeId: r.leaveTypeId,
        leaveTypeName: r.leaveType?.name ?? '',
        fromDate: new Date(r.fromDate).toISOString(),
        toDate: new Date(r.toDate).toISOString(),
        days: r.days,
        reason: r.reason ?? null,
        status: r.status,
        approvedBy: null,
        approvedAt: null,
        notes: null,
        createdAt: new Date(r.createdAt).toISOString()
      }
    }
  } catch (e: any) {
    console.error('[HR-031]', e)
    return { success: false, error: { code: 'HR-031', message: 'Something went wrong. Please try again.' } }
  }
}

export async function updateLeaveStatus(payload: {
  id: string
  status: 'APPROVED' | 'REJECTED'
  approvedBy?: string
  notes?: string
}): Result<void> {
  try {
    const prisma = getPrisma()
    await prisma.leaveRequest.update({
      where: { id: payload.id },
      data: {
        status: payload.status,
        approvedBy: payload.approvedBy || null,
        approvedAt: new Date(),
        notes: payload.notes?.trim() || null
      }
    })
    return { success: true }
  } catch (e: any) {
    console.error('[HR-032]', e)
    return { success: false, error: { code: 'HR-032', message: 'Something went wrong. Please try again.' } }
  }
}

export async function getLeaveBalance(payload: {
  employeeId: string
  year: number
}): Result<{ balances: { leaveTypeId: string; name: string; maxDays: number; used: number; remaining: number }[] }> {
  try {
    const prisma = getPrisma()
    const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } })

    const balances = await Promise.all(
      leaveTypes.map(async lt => {
        const agg = await prisma.leaveRequest.aggregate({
          where: {
            employeeId: payload.employeeId,
            leaveTypeId: lt.id,
            status: 'APPROVED',
            fromDate: { gte: new Date(payload.year, 0, 1), lte: new Date(payload.year, 11, 31) }
          },
          _sum: { days: true }
        })
        const used = agg._sum.days ?? 0
        const remaining = lt.maxDays > 0 ? Math.max(0, lt.maxDays - used) : -1 // -1 means unlimited
        return { leaveTypeId: lt.id, name: lt.name, maxDays: lt.maxDays, used, remaining }
      })
    )

    return { success: true, data: { balances } }
  } catch (e: any) {
    console.error('[HR-033]', e)
    return { success: false, error: { code: 'HR-033', message: 'Something went wrong. Please try again.' } }
  }
}
