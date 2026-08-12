import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Landmark as ChequeIcon, RefreshCw, Plus, BookOpen } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDateTime } from '@shared/utils/locale.util'

interface Pdc {
  id: string; chequeNumber: string; direction: string; dueDate: string; amount: number
  status: string; remarks: string | null; bankAccountId: string
}
interface BankAccount { id: string; accountName: string; accountType: string }
interface ChequeBook { id: string; bankAccountId: string; startNumber: number; endNumber: number; nextNumber: number; isActive: boolean }

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  PENDING: 'info', DEPOSITED: 'warning', CLEARED: 'success', BOUNCED: 'danger', CANCELLED: 'neutral'
}
const STATUSES = ['PENDING', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED'] as const

// Phase 62 — Post-Dated Cheque tracking.
export function PostDatedChequesScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('postDatedCheques.manage')

  const [cheques, setCheques] = useState<Pdc[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showChequeBooks, setShowChequeBooks] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [chequesRes, accountsRes] = await Promise.all([
        window.api.postDatedCheques.list(statusFilter ? { status: statusFilter } : undefined),
        window.api.bankAccounts.list()
      ])
      if (chequesRes.success && chequesRes.data) setCheques((chequesRes.data as { cheques: Pdc[] }).cheques)
      if (accountsRes.success && accountsRes.data) setBankAccounts(accountsRes.data as BankAccount[])
    } catch {
      toastError(t('common.error'), t('accounting.postDatedCheques.couldNotLoad'))
    } finally { setLoading(false) }
  }, [statusFilter, toastError, t])

  useEffect(() => { load() }, [load])

  async function handleStatusChange(id: string, status: string) {
    try {
      const res = await window.api.postDatedCheques.updateStatus({ id, status })
      if (res.success) { toastSuccess(t('accounting.postDatedCheques.updated'), t('accounting.postDatedCheques.chequeMarked', { status: t(`accounting.postDatedCheques.status.${status}`) })); load() }
      else toastError(t('common.error'), res.error?.message ?? t('accounting.postDatedCheques.couldNotUpdateStatus'))
    } catch {
      toastError(t('common.error'), t('accounting.postDatedCheques.couldNotUpdateStatus'))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <ChequeIcon size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.postDatedCheques.title')}</h1>
              <p className="text-xs text-slate-400">{t('accounting.postDatedCheques.chequesCount', { count: cheques.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && <Button size="sm" variant="secondary" icon={<BookOpen size={14} />} onClick={() => setShowChequeBooks(true)}>{t('accounting.postDatedCheques.chequeBooks')}</Button>}
            {canManage && <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{t('accounting.postDatedCheques.newCheque')}</Button>}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          {['', ...STATUSES].map((s) => (
            <button key={s || 'ALL'} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${statusFilter === s ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand'}`}>
              {s ? t(`accounting.postDatedCheques.status.${s}`) : t('common.all')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && cheques.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={6} cols={6} /></div>
        ) : cheques.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <ChequeIcon size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('accounting.postDatedCheques.noChequesYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.postDatedCheques.colChequeNumber')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.postDatedCheques.colDirection')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.postDatedCheques.colDueDate')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.amount')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cheques.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs font-semibold text-dark dark:text-slate-100">{c.chequeNumber}</td>
                  <td className="px-4 py-3 text-center"><Badge variant={c.direction === 'RECEIVED' ? 'success' : 'info'} size="sm">{c.direction === 'RECEIVED' ? t('accounting.postDatedCheques.received') : t('accounting.postDatedCheques.issued')}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(c.dueDate)}</td>
                  <td className="px-4 py-3 text-end font-semibold text-dark dark:text-slate-100">{formatCurrency(c.amount)}</td>
                  <td className="px-4 py-3 text-center"><Badge variant={STATUS_VARIANT[c.status] ?? 'neutral'} size="sm">{t(`accounting.postDatedCheques.status.${c.status}`)}</Badge></td>
                  <td className="px-4 py-3 text-end">
                    {canManage && c.status === 'PENDING' && (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleStatusChange(c.id, 'DEPOSITED')} className="px-2 py-1 text-[10px] rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand hover:text-brand transition-colors">{t('accounting.postDatedCheques.deposit')}</button>
                        <button onClick={() => handleStatusChange(c.id, 'BOUNCED')} className="px-2 py-1 text-[10px] rounded-lg border border-slate-200 dark:border-slate-700 hover:border-danger hover:text-danger transition-colors">{t('accounting.postDatedCheques.bounce')}</button>
                      </div>
                    )}
                    {canManage && c.status === 'DEPOSITED' && (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleStatusChange(c.id, 'CLEARED')} className="px-2 py-1 text-[10px] rounded-lg border border-success/40 text-success hover:bg-success/5 transition-colors">{t('accounting.postDatedCheques.clear')}</button>
                        <button onClick={() => handleStatusChange(c.id, 'BOUNCED')} className="px-2 py-1 text-[10px] rounded-lg border border-slate-200 dark:border-slate-700 hover:border-danger hover:text-danger transition-colors">{t('accounting.postDatedCheques.bounce')}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreatePdcModal bankAccounts={bankAccounts} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      )}
      {showChequeBooks && (
        <ChequeBooksModal bankAccounts={bankAccounts} onClose={() => setShowChequeBooks(false)} />
      )}
    </div>
  )
}

function ChequeBooksModal({ bankAccounts, onClose }: { bankAccounts: BankAccount[]; onClose: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [books, setBooks] = useState<ChequeBook[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ bankAccountId: '', startNumber: '', endNumber: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.chequeBooks.list()
      if (res.success && res.data) setBooks(res.data as ChequeBook[])
    } catch {
      toastError(t('common.error'), t('accounting.chequeBooks.couldNotLoad'))
    } finally { setLoading(false) }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    const start = parseInt(form.startNumber, 10)
    const end = parseInt(form.endNumber, 10)
    if (!form.bankAccountId || !Number.isFinite(start) || !Number.isFinite(end)) {
      toastError(t('accounting.postDatedCheques.missingFields'), t('accounting.chequeBooks.fieldsRequired')); return
    }
    setSaving(true)
    try {
      const res = await window.api.chequeBooks.create({ bankAccountId: form.bankAccountId, startNumber: start, endNumber: end })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.chequeBooks.couldNotCreate')); return }
      toastSuccess(t('accounting.chequeBooks.created'), `${start}-${end}`)
      setForm({ bankAccountId: '', startNumber: '', endNumber: '' })
      load()
    } catch {
      toastError(t('common.error'), t('accounting.chequeBooks.couldNotCreate'))
    } finally { setSaving(false) }
  }

  async function toggleActive(book: ChequeBook) {
    const res = await window.api.chequeBooks.setActive({ id: book.id, isActive: !book.isActive })
    if (res.success) load()
    else toastError(t('common.error'), res.error?.message ?? t('accounting.chequeBooks.couldNotUpdate'))
  }

  const accountName = (id: string) => bankAccounts.find((a) => a.id === id)?.accountName ?? id

  return (
    <Modal open onClose={onClose} title={t('accounting.chequeBooks.title')} size="md">
      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-3 items-end">
          <div className="col-span-2">
            <Select label={t('accounting.postDatedCheques.bankAccountLabel')} value={form.bankAccountId} onChange={(e) => setForm((f) => ({ ...f, bankAccountId: e.target.value }))}>
              <option value="">{t('accounting.postDatedCheques.selectEllipsis')}</option>
              {bankAccounts.filter((a) => a.accountType === 'BANK').map((a) => <option key={a.id} value={a.id}>{a.accountName}</option>)}
            </Select>
          </div>
          <Input label={t('accounting.chequeBooks.startNumber')} type="number" value={form.startNumber} onChange={(e) => setForm((f) => ({ ...f, startNumber: e.target.value }))} />
          <Input label={t('accounting.chequeBooks.endNumber')} type="number" value={form.endNumber} onChange={(e) => setForm((f) => ({ ...f, endNumber: e.target.value }))} />
        </div>
        <Button size="sm" onClick={handleCreate} loading={saving}>{t('accounting.chequeBooks.addBook')}</Button>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          {loading ? (
            <SkeletonTable rows={2} cols={4} />
          ) : books.length === 0 ? (
            <p className="text-sm text-slate-400">{t('accounting.chequeBooks.noBooksYet')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-start px-2 py-2 text-xs font-semibold text-slate-500 uppercase">{t('accounting.postDatedCheques.bankAccountLabel')}</th>
                  <th className="text-center px-2 py-2 text-xs font-semibold text-slate-500 uppercase">{t('accounting.chequeBooks.range')}</th>
                  <th className="text-center px-2 py-2 text-xs font-semibold text-slate-500 uppercase">{t('accounting.chequeBooks.next')}</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {books.map((b) => (
                  <tr key={b.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-2 py-2">{accountName(b.bankAccountId)}</td>
                    <td className="px-2 py-2 text-center font-mono text-xs">{b.startNumber}-{b.endNumber}</td>
                    <td className="px-2 py-2 text-center font-mono text-xs">{b.nextNumber > b.endNumber ? t('accounting.chequeBooks.exhausted') : b.nextNumber}</td>
                    <td className="px-2 py-2 text-end">
                      <button onClick={() => toggleActive(b)} className="text-xs font-semibold text-brand hover:underline">
                        {b.isActive ? t('accounting.chequeBooks.deactivate') : t('accounting.chequeBooks.activate')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  )
}

function CreatePdcModal({ bankAccounts, onClose, onSaved }: { bankAccounts: BankAccount[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [form, setForm] = useState({ bankAccountId: '', chequeNumber: '', direction: 'RECEIVED', dueDate: '', amount: '', remarks: '' })
  const [useChequeBook, setUseChequeBook] = useState(false)
  const [nextChequeNumber, setNextChequeNumber] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Only relevant for ISSUED cheques — a RECEIVED cheque's number comes from
  // the payer's own cheque book, not ours.
  useEffect(() => {
    setUseChequeBook(false)
    setNextChequeNumber(null)
    if (form.direction !== 'ISSUED' || !form.bankAccountId) return
    window.api.chequeBooks.getNextNumber(form.bankAccountId).then((res) => {
      if (res.success) setNextChequeNumber((res.data as { chequeNumber: string } | null)?.chequeNumber ?? null)
    })
  }, [form.direction, form.bankAccountId])

  async function handleSave() {
    if (!form.bankAccountId || (!useChequeBook && !form.chequeNumber.trim()) || !form.dueDate || !form.amount) {
      toastError(t('accounting.postDatedCheques.missingFields'), t('accounting.postDatedCheques.fieldsRequired')); return
    }
    setSaving(true)
    try {
      const res = await window.api.postDatedCheques.create({
        bankAccountId: form.bankAccountId,
        chequeNumber: useChequeBook ? undefined : form.chequeNumber.trim(),
        useChequeBook: useChequeBook || undefined,
        direction: form.direction,
        dueDate: form.dueDate, amount: parseFloat(form.amount), remarks: form.remarks.trim() || undefined
      })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.postDatedCheques.couldNotCreate')); return }
      toastSuccess(t('accounting.postDatedCheques.chequeRecorded'), useChequeBook ? String((res.data as { chequeNumber: string })?.chequeNumber ?? '') : form.chequeNumber.trim())
      onSaved()
    } catch {
      toastError(t('common.error'), t('accounting.postDatedCheques.couldNotCreate'))
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={t('accounting.postDatedCheques.newCheque')} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} loading={saving}>{t('common.create')}</Button>
      </>}
    >
      <div className="space-y-4">
        <Select label={t('accounting.postDatedCheques.bankAccountLabel')} value={form.bankAccountId} onChange={(e) => setForm((f) => ({ ...f, bankAccountId: e.target.value }))}>
          <option value="">{t('accounting.postDatedCheques.selectEllipsis')}</option>
          {bankAccounts.filter((a) => a.accountType === 'BANK').map((a) => <option key={a.id} value={a.id}>{a.accountName}</option>)}
        </Select>
        <Select label={t('accounting.postDatedCheques.directionLabel')} value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}>
          <option value="RECEIVED">{t('accounting.postDatedCheques.receivedFromCustomer')}</option>
          <option value="ISSUED">{t('accounting.postDatedCheques.issuedToSupplier')}</option>
        </Select>
        {form.direction === 'ISSUED' && nextChequeNumber && (
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={useChequeBook} onChange={(e) => setUseChequeBook(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand" />
            {t('accounting.chequeBooks.useNextNumber', { number: nextChequeNumber })}
          </label>
        )}
        {!useChequeBook && (
          <Input label={t('accounting.postDatedCheques.chequeNumberLabel')} value={form.chequeNumber} onChange={(e) => setForm((f) => ({ ...f, chequeNumber: e.target.value }))} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('accounting.postDatedCheques.colDueDate')}</label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <Input label={t('common.amount')} type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        </div>
        <Input label={t('accounting.postDatedCheques.remarksLabel')} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder={t('common.optional')} />
      </div>
    </Modal>
  )
}
