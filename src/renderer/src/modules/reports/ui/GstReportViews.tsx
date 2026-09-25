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

export interface PurchaseRegisterRow {
  kind: 'BILL' | 'DEBIT_NOTE'; date: string; number: string; supplier: string; supplierGstin: string; state: string
  reverseCharge: boolean; taxable: number; cgst: number; sgst: number; igst: number; tax: number; total: number
}
export interface PurchaseRegisterReport {
  dateFrom: string; dateTo: string; decimals: number
  rows: PurchaseRegisterRow[]
  totals: { taxable: number; cgst: number; sgst: number; igst: number; tax: number; total: number }
  byMonth: { month: string; taxable: number; tax: number }[]
  stateUnknownCount: number
}
export interface PurchaseHsnRow { hsnCode: string; description: string; taxRate: number; quantity: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }
export interface PurchaseHsnReport {
  dateFrom: string; dateTo: string; decimals: number
  rows: PurchaseHsnRow[]
  totals: { taxable: number; tax: number }
  missingHsnCount: number
}

export interface TdsRow { date: string; paymentRef: string; billNumber: string; supplier: string; pan: string; section: string; amountPaid: number; tdsDeducted: number; effectiveRatePercent: number }
export interface TdsReport {
  dateFrom: string; dateTo: string; decimals: number
  rows: TdsRow[]
  bySection: { section: string; count: number; amountPaid: number; tdsDeducted: number }[]
  totals: { amountPaid: number; tdsDeducted: number }
  payableBalance: number
  missingPanCount: number
}

export interface Gstr9Amounts { taxable: number; igst: number; cgst: number; sgst: number }
export interface Gstr9Report {
  dateFrom: string; dateTo: string; decimals: number
  table4: { b2b: Gstr9Amounts; b2c: Gstr9Amounts; creditNotes: Gstr9Amounts; total: Gstr9Amounts }
  table5: { nilRated: number; exempt: number; nonGst: number }
  table6: { inputs: TaxHeads; reverseCharge: TaxHeads; total: TaxHeads }
  table9: { payable: TaxHeads; paidFromCredit: number; paidInCash: number }
  table17: { hsnCode: string; description: string; uqc: string; quantity: number; taxable: number; tax: number }[]
  table18: PurchaseHsnRow[]
  notes: ('financialYearDates' | 'accountantCheck')[]
}

export type GstReportId = 'gstNetPayable' | 'purchaseGstRegister' | 'purchaseHsnSummary' | 'tdsDeducted' | 'gstr9Data'
export const GST_REPORT_IDS: GstReportId[] = ['gstNetPayable', 'purchaseGstRegister', 'purchaseHsnSummary', 'tdsDeducted', 'gstr9Data']

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

