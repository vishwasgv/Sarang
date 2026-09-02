import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Wallet as DepositIcon, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Modal } from '@shared/ui/molecules/Modal'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDateTime } from '@shared/utils/locale.util'

interface BankAccount { id: string; accountName: string; accountType: string }
interface AvailableCheque { id: string; chequeNumber: string; amount: number; partyType: string | null }
interface Deposit {
  id: string; depositNumber: string; bankAccountId: string; bankAccountName: string
  depositDate: string; cashTotal: number; chequeTotal: number; totalAmount: number
  cheques: { id: string; chequeNumber: string; amount: number }[]
}

const DENOMINATIONS = ['500', '200', '100', '50', '20', '10', '5', '2', '1'] as const

// 2026-09-02 — Bank Deposit Slips: cash/cheque deposit-slip generation from
// note denominations. Closes the twin item to Cheque Books (built 2026-08-12)
// named in the same audit finding.
export function BankDepositScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('bankAccounts.manage')

  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [viewDeposit, setViewDeposit] = useState<Deposit | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [depositsRes, accountsRes] = await Promise.all([
        window.api.bankDeposits.list(),
        window.api.bankAccounts.list()
      ])
      if (depositsRes.success && depositsRes.data) setDeposits((depositsRes.data as { deposits: Deposit[] }).deposits)
      if (accountsRes.success && accountsRes.data) setBankAccounts(accountsRes.data as BankAccount[])
    } catch {
      toastError(t('common.error'), t('accounting.bankDeposits.couldNotLoad'))
    } finally { setLoading(false) }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <DepositIcon size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.bankDeposits.title')}</h1>
              <p className="text-xs text-slate-400">{t('accounting.bankDeposits.depositsCount', { count: deposits.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{t('accounting.bankDeposits.newDeposit')}</Button>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && deposits.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={6} cols={6} /></div>
        ) : deposits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <DepositIcon size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('accounting.bankDeposits.noDepositsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.bankDeposits.colDepositNumber')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.postDatedCheques.bankAccountLabel')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.bankDeposits.colDate')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.bankDeposits.colCash')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.bankDeposits.colCheques')}</th>
                <th className="text-end px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id} onClick={() => setViewDeposit(d)} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                  <td className="px-6 py-3 font-mono text-xs font-semibold text-dark dark:text-slate-100">{d.depositNumber}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{d.bankAccountName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(d.depositDate)}</td>
                  <td className="px-4 py-3 text-end text-slate-600 dark:text-slate-300">{formatCurrency(d.cashTotal)}</td>
                  <td className="px-4 py-3 text-end text-slate-600 dark:text-slate-300">{formatCurrency(d.chequeTotal)}</td>
                  <td className="px-6 py-3 text-end font-semibold text-dark dark:text-slate-100">{formatCurrency(d.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateDepositModal bankAccounts={bankAccounts} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      )}
      {viewDeposit && (
        <ViewDepositModal deposit={viewDeposit} onClose={() => setViewDeposit(null)} />
      )}
    </div>
  )
}

