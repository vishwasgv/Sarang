import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts'
import { cn } from '@shared/utils/cn'
import { formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'

// Draws any report that the main process describes as data (generic-report.types.ts).

export type ColumnType = 'text' | 'money' | 'number' | 'percent' | 'date'
export type CellValue = string | number | null
export interface GenericColumn { key: string; labelKey: string; type: ColumnType }
export interface GenericChart { type: 'bar' | 'line' | 'pie'; titleKey: string; xKey: string; series: { key: string; labelKey: string; money?: boolean }[]; limit?: number }
export interface GenericReport {
  id: string; dateFrom?: string; dateTo?: string; decimals: number
  summary: { labelKey: string; type: ColumnType; value: CellValue }[]
  columns: GenericColumn[]
  rows: Record<string, CellValue>[]
  totals?: Record<string, CellValue>
  chart: GenericChart
  notes: string[]
}

/** Ids of the reports served by the generic channel. Keep in step with generic-reports.registry.ts (a test checks it). */
export const GENERIC_REPORT_IDS = [
  'salesByCustomer', 'salesByItem', 'salesByCategory', 'salesBySalesperson'
] as const
export type GenericReportId = typeof GENERIC_REPORT_IDS[number]

type Fmt = (n: number) => string
const PALETTE = ['#00AEEF', '#22C55E', '#F59E0B', '#8B5CF6', '#EF4444', '#64748B', '#14B8A6', '#EC4899', '#84CC16', '#F97316']
const TICK = { fontSize: 11, fill: '#94a3b8' }
const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }
const PANEL = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700'

export function isGenericReport(id: string): id is GenericReportId {
  return (GENERIC_REPORT_IDS as readonly string[]).includes(id)
}

const label = (t: TFunction, key: string) => t(`reports.gen.${key}`)

function show(t: TFunction, v: CellValue, type: ColumnType, fmt: Fmt, isNameColumn: boolean): string {
  if (v === null || v === undefined) return ''
  if (type === 'money') return fmt(Number(v))
  if (type === 'percent') return `${v}%`
  if (type === 'number') return Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })
  if (type === 'date') return formatDate(String(v))
  return v === '' && isNameColumn ? t('reports.gen.unassigned') : String(v)
}

function chartRows(d: GenericReport, t: TFunction) {
  const limit = d.chart.limit ?? d.rows.length
  return d.rows.slice(0, limit).map((r) => {
    const out: Record<string, CellValue> = { name: r[d.chart.xKey] === '' ? t('reports.gen.unassigned') : (r[d.chart.xKey] as CellValue) }
    for (const s of d.chart.series) out[label(t, s.labelKey)] = r[s.key] as CellValue
    return out
  })
}

