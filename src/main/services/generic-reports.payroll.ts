import { getPrisma } from '../database/db'
import { getCurrencyDecimals, sumMoney } from '../../shared/utils/money'
import { expectedStatutory, splitDeductions } from './payroll-statutory.util'
import type { CellValue, GenericReport, GenericReportDefinition, GenericReportParams } from './generic-report.types'

type Row = Record<string, CellValue>

// One row per employee for the month of the "to" date: basic pay, the PF, ESI and Professional Tax actually deducted,
// and whether that agrees with the rates set in Settings. The totals are the amounts to pay in at the challan.
async function payrollChallan(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const [year, month] = p.dateTo.split('-').map(Number)
  const [profile, payments] = await Promise.all([
    db.businessProfile.findFirst({ select: { currencyCode: true, statutoryPfPercent: true, statutoryEsiPercent: true, statutoryEsiWageCeiling: true, statutoryProfessionalTax: true } }),
    db.salaryPayment.findMany({
      where: { periodYear: year, periodMonth: month },
      select: { basicSalary: true, deductions: true, employee: { select: { fullName: true, employeeNumber: true } } },
      orderBy: { employee: { fullName: 'asc' } }
    })
  ])
  const decimals = getCurrencyDecimals(profile?.currencyCode)
  const cfg = { statutoryPfPercent: profile?.statutoryPfPercent ?? null, statutoryEsiPercent: profile?.statutoryEsiPercent ?? null, statutoryEsiWageCeiling: profile?.statutoryEsiWageCeiling ?? null, statutoryProfessionalTax: profile?.statutoryProfessionalTax ?? null }

  const rows: Row[] = payments.map((pay) => {
    let lines: Array<{ name: string; amount: number }> = []
    try {
      const v = JSON.parse(pay.deductions)
      if (Array.isArray(v)) lines = v
    } catch { /* an unreadable old row counts as no deductions */ }
    const got = splitDeductions(lines)
    const want = expectedStatutory(pay.basicSalary, cfg)
    const differs = (want.pf !== null && want.pf !== got.pf) || (want.esi !== null && want.esi !== got.esi) || (want.professionalTax !== null && want.professionalTax !== got.professionalTax)
    return {
      name: pay.employee.fullName, code: pay.employee.employeeNumber ?? '', basic: pay.basicSalary,
      pf: got.pf, esi: got.esi, professionalTax: got.professionalTax, other: got.other, check: differs ? 'CHECK' : 'OK'
    }
  })
  const total = (key: string) => sumMoney(rows.map((r) => Number(r[key])), decimals)
  return {
    id: 'payrollChallan', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'payroll.employees', type: 'number', value: rows.length },
      { labelKey: 'payroll.pf', type: 'money', value: total('pf') },
      { labelKey: 'payroll.esi', type: 'money', value: total('esi') },
      { labelKey: 'payroll.pt', type: 'money', value: total('professionalTax') }
    ],
    columns: [
      { key: 'name', labelKey: 'payroll.employee', type: 'text' },
      { key: 'code', labelKey: 'payroll.code', type: 'text' },
      { key: 'basic', labelKey: 'payroll.basic', type: 'money' },
      { key: 'pf', labelKey: 'payroll.pf', type: 'money' },
      { key: 'esi', labelKey: 'payroll.esi', type: 'money' },
      { key: 'professionalTax', labelKey: 'payroll.pt', type: 'money' },
      { key: 'other', labelKey: 'payroll.other', type: 'money' },
      { key: 'check', labelKey: 'payroll.check', type: 'text' }
    ],
    rows,
    totals: { name: '', code: '', basic: total('basic'), pf: total('pf'), esi: total('esi'), professionalTax: total('professionalTax'), other: total('other'), check: '' },
    chart: { type: 'bar', titleKey: 'payroll.chart', xKey: 'name', series: [{ key: 'pf', labelKey: 'payroll.pf', money: true }, { key: 'esi', labelKey: 'payroll.esi', money: true }, { key: 'professionalTax', labelKey: 'payroll.pt', money: true }], limit: 10 },
    notes: ['payroll.employeeShare', 'payroll.method']
  }
}

export const PAYROLL_REPORTS: Record<string, GenericReportDefinition> = {
  payrollChallan: { permission: 'hr.view', run: payrollChallan }
}
