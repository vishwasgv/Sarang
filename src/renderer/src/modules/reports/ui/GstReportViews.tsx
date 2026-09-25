import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts'
import { cn } from '@shared/utils/cn'
import { formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'

// GST Net Payable & Input Credit. Local copy of the shape returned by gst-input-credit.service.ts
// (the renderer does not import from the main process).

export interface TaxHeads { cgst: number; sgst: number; igst: number; total: number }
export interface InputCreditRow {
  sourceType: 'BILL' | 'PURCHASE_ORDER' | 'DEBIT_NOTE'
  documentNumber: string; date: string; party: string
  itc: TaxHeads; reverseCharge: TaxHeads
}
export interface GstNetPayableReport {
  dateFrom: string; dateTo: string; decimals: number
  output: TaxHeads; reverseCharge: TaxHeads; inputCredit: TaxHeads; netPayable: TaxHeads
  creditCarriedForward: boolean
  rows: InputCreditRow[]
  stateUnknownCount: number
  notes: { code: 'earlierPurchases' | 'setOffLater' | 'composition' | 'stateUnknown'; count?: number }[]
}

export type GstReportId = 'gstNetPayable'
export const GST_REPORT_IDS: GstReportId[] = ['gstNetPayable']

type Fmt = (n: number) => string
type Cell = string | number | null

const COLORS = { brand: '#00AEEF', success: '#22C55E', warning: '#F59E0B' }
const TICK = { fontSize: 11, fill: '#94a3b8' }
const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }
const PANEL = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700'
const HEADS: { key: 'cgst' | 'sgst' | 'igst'; label: string }[] = [
  { key: 'cgst', label: 'CGST' },
  { key: 'sgst', label: 'SGST' },
  { key: 'igst', label: 'IGST' }
]

function payableByHead(d: GstNetPayableReport, key: 'cgst' | 'sgst' | 'igst'): number {
  return Math.round((d.output[key] + d.reverseCharge[key]) * 10 ** d.decimals) / 10 ** d.decimals
}

function chartRows(d: GstNetPayableReport, t: TFunction) {
  return HEADS.map(({ key, label }) => ({
    name: label,
    [t('reports.gst.taxPayable')]: payableByHead(d, key),
    [t('reports.gst.inputCredit')]: d.inputCredit[key],
    [t('reports.gst.netPayable')]: d.netPayable[key]
  }))
}

function sourceLabel(t: TFunction, s: InputCreditRow['sourceType']): string {
  return t(`reports.gst.source.${s}`)
}

function noteText(t: TFunction, n: GstNetPayableReport['notes'][number]): string {
  return t(`reports.gst.note.${n.code}`, { count: n.count ?? 0 })
}

