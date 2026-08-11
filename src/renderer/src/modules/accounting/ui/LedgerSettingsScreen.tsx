import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, CalendarClock, AlertTriangle } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

// Phase 62 — Transaction Locking + Year-End Close, both Admin-only,
// structural, high-consequence operations.
export function LedgerSettingsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManageLock = hasPermission('transactionLock.manage')
  const canCloseYear = hasPermission('yearEndClose.execute')

  const [lockDate, setLockDate] = useState<string | null>(null)
  const [lockDateInput, setLockDateInput] = useState('')
  const [savingLock, setSavingLock] = useState(false)
  const [closingDate, setClosingDate] = useState('')
  const [closingYear, setClosingYear] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  const loadLockDate = useCallback(async () => {
    try {
      const res = await window.api.transactionLock.getLockDate()
      if (res.success && res.data) {
        setLockDate(res.data.lockDate)
        setLockDateInput(res.data.lockDate ? res.data.lockDate.slice(0, 10) : '')
      }
    } catch {
      toastError(t('common.error'), t('accounting.ledgerSettings.couldNotLoadLockDate'))
    }
  }, [toastError, t])

  useEffect(() => { loadLockDate() }, [loadLockDate])

  // Real bug found live 2026-08-12 (LedgerSettingsScreen UAT against the
  // real app): the "Clear Lock" button called `setLockDateInput('')` then
  // immediately `handleSetLockDate()` in the same event handler — but
  // `handleSetLockDate` read `lockDateInput` from its own render's closure,
  // which still held the OLD (non-empty) value, since a state setter's
  // effect isn't visible until the next render. The button silently
  // re-saved the same lock date it was supposed to clear, while still
  // showing a "success" toast — an administrator clicking "Clear Lock"
  // would see confirmation but the lock would remain fully in effect.
  // Accepting an explicit override value sidesteps the stale closure
  // instead of relying on state that hasn't re-rendered yet.
  async function handleSetLockDate(overrideValue?: string) {
    const value = overrideValue !== undefined ? overrideValue : lockDateInput
    setSavingLock(true)
    try {
      const res = await window.api.transactionLock.setLockDate({ lockDate: value || null })
      if (res.success) {
        setLockDateInput(value)
        toastSuccess(t('accounting.ledgerSettings.lockDateUpdated'), value || t('accounting.ledgerSettings.cleared'))
        loadLockDate()
      } else toastError(t('common.error'), res.error?.message ?? t('accounting.ledgerSettings.couldNotSetLockDate'))
    } catch {
      toastError(t('common.error'), t('accounting.ledgerSettings.couldNotSetLockDate'))
    } finally { setSavingLock(false) }
  }

  async function handleCloseYear() {
    if (!closingDate) { toastError(t('accounting.ledgerSettings.missingDate'), t('accounting.ledgerSettings.chooseClosingDate')); return }
    setClosingYear(true)
    try {
      const res = await window.api.yearEndClose.execute({ closingDate })
      if (res.success) {
        const d = res.data as { netIncome: number; accountsCarriedForward: number }
        toastSuccess(t('accounting.ledgerSettings.yearClosed'), t('accounting.ledgerSettings.netIncomeSummary', { netIncome: d.netIncome, count: d.accountsCarriedForward }))
        setConfirmClose(false); setClosingDate('')
        loadLockDate()
      } else toastError(t('common.error'), res.error?.message ?? t('accounting.ledgerSettings.couldNotCloseYear'))
    } catch {
      toastError(t('common.error'), t('accounting.ledgerSettings.couldNotCloseYear'))
    } finally { setClosingYear(false) }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.ledgerSettings.title')}</h1>
        <p className="text-xs text-slate-400">{t('accounting.ledgerSettings.subtitle')}</p>
      </div>

      <Card padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-brand" />
          <h2 className="text-sm font-semibold text-dark dark:text-slate-100">{t('accounting.ledgerSettings.lockDateTitle')}</h2>
        </div>
        <p className="text-xs text-slate-400">{t('accounting.ledgerSettings.lockDateExplanation')}</p>
        {lockDate && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('accounting.ledgerSettings.currentlyLockedThrough')}: <span className="font-semibold text-dark dark:text-slate-100">{lockDate.slice(0, 10)}</span></p>
        )}
        {canManageLock ? (
          <div className="flex items-center gap-3">
            <input type="date" value={lockDateInput} onChange={(e) => setLockDateInput(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            <Button size="sm" onClick={() => handleSetLockDate()} loading={savingLock}>{t('common.save')}</Button>
            {lockDate && <Button size="sm" variant="outline" onClick={() => handleSetLockDate('')}>{t('accounting.ledgerSettings.clearLock')}</Button>}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">{t('accounting.ledgerSettings.adminOnlyLock')}</p>
        )}
      </Card>

      <Card padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-brand" />
          <h2 className="text-sm font-semibold text-dark dark:text-slate-100">{t('accounting.ledgerSettings.yearEndCloseTitle')}</h2>
        </div>
        <p className="text-xs text-slate-400">{t('accounting.ledgerSettings.yearEndCloseExplanation')}</p>
        {canCloseYear ? (
          <div className="flex items-center gap-3">
            <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            <Button size="sm" variant="danger" icon={<AlertTriangle size={14} />} onClick={() => setConfirmClose(true)} disabled={!closingDate}>{t('accounting.ledgerSettings.closeFinancialYear')}</Button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">{t('accounting.ledgerSettings.adminOnlyClose')}</p>
        )}
      </Card>

      {confirmClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle size={18} />
              <h2 className="text-base font-bold">{t('accounting.ledgerSettings.closeYearEndingQuestion', { date: closingDate })}</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('accounting.ledgerSettings.closeYearWarning', { date: closingDate })}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmClose(false)} disabled={closingYear}>{t('common.cancel')}</Button>
              <Button variant="danger" className="flex-1" onClick={handleCloseYear} loading={closingYear}>{t('accounting.ledgerSettings.closeYear')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
