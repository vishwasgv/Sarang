import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ClipboardList, CheckCircle, Truck, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Modal } from '@shared/ui/molecules/Modal'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatDate } from '@shared/utils/locale.util'

interface Supplier { id: string; supplierName: string; supplierCode: string; phone?: string | null }
interface Product { id: string; productName: string; sku?: string | null; unit: string; inventory?: { quantity: number } | null }
interface POItem { id: string; quantity: number; unitCost: number; taxRate: number; total: number; product: Product }
interface PurchaseOrder {
  id: string; poNumber: string; status: string
  orderDate: string; expectedDate?: string | null; notes?: string | null
  subtotal: number; taxAmount: number; totalAmount: number
  supplier: Supplier; items: POItem[]
}

const STATUS_VARIANT: Record<string, 'neutral' | 'brand' | 'success' | 'danger' | 'warning'> = {
  DRAFT: 'neutral',
  APPROVED: 'brand',
  PARTIAL_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger'
}

export function PurchaseOrderDetailScreen() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const [po, setPO] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const canApprove = hasPermission('purchaseOrders.approve')
  const canReceive = hasPermission('purchaseOrders.receive')
  const canCancel = hasPermission('purchaseOrders.cancel')

  const loadPO = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await window.api.purchaseOrders.get(id)
      if (res.success) {
        setPO(res.data as PurchaseOrder)
      } else {
        setError(res.error?.message ?? 'Purchase order not found.')
      }
    } catch {
      setError('Something went wrong loading this purchase order.')
      toastError('Error', 'Something went wrong loading this purchase order.')
    } finally {
      setLoading(false)
    }
  }, [id, toastError])

  useEffect(() => { loadPO() }, [loadPO])

  async function handleApprove() {
    if (!po) return
    setApproving(true)
    try {
      const res = await window.api.purchaseOrders.approve(po.id)
      if (res.success) {
        toastSuccess('PO Approved', `${po.poNumber} is now approved and locked for editing.`)
        loadPO()
      } else {
        toastError('Error', res.error?.message ?? 'Failed to approve.')
      }
    } catch {
      toastError('Error', 'Failed to approve. Please try again.')
    } finally {
      setApproving(false)
    }
  }

  async function handleReceive() {
    if (!po) return
    setReceiving(true)
    try {
      const res = await window.api.purchaseOrders.receive(po.id)
      if (res.success) {
        toastSuccess('Stock Received', `Inventory updated for all items in ${po.poNumber}.`)
        loadPO()
      } else {
        toastError('Error', res.error?.message ?? 'Failed to receive stock.')
      }
    } catch {
      toastError('Error', 'Failed to receive stock. Please try again.')
    } finally {
      setReceiving(false)
    }
  }

  async function handleCancel() {
    if (!po || !cancelReason.trim()) return
    setCancelling(true)
    try {
      const res = await window.api.purchaseOrders.cancel({ id: po.id, reason: cancelReason.trim() })
      if (res.success) {
        toastSuccess('PO Cancelled', `${po.poNumber} has been cancelled.`)
        setCancelOpen(false)
        loadPO()
      } else {
        toastError('Error', res.error?.message ?? 'Failed to cancel.')
      }
    } catch {
      toastError('Error', 'Failed to cancel. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error || !po) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <ClipboardList size={40} className="text-slate-200 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">{error ?? t('purchaseOrders.poNotFound')}</p>
        <button onClick={() => navigate('/purchase-orders')} className="mt-4 text-brand text-sm font-medium hover:underline">
          {t('purchaseOrders.backToPOs')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/purchase-orders')}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <ClipboardList size={20} className="text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-dark dark:text-slate-100 font-mono">{po.poNumber}</h1>
              <Badge variant={STATUS_VARIANT[po.status] ?? 'neutral'} size="sm">
                {po.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="text-sm text-slate-400">
              {formatDate(po.orderDate)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {po.status === 'DRAFT' && canApprove && (
            <Button size="sm" onClick={handleApprove} loading={approving}>
              <CheckCircle size={14} className="mr-1.5" /> {t('purchaseOrders.approve')}
            </Button>
          )}
          {po.status === 'APPROVED' && canReceive && (
            <Button size="sm" onClick={handleReceive} loading={receiving}>
              <Truck size={14} className="mr-1.5" /> {t('purchaseOrders.receiveStock')}
            </Button>
          )}
          {(po.status === 'DRAFT' || po.status === 'APPROVED') && canCancel && (
            <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
              <XCircle size={14} className="mr-1.5" /> {t('purchaseOrders.cancelPO')}
            </Button>
          )}
        </div>
      </div>

      {/* Supplier info */}
      <div className="grid grid-cols-2 gap-4">
        <Card padding="md" className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('purchaseOrders.supplier')}</p>
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{po.supplier.supplierName}</p>
          <p className="text-xs text-slate-400">{po.supplier.supplierCode}</p>
          {po.supplier.phone && <p className="text-xs text-slate-500 dark:text-slate-400">{po.supplier.phone}</p>}
        </Card>
        <Card padding="md" className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('purchaseOrders.orderDetails')}</p>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">{t('purchaseOrders.orderDate')}</span>
            <span className="text-dark dark:text-slate-100">{formatDate(po.orderDate)}</span>
          </div>
          {po.expectedDate && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">{t('purchaseOrders.expectedBy')}</span>
              <span className="text-dark dark:text-slate-100">{formatDate(po.expectedDate)}</span>
            </div>
          )}
          {po.notes && (
            <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 mb-0.5">{t('common.notes')}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{po.notes}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Line items */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('purchaseOrders.orderItems')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('billing.product')}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('billing.qty')}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('purchaseOrders.unitCost')}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('purchaseOrders.taxPercent')}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.total')}</th>
                {po.status === 'RECEIVED' && (
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('inventory.currentStock')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {po.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-dark dark:text-slate-100">{item.product.productName}</p>
                    {item.product.sku && <p className="text-xs text-slate-400">SKU: {item.product.sku}</p>}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">{item.quantity} {item.product.unit}</td>
                  <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">{item.unitCost.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right text-slate-500 dark:text-slate-400">{item.taxRate > 0 ? `${item.taxRate}%` : '—'}</td>
                  <td className="px-5 py-3 text-right font-medium text-dark dark:text-slate-100">{item.total.toFixed(2)}</td>
                  {po.status === 'RECEIVED' && (
                    <td className="px-5 py-3 text-right text-success font-medium">
                      {item.product.inventory?.quantity ?? '—'} {item.product.unit}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <div className="space-y-1.5 min-w-48">
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>{t('billing.subtotal')}</span>
              <span>{po.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>{t('billing.tax')}</span>
              <span>{po.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-dark dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
              <span>{t('common.total')}</span>
              <span>{po.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Cancel dialog with reason */}
      <Modal
        open={cancelOpen}
        onClose={() => { setCancelOpen(false); setCancelReason('') }}
        title={t('purchaseOrders.cancelPoTitle')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setCancelOpen(false); setCancelReason('') }} disabled={cancelling}>{t('billing.goBack')}</Button>
            <Button
              size="sm"
              className="bg-danger hover:bg-danger/90 text-white border-danger"
              onClick={handleCancel}
              loading={cancelling}
              disabled={!cancelReason.trim()}
            >
              {t('purchaseOrders.cancelPO')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('purchaseOrders.cancelPoMsg')}
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{t('purchaseOrders.cancelPoReason')} *</label>
            <input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Supplier unavailable, order changed"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
