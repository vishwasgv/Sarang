import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Inbox, RefreshCw, QrCode, RotateCw, Copy } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { Card } from '@shared/ui/molecules/Card'

// Phase 58 §2 — Distributor field-rep order capture. Structural mirror of
// KOTScreen.tsx's "Incoming Orders" panel (QR table ordering) — a rep's LAN
// submission lands here PENDING; office staff Accept (creates a real
// invoice, price re-resolved server-side) or Reject. Also surfaces the LAN
// server status/QR code, mirroring RestaurantTablesScreen.tsx's QR-ordering
// toggle block.

interface FieldOrderItem { productId: string; quantity: number; productName: string; currentPrice: number }
interface FieldOrderRequest {
  id: string
  repName: string
  customerName: string | null
  notes: string | null
  status: string
  createdAt: string
  items: FieldOrderItem[]
}

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'WALLET', 'CREDIT', 'SPLIT'] as const

export function FieldOrdersScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [requests, setRequests] = useState<FieldOrderRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [acceptTarget, setAcceptTarget] = useState<FieldOrderRequest | null>(null)
  const [acceptPaymentMethod, setAcceptPaymentMethod] = useState<typeof PAYMENT_METHODS[number]>('CASH')
  const [acceptSubmitting, setAcceptSubmitting] = useState(false)

  const [serverStatus, setServerStatus] = useState<{ running: boolean; lanUrls: string[]; token: string | null } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [captureUrl, setCaptureUrl] = useState<string | null>(null)

  const erroredRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await api.distributor.listFieldOrderRequests({ status: 'PENDING' })
      if (res.success && res.data) {
        setRequests(res.data as FieldOrderRequest[])
        erroredRef.current = false
      } else if (!erroredRef.current) {
        erroredRef.current = true
        toastError(t('distributor.fieldOrders.error'), res.error?.message ?? t('distributor.fieldOrders.couldNotLoad'))
      }
    } catch {
      if (!erroredRef.current) {
        erroredRef.current = true
        toastError(t('distributor.fieldOrders.error'), t('distributor.fieldOrders.couldNotLoad'))
      }
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.distributor.getFieldOrderStatus()
      if (res.success && res.data) setServerStatus(res.data as { running: boolean; lanUrls: string[]; token: string | null })
    } catch {
      // status panel failing to load must never block the request inbox above
    }
  }, [])

  useEffect(() => {
    load()
    loadStatus()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load, loadStatus])

  async function handleReject(requestId: string) {
    try {
      const res = await api.distributor.rejectFieldOrderRequest({ requestId })
      if (!res.success) toastError(t('distributor.fieldOrders.error'), res.error?.message ?? t('distributor.fieldOrders.couldNotReject'))
    } catch {
      toastError(t('distributor.fieldOrders.error'), t('distributor.fieldOrders.couldNotReject'))
    } finally {
      load()
    }
  }

  async function handleAccept() {
    if (!acceptTarget) return
    setAcceptSubmitting(true)
    try {
      const res = await api.distributor.acceptFieldOrderRequest({ requestId: acceptTarget.id, paymentMethod: acceptPaymentMethod })
      if (res.success) {
        setAcceptTarget(null)
        load()
        toastSuccess(t('distributor.fieldOrders.orderAccepted'), t('distributor.fieldOrders.invoiceCreated'))
      } else {
        toastError(t('distributor.fieldOrders.error'), (res.error as { message?: string })?.message ?? t('distributor.fieldOrders.couldNotAccept'))
      }
    } catch {
      toastError(t('distributor.fieldOrders.error'), t('distributor.fieldOrders.couldNotAccept'))
    } finally {
      setAcceptSubmitting(false)
    }
  }

  async function handleShowQr() {
    try {
      const res = await api.distributor.generateFieldOrderQr()
      if (res.success && res.data) {
        const d = res.data as { qrDataUrl: string; captureUrl: string }
        setQrDataUrl(d.qrDataUrl); setCaptureUrl(d.captureUrl)
      } else {
        toastError(t('distributor.fieldOrders.error'), (res.error as { message?: string })?.message ?? t('distributor.fieldOrders.notRunning'))
      }
    } catch {
      toastError(t('distributor.fieldOrders.error'), t('distributor.fieldOrders.couldNotGenerateQr'))
    }
  }

  async function handleRegenerateToken() {
    if (!confirm(t('distributor.fieldOrders.regenerateConfirm'))) return
    try {
      const res = await api.distributor.regenerateFieldOrderToken()
      if (res.success) {
        toastSuccess(t('distributor.fieldOrders.regenerated'), t('distributor.fieldOrders.regeneratedMessage'))
        setQrDataUrl(null); setCaptureUrl(null)
        loadStatus()
      } else {
        toastError(t('distributor.fieldOrders.error'), (res.error as { message?: string })?.message ?? t('distributor.fieldOrders.couldNotRegenerate'))
      }
    } catch {
      toastError(t('distributor.fieldOrders.error'), t('distributor.fieldOrders.couldNotRegenerate'))
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('distributor.fieldOrders.title')}</h2>
          <p className="text-sm text-slate-400">{t('distributor.fieldOrders.subtitle')}</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
          <RefreshCw size={14} /> {t('distributor.fieldOrders.refresh')}
        </button>
      </div>

      <Card padding="lg" className="space-y-3">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('distributor.fieldOrders.linkTitle')}</h3>
        {serverStatus?.running ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('distributor.fieldOrders.linkDescription')}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleShowQr} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors">
                <QrCode size={13} /> {t('distributor.fieldOrders.showQr')}
              </button>
              <button onClick={handleRegenerateToken} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-danger hover:text-danger transition-colors">
                <RotateCw size={13} /> {t('distributor.fieldOrders.regenerateLink')}
              </button>
            </div>
            {captureUrl && (
              <div className="flex items-center gap-3 mt-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                {qrDataUrl && <img src={qrDataUrl} alt="Field order QR code" className="w-32 h-32" />}
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 mb-1">{t('distributor.fieldOrders.openDirectly')}</p>
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs text-dark dark:text-slate-200 truncate">{captureUrl}</code>
                    <button onClick={() => { navigator.clipboard.writeText(captureUrl); toastSuccess(t('distributor.fieldOrders.copied'), t('distributor.fieldOrders.linkCopied')) }} className="text-slate-400 hover:text-brand transition-colors shrink-0">
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">{t('distributor.fieldOrders.notRunning')}</p>
        )}
      </Card>

      <Card padding="lg" className="space-y-3">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 flex items-center gap-2">
          <Inbox size={16} /> {t('distributor.fieldOrders.pendingTitle')} ({requests.length})
        </h3>
        {loading ? (
          <p className="text-sm text-slate-400">{t('distributor.fieldOrders.loading')}</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-400">{t('distributor.fieldOrders.empty')}</p>
        ) : (
          <div className="space-y-2">
            {requests.map(r => (
              <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-dark dark:text-slate-100">
                    {r.repName} {r.customerName ? `→ ${r.customerName}` : t('distributor.fieldOrders.noCustomer')}
                  </p>
                  {r.notes && <p className="text-xs text-slate-400 italic mt-0.5">{r.notes}</p>}
                  <ul className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                    {r.items.map((it, idx) => (
                      <li key={idx}>{it.quantity} × {it.productName} ({formatCurrency(it.currentPrice)})</li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { setAcceptTarget(r); setAcceptPaymentMethod('CASH') }}
                    className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors">
                    {t('distributor.fieldOrders.accept')}
                  </button>
                  <button onClick={() => handleReject(r.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-danger hover:text-danger transition-colors">
                    {t('distributor.fieldOrders.reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {acceptTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('distributor.fieldOrders.acceptTitle', { repName: acceptTarget.repName })}</h2>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('distributor.fieldOrders.paymentMethod')}</label>
              <select value={acceptPaymentMethod} onChange={e => setAcceptPaymentMethod(e.target.value as typeof PAYMENT_METHODS[number])}
                className="w-full mt-1 px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand bg-white dark:bg-slate-900">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-400">{t('distributor.fieldOrders.acceptHint')}</p>
            <div className="flex gap-3">
              <button onClick={handleAccept} disabled={acceptSubmitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                {acceptSubmitting ? t('distributor.fieldOrders.creating') : t('distributor.fieldOrders.confirmBill')}
              </button>
              <button onClick={() => setAcceptTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-slate-300 transition-colors">
                {t('distributor.fieldOrders.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
