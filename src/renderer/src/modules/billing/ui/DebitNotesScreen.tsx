import React, { useEffect, useState, useCallback } from 'react'
import { PlusCircle, RefreshCw, Trash2, Edit2, Printer, Receipt } from 'lucide-react'
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

interface DebitNote {
  id: string; debitNoteNumber: string; reason: string; amount: number; notes?: string | null
  createdAt: string; supplier?: { id: string; supplierName: string } | null
  purchaseOrder?: { id: string; poNumber: string } | null
}

interface Supplier { id: string; supplierName: string }
interface PurchaseOrder { id: string; poNumber: string }

function fmtMoney(n: number, sym: string) { return `${sym}${n.toFixed(2)}` }

export function DebitNotesScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const hasPermission = useAuthStore(s => s.hasPermission)
  const sym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')

  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<DebitNote | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DebitNote | null>(null)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])

  const [form, setForm] = useState({ supplierId: '', purchaseOrderId: '', reason: '', amount: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.debitNotes.list()
      if (res.success) setDebitNotes((res.data as { debitNotes: DebitNote[] }).debitNotes ?? [])
      else toastError((res.error as { message: string })?.message ?? t('debitNotes.failed'))
    } catch {
      toastError(t('debitNotes.failed'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!showForm) return
    // The bounded/recency-ordered fetch may not include the note-being-edited's
    // linked supplier/PO (e.g. an older PO past the default 20-row limit) — merge
    // it back in after the fetch so the select always has the current value to
    // show, rather than silently dropping it (which risks the user unintentionally
    // clearing or reassigning the link on save).
    window.api.suppliers.list({}).then(r => {
      if (!r.success) { toastError((r.error as { message: string })?.message ?? t('debitNotes.failed')); return }
      const fetched = (r.data as { suppliers: Supplier[] }).suppliers ?? []
      const linked = editTarget?.supplier
      setSuppliers(linked && !fetched.some((s) => s.id === linked.id) ? [...fetched, linked] : fetched)
    }).catch(() => toastError(t('debitNotes.failed')))
    window.api.purchaseOrders.list({}).then(r => {
      if (!r.success) { toastError((r.error as { message: string })?.message ?? t('debitNotes.failed')); return }
      const fetched = (r.data as { purchaseOrders: PurchaseOrder[] }).purchaseOrders ?? []
      const linked = editTarget?.purchaseOrder
      setPurchaseOrders(linked && !fetched.some((p) => p.id === linked.id) ? [...fetched, linked] : fetched)
    }).catch(() => toastError(t('debitNotes.failed')))
  }, [showForm, editTarget, toastError, t])

  function startEdit(dn: DebitNote) {
    setEditTarget(dn)
    setForm({
      supplierId: dn.supplier?.id ?? '',
      purchaseOrderId: dn.purchaseOrder?.id ?? '',
      reason: dn.reason,
      amount: String(dn.amount),
      notes: dn.notes ?? ''
    })
    // suppliers/purchaseOrders dropdown lists get the linked record merged in by
    // the fetch effect above (keyed on editTarget) — no need to do it here too.
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditTarget(null)
    setForm({ supplierId: '', purchaseOrderId: '', reason: '', amount: '', notes: '' })
  }

  async function handleSave() {
    if (!form.reason.trim() || !form.amount) { toastError(t('debitNotes.reasonAmountRequired')); return }
    setSaving(true)
    try {
      // On update, an empty selection must send `null` (explicitly clear the field),
      // not `undefined` (service-layer semantics: "leave unchanged") — this form
      // always shows and resubmits the complete intended state, never a partial
      // patch, so there's no legitimate "leave unchanged" case here. Using `undefined`
      // meant picking "N/A" to detach a supplier/PO silently did nothing.
      const res = editTarget
        ? await window.api.debitNotes.update({
            id: editTarget.id,
            supplierId: form.supplierId || null,
            purchaseOrderId: form.purchaseOrderId || null,
            reason: form.reason,
            amount: parseFloat(form.amount),
            notes: form.notes || null
          })
        : await window.api.debitNotes.create({
            supplierId: form.supplierId || undefined,
            purchaseOrderId: form.purchaseOrderId || undefined,
            reason: form.reason,
            amount: parseFloat(form.amount),
            notes: form.notes || undefined
          })
      if (res.success) {
        toastSuccess(t(editTarget ? 'debitNotes.updated' : 'debitNotes.created'))
        closeForm()
        loadData()
      } else {
        toastError((res.error as { message: string })?.message ?? t('debitNotes.failed'))
      }
    } catch {
      toastError(t('debitNotes.failed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const res = await window.api.debitNotes.delete(deleteTarget.id)
      if (res.success) { toastSuccess(t('debitNotes.deleted')); loadData() }
      else toastError((res.error as { message: string })?.message ?? t('debitNotes.failed'))
    } catch {
      toastError(t('debitNotes.failed'))
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handlePrint(dn: DebitNote) {
    setPrintingId(dn.id)
    try {
      const res = await window.api.debitNotes.print(dn.id)
      if (!res.success) toastError((res.error as { message: string })?.message ?? t('debitNotes.printFailed'))
    } catch {
      toastError(t('debitNotes.printFailed'))
    } finally {
      setPrintingId(null)
    }
  }

  // Fresh-audit fix (2026-07-12): explicit thermal override — Debit Note
  // previously had no way to print at receipt width at all.
  async function handlePrintReceipt(dn: DebitNote) {
    setPrintingId(dn.id)
    try {
      const res = await window.api.debitNotes.printReceipt({ id: dn.id })
      if (!res.success) toastError((res.error as { message: string })?.message ?? t('debitNotes.printFailed'))
    } catch {
      toastError(t('debitNotes.printFailed'))
    } finally {
      setPrintingId(null)
    }
  }

  const canCreate = hasPermission('purchaseOrders.create')
  const canVoid = hasPermission('purchaseOrders.create')
  const canPrint = hasPermission('purchaseOrders.print')

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
            <PlusCircle size={20} className="text-danger" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('debitNotes.title')}</h1>
            <p className="text-sm text-slate-500">{t('debitNotes.count', { count: debitNotes.length })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 hover:border-brand hover:text-brand transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
          </button>
          {canCreate && (
            <Button size="md" onClick={() => { setEditTarget(null); setShowForm(true) }}>
              <PlusCircle size={16} className="mr-1.5" /> {t('debitNotes.newDebitNote')}
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <Card padding="lg" className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{editTarget ? t('debitNotes.editDebitNote') : t('debitNotes.newDebitNote')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('suppliers.title')} value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}>
              <option value="">{t('common.na')}</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierName}</option>)}
            </Select>
            <Select label={t('debitNotes.againstPO')} value={form.purchaseOrderId} onChange={e => setForm(f => ({ ...f, purchaseOrderId: e.target.value }))}>
              <option value="">{t('common.na')}</option>
              {purchaseOrders.map(p => <option key={p.id} value={p.id}>{p.poNumber}</option>)}
            </Select>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('debitNotes.reasonLabel')}</label>
              <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder={t('debitNotes.reasonPlaceholder')}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('debitNotes.amountLabel')}</label>
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
            <Button size="sm" onClick={handleSave} loading={saving}>{editTarget ? t('debitNotes.updateDebitNote') : t('debitNotes.saveDebitNote')}</Button>
          </div>
        </Card>
      )}

      {!loading && debitNotes.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <PlusCircle size={48} className="opacity-30" />
          <p className="text-base">{t('debitNotes.noDebitNotes')}</p>
        </div>
      ) : (
        <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
          {debitNotes.map(dn => (
            <div key={dn.id} className="flex items-center gap-4 px-5 py-3.5 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-dark dark:text-slate-100">{dn.debitNoteNumber}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {dn.supplier?.supplierName ?? t('debitNotes.noSupplier')} • {dn.reason} • {formatDate(dn.createdAt)}
                  {dn.purchaseOrder && ` • ${t('debitNotes.refPO', { number: dn.purchaseOrder.poNumber })}`}
                </p>
              </div>
              <p className="text-sm font-bold text-danger shrink-0">{fmtMoney(dn.amount, sym)}</p>
              {canPrint && (
                <>
                  <button onClick={() => handlePrint(dn)} disabled={printingId === dn.id} title="Print (A4)"
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand transition-all disabled:opacity-30">
                    <Printer size={15} />
                  </button>
                  <button onClick={() => handlePrintReceipt(dn)} disabled={printingId === dn.id} title="Print Receipt (Thermal)"
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand transition-all disabled:opacity-30">
                    <Receipt size={15} />
                  </button>
                </>
              )}
              {canCreate && (
                <button onClick={() => startEdit(dn)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand transition-all">
                  <Edit2 size={15} />
                </button>
              )}
              {canVoid && (
                <button onClick={() => setDeleteTarget(dn)}
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
        title={t('debitNotes.deleteTitle')}
        message={t('debitNotes.deleteMsg', { number: deleteTarget?.debitNoteNumber })}
        confirmLabel={t('common.delete')}
        confirmVariant="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
