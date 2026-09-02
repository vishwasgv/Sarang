import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { UserCheck, RefreshCw, Plus, LogOut, X } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useIndustryStore } from '@app/store/industry.store'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { formatDateTime } from '@shared/utils/locale.util'
import { useNotificationStore } from '@app/store/notification.store'

interface CheckInRow {
  id: string
  customerId: string
  checkInTime: string
  checkOutTime: string | null
  notes: string | null
  customer: { id: string; customerName: string; phone: string | null }
}

// 2026-09 — universal visit check-in/check-out log. Unlike the Gym-only
// Memberships/Session Packs/Workout Log screens (deliberately English-only,
// see this module's other screens), this one is reachable by ANY business
// type via the customer_checkin opt-in module (Settings → Business
// Features) — a RETAIL/GENERAL business enabling it must stay fully
// multi-language, so every string here goes through t().
export function CustomerCheckInScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasCheckIn = useIndustryStore((s) => s.isModuleEnabled('customer_checkin'))
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission('customerCheckIn.manage')
  const { success: toastSuccess, error: toastError } = useNotificationStore()

  const [active, setActive] = useState<CheckInRow[]>([])
  const [recent, setRecent] = useState<CheckInRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [pickedCustomer, setPickedCustomer] = useState<CustomerLite | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [activeRes, recentRes] = await Promise.all([
        api.customerCheckIn.active(),
        api.customerCheckIn.list(),
      ])
      if (activeRes.success) setActive((activeRes.data as CheckInRow[]) ?? [])
      else toastError(t('common.error'), activeRes.error?.message ?? '')
      if (recentRes.success) setRecent((recentRes.data as CheckInRow[]) ?? [])
    } catch {
      toastError(t('common.error'), '')
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { void load() }, [load])

  async function handleCheckIn() {
    if (!pickedCustomer) { setError(t('checkin.selectCustomer')); return }
    setCheckingIn(true)
    setError(null)
    try {
      const res = await api.customerCheckIn.checkIn({ customerId: pickedCustomer.id })
      if (res.success) {
        toastSuccess(t('checkin.checkedIn'), pickedCustomer.customerName)
        setShowPicker(false)
        setPickedCustomer(null)
        await load()
      } else {
        setError(res.error?.message ?? t('checkin.checkInFailed'))
      }
    } catch {
      setError(t('checkin.checkInFailed'))
    } finally {
      setCheckingIn(false)
    }
  }

  async function handleCheckOut(id: string) {
    setCheckingOutId(id)
    try {
      const res = await api.customerCheckIn.checkOut({ checkInId: id })
      if (res.success) { toastSuccess(t('checkin.checkedOut'), ''); await load() }
      else toastError(t('common.error'), res.error?.message ?? '')
    } catch {
      toastError(t('common.error'), '')
    } finally {
      setCheckingOutId(null)
    }
  }

  if (!hasCheckIn) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <UserCheck size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('checkin.notEnabled')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <UserCheck size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('checkin.title')}</h2>
            <p className="text-sm text-slate-400">{t('checkin.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {canManage && (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowPicker((s) => !s)}>{t('checkin.checkInAction')}</Button>
          )}
        </div>
      </div>

      {showPicker && canManage && (
        <Card padding="md" className="space-y-3">
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label={t('checkin.customer')} />
            </div>
            <Button size="sm" loading={checkingIn} onClick={() => void handleCheckIn()}>{t('checkin.checkInAction')}</Button>
            <Button size="sm" variant="secondary" onClick={() => { setShowPicker(false); setPickedCustomer(null); setError(null) }} icon={<X size={13} />} />
          </div>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-2">{t('checkin.currentlyIn', { count: active.length })}</h3>
        {active.length === 0 ? (
          <Card padding="lg" className="text-center py-8">
            <p className="text-sm text-slate-400">{t('checkin.noOneIn')}</p>
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {active.map((row) => (
                <div key={row.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm dark:text-slate-100">{row.customer.customerName}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{formatDateTime(row.checkInTime)}</p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => void handleCheckOut(row.id)}
                      disabled={checkingOutId === row.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-warning/5 text-warning border border-warning/20 hover:bg-warning/10 flex items-center gap-1 font-medium disabled:opacity-50"
                    >
                      <LogOut size={12} /> {t('checkin.checkOutAction')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-2">{t('checkin.recentVisits')}</h3>
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">{t('common.loading')}</div>
        ) : recent.length === 0 ? (
          <Card padding="lg" className="text-center py-8">
            <p className="text-sm text-slate-400">{t('checkin.noVisits')}</p>
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {recent.map((row) => (
                <div key={row.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm dark:text-slate-100">{row.customer.customerName}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {t('checkin.inAt', { time: formatDateTime(row.checkInTime) })}
                      {row.checkOutTime ? ` · ${t('checkin.outAt', { time: formatDateTime(row.checkOutTime) })}` : ` · ${t('checkin.stillIn')}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
