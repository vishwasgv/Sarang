import {
  listEmployees, getEmployee, createEmployee, updateEmployee, deactivateEmployee,
  markAttendance, bulkMarkAttendance, getMonthAttendance, getMonthlySummaries,
  listLeaveTypes, createLeaveType,
  listLeaveRequests, createLeaveRequest, updateLeaveStatus, getLeaveBalance
} from '../../services/hr.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  DeactivateEmployeeSchema,
  MarkAttendanceSchema,
  BulkMarkAttendanceSchema,
  CreateLeaveTypeSchema,
  CreateLeaveRequestSchema,
  UpdateLeaveStatusSchema,
} from '../../validation/hr.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  // ─── Employees ─────────────────────────────────────────────────────────────

  handle('hr:listEmployees', async (payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    return listEmployees(payload as Parameters<typeof listEmployees>[0])
  })

  handle('hr:getEmployee', async (payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    const p = payload as { id: string }
    return getEmployee(p.id)
  })

  handle('hr:createEmployee', async (payload) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    const parsed = CreateEmployeeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createEmployee(parsed.data)
  })

  handle('hr:updateEmployee', async (payload) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    const parsed = UpdateEmployeeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateEmployee(parsed.data)
  })

  handle('hr:deactivateEmployee', async (payload) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    const parsed = DeactivateEmployeeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deactivateEmployee(parsed.data.id)
  })

  // ─── Attendance ─────────────────────────────────────────────────────────────

  handle('hr:markAttendance', async (payload) => {
    const deny = await requirePermission('hr.attendance'); if (deny) return deny
    const parsed = MarkAttendanceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return markAttendance(parsed.data)
  })

  handle('hr:bulkMarkAttendance', async (payload) => {
    const deny = await requirePermission('hr.attendance'); if (deny) return deny
    const parsed = BulkMarkAttendanceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return bulkMarkAttendance(parsed.data)
  })

  handle('hr:getMonthAttendance', async (payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    return getMonthAttendance(payload as Parameters<typeof getMonthAttendance>[0])
  })

  handle('hr:getMonthlySummaries', async (payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    return getMonthlySummaries(payload as Parameters<typeof getMonthlySummaries>[0])
  })

  // ─── Leave Types ────────────────────────────────────────────────────────────

  handle('hr:listLeaveTypes', async (_payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    return listLeaveTypes()
  })

  handle('hr:createLeaveType', async (payload) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    const parsed = CreateLeaveTypeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createLeaveType(parsed.data)
  })

  // ─── Leave Requests ─────────────────────────────────────────────────────────

  handle('hr:listLeaveRequests', async (payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    return listLeaveRequests(payload as Parameters<typeof listLeaveRequests>[0])
  })

  handle('hr:createLeaveRequest', async (payload) => {
    const deny = await requirePermission('hr.attendance'); if (deny) return deny
    const parsed = CreateLeaveRequestSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createLeaveRequest(parsed.data)
  })

  handle('hr:updateLeaveStatus', async (payload) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    const parsed = UpdateLeaveStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return updateLeaveStatus({ ...parsed.data, approvedBy: session?.userId })
  })

  handle('hr:getLeaveBalance', async (payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    return getLeaveBalance(payload as Parameters<typeof getLeaveBalance>[0])
  })
}
