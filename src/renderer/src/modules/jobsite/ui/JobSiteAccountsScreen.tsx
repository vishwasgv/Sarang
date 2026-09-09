import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { HardHat, Plus, RefreshCw, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'

interface JobSiteAccount {
  id: string
  accountName: string
  contractorId: string
  siteAddress: string | null
  status: string
  notes: string | null
  createdAt: string
  contractor: { id: string; customerName: string; phone: string | null }
}

interface JobSiteAccountBalance {
  account: JobSiteAccount
  invoices: Array<{ id: string; invoiceNumber: string; totalAmount: number; balanceAmount: number; createdAt: string }>
  totalBilled: number
  totalOutstanding: number
}

export function JobSiteAccountsScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('jobSiteAccount.manage')

  const [accounts, setAccounts] = useState<JobSiteAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [contractor, setContractor] = useState<CustomerLite | null>(null)
  const [siteAddress, setSiteAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [balances, setBalances] = useState<Record<string, JobSiteAccountBalance>>({})
  const [closingId, setClosingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.jobSiteAccount.list()
      if (res.success) setAccounts((res.data as JobSiteAccount[]) ?? [])
      else toastError(t('common.error'), res.error?.message ?? t('jobsite.accounts.couldNotLoad'))
    } catch {
      toastError(t('common.error'), t('jobsite.accounts.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { void load() }, [load])

  function resetForm() {
    setAccountName('')
    setContractor(null)
    setSiteAddress('')
    setNotes('')
    setError('')
  }

  async function handleCreate() {
    setError('')
    if (!accountName.trim()) { setError(t('jobsite.accounts.accountNameRequired')); return }
    if (!contractor) { setError(t('jobsite.accounts.selectContractor')); return }
    setSaving(true)
    try {
      const res = await window.api.jobSiteAccount.create({
        accountName: accountName.trim(),
        contractorId: contractor.id,
        siteAddress: siteAddress.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      if (res.success) {
        toastSuccess(t('jobsite.accounts.accountCreatedTitle'), accountName.trim())
        setShowForm(false)
        resetForm()
        await load()
      } else {
        setError(res.error?.message ?? t('jobsite.accounts.couldNotCreateAccount'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!balances[id]) {
      const res = await window.api.jobSiteAccount.balance({ id })
      if (res.success) setBalances((prev) => ({ ...prev, [id]: res.data as JobSiteAccountBalance }))
      else toastError(t('common.error'), res.error?.message ?? t('jobsite.accounts.couldNotLoadBalance'))
    }
  }

  async function handleClose(id: string) {
    setClosingId(id)
    try {
      const res = await window.api.jobSiteAccount.close({ id })
      if (res.success) { toastSuccess(t('jobsite.accounts.accountClosedTitle'), ''); await load() }
      else toastError(t('common.error'), res.error?.message ?? t('jobsite.accounts.couldNotCloseAccount'))
    } finally {
      setClosingId(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><HardHat size={20} /> {t('jobsite.accounts.title')}</h2>
          <p className="text-sm text-slate-400">{t('jobsite.accounts.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('common.refresh')}
          </button>
          {canManage && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>{t('jobsite.accounts.newAccount')}</Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('jobsite.accounts.accountNameLabel')} placeholder={t('jobsite.accounts.accountNamePlaceholder')} value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            <CustomerPicker value={contractor} onChange={setContractor} label={t('jobsite.accounts.contractorLabel')} />
          </div>
          <Input label={t('jobsite.accounts.siteAddress')} value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
          <Input label={t('common.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={() => void handleCreate()} loading={saving}>{t('common.create')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('common.loading')}</div>
      ) : accounts.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <HardHat size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('jobsite.accounts.empty')}</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {accounts.map((a) => {
              const bal = balances[a.id]
              const isOpen = expandedId === a.id
              return (
                <div key={a.id}>
                  <button onClick={() => void toggleExpand(a.id)} className="w-full text-start px-5 py-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{a.accountName}</span>
                        <Badge variant={a.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">{a.status}</Badge>
                      </div>
                      <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{a.contractor.customerName}{a.siteAddress ? ` — ${a.siteAddress}` : ''}</div>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0 mt-1" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0 mt-1" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4">
                      {!bal ? (
                        <p className="text-xs text-slate-400">{t('jobsite.accounts.loadingBalance')}</p>
                      ) : (
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-slate-500">{t('jobsite.accounts.totalBilled')} <span className="font-semibold text-dark dark:text-slate-100">{formatCurrency(bal.totalBilled)}</span></span>
                            <span className="text-slate-500">{t('jobsite.accounts.outstanding')} <span className="font-semibold text-danger">{formatCurrency(bal.totalOutstanding)}</span></span>
                          </div>
                          {bal.invoices.length === 0 ? (
                            <p className="text-xs text-slate-400">{t('jobsite.accounts.noInvoicesTagged')}</p>
                          ) : (
                            <div className="space-y-1">
                              {bal.invoices.map((inv) => (
                                <div key={inv.id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                  <span>{inv.invoiceNumber} — {new Date(inv.createdAt).toLocaleDateString()}</span>
                                  <span>{t('jobsite.accounts.invoiceAmountWithBalance', { amount: formatCurrency(inv.totalAmount), balance: formatCurrency(inv.balanceAmount) })}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {canManage && a.status === 'ACTIVE' && bal.totalOutstanding === 0 && (
                            <button onClick={() => void handleClose(a.id)} disabled={closingId === a.id} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 flex items-center gap-1 font-medium dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                              <Lock size={12} /> {closingId === a.id ? t('jobsite.accounts.closing') : t('jobsite.accounts.closeAccount')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
