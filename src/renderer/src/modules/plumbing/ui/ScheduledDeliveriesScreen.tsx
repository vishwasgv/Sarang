import React, { useState, useEffect, useCallback } from 'react'
import { Truck, RefreshCw, ArrowRight, XCircle } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'

interface DeliveryInvoice {
  id: string
  invoiceNumber: string
  totalAmount: number
  scheduledDeliveryDate: string
  deliveryAddress: string | null
  deliveryStatus: string
  customer: { id: string; customerName: string; phone: string | null } | null
}

const NEXT_STATUS: Record<string, 'OUT_FOR_DELIVERY' | 'DELIVERED' | null> = {
  SCHEDULED: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
  DELIVERED: null,
  CANCELLED: null,
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
  SCHEDULED: 'warning',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
}

// Phase 69 — Plumbing vertical, scheduled delivery for fragile sanitaryware.
// English-only for now, same deliberate scope-fork convention as Phase 38's
// Print Labels screen — full-language translation is a later task.
export function ScheduledDeliveriesScreen(): React.JSX.Element {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('billing.createInvoice')

  const [deliveries, setDeliveries] = useState<DeliveryInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.billing.listScheduledDeliveries()
      if (res.success) setDeliveries((res.data as DeliveryInvoice[]) ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load scheduled deliveries.')
    } catch {
      toastError('Error', 'Could not load scheduled deliveries.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { void load() }, [load])

  async function advance(id: string, status: 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED') {
    setUpdatingId(id)
    try {
      const res = await window.api.billing.updateDeliveryStatus({ invoiceId: id, status })
      if (res.success) await load()
      else toastError('Error', res.error?.message ?? 'Could not update delivery status.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><Truck size={20} /> Scheduled Deliveries</h2>
          <p className="text-sm text-slate-400">Fragile sanitaryware deliveries booked at billing time.</p>
        </div>
        <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : deliveries.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <Truck size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No scheduled deliveries yet.</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {deliveries.map((d) => {
              const next = NEXT_STATUS[d.deliveryStatus]
              return (
                <div key={d.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{d.invoiceNumber}</span>
                      <Badge variant={STATUS_VARIANT[d.deliveryStatus] ?? 'neutral'} size="sm">{d.deliveryStatus.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{d.customer?.customerName ?? 'Walk-in'}{d.deliveryAddress ? ` — ${d.deliveryAddress}` : ''}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                      <span>Scheduled {new Date(d.scheduledDeliveryDate).toLocaleDateString()}</span>
                      <span className="font-semibold text-dark dark:text-slate-100">{formatCurrency(d.totalAmount)}</span>
                    </div>
                  </div>
                  {canManage && (next || d.deliveryStatus !== 'CANCELLED') && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {next && (
                        <button onClick={() => void advance(d.id, next)} disabled={updatingId === d.id} className="text-xs px-3 py-1.5 rounded-lg bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 flex items-center gap-1 font-medium">
                          <ArrowRight size={12} /> {next.replace(/_/g, ' ')}
                        </button>
                      )}
                      {d.deliveryStatus !== 'DELIVERED' && d.deliveryStatus !== 'CANCELLED' && (
                        <button onClick={() => void advance(d.id, 'CANCELLED')} disabled={updatingId === d.id} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:text-slate-500"><XCircle size={14} /></button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
