import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine
} from 'recharts'
import { cn } from '@shared/utils/cn'
import { formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { roundToCurrency } from '@shared/utils/currency.util'

// Balance Sheet, General Ledger, Day Book and Cash Flow Statement views.
// Local copies of the shapes returned by financial-statements.service.ts
// (this codebase avoids cross-boundary imports from the main process).

export interface BalanceSheetRow { accountId: string | null; accountCode: string; accountName: string; kind: 'account' | 'currentProfit'; amount: number; compareAmount: number | null }
export interface BalanceSheetGroup { key: string; side: 'ASSET' | 'LIABILITY' | 'EQUITY'; rows: BalanceSheetRow[]; total: number; compareTotal: number | null }
export interface BalanceSheetTotals { assets: number; liabilities: number; equity: number; liabilitiesAndEquity: number; currentProfit: number }
export interface BalanceSheetReport {
  asOf: string; compareAsOf: string | null
  groups: BalanceSheetGroup[]; totals: BalanceSheetTotals; compareTotals: BalanceSheetTotals | null
  balanced: boolean; difference: number
}

export interface GeneralLedgerLine {
  date: string; entryNumber: string; narration: string | null; remarks: string | null
  sourceType: string; sourceId: string | null; sourceRef: string | null
  isReversed: boolean; isCarryForward: boolean
  debit: number; credit: number; balance: number
}
export interface GeneralLedgerReport {
  dateFrom: string; dateTo: string
  account: { id: string; accountCode: string; accountName: string; accountType: string }
  normalSide: 'DEBIT' | 'CREDIT'
  openingBalance: number; totalDebit: number; totalCredit: number; closingBalance: number
  lines: GeneralLedgerLine[]
}

export interface DayBookVoucher {
  id: string; date: string; entryNumber: string; voucherType: string; sourceType: string; sourceId: string | null
  narration: string | null; isReversed: boolean; debit: number; credit: number
  lines: { account: string; debit: number; credit: number }[]
}
export interface DayBookReport {
  dateFrom: string; dateTo: string; voucherType: string
  days: { date: string; voucherCount: number; totalDebit: number; totalCredit: number }[]
  byType: { voucherType: string; voucherCount: number; total: number }[]
  vouchers: DayBookVoucher[]
  totalVouchers: number; totalDebit: number; totalCredit: number; truncated: boolean
}

export interface CashFlowItem { kind: 'netProfit' | 'depreciation' | 'account'; accountCode: string; name: string; amount: number }
export interface CashFlowSection { items: CashFlowItem[]; total: number }
export interface CashFlowStatementReport {
  dateFrom: string; dateTo: string
  operating: CashFlowSection; investing: CashFlowSection; financing: CashFlowSection
  netChange: number; openingCash: number; closingCash: number; ledgerClosingCash: number; reconciled: boolean
  cashAccounts: { accountCode: string; name: string; opening: number; closing: number }[]
}

export type FinancialStatementId = 'balanceSheet' | 'generalLedger' | 'dayBook' | 'cashFlowStatement'
export const FINANCIAL_STATEMENT_IDS: FinancialStatementId[] = ['balanceSheet', 'generalLedger', 'dayBook', 'cashFlowStatement']

type Fmt = (n: number) => string
type Cell2 = string | number | null

const COLORS = { brand: '#00AEEF', success: '#22C55E', warning: '#F59E0B', danger: '#EF4444', violet: '#8B5CF6', slate: '#64748B' }
const TICK = { fontSize: 11, fill: '#94a3b8' }
const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }
const PANEL = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700'

function Summary({ cards }: { cards: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label} padding="md">
          <div className="text-xs font-semibold text-slate-400 uppercase mb-1">{c.label}</div>
          <div className="text-xl font-bold text-dark dark:text-slate-100">{c.value}</div>
        </Card>
      ))}
    </div>
  )
}

function ChartPanel({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className={cn(PANEL, 'p-5')}>
      <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>{children}</ResponsiveContainer>
    </div>
  )
}

function sourceLabel(t: TFunction, sourceType: string): string {
  return t(`accounting.journalEntries.sourceType.${sourceType}`, { defaultValue: sourceType })
}

function groupLabel(t: TFunction, key: string): string { return t(`reports.fs.bs.group.${key}`) }

