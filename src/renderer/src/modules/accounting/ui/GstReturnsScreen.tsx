import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileJson } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { toLocalISODate } from '@shared/utils/locale.util'

type Kind = 'gstr1' | 'gstr3b'

type ReconStatus = 'MATCHED' | 'MISMATCH' | 'MISSING_IN_BOOKS' | 'MISSING_IN_PORTAL' | 'REVIEW'
interface ReconRow {
  status: ReconStatus; supplierGstin: string; supplierName: string; invoiceNumber: string; date: string
  portalTax: number | null; booksTax: number | null; billNumber: string; note: string
}
interface ReconReport {
  rows: ReconRow[]; counts: Record<ReconStatus, number>; claimablePerPortal: number; creditAtRisk: number
  fileName: string; period: string; portalDocCount: number
}
const STATUS_ORDER: ReconStatus[] = ['MATCHED', 'MISMATCH', 'MISSING_IN_BOOKS', 'MISSING_IN_PORTAL', 'REVIEW']
const STATUS_COLOR: Record<ReconStatus, string> = { MATCHED: '#22C55E', MISMATCH: '#F59E0B', MISSING_IN_BOOKS: '#EF4444', MISSING_IN_PORTAL: '#8B5CF6', REVIEW: '#64748B' }
function thisMonth(): string {
  return toLocalISODate(new Date()).slice(0, 7)
}

export function GstReturnsScreen() {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [month, setMonth] = useState(thisMonth)
  const [busy, setBusy] = useState<Kind | null>(null)
  const [reconBusy, setReconBusy] = useState(false)
  const [recon, setRecon] = useState<ReconReport | null>(null)

  async function compare() {
    setReconBusy(true)
    try {
      const res = await window.api.gstReturns.reconcile()
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.gstReturns.couldNotPrepare')); return }
      if (res.data) setRecon(res.data as ReconReport)
    } catch {
      toastError(t('common.error'), t('accounting.gstReturns.couldNotPrepare'))
    } finally { setReconBusy(false) }
  }

  async function download(kind: Kind) {
    setBusy(kind)
    try {
      const res = kind === 'gstr1'
        ? await window.api.gstReturns.exportGstr1({ month })
        : await window.api.gstReturns.exportGstr3b({ month })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.gstReturns.couldNotPrepare')); return }
      const data = res.data as { saved: boolean; path?: string } | undefined
      if (data?.saved) toastSuccess(t('accounting.gstReturns.saved'), data.path ?? '')
    } catch {
      toastError(t('common.error'), t('accounting.gstReturns.couldNotPrepare'))
    } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center"><FileJson size={18} className="text-brand" /></div>
          <div>
            <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.gstReturns.title')}</h1>
            <p className="text-xs text-slate-400">{t('accounting.gstReturns.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 dark:bg-slate-950 space-y-6 max-w-3xl">
        <Card padding="md" className="space-y-3">
          <label className="block text-sm font-semibold text-dark dark:text-slate-100" htmlFor="gst-month">{t('accounting.gstReturns.month')}</label>
          <input
            id="gst-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </Card>

        <Card padding="md" className="space-y-2">
          <h2 className="font-semibold text-dark dark:text-slate-100">{t('accounting.gstReturns.gstr1Title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('accounting.gstReturns.gstr1Help')}</p>
          <Button onClick={() => download('gstr1')} loading={busy === 'gstr1'} disabled={!month}>{t('accounting.gstReturns.download')}</Button>
        </Card>

        <Card padding="md" className="space-y-2">
          <h2 className="font-semibold text-dark dark:text-slate-100">{t('accounting.gstReturns.gstr3bTitle')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('accounting.gstReturns.gstr3bHelp')}</p>
          <Button onClick={() => download('gstr3b')} loading={busy === 'gstr3b'} disabled={!month}>{t('accounting.gstReturns.download')}</Button>
        </Card>

        <Card padding="md" className="space-y-3">
          <h2 className="font-semibold text-dark dark:text-slate-100">{t('accounting.gstReturns.reconTitle')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('accounting.gstReturns.reconHelp')}</p>
          <Button onClick={compare} loading={reconBusy}>{t('accounting.gstReturns.reconChoose')}</Button>
          {recon && <ReconView data={recon} />}
        </Card>

        <p className="text-xs text-slate-400">{t('accounting.gstReturns.disclaimer')}</p>
      </div>
    </div>
  )
}

function ReconView({ data }: { data: ReconReport }) {
  const { t } = useTranslation()
  const chart = STATUS_ORDER.map((k) => ({ name: t(`accounting.gstReturns.status.${k}`), count: data.counts[k], key: k }))
  return (
    <div className="space-y-4 pt-2">
      <p className="text-xs text-slate-400">{data.fileName} · {data.portalDocCount}</p>
      <div className="grid grid-cols-2 gap-3">
        <div><div className="text-xs uppercase text-slate-400">{t('accounting.gstReturns.claimable')}</div><div className="text-lg font-bold text-dark dark:text-slate-100">{formatCurrency(data.claimablePerPortal)}</div></div>
        <div><div className="text-xs uppercase text-slate-400">{t('accounting.gstReturns.atRisk')}</div><div className="text-lg font-bold text-dark dark:text-slate-100">{formatCurrency(data.creditAtRisk)}</div></div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chart}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#00AEEF" />
        </BarChart>
      </ResponsiveContainer>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
              <th className="px-3 py-2 text-start">{t('accounting.gstReturns.colStatus')}</th>
              <th className="px-3 py-2 text-start">{t('accounting.gstReturns.colSupplier')}</th>
              <th className="px-3 py-2 text-start">{t('accounting.gstReturns.colInvoice')}</th>
              <th className="px-3 py-2 text-end">{t('accounting.gstReturns.colPortalTax')}</th>
              <th className="px-3 py-2 text-end">{t('accounting.gstReturns.colBooksTax')}</th>
              <th className="px-3 py-2 text-start">{t('accounting.gstReturns.colBill')}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.filter((r) => r.status !== 'MATCHED' || r.note).concat(data.rows.filter((r) => r.status === 'MATCHED' && !r.note)).map((r, i) => (
              <tr key={i} className="border-b border-slate-50 dark:border-slate-800">
                <td className="px-3 py-2"><span className="inline-block w-2 h-2 rounded-full me-2" style={{ background: STATUS_COLOR[r.status] }} />{t(`accounting.gstReturns.status.${r.status}`)}{r.note && <span className="text-xs text-slate-400 ms-2">{t(`accounting.gstReturns.note.${r.note}`)}</span>}</td>
                <td className="px-3 py-2">{r.supplierName || r.supplierGstin}</td>
                <td className="px-3 py-2">{r.invoiceNumber}</td>
                <td className="px-3 py-2 text-end">{r.portalTax === null ? '—' : formatCurrency(r.portalTax)}</td>
                <td className="px-3 py-2 text-end">{r.booksTax === null ? '—' : formatCurrency(r.booksTax)}</td>
                <td className="px-3 py-2">{r.billNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
