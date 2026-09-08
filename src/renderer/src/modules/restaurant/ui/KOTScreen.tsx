import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Ticket, RefreshCw, CheckCircle2, Clock, XCircle, AlertTriangle, Printer, Inbox } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { Card } from '@shared/ui/molecules/Card'
import { DietMark } from '@shared/ui/atoms/DietMark'

interface OrderRequestItem { productId: string; quantity: number; productName: string; currentPrice: number }
interface OrderRequest {
  id: string
  status: string
  createdAt: string
  table: { tableNumber: string; tableName?: string | null }
  items: OrderRequestItem[]
}

interface KOTItem { productId: string; productName: string; quantity: number; unitPriceSnapshot: number; foodType?: string | null }
interface KOT {
  id: string
  status: string
  createdAt: string
  table?: { tableNumber: string; tableName?: string | null } | null
  invoice?: { invoiceNumber: string; totalAmount: number; orderChannel?: string | null } | null
  items: KOTItem[]
  servedAt?: string | null
  tokenNumber?: number | null
}

const STATUS_CONFIG = {
  PENDING:     { color: 'bg-warning/10 text-warning border-warning/20',   icon: Clock },
  IN_PROGRESS: { color: 'bg-brand/10 text-brand border-brand/20',         icon: AlertTriangle },
  DONE:        { color: 'bg-success/10 text-success border-success/20',    icon: CheckCircle2 },
  CANCELLED:   { color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700',   icon: XCircle },
}

// Translation key suffixes for each KOT status — the actual label text is
// resolved via t() inside the component, not here (this is module scope,
// no hook access).
const STATUS_LABEL_KEY: Record<string, string> = {
  PENDING: 'statusPending',
  IN_PROGRESS: 'statusInProgress',
  DONE: 'statusDone',
  CANCELLED: 'statusCancelled',
}

// 2026-09-04 — order-channel tagging. Falls back to "Takeaway" for the
// common case (no channel picked, or an invoice created before this
// feature existed) — every table-less ticket is at minimum a takeaway.
// ZOMATO/SWIGGY are brand names and are deliberately not translated.
const CHANNEL_LABEL: Record<string, string> = { ZOMATO: 'Zomato', SWIGGY: 'Swiggy' }

const NEXT_STATUS: Record<string, string | null> = {
  PENDING: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: null,
  CANCELLED: null,
}

const NEXT_LABEL_KEY: Record<string, string> = {
  PENDING: 'startCooking',
  IN_PROGRESS: 'markDone',
}

const FILTER_VALUES = ['', 'PENDING', 'IN_PROGRESS', 'DONE']

export function KOTScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManageOrderRequests = hasPermission('restaurant.manageOrderRequests')
  const [kots, setKots] = useState<KOT[]>([])
  const [filter, setFilter] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [printing, setPrinting] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Phase 47 — customer-submitted QR orders awaiting staff confirmation.
  // Gated on an explicit permission check, not just this screen's own
  // restaurant.viewKOT reachability — Kitchen Staff can view this screen but
  // must never see Accept/Reject actions they have no permission to use.
  const [orderRequests, setOrderRequests] = useState<OrderRequest[]>([])
  const [acceptTarget, setAcceptTarget] = useState<OrderRequest | null>(null)
  const [acceptSubmitting, setAcceptSubmitting] = useState(false)

  function channelLabel(channel: string | null | undefined): string {
    if (channel && CHANNEL_LABEL[channel]) return CHANNEL_LABEL[channel]
    if (channel === 'OTHER') return t('restaurant.kot.deliveryApp')
    return t('restaurant.kot.takeaway')
  }

  function statusLabel(status: string): string {
    const key = STATUS_LABEL_KEY[status]
    return key ? t(`restaurant.kot.${key}`) : status
  }

  // Poll-friendly loaders: real failures are toasted only on the transition
  // into an error state (not on every 15s poll tick) so a sustained backend
  // outage doesn't spam the user with a toast every few seconds.
  const orderRequestsErroredRef = useRef(false)

  const loadOrderRequests = useCallback(async () => {
    try {
      const res = await api.restaurant.listOrderRequests({ status: 'PENDING' })
      if (res.success && res.data) {
        setOrderRequests(res.data as OrderRequest[])
        orderRequestsErroredRef.current = false
      } else if (!orderRequestsErroredRef.current) {
        orderRequestsErroredRef.current = true
        toastError(t('common.error'), res.error?.message ?? t('restaurant.kot.couldNotLoadIncomingOrders'))
      }
    } catch {
      if (!orderRequestsErroredRef.current) {
        orderRequestsErroredRef.current = true
        toastError(t('common.error'), t('restaurant.kot.couldNotLoadIncomingOrders'))
      }
    }
  }, [toastError, t])

  const kotsErroredRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.restaurant.listKOTs(filter ? { status: filter } : {})
      if (res.success && res.data) {
        setKots(res.data as KOT[])
        kotsErroredRef.current = false
      } else if (!kotsErroredRef.current) {
        kotsErroredRef.current = true
        toastError(t('common.error'), res.error?.message ?? t('restaurant.kot.couldNotLoadTickets'))
      }
    } catch {
      if (!kotsErroredRef.current) {
        kotsErroredRef.current = true
        toastError(t('common.error'), t('restaurant.kot.couldNotLoadTickets'))
      }
    } finally {
      setLoading(false)
    }
  }, [filter, toastError, t])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!canManageOrderRequests) return
    loadOrderRequests()
    const id = setInterval(loadOrderRequests, 15000)
    return () => clearInterval(id)
  }, [canManageOrderRequests, loadOrderRequests])

  async function handleReject(requestId: string) {
    try {
      const res = await api.restaurant.rejectOrderRequest({ requestId })
      if (!res.success) toastError(t('common.error'), res.error?.message ?? t('restaurant.kot.couldNotRejectOrder'))
    } catch {
      toastError(t('common.error'), t('restaurant.kot.couldNotRejectOrder'))
    } finally {
      loadOrderRequests()
    }
  }

  async function handleAccept() {
    if (!acceptTarget) return
    setAcceptSubmitting(true)
    try {
      const res = await api.restaurant.acceptOrderRequest({ requestId: acceptTarget.id })
      if (res.success) {
        setAcceptTarget(null)
        loadOrderRequests()
        load()
        toastSuccess(t('restaurant.kot.orderAcceptedTitle'), t('restaurant.kot.orderAcceptedDesc'))
      } else {
        toastError(t('common.error'), (res.error as { message?: string })?.message ?? t('restaurant.kot.couldNotAcceptOrder'))
      }
    } catch {
      toastError(t('common.error'), t('restaurant.kot.couldNotAcceptOrder'))
    } finally {
      setAcceptSubmitting(false)
    }
  }

  useEffect(() => {
    intervalRef.current = setInterval(() => { load() }, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [load])

  async function handleAdvance(kot: KOT) {
    const next = NEXT_STATUS[kot.status]
    if (!next) return
    setUpdating(kot.id)
    try {
      const res = await api.restaurant.updateKOTStatus({ kotId: kot.id, status: next })
      if (!res.success) toastError(t('common.error'), res.error?.message ?? t('restaurant.kot.couldNotUpdateStatus'))
    } catch {
      toastError(t('common.error'), t('restaurant.kot.couldNotUpdateStatus'))
    } finally {
      setUpdating(null)
      load()
    }
  }

  async function handleCancel(kotId: string) {
    setUpdating(kotId)
    try {
      const res = await api.restaurant.updateKOTStatus({ kotId, status: 'CANCELLED' })
      if (!res.success) toastError(t('common.error'), res.error?.message ?? t('restaurant.kot.couldNotCancelKot'))
    } catch {
      toastError(t('common.error'), t('restaurant.kot.couldNotCancelKot'))
    } finally {
      setUpdating(null)
      load()
    }
  }

  // 2026-09-04 — Waiter view. Same markKOTServed() a waiter's own phone
  // calls from their LAN board — front-desk/counter staff need a way to do
  // this too without a phone in hand.
  async function handleMarkServed(kotId: string) {
    setUpdating(kotId)
    try {
      const res = await api.restaurant.markKOTServed({ kotId })
      if (!res.success) toastError(t('common.error'), res.error?.message ?? t('restaurant.kot.couldNotMarkServed'))
    } catch {
      toastError(t('common.error'), t('restaurant.kot.couldNotMarkServed'))
    } finally {
      setUpdating(null)
      load()
    }
  }

  // The backend (print:kot) and the printer bridge already existed — this
  // screen just never had a button wired to call it, so there was no way to
  // actually print a kitchen ticket despite the full pipeline being built.
  async function handlePrint(kotId: string) {
    setPrinting(kotId)
    try {
      const res = await api.print.kot({ kotId })
      if (res.success) toastSuccess(t('restaurant.kot.printedTitle'), t('restaurant.kot.printedDesc'))
      else toastError(t('restaurant.kot.printFailedTitle'), (res.error as { message?: string })?.message ?? t('restaurant.kot.couldNotPrintKot'))
    } catch {
      toastError(t('restaurant.kot.printFailedTitle'), t('restaurant.kot.couldNotPrintKot'))
    } finally {
      setPrinting(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('restaurant.kot.title')}</h2>
          <p className="text-sm text-slate-400">{t('restaurant.kot.ordersCount', { count: kots.length })}</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
          <RefreshCw size={14} /> {t('common.refresh')}
        </button>
      </div>

      {canManageOrderRequests && orderRequests.length > 0 && (
        <Card padding="lg" className="space-y-3">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 flex items-center gap-2"><Inbox size={16} /> {t('restaurant.kot.incomingOrders', { count: orderRequests.length })}</h3>
          <div className="space-y-2">
            {orderRequests.map(r => (
              <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-dark dark:text-slate-100">{r.table.tableName || r.table.tableNumber}</p>
                  <ul className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                    {r.items.map((it, idx) => (
                      <li key={idx}>{it.quantity} × {it.productName} ({formatCurrency(it.currentPrice)})</li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setAcceptTarget(r)}
                    className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors">
                    {t('restaurant.kot.accept')}
                  </button>
                  <button onClick={() => handleReject(r.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-danger hover:text-danger transition-colors">
                    {t('restaurant.kot.reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTER_VALUES.map(value => (
          <button key={value}
            onClick={() => setFilter(value)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-semibold transition-colors',
              filter === value ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
            )}>
            {value === '' ? t('common.all') : statusLabel(value)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw size={20} className="animate-spin text-brand" />
        </div>
      ) : kots.length === 0 ? (
        <Card padding="none" className="p-12 text-center">
          <Ticket size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('restaurant.kot.noKotsFound')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('restaurant.kot.noKotsHint')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kots.map(kot => {
            const config = STATUS_CONFIG[kot.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING
            const Icon = config.icon
            const nextStatus = NEXT_STATUS[kot.status]
            return (
              <motion.div key={kot.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={cn('bg-white dark:bg-slate-900 rounded-xl border-2 p-4 space-y-3', config.color)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {kot.tokenNumber != null && (
                      <p className="text-[10px] font-bold uppercase tracking-wide text-warning">
                        {channelLabel(kot.invoice?.orderChannel)}
                      </p>
                    )}
                    <p className="text-sm font-bold text-dark dark:text-slate-100">
                      {kot.tokenNumber != null ? t('restaurant.kot.tokenLabel', { number: kot.tokenNumber }) : (kot.invoice?.invoiceNumber ?? `KOT-${kot.id.slice(-6).toUpperCase()}`)}
                    </p>
                    {kot.table && (
                      <p className="text-xs text-slate-400">
                        {kot.table.tableName || kot.table.tableNumber}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">
                      {new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon size={13} />
                    <span className="text-xs font-semibold">{statusLabel(kot.status)}</span>
                  </div>
                </div>

                {/* Items list */}
                <div className="space-y-1">
                  {kot.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-dark dark:text-slate-100">
                      <span className="flex items-center gap-1.5"><DietMark foodType={item.foodType} />{item.productName}</span>
                      <span className="font-semibold">× {item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  {nextStatus && (
                    <>
                      <button
                        onClick={() => handleAdvance(kot)}
                        disabled={updating === kot.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                        {updating === kot.id ? <RefreshCw size={11} className="animate-spin" /> : null}
                        {t(`restaurant.kot.${NEXT_LABEL_KEY[kot.status]}`)}
                      </button>
                      <button
                        onClick={() => handleCancel(kot.id)}
                        disabled={updating === kot.id}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-danger hover:text-danger transition-colors disabled:opacity-50">
                        {t('common.cancel')}
                      </button>
                    </>
                  )}
                  {kot.status === 'DONE' && (
                    kot.servedAt ? (
                      <span className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-success/10 text-success text-xs font-semibold">
                        <CheckCircle2 size={11} /> {t('restaurant.kot.served')}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarkServed(kot.id)}
                        disabled={updating === kot.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-success text-white text-xs font-semibold hover:bg-success/90 transition-colors disabled:opacity-50">
                        {updating === kot.id ? <RefreshCw size={11} className="animate-spin" /> : null}
                        {t('restaurant.kot.markServed')}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => handlePrint(kot.id)}
                    disabled={printing === kot.id}
                    title={t('restaurant.kot.printTicket')}
                    className={cn(
                      'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand transition-colors disabled:opacity-50',
                      !nextStatus && kot.status !== 'DONE' && 'flex-1'
                    )}>
                    {printing === kot.id ? <RefreshCw size={11} className="animate-spin" /> : <Printer size={11} />}
                    {t('common.print')}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {acceptTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('restaurant.kot.acceptOrderTitle', { table: acceptTarget.table.tableName || acceptTarget.table.tableNumber })}</h2>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
              {acceptTarget.items.map((it, idx) => (
                <li key={idx}>{it.quantity} × {it.productName}</li>
              ))}
            </ul>
            <p className="text-xs text-slate-400">{t('restaurant.kot.acceptOrderNote')}</p>
            <div className="flex gap-3">
              <button onClick={handleAccept} disabled={acceptSubmitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                {acceptSubmitting ? t('restaurant.kot.sending') : t('restaurant.kot.confirmAndSend')}
              </button>
              <button onClick={() => setAcceptTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-slate-300 transition-colors">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
