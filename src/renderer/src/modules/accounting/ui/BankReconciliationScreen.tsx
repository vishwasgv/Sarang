import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Upload, Wand2, RefreshCw, Check, Undo2, X } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDateTime } from '@shared/utils/locale.util'
import { DocumentPanel } from '@renderer/modules/documents/ui/DocumentPanel'

interface StatementLine {
  id: string; transactionDate: string; description: string; referenceNumber: string | null
  debitAmount: number; creditAmount: number; reconciled: boolean; matchedType: string | null; matchedId: string | null
}
interface Summary {
  bookBalance: number; statementNetMovement: number; totalDebits: number; totalCredits: number
  lineCount: number; reconciledCount: number; unreconciledCount: number
}

// Phase 62 — Bank statement reconciliation.
export function BankReconciliationScreen() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canImport = hasPermission('bankReconciliation.import')
  const canReconcile = hasPermission('bankReconciliation.reconcile')

  const [lines, setLines] = useState<StatementLine[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'UNRECONCILED' | 'RECONCILED'>('UNRECONCILED')
  const [showImport, setShowImport] = useState(false)
  const [matching, setMatching] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [linesRes, summaryRes] = await Promise.all([
        window.api.bankStatement.list({ bankAccountId: id, reconciled: filter === 'ALL' ? undefined : filter === 'RECONCILED' }),
        window.api.bankStatement.summary({ bankAccountId: id })
      ])
      if (linesRes.success && linesRes.data) setLines((linesRes.data as { lines: StatementLine[] }).lines)
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data as Summary)
    } catch {
      toastError(t('common.error'), t('accounting.bankReconciliation.couldNotLoad'))
    } finally { setLoading(false) }
  }, [id, filter, toastError, t])

  useEffect(() => { load() }, [load])

  async function handleAutoMatch() {
    if (!id) return
    setMatching(true)
    try {
      const res = await window.api.bankStatement.autoMatch({ bankAccountId: id })
      if (res.success) {
        const d = res.data as { matchedCount: number }
        toastSuccess(t('accounting.bankReconciliation.autoMatchComplete'), t('accounting.bankReconciliation.linesReconciled', { count: d.matchedCount }))
        load()
      } else toastError(t('common.error'), res.error?.message ?? t('accounting.bankReconciliation.couldNotAutoMatch'))
    } catch {
      toastError(t('common.error'), t('accounting.bankReconciliation.couldNotAutoMatch'))
    } finally { setMatching(false) }
  }

  async function handleUnreconcile(lineId: string) {
    try {
      const res = await window.api.bankStatement.unreconcileLine({ lineId })
      if (res.success) load()
      else toastError(t('common.error'), res.error?.message ?? t('accounting.bankReconciliation.couldNotUnreconcile'))
    } catch {
      toastError(t('common.error'), t('accounting.bankReconciliation.couldNotUnreconcile'))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/accounting/bank-accounts')} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.bankReconciliation.title')}</h1>
            <p className="text-xs text-slate-400">{t('accounting.bankReconciliation.subtitle')}</p>
          </div>
          <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {canImport && <Button size="sm" variant="outline" icon={<Upload size={14} />} onClick={() => setShowImport(true)}>{t('accounting.bankReconciliation.importStatement')}</Button>}
          {canReconcile && <Button size="sm" icon={<Wand2 size={14} />} onClick={handleAutoMatch} loading={matching}>{t('accounting.bankReconciliation.autoMatch')}</Button>}
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <Card padding="sm"><p className="text-[10px] text-slate-400 uppercase font-bold">{t('accounting.bankReconciliation.bookBalance')}</p><p className="text-lg font-bold text-dark dark:text-slate-100">{formatCurrency(summary.bookBalance)}</p></Card>
            <Card padding="sm"><p className="text-[10px] text-slate-400 uppercase font-bold">{t('accounting.bankReconciliation.statementNetMovement')}</p><p className="text-lg font-bold text-dark dark:text-slate-100">{formatCurrency(summary.statementNetMovement)}</p></Card>
            <Card padding="sm"><p className="text-[10px] text-slate-400 uppercase font-bold">{t('accounting.bankReconciliation.reconciled')}</p><p className="text-lg font-bold text-success">{summary.reconciledCount}</p></Card>
            <Card padding="sm"><p className="text-[10px] text-slate-400 uppercase font-bold">{t('accounting.bankReconciliation.unreconciled')}</p><p className="text-lg font-bold text-warning">{summary.unreconciledCount}</p></Card>
          </div>
        )}

        {id && (
          <Card padding="sm" className="mt-4">
            <DocumentPanel entityType="BANK_STATEMENT" entityId={id} compact />
          </Card>
        )}

        <div className="flex items-center gap-2 mt-4">
          {(['UNRECONCILED', 'RECONCILED', 'ALL'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filter === f ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand'}`}>
              {f === 'UNRECONCILED' ? t('accounting.bankReconciliation.unreconciled') : f === 'RECONCILED' ? t('accounting.bankReconciliation.reconciled') : t('common.all')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && lines.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={8} cols={6} /></div>
        ) : lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('accounting.bankReconciliation.noLinesForFilter')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.date')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.bankReconciliation.colDescription')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.debit')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.credit')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(l.transactionDate)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{l.description}</td>
                  <td className="px-4 py-3 text-end text-danger">{l.debitAmount > 0 ? formatCurrency(l.debitAmount) : '—'}</td>
                  <td className="px-4 py-3 text-end text-success">{l.creditAmount > 0 ? formatCurrency(l.creditAmount) : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {l.reconciled ? <Badge variant="success" size="sm">{l.matchedType ?? t('accounting.bankReconciliation.reconciled')}</Badge> : <Badge variant="warning" size="sm">{t('accounting.bankReconciliation.unreconciled')}</Badge>}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {l.reconciled && canReconcile && (
                      <button onClick={() => handleUnreconcile(l.id)} title={t('accounting.bankReconciliation.undoReconciliation')} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-danger hover:bg-danger/10 transition-colors ms-auto">
                        <Undo2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showImport && id && (
        <ImportStatementModal bankAccountId={id} onClose={() => setShowImport(false)} onSaved={() => { setShowImport(false); load() }} />
      )}
    </div>
  )
}

interface DraftLine { transactionDate: string; description: string; debitAmount: string; creditAmount: string }

function ImportStatementModal({ bankAccountId, onClose, onSaved }: { bankAccountId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [rows, setRows] = useState<DraftLine[]>([{ transactionDate: new Date().toISOString().slice(0, 10), description: '', debitAmount: '', creditAmount: '' }])
  const [saving, setSaving] = useState(false)

  function updateRow(idx: number, patch: Partial<DraftLine>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  function addRow() {
    setRows((prev) => [...prev, { transactionDate: new Date().toISOString().slice(0, 10), description: '', debitAmount: '', creditAmount: '' }])
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleImport() {
    const validRows = rows.filter((r) => r.description.trim() && (parseFloat(r.debitAmount) > 0 || parseFloat(r.creditAmount) > 0))
    if (validRows.length === 0) { toastError(t('accounting.bankReconciliation.nothingToImport'), t('accounting.bankReconciliation.addAtLeastOneLine')); return }

    setSaving(true)
    try {
      const res = await window.api.bankStatement.import({
        bankAccountId,
        lines: validRows.map((r) => ({
          transactionDate: r.transactionDate,
          description: r.description.trim(),
          debitAmount: parseFloat(r.debitAmount) || 0,
          creditAmount: parseFloat(r.creditAmount) || 0
        }))
      })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.bankReconciliation.couldNotImport')); return }
      toastSuccess(t('accounting.bankReconciliation.imported'), t('accounting.bankReconciliation.linesImported', { count: validRows.length }))
      onSaved()
    } catch {
      toastError(t('common.error'), t('accounting.bankReconciliation.couldNotImport'))
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.bankReconciliation.importBankStatement')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-xs text-slate-400">{t('accounting.bankReconciliation.importHint')}</p>
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input type="date" value={row.transactionDate} onChange={(e) => updateRow(idx, { transactionDate: e.target.value })}
                className="w-36 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand" />
              <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} placeholder={t('accounting.bankReconciliation.colDescription')}
                className="flex-1 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand" />
              <input type="number" min="0" step="0.01" value={row.debitAmount} placeholder={t('common.debit')}
                onChange={(e) => updateRow(idx, { debitAmount: e.target.value, creditAmount: e.target.value ? '' : row.creditAmount })}
                className="w-24 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-xs text-end focus:outline-none focus:ring-2 focus:ring-brand" />
              <input type="number" min="0" step="0.01" value={row.creditAmount} placeholder={t('common.credit')}
                onChange={(e) => updateRow(idx, { creditAmount: e.target.value, debitAmount: e.target.value ? '' : row.debitAmount })}
                className="w-24 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-xs text-end focus:outline-none focus:ring-2 focus:ring-brand" />
              <button onClick={() => removeRow(idx)} disabled={rows.length <= 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-danger disabled:opacity-30 transition-colors shrink-0">
                <X size={13} />
              </button>
            </div>
          ))}
          <button onClick={addRow} className="text-xs text-brand hover:underline font-semibold">{t('accounting.journalEntries.addLine')}</button>
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button icon={<Check size={14} />} onClick={handleImport} loading={saving}>{t('accounting.bankReconciliation.import')}</Button>
        </div>
      </div>
    </div>
  )
}