function CreateDepositModal({ bankAccounts, onClose, onSaved }: { bankAccounts: BankAccount[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [bankAccountId, setBankAccountId] = useState('')
  const [depositDate, setDepositDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [availableCheques, setAvailableCheques] = useState<AvailableCheque[]>([])
  const [selectedChequeIds, setSelectedChequeIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelectedChequeIds([])
    if (!bankAccountId) { setAvailableCheques([]); return }
    window.api.bankDeposits.listAvailableCheques({ bankAccountId }).then((res) => {
      if (res.success && res.data) setAvailableCheques(res.data as AvailableCheque[])
    })
  }, [bankAccountId])

  const cashTotal = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + Number(d) * (parseInt(counts[d], 10) || 0), 0),
    [counts]
  )
  const chequeTotal = useMemo(
    () => availableCheques.filter((c) => selectedChequeIds.includes(c.id)).reduce((sum, c) => sum + c.amount, 0),
    [availableCheques, selectedChequeIds]
  )

  function toggleCheque(id: string) {
    setSelectedChequeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  async function handleSave() {
    if (!bankAccountId) { toastError(t('accounting.postDatedCheques.missingFields'), t('accounting.bankDeposits.selectAccount')); return }
    if (cashTotal <= 0 && selectedChequeIds.length === 0) { toastError(t('accounting.postDatedCheques.missingFields'), t('accounting.bankDeposits.needsCashOrCheques')); return }
    setSaving(true)
    try {
      const denominations: Record<string, number> = {}
      for (const d of DENOMINATIONS) { const n = parseInt(counts[d], 10); if (n > 0) denominations[d] = n }
      const res = await window.api.bankDeposits.create({
        bankAccountId, depositDate, denominations,
        chequeIds: selectedChequeIds.length > 0 ? selectedChequeIds : undefined,
        notes: notes.trim() || undefined
      })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.bankDeposits.couldNotCreate')); return }
      toastSuccess(t('accounting.bankDeposits.created'), formatCurrency(cashTotal + chequeTotal))
      onSaved()
    } catch {
      toastError(t('common.error'), t('accounting.bankDeposits.couldNotCreate'))
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={t('accounting.bankDeposits.newDeposit')} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('accounting.postDatedCheques.bankAccountLabel')} value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
            <option value="">{t('accounting.postDatedCheques.selectEllipsis')}</option>
            {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.accountName}</option>)}
          </Select>
          <Input label={t('accounting.bankDeposits.colDate')} type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('accounting.bankDeposits.denominationsLabel')}</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {DENOMINATIONS.map((d) => (
              <Input key={d} label={`₹${d}`} type="number" min="0" value={counts[d] ?? ''} onChange={(e) => setCounts((c) => ({ ...c, [d]: e.target.value }))} />
            ))}
          </div>
          <p className="text-end text-sm font-semibold text-dark dark:text-slate-100 mt-2">{t('accounting.bankDeposits.cashSubtotal')}: {formatCurrency(cashTotal)}</p>
        </div>

        {availableCheques.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('accounting.bankDeposits.includeCheques')}</p>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 max-h-40 overflow-y-auto">
              {availableCheques.map((c) => (
                <label key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={selectedChequeIds.includes(c.id)} onChange={() => toggleCheque(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand" />
                    <span className="font-mono text-xs">{c.chequeNumber}</span>
                  </span>
                  <span className="font-semibold">{formatCurrency(c.amount)}</span>
                </label>
              ))}
            </div>
            <p className="text-end text-sm font-semibold text-dark dark:text-slate-100 mt-2">{t('accounting.bankDeposits.chequeSubtotal')}: {formatCurrency(chequeTotal)}</p>
          </div>
        )}

        <Input label={t('common.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-base font-bold text-dark dark:text-slate-100">{t('common.total')}: {formatCurrency(cashTotal + chequeTotal)}</p>
          <Button onClick={handleSave} loading={saving}>{t('accounting.bankDeposits.newDeposit')}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ViewDepositModal({ deposit, onClose }: { deposit: Deposit; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal open onClose={onClose} title={deposit.depositNumber} size="md">
      <div className="space-y-4 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">{t('accounting.postDatedCheques.bankAccountLabel')}</span><span className="font-semibold">{deposit.bankAccountName}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">{t('accounting.bankDeposits.colDate')}</span><span className="font-semibold">{formatDateTime(deposit.depositDate)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">{t('accounting.bankDeposits.cashSubtotal')}</span><span className="font-semibold">{formatCurrency(deposit.cashTotal)}</span></div>
        {deposit.cheques.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{t('accounting.bankDeposits.includeCheques')}</p>
            {deposit.cheques.map((c) => (
              <div key={c.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span className="font-mono">{c.chequeNumber}</span><span>{formatCurrency(c.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-base font-bold text-dark dark:text-slate-100">
          <span>{t('common.total')}</span><span>{formatCurrency(deposit.totalAmount)}</span>
        </div>
      </div>
    </Modal>
  )
}
