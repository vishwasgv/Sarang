import {
  listEmployees, getEmployee, createEmployee, updateEmployee, deactivateEmployee,
  markAttendance, bulkMarkAttendance, getMonthAttendance, getMonthlySummaries,
  listLeaveTypes, createLeaveType,
  listLeaveRequests, createLeaveRequest, updateLeaveStatus, getLeaveBalance
} from '../../services/hr.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

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
    return createEmployee(payload as Parameters<typeof createEmployee>[0])
  })

  handle('hr:updateEmployee', async (payload) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    return updateEmployee(payload as Parameters<typeof updateEmployee>[0])
  })

  handle('hr:deactivateEmployee', async (payload) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    const p = payload as { id: string }
    return deactivateEmployee(p.id)
  })

  // ─── Attendance ─────────────────────────────────────────────────────────────

  handle('hr:markAttendance', async (payload) => {
    const deny = await requirePermission('hr.attendance'); if (deny) return deny
    return markAttendance(payload as Parameters<typeof markAttendance>[0])
  })

  handle('hr:bulkMarkAttendance', async (payload) => {
    const deny = await requirePermission('hr.attendance'); if (deny) return deny
    return bulkMarkAttendance(payload as Parameters<typeof bulkMarkAttendance>[0])
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
    return createLeaveType(payload as Parameters<typeof createLeaveType>[0])
  })

  // ─── Leave Requests ─────────────────────────────────────────────────────────

  handle('hr:listLeaveRequests', async (payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    return listLeaveRequests(payload as Parameters<typeof listLeaveRequests>[0])
  })

  handle('hr:createLeaveRequest', async (payload) => {
    const deny = await requirePermission('hr.attendance'); if (deny) return deny
    return createLeaveRequest(payload as Parameters<typeof createLeaveRequest>[0])
  })

  handle('hr:updateLeaveStatus', async (payload) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    const p = payload as Parameters<typeof updateLeaveStatus>[0]
    const session = getCurrentSession()
    return updateLeaveStatus({ ...p, approvedBy: session?.userId })
  })

  handle('hr:getLeaveBalance', async (payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    return getLeaveBalance(payload as Parameters<typeof getLeaveBalance>[0])
  })
}
