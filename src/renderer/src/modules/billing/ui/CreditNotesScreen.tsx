import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, MinusCircle, RefreshCw, Trash2, Edit2, Printer, Receipt, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { cn } from '@shared/utils/cn'
import { formatDate } from '@shared/utils/locale.util'
import { formatCurrency } from '@shared/utils/currency.util'
import { Button } from '@shared/ui/atoms/Button'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { Card } from '@shared/ui/molecules/Card'
import { Select } from '@shared/ui/atoms/Select'
import { ShareMenu, type ExportPdfResult } from '@shared/ui/molecules/ShareMenu'

interface CreditNote {
  id: string; creditNoteNumber: string; reason: string; amount: number; notes?: string | null
  createdAt: string; customer?: { id: string; customerName: string; phone?: string | null; email?: string | null } | null
  invoice?: { id: string; invoiceNumber: string } | null
}

interface Customer { id: string; customerName: string }
interface Invoice { id: string; invoiceNumber: string }
interface Product { id: string; productName: string; sku?: string | null; sellingPrice: number; productType: string }
interface ExpenseCategory { id: string; categoryName: string }
interface CreditNoteLineItem {
  lineType: 'PRODUCT' | 'SERVICE'
  productId: string
  serviceDescription: string
  serviceCategoryId: string
  quantity: number
  unitPrice: number
  taxRate: number
}

const EMPTY_LINE_ITEM: CreditNoteLineItem = { lineType: 'PRODUCT', productId: '', serviceDescription: '', serviceCategoryId: '', quantity: 1, unitPrice: 0, taxRate: 0 }

function lineItemTotal(item: CreditNoteLineItem): number {
  const base = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
  return base + base * ((Number(item.taxRate) || 0) / 100)
}

