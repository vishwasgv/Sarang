import React, { useEffect, useState, useCallback } from 'react'
import { Plus, MinusCircle, RefreshCw, Trash2, Edit2, Printer, Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { cn } from '@shared/utils/cn'
import { formatDate } from '@shared/utils/locale.util'
import { Button } from '@shared/ui/atoms/Button'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { Card } from '@shared/ui/molecules/Card'
import { Select } from '@shared/ui/atoms/Select'

interface CreditNote {
  id: string; creditNoteNumber: string; reason: string; amount: number; notes?: string | null
  createdAt: string; customer?: { id: string; customerName: string } | null
  invoice?: { id: string; invoiceNumber: string } | null
}

interface Customer { id: string; customerName: string }
interface Invoice { id: string; invoiceNumber: string }

function fmtMoney(n: number, sym: string) { return `${sym}${n.toFixed(2)}` }

export function CreditNotesScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const hasPermission = useAuthStore(s => s.hasPermission)
  const sym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<CreditNote | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CreditNote | null>(null)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])

  const [form, setForm] = useState({ customerId: '', invoiceId: '', reason: '', amount: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.creditNotes.list()
      if (res.success) setCreditNotes((res.data as { creditNotes: CreditNote[] }).creditNotes ?? [])
      else toastError((res.error as { message: string })?.message ?? t('creditNotes.failed'))
    } catch {
      toastError(t('creditNotes.failed'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!showForm) return
    // The bounded/recency-ordered fetch may not include the note-being-edited's
    // linked customer/invoice (e.g. an older invoice past the 100-row limit) — merge
    // it back in after the fetch so the select always has the current value to show,
    // rather than silently dropping it (which risks the user unintentionally
    // clearing or reassigning the link on save).
    window.api.customers.list({}).then(r => {
      if (!r.success) { toastError((r.error as { message: string })?.message ?? t('creditNotes.failed')); return }
      const fetched = (r.data as { customers: Customer[] }).customers ?? []
      const linked = editTarget?.customer
      setCustomers(linked && !fetched.some((c) => c.id === linked.id) ? [...fetched, linked] : fetched)
    }).catch(() => toastError(t('creditNotes.failed')))
    window.api.billing.listInvoices({ limit: 100 }).then(r => {
      if (!r.success) { toastError((r.error as { message: string })?.message ?? t('creditNotes.failed')); return }
      const fetched = (r.data as { invoices: Invoice[] }).invoices ?? []
      const linked = editTarget?.invoice
      setInvoices(linked && !fetched.some((i) => i.id === linked.id) ? [...fetched, linked] : fetched)
    }).catch(() => toastError(t('creditNotes.failed')))
  }, [showForm, editTarget, toastError, t])

  function startEdit(cn: CreditNote) {
    setEditTarget(cn)
    setForm({
      customerId: cn.customer?.id ?? '',
      invoiceId: cn.invoice?.id ?? '',
      reason: cn.reason,
      amount: String(cn.amount),
      notes: cn.notes ?? ''
    })
    // customers/invoices dropdown lists get the linked record merged in by the
    // fetch effect below (keyed on editTarget) — no need to do it here too.
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditTarget(null)
    setForm({ customerId: '', invoiceId: '', reason: '', amount: '', notes: '' })
  }

  async function handleSave() {
    if (!form.reason.trim() || !form.amount) { toastError(t('creditNotes.reasonAmountRequired')); return }
    setSaving(true)
    try {
      // On update, an empty selection must send `null` (explicitly clear the field),
      // not `undefined` (service-layer semantics: "leave unchanged") — this form
      // always shows and resubmits the complete intended state, never a partial
      // patch, so there's no legitimate "leave unchanged" case here. Using `undefined`
      // meant picking "N/A" to detach a customer/invoice silently did nothing.
      const res = editTarget
        ? await window.api.creditNotes.update({
            id: editTarget.id,
            customerId: form.customerId || null,
            invoiceId: form.invoiceId || null,
            reason: form.reason,
            amount: parseFloat(form.amount),
            notes: form.notes || null
          })
        : await window.api.creditNotes.create({
            customerId: form.customerId || undefined,
            invoiceId: form.invoiceId || undefined,
            reason: form.reason,
            amount: parseFloat(form.amount),
            notes: form.notes || undefined
          })
      if (res.success) {
        toastSuccess(t(editTarget ? 'creditNotes.updated' : 'creditNotes.created'))
        closeForm()
        loadData()
      } else {
        toastError((res.error as { message: string })?.message ?? t('creditNotes.failed'))
      }
    } catch {
      toastError(t('creditNotes.failed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const res = await window.api.creditNotes.delete(deleteTarget.id)
      if (res.success) { toastSuccess(t('creditNotes.deleted')); loadData() }
      else toastError((res.error as { message: string })?.message ?? t('creditNotes.failed'))
    } catch {
      toastError(t('creditNotes.failed'))
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handlePrint(cn: CreditNote) {
    setPrintingId(cn.id)
    try {
      const res = await window.api.creditNotes.print(cn.id)
      if (!res.success) toastError((res.error as { message: string })?.message ?? t('creditNotes.printFailed'))
    } catch {
      toastError(t('creditNotes.printFailed'))
    } finally {
      setPrintingId(null)
    }
  }

  // Fresh-audit fix (2026-07-12): explicit thermal override — Credit Note
  // previously had no way to print at receipt width at all.
  async function handlePrintReceipt(cn: CreditNote) {
    setPrintingId(cn.id)
    try {
      const res = await window.api.creditNotes.printReceipt({ id: cn.id })
      if (!res.success) toastError((res.error as { message: string })?.message ?? t('creditNotes.printFailed'))
    } catch {
      toastError(t('creditNotes.printFailed'))
    } finally {
      setPrintingId(null)
    }
  }

  const canCreate = hasPermission('billing.create')
  const canVoid = hasPermission('billing.void')
  const canPrint = hasPermission('billing.printInvoice')

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
            <MinusCircle size={20} className="text-warning" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('creditNotes.title')}</h1>
            <p className="text-sm text-slate-500">{t('creditNotes.count', { count: creditNotes.length })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 hover:border-brand hover:text-brand transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
          </button>
          {canCreate && (
            <Button size="md" onClick={() => { setEditTarget(null); setShowForm(true) }}>
              <Plus size={16} className="mr-1.5" /> {t('creditNotes.newCreditNote')}
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <Card padding="lg" className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{editTarget ? t('creditNotes.editCreditNote') : t('creditNotes.newCreditNote')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('billing.customer')} value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
              <option value="">{t('common.na')}</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
            </Select>
            <Select label={t('creditNotes.againstInvoice')} value={form.invoiceId} onChange={e => setForm(f => ({ ...f, invoiceId: e.target.value }))}>
              <option value="">{t('common.na')}</option>
              {invoices.map(i => <option key={i.id} value={i.id}>{i.invoiceNumber}</option>)}
            </Select>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('creditNotes.reasonLabel')}</label>
              <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder={t('creditNotes.reasonPlaceholder')}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('creditNotes.amountLabel')}</label>
              <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('common.notes')}</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={t('common.optional')}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={closeForm}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleSave} loading={saving}>{editTarget ? t('creditNotes.updateCreditNote') : t('creditNotes.saveCreditNote')}</Button>
          </div>
        </Card>
      )}

      {!loading && creditNotes.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <MinusCircle size={48} className="opacity-30" />
          <p className="text-base">{t('creditNotes.noCreditNotes')}</p>
        </div>
      ) : (
        <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
          {creditNotes.map(cn => (
            <div key={cn.id} className="flex items-center gap-4 px-5 py-3.5 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-dark dark:text-slate-100">{cn.creditNoteNumber}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {cn.customer?.customerName ?? t('creditNotes.noCustomer')} • {cn.reason} • {formatDate(cn.createdAt)}
                  {cn.invoice && ` • ${t('creditNotes.refInvoice', { number: cn.invoice.invoiceNumber })}`}
                </p>
              </div>
              <p className="text-sm font-bold text-warning shrink-0">{fmtMoney(cn.amount, sym)}</p>
              {canPrint && (
                <>
                  <button onClick={() => handlePrint(cn)} disabled={printingId === cn.id} title="Print (A4)"
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand transition-all disabled:opacity-30">
                    <Printer size={15} />
                  </button>
                  <button onClick={() => handlePrintReceipt(cn)} disabled={printingId === cn.id} title="Print Receipt (Thermal)"
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand transition-all disabled:opacity-30">
                    <Receipt size={15} />
                  </button>
                </>
              )}
              {canCreate && (
                <button onClick={() => startEdit(cn)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand transition-all">
                  <Edit2 size={15} />
                </button>
              )}
              {canVoid && (
                <button onClick={() => setDeleteTarget(cn)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-danger transition-all">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('creditNotes.deleteTitle')}
        message={t('creditNotes.deleteMsg', { number: deleteTarget?.creditNoteNumber })}
        confirmLabel={t('common.delete')}
        confirmVariant="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