function cfItemLabel(t: TFunction, item: CashFlowItem, section: 'operating' | 'investing' | 'financing'): string {
  if (item.kind === 'netProfit') return t('reports.fs.cf.netProfit')
  if (item.kind === 'depreciation') return section === 'operating' ? t('reports.fs.cf.depreciation') : t('reports.fs.cf.depreciationInvesting')
  return item.name
}

function bsRowLabel(t: TFunction, r: BalanceSheetRow): string {
  return r.kind === 'currentProfit' ? t('reports.fs.bs.currentProfit') : `${r.accountCode} — ${r.accountName}`
}

// ─── Balance Sheet ───────────────────────────────────────────────────────────

export function BalanceSheetView({ data, fmt }: { data: BalanceSheetReport; fmt: Fmt }) {
  const { t } = useTranslation()
  const cmp = data.compareAsOf !== null && data.compareTotals !== null
  const g = (key: string) => data.groups.find((x) => x.key === key)?.total ?? 0

  const stacked = [
    { side: t('reports.fs.bs.assets'), currentAssets: g('currentAssets'), fixedAssets: g('fixedAssets'), currentLiabilities: 0, longTermLiabilities: 0, equity: 0 },
    { side: t('reports.fs.bs.liabilitiesAndEquity'), currentAssets: 0, fixedAssets: 0, currentLiabilities: g('currentLiabilities'), longTermLiabilities: g('longTermLiabilities'), equity: g('equity') }
  ]
  const stackKeys: { key: string; color: string }[] = [
    { key: 'currentAssets', color: COLORS.brand }, { key: 'fixedAssets', color: COLORS.violet },
    { key: 'currentLiabilities', color: COLORS.warning }, { key: 'longTermLiabilities', color: COLORS.danger }, { key: 'equity', color: COLORS.success }
  ]
  const grouped = cmp ? [
    { name: t('reports.fs.bs.assets'), current: data.totals.assets, previous: data.compareTotals!.assets },
    { name: t('reports.fs.bs.liabilities'), current: data.totals.liabilities, previous: data.compareTotals!.liabilities },
    { name: t('reports.fs.bs.equity'), current: data.totals.equity, previous: data.compareTotals!.equity }
  ] : []

  const sections: { side: BalanceSheetGroup['side']; label: string; total: number; compareTotal: number | null }[] = [
    { side: 'ASSET', label: t('reports.fs.bs.totalAssets'), total: data.totals.assets, compareTotal: cmp ? data.compareTotals!.assets : null },
    { side: 'LIABILITY', label: t('reports.fs.bs.totalLiabilities'), total: data.totals.liabilities, compareTotal: cmp ? data.compareTotals!.liabilities : null },
    { side: 'EQUITY', label: t('reports.fs.bs.totalEquity'), total: data.totals.equity, compareTotal: cmp ? data.compareTotals!.equity : null }
  ]

  return (
    <div className="space-y-6">
      <Summary cards={[
        { label: t('reports.fs.bs.totalAssets'), value: fmt(data.totals.assets) },
        { label: t('reports.fs.bs.totalLiabilities'), value: fmt(data.totals.liabilities) },
        { label: t('reports.fs.bs.totalEquity'), value: fmt(data.totals.equity) },
        { label: t('reports.fs.bs.currentProfit'), value: fmt(data.totals.currentProfit) }
      ]} />

      <Card padding="md" className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-semibold text-dark dark:text-slate-100">{t('reports.fs.bs.checkLine')}</span>
        <span className="text-sm text-slate-600 dark:text-slate-300">{fmt(data.totals.assets)} = {fmt(data.totals.liabilitiesAndEquity)}</span>
        <Badge variant={data.balanced ? 'success' : 'danger'}>{data.balanced ? t('reports.summary.balanced') : `${t('reports.summary.notBalanced')} (${t('reports.fs.bs.difference')}: ${fmt(data.difference)})`}</Badge>
      </Card>

      <ChartPanel title={t('reports.fs.bs.chartTitle')}>
        <BarChart data={stacked}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="side" tick={TICK} tickLine={false} axisLine={false} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [fmt(v), groupLabel(t, name)]} />
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => groupLabel(t, v)} />
          {stackKeys.map((s) => <Bar key={s.key} dataKey={s.key} stackId="bs" fill={s.color} />)}
        </BarChart>
      </ChartPanel>

      {cmp && (
        <ChartPanel title={`${formatDate(data.asOf)} / ${formatDate(data.compareAsOf as string)}`}>
          <BarChart data={grouped}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="current" name={formatDate(data.asOf)} fill={COLORS.brand} radius={[4, 4, 0, 0]} />
            <Bar dataKey="previous" name={formatDate(data.compareAsOf as string)} fill={COLORS.slate} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>
      )}

      <div className={cn(PANEL, 'overflow-x-auto')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400 font-semibold uppercase">
              <th className="text-start px-5 py-3">{t('reports.col.account')}</th>
              <th className="text-end px-5 py-3">{formatDate(data.asOf)}</th>
              {cmp && <th className="text-end px-5 py-3">{formatDate(data.compareAsOf as string)}</th>}
              {cmp && <th className="text-end px-5 py-3">{t('reports.fs.bs.change')}</th>}
            </tr>
          </thead>
          <tbody>
            {sections.map((sec) => (
              <React.Fragment key={sec.side}>
                {data.groups.filter((gr) => gr.side === sec.side).map((gr) => (
                  <React.Fragment key={gr.key}>
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                      <td className="px-5 py-2.5 font-semibold text-dark dark:text-slate-100" colSpan={cmp ? 4 : 2}>{groupLabel(t, gr.key)}</td>
                    </tr>
                    {gr.rows.map((r) => (
                      <tr key={r.accountId ?? r.kind} className="border-b border-slate-50 dark:border-slate-800">
                        <td className="px-5 py-2.5 ps-8 text-slate-600 dark:text-slate-300">{bsRowLabel(t, r)}</td>
                        <td className="px-5 py-2.5 text-end text-dark dark:text-slate-100">{fmt(r.amount)}</td>
                        {cmp && <td className="px-5 py-2.5 text-end text-slate-500">{fmt(r.compareAmount ?? 0)}</td>}
                        {cmp && <td className="px-5 py-2.5 text-end text-slate-500">{fmt(r.amount - (r.compareAmount ?? 0))}</td>}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                <tr className="border-b border-slate-100 dark:border-slate-800 font-bold">
                  <td className="px-5 py-3 text-dark dark:text-slate-100">{sec.label}</td>
                  <td className="px-5 py-3 text-end text-dark dark:text-slate-100">{fmt(sec.total)}</td>
                  {cmp && <td className="px-5 py-3 text-end text-slate-500">{fmt(sec.compareTotal ?? 0)}</td>}
                  {cmp && <td className="px-5 py-3 text-end text-slate-500">{fmt(sec.total - (sec.compareTotal ?? 0))}</td>}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── General Ledger ──────────────────────────────────────────────────────────

export function GeneralLedgerView({ data, fmt }: { data: GeneralLedgerReport; fmt: Fmt }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const chart = [
    { label: formatDate(data.dateFrom), balance: data.openingBalance },
    ...data.lines.map((l) => ({ label: formatDate(l.date), balance: l.balance }))
  ]

  function openSource(l: GeneralLedgerLine) {
    if (!l.sourceId) return
    if (l.sourceType === 'INVOICE') navigate(`/billing/invoices/${l.sourceId}`)
    else if (l.sourceType === 'BILL') navigate(`/bills/${l.sourceId}`)
  }
  const linkable = (l: GeneralLedgerLine) => !!l.sourceId && (l.sourceType === 'INVOICE' || l.sourceType === 'BILL')

  return (
    <div className="space-y-6">
      <Card padding="md">
        <div className="text-base font-bold text-dark dark:text-slate-100">{data.account.accountCode} — {data.account.accountName}</div>
        <div className="text-xs text-slate-400 mt-0.5">{data.normalSide === 'DEBIT' ? t('reports.fs.gl.debitSide') : t('reports.fs.gl.creditSide')}</div>
      </Card>
      <Summary cards={[
        { label: t('reports.col.openingBalance'), value: fmt(data.openingBalance) },
        { label: t('reports.fs.gl.totalDebit'), value: fmt(data.totalDebit) },
        { label: t('reports.fs.gl.totalCredit'), value: fmt(data.totalCredit) },
        { label: t('reports.col.closingBalance'), value: fmt(data.closingBalance) }
      ]} />

      <ChartPanel title={t('reports.fs.gl.runningBalance')}>
        <LineChart data={chart}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={TICK} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
          <ReferenceLine y={0} stroke="#cbd5e1" />
          <Line type="stepAfter" dataKey="balance" name={t('common.balance')} stroke={COLORS.brand} strokeWidth={2} dot={chart.length < 40} />
        </LineChart>
      </ChartPanel>

      <div className={cn(PANEL, 'overflow-x-auto')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400 font-semibold uppercase">
              <th className="text-start px-4 py-3">{t('common.date')}</th>
              <th className="text-start px-4 py-3">{t('reports.fs.gl.entryNo')}</th>
              <th className="text-start px-4 py-3">{t('reports.fs.gl.source')}</th>
              <th className="text-start px-4 py-3">{t('reports.fs.gl.narration')}</th>
              <th className="text-end px-4 py-3">{t('common.debit')}</th>
              <th className="text-end px-4 py-3">{t('common.credit')}</th>
              <th className="text-end px-4 py-3">{t('common.balance')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
              <td className="px-4 py-3" colSpan={6}>{t('reports.col.openingBalance')}</td>
              <td className="px-4 py-3 text-end">{fmt(data.openingBalance)}</td>
            </tr>
            {data.lines.map((l, i) => (
              <tr key={`${l.entryNumber}-${i}`}>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(l.date)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{l.entryNumber}{l.isReversed && <Badge variant="neutral" size="sm" className="ms-2">{t('reports.fs.gl.reversed')}</Badge>}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {linkable(l) ? (
                    <button onClick={() => openSource(l)} className="inline-flex items-center gap-1 min-h-[44px] text-brand font-medium hover:underline">
                      {sourceLabel(t, l.sourceType)}{l.sourceRef ? ` ${l.sourceRef}` : ''} <ArrowUpRight size={14} />
                    </button>
                  ) : (
                    <span className="text-slate-600 dark:text-slate-300">{sourceLabel(t, l.sourceType)}{l.sourceRef ? ` ${l.sourceRef}` : ''}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{l.isCarryForward ? t('reports.fs.gl.carryForward') : (l.narration ?? l.remarks ?? '')}</td>
                <td className="px-4 py-3 text-end text-dark dark:text-slate-100">{l.debit > 0 ? fmt(l.debit) : ''}</td>
                <td className="px-4 py-3 text-end text-dark dark:text-slate-100">{l.credit > 0 ? fmt(l.credit) : ''}</td>
                <td className="px-4 py-3 text-end font-medium text-dark dark:text-slate-100">{fmt(l.balance)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold">
              <td className="px-4 py-4" colSpan={4}>{t('reports.col.closingBalance')}</td>
              <td className="px-4 py-4 text-end">{fmt(data.totalDebit)}</td>
              <td className="px-4 py-4 text-end">{fmt(data.totalCredit)}</td>
              <td className="px-4 py-4 text-end">{fmt(data.closingBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Day Book ────────────────────────────────────────────────────────────────

export function DayBookView({ data, fmt }: { data: DayBookReport; fmt: Fmt }) {
  const { t } = useTranslation()
  const chart = data.days.map((d) => ({ label: formatDate(d.date), total: d.totalDebit }))
  const dayTotals = new Map(data.days.map((d) => [d.date, d]))
  const lastOfDay = new Map<string, string>()
  for (const v of data.vouchers) lastOfDay.set(v.date, v.id)

  return (
    <div className="space-y-6">
      <Summary cards={[
        { label: t('reports.fs.db.vouchers'), value: String(data.totalVouchers) },
        { label: t('common.debit'), value: fmt(data.totalDebit) },
        { label: t('common.credit'), value: fmt(data.totalCredit) },
        { label: t('reports.fs.db.days'), value: String(data.days.length) }
      ]} />

      {chart.length > 0 && (
        <ChartPanel title={t('reports.fs.db.dailyTotal')}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
            <Bar dataKey="total" name={t('reports.fs.db.dailyTotal')} fill={COLORS.brand} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>
      )}

      {data.truncated && <p className="text-sm text-warning">{t('reports.fs.db.truncated', { count: data.vouchers.length })}</p>}

      <div className={cn(PANEL, 'overflow-x-auto')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400 font-semibold uppercase">
              <th className="text-start px-4 py-3">{t('common.date')}</th>
              <th className="text-start px-4 py-3">{t('reports.fs.db.voucher')}</th>
              <th className="text-start px-4 py-3">{t('reports.fs.voucherType')}</th>
              <th className="text-start px-4 py-3">{t('reports.fs.db.particulars')}</th>
              <th className="text-end px-4 py-3">{t('common.debit')}</th>
              <th className="text-end px-4 py-3">{t('common.credit')}</th>
            </tr>
          </thead>
          <tbody>
            {data.vouchers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">{t('reports.empty.noData')}</td></tr>
            )}
            {data.vouchers.map((v) => {
              const day = dayTotals.get(v.date)
              return (
                <React.Fragment key={v.id}>
                  <tr className="border-b border-slate-50 dark:border-slate-800 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(v.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{v.entryNumber}{v.isReversed && <Badge variant="neutral" size="sm" className="ms-2">{t('reports.fs.gl.reversed')}</Badge>}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge variant="neutral" size="sm">{t(`reports.fs.voucherTypes.${v.voucherType}`)}</Badge></td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {v.narration && <div className="font-medium text-dark dark:text-slate-100">{v.narration}</div>}
                      <div className="text-xs text-slate-400">{v.lines.map((l) => l.account).join(' / ')}</div>
                    </td>
                    <td className="px-4 py-3 text-end text-dark dark:text-slate-100">{fmt(v.debit)}</td>
                    <td className="px-4 py-3 text-end text-dark dark:text-slate-100">{fmt(v.credit)}</td>
                  </tr>
                  {day && lastOfDay.get(v.date) === v.id && (
                    <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
                      <td className="px-4 py-2.5" colSpan={4}>{t('reports.fs.db.dayTotal')} — {formatDate(v.date)} ({day.voucherCount})</td>
                      <td className="px-4 py-2.5 text-end">{fmt(day.totalDebit)}</td>
                      <td className="px-4 py-2.5 text-end">{fmt(day.totalCredit)}</td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Cash Flow Statement ─────────────────────────────────────────────────────

interface WaterfallStep { name: string; value: number; kind: 'total' | 'delta'; base: number; pos: number; neg: number }

// Recharts has no waterfall: an invisible base series lifts each floating bar
// to where the previous step ended. A step that crosses zero is split into a
// positive and a negative piece stacked from zero.
export function buildWaterfall(steps: { name: string; value: number; kind: 'total' | 'delta' }[]): WaterfallStep[] {
  let running = 0
  return steps.map((s) => {
    const start = s.kind === 'total' ? 0 : running
    const end = s.kind === 'total' ? s.value : running + s.value
    running = end
    const low = Math.min(start, end)
    const high = Math.max(start, end)
    if (low >= 0) return { ...s, base: low, pos: high - low, neg: 0 }
    if (high <= 0) return { ...s, base: high, pos: 0, neg: low - high }
    return { ...s, base: 0, pos: high, neg: low }
  })
}

function cashFlowSteps(d: CashFlowStatementReport, t: TFunction) {
  return [
    { name: t('reports.fs.cf.openingCash'), value: d.openingCash, kind: 'total' as const },
    { name: t('reports.fs.cf.operating'), value: d.operating.total, kind: 'delta' as const },
    { name: t('reports.fs.cf.investing'), value: d.investing.total, kind: 'delta' as const },
    { name: t('reports.fs.cf.financing'), value: d.financing.total, kind: 'delta' as const },
    { name: t('reports.fs.cf.closingCash'), value: d.closingCash, kind: 'total' as const }
  ]
}

export function CashFlowStatementView({ data, fmt }: { data: CashFlowStatementReport; fmt: Fmt }) {
  const { t } = useTranslation()
  const water = buildWaterfall(cashFlowSteps(data, t))
  const stepColor = (s: WaterfallStep) => s.kind === 'total' ? COLORS.brand : s.value >= 0 ? COLORS.success : COLORS.danger

  const sections: { key: 'operating' | 'investing' | 'financing'; label: string; sec: CashFlowSection }[] = [
    { key: 'operating', label: t('reports.fs.cf.operating'), sec: data.operating },
    { key: 'investing', label: t('reports.fs.cf.investing'), sec: data.investing },
    { key: 'financing', label: t('reports.fs.cf.financing'), sec: data.financing }
  ]

  return (
    <div className="space-y-6">
      <Summary cards={[
        { label: t('reports.fs.cf.openingCash'), value: fmt(data.openingCash) },
        { label: t('reports.fs.cf.netChange'), value: fmt(data.netChange) },
        { label: t('reports.fs.cf.closingCash'), value: fmt(data.closingCash) },
        { label: t('reports.fs.cf.ledgerCash'), value: fmt(data.ledgerClosingCash) }
      ]} />

      <Card padding="md" className="flex flex-wrap items-center gap-4">
        <Badge variant={data.reconciled ? 'success' : 'danger'}>{data.reconciled ? t('reports.fs.cf.reconciled') : t('reports.fs.cf.notReconciled')}</Badge>
        {data.cashAccounts.map((a) => (
          <span key={a.accountCode} className="text-sm text-slate-600 dark:text-slate-300">{a.accountCode} {a.name}: {fmt(a.opening)} → {fmt(a.closing)}</span>
        ))}
      </Card>

      <ChartPanel title={t('reports.fs.cf.chartTitle')}>
        <BarChart data={water}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} />
          <ReferenceLine y={0} stroke="#cbd5e1" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={false}
            content={({ payload }) => {
              const step = payload?.[0]?.payload as WaterfallStep | undefined
              if (!step) return null
              return (
                <div style={TOOLTIP_STYLE} className="bg-white dark:bg-slate-900 px-3 py-2">
                  <div className="font-semibold">{step.name}</div>
                  <div>{fmt(step.value)}</div>
                </div>
              )
            }}
          />
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="pos" stackId="w" isAnimationActive={false}>
            {water.map((s) => <Cell key={s.name} fill={stepColor(s)} />)}
          </Bar>
          <Bar dataKey="neg" stackId="w" isAnimationActive={false}>
            {water.map((s) => <Cell key={s.name} fill={stepColor(s)} />)}
          </Bar>
        </BarChart>
      </ChartPanel>

      <div className={cn(PANEL, 'overflow-x-auto')}>
        <table className="w-full text-sm">
          <tbody>
            <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
              <td className="px-5 py-3">{t('reports.fs.cf.openingCash')}</td>
              <td className="px-5 py-3 text-end">{fmt(data.openingCash)}</td>
            </tr>
            {sections.map(({ key, label, sec }) => (
              <React.Fragment key={key}>
                <tr><td className="px-5 py-3 font-semibold text-dark dark:text-slate-100" colSpan={2}>{label}</td></tr>
                {sec.items.map((item, i) => (
                  <tr key={`${item.kind}-${item.accountCode}-${i}`} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-5 py-2.5 ps-8 text-slate-600 dark:text-slate-300">{cfItemLabel(t, item, key)}</td>
                    <td className="px-5 py-2.5 text-end text-dark dark:text-slate-100">{fmt(item.amount)}</td>
                  </tr>
                ))}
                <tr className="border-b border-slate-100 dark:border-slate-800 font-bold">
                  <td className="px-5 py-3 text-dark dark:text-slate-100">{label}</td>
                  <td className="px-5 py-3 text-end text-dark dark:text-slate-100">{fmt(sec.total)}</td>
                </tr>
              </React.Fragment>
            ))}
            <tr className="font-semibold">
              <td className="px-5 py-3">{t('reports.fs.cf.netChange')}</td>
              <td className="px-5 py-3 text-end">{fmt(data.netChange)}</td>
            </tr>
            <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold">
              <td className="px-5 py-4">{t('reports.fs.cf.closingCash')}</td>
              <td className="px-5 py-4 text-end">{fmt(data.closingCash)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Export, summary and PDF chart builders (used by ReportsScreen) ─────────

export function financialStatementExport(id: FinancialStatementId, data: unknown, t: TFunction, cur: string): { headers: string[]; rows: Cell2[][] } {
  const amt = `${t('common.amount')} (${cur})`
  if (id === 'balanceSheet') {
    const d = data as BalanceSheetReport
    const cmp = d.compareAsOf !== null && d.compareTotals !== null
    const headers = [t('reports.col.account'), d.asOf, ...(cmp ? [d.compareAsOf as string, t('reports.fs.bs.change')] : [])]
    const line = (label: string, a: number, c: number | null): Cell2[] => [label, a, ...(cmp ? [c ?? 0, roundTo2(a - (c ?? 0))] : [])]
    const rows: Cell2[][] = []
    for (const side of ['ASSET', 'LIABILITY', 'EQUITY'] as const) {
      for (const gr of d.groups.filter((x) => x.side === side)) {
        rows.push([groupLabel(t, gr.key), ...(cmp ? ['', '', ''] : [''])])
        for (const r of gr.rows) rows.push(line(bsRowLabel(t, r), r.amount, r.compareAmount))
      }
      const total = side === 'ASSET' ? d.totals.assets : side === 'LIABILITY' ? d.totals.liabilities : d.totals.equity
      const cTotal = cmp ? (side === 'ASSET' ? d.compareTotals!.assets : side === 'LIABILITY' ? d.compareTotals!.liabilities : d.compareTotals!.equity) : null
      rows.push(line(side === 'ASSET' ? t('reports.fs.bs.totalAssets') : side === 'LIABILITY' ? t('reports.fs.bs.totalLiabilities') : t('reports.fs.bs.totalEquity'), total, cTotal))
    }
    rows.push(line(t('reports.fs.bs.liabilitiesAndEquity'), d.totals.liabilitiesAndEquity, cmp ? d.compareTotals!.liabilitiesAndEquity : null))
    rows.push([`${t('reports.fs.bs.checkLine')}: ${d.balanced ? t('reports.summary.balanced') : t('reports.summary.notBalanced')}`, d.difference, ...(cmp ? ['', ''] : [])])
    return { headers, rows }
  }
  if (id === 'generalLedger') {
    const d = data as GeneralLedgerReport
    return {
      headers: [t('common.date'), t('reports.fs.gl.entryNo'), t('reports.fs.gl.source'), t('reports.fs.gl.narration'), `${t('common.debit')} (${cur})`, `${t('common.credit')} (${cur})`, `${t('common.balance')} (${cur})`],
      rows: [
        [t('reports.col.openingBalance'), '', '', `${d.account.accountCode} — ${d.account.accountName}`, '', '', d.openingBalance],
        ...d.lines.map((l): Cell2[] => [
          l.date, l.entryNumber, `${sourceLabel(t, l.sourceType)}${l.sourceRef ? ` ${l.sourceRef}` : ''}`,
          l.isCarryForward ? t('reports.fs.gl.carryForward') : (l.narration ?? l.remarks ?? ''), l.debit || '', l.credit || '', l.balance
        ]),
        [t('reports.col.closingBalance'), '', '', '', d.totalDebit, d.totalCredit, d.closingBalance]
      ]
    }
  }
  if (id === 'dayBook') {
    const d = data as DayBookReport
    const dayTotals = new Map(d.days.map((x) => [x.date, x]))
    const lastOfDay = new Map<string, string>()
    for (const v of d.vouchers) lastOfDay.set(v.date, v.id)
    const rows: Cell2[][] = []
    for (const v of d.vouchers) {
      rows.push([v.date, v.entryNumber, t(`reports.fs.voucherTypes.${v.voucherType}`), v.narration ?? v.lines.map((l) => l.account).join(' / '), v.debit, v.credit])
      const day = dayTotals.get(v.date)
      if (day && lastOfDay.get(v.date) === v.id) rows.push([v.date, '', t('reports.fs.db.dayTotal'), '', day.totalDebit, day.totalCredit])
    }
    rows.push([t('common.total'), '', '', '', d.totalDebit, d.totalCredit])
    return { headers: [t('common.date'), t('reports.fs.db.voucher'), t('reports.fs.voucherType'), t('reports.fs.db.particulars'), `${t('common.debit')} (${cur})`, `${t('common.credit')} (${cur})`], rows }
  }
  const d = data as CashFlowStatementReport
  const rows: Cell2[][] = [[t('reports.fs.cf.openingCash'), '', d.openingCash]]
  for (const [key, label, sec] of [['operating', t('reports.fs.cf.operating'), d.operating], ['investing', t('reports.fs.cf.investing'), d.investing], ['financing', t('reports.fs.cf.financing'), d.financing]] as const) {
    for (const item of sec.items) rows.push([label, cfItemLabel(t, item, key), item.amount])
    rows.push([label, t('common.total'), sec.total])
  }
  rows.push([t('reports.fs.cf.netChange'), '', d.netChange], [t('reports.fs.cf.closingCash'), '', d.closingCash])
  return { headers: [t('reports.fs.cf.section'), t('reports.fs.cf.item'), amt], rows }
}

function roundTo2(n: number): number { return roundToCurrency(n) }

export function financialStatementSummary(id: FinancialStatementId, data: unknown, t: TFunction, fmt: Fmt): { label: string; value: string }[] {
  if (id === 'balanceSheet') {
    const d = data as BalanceSheetReport
    return [
      { label: t('reports.fs.bs.totalAssets'), value: fmt(d.totals.assets) },
      { label: t('reports.fs.bs.totalLiabilities'), value: fmt(d.totals.liabilities) },
      { label: t('reports.fs.bs.totalEquity'), value: fmt(d.totals.equity) },
      { label: t('reports.fs.bs.checkLine'), value: d.balanced ? t('reports.summary.balanced') : t('reports.summary.notBalanced') }
    ]
  }
  if (id === 'generalLedger') {
    const d = data as GeneralLedgerReport
    return [
      { label: t('reports.col.openingBalance'), value: fmt(d.openingBalance) },
      { label: t('reports.fs.gl.totalDebit'), value: fmt(d.totalDebit) },
      { label: t('reports.fs.gl.totalCredit'), value: fmt(d.totalCredit) },
      { label: t('reports.col.closingBalance'), value: fmt(d.closingBalance) }
    ]
  }
  if (id === 'dayBook') {
    const d = data as DayBookReport
    return [
      { label: t('reports.fs.db.vouchers'), value: String(d.totalVouchers) },
      { label: t('common.debit'), value: fmt(d.totalDebit) },
      { label: t('common.credit'), value: fmt(d.totalCredit) }
    ]
  }
  const d = data as CashFlowStatementReport
  return [
    { label: t('reports.fs.cf.openingCash'), value: fmt(d.openingCash) },
    { label: t('reports.fs.cf.netChange'), value: fmt(d.netChange) },
    { label: t('reports.fs.cf.closingCash'), value: fmt(d.closingCash) }
  ]
}

type PdfChart =
  | { type: 'bar'; title: string; data: { label: string; value: number; color?: string }[]; valueIsCurrency?: boolean }
  | { type: 'line'; title: string; data: { label: string; value: number }[]; valueIsCurrency?: boolean }

export function financialStatementCharts(id: FinancialStatementId, data: unknown, t: TFunction): PdfChart[] {
  if (id === 'balanceSheet') {
    const d = data as BalanceSheetReport
    return [{ type: 'bar', title: t('reports.fs.bs.chartTitle'), valueIsCurrency: true, data: [
      { label: t('reports.fs.bs.assets'), value: d.totals.assets, color: COLORS.brand },
      { label: t('reports.fs.bs.liabilities'), value: d.totals.liabilities, color: COLORS.warning },
      { label: t('reports.fs.bs.equity'), value: d.totals.equity, color: COLORS.success }
    ] }]
  }
  if (id === 'generalLedger') {
    const d = data as GeneralLedgerReport
    if (d.lines.length === 0) return []
    return [{ type: 'line', title: t('reports.fs.gl.runningBalance'), valueIsCurrency: true, data: d.lines.map((l) => ({ label: l.date, value: l.balance })) }]
  }
  if (id === 'dayBook') {
    const d = data as DayBookReport
    if (d.days.length === 0) return []
    return [{ type: 'bar', title: t('reports.fs.db.dailyTotal'), valueIsCurrency: true, data: d.days.slice(-60).map((x) => ({ label: x.date, value: x.totalDebit, color: COLORS.brand })) }]
  }
  const d = data as CashFlowStatementReport
  return [{ type: 'bar', title: t('reports.fs.cf.chartTitle'), valueIsCurrency: true, data: [
    { label: t('reports.fs.cf.openingCash'), value: d.openingCash, color: COLORS.brand },
    { label: t('reports.fs.cf.operating'), value: d.operating.total, color: d.operating.total >= 0 ? COLORS.success : COLORS.danger },
    { label: t('reports.fs.cf.investing'), value: d.investing.total, color: d.investing.total >= 0 ? COLORS.success : COLORS.danger },
    { label: t('reports.fs.cf.financing'), value: d.financing.total, color: d.financing.total >= 0 ? COLORS.success : COLORS.danger },
    { label: t('reports.fs.cf.closingCash'), value: d.closingCash, color: COLORS.brand }
  ] }]
}
