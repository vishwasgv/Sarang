import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Bell, MessageCircle, CheckCircle2, XCircle, RefreshCw, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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

// REAL BUG found+fixed 2026-09-22: this whole screen (including these two
// lookup maps) had zero i18n wiring — every string was a hardcoded English
// literal, unlike every other screen in this app. Both maps now hold i18n
// KEYS (resolved via t() inside the component) rather than literal English
// text.
const STATUS_LABEL_KEYS: Record<NotificationItem['status'], string> = {
  PENDING:   'whatsappReminders.statusPending',
  SENT:      'whatsappReminders.statusSent',
  DISMISSED: 'whatsappReminders.statusDismissed',
  FAILED:    'whatsappReminders.statusFailed',
}

const STATUS_VARIANT: Record<NotificationItem['status'], 'warning' | 'success' | 'neutral' | 'danger'> = {
  PENDING:   'warning',
  SENT:      'success',
  DISMISSED: 'neutral',
  FAILED:    'danger',
}

const TYPE_LABEL_KEYS: Record<string, string> = {
  APPOINTMENT_REMINDER:      'whatsappReminders.type.appointmentReminder',
  APPOINTMENT_REMINDER_24H:  'whatsappReminders.type.appointmentReminder24h',
  APPOINTMENT_REMINDER_2H:   'whatsappReminders.type.appointmentReminder2h',
  APPOINTMENT_CONFIRM:       'whatsappReminders.type.appointmentConfirm',
  APPOINTMENT_CANCEL:        'whatsappReminders.type.appointmentCancel',
  VACCINE_DUE_7D:            'whatsappReminders.type.vaccineDue7d',
  VACCINE_DUE_30D:           'whatsappReminders.type.vaccineDue30d',
  VACCINE_OVERDUE:           'whatsappReminders.type.vaccineOverdue',
  HEARING_DUE_2D:            'whatsappReminders.type.hearingDue2d',
  HEARING_DUE_7D:            'whatsappReminders.type.hearingDue7d',
  RECALL_DUE_7D:             'whatsappReminders.type.recallDue7d',
  RECALL_DUE_30D:            'whatsappReminders.type.recallDue30d',
  SESSION_PACK_EXPIRY_7D:    'whatsappReminders.type.sessionPackExpiry7d',
  SESSION_PACK_EXPIRY_30D:   'whatsappReminders.type.sessionPackExpiry30d',
  MEMBERSHIP_EXPIRY_7D:      'whatsappReminders.type.membershipExpiry7d',
  MEMBERSHIP_EXPIRY_30D:     'whatsappReminders.type.membershipExpiry30d',
  COMPLIANCE_DUE_30D:        'whatsappReminders.type.complianceDue30d',
  COMPLIANCE_DUE_15D:        'whatsappReminders.type.complianceDue15d',
  COMPLIANCE_DUE_7D:         'whatsappReminders.type.complianceDue7d',
  COMPLIANCE_DUE_1D:         'whatsappReminders.type.complianceDue1d',
  COMPLIANCE_OVERDUE:        'whatsappReminders.type.complianceOverdue',
  PAYMENT_OVERDUE_7D:        'whatsappReminders.type.paymentOverdue7d',
  PAYMENT_OVERDUE_14D:       'whatsappReminders.type.paymentOverdue14d',
  PAYMENT_OVERDUE_30D:       'whatsappReminders.type.paymentOverdue30d',
  CONTRACT_RENEWAL_30D:      'whatsappReminders.type.contractRenewal30d',
  CONTRACT_RENEWAL_7D:       'whatsappReminders.type.contractRenewal7d',
  HOTEL_CHECKOUT_REMINDER:   'whatsappReminders.type.hotelCheckoutReminder',
  LAB_REPORT_READY:          'whatsappReminders.type.labReportReady',
  TRIP_DEPARTURE_REMINDER:   'whatsappReminders.type.tripDepartureReminder',
  SHOOT_DATE_REMINDER:       'whatsappReminders.type.shootDateReminder',
  EVENT_DATE_REMINDER:       'whatsappReminders.type.eventDateReminder',
  SHIPMENT_DISPATCHED:       'whatsappReminders.type.shipmentDispatched',
  SHIPMENT_DELAYED:          'whatsappReminders.type.shipmentDelayed',
  GRN_POSTED:                'whatsappReminders.type.grnPosted',
  CAR_SERVICE_DUE_REMINDER:  'whatsappReminders.type.carServiceDueReminder',
  ENGAGEMENT_RENEWAL_30D:    'whatsappReminders.type.engagementRenewal30d',
  ENGAGEMENT_RENEWAL_7D:     'whatsappReminders.type.engagementRenewal7d',
  DRIVING_TEST_REMINDER:     'whatsappReminders.type.drivingTestReminder',
  LIMITATION_DUE_30D:        'whatsappReminders.type.limitationDue30d',
  LIMITATION_DUE_7D:         'whatsappReminders.type.limitationDue7d',
  PROPERTY_SITE_VISIT_REMINDER: 'whatsappReminders.type.propertySiteVisitReminder',
  RENTAL_RETURN_DUE:         'whatsappReminders.type.rentalReturnDue',
  RETAINER_INVOICE_DUE_3D:   'whatsappReminders.type.retainerInvoiceDue3d',
  RETAINER_LAPSE_30D:        'whatsappReminders.type.retainerLapse30d',
  RETAINER_LAPSE_7D:         'whatsappReminders.type.retainerLapse7d',
  EQUIPMENT_SERVICE_DUE_REMINDER: 'whatsappReminders.type.equipmentServiceDueReminder',
  BLOOD_DONOR_ELIGIBLE:      'whatsappReminders.type.bloodDonorEligible',
  CUSTOM:                    'whatsappReminders.type.custom',
}

