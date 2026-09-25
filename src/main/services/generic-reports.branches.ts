import { getPrisma } from '../database/db'
import { getCurrencyDecimals, sumMoney } from '../../shared/utils/money'
import { buildOwnFigures, type BranchFigures } from './branch-summary.service'
import type { CellValue, GenericReport, GenericReportDefinition, GenericReportParams } from './generic-report.types'

type Row = Record<string, CellValue>

// This business next to the branch files that were imported for the same dates.
async function branchConsolidation(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
  const decimals = getCurrencyDecimals(profile?.currencyCode)
  const [own, imported] = await Promise.all([
    buildOwnFigures({ dateFrom: p.dateFrom, dateTo: p.dateTo }),
    db.branchSummary.findMany({ where: { periodFrom: { gte: p.dateFrom }, periodTo: { lte: p.dateTo } }, orderBy: { branchName: 'asc' } })
  ])
  const toRow = (name: string, f: BranchFigures): Row => ({
    branch: name, sales: f.sales, purchases: f.purchases, expenses: f.expenses, receivables: f.receivables, payables: f.payables, stockValue: f.stockValue, cashAndBank: f.cashAndBank
  })
  const rows: Row[] = [toRow(own.businessName, own.figures), ...imported.map((r) => toRow(r.branchName, JSON.parse(r.figures) as BranchFigures))]
  const sum = (k: string) => sumMoney(rows.map((r) => Number(r[k])), decimals)
  const mixed = imported.some((r) => r.currency !== '' && r.currency !== own.currency)
  return {
    id: 'branchConsolidation', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'branches.count', type: 'number', value: rows.length },
      { labelKey: 'branches.sales', type: 'money', value: sum('sales') },
      { labelKey: 'branches.purchases', type: 'money', value: sum('purchases') },
      { labelKey: 'branches.expenses', type: 'money', value: sum('expenses') }
    ],
    columns: [
      { key: 'branch', labelKey: 'branches.branch', type: 'text' },
      { key: 'sales', labelKey: 'branches.sales', type: 'money' },
      { key: 'purchases', labelKey: 'branches.purchases', type: 'money' },
      { key: 'expenses', labelKey: 'branches.expenses', type: 'money' },
      { key: 'receivables', labelKey: 'branches.receivables', type: 'money' },
      { key: 'payables', labelKey: 'branches.payables', type: 'money' },
      { key: 'stockValue', labelKey: 'branches.stockValue', type: 'money' },
      { key: 'cashAndBank', labelKey: 'branches.cashAndBank', type: 'money' }
    ],
    rows,
    totals: { branch: '', sales: sum('sales'), purchases: sum('purchases'), expenses: sum('expenses'), receivables: sum('receivables'), payables: sum('payables'), stockValue: sum('stockValue'), cashAndBank: sum('cashAndBank') },
    chart: { type: 'bar', titleKey: 'branches.chart', xKey: 'branch', series: [{ key: 'sales', labelKey: 'branches.sales', money: true }, { key: 'purchases', labelKey: 'branches.purchases', money: true }] },
    notes: mixed ? ['branches.method', 'branches.currencyMixed'] : ['branches.method']
  }
}

export const BRANCH_REPORTS: Record<string, GenericReportDefinition> = {
  branchConsolidation: { permission: 'analytics.viewProfit', run: branchConsolidation }
}