function netPayableExport(data: unknown, t: TFunction, cur: string): { headers: string[]; rows: Cell[][] } {
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

function netPayableSummary(data: unknown, t: TFunction, fmt: Fmt): { label: string; value: string }[] {
  const d = data as GstNetPayableReport
  return [
    { label: t('reports.gst.taxOnSales'), value: fmt(d.output.total) },
    { label: t('reports.gst.reverseCharge'), value: fmt(d.reverseCharge.total) },
    { label: t('reports.gst.inputCredit'), value: fmt(d.inputCredit.total) },
    { label: d.creditCarriedForward ? t('reports.gst.creditForward') : t('reports.gst.netPayable'), value: fmt(Math.abs(d.netPayable.total)) }
  ]
}

type PdfChart = { type: 'bar'; title: string; data: { label: string; value: number; color?: string }[]; valueIsCurrency?: boolean }

function netPayableCharts(data: unknown, t: TFunction): PdfChart[] {
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

export function PurchaseGstRegisterView({ data, fmt }: { data: PurchaseRegisterReport; fmt: Fmt }) {
  const { t } = useTranslation()
  const cards = [
    { label: t('reports.gst.register.taxable'), value: fmt(data.totals.taxable) },
    { label: t('reports.gst.register.tax'), value: fmt(data.totals.tax) },
    { label: t('reports.gst.register.total'), value: fmt(data.totals.total) },
    { label: t('reports.gst.documents'), value: String(data.rows.length) }
  ]
  const chart = data.byMonth.map((m) => ({ name: m.month, [t('reports.gst.register.taxable')]: m.taxable, [t('reports.gst.register.tax')]: m.tax }))
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
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.gst.register.chartTitle')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
            <Legend />
            <Bar dataKey={t('reports.gst.register.taxable')} fill={COLORS.brand} />
            <Bar dataKey={t('reports.gst.register.tax')} fill={COLORS.warning} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={cn(PANEL, 'overflow-x-auto')}>
        {data.rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">{t('reports.gst.register.noRows')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
                <th className="px-4 py-3 text-start">{t('common.date')}</th>
                <th className="px-4 py-3 text-start">{t('reports.gst.document')}</th>
                <th className="px-4 py-3 text-start">{t('reports.gst.party')}</th>
                <th className="px-4 py-3 text-start">{t('reports.gst.register.supplierGstin')}</th>
                <th className="px-4 py-3 text-end">{t('reports.gst.register.taxable')}</th>
                <th className="px-4 py-3 text-end">CGST</th>
                <th className="px-4 py-3 text-end">SGST</th>
                <th className="px-4 py-3 text-end">IGST</th>
                <th className="px-4 py-3 text-end">{t('reports.gst.register.total')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={`${r.kind}-${r.number}-${i}`} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="px-4 py-2.5">{formatDate(r.date)}</td>
                  <td className="px-4 py-2.5">{t(`reports.gst.register.kind.${r.kind}`)} {r.number}{r.reverseCharge && <Badge variant="warning" className="ms-2">{t('reports.gst.register.rcm')}</Badge>}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{r.supplier}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.supplierGstin}</td>
                  <td className="px-4 py-2.5 text-end">{fmt(r.taxable)}</td>
                  <td className="px-4 py-2.5 text-end">{fmt(r.cgst)}</td>
                  <td className="px-4 py-2.5 text-end">{fmt(r.sgst)}</td>
                  <td className="px-4 py-2.5 text-end">{fmt(r.igst)}</td>
                  <td className="px-4 py-2.5 text-end font-semibold">{fmt(r.total)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="px-4 py-3" colSpan={4}>{t('common.total')}</td>
                <td className="px-4 py-3 text-end">{fmt(data.totals.taxable)}</td>
                <td className="px-4 py-3 text-end">{fmt(data.totals.cgst)}</td>
                <td className="px-4 py-3 text-end">{fmt(data.totals.sgst)}</td>
                <td className="px-4 py-3 text-end">{fmt(data.totals.igst)}</td>
                <td className="px-4 py-3 text-end">{fmt(data.totals.total)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      {data.stateUnknownCount > 0 && <p className="text-xs text-slate-500">{t('reports.gst.register.unknownState', { count: data.stateUnknownCount })}</p>}
    </div>
  )
}

export function PurchaseHsnSummaryView({ data, fmt }: { data: PurchaseHsnReport; fmt: Fmt }) {
  const { t } = useTranslation()
  const chart = data.rows.slice(0, 12).map((r) => ({ name: r.hsnCode, [t('reports.gst.register.taxable')]: r.taxable }))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card padding="md">
          <div className="text-xs font-semibold text-slate-400 uppercase mb-1">{t('reports.gst.register.taxable')}</div>
          <div className="text-xl font-bold text-dark dark:text-slate-100">{fmt(data.totals.taxable)}</div>
        </Card>
        <Card padding="md">
          <div className="text-xs font-semibold text-slate-400 uppercase mb-1">{t('reports.gst.register.tax')}</div>
          <div className="text-xl font-bold text-dark dark:text-slate-100">{fmt(data.totals.tax)}</div>
        </Card>
      </div>
      <div className={cn(PANEL, 'p-5')}>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.gst.hsn.chartTitle')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
            <Bar dataKey={t('reports.gst.register.taxable')} fill={COLORS.brand} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={cn(PANEL, 'overflow-x-auto')}>
        {data.rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">{t('reports.gst.hsn.noRows')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
                <th className="px-4 py-3 text-start">{t('reports.gst.hsn.code')}</th>
                <th className="px-4 py-3 text-start">{t('reports.gst.hsn.description')}</th>
                <th className="px-4 py-3 text-end">{t('reports.gst.hsn.rate')}</th>
                <th className="px-4 py-3 text-end">{t('reports.gst.hsn.quantity')}</th>
                <th className="px-4 py-3 text-end">{t('reports.gst.register.taxable')}</th>
                <th className="px-4 py-3 text-end">CGST</th>
                <th className="px-4 py-3 text-end">SGST</th>
                <th className="px-4 py-3 text-end">IGST</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={`${r.hsnCode}-${r.taxRate}`} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="px-4 py-2.5 font-mono text-xs">{r.hsnCode}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{r.description}</td>
                  <td className="px-4 py-2.5 text-end">{r.taxRate}</td>
                  <td className="px-4 py-2.5 text-end">{r.quantity}</td>
                  <td className="px-4 py-2.5 text-end">{fmt(r.taxable)}</td>
                  <td className="px-4 py-2.5 text-end">{fmt(r.cgst)}</td>
                  <td className="px-4 py-2.5 text-end">{fmt(r.sgst)}</td>
                  <td className="px-4 py-2.5 text-end">{fmt(r.igst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data.missingHsnCount > 0 && <p className="text-xs text-slate-500">{t('reports.gst.hsn.missing', { count: data.missingHsnCount })}</p>}
    </div>
  )
}

export function TdsDeductedView({ data, fmt }: { data: TdsReport; fmt: Fmt }) {
  const { t } = useTranslation()
  const cards = [
    { label: t('reports.gst.tds.deducted'), value: fmt(data.totals.tdsDeducted) },
    { label: t('reports.gst.tds.amountPaid'), value: fmt(data.totals.amountPaid) },
    { label: t('reports.gst.tds.notDeposited'), value: fmt(data.payableBalance) },
    { label: t('reports.gst.tds.payments'), value: String(data.rows.length) }
  ]
  const chart = data.bySection.map((s) => ({ name: s.section === 'NOT GIVEN' ? t('reports.gst.tds.notGiven') : s.section, [t('reports.gst.tds.deducted')]: s.tdsDeducted }))
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
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.gst.tds.chartTitle')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
            <Bar dataKey={t('reports.gst.tds.deducted')} fill={COLORS.warning} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={cn(PANEL, 'overflow-x-auto')}>
        {data.rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">{t('reports.gst.tds.noRows')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
                <th className="px-4 py-3 text-start">{t('common.date')}</th>
                <th className="px-4 py-3 text-start">{t('reports.gst.party')}</th>
                <th className="px-4 py-3 text-start">PAN</th>
                <th className="px-4 py-3 text-start">{t('reports.gst.tds.bill')}</th>
                <th className="px-4 py-3 text-start">{t('reports.gst.tds.section')}</th>
                <th className="px-4 py-3 text-end">{t('reports.gst.tds.amountPaid')}</th>
                <th className="px-4 py-3 text-end">{t('reports.gst.tds.deducted')}</th>
                <th className="px-4 py-3 text-end">%</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={`${r.billNumber}-${i}`} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="px-4 py-2.5">{formatDate(r.date)}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{r.supplier}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.pan || '—'}</td>
                  <td className="px-4 py-2.5">{r.billNumber}</td>
                  <td className="px-4 py-2.5">{r.section === 'NOT GIVEN' ? t('reports.gst.tds.notGiven') : r.section}</td>
                  <td className="px-4 py-2.5 text-end">{fmt(r.amountPaid)}</td>
                  <td className="px-4 py-2.5 text-end font-semibold">{fmt(r.tdsDeducted)}</td>
                  <td className="px-4 py-2.5 text-end">{r.effectiveRatePercent}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="px-4 py-3" colSpan={5}>{t('common.total')}</td>
                <td className="px-4 py-3 text-end">{fmt(data.totals.amountPaid)}</td>
                <td className="px-4 py-3 text-end">{fmt(data.totals.tdsDeducted)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc ps-5">
        {data.missingPanCount > 0 && <li>{t('reports.gst.tds.missingPan', { count: data.missingPanCount })}</li>}
        <li>{t('reports.gst.tds.confirm')}</li>
      </ul>
    </div>
  )
}


function gstr9Rows(d: Gstr9Report, t: TFunction): { section: string; label: string; taxable: number | null; igst: number | null; cgst: number | null; sgst: number | null }[] {
  const a = (section: string, label: string, x: Gstr9Amounts) => ({ section, label, taxable: x.taxable, igst: x.igst, cgst: x.cgst, sgst: x.sgst })
  const h = (section: string, label: string, x: TaxHeads) => ({ section, label, taxable: null, igst: x.igst, cgst: x.cgst, sgst: x.sgst })
  const only = (section: string, label: string, v: number) => ({ section, label, taxable: v, igst: null, cgst: null, sgst: null })
  return [
    a(t('reports.gst.gstr9.t4'), t('reports.gst.gstr9.b2b'), d.table4.b2b),
    a(t('reports.gst.gstr9.t4'), t('reports.gst.gstr9.b2c'), d.table4.b2c),
    a(t('reports.gst.gstr9.t4'), t('reports.gst.gstr9.creditNotes'), d.table4.creditNotes),
    a(t('reports.gst.gstr9.t4'), t('common.total'), d.table4.total),
    only(t('reports.gst.gstr9.t5'), t('reports.gst.gstr9.nilRated'), d.table5.nilRated),
    only(t('reports.gst.gstr9.t5'), t('reports.gst.gstr9.exempt'), d.table5.exempt),
    only(t('reports.gst.gstr9.t5'), t('reports.gst.gstr9.nonGst'), d.table5.nonGst),
    h(t('reports.gst.gstr9.t6'), t('reports.gst.gstr9.inputs'), d.table6.inputs),
    h(t('reports.gst.gstr9.t6'), t('reports.gst.reverseCharge'), d.table6.reverseCharge),
    h(t('reports.gst.gstr9.t6'), t('common.total'), d.table6.total),
    h(t('reports.gst.gstr9.t9'), t('reports.gst.gstr9.payable'), d.table9.payable)
  ]
}

export function Gstr9View({ data, fmt }: { data: Gstr9Report; fmt: Fmt }) {
  const { t } = useTranslation()
  const tax4 = data.table4.total.igst + data.table4.total.cgst + data.table4.total.sgst
  const cards = [
    { label: t('reports.gst.gstr9.outwardTaxable'), value: fmt(data.table4.total.taxable) },
    { label: t('reports.gst.gstr9.taxPayable'), value: fmt(data.table9.payable.total) },
    { label: t('reports.gst.gstr9.itcAvailed'), value: fmt(data.table6.total.total) },
    { label: t('reports.gst.gstr9.paid'), value: fmt(data.table9.paidFromCredit + data.table9.paidInCash) }
  ]
  const chart = [
    { name: t('reports.gst.gstr9.b2b'), v: data.table4.b2b.taxable },
    { name: t('reports.gst.gstr9.b2c'), v: data.table4.b2c.taxable },
    { name: t('reports.gst.gstr9.nilRated'), v: data.table5.nilRated },
    { name: t('reports.gst.gstr9.exempt'), v: data.table5.exempt },
    { name: t('reports.gst.gstr9.nonGst'), v: data.table5.nonGst }
  ].map((x) => ({ name: x.name, [t('reports.gst.register.taxable')]: x.v }))
  const rows = gstr9Rows(data, t)
  const cell = (v: number | null) => (v === null ? '' : fmt(v))
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
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.gst.gstr9.chartTitle')}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} interval={0} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
            <Bar dataKey={t('reports.gst.register.taxable')} fill={COLORS.brand} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={cn(PANEL, 'overflow-x-auto')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
              <th className="px-4 py-3 text-start">{t('reports.gst.gstr9.table')}</th>
              <th className="px-4 py-3 text-start">{t('reports.gst.gstr9.item')}</th>
              <th className="px-4 py-3 text-end">{t('reports.gst.register.taxable')}</th>
              <th className="px-4 py-3 text-end">IGST</th>
              <th className="px-4 py-3 text-end">CGST</th>
              <th className="px-4 py-3 text-end">SGST</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-50 dark:border-slate-800">
                <td className="px-4 py-2.5 text-slate-500">{r.section}</td>
                <td className="px-4 py-2.5">{r.label}</td>
                <td className="px-4 py-2.5 text-end">{cell(r.taxable)}</td>
                <td className="px-4 py-2.5 text-end">{cell(r.igst)}</td>
                <td className="px-4 py-2.5 text-end">{cell(r.cgst)}</td>
                <td className="px-4 py-2.5 text-end">{cell(r.sgst)}</td>
              </tr>
            ))}
            <tr>
              <td className="px-4 py-2.5 text-slate-500">{t('reports.gst.gstr9.t9')}</td>
              <td className="px-4 py-2.5" colSpan={5}>{t('reports.gst.gstr9.paidLine', { credit: fmt(data.table9.paidFromCredit), cash: fmt(data.table9.paidInCash) })}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{t('reports.gst.gstr9.tableHsn', { outward: data.table17.length, inward: data.table18.length, tax: fmt(tax4) })}</p>
      <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc ps-5">
        {data.notes.map((c) => <li key={c}>{t(`reports.gst.gstr9.note.${c}`)}</li>)}
      </ul>
    </div>
  )
}

export function gstReportExport(id: GstReportId, data: unknown, t: TFunction, cur: string): { headers: string[]; rows: Cell[][] } {
  if (id === 'purchaseGstRegister') {
    const d = data as PurchaseRegisterReport
    const amt = (l: string) => `${l} (${cur})`
    return {
      headers: [t('common.date'), t('reports.gst.document'), t('reports.gst.party'), t('reports.gst.register.supplierGstin'), amt(t('reports.gst.register.taxable')), 'CGST', 'SGST', 'IGST', amt(t('reports.gst.register.total'))],
      rows: [
        ...d.rows.map((r): Cell[] => [r.date, `${t(`reports.gst.register.kind.${r.kind}`)} ${r.number}${r.reverseCharge ? ` (${t('reports.gst.register.rcm')})` : ''}`, r.supplier, r.supplierGstin, r.taxable, r.cgst, r.sgst, r.igst, r.total]),
        [t('common.total'), '', '', '', d.totals.taxable, d.totals.cgst, d.totals.sgst, d.totals.igst, d.totals.total]
      ]
    }
  }
  if (id === 'gstr9Data') {
    const d = data as Gstr9Report
    const num = (v: number | null): Cell => (v === null ? '' : v)
    return {
      headers: [t('reports.gst.gstr9.table'), t('reports.gst.gstr9.item'), `${t('reports.gst.register.taxable')} (${cur})`, 'IGST', 'CGST', 'SGST'],
      rows: [
        ...gstr9Rows(d, t).map((r): Cell[] => [r.section, r.label, num(r.taxable), num(r.igst), num(r.cgst), num(r.sgst)]),
        [t('reports.gst.gstr9.t9'), t('reports.gst.gstr9.paidFromCredit'), d.table9.paidFromCredit, '', '', ''],
        [t('reports.gst.gstr9.t9'), t('reports.gst.gstr9.paidInCash'), d.table9.paidInCash, '', '', ''],
        ...d.table17.map((r): Cell[] => [t('reports.gst.gstr9.t17'), `${r.hsnCode} ${r.description}`, r.taxable, '', '', '']),
        ...d.table18.map((r): Cell[] => [t('reports.gst.gstr9.t18'), `${r.hsnCode} ${r.description}`, r.taxable, r.igst, r.cgst, r.sgst])
      ]
    }
  }
  if (id === 'tdsDeducted') {
    const d = data as TdsReport
    const sectionName = (s: string) => (s === 'NOT GIVEN' ? t('reports.gst.tds.notGiven') : s)
    return {
      headers: [t('common.date'), t('reports.gst.party'), 'PAN', t('reports.gst.tds.bill'), t('reports.gst.tds.section'), `${t('reports.gst.tds.amountPaid')} (${cur})`, `${t('reports.gst.tds.deducted')} (${cur})`, '%'],
      rows: [
        ...d.rows.map((r): Cell[] => [r.date, r.supplier, r.pan, r.billNumber, sectionName(r.section), r.amountPaid, r.tdsDeducted, r.effectiveRatePercent]),
        [t('common.total'), '', '', '', '', d.totals.amountPaid, d.totals.tdsDeducted, '']
      ]
    }
  }
  if (id === 'purchaseHsnSummary') {
    const d = data as PurchaseHsnReport
    return {
      headers: [t('reports.gst.hsn.code'), t('reports.gst.hsn.description'), t('reports.gst.hsn.rate'), t('reports.gst.hsn.quantity'), `${t('reports.gst.register.taxable')} (${cur})`, 'CGST', 'SGST', 'IGST'],
      rows: [
        ...d.rows.map((r): Cell[] => [r.hsnCode, r.description, r.taxRate, r.quantity, r.taxable, r.cgst, r.sgst, r.igst]),
        [t('common.total'), '', '', '', d.totals.taxable, '', '', '']
      ]
    }
  }
  return netPayableExport(data, t, cur)
}

export function gstReportSummary(id: GstReportId, data: unknown, t: TFunction, fmt: Fmt): { label: string; value: string }[] {
  if (id === 'purchaseGstRegister') {
    const d = data as PurchaseRegisterReport
    return [
      { label: t('reports.gst.register.taxable'), value: fmt(d.totals.taxable) },
      { label: t('reports.gst.register.tax'), value: fmt(d.totals.tax) },
      { label: t('reports.gst.register.total'), value: fmt(d.totals.total) }
    ]
  }
  if (id === 'gstr9Data') {
    const d = data as Gstr9Report
    return [
      { label: t('reports.gst.gstr9.outwardTaxable'), value: fmt(d.table4.total.taxable) },
      { label: t('reports.gst.gstr9.taxPayable'), value: fmt(d.table9.payable.total) },
      { label: t('reports.gst.gstr9.itcAvailed'), value: fmt(d.table6.total.total) }
    ]
  }
  if (id === 'tdsDeducted') {
    const d = data as TdsReport
    return [
      { label: t('reports.gst.tds.deducted'), value: fmt(d.totals.tdsDeducted) },
      { label: t('reports.gst.tds.amountPaid'), value: fmt(d.totals.amountPaid) },
      { label: t('reports.gst.tds.notDeposited'), value: fmt(d.payableBalance) }
    ]
  }
  if (id === 'purchaseHsnSummary') {
    const d = data as PurchaseHsnReport
    return [
      { label: t('reports.gst.register.taxable'), value: fmt(d.totals.taxable) },
      { label: t('reports.gst.register.tax'), value: fmt(d.totals.tax) }
    ]
  }
  return netPayableSummary(data, t, fmt)
}

export function gstReportCharts(id: GstReportId, data: unknown, t: TFunction): PdfChart[] {
  if (id === 'purchaseGstRegister') {
    const d = data as PurchaseRegisterReport
    if (d.byMonth.length === 0) return []
    return [{ type: 'bar', title: t('reports.gst.register.chartTitle'), valueIsCurrency: true, data: d.byMonth.map((m) => ({ label: m.month, value: m.taxable, color: COLORS.brand })) }]
  }
  if (id === 'gstr9Data') {
    const d = data as Gstr9Report
    return [{ type: 'bar', title: t('reports.gst.gstr9.chartTitle'), valueIsCurrency: true, data: [
      { label: t('reports.gst.gstr9.b2b'), value: d.table4.b2b.taxable, color: COLORS.brand },
      { label: t('reports.gst.gstr9.b2c'), value: d.table4.b2c.taxable, color: COLORS.brand },
      { label: t('reports.gst.gstr9.nilRated'), value: d.table5.nilRated, color: COLORS.warning },
      { label: t('reports.gst.gstr9.exempt'), value: d.table5.exempt, color: COLORS.warning },
      { label: t('reports.gst.gstr9.nonGst'), value: d.table5.nonGst, color: COLORS.warning }
    ] }]
  }
  if (id === 'tdsDeducted') {
    const d = data as TdsReport
    if (d.bySection.length === 0) return []
    return [{ type: 'bar', title: t('reports.gst.tds.chartTitle'), valueIsCurrency: true, data: d.bySection.map((s) => ({ label: s.section === 'NOT GIVEN' ? t('reports.gst.tds.notGiven') : s.section, value: s.tdsDeducted, color: COLORS.warning })) }]
  }
  if (id === 'purchaseHsnSummary') {
    const d = data as PurchaseHsnReport
    if (d.rows.length === 0) return []
    return [{ type: 'bar', title: t('reports.gst.hsn.chartTitle'), valueIsCurrency: true, data: d.rows.slice(0, 12).map((r) => ({ label: r.hsnCode, value: r.taxable, color: COLORS.brand })) }]
  }
  return netPayableCharts(data, t)
}
