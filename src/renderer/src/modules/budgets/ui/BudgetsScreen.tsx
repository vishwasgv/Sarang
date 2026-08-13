import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PiggyBank, Plus, RefreshCw, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { formatCurrency } from '@shared/utils/currency.util'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

interface CostCentre { id: string; name: string; code: string | null; isActive: boolean }
interface Account { id: string; accountCode: string; accountName: string }
interface Budget {
  id: string; costCentreId: string | null; accountId: string | null
  periodYear: number; periodMonth: number; amount: number; notes: string | null
  costCentre?: { id: string; name: string } | null
  account?: { id: string; accountCode: string; accountName: string } | null
}
interface BudgetVsActualRow {
  budgetId: string; costCentreId: string | null; costCentreName: string | null
  accountId: string | null; accountName: string | null
  budgeted: number; actual: number; variance: number
}

// Phase 65 — Budget vs. Actual. One screen combines planning (create/edit a
// Budget row) and its own real-spend comparison for the same period — a
// budget without its actual next to it is half a feature.
export function BudgetsScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('budgets.manage')
  const today = new Date()

  const [period, setPeriod] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [actualRows, setActualRows] = useState<BudgetVsActualRow[]>([])
  const [costCentres, setCostCentres] = useState<CostCentre[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Budget | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [budgetRes, actualRes] = await Promise.all([
        window.api.budgets.list({ periodYear: period.year, periodMonth: period.month }),
        window.api.reports.budgetVsActual({ periodYear: period.year, periodMonth: period.month })
      ])
      if (budgetRes.success && budgetRes.data) setBudgets(budgetRes.data as Budget[])
      else toastError(t('common.error'), budgetRes.error?.message ?? t('budgets.couldNotLoad'))
      if (actualRes.success && actualRes.data) setActualRows((actualRes.data as { rows: BudgetVsActualRow[] }).rows ?? [])
    } catch {
      toastError(t('common.error'), t('budgets.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [period, toastError, t])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    window.api.costCentres.list().then((res) => { if (res.success && res.data) setCostCentres(res.data as CostCentre[]) }).catch(() => {})
    window.api.chartOfAccounts.list({ isActive: true }).then((res) => { if (res.success && res.data) setAccounts(res.data as Account[]) }).catch(() => {})
  }, [])

  async function handleDelete(id: string) {
    try {
      const res = await window.api.budgets.delete({ id })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('budgets.couldNotDelete')); return }
      load()
    } catch {
      toastError(t('common.error'), t('budgets.couldNotDelete'))
    }
  }

  const monthLabel = new Date(period.year, period.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  const actualByBudgetId = new Map(actualRows.map(r => [r.budgetId, r]))

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <PiggyBank size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('budgets.title')}</h1>
              <p className="text-xs text-slate-400">{t('budgets.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-1">
              <button onClick={() => setPeriod(p => p.month === 1 ? { year: p.year - 1, month: 12 } : { ...p, month: p.month - 1 })} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand"><ChevronLeft size={16} /></button>
              <span className="text-sm font-semibold text-dark dark:text-slate-100 px-2 min-w-[9rem] text-center">{monthLabel}</span>
              <button onClick={() => setPeriod(p => p.month === 12 ? { year: p.year + 1, month: 1 } : { ...p, month: p.month + 1 })} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand"><ChevronRight size={16} /></button>
            </div>
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{t('budgets.newBudget')}</Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950 p-6">
        {loading && budgets.length === 0 ? (
          <SkeletonTable rows={4} cols={5} />
        ) : budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
            <PiggyBank size={40} className="text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('budgets.empty.title')}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">{t('budgets.empty.body')}</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-4">
              <ResponsiveContainer width="100%" height={Math.max(180, budgets.length * 44)}>
                <BarChart
                  data={budgets.map((b) => ({
                    name: b.costCentre?.name ?? t('budgets.wholeCompany'),
                    budgeted: b.amount,
                    actual: actualByBudgetId.get(b.id)?.actual ?? 0
                  }))}
                  layout="vertical"
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={120} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="budgeted" name={t('budgets.budgeted')} fill="#94A3B8" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="actual" name={t('budgets.actual')} fill="#00AEEF" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                  <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('budgets.scope')}</th>
                  <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('budgets.budgeted')}</th>
                  <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('budgets.actual')}</th>
                  <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('budgets.variance')}</th>
                  <th className="text-end px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {budgets.map((b) => {
                  const actual = actualByBudgetId.get(b.id)
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-dark dark:text-slate-100">{b.costCentre?.name ?? t('budgets.wholeCompany')}</div>
                        <div className="text-xs text-slate-400">{b.account ? `${b.account.accountCode} — ${b.account.accountName}` : t('budgets.allAccounts')}</div>
                      </td>
                      <td className="px-4 py-3 text-end text-dark dark:text-slate-100">{formatCurrency(b.amount)}</td>
                      <td className="px-4 py-3 text-end text-dark dark:text-slate-100">{actual ? formatCurrency(actual.actual) : '—'}</td>
                      <td className={`px-4 py-3 text-end font-semibold ${actual && actual.variance < 0 ? 'text-danger' : 'text-success'}`}>{actual ? formatCurrency(actual.variance) : '—'}</td>
                      <td className="px-6 py-3 text-end">
                        {canManage && (
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => setEditTarget(b)} className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand transition-colors">{t('common.edit')}</button>
                            <button onClick={() => handleDelete(b.id)} className="text-slate-400 hover:text-danger transition-colors"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <BudgetFormModal period={period} costCentres={costCentres} accounts={accounts} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      )}
      {editTarget && (
        <BudgetFormModal budget={editTarget} period={period} costCentres={costCentres} accounts={accounts} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load() }} />
      )}
    </div>
  )
}

