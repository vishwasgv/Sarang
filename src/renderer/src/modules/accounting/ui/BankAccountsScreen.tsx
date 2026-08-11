import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Wallet, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatCurrency } from '@shared/utils/currency.util'

interface BankAccount {
  id: string; accountName: string; accountType: string; bankName: string | null
  accountNumberMasked: string | null; currentBalance: number; isActive: boolean
}

// Phase 62 — Bank & Cash Accounts.
export function BankAccountsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('bankAccounts.manage')

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.bankAccounts.list()
      if (res.success && res.data) setAccounts(res.data as BankAccount[])
      else toastError(t('common.error'), res.error?.message ?? t('accounting.bankAccounts.couldNotLoad'))
    } catch {
      toastError(t('common.error'), t('accounting.bankAccounts.couldNotLoad'))
    } finally { setLoading(false) }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <Wallet size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.bankAccounts.title')}</h1>
              <p className="text-xs text-slate-400">{t('accounting.bankAccounts.accountsCount', { count: accounts.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{t('accounting.bankAccounts.newAccount')}</Button>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950 p-6">
        {loading && accounts.length === 0 ? (
          <SkeletonTable rows={4} cols={4} />
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <Wallet size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('accounting.bankAccounts.noAccountsYet')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <Card key={acc.id} padding="lg" className="space-y-3 cursor-pointer hover:border-brand/40 transition-colors" onClick={() => navigate(`/accounting/bank-accounts/${acc.id}`)}>
                <div className="flex items-center justify-between">
                  <Badge variant={acc.accountType === 'BANK' ? 'info' : 'success'} size="sm">{acc.accountType === 'BANK' ? t('accounting.bankAccounts.typeBank') : t('accounting.bankAccounts.typeCash')}</Badge>
                  {!acc.isActive && <Badge variant="neutral" size="sm">{t('common.inactive')}</Badge>}
                </div>
                <div>
                  <p className="font-semibold text-dark dark:text-slate-100">{acc.accountName}</p>
                  {acc.bankName && <p className="text-xs text-slate-400">{acc.bankName}{acc.accountNumberMasked ? ` · ${acc.accountNumberMasked}` : ''}</p>}
                </div>
                <p className="text-2xl font-bold text-brand">{formatCurrency(acc.currentBalance)}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateBankAccountModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      )}
    </div>
  )
}

function CreateBankAccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [form, setForm] = useState({ accountName: '', accountType: 'BANK', bankName: '', accountNumberMasked: '', ifscCode: '', openingBalance: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.accountName.trim()) { toastError(t('accounting.bankAccounts.missingField'), t('accounting.bankAccounts.nameRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.bankAccounts.create({
        accountName: form.accountName.trim(),
        accountType: form.accountType,
        bankName: form.bankName.trim() || undefined,
        accountNumberMasked: form.accountNumberMasked.trim() || undefined,
        ifscCode: form.ifscCode.trim() || undefined,
        openingBalance: parseFloat(form.openingBalance) || 0
      })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.bankAccounts.couldNotCreate')); return }
      toastSuccess(t('accounting.bankAccounts.accountCreated'), form.accountName.trim())
      onSaved()
    } catch {
      toastError(t('common.error'), t('accounting.bankAccounts.couldNotCreate'))
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={t('accounting.bankAccounts.newBankCashAccount')} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} loading={saving}>{t('common.create')}</Button>
      </>}
    >
      <div className="space-y-4">
        <Select label={t('accounting.bankAccounts.typeLabel')} value={form.accountType} onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value }))}>
          <option value="BANK">{t('accounting.bankAccounts.typeBank')}</option>
          <option value="CASH">{t('accounting.bankAccounts.typeCash')}</option>
        </Select>
        <Input label={t('accounting.bankAccounts.accountNameLabel')} value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} placeholder={t('accounting.bankAccounts.accountNamePlaceholder')} />
        {form.accountType === 'BANK' && (
          <>
            <Input label={t('accounting.bankAccounts.bankNameLabel')} value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} placeholder={t('common.optional')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('accounting.bankAccounts.accountNumberLabel')} value={form.accountNumberMasked} onChange={(e) => setForm((f) => ({ ...f, accountNumberMasked: e.target.value }))} placeholder={t('accounting.bankAccounts.accountNumberPlaceholder')} />
              <Input label={t('accounting.bankAccounts.ifscLabel')} value={form.ifscCode} onChange={(e) => setForm((f) => ({ ...f, ifscCode: e.target.value }))} placeholder={t('common.optional')} />
            </div>
          </>
        )}
        <Input label={t('accounting.bankAccounts.openingBalanceLabel')} type="number" value={form.openingBalance} onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} placeholder="0" />
      </div>
    </Modal>
  )
}
