import { app, BrowserWindow } from 'electron'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import {
  listPayrollForPeriod, generatePayrollForPeriod, updateSalaryPayment, markSalaryPaid, getSalaryPayment
} from '../../services/payroll.service'
import { getEmployee } from '../../services/hr.service'
import { printService } from '../../services/print.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { getPrisma } from '../../database/db'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('payroll:listForPeriod', async (payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    return listPayrollForPeriod(payload as { year: number; month: number })
  })

  handle('payroll:generate', async (payload) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    return generatePayrollForPeriod(payload as { year: number; month: number })
  })

  handle('payroll:updateDeductions', async (payload) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    return updateSalaryPayment(payload as Parameters<typeof updateSalaryPayment>[0])
  })

  handle('payroll:markPaid', async (payload) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    const session = getCurrentSession()
    const p = payload as { id: string; paymentMethod: string; paidDate?: string }
    return markSalaryPaid({ ...p, userId: session?.userId })
  })

  handle('payroll:print', async (payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    const { id } = payload as { id: string }
    const salaryRes = await getSalaryPayment(id)
    if (!salaryRes.success || !salaryRes.data) return salaryRes
    const empRes = await getEmployee(salaryRes.data.employeeId)
    const employee = empRes.success ? empRes.data : null

    const db = getPrisma()
    const profile = await db.businessProfile.findFirst()
    const html = await printService.generatePayslipHtml({
      employeeName: salaryRes.data.employeeName,
      employeeNumber: employee?.employeeNumber ?? null,
      designation: employee?.designation ?? null,
      periodYear: salaryRes.data.periodYear,
      periodMonth: salaryRes.data.periodMonth,
      basicSalary: salaryRes.data.basicSalary,
      allowances: salaryRes.data.allowances,
      grossSalary: salaryRes.data.grossSalary,
      deductions: salaryRes.data.deductions,
      totalDeductions: salaryRes.data.totalDeductions,
      netPayable: salaryRes.data.netPayable,
      status: salaryRes.data.status,
      paidDate: salaryRes.data.paidDate,
      paymentMethod: salaryRes.data.paymentMethod,
    }, profile as Parameters<typeof printService.generatePayslipHtml>[1])

    const tmpPath = join(app.getPath('temp'), `sarang_payslip_${Date.now()}.html`)
    await writeFile(tmpPath, html, 'utf-8')
    return new Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }>((resolve) => {
      const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
      win.loadFile(tmpPath)
      win.webContents.once('did-finish-load', () => {
        win.webContents.print({ silent: false, printBackground: true, color: true }, (success: boolean) => {
          win.close()
          unlink(tmpPath).catch(() => {})
          resolve({ success: true, data: { printed: success } })
        })
      })
    })
  })
}
