import { sumMoney, prorateAmount } from '../../shared/utils/money'
import type { GenericReport, GenericReportDefinition, GenericReportParams, CellValue } from './generic-report.types'
import { loadSalesLines, type SalesLine } from './sales-lines.query'
import { MONEY_REPORTS } from './generic-reports.money'

// Reports described as data (see generic-report.types.ts). Each entry names the permission it needs and how to
// build it. To add one: write the function, add it to REGISTRY, add its name to reports.defs and its column names
// to reports.gen in the language file, and list the id in the screen (GENERIC_REPORT_IDS).

interface Group { key: string; label: string; invoices: Set<string>; quantity: number[]; taxable: number[]; tax: number[]; total: number[] }

function groupSales(lines: SalesLine[], keyOf: (l: SalesLine) => string, labelOf: (l: SalesLine) => string): Group[] {
  const map = new Map<string, Group>()
  for (const l of lines) {
    const key = keyOf(l)
    const g = map.get(key) ?? { key, label: labelOf(l), invoices: new Set<string>(), quantity: [], taxable: [], tax: [], total: [] }
    g.invoices.add(l.invoiceId)
    g.quantity.push(l.quantity)
    g.taxable.push(l.taxable)
    g.tax.push(l.tax)
    g.total.push(l.total)
    map.set(key, g)
  }
  return Array.from(map.values())
}

function salesBy(id: string, dimension: 'customer' | 'item' | 'category' | 'salesperson', chartType: 'bar' | 'pie') {
  return async (p: GenericReportParams): Promise<GenericReport> => {
    const { lines, decimals } = await loadSalesLines(p)
    const groups = groupSales(
      lines,
      (l) => (dimension === 'customer' ? l.customerId ?? '' : dimension === 'item' ? l.productId : dimension === 'category' ? l.categoryId ?? '' : l.salespersonId ?? ''),
      (l) => (dimension === 'customer' ? l.customerName : dimension === 'item' ? l.productName : dimension === 'category' ? l.categoryName : l.salespersonName)
    )
    const totalTaxable = sumMoney(lines.map((l) => l.taxable), decimals)
    const rows = groups
      .map((g) => ({
        name: g.label,
        invoices: g.invoices.size,
        quantity: sumMoney(g.quantity, 3),
        taxable: sumMoney(g.taxable, decimals),
        tax: sumMoney(g.tax, decimals),
        total: sumMoney(g.total, decimals)
      }))
      .sort((a, b) => b.taxable - a.taxable)
      .map((r): Record<string, CellValue> => ({ ...r, share: totalTaxable > 0 ? prorateAmount(100, r.taxable, totalTaxable, 1) : 0 }))

    return {
      id,
      dateFrom: p.dateFrom,
      dateTo: p.dateTo,
      decimals,
      summary: [
        { labelKey: 'salesBy.totalSales', type: 'money', value: totalTaxable },
        { labelKey: `salesBy.count.${dimension}`, type: 'number', value: rows.length },
        { labelKey: 'salesBy.average', type: 'money', value: rows.length > 0 ? prorateAmount(totalTaxable, 1, rows.length, decimals) : 0 }
      ],
      columns: [
        { key: 'name', labelKey: `salesBy.name.${dimension}`, type: 'text' },
        { key: 'invoices', labelKey: 'salesBy.invoices', type: 'number' },
        { key: 'quantity', labelKey: 'salesBy.quantity', type: 'number' },
        { key: 'taxable', labelKey: 'salesBy.taxable', type: 'money' },
        { key: 'tax', labelKey: 'salesBy.tax', type: 'money' },
        { key: 'total', labelKey: 'salesBy.total', type: 'money' },
        { key: 'share', labelKey: 'salesBy.share', type: 'percent' }
      ],
      rows,
      totals: {
        name: '',
        invoices: new Set(lines.map((l) => l.invoiceId)).size,
        quantity: sumMoney(lines.map((l) => l.quantity), 3),
        taxable: totalTaxable,
        tax: sumMoney(lines.map((l) => l.tax), decimals),
        total: sumMoney(lines.map((l) => l.total), decimals),
        share: rows.length > 0 ? 100 : 0
      },
      chart: { type: chartType, titleKey: `salesBy.chart.${dimension}`, xKey: 'name', series: [{ key: 'taxable', labelKey: 'salesBy.taxable', money: true }], limit: 10 },
      notes: ['salesBy.returnsNetted', 'salesBy.creditNotesExcluded']
    }
  }
}

export const GENERIC_REPORTS: Record<string, GenericReportDefinition> = {
  salesByCustomer: { permission: 'reports.sales', run: salesBy('salesByCustomer', 'customer', 'bar') },
  salesByItem: { permission: 'reports.sales', run: salesBy('salesByItem', 'item', 'bar') },
  salesByCategory: { permission: 'reports.sales', run: salesBy('salesByCategory', 'category', 'pie') },
  salesBySalesperson: { permission: 'reports.sales', run: salesBy('salesBySalesperson', 'salesperson', 'bar') },
  ...MONEY_REPORTS
}

export const GENERIC_REPORT_IDS: string[] = Object.keys(GENERIC_REPORTS)