function BudgetFormModal({ budget, period, costCentres, accounts, onClose, onSaved }: {
  budget?: Budget; period: { year: number; month: number }
  costCentres: CostCentre[]; accounts: Account[]
  onClose: () => void; onSaved: () => void
}) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [costCentreId, setCostCentreId] = useState(budget?.costCentreId ?? '')
  const [accountId, setAccountId] = useState(budget?.accountId ?? '')
  const [amount, setAmount] = useState(budget?.amount ?? 0)
  const [notes, setNotes] = useState(budget?.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (amount <= 0) { toastError(t('common.error'), t('budgets.amountMustBePositive')); return }
    setSaving(true)
    try {
      const res = budget
        ? await window.api.budgets.update({ id: budget.id, amount, notes: notes.trim() || undefined })
        : await window.api.budgets.create({
            costCentreId: costCentreId || undefined, accountId: accountId || undefined,
            periodYear: period.year, periodMonth: period.month, amount, notes: notes.trim() || undefined
          })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('budgets.couldNotSave')); return }
      toastSuccess(t('common.saveChanges'), '')
      onSaved()
    } catch {
      toastError(t('common.error'), t('budgets.couldNotSave'))
    } finally {
      setSaving(false)
    }
  }

  const monthLabel = new Date(period.year, period.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <Modal
      open
      onClose={onClose}
      title={budget ? t('budgets.editBudget') : t('budgets.newBudget')}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleSave} loading={saving}>{t('common.saveChanges')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">{t('budgets.periodLabel', { period: monthLabel })}</p>
        {!budget && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('costCentres.title')}</label>
              <select value={costCentreId} onChange={(e) => setCostCentreId(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                <option value="">{t('budgets.wholeCompany')}</option>
                {costCentres.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('budgets.account')}</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                <option value="">{t('budgets.allAccounts')}</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.accountCode} — {a.accountName}</option>)}
              </select>
            </div>
          </>
        )}
        <Input label={`${t('budgets.amount')} *`} type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        <Input label={t('common.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  )
}
