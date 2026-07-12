import React, { useEffect, useState, useCallback } from 'react'
import { BarChart3, RefreshCw, TrendingUp, Package, FlaskConical, CheckCircle2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'

interface OrdersData {
  id: string
  orderNumber: string
  productName: string
  status: string
  plannedQty: number
  producedQty: number
  totalMaterialCost: number
  createdAt: string
}

interface Analytics {
  total: number
  draft: number
  inProgress: number
  completed: number
  cancelled: number
  totalPlanned: number
  totalProduced: number
  yieldRate: number
  totalMaterialCost: number
}

export function ProductionAnalyticsScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [orders, setOrders] = useState<OrdersData[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [rawMatCount, setRawMatCount] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
    const [ordersRes, matRes] = await Promise.all([
      api.production.list({ limit: 1000 }),
      api.rawMaterials.list({ limit: 500 })
    ])

    if (ordersRes.success && ordersRes.data) {
      const d = ordersRes.data as { orders: OrdersData[]; total: number }
      const ords = d.orders ?? []
      setOrders(ords)

      const completed = ords.filter(o => o.status === 'COMPLETED')
      const totalPlanned = completed.reduce((s, o) => s + o.plannedQty, 0)
      const totalProduced = completed.reduce((s, o) => s + o.producedQty, 0)

      setAnalytics({
        total: ords.length,
        draft: ords.filter(o => o.status === 'DRAFT').length,
        inProgress: ords.filter(o => o.status === 'IN_PROGRESS').length,
        completed: completed.length,
        cancelled: ords.filter(o => o.status === 'CANCELLED').length,
        totalPlanned,
        totalProduced,
        yieldRate: totalPlanned > 0 ? Math.round((totalProduced / totalPlanned) * 100) : 0,
        totalMaterialCost: ords.reduce((s, o) => s + (o.totalMaterialCost ?? 0), 0)
      })
    }

    if (matRes.success && matRes.data) {
      const md = matRes.data as { total: number }
      setRawMatCount(md.total ?? 0)
    }
    if (!(ordersRes.success && ordersRes.data) || !(matRes.success && matRes.data)) {
      toastError(t('common.error'), (ordersRes.error ?? matRes.error)?.message ?? t('common.error'))
    }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { loadData() }, [loadData])

  const recentCompleted = orders.filter(o => o.status === 'COMPLETED').slice(0, 8)

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <BarChart3 size={24} className="text-brand" />
              {t('manufacturing.analytics')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{t('manufacturing.analyticsSubtitle')}</p>
          </div>
          <button onClick={loadData} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KpiCard label={t('manufacturing.totalOrders')} value={analytics?.total ?? 0} icon={<Package size={18} />} color="brand" />
              <KpiCard label={t('manufacturing.statusInProgress')} value={analytics?.inProgress ?? 0} icon={<TrendingUp size={18} />} color="info" />
              <KpiCard label={t('manufacturing.statusCompleted')} value={analytics?.completed ?? 0} icon={<CheckCircle2 size={18} />} color="success" />
              <KpiCard label={t('manufacturing.statusCancelled')} value={analytics?.cancelled ?? 0} icon={<XCircle size={18} />} color="danger" />
            </div>

            {/* Yield & Cost */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card padding="lg">
                <p className="text-sm text-text-secondary">{t('manufacturing.yieldRate')}</p>
                <div className="mt-2 flex items-end gap-2">
                  <p className="text-3xl font-bold text-success">{analytics?.yieldRate ?? 0}%</p>
                </div>
                <div className="mt-3 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full transition-all" style={{ width: `${analytics?.yieldRate ?? 0}%` }} />
                </div>
              </Card>

              <KpiCard label={t('manufacturing.totalMaterialCost')} value={formatCurrency(analytics?.totalMaterialCost ?? 0)} color="neutral" />

              <KpiCard label={t('manufacturing.rawMatsTracked')} value={rawMatCount} icon={<FlaskConical size={20} />} color="brand" />
            </div>

            {/* Status Breakdown Bar */}
            {(analytics?.total ?? 0) > 0 && (
              <Card padding="lg">
                <p className="text-sm font-semibold text-text-primary mb-3">{t('manufacturing.orderStatusBreakdown')}</p>
                <div className="flex h-4 rounded-full overflow-hidden gap-px">
                  {[
                    { status: 'COMPLETED', count: analytics?.completed ?? 0, color: 'bg-success' },
                    { status: 'IN_PROGRESS', count: analytics?.inProgress ?? 0, color: 'bg-info' },
                    { status: 'DRAFT', count: analytics?.draft ?? 0, color: 'bg-slate-300' },
                    { status: 'CANCELLED', count: analytics?.cancelled ?? 0, color: 'bg-danger' },
                  ].filter(s => s.count > 0).map(s => (
                    <div key={s.status} className={`${s.color} transition-all`} style={{ width: `${((s.count / (analytics?.total ?? 1)) * 100).toFixed(1)}%` }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 mt-3">
                  {[
                    { label: t('manufacturing.statusCompleted'), count: analytics?.completed ?? 0, color: 'bg-success' },
                    { label: t('manufacturing.statusInProgress'), count: analytics?.inProgress ?? 0, color: 'bg-info' },
                    { label: t('manufacturing.statusDraft'), count: analytics?.draft ?? 0, color: 'bg-slate-300' },
                    { label: t('manufacturing.statusCancelled'), count: analytics?.cancelled ?? 0, color: 'bg-danger' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <div className={`w-2.5 h-2.5 rounded-sm ${s.color}`} />
                      {s.label}: <span className="font-semibold text-text-primary">{s.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Recent Completed Orders */}
            {recentCompleted.length > 0 && (
              <Card padding="none" className="overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-text-primary">{t('manufacturing.recentCompleted')}</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-surface-alt border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-text-secondary">{t('purchaseOrders.orderNumber')}</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-text-secondary">{t('billing.product')}</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-text-secondary">{t('manufacturing.producedCol')}</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-text-secondary">{t('manufacturing.yieldCol')}</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-text-secondary">{t('manufacturing.totalMaterialCost')}</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-text-secondary">{t('manufacturing.costPerUnit')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentCompleted.map(o => {
                      const yield_ = o.plannedQty > 0 ? Math.round((o.producedQty / o.plannedQty) * 100) : 0
                      const costPerUnit = o.producedQty > 0 ? (o.totalMaterialCost ?? 0) / o.producedQty : 0
                      return (
                        <tr key={o.id} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="px-4 py-2 font-mono text-xs text-brand">{o.orderNumber}</td>
                          <td className="px-4 py-2 text-text-primary">{o.productName}</td>
                          <td className="px-4 py-2 text-right font-semibold text-text-primary">{o.producedQty}</td>
                          <td className="px-4 py-2 text-right">
                            <span className={`text-xs font-semibold ${yield_ >= 90 ? 'text-success' : yield_ >= 70 ? 'text-warning' : 'text-danger'}`}>{yield_}%</span>
                          </td>
                          <td className="px-4 py-2 text-right text-text-secondary text-xs">{formatCurrency(o.totalMaterialCost ?? 0)}</td>
                          <td className="px-4 py-2 text-right text-xs font-semibold text-brand">{formatCurrency(costPerUnit)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            )}

            {analytics?.total === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
                <BarChart3 size={40} className="mb-3 opacity-30" />
                <p className="text-base font-medium">{t('manufacturing.noProductionData')}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
