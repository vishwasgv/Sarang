import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Droplets, RefreshCw, AlertTriangle } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { Badge } from '@shared/ui/atoms/Badge'
import { formatDate } from '@shared/utils/locale.util'

interface StockUnit {
  donationRecordId: string
  donationNumber: string
  bloodGroup: string
  componentType: string
  collectionDate: string
  expiryDate: string
  daysToExpiry: number
  isExpired: boolean
  isExpiringSoon: boolean
}

interface StockSummaryEntry { available: number; expiringSoon: number }

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

const COMPONENT_LABEL_KEY: Record<string, string> = {
  WHOLE_BLOOD: 'componentWholeBlood',
  PACKED_RBC: 'componentPackedRbc',
  PLATELETS: 'componentPlatelets',
  PLASMA: 'componentPlasma',
  CRYOPRECIPITATE: 'componentCryoprecipitate',
}

export function BloodStockScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [units, setUnits] = useState<StockUnit[]>([])
  const [summary, setSummary] = useState<Record<string, StockSummaryEntry>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'EXPIRING'>('ALL')

  function componentLabel(type: string): string {
    const key = COMPONENT_LABEL_KEY[type]
    return key ? t(`bloodBank.${key}`) : type.replace('_', ' ')
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.bloodBank.getBloodStock()
      if (res.success && res.data) {
        const d = res.data as { units: StockUnit[]; summary: Record<string, StockSummaryEntry> }
        setUnits(d.units ?? [])
        setSummary(d.summary ?? {})
      } else {
        toastError(t('bloodBank.failed'), res.error?.message ?? t('bloodBank.stock.couldNotLoadStock'))
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.stock.couldNotLoadStock'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  const visible = filter === 'ALL' ? units.filter((u) => !u.isExpired) : units.filter((u) => u.isExpiringSoon && !u.isExpired)
  const totalAvailable = units.filter((u) => !u.isExpired).length
  const totalExpiringSoon = units.filter((u) => u.isExpiringSoon).length

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Droplets size={24} className="text-brand" />
              {t('bloodBank.stock.title')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {totalExpiringSoon > 0
                ? t('bloodBank.stock.summaryWithExpiring', { count: totalAvailable, expiring: totalExpiringSoon })
                : t('bloodBank.stock.summaryNoExpiring', { count: totalAvailable })}
            </p>
          </div>
          <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Group x component summary grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BLOOD_GROUPS.map((group) => {
            const groupEntries = Object.entries(summary).filter(([key]) => key.startsWith(`${group}_`))
            const available = groupEntries.reduce((sum, [, v]) => sum + v.available, 0)
            const expiringSoon = groupEntries.reduce((sum, [, v]) => sum + v.expiringSoon, 0)
            return (
              <div key={group} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-brand">{group}</span>
                  {expiringSoon > 0 && <AlertTriangle size={14} className="text-warning" />}
                </div>
                <p className="text-2xl font-bold text-text-primary mt-1">{available}</p>
                <p className="text-xs text-text-secondary">{t('bloodBank.stock.unitsAvailableLabel')}</p>
                {expiringSoon > 0 && <p className="text-xs text-warning mt-1">{t('bloodBank.stock.expiringSoonCount', { count: expiringSoon })}</p>}
              </div>
            )
          })}
        </div>

        <div>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setFilter('ALL')} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'ALL' ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{t('bloodBank.stock.allUnits')}</button>
            <button onClick={() => setFilter('EXPIRING')} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'EXPIRING' ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{t('bloodBank.stock.expiringSoon')}</button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
              <Droplets size={40} className="mb-3 opacity-30" />
              <p className="text-base font-medium">{t('bloodBank.stock.noUnitsToShow')}</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr className="text-start text-text-secondary">
                    <th className="px-4 py-2 font-semibold">{t('bloodBank.stock.unitCol')}</th>
                    <th className="px-4 py-2 font-semibold">{t('bloodBank.stock.groupCol')}</th>
                    <th className="px-4 py-2 font-semibold">{t('bloodBank.stock.componentCol')}</th>
                    <th className="px-4 py-2 font-semibold">{t('bloodBank.stock.collectedCol')}</th>
                    <th className="px-4 py-2 font-semibold">{t('bloodBank.stock.expiresCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((u) => (
                    <tr key={u.donationRecordId} className="border-t border-border">
                      <td className="px-4 py-2 font-mono text-xs">{u.donationNumber}</td>
                      <td className="px-4 py-2"><Badge variant="brand" size="sm">{u.bloodGroup}</Badge></td>
                      <td className="px-4 py-2">{componentLabel(u.componentType)}</td>
                      <td className="px-4 py-2">{formatDate(u.collectionDate)}</td>
                      <td className="px-4 py-2">
                        <span className={u.isExpiringSoon ? 'text-warning font-semibold' : 'text-text-primary'}>{formatDate(u.expiryDate)}</span>
                        {u.isExpiringSoon && <span className="ms-1 text-xs text-warning">({u.daysToExpiry}d)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