// Same searchable-dropdown pattern used across the Phase 61/63 forms
// (SalesOrderFormModal, BillFormModal, PurchaseOrderFormModal).
function ProductPicker({ products, value, onChange }: { products: Product[]; value: string; onChange: (productId: string) => void }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const selected = products.find(p => p.id === value)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const results = query.trim()
    ? products.filter(p => p.productName.toLowerCase().includes(query.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(query.toLowerCase())).slice(0, 50)
    : products.slice(0, 50)

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search size={12} className="absolute start-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={open ? query : (selected ? `${selected.productName}${selected.sku ? ` (${selected.sku})` : ''}` : '')}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          className="w-full h-8 ps-6 pe-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 dark:text-slate-300"
        />
      </div>
      {open && (
        <div className="absolute start-0 end-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">{t('common.noResults')}</p>
          ) : (
            results.map(p => (
              <button key={p.id} type="button" onClick={() => { onChange(p.id); setQuery(''); setOpen(false) }}
                className={cn('w-full text-start px-3 py-2 text-sm hover:bg-brand/5 transition-colors', p.id === value && 'bg-brand/5')}>
                <p className="text-dark dark:text-slate-100">{p.productName}</p>
                {p.sku && <p className="text-xs text-slate-400">SKU: {p.sku}</p>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function CreditNotesScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const hasPermission = useAuthStore(s => s.hasPermission)
  const businessName = useBusinessStore(s => s.profile?.businessName ?? 'Business')

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<CreditNote | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CreditNote | null>(null)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])

  const [form, setForm] = useState({ customerId: '', invoiceId: '', reason: '', amount: '', notes: '' })
  const [saving, setSaving] = useState(false)

  // Itemization is create-only — creditNotes.update never accepted `items`
  // (see credit-note.validation.ts's own comment), so editing an existing
  // note always uses the plain amount field, matching what the backend can
  // actually do.
  const [useItems, setUseItems] = useState(false)
  const [lineItems, setLineItems] = useState<CreditNoteLineItem[]>([{ ...EMPTY_LINE_ITEM }])
  const itemsTotal = lineItems.reduce((sum, item) => sum + lineItemTotal(item), 0)

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
    if (!editTarget) {
      window.api.products.list({ isActive: true, limit: 500 }).then(r => {
        if (r.success) setProducts(((r.data as { products: Product[] }).products ?? []).filter(p => p.productType === 'STANDARD'))
      }).catch(() => {})
      window.api.expenses.listCategories().then(r => {
        if (r.success) setCategories((r.data as ExpenseCategory[]) ?? [])
      }).catch(() => {})
    }
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
    setUseItems(false)
    // customers/invoices dropdown lists get the linked record merged in by the
    // fetch effect below (keyed on editTarget) — no need to do it here too.
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditTarget(null)
    setForm({ customerId: '', invoiceId: '', reason: '', amount: '', notes: '' })
    setUseItems(false)
    setLineItems([{ ...EMPTY_LINE_ITEM }])
  }

  function updateLineItem(index: number, patch: Partial<CreditNoteLineItem>) {
    setLineItems(items => items.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  function addLineItem() {
    setLineItems(items => [...items, { ...EMPTY_LINE_ITEM }])
  }

  function removeLineItem(index: number) {
    setLineItems(items => items.length > 1 ? items.filter((_, i) => i !== index) : items)
  }

  async function handleSave() {
    const validItems = lineItems.filter(i => i.lineType === 'PRODUCT' ? !!i.productId : !!i.serviceDescription.trim())
    if (!form.reason.trim()) { toastError(t('creditNotes.reasonAmountRequired')); return }
    if (useItems && validItems.length === 0) { toastError(t('creditNotes.reasonAmountRequired')); return }
    if (!useItems && !form.amount) { toastError(t('creditNotes.reasonAmountRequired')); return }
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
        : await window.api.creditNotes.create(useItems ? {
            customerId: form.customerId || undefined,
            invoiceId: form.invoiceId || undefined,
            reason: form.reason,
            items: validItems.map(i => ({
              productId: i.lineType === 'PRODUCT' ? i.productId : undefined,
              serviceDescription: i.lineType === 'SERVICE' ? i.serviceDescription : undefined,
              serviceCategoryId: i.lineType === 'SERVICE' ? (i.serviceCategoryId || undefined) : undefined,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              taxRate: i.taxRate ?? 0
            })),
            notes: form.notes || undefined
          } : {
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

  async function handleExportPdfForShare(cn: CreditNote): Promise<ExportPdfResult> {
    const res = await window.api.creditNotes.exportPdf(cn.id)
    if (!res.success) return { success: false, error: res.error }
    const data = res.data as { cancelled: boolean; filePath?: string }
    return { success: true, cancelled: data.cancelled, filePath: data.filePath }
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
              <Plus size={16} className="me-1.5" /> {t('creditNotes.newCreditNote')}
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
              <input type="number" min="0" value={useItems ? itemsTotal.toFixed(2) : form.amount}
                disabled={useItems}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand disabled:opacity-60" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('common.notes')}</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={t('common.optional')}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand" />
            </div>
          </div>

          {!editTarget && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input type="checkbox" checked={useItems} onChange={e => setUseItems(e.target.checked)} className="w-4 h-4 rounded accent-brand" />
                <span className="text-sm font-medium text-dark dark:text-slate-100">{t('creditNotes.itemizeThisNote')}</span>
              </label>
              {useItems && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{t('purchaseOrders.items')}</p>
                    <button type="button" onClick={addLineItem} className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80 transition-colors">
                      <Plus size={12} /> {t('purchaseOrders.addItem')}
                    </button>
                  </div>
                  {lineItems.map((item, index) => (
                    <div key={index} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 p-0.5">
                          {(['PRODUCT', 'SERVICE'] as const).map(lt => (
                            <button key={lt} type="button" onClick={() => updateLineItem(index, { lineType: lt })}
                              className={cn('px-2 py-1 rounded text-[11px] font-semibold transition-colors', item.lineType === lt ? 'bg-brand text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900')}>
                              {lt === 'PRODUCT' ? t('bills.product') : t('bills.service')}
                            </button>
                          ))}
                        </div>
                        <span className="flex-1" />
                        <button type="button" onClick={() => removeLineItem(index)} disabled={lineItems.length === 1}
                          className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger/10 disabled:opacity-30 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 items-start">
                        {item.lineType === 'PRODUCT' ? (
                          <ProductPicker products={products} value={item.productId} onChange={(productId) => {
                            const product = products.find(p => p.id === productId)
                            updateLineItem(index, { productId, unitPrice: product?.sellingPrice ?? item.unitPrice })
                          }} />
                        ) : (
                          <div className="space-y-1">
                            <input placeholder={t('bills.serviceDescription')} value={item.serviceDescription}
                              onChange={e => updateLineItem(index, { serviceDescription: e.target.value })}
                              className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                            <select value={item.serviceCategoryId} onChange={e => updateLineItem(index, { serviceCategoryId: e.target.value })}
                              className="w-full h-7 px-2 rounded border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-500">
                              <option value="">{t('bills.categoryOptional')}</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
                            </select>
                          </div>
                        )}
                        <input type="number" min="1" step="1" placeholder={t('bills.quantity')} value={item.quantity}
                          onChange={e => updateLineItem(index, { quantity: Number(e.target.value) || 1 })}
                          className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                        <input type="number" min="0" step="0.01" placeholder={t('salesOrders.unitPrice')} value={item.unitPrice}
                          onChange={e => updateLineItem(index, { unitPrice: Number(e.target.value) || 0 })}
                          className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                        <input type="number" min="0" max="100" step="0.5" placeholder={t('bills.taxPercent')} value={item.taxRate}
                          onChange={e => updateLineItem(index, { taxRate: Number(e.target.value) || 0 })}
                          className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
              <p className="text-sm font-bold text-warning shrink-0">{formatCurrency(cn.amount)}</p>
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
                  <ShareMenu
                    recipientPhone={cn.customer?.phone}
                    recipientEmail={cn.customer?.email}
                    buildWhatsAppMessage={() => t('billing.shareWhatsAppMessage', { businessName, documentType: t('share.docTypeCreditNote'), number: cn.creditNoteNumber, amount: formatCurrency(cn.amount) })}
                    buildEmailSubject={() => t('billing.shareEmailSubject', { documentType: t('share.docTypeCreditNote'), number: cn.creditNoteNumber, businessName })}
                    buildEmailBody={() => t('billing.shareEmailBody', { documentType: t('share.docTypeCreditNote'), number: cn.creditNoteNumber, businessName, amount: formatCurrency(cn.amount) })}
                    onExportPdf={() => handleExportPdfForShare(cn)}
                  />
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
