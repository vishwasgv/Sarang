import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Edit, Trash2, Wallet, X } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { useBusinessStore } from '@app/store/business.store'

interface ExpenseCategory { id: string; categoryName: string }
interface Expense {
  id: string; expenseName: string; amount: number; expenseDate: string
  paymentMethod: string; remarks: string | null; categoryId: string
  category: { categoryName: string }
  createdBy?: { fullName: string } | null
}

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER']

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function ExpensesScreen() {
  const { t } = useTranslation()
  const currSym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()

  const canCreate = hasPermission('expenses.create')
  const canModify = hasPermission('expenses.modify')
  const canDelete = hasPermission('expenses.delete')

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(today)
  const [catFilter, setCatFilter] = useState('')

  // Form modal
  const [formOpen, setFormOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [formData, setFormData] = useState({ categoryId: '', expenseName: '', amount: '', expenseDate: today(), paymentMethod: 'CASH', remarks: '' })
  const [formSaving, setFormSaving] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.expenses.list({ dateFrom, dateTo, categoryId: catFilter || undefined, limit: 100 })
      if (res.success) {
        const d = res.data as { expenses: Expense[]; total: number }
        setExpenses(d.expenses ?? [])
        setTotal(d.total ?? 0)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally { setLoading(false) }
  }, [dateFrom, dateTo, catFilter, toastError, t])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    window.api.expenses.listCategories().then((res: any) => {
      if (res.success) setCategories(res.data as ExpenseCategory[])
      else toastError(t('common.error'), res?.error?.message ?? t('common.error'))
    }).catch(() => {
      toastError(t('common.error'), t('common.error'))
    })
  }, [toastError, t])

  function openCreate() {
    setEditExpense(null)
    setFormData({ categoryId: categories[0]?.id ?? '', expenseName: '', amount: '', expenseDate: today(), paymentMethod: 'CASH', remarks: '' })
    setFormOpen(true)
  }

  function openEdit(exp: Expense) {
    setEditExpense(exp)
    setFormData({
      categoryId: exp.categoryId,
      expenseName: exp.expenseName,
      amount: exp.amount.toString(),
      expenseDate: exp.expenseDate.slice(0, 10),
      paymentMethod: exp.paymentMethod,
      remarks: exp.remarks ?? ''
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!formData.categoryId) { toastError(t('common.required'), t('expenses.category')); return }
    if (!formData.expenseName.trim()) { toastError(t('common.required'), t('expenses.expenseName')); return }
    const amt = parseFloat(formData.amount)
    if (!amt || amt <= 0) { toastError(t('common.required'), t('expenses.amount')); return }

    setFormSaving(true)
    try {
      const payload = {
        categoryId: formData.categoryId,
        expenseName: formData.expenseName.trim(),
        amount: amt,
        expenseDate: formData.expenseDate || undefined,
        paymentMethod: formData.paymentMethod,
        remarks: formData.remarks.trim() || undefined
      }
      const res = editExpense
        ? await window.api.expenses.update({ id: editExpense.id, ...payload })
        : await window.api.expenses.create(payload)

      if (res.success) {
        toastSuccess(editExpense ? t('expenses.editExpense') : t('expenses.addExpense'), formData.expenseName)
        setFormOpen(false)
        load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally { setFormSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await window.api.expenses.delete(deleteTarget.id)
      if (res.success) {
        toastSuccess(t('common.delete'), `"${deleteTarget.expenseName}"`)
        setDeleteTarget(null)
        load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally { setDeleting(false) }
  }

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
            <Wallet size={20} className="text-danger" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('nav.expenses')}</h1>
            <p className="text-sm text-slate-500">{total} {t('nav.expenses').toLowerCase()} — {t('common.total')} {formatCurrency(totalAmount)}</p>
          </div>
        </div>
        {canCreate && (
          <Button size="sm" onClick={openCreate} disabled={categories.length === 0}>
            <Plus size={14} className="mr-1.5" /> {t('expenses.addExpense')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.dateFrom')}</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.dateTo')}</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">{t('expenses.category')}</label>
          <Select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
          </Select>
        </div>
      </div>

      {/* Category summary chips */}
      {expenses.length > 0 && (() => {
        const byCat: Record<string, number> = {}
        for (const e of expenses) {
          byCat[e.category.categoryName] = (byCat[e.category.categoryName] ?? 0) + e.amount
        }
        return (
          <div className="flex flex-wrap gap-2">
            {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([name, amt]) => (
              <span key={name} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
                {name} <span className="font-semibold text-dark dark:text-slate-100">{formatCurrency(amt)}</span>
              </span>
            ))}
          </div>
        )
      })()}

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('common.date')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('expenses.expenseName')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('expenses.category')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('expenses.paymentMethod')}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{t('expenses.amount')}</th>
              {(canModify || canDelete) && <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t('common.loading')}</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t('expenses.noExpenses')}</td></tr>
            ) : expenses.map(exp => (
              <tr key={exp.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {formatDate(exp.expenseDate)}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-dark dark:text-slate-100">{exp.expenseName}</p>
                  {exp.remarks && <p className="text-xs text-slate-400 mt-0.5">{exp.remarks}</p>}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="neutral" size="sm">{exp.category.categoryName}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{exp.paymentMethod.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-right font-semibold text-dark dark:text-slate-100">
                  {formatCurrency(exp.amount)}
                </td>
                {(canModify || canDelete) && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {canModify && (
                        <button onClick={() => openEdit(exp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors">
                          <Edit size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleteTarget(exp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {expenses.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
              <tr>
                <td colSpan={(canModify || canDelete) ? 4 : 4} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{t('common.total')}</td>
                <td className="px-4 py-3 text-right font-bold text-dark dark:text-slate-100">
                  {formatCurrency(totalAmount)}
                </td>
                {(canModify || canDelete) && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </Card>

      {/* Add/Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-dark dark:text-slate-100">{editExpense ? t('expenses.editExpense') : t('expenses.addExpense')}</h2>
              <button onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
            </div>

            <Select label={t('expenses.category')} required value={formData.categoryId} onChange={e => setFormData(d => ({ ...d, categoryId: e.target.value }))}>
              <option value="">{t('expenses.category')}…</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
            </Select>

            <Input
              label={`${t('expenses.expenseName')} *`}
              value={formData.expenseName}
              onChange={e => setFormData(d => ({ ...d, expenseName: e.target.value }))}
              placeholder={t('expenses.expenseName')}
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`${t('expenses.amount')} (${currSym}) *`}
                type="number"
                min="0"
                step="1"
                value={formData.amount}
                onChange={e => setFormData(d => ({ ...d, amount: e.target.value }))}
                placeholder="0.00"
              />
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{t('common.date')}</label>
                <input type="date" value={formData.expenseDate}
                  onChange={e => setFormData(d => ({ ...d, expenseDate: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{t('expenses.paymentMethod')}</label>
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map(m => (
                  <button key={m} onClick={() => setFormData(d => ({ ...d, paymentMethod: m }))}
                    className={cn('h-8 rounded-lg text-xs font-semibold border transition-colors', formData.paymentMethod === m ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand')}>
                    {m.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label={t('expenses.remarks')}
              value={formData.remarks}
              onChange={e => setFormData(d => ({ ...d, remarks: e.target.value }))}
              placeholder={t('expenses.remarks')}
            />

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handleSave} loading={formSaving}>
                {editExpense ? t('common.save') : t('expenses.addExpense')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={t('expenses.deleteExpense')}
        message={`${t('expenses.deleteExpense')} "${deleteTarget?.expenseName}" (${formatCurrency(deleteTarget?.amount ?? 0)})?`}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
