// A report described as data: the screen draws the summary cards, the chart and the table from this, so a new
// report is one function that returns a GenericReport plus its name in the language files.

export type ColumnType = 'text' | 'money' | 'number' | 'percent' | 'date'

export interface GenericColumn {
  key: string
  /** Language key under reports.gen, e.g. "salesByCustomer.customer". */
  labelKey: string
  type: ColumnType
}

export interface GenericChart {
  type: 'bar' | 'line' | 'pie'
  titleKey: string
  /** Column that names each bar, point or slice. */
  xKey: string
  series: Array<{ key: string; labelKey: string; money?: boolean }>
  /** Bars and slices: show only the largest N rows. */
  limit?: number
}

export type CellValue = string | number | null

export interface GenericReport {
  id: string
  dateFrom?: string
  dateTo?: string
  decimals: number
  summary: Array<{ labelKey: string; type: ColumnType; value: CellValue }>
  columns: GenericColumn[]
  rows: Array<Record<string, CellValue>>
  totals?: Record<string, CellValue>
  chart: GenericChart
  /** When the chart needs different rows from the table (for example one bar per movement type). */
  chartRows?: Array<Record<string, CellValue>>
  /** Fixed explanations, keys under reports.gen.notes. */
  notes: string[]
}

export interface GenericReportParams {
  dateFrom: string
  dateTo: string
  /** For reports as at one date (stock, receivables). */
  asOf?: string
}

export interface GenericReportDefinition {
  permission: string
  run: (params: GenericReportParams) => Promise<GenericReport>
}
