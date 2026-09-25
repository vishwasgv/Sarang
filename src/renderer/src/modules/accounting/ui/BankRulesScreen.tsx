import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Wand2, Trash2 } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { Input } from '@shared/ui/atoms/Input'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'

interface Rule { id: string; name: string; bankAccountId: string | null; direction: string; contains: string; minAmount: number | null; maxAmount: number | null; accountId: string; priority: number; isActive: boolean }
interface Bank { id: string; accountName: string }
interface Account { id: string; accountName: string; accountCode: string; isActive: boolean }
interface Suggestion { lineId: string; date: string; description: string; debitAmount: number; creditAmount: number; rule: { id: string; name: string; accountName: string } | null }

const EMPTY = { name: '', bankAccountId: '', direction: 'ANY', contains: '', minAmount: '', maxAmount: '', accountId: '' }

// Rules that say which account a bank statement line belongs to, and one-click posting of the lines they match.
export function BankRulesScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canEdit = useAuthStore((s) => s.hasPermission('bankReconciliation.reconcile'))
  const [rules, setRules] = useState<Rule[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [form, setForm] = useState(EMPTY)
  const [bankId, setBankId] = useState('')
  const [lines, setLines] = useState<Suggestion[]>([])
  const [busy, setBusy] = useState(false)

  const loadRules = useCallback(async () => {
    const res = await window.api.bankRules.list()
    if (res.success && res.data) setRules(res.data as Rule[])
  }, [])
  useEffect(() => {
    loadRules()
    window.api.bankAccounts.list({}).then((res) => {
      const data = res.success ? (res.data as { accounts?: Bank[] } | Bank[]) : []
      const list = Array.isArray(data) ? data : (data.accounts ?? [])
      setBanks(list)
      if (list[0]) setBankId(list[0].id)
    })
    window.api.chartOfAccounts.list({ isActive: true }).then((res) => { if (res.success && res.data) setAccounts(res.data as Account[]) })
  }, [loadRules])

  const loadLines = useCallback(async () => {
    if (!bankId) { setLines([]); return }
    const res = await window.api.bankRules.suggestions({ bankAccountId: bankId })
    if (res.success && res.data) setLines(res.data as Suggestion[])
  }, [bankId])
  useEffect(() => { loadLines() }, [loadLines, rules])

  async function addRule() {
    setBusy(true)
    try {
      const num = (v: string) => (v.trim() === '' ? null : Number(v))
      const res = await window.api.bankRules.create({
        name: form.name, bankAccountId: form.bankAccountId || null, direction: form.direction as 'DEBIT' | 'CREDIT' | 'ANY',
        contains: form.contains, minAmount: num(form.minAmount), maxAmount: num(form.maxAmount), accountId: form.accountId
      })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('bankRules.couldNot')); return }
      setForm(EMPTY)
      await loadRules()
    } finally { setBusy(false) }
  }

  async function removeRule(id: string) {
    await window.api.bankRules.remove({ id })
    await loadRules()
  }

  async function apply(l: Suggestion) {
    if (!l.rule) return
    const res = await window.api.bankRules.apply({ lineId: l.lineId, ruleId: l.rule.id })
    if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('bankRules.couldNot')); return false }
    return true
  }

  async function applyOne(l: Suggestion) {
    if (await apply(l)) { toastSuccess(t('bankRules.posted'), l.description); await loadLines() }
  }

  async function applyAll() {
    setBusy(true)
    try {
      let done = 0
      for (const l of lines.filter((x) => x.rule)) { if (await apply(l)) done += 1 }
      toastSuccess(t('bankRules.postedMany', { count: done }))
      await loadLines()
    } finally { setBusy(false) }
  }

  const matched = lines.filter((l) => l.rule).length
  const select = 'w-full h-12 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base'

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center"><Wand2 size={18} className="text-brand" /></div>
        <div>
          <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('bankRules.title')}</h1>
          <p className="text-xs text-slate-400">{t('bankRules.subtitle')}</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 dark:bg-slate-950 space-y-6 max-w-5xl">
        {canEdit && (
          <Card padding="md" className="space-y-3">
            <h2 className="font-semibold text-dark dark:text-slate-100">{t('bankRules.newRule')}</h2>
            <p className="text-sm text-slate-500">{t('bankRules.help')}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label={t('bankRules.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label={t('bankRules.contains')} value={form.contains} onChange={(e) => setForm({ ...form, contains: e.target.value })} />
              <label className="block"><span className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('bankRules.direction')}</span>
                <select className={select} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                  <option value="ANY">{t('bankRules.any')}</option><option value="DEBIT">{t('bankRules.moneyOut')}</option><option value="CREDIT">{t('bankRules.moneyIn')}</option>
                </select></label>
              <label className="block"><span className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('bankRules.bank')}</span>
                <select className={select} value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}>
                  <option value="">{t('bankRules.allBanks')}</option>{banks.map((b) => <option key={b.id} value={b.id}>{b.accountName}</option>)}
                </select></label>
              <Input label={t('bankRules.minAmount')} type="number" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} />
              <Input label={t('bankRules.maxAmount')} type="number" value={form.maxAmount} onChange={(e) => setForm({ ...form, maxAmount: e.target.value })} />
              <label className="block sm:col-span-2"><span className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('bankRules.postTo')}</span>
                <select className={select} value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                  <option value="">—</option>{accounts.filter((a) => a.isActive).map((a) => <option key={a.id} value={a.id}>{a.accountCode} {a.accountName}</option>)}
                </select></label>
            </div>
            <Button onClick={addRule} loading={busy} disabled={!form.name.trim() || !form.accountId}>{t('bankRules.add')}</Button>
          </Card>
        )}

        <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
          {rules.length === 0 && <p className="p-5 text-sm text-slate-500">{t('bankRules.none')}</p>}
          {rules.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-dark dark:text-slate-100">{r.name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {t(`bankRules.dir.${r.direction}`)}{r.contains ? ` · “${r.contains}”` : ''}{r.minAmount !== null ? ` · ≥ ${r.minAmount}` : ''}{r.maxAmount !== null ? ` · ≤ ${r.maxAmount}` : ''} → {accounts.find((a) => a.id === r.accountId)?.accountName ?? ''}
                </div>
              </div>
              {canEdit && <button onClick={() => removeRule(r.id)} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-danger"><Trash2 size={16} /></button>}
            </div>
          ))}
        </Card>

        <Card padding="md" className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block w-64"><span className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('bankRules.bank')}</span>
              <select className={select} value={bankId} onChange={(e) => setBankId(e.target.value)}>{banks.map((b) => <option key={b.id} value={b.id}>{b.accountName}</option>)}</select></label>
            {canEdit && <Button onClick={applyAll} loading={busy} disabled={matched === 0}>{t('bankRules.postAll', { count: matched })}</Button>}
          </div>
          <p className="text-xs text-slate-500">{t('bankRules.linesHelp')}</p>
          {lines.length === 0 && <p className="text-sm text-slate-500">{t('bankRules.noLines')}</p>}
          {lines.map((l) => (
            <div key={l.lineId} className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span className="text-xs text-slate-400 w-24 shrink-0">{formatDate(l.date)}</span>
              <span className="flex-1 min-w-0 text-sm text-dark dark:text-slate-100 truncate">{l.description}</span>
              <span className={`text-sm font-semibold ${l.debitAmount > 0 ? 'text-danger' : 'text-success'}`}>{l.debitAmount > 0 ? '−' : '+'}{formatCurrency(l.debitAmount > 0 ? l.debitAmount : l.creditAmount)}</span>
              <span className="w-56 text-xs text-slate-500 truncate">{l.rule ? `${l.rule.name} → ${l.rule.accountName}` : t('bankRules.noRule')}</span>
              {canEdit && l.rule && <Button size="sm" variant="outline" onClick={() => applyOne(l)}>{t('bankRules.post')}</Button>}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
