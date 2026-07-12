import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { useNotificationStore } from '@app/store/notification.store'

interface AnalyticsData {
  period: { from: string; to: string }
  shipments: { total: number; byStatus: Record<string, number>; avgDeliveryDays: number; deliveryRate: number }
  challans: { total: number; delivered: number; returned: number }
  grns: { total: number; posted: number; totalValue: number }
  freight: { total: number; paid: number; pending: number; avgPerShipment: number }
  fleet: { total: number; byStatus: Record<string, number>; activeCarriers: number }
  monthlyShipments: Array<{ month: string; count: number; freight: number }>
  topCarriers: Array<{ carrierId: string | null; name: string; count: number }>
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#6b7280', READY: '#3b82f6', IN_TRANSIT: '#f59e0b', OUT_FOR_DELIVERY: '#8b5cf6',
  DELIVERED: '#10b981', RETURNED: '#f97316', CANCELLED: '#ef4444',
}

export default function LogisticsAnalyticsScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  // Applied values — only update when Apply is clicked, preventing auto-fetch on each keystroke
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await window.api.logisticsAnalytics.get({
        fromDate: appliedFrom || undefined, toDate: appliedTo || undefined,
      })
      if (res.success) {
        setData(res.data as AnalyticsData)
      } else {
        setLoadError(true)
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      setLoadError(true)
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [appliedFrom, appliedTo, toastError, t])

  useEffect(() => { load() }, [load])

  const handleApply = () => { setAppliedFrom(fromDate); setAppliedTo(toDate) }
  const handleClear = () => { setFromDate(''); setToDate(''); setAppliedFrom(''); setAppliedTo('') }

  const printAnalytics = () => {
    if (!data) return
    const statusRows = Object.entries(data.shipments.byStatus).map(([s, c]) => `<tr><td>${s}</td><td>${c}</td></tr>`).join('')
    const trendRows = data.monthlyShipments.map(m => `<tr><td>${m.month}</td><td>${m.count}</td><td>${formatCurrency(m.freight)}</td></tr>`).join('')
    const carrierRows = data.topCarriers.map((c, i) => `<tr><td>${i + 1}</td><td>${c.name}</td><td>${c.count}</td></tr>`).join('')
    const html = `<html><head><style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h2{margin-bottom:4px}.meta{margin-bottom:16px;font-size:11px;color:#666}h3{font-size:13px;margin:16px 0 8px}table{width:100%;border-collapse:collapse;margin-bottom:16px}th,td{border:1px solid #ccc;padding:6px}th{background:#f5f5f5}footer{margin-top:24px;font-size:10px;color:#888;text-align:center}</style></head><body><h2>Logistics Analytics</h2><div class="meta">Period: ${formatDate(data.period.from)} — ${formatDate(data.period.to)}</div><h3>Overview</h3><table><tr><th>Total Shipments</th><td>${data.shipments.total}</td></tr><tr><th>Delivery Rate</th><td>${data.shipments.deliveryRate}%</td></tr><tr><th>Avg Transit Time</th><td>${data.shipments.avgDeliveryDays} days</td></tr><tr><th>Freight Total / Pending</th><td>${formatCurrency(data.freight.total)} / ${formatCurrency(data.freight.pending)}</td></tr><tr><th>Fleet</th><td>${data.fleet.total} (${data.fleet.activeCarriers} active carriers)</td></tr></table><h3>Shipment Status</h3><table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>${statusRows}</tbody></table><h3>Monthly Trend</h3><table><thead><tr><th>Month</th><th>Shipments</th><th>Freight</th></tr></thead><tbody>${trendRows}</tbody></table>${carrierRows ? `<h3>Top Carriers</h3><table><thead><tr><th>#</th><th>Carrier</th><th>Shipments</th></tr></thead><tbody>${carrierRows}</tbody></table>` : ''}<footer>${aszurexFooterHtml(10)}</footer></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  if (loading) return <div className="p-4 text-center py-12 text-gray-500">{t('common.loading')}</div>
  if (loadError) return <div className="p-4 text-center py-12 text-danger">{t('common.error')}</div>
  if (!data) return <div className="p-4 text-center py-12 text-gray-400">{t('logistics.analytics.noData')}</div>

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">{t('logistics.analytics.title')}</h1>
        <div className="flex gap-2 items-center">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <span className="text-gray-400">{t('common.to')}</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <button onClick={handleApply} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">{t('common.apply')}</button>
          {(appliedFrom || appliedTo) && <button onClick={handleClear} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">{t('common.clear')}</button>}
          <button onClick={printAnalytics} className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.print')}</button>
        </div>
      </div>
      <p className="text-xs text-gray-400 -mt-4">{t('logistics.analytics.showingData', { from: formatDate(data.period.from), to: formatDate(data.period.to) })}</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <KpiCard label={t('logistics.analytics.totalShipments')} value={data.shipments.total} />
          <p className="text-xs text-gray-400 mt-1">{t('logistics.analytics.deliveryRate', { rate: data.shipments.deliveryRate })}</p>
        </div>
        <div>
          <KpiCard label={t('logistics.analytics.avgTransitTime')} value={t('logistics.analytics.days', { count: data.shipments.avgDeliveryDays })} />
          <p className="text-xs text-gray-400 mt-1">{t('logistics.analytics.inTransitToDelivered')}</p>
        </div>
        <div>
          <KpiCard label={t('logistics.analytics.freightPending')} value={formatCurrency(data.freight.pending)} color="danger" />
          <p className="text-xs text-gray-400 mt-1">{t('logistics.analytics.ofTotal', { total: formatCurrency(data.freight.total) })}</p>
        </div>
        <div>
          <KpiCard label={t('logistics.analytics.fleet')} value={data.fleet.total} />
          <p className="text-xs text-gray-400 mt-1">{t('logistics.analytics.activeCarriers', { count: data.fleet.activeCarriers })}</p>
        </div>
      </div>

      {/* Shipment Status Breakdown */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('logistics.analytics.statusBreakdown')}</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(data.shipments.byStatus).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] ?? '#9ca3af' }} />
              <span className="text-sm text-gray-600">{status}: <strong>{count}</strong></span>
            </div>
          ))}
        </div>
      </Card>

      {/* Monthly Trend */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('logistics.analytics.monthlyTrend')}</h2>
        {data.monthlyShipments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">{t('logistics.analytics.shipmentsCol')}</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.monthlyShipments} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => [v, t('logistics.analytics.shipmentsCol')]} />
                  <Bar dataKey="count" fill="#00AEEF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">{t('logistics.analytics.freightCol')}</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.monthlyShipments} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), t('logistics.analytics.freightCol')]} />
                  <Bar dataKey="freight" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">{t('logistics.analytics.month')}</th>
                <th className="text-right px-3 py-2">{t('logistics.analytics.shipmentsCol')}</th>
                <th className="text-right px-3 py-2">{t('logistics.analytics.freightCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.monthlyShipments.map(m => (
                <tr key={m.month} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{m.month}</td>
                  <td className="px-3 py-2 text-right">{m.count}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(m.freight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top Carriers */}
      {data.topCarriers.length > 0 && (
        <Card padding="md">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('logistics.analytics.topCarriers')}</h2>
          <ResponsiveContainer width="100%" height={Math.max(120, data.topCarriers.length * 36)}>
            <BarChart data={data.topCarriers} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => [v, t('logistics.analytics.shipmentsCol')]} />
              <Bar dataKey="count" fill="#00AEEF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* GRN + Challans + Fleet Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md" className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">{t('logistics.analytics.grns')}</h3>
          <div className="flex justify-between text-sm"><span className="text-gray-500">{t('common.total')}</span><strong>{data.grns.total}</strong></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">{t('logistics.analytics.posted')}</span><strong className="text-success">{data.grns.posted}</strong></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">{t('logistics.analytics.totalValue')}</span><strong>{formatCurrency(data.grns.totalValue)}</strong></div>
        </Card>
        <Card padding="md" className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">{t('logistics.challan.title')}</h3>
          <div className="flex justify-between text-sm"><span className="text-gray-500">{t('common.total')}</span><strong>{data.challans.total}</strong></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">{t('logistics.analytics.deliveredCol')}</span><strong className="text-success">{data.challans.delivered}</strong></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">{t('logistics.analytics.returnedCol')}</span><strong className="text-warning">{data.challans.returned}</strong></div>
        </Card>
        <Card padding="md" className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">{t('logistics.analytics.fleetStatus')}</h3>
          {Object.entries(data.fleet.byStatus).map(([status, count]) => (
            <div key={status} className="flex justify-between text-sm">
              <span className="text-gray-500">{status}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
