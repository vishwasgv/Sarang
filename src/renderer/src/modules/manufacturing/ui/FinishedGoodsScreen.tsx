import React, { useEffect, useState, useCallback } from 'react'
import { Package, RefreshCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatNumber, formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { useNotificationStore } from '@app/store/notification.store'

interface FinishedGood {
  id: string
  productName: string
  sku: string | null
  currentStock: number
  unit: string
  sellingPrice: number
  hasBom: boolean
}

interface ProductionHistory {
  id: string
  orderNumber: string
  plannedQty: number
  producedQty: number
  status: string
  completedDate: string | null
  createdAt: string
}

// ProductionHistory.status mirrors ProductionOrder.status ('DRAFT' | 'IN_PROGRESS' |
// 'COMPLETED' | 'CANCELLED' — see ProductionOrdersScreen.tsx). The ?? 'neutral'
// fallback below is a safety net only, never the primary mapping.
const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger'
}

export function FinishedGoodsScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [goods, setGoods] = useState<FinishedGood[]>([])
  const [loading, setLoading] = useState(true)
  const [historyTarget, setHistoryTarget] = useState<FinishedGood | null>(null)
  const [history, setHistory] = useState<ProductionHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load all BOMs to get which products are finished goods
      const [bomsRes, productsRes] = await Promise.all([
        api.bom.list(),
        api.products.list({ page: 1, limit: 500 })
      ])

      if (bomsRes.success && bomsRes.data && productsRes.success && productsRes.data) {
        const boms = bomsRes.data as Array<{ productId: string }>
        const bomProductIds = new Set(boms.map(b => b.productId))
        const productsData = productsRes.data as { products: Array<{ id: string; productName: string; sku: string | null; unit: string; sellingPrice: number; inventory: { quantity: number } | null }> }

        const finishedGoods: FinishedGood[] = productsData.products
          .filter(p => bomProductIds.has(p.id))
          .map(p => ({
            id: p.id,
            productName: p.productName,
            sku: p.sku,
            currentStock: p.inventory?.quantity ?? 0,
            unit: p.unit,
            sellingPrice: p.sellingPrice,
            hasBom: true
          }))
        setGoods(finishedGoods)
      } else {
        toastError(t('common.error'), (bomsRes.error ?? productsRes.error)?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { loadData() }, [loadData])

  async function openHistory(good: FinishedGood) {
    setHistoryTarget(good)
    setHistoryLoading(true)
    const res = await api.production.list({ productId: good.id, limit: 50 })
    if (res.success && res.data) {
      const d = res.data as { orders: ProductionHistory[] }
      setHistory(d.orders)
    }
    setHistoryLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Package size={24} className="text-brand" />
              {t('manufacturing.finishedGoods')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{t('manufacturing.finishedGoodsSubtitle')}</p>
          </div>
          <button onClick={loadData} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : goods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
            <Package size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{t('manufacturing.noFinishedGoods')}</p>
            <p className="text-sm mt-1">{t('manufacturing.noFinishedGoodsDesc')}</p>
          </div>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-alt border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-text-secondary">{t('billing.product')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase text-text-secondary">{t('manufacturing.inStock')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase text-text-secondary">{t('manufacturing.sellingPrice')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {goods.map(g => (
                  <tr key={g.id} className="hover:bg-surface-hover/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{g.productName}</p>
                      {g.sku && <p className="text-xs text-text-secondary mt-0.5">SKU: {g.sku}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${g.currentStock > 0 ? 'text-success' : 'text-text-secondary'}`}>
                        {formatNumber(g.currentStock, { maximumFractionDigits: 2 })} {g.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(g.sellingPrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openHistory(g)} className="px-3 py-1.5 rounded-lg text-xs text-brand hover:bg-brand/5 border border-brand/30 transition-colors">
                        {t('manufacturing.productionHistory')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* History Modal */}
      {historyTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{t('manufacturing.productionHistory')}</h2>
                <p className="text-sm text-text-secondary">{historyTarget.productName}</p>
              </div>
              <button onClick={() => setHistoryTarget(null)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {historyLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-center text-text-secondary py-10">{t('manufacturing.noProductionHistory')}</p>
              ) : (
                <div className="space-y-2">
                  {history.map(h => (
                    <div key={h.id} className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
                      <div>
                        <p className="font-mono text-sm font-semibold text-brand">{h.orderNumber}</p>
                        <p className="text-xs text-text-secondary mt-0.5">{formatDate(h.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={STATUS_VARIANT[h.status] ?? 'neutral'} size="sm">{h.status}</Badge>
                        <p className="text-xs text-text-secondary mt-1">
                          {h.status === 'COMPLETED' ? `${t('manufacturing.producedStat')} ${h.producedQty}` : `${t('manufacturing.planned')} ${h.plannedQty}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
