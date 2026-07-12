import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Bell, MessageCircle, CheckCircle2, XCircle, RefreshCw, ExternalLink } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { useNotificationStore } from '@app/store/notification.store'

interface NotificationItem {
  id: string
  customerName: string | null
  customerPhone: string | null
  notificationType: string
  templateBody: string
  whatsappLink: string | null
  scheduledFor: string | null
  status: 'PENDING' | 'SENT' | 'DISMISSED' | 'FAILED'
  sentAt: string | null
  createdAt: string
}

const STATUS_LABEL: Record<NotificationItem['status'], string> = {
  PENDING:   'Pending',
  SENT:      'Sent',
  DISMISSED: 'Dismissed',
  FAILED:    'Failed',
}

const STATUS_VARIANT: Record<NotificationItem['status'], 'warning' | 'success' | 'neutral' | 'danger'> = {
  PENDING:   'warning',
  SENT:      'success',
  DISMISSED: 'neutral',
  FAILED:    'danger',
}

const TYPE_LABELS: Record<string, string> = {
  APPOINTMENT_REMINDER:      'Appointment Reminder',
  APPOINTMENT_REMINDER_24H:  'Appointment Reminder (24h)',
  APPOINTMENT_REMINDER_2H:   'Appointment Reminder (2h)',
  APPOINTMENT_CONFIRM:       'Booking Confirmation',
  APPOINTMENT_CANCEL:        'Cancellation Notice',
  VACCINE_DUE_7D:            'Vaccine Due (7 Days)',
  VACCINE_DUE_30D:           'Vaccine Due (30 Days)',
  VACCINE_OVERDUE:           'Vaccination Overdue',
  HEARING_DUE_2D:            'Hearing Due (2 Days)',
  HEARING_DUE_7D:            'Hearing Due (7 Days)',
  RECALL_DUE_7D:             'Dental Recall (7 Days)',
  RECALL_DUE_30D:            'Dental Recall (30 Days)',
  SESSION_PACK_EXPIRY_7D:    'Session Pack Expiry (7 Days)',
  SESSION_PACK_EXPIRY_30D:   'Session Pack Expiry (30 Days)',
  MEMBERSHIP_EXPIRY_7D:      'Membership Expiry (7 Days)',
  MEMBERSHIP_EXPIRY_30D:     'Membership Expiry (30 Days)',
  COMPLIANCE_DUE_30D:        'Compliance Due (30 Days)',
  COMPLIANCE_DUE_15D:        'Compliance Due (15 Days)',
  COMPLIANCE_DUE_7D:         'Compliance Due (7 Days)',
  COMPLIANCE_DUE_1D:         'Compliance Due (1 Day)',
  COMPLIANCE_OVERDUE:        'Compliance Overdue',
  PAYMENT_OVERDUE_7D:        'Payment Overdue (7 Days)',
  PAYMENT_OVERDUE_14D:       'Payment Overdue (14 Days)',
  PAYMENT_OVERDUE_30D:       'Payment Overdue (30 Days)',
  RETAINER_INVOICE_DUE_3D:   'Retainer Invoice Due (3 Days)',
  CONTRACT_RENEWAL_30D:      'Contract Renewal Due (30 Days)',
  CONTRACT_RENEWAL_7D:       'Contract Renewal Due (7 Days)',
  SHIPMENT_DISPATCHED:       'Shipment Dispatched',
  SHIPMENT_DELAYED:          'Shipment Delayed',
  GRN_POSTED:                'GRN Posted',
  CUSTOM:                    'Custom Message',
}

export function NotificationQueueScreen() {
  const { error: toastError } = useNotificationStore()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('PENDING')
  const [unsentCount, setUnsentCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, countRes] = await Promise.all([
        api.notificationQueue.list({ status: filter === 'ALL' ? undefined : filter }),
        api.notificationQueue.getUnsentCount(),
      ])
      if (listRes.success && listRes.data) setItems(listRes.data as NotificationItem[])
      else toastError('Error', listRes.error?.message ?? 'Could not load notifications.')
      if (countRes.success) setUnsentCount(countRes.data as number)
    } catch {
      toastError('Error', 'Could not load notifications.')
    } finally {
      setLoading(false)
    }
  }, [filter, toastError])

  useEffect(() => { load() }, [load])

  async function handleMarkSent(id: string) {
    try {
      const res = await api.notificationQueue.markSent({ id })
      if (res.success) await load()
      else toastError('Error', res.error?.message ?? 'Could not mark notification as sent.')
    } catch {
      toastError('Error', 'Could not mark notification as sent.')
    }
  }

  async function handleDismiss(id: string) {
    try {
      const res = await api.notificationQueue.dismiss({ id })
      if (res.success) await load()
      else toastError('Error', res.error?.message ?? 'Could not dismiss notification.')
    } catch {
      toastError('Error', 'Could not dismiss notification.')
    }
  }

  function openWhatsApp(link: string) {
    window.open(link, '_blank')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <Bell size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">WhatsApp Reminders</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {unsentCount > 0 ? `${unsentCount} pending reminder${unsentCount !== 1 ? 's' : ''} to send` : 'All caught up!'}
            </p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Info banner */}
      <div className="px-6 py-3 bg-brand/5 border-b border-brand/20 shrink-0">
        <p className="text-xs text-brand">
          <strong>How this works:</strong> Click the WhatsApp button to open a pre-filled message for the client. After sending, click "Mark Sent" to track it. No automatic messages are sent — you are always in control.
        </p>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0">
        {['PENDING', 'SENT', 'ALL'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3 py-1 text-xs font-medium rounded-full border transition-colors', filter === f ? 'border-brand text-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300')}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell size={32} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No notifications</p>
            <p className="text-xs text-slate-400 mt-1">Reminders are created when you book appointments.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <Card padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold text-dark dark:text-slate-100">{item.customerName ?? 'Unknown Client'}</span>
                        {item.customerPhone && <span className="text-xs text-slate-500 dark:text-slate-400">{item.customerPhone}</span>}
                        <span className="text-xs text-slate-400">{TYPE_LABELS[item.notificationType] ?? item.notificationType}</span>
                        <Badge variant={STATUS_VARIANT[item.status] ?? 'neutral'} size="sm">{STATUS_LABEL[item.status] ?? item.status}</Badge>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-800 leading-relaxed">
                        {item.templateBody}
                      </p>
                      {item.scheduledFor && (
                        <p className="text-xs text-slate-400 mt-1">
                          Scheduled: {new Date(item.scheduledFor).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.whatsappLink && item.status === 'PENDING' && (
                        <button
                          onClick={() => openWhatsApp(item.whatsappLink!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white text-xs font-medium rounded-lg hover:bg-[#1ebe57] transition-colors"
                        >
                          <MessageCircle size={13} /> Send on WhatsApp
                        </button>
                      )}
                      {item.whatsappLink && item.status !== 'PENDING' && (
                        <button
                          onClick={() => openWhatsApp(item.whatsappLink!)}
                          className="p-1.5 text-slate-400 hover:text-brand rounded-lg hover:bg-brand/5 transition-colors"
                          title="Open WhatsApp"
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                      {item.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleMarkSent(item.id)}
                            className="p-1.5 text-slate-400 hover:text-success rounded-lg hover:bg-success/5 transition-colors"
                            title="Mark as sent"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDismiss(item.id)}
                            className="p-1.5 text-slate-400 hover:text-danger rounded-lg hover:bg-danger/5 transition-colors"
                            title="Dismiss"
                          >
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
