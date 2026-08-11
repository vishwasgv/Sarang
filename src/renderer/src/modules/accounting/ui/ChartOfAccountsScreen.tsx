import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Landmark, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

interface Account {
  id: string; accountCode: string; accountName: string; accountType: string
  parentId: string | null; isSystem: boolean; isActive: boolean
}

const TYPE_VARIANT: Record<string, 'success' | 'danger' | 'info' | 'brand' | 'neutral'> = {
  ASSET: 'success', LIABILITY: 'danger', EQUITY: 'brand', INCOME: 'info', EXPENSE: 'neutral'
}
const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']

// Phase 62 — Chart of Accounts.
export function ChartOfAccountsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('chartOfAccounts.manage')

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.chartOfAccounts.list(typeFilter ? { accountType: typeFilter } : undefined)
      if (res.success && res.data) setAccounts(res.data as Account[])
      else toastError(t('common.error'), res.error?.message ?? t('accounting.chartOfAccounts.couldNotLoad'))
    } catch {
      toastError(t('common.error'), t('accounting.chartOfAccounts.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [typeFilter, toastError, t])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <Landmark size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.chartOfAccounts.title')}</h1>
              <p className="text-xs text-slate-400">{t('accounting.chartOfAccounts.accountsCount', { count: accounts.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{t('accounting.chartOfAccounts.newAccount')}</Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          {['', ...ACCOUNT_TYPES].map((type) => (
            <button
              key={type || 'ALL'}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${typeFilter === type ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand'}`}
            >
              {type || t('common.all')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && accounts.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={8} cols={5} /></div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <Landmark size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('accounting.chartOfAccounts.noAccountsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.chartOfAccounts.colCode')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.chartOfAccounts.colName')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.chartOfAccounts.colType')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.chartOfAccounts.colSource')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.chartOfAccounts.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{a.accountCode}</td>
                  <td className="px-4 py-3 font-semibold text-dark dark:text-slate-100">{a.accountName}</td>
                  <td className="px-4 py-3 text-center"><Badge variant={TYPE_VARIANT[a.accountType] ?? 'neutral'} size="sm">{a.accountType}</Badge></td>
                  <td className="px-4 py-3 text-center text-xs text-slate-400">{a.isSystem ? t('accounting.chartOfAccounts.system') : t('accounting.chartOfAccounts.custom')}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={a.isActive ? 'success' : 'neutral'} size="sm">{a.isActive ? t('common.active') : t('common.inactive')}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateAccountModal
          accounts={accounts}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}

function CreateAccountModal({ accounts, onClose, onSaved }: { accounts: Account[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [accountCode, setAccountCode] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState('ASSET')
  const [parentId, setParentId] = useState('')
  const [saving, setSaving] = useState(false)

  const eligibleParents = accounts.filter((a) => a.accountType === accountType)

  async function handleSave() {
    if (!accountCode.trim() || !accountName.trim()) { toastError(t('accounting.chartOfAccounts.missingFields'), t('accounting.chartOfAccounts.codeNameRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.chartOfAccounts.create({
        accountCode: accountCode.trim(), accountName: accountName.trim(), accountType,
        parentId: parentId || undefined
      })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.chartOfAccounts.couldNotCreate')); return }
      toastSuccess(t('accounting.chartOfAccounts.accountCreated'), accountName.trim())
      onSaved()
    } catch {
      toastError(t('common.error'), t('accounting.chartOfAccounts.couldNotCreate'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('accounting.chartOfAccounts.newAccount')} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} loading={saving}>{t('common.create')}</Button>
      </>}
    >
      <div className="space-y-4">
        <Input label={t('accounting.chartOfAccounts.accountCodeLabel')} value={accountCode} onChange={(e) => setAccountCode(e.target.value)} placeholder={t('accounting.chartOfAccounts.accountCodePlaceholder')} />
        <Input label={t('accounting.chartOfAccounts.accountNameLabel')} value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder={t('accounting.chartOfAccounts.accountNamePlaceholder')} />
        <Select label={t('accounting.chartOfAccounts.typeLabel')} value={accountType} onChange={(e) => { setAccountType(e.target.value); setParentId('') }}>
          {ACCOUNT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </Select>
        <Select label={t('accounting.chartOfAccounts.parentAccountLabel')} value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">{t('accounting.chartOfAccounts.noneTopLevel')}</option>
          {eligibleParents.map((a) => <option key={a.id} value={a.id}>{a.accountCode} — {a.accountName}</option>)}
        </Select>
      </div>
    </Modal>
  )
}
