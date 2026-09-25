import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Landmark, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Modal } from '@shared/ui/molecules/Modal'
import { Badge } from '@shared/ui/atoms/Badge'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate, toLocalISODate } from '@shared/utils/locale.util'
import { sumMoney, roundMoney } from '@money'

interface BankAccount { id: string; accountName: string }
interface GstPayment {
  id: string; entryNumber: string; date: string; narration: string | null
  taxAmount: number; creditUsed: number; cashPaid: number; isReversed: boolean
}
interface NetPayable { output: { total: number }; reverseCharge: { total: number }; inputCredit: { total: number } }

function monthRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: toLocalISODate(first), to: toLocalISODate(last) }
}

export function GstPaymentScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canCreate = hasPermission('journalEntries.create')

  const [rows, setRows] = useState<GstPayment[]>([])
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [voiding, setVoiding] = useState<GstPayment | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, bankRes] = await Promise.all([window.api.gstPayments.list(), window.api.bankAccounts.list()])
      if (listRes.success && listRes.data) setRows(listRes.data as GstPayment[])
      if (bankRes.success && bankRes.data) setBanks(bankRes.data as BankAccount[])
    } catch {
      toastError(t('common.error'), t('accounting.gstPayments.couldNotLoad'))
    } finally { setLoading(false) }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center"><Landmark size={18} className="text-brand" /></div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.gstPayments.title')}</h1>
              <p className="text-xs text-slate-400">{t('accounting.gstPayments.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canCreate && <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowNew(true)}>{t('accounting.gstPayments.newPayment')}</Button>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && rows.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={5} cols={6} /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <Landmark size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('accounting.gstPayments.none')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                <th className="text-start px-6 py-3">{t('common.date')}</th>
                <th className="text-start px-4 py-3">{t('accounting.gstPayments.details')}</th>
                <th className="text-end px-4 py-3">{t('accounting.gstPayments.taxSettled')}</th>
                <th className="text-end px-4 py-3">{t('accounting.gstPayments.creditUsed')}</th>
                <th className="text-end px-4 py-3">{t('accounting.gstPayments.cashPaid')}</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <span className="font-mono text-xs me-2">{r.entryNumber}</span>{r.narration}
                    {r.isReversed && <Badge variant="danger" className="ms-2">{t('accounting.gstPayments.voided')}</Badge>}
                  </td>
                  <td className="px-4 py-3 text-end font-semibold text-dark dark:text-slate-100">{formatCurrency(r.taxAmount)}</td>
                  <td className="px-4 py-3 text-end text-slate-600 dark:text-slate-300">{formatCurrency(r.creditUsed)}</td>
                  <td className="px-4 py-3 text-end text-slate-600 dark:text-slate-300">{formatCurrency(r.cashPaid)}</td>
                  <td className="px-6 py-3 text-end">
                    {canCreate && !r.isReversed && <Button size="sm" variant="ghost" onClick={() => setVoiding(r)}>{t('accounting.gstPayments.void')}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <NewPaymentModal banks={banks} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} />}
      {voiding && <VoidModal payment={voiding} onClose={() => setVoiding(null)} onDone={() => { setVoiding(null); load() }} />}
    </div>
  )
}

function NewPaymentModal({ banks, onClose, onSaved }: { banks: BankAccount[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [date, setDate] = useState(() => toLocalISODate(new Date()))
  const [tax, setTax] = useState('')
  const [credit, setCredit] = useState('')
  const [bankId, setBankId] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [filling, setFilling] = useState(false)

  const taxN = Number(tax) || 0
  const creditN = Number(credit) || 0
  const cashN = Math.max(roundMoney(taxN - creditN, 2), 0)

  async function fillFromMonth() {
    setFilling(true)
    try {
      const { from, to } = monthRange()
      const res = await window.api.reports.gstNetPayable({ dateFrom: from, dateTo: to })
      if (res.success && res.data) {
        const d = res.data as NetPayable
        const due = sumMoney([d.output.total, d.reverseCharge.total], 2)
        setTax(String(due))
        setCredit(String(Math.min(d.inputCredit.total, due)))
      }
    } finally { setFilling(false) }
  }

  async function save() {
    if (taxN <= 0) { toastError(t('common.error'), t('accounting.gstPayments.taxRequired')); return }
    if (creditN > taxN) { toastError(t('common.error'), t('accounting.gstPayments.creditTooMuch')); return }
    setSaving(true)
    try {
      const res = await window.api.gstPayments.record({
        paymentDate: date, taxAmount: taxN, creditUsed: creditN, cashPaid: cashN,
        bankAccountId: bankId || undefined, reference: reference.trim() || undefined, notes: notes.trim() || undefined
      })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.gstPayments.couldNotSave')); return }
      toastSuccess(t('accounting.gstPayments.saved'), formatCurrency(taxN))
      onSaved()
    } catch {
      toastError(t('common.error'), t('accounting.gstPayments.couldNotSave'))
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={t('accounting.gstPayments.newPayment')} size="md">
      <div className="space-y-4">
        <Button variant="secondary" size="sm" onClick={fillFromMonth} loading={filling}>{t('accounting.gstPayments.fillFromMonth')}</Button>
        <Input label={t('common.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label={t('accounting.gstPayments.taxSettled')} type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
        <Input label={t('accounting.gstPayments.creditUsed')} type="number" min="0" step="0.01" value={credit} onChange={(e) => setCredit(e.target.value)} />
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">{t('accounting.gstPayments.cashPaid')}</span>
          <span className="font-semibold text-dark dark:text-slate-100">{formatCurrency(cashN)}</span>
        </div>
        {cashN > 0 && (
          <Select label={t('accounting.gstPayments.paidFrom')} value={bankId} onChange={(e) => setBankId(e.target.value)}>
            <option value="">{t('accounting.gstPayments.cashInHand')}</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.accountName}</option>)}
          </Select>
        )}
        <Input label={t('accounting.gstPayments.reference')} value={reference} onChange={(e) => setReference(e.target.value)} />
        <Input label={t('common.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <p className="text-xs text-slate-400">{t('accounting.gstPayments.accountantNote')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={saving}>{t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  )
}

function VoidModal({ payment, onClose, onDone }: { payment: GstPayment; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function confirm() {
    if (!reason.trim()) { toastError(t('common.error'), t('accounting.gstPayments.reasonRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.gstPayments.void({ id: payment.id, reason: reason.trim() })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.gstPayments.couldNotSave')); return }
      onDone()
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={t('accounting.gstPayments.void')} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">{payment.entryNumber} — {formatCurrency(payment.taxAmount)}</p>
        <Input label={t('accounting.gstPayments.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={confirm} loading={saving}>{t('accounting.gstPayments.void')}</Button>
        </div>
      </div>
    </Modal>
  )
}