export function GenericReportView({ data, fmt }: { data: GenericReport; fmt: Fmt }) {
  const { t } = useTranslation()
  const rows = chartRows(data, t)
  const seriesNames = data.chart.series.map((s) => label(t, s.labelKey))
  const nameCol = data.columns[0]?.key
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {data.summary.map((c) => (
          <Card key={c.labelKey} padding="md">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">{label(t, c.labelKey)}</div>
            <div className="text-xl font-bold text-dark dark:text-slate-100">{show(t, c.value, c.type, fmt, false)}</div>
          </Card>
        ))}
      </div>

      {data.rows.length > 0 && (
        <div className={cn(PANEL, 'p-5')}>
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{label(t, data.chart.titleKey)}</h3>
          <ResponsiveContainer width="100%" height={280}>
            {data.chart.type === 'pie' ? (
              <PieChart>
                <Pie data={rows} dataKey={seriesNames[0]} nameKey="name" outerRadius={100}>
                  {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => (data.chart.series[0].money ? fmt(v) : v)} />
                <Legend />
              </PieChart>
            ) : data.chart.type === 'line' ? (
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
                <Legend />
                {seriesNames.map((n, i) => <Line key={n} type="monotone" dataKey={n} stroke={PALETTE[i % PALETTE.length]} dot={false} />)}
              </LineChart>
            ) : (
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
                {seriesNames.length > 1 && <Legend />}
                {seriesNames.map((n, i) => <Bar key={n} dataKey={n} fill={PALETTE[i % PALETTE.length]} />)}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      <div className={cn(PANEL, 'overflow-x-auto')}>
        {data.rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">{t('reports.gen.noRows')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
                {data.columns.map((c) => (
                  <th key={c.key} className={cn('px-4 py-3', c.type === 'text' || c.type === 'date' ? 'text-start' : 'text-end')}>{label(t, c.labelKey)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50 dark:border-slate-800">
                  {data.columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-2.5', c.type === 'text' || c.type === 'date' ? 'text-start' : 'text-end')}>{show(t, r[c.key], c.type, fmt, c.key === nameCol)}</td>
                  ))}
                </tr>
              ))}
              {data.totals && (
                <tr className="font-bold">
                  {data.columns.map((c, i) => (
                    <td key={c.key} className={cn('px-4 py-3', c.type === 'text' || c.type === 'date' ? 'text-start' : 'text-end')}>
                      {i === 0 ? t('common.total') : show(t, data.totals![c.key] ?? null, c.type, fmt, false)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {data.notes.length > 0 && (
        <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc ps-5">
          {data.notes.map((k) => <li key={k}>{label(t, `notes.${k}`)}</li>)}
        </ul>
      )}
    </div>
  )
}

type Cell2 = string | number | null

export function genericReportExport(data: unknown, t: TFunction, cur: string): { headers: string[]; rows: Cell2[][] } {
  const d = data as GenericReport
  const head = (c: GenericColumn) => (c.type === 'money' ? `${label(t, c.labelKey)} (${cur})` : label(t, c.labelKey))
  const cell = (c: GenericColumn, v: CellValue): Cell2 => (v === '' && c === d.columns[0] ? t('reports.gen.unassigned') : v)
  const rows: Cell2[][] = d.rows.map((r) => d.columns.map((c) => cell(c, r[c.key] as CellValue)))
  if (d.totals) rows.push(d.columns.map((c, i) => (i === 0 ? t('common.total') : ((d.totals![c.key] ?? '') as Cell2))))
  return { headers: d.columns.map(head), rows }
}

export function genericReportSummary(data: unknown, t: TFunction, fmt: Fmt): { label: string; value: string }[] {
  const d = data as GenericReport
  return d.summary.map((c) => ({ label: label(t, c.labelKey), value: show(t, c.value, c.type, fmt, false) }))
}

type PdfChart =
  | { type: 'bar'; title: string; data: { label: string; value: number; color?: string }[]; valueIsCurrency?: boolean }
  | { type: 'line'; title: string; data: { label: string; value: number }[]; valueIsCurrency?: boolean }
  | { type: 'pie'; title: string; data: { label: string; value: number; color?: string }[]; valueIsCurrency?: boolean }

export function genericReportCharts(data: unknown, t: TFunction): PdfChart[] {
  const d = data as GenericReport
  if (d.rows.length === 0) return []
  const limit = d.chart.limit ?? d.rows.length
  const s = d.chart.series[0]
  const points = d.rows.slice(0, limit).map((r, i) => ({
    label: r[d.chart.xKey] === '' ? t('reports.gen.unassigned') : String(r[d.chart.xKey] ?? ''),
    value: Number(r[s.key] ?? 0),
    color: PALETTE[i % PALETTE.length]
  }))
  const title = label(t, d.chart.titleKey)
  if (d.chart.type === 'line') return [{ type: 'line', title, data: points.map(({ label: l, value }) => ({ label: l, value })), valueIsCurrency: s.money }]
  if (d.chart.type === 'pie') return [{ type: 'pie', title, data: points, valueIsCurrency: s.money }]
  return [{ type: 'bar', title, data: points.map((p) => ({ ...p, color: PALETTE[0] })), valueIsCurrency: s.money }]
}
