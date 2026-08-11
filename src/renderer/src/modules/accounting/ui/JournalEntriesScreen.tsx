import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { BookText, RefreshCw, Plus, RotateCcw, X } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Select } from '@shared/ui/atoms/Select'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { Badge } from '@shared/ui/atoms/Badge'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDateTime } from '@shared/utils/locale.util'

interface JELine { id: string; debitAmount: number; creditAmount: number; account: { accountCode: string; accountName: string } }
interface JournalEntry {
  id: string; entryNumber: string; entryDate: string; narration: string | null
  sourceType: string; isReversed: boolean; lines: JELine[]
}
interface Account { id: string; accountCode: string; accountName: string; accountType: string; isActive: boolean }

const SOURCE_TYPES = ['MANUAL', 'INVOICE', 'BILL', 'PAYMENT', 'SUPPLIER_PAYMENT', 'EXPENSE', 'BANK_ACCOUNT_OPENING', 'PDC_CLEARED', 'INTEREST_CHARGE', 'ASSET_DEPRECIATION', 'ASSET_DISPOSAL', 'YEAR_END_OPENING'] as const

// Phase 62 — Journal Entries.
export function JournalEntriesScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canCreate = hasPermission('journalEntries.create')
  const canReverse = hasPermission('journalEntries.reverse')

  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sourceType, setSourceType] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [reversingId, setReversingId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reversing, setReversing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.journalEntries.list(sourceType ? { sourceType } : undefined)
      if (res.success && res.data) {
        const d = res.data as { entries: JournalEntry[]; total: number }
        setEntries(d.entries); setTotal(d.total)
      } else toastError(t('common.error'), res.error?.message ?? t('accounting.journalEntries.couldNotLoad'))
    } catch {
      toastError(t('common.error'), t('accounting.journalEntries.couldNotLoad'))
    } finally { setLoading(false) }
  }, [sourceType, toastError, t])

  useEffect(() => { load() }, [load])

  async function handleReverse() {
    if (!reversingId || !reverseReason.trim()) { toastError(t('accounting.journalEntries.reasonRequired'), t('accounting.journalEntries.enterReversalReason')); return }
    setReversing(true)
    try {
      const res = await window.api.journalEntries.reverse({ id: reversingId, reason: reverseReason.trim() })
      if (res.success) {
        toastSuccess(t('accounting.journalEntries.reversed'), t('accounting.journalEntries.mirroredEntryPosted'))
        setReversingId(null); setReverseReason('')
        load()
      } else toastError(t('common.error'), res.error?.message ?? t('accounting.journalEntries.couldNotReverse'))
    } catch {
      toastError(t('common.error'), t('accounting.journalEntries.couldNotReverse'))
    } finally { setReversing(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <BookText size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.journalEntries.title')}</h1>
              <p className="text-xs text-slate-400">{t('accounting.journalEntries.entriesCount', { count: total })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canCreate && <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{t('accounting.journalEntries.newEntry')}</Button>}
          </div>
        </div>
        <div className="mt-4 max-w-xs">
          <Select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
            <option value="">{t('accounting.journalEntries.allSources')}</option>
            {SOURCE_TYPES.map((st) => <option key={st} value={st}>{t(`accounting.journalEntries.sourceType.${st}`)}</option>)}
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && entries.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={8} cols={6} /></div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <BookText size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('accounting.journalEntries.noEntriesYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.journalEntries.colEntryNumber')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.date')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.journalEntries.colNarration')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.journalEntries.colSource')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.total')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {entries.map((je) => {
                const jeTotal = je.lines.reduce((s, l) => s + l.debitAmount, 0)
                return (
                  <tr key={je.id} className={`border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors ${je.isReversed ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-3 font-mono text-xs font-semibold text-dark dark:text-slate-100">{je.entryNumber}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(je.entryDate)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{je.narration ?? '—'}</td>
                    <td className="px-4 py-3 text-center"><Badge variant="neutral" size="sm">{je.sourceType}</Badge></td>
                    <td className="px-4 py-3 text-end font-semibold text-dark dark:text-slate-100">{formatCurrency(jeTotal)}</td>
                    <td className="px-4 py-3 text-end">
                      {je.isReversed ? (
                        <span className="text-xs text-danger font-semibold">{t('accounting.journalEntries.reversedBadge')}</span>
                      ) : canReverse ? (
                        <button onClick={() => { setReversingId(je.id); setReverseReason('') }} title={t('accounting.journalEntries.reverseEntry')}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-danger hover:bg-danger/10 transition-colors ms-auto">
                          <RotateCcw size={13} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateJournalEntryModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      )}

      {reversingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.journalEntries.reverseEntry')}</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('accounting.journalEntries.reasonLabel')}</label>
              <input value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} autoFocus
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setReversingId(null)} disabled={reversing}>{t('common.cancel')}</Button>
              <Button variant="danger" className="flex-1" onClick={handleReverse} loading={reversing}>{t('accounting.journalEntries.reverse')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface DraftLine { accountId: string; debitAmount: string; creditAmount: string; remarks: string }

function CreateJournalEntryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [narration, setNarration] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([
    { accountId: '', debitAmount: '', creditAmount: '', remarks: '' },
    { accountId: '', debitAmount: '', creditAmount: '', remarks: '' }
  ])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.chartOfAccounts.list({ isActive: true }).then((res) => {
      if (res.success && res.data) setAccounts(res.data as Account[])
    })
  }, [])

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debitAmount) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.creditAmount) || 0), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0

  function updateLine(idx: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  function addLine() {
    setLines((prev) => [...prev, { accountId: '', debitAmount: '', creditAmount: '', remarks: '' }])
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!balanced) { toastError(t('accounting.journalEntries.notBalanced'), t('accounting.journalEntries.debitMustEqualCredit')); return }
    const validLines = lines.filter((l) => l.accountId && (parseFloat(l.debitAmount) > 0 || parseFloat(l.creditAmount) > 0))
    if (validLines.length < 2) { toastError(t('accounting.journalEntries.incomplete'), t('accounting.journalEntries.needTwoLines')); return }

    setSaving(true)
    try {
      const res = await window.api.journalEntries.create({
        entryDate,
        narration: narration.trim() || undefined,
        lines: validLines.map((l) => ({
          accountId: l.accountId,
          debitAmount: parseFloat(l.debitAmount) || 0,
          creditAmount: parseFloat(l.creditAmount) || 0,
          remarks: l.remarks.trim() || undefined
        }))
      })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.journalEntries.couldNotPost')); return }
      toastSuccess(t('accounting.journalEntries.entryPosted'), '')
      onSaved()
    } catch {
      toastError(t('common.error'), t('accounting.journalEntries.couldNotPost'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.journalEntries.newEntry')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('common.date')}</label>
              <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('accounting.journalEntries.colNarration')}</label>
              <input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder={t('accounting.journalEntries.narrationPlaceholder')}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select value={line.accountId} onChange={(e) => updateLine(idx, { accountId: e.target.value })}
                  className="flex-1 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand">
                  <option value="">{t('accounting.journalEntries.selectAccount')}</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.accountCode} — {a.accountName}</option>)}
                </select>
                <input type="number" min="0" step="0.01" value={line.debitAmount} placeholder={t('common.debit')}
                  onChange={(e) => updateLine(idx, { debitAmount: e.target.value, creditAmount: e.target.value ? '' : line.creditAmount })}
                  className="w-24 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-xs text-end focus:outline-none focus:ring-2 focus:ring-brand" />
                <input type="number" min="0" step="0.01" value={line.creditAmount} placeholder={t('common.credit')}
                  onChange={(e) => updateLine(idx, { creditAmount: e.target.value, debitAmount: e.target.value ? '' : line.debitAmount })}
                  className="w-24 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-xs text-end focus:outline-none focus:ring-2 focus:ring-brand" />
                <button onClick={() => removeLine(idx)} disabled={lines.length <= 2}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-danger disabled:opacity-30 transition-colors shrink-0">
                  <X size={13} />
                </button>
              </div>
            ))}
            <button onClick={addLine} className="text-xs text-brand hover:underline font-semibold">{t('accounting.journalEntries.addLine')}</button>
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs">
            <span className="text-slate-500 dark:text-slate-400">{t('common.debit')}: <span className="font-semibold text-dark dark:text-slate-100">{formatCurrency(totalDebit)}</span></span>
            <span className="text-slate-500 dark:text-slate-400">{t('common.credit')}: <span className="font-semibold text-dark dark:text-slate-100">{formatCurrency(totalCredit)}</span></span>
            <Badge variant={balanced ? 'success' : 'danger'} size="sm">{balanced ? t('accounting.journalEntries.balanced') : t('accounting.journalEntries.notBalancedBadge')}</Badge>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} loading={saving} disabled={!balanced}>{t('accounting.journalEntries.postEntry')}</Button>
        </div>
      </div>
    </div>
  )
}
