import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { Input } from '@shared/ui/atoms/Input'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'

interface Claim { id: string; claimantName: string; description: string; amount: number; claimDate: string; status: string; decisionNote: string | null }
interface Category { id: string; categoryName: string }

const STATUSES = ['SUBMITTED', 'APPROVED', 'PAID', 'REJECTED']
const METHODS = ['CASH', 'UPI', 'BANK_TRANSFER']

// Staff expense claims: submit, approve or reject, then repay (which records a normal expense).
export function ExpenseClaimsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const profile = useBusinessStore((s) => s.profile)
  const canCreate = hasPermission('expenses.create')
  const canDecide = hasPermission('expenses.modify')
  const [claims, setClaims] = useState<Claim[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filter, setFilter] = useState('')
  const [form, setForm] = useState({ claimantName: '', categoryId: '', description: '', amount: '' })
  const [method, setMethod] = useState<Record<string, string>>({})
  const money = (n: number) => formatCurrency(n, profile?.currencyCode, profile?.currencySymbol)

  const load = useCallback(async () => {
    const res = await window.api.expenseClaims.list(filter ? { status: filter } : {})
    if (res.success && res.data) setClaims(res.data as Claim[])
  }, [filter])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    window.api.expenses.listCategories().then((res) => {
      if (res.success && res.data) {
        const list = res.data as Category[]
        setCategories(list)
        setForm((f) => (f.categoryId || !list[0] ? f : { ...f, categoryId: list[0].id }))
      }
    })
  }, [])

  const fail = (res: { error?: { message?: string } }) => toastError(t('common.error'), res.error?.message ?? '')

  async function submit() {
    const res = await window.api.expenseClaims.submit({ ...form, amount: Number(form.amount) })
    if (!res.success) return fail(res)
    toastSuccess(t('expenseClaims.submitted'))
    setForm((f) => ({ ...f, description: '', amount: '' }))
    void load()
  }
  async function decide(id: string, to: 'APPROVED' | 'REJECTED') {
    const res = await window.api.expenseClaims.decide({ id, to })
    if (!res.success) return fail(res)
    void load()
  }
  async function pay(id: string) {
    const res = await window.api.expenseClaims.pay({ id, paymentMethod: method[id] ?? 'CASH' })
    if (!res.success) return fail(res)
    toastSuccess(t('expenseClaims.paid'))
    void load()
  }

  const field = 'h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-dark dark:text-slate-100'
  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('expenseClaims.title')}</h2>
        <p className="text-sm text-slate-500">{t('expenseClaims.hint')}</p>
      </div>

      {canCreate && (
        <Card padding="lg" className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label={t('expenseClaims.claimant')} value={form.claimantName} onChange={(e) => setForm({ ...form, claimantName: e.target.value })} />
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('expenseClaims.category')}</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={`${field} w-full`}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
              </select>
            </div>
            <Input label={t('expenseClaims.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input label={t('expenseClaims.amount')} type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <Button onClick={submit} disabled={!form.claimantName.trim() || !form.description.trim() || !(Number(form.amount) > 0)}>{t('expenseClaims.submit')}</Button>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {['', ...STATUSES].map((s) => (
          <button key={s || 'all'} onClick={() => setFilter(s)}
            className={`h-11 px-4 rounded-lg text-sm border ${filter === s ? 'bg-brand text-white border-brand' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
            {s ? t(`expenseClaims.status.${s}`) : t('common.all')}
          </button>
        ))}
      </div>

      {claims.length === 0 && <p className="text-sm text-slate-400 text-center py-8">{t('expenseClaims.empty')}</p>}
      {claims.map((c) => (
        <Card key={c.id} padding="md" className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-medium text-dark dark:text-slate-100">{c.description}</p>
            <p className="text-xs text-slate-400">{c.claimantName} · {formatDate(c.claimDate)} · {t(`expenseClaims.status.${c.status}`)}</p>
          </div>
          <p className="text-base font-semibold text-dark dark:text-slate-100">{money(c.amount)}</p>
          {canDecide && c.status === 'SUBMITTED' && <Button onClick={() => decide(c.id, 'APPROVED')}>{t('expenseClaims.approve')}</Button>}
          {canDecide && (c.status === 'SUBMITTED' || c.status === 'APPROVED') && <Button variant="secondary" onClick={() => decide(c.id, 'REJECTED')}>{t('expenseClaims.reject')}</Button>}
          {canDecide && canCreate && c.status === 'APPROVED' && (
            <>
              <select value={method[c.id] ?? 'CASH'} onChange={(e) => setMethod({ ...method, [c.id]: e.target.value })} className={field}>
                {METHODS.map((m) => <option key={m} value={m}>{t(`expenseClaims.methods.${m}`)}</option>)}
              </select>
              <Button onClick={() => pay(c.id)}>{t('expenseClaims.pay')}</Button>
            </>
          )}
        </Card>
      ))}
    </div>
  )
}
