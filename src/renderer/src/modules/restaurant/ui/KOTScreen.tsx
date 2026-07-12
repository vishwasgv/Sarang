import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Ticket, RefreshCw, CheckCircle2, Clock, XCircle, AlertTriangle, Printer, Inbox } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { Card } from '@shared/ui/molecules/Card'

interface OrderRequestItem { productId: string; quantity: number; productName: string; currentPrice: number }
interface OrderRequest {
  id: string
  status: string
  createdAt: string
  table: { tableNumber: string; tableName?: string | null }
  items: OrderRequestItem[]
}

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'WALLET', 'CREDIT', 'SPLIT'] as const

interface KOTItem { id: string; product: { productName: string }; quantity: number }
interface KOT {
  id: string
  status: string
  createdAt: string
  table?: { tableNumber: string; tableName?: string | null } | null
  invoice: { invoiceNumber: string; totalAmount: number; items: KOTItem[] }
}

const STATUS_CONFIG = {
  PENDING:     { label: 'Pending',     color: 'bg-warning/10 text-warning border-warning/20',   icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-brand/10 text-brand border-brand/20',         icon: AlertTriangle },
  DONE:        { label: 'Done',        color: 'bg-success/10 text-success border-success/20',    icon: CheckCircle2 },
  CANCELLED:   { label: 'Cancelled',   color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700',   icon: XCircle },
}

const NEXT_STATUS: Record<string, string | null> = {
  PENDING: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: null,
  CANCELLED: null,
}

const NEXT_LABEL: Record<string, string> = {
  PENDING: 'Start Cooking',
  IN_PROGRESS: 'Mark Done',
}

const FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
]

export function KOTScreen() {
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
  const [acceptPaymentMethod, setAcceptPaymentMethod] = useState<typeof PAYMENT_METHODS[number]>('CASH')
  const [acceptSubmitting, setAcceptSubmitting] = useState(false)

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
        toastError('Error', res.error?.message ?? 'Could not load incoming orders.')
      }
    } catch {
      if (!orderRequestsErroredRef.current) {
        orderRequestsErroredRef.current = true
        toastError('Error', 'Could not load incoming orders.')
      }
    }
  }, [toastError])

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
        toastError('Error', res.error?.message ?? 'Could not load kitchen tickets.')
      }
    } catch {
      if (!kotsErroredRef.current) {
        kotsErroredRef.current = true
        toastError('Error', 'Could not load kitchen tickets.')
      }
    } finally {
      setLoading(false)
    }
  }, [filter, toastError])

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
      if (!res.success) toastError('Error', res.error?.message ?? 'Could not reject order.')
    } catch {
      toastError('Error', 'Could not reject order.')
    } finally {
      loadOrderRequests()
    }
  }

  async function handleAccept() {
    if (!acceptTarget) return
    setAcceptSubmitting(true)
    try {
      const res = await api.restaurant.acceptOrderRequest({ requestId: acceptTarget.id, paymentMethod: acceptPaymentMethod })
      if (res.success) {
        setAcceptTarget(null)
        loadOrderRequests()
        load()
        toastSuccess('Order Accepted', 'Invoice and kitchen ticket created.')
      } else {
        toastError('Error', (res.error as { message?: string })?.message ?? 'Could not accept order.')
      }
    } catch {
      toastError('Error', 'Could not accept order.')
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
      if (!res.success) toastError('Error', res.error?.message ?? 'Could not update KOT status.')
    } catch {
      toastError('Error', 'Could not update KOT status.')
    } finally {
      setUpdating(null)
      load()
    }
  }

  async function handleCancel(kotId: string) {
    setUpdating(kotId)
    try {
      const res = await api.restaurant.updateKOTStatus({ kotId, status: 'CANCELLED' })
      if (!res.success) toastError('Error', res.error?.message ?? 'Could not cancel KOT.')
    } catch {
      toastError('Error', 'Could not cancel KOT.')
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
      if (res.success) toastSuccess('Printed', 'KOT sent to printer.')
      else toastError('Print Failed', (res.error as { message?: string })?.message ?? 'Could not print KOT.')
    } catch {
      toastError('Print Failed', 'Could not print KOT.')
    } finally {
      setPrinting(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark dark:text-slate-100">Kitchen Order Tickets</h2>
          <p className="text-sm text-slate-400">{kots.length} order{kots.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {canManageOrderRequests && orderRequests.length > 0 && (
        <Card padding="lg" className="space-y-3">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 flex items-center gap-2"><Inbox size={16} /> Incoming Orders ({orderRequests.length})</h3>
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
                  <button onClick={() => { setAcceptTarget(r); setAcceptPaymentMethod('CASH') }}
                    className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors">
                    Accept
                  </button>
                  <button onClick={() => handleReject(r.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-danger hover:text-danger transition-colors">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTER_OPTIONS.map(opt => (
          <button key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-semibold transition-colors',
              filter === opt.value ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
            )}>
            {opt.label}
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
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No KOTs found</p>
          <p className="text-xs text-slate-400 mt-1">KOTs are created when an invoice is sent to the kitchen</p>
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
                    <p className="text-sm font-bold text-dark dark:text-slate-100">{kot.invoice.invoiceNumber}</p>
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
                    <span className="text-xs font-semibold">{config.label}</span>
                  </div>
                </div>

                {/* Items list */}
                <div className="space-y-1">
                  {kot.invoice.items.map(item => (
                    <div key={item.id} className="flex justify-between text-xs text-dark dark:text-slate-100">
                      <span>{item.product.productName}</span>
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
                        {NEXT_LABEL[kot.status]}
                      </button>
                      <button
                        onClick={() => handleCancel(kot.id)}
                        disabled={updating === kot.id}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-danger hover:text-danger transition-colors disabled:opacity-50">
                        Cancel
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handlePrint(kot.id)}
                    disabled={printing === kot.id}
                    title="Print kitchen ticket"
                    className={cn(
                      'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand transition-colors disabled:opacity-50',
                      !nextStatus && 'flex-1'
                    )}>
                    {printing === kot.id ? <RefreshCw size={11} className="animate-spin" /> : <Printer size={11} />}
                    Print
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
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">Accept Order — {acceptTarget.table.tableName || acceptTarget.table.tableNumber}</h2>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Payment Method</label>
              <select value={acceptPaymentMethod} onChange={e => setAcceptPaymentMethod(e.target.value as typeof PAYMENT_METHODS[number])}
                className="w-full mt-1 px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand bg-white dark:bg-slate-900">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-400">This creates an invoice and a kitchen order ticket for this table.</p>
            <div className="flex gap-3">
              <button onClick={handleAccept} disabled={acceptSubmitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                {acceptSubmitting ? 'Creating…' : 'Confirm & Bill'}
              </button>
              <button onClick={() => setAcceptTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-slate-300 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
