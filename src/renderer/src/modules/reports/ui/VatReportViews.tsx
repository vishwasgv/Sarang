import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'

// VAT / GST / sales-tax return working paper (businesses outside India). Local copy of the shape returned by
// vat-return.service.ts.

export interface VatBucket { taxed: number; zero: number; exempt: number; outOfScope: number; tax: number }
export interface VatReturnBox { code: string; label: string; amount: number; key?: boolean }
export interface VatReturnReport {
  dateFrom: string; dateTo: string; decimals: number
  countryCode: string | null; countryName: string; taxLabel: string
  base: { sales: VatBucket; purchases: VatBucket }
  layout: { country: string; title: string; netCode: string; boxes: VatReturnBox[] }
  hasCountryLayout: boolean
  notes: ('workingPaper' | 'genericLayout')[]
}

export type VatReportId = 'vatReturn'
export const VAT_REPORT_IDS: VatReportId[] = ['vatReturn']

type Fmt = (n: number) => string
type Cell = string | number | null

const COLORS = { brand: '#00AEEF', success: '#22C55E', warning: '#F59E0B' }
const TICK = { fontSize: 11, fill: '#94a3b8' }
const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }
const PANEL = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700'

function net(d: VatReturnReport): number {
  return d.layout.boxes.find((b) => b.code === d.layout.netCode)?.amount ?? 0
}

export function VatReturnView({ data, fmt }: { data: VatReturnReport; fmt: Fmt }) {
  const { t } = useTranslation()
  const s = data.base.sales
  const p = data.base.purchases
  const cards = [
    { label: t('reports.vat.taxOnSales', { tax: data.taxLabel }), value: fmt(s.tax) },
    { label: t('reports.vat.taxOnPurchases', { tax: data.taxLabel }), value: fmt(p.tax) },
    { label: net(data) < 0 ? t('reports.vat.refund') : t('reports.vat.toPay'), value: fmt(Math.abs(net(data))) }
  ]
  const chart = [
    { name: t('reports.vat.taxed'), [t('reports.vat.sales')]: s.taxed, [t('reports.vat.purchases')]: p.taxed },
    { name: t('reports.vat.zero'), [t('reports.vat.sales')]: s.zero, [t('reports.vat.purchases')]: p.zero },
    { name: t('reports.vat.exempt'), [t('reports.vat.sales')]: s.exempt, [t('reports.vat.purchases')]: p.exempt }
  ]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label} padding="md">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">{c.label}</div>
            <div className="text-xl font-bold text-dark dark:text-slate-100">{c.value}</div>
          </Card>
        ))}
      </div>
      <div className={cn(PANEL, 'p-5')}>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.vat.chartTitle')}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
            <Bar dataKey={t('reports.vat.sales')} fill={COLORS.brand} />
            <Bar dataKey={t('reports.vat.purchases')} fill={COLORS.warning} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={cn(PANEL, 'overflow-x-auto')}>
        <h3 className="px-5 pt-4 text-sm font-semibold text-dark dark:text-slate-100">{data.layout.title}{data.countryName ? ` — ${data.countryName}` : ''}</h3>
        <table className="w-full text-sm mt-2">
          <tbody>
            {data.layout.boxes.map((b) => (
              <tr key={b.code} className={cn('border-b border-slate-50 dark:border-slate-800', b.key && 'font-semibold bg-slate-50 dark:bg-slate-800/40')}>
                <td className="px-5 py-2.5 w-16 font-mono text-xs text-slate-500">{b.code}</td>
                <td className="px-2 py-2.5 text-slate-700 dark:text-slate-200">{b.label}</td>
                <td className="px-5 py-2.5 text-end">{fmt(b.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc ps-5">
        {data.notes.map((c) => <li key={c}>{t(`reports.vat.note.${c}`)}</li>)}
      </ul>
    </div>
  )
}

export function vatReportExport(_id: VatReportId, data: unknown, t: TFunction, cur: string): { headers: string[]; rows: Cell[][] } {
  const d = data as VatReturnReport
  return {
    headers: [t('reports.vat.box'), t('reports.vat.description'), `${t('common.amount')} (${cur})`],
    rows: d.layout.boxes.map((b): Cell[] => [b.code, b.label, b.amount])
  }
}

export function vatReportSummary(_id: VatReportId, data: unknown, t: TFunction, fmt: Fmt): { label: string; value: string }[] {
  const d = data as VatReturnReport
  return [
    { label: t('reports.vat.taxOnSales', { tax: d.taxLabel }), value: fmt(d.base.sales.tax) },
    { label: t('reports.vat.taxOnPurchases', { tax: d.taxLabel }), value: fmt(d.base.purchases.tax) },
    { label: net(d) < 0 ? t('reports.vat.refund') : t('reports.vat.toPay'), value: fmt(Math.abs(net(d))) }
  ]
}

type PdfChart = { type: 'bar'; title: string; data: { label: string; value: number; color?: string }[]; valueIsCurrency?: boolean }

export function vatReportCharts(_id: VatReportId, data: unknown, t: TFunction): PdfChart[] {
  const d = data as VatReturnReport
  return [{
    type: 'bar', title: t('reports.vat.chartTitle'), valueIsCurrency: true,
    data: [
      { label: t('reports.vat.taxOnSales', { tax: d.taxLabel }), value: d.base.sales.tax, color: COLORS.brand },
      { label: t('reports.vat.taxOnPurchases', { tax: d.taxLabel }), value: d.base.purchases.tax, color: COLORS.warning },
      { label: net(d) < 0 ? t('reports.vat.refund') : t('reports.vat.toPay'), value: Math.abs(net(d)), color: net(d) < 0 ? COLORS.success : COLORS.brand }
    ]
  }]
}