export function NotificationQueueScreen() {
  const { t } = useTranslation()
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
      else toastError(t('common.error'), listRes.error?.message ?? t('whatsappReminders.loadFailed'))
      if (countRes.success) setUnsentCount(countRes.data as number)
    } catch {
      toastError(t('common.error'), t('whatsappReminders.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [filter, toastError, t])

  useEffect(() => { load() }, [load])

  async function handleMarkSent(id: string) {
    try {
      const res = await api.notificationQueue.markSent({ id })
      if (res.success) await load()
      else toastError(t('common.error'), res.error?.message ?? t('whatsappReminders.markSentFailed'))
    } catch {
      toastError(t('common.error'), t('whatsappReminders.markSentFailed'))
    }
  }

  async function handleDismiss(id: string) {
    try {
      const res = await api.notificationQueue.dismiss({ id })
      if (res.success) await load()
      else toastError(t('common.error'), res.error?.message ?? t('whatsappReminders.dismissFailed'))
    } catch {
      toastError(t('common.error'), t('whatsappReminders.dismissFailed'))
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
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">{t('whatsappReminders.title')}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {unsentCount > 0 ? t('whatsappReminders.pendingCount', { count: unsentCount }) : t('whatsappReminders.allCaughtUp')}
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
          <strong>{t('whatsappReminders.howThisWorksLabel')}</strong> {t('whatsappReminders.howThisWorksBody')}
        </p>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0">
        {(['PENDING', 'SENT', 'ALL'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3 py-1 text-xs font-medium rounded-full border transition-colors', filter === f ? 'border-brand text-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300')}
          >
            {f === 'ALL' ? t('whatsappReminders.filterAll') : f === 'PENDING' ? t(STATUS_LABEL_KEYS.PENDING) : t(STATUS_LABEL_KEYS.SENT)}
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
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('whatsappReminders.noNotifications')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('whatsappReminders.noNotificationsHint')}</p>
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
                        <span className="text-xs font-semibold text-dark dark:text-slate-100">{item.customerName ?? t('whatsappReminders.unknownClient')}</span>
                        {item.customerPhone && <span className="text-xs text-slate-500 dark:text-slate-400">{item.customerPhone}</span>}
                        <span className="text-xs text-slate-400">{TYPE_LABEL_KEYS[item.notificationType] ? t(TYPE_LABEL_KEYS[item.notificationType]) : item.notificationType}</span>
                        <Badge variant={STATUS_VARIANT[item.status] ?? 'neutral'} size="sm">{STATUS_LABEL_KEYS[item.status] ? t(STATUS_LABEL_KEYS[item.status]) : item.status}</Badge>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-800 leading-relaxed">
                        {item.templateBody}
                      </p>
                      {item.scheduledFor && (
                        <p className="text-xs text-slate-400 mt-1">
                          {t('whatsappReminders.scheduledLabel', { datetime: new Date(item.scheduledFor).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.whatsappLink && item.status === 'PENDING' && (
                        <button
                          onClick={() => openWhatsApp(item.whatsappLink!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white text-xs font-medium rounded-lg hover:bg-[#1ebe57] transition-colors"
                        >
                          <MessageCircle size={13} /> {t('whatsappReminders.sendOnWhatsApp')}
                        </button>
                      )}
                      {item.whatsappLink && item.status !== 'PENDING' && (
                        <button
                          onClick={() => openWhatsApp(item.whatsappLink!)}
                          className="p-1.5 text-slate-400 hover:text-brand rounded-lg hover:bg-brand/5 transition-colors"
                          title={t('whatsappReminders.openWhatsAppTitle')}
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                      {item.status === 'PENDING' && !item.whatsappLink && (
                        <span className="text-xs text-slate-400 me-1">No phone number, so this can't be sent</span>
                      )}
                      {item.status === 'PENDING' && (
                        <>
                          {item.whatsappLink && (
                          <button
                            onClick={() => handleMarkSent(item.id)}
                            className="p-1.5 text-slate-400 hover:text-success rounded-lg hover:bg-success/5 transition-colors"
                            title={t('whatsappReminders.markSentTitle')}
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          )}
                          <button
                            onClick={() => handleDismiss(item.id)}
                            className="p-1.5 text-slate-400 hover:text-danger rounded-lg hover:bg-danger/5 transition-colors"
                            title={t('whatsappReminders.dismissTitle')}
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