export function GstNetPayableView({ data, fmt }: { data: GstNetPayableReport; fmt: Fmt }) {
  const { t } = useTranslation()
  const rows = chartRows(data, t)
  const series = [t('reports.gst.taxPayable'), t('reports.gst.inputCredit'), t('reports.gst.netPayable')]
  const cards = [
    { label: t('reports.gst.taxOnSales'), value: fmt(data.output.total) },
    { label: t('reports.gst.reverseCharge'), value: fmt(data.reverseCharge.total) },
    { label: t('reports.gst.inputCredit'), value: fmt(data.inputCredit.total) },
    { label: data.creditCarriedForward ? t('reports.gst.creditForward') : t('reports.gst.netPayable'), value: fmt(Math.abs(data.netPayable.total)) }
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} padding="md">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">{c.label}</div>
            <div className="text-xl font-bold text-dark dark:text-slate-100">{c.value}</div>
          </Card>
        ))}
      </div>

      <div className={cn(PANEL, 'p-5')}>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.gst.chartTitle')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
            <Legend />
            <Bar dataKey={series[0]} fill={COLORS.warning} />
            <Bar dataKey={series[1]} fill={COLORS.success} />
            <Bar dataKey={series[2]} fill={COLORS.brand} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={cn(PANEL, 'overflow-x-auto')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
              <th className="px-5 py-3 text-start">{t('reports.gst.head')}</th>
              <th className="px-5 py-3 text-end">{t('reports.gst.taxOnSales')}</th>
              <th className="px-5 py-3 text-end">{t('reports.gst.reverseCharge')}</th>
              <th className="px-5 py-3 text-end">{t('reports.gst.inputCredit')}</th>
              <th className="px-5 py-3 text-end">{t('reports.gst.netPayable')}</th>
            </tr>
          </thead>
          <tbody>
            {HEADS.map(({ key, label }) => (
              <tr key={key} className="border-b border-slate-50 dark:border-slate-800">
                <td className="px-5 py-2.5 font-medium text-dark dark:text-slate-100">{label}</td>
                <td className="px-5 py-2.5 text-end">{fmt(data.output[key])}</td>
                <td className="px-5 py-2.5 text-end">{fmt(data.reverseCharge[key])}</td>
                <td className="px-5 py-2.5 text-end">{fmt(data.inputCredit[key])}</td>
                <td className="px-5 py-2.5 text-end font-semibold">{fmt(data.netPayable[key])}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="px-5 py-3">{t('common.total')}</td>
              <td className="px-5 py-3 text-end">{fmt(data.output.total)}</td>
              <td className="px-5 py-3 text-end">{fmt(data.reverseCharge.total)}</td>
              <td className="px-5 py-3 text-end">{fmt(data.inputCredit.total)}</td>
              <td className="px-5 py-3 text-end">{fmt(data.netPayable.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {data.creditCarriedForward && <Badge variant="success">{t('reports.gst.creditForwardNote')}</Badge>}

      <div className={cn(PANEL, 'overflow-x-auto')}>
        <h3 className="px-5 pt-4 text-sm font-semibold text-dark dark:text-slate-100">{t('reports.gst.documents')}</h3>
        {data.rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">{t('reports.gst.noRows')}</p>
        ) : (
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
                <th className="px-5 py-3 text-start">{t('common.date')}</th>
                <th className="px-5 py-3 text-start">{t('reports.gst.document')}</th>
                <th className="px-5 py-3 text-start">{t('reports.gst.party')}</th>
                <th className="px-5 py-3 text-end">CGST</th>
                <th className="px-5 py-3 text-end">SGST</th>
                <th className="px-5 py-3 text-end">IGST</th>
                <th className="px-5 py-3 text-end">{t('reports.gst.inputCredit')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={`${r.sourceType}-${r.documentNumber}-${i}`} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="px-5 py-2.5">{formatDate(r.date)}</td>
                  <td className="px-5 py-2.5">{sourceLabel(t, r.sourceType)} {r.documentNumber}</td>
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-300">{r.party}</td>
                  <td className="px-5 py-2.5 text-end">{fmt(r.itc.cgst)}</td>
                  <td className="px-5 py-2.5 text-end">{fmt(r.itc.sgst)}</td>
                  <td className="px-5 py-2.5 text-end">{fmt(r.itc.igst)}</td>
                  <td className="px-5 py-2.5 text-end font-semibold">{fmt(r.itc.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc ps-5">
        {data.notes.map((n) => <li key={n.code}>{noteText(t, n)}</li>)}
      </ul>
    </div>
  )
}

export function gstReportExport(_id: GstReportId, data: unknown, t: TFunction, cur: string): { headers: string[]; rows: Cell[][] } {
  const d = data as GstNetPayableReport
  const amt = (label: string) => `${label} (${cur})`
  const headers = [t('reports.gst.head'), amt(t('reports.gst.taxOnSales')), amt(t('reports.gst.reverseCharge')), amt(t('reports.gst.inputCredit')), amt(t('reports.gst.netPayable'))]
  const rows: Cell[][] = HEADS.map(({ key, label }): Cell[] => [label, d.output[key], d.reverseCharge[key], d.inputCredit[key], d.netPayable[key]])
  rows.push([t('common.total'), d.output.total, d.reverseCharge.total, d.inputCredit.total, d.netPayable.total])
  rows.push(['', '', '', '', ''])
  rows.push([t('common.date'), `${t('reports.gst.document')}`, t('reports.gst.party'), 'CGST / SGST / IGST', amt(t('reports.gst.inputCredit'))])
  for (const r of d.rows) {
    rows.push([r.date, `${sourceLabel(t, r.sourceType)} ${r.documentNumber}`, r.party, `${r.itc.cgst} / ${r.itc.sgst} / ${r.itc.igst}`, r.itc.total])
  }
  return { headers, rows }
}

export function gstReportSummary(_id: GstReportId, data: unknown, t: TFunction, fmt: Fmt): { label: string; value: string }[] {
  const d = data as GstNetPayableReport
  return [
    { label: t('reports.gst.taxOnSales'), value: fmt(d.output.total) },
    { label: t('reports.gst.reverseCharge'), value: fmt(d.reverseCharge.total) },
    { label: t('reports.gst.inputCredit'), value: fmt(d.inputCredit.total) },
    { label: d.creditCarriedForward ? t('reports.gst.creditForward') : t('reports.gst.netPayable'), value: fmt(Math.abs(d.netPayable.total)) }
  ]
}

type PdfChart = { type: 'bar'; title: string; data: { label: string; value: number; color?: string }[]; valueIsCurrency?: boolean }

export function gstReportCharts(_id: GstReportId, data: unknown, t: TFunction): PdfChart[] {
  const d = data as GstNetPayableReport
  return [{
    type: 'bar', title: t('reports.gst.chartTitle'), valueIsCurrency: true,
    data: [
      { label: t('reports.gst.taxOnSales'), value: d.output.total, color: COLORS.warning },
      { label: t('reports.gst.reverseCharge'), value: d.reverseCharge.total, color: COLORS.warning },
      { label: t('reports.gst.inputCredit'), value: d.inputCredit.total, color: COLORS.success },
      { label: t('reports.gst.netPayable'), value: d.netPayable.total, color: COLORS.brand }
    ]
  }]
}
