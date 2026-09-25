import React, { useEffect, useState, useCallback } from 'react'
import { useMoneyContext } from '@shared/utils/money-context'
import { computeNoteTotals, convertPriceMode, roundMoney } from '@money'
import { PricesIncludeTaxToggle } from '@shared/ui/molecules/PricesIncludeTaxToggle'
import { GstTypeSelector } from '@shared/ui/molecules/GstTypeSelector'
import { OffSlabRateWarning } from '@shared/ui/molecules/OffSlabRateWarning'
import { useGstTypeChoice } from '@shared/utils/gst-type-choice'
import { resolvePartyState } from '../../../../../shared/utils/gst-presentation'
import { splitTaxLines } from '@shared/utils/tax.util'
import { isGstType } from '@gst'
import { Plus, MinusCircle, RefreshCw, Trash2, Edit2, Printer, Receipt } from 'lucide-react'
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
import { ProductAutocomplete, type ProductOption } from '@shared/ui/organisms/ProductAutocomplete'

interface CreditNote {
  id: string; creditNoteNumber: string; reason: string; amount: number; notes?: string | null
  createdAt: string; customer?: { id: string; customerName: string; phone?: string | null; email?: string | null } | null
  invoice?: { id: string; invoiceNumber: string } | null
  taxApplied?: boolean; taxAmount?: number; taxRate?: number | null; pricesIncludeTax?: boolean
  items?: Array<{ quantity: number; unitPrice: number; taxRate: number }>
}

interface Customer { id: string; customerName: string; state?: string | null; taxNumber?: string | null }
interface Invoice { id: string; invoiceNumber: string; pricesIncludeTax?: boolean; gstType?: string | null; taxAmount?: number }
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

// The amount as it was entered on a plain-amount note: taxable when prices exclude tax, the tax-inclusive figure when
// they include it (the note stores the payable total, so the exclusive figure is total less tax).
function enteredAmountOf(n: { amount: number; taxApplied?: boolean; taxAmount?: number; pricesIncludeTax?: boolean; items?: unknown[] }, decimals: number): number {
  if (n.taxApplied && (n.items?.length ?? 0) === 0 && !n.pricesIncludeTax) return roundMoney(n.amount - (n.taxAmount ?? 0), decimals)
  return n.amount
}

const EMPTY_LINE_ITEM: CreditNoteLineItem = { lineType: 'PRODUCT', productId: '', serviceDescription: '', serviceCategoryId: '', quantity: 1, unitPrice: 0, taxRate: 0 }


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
  const [categories, setCategories] = useState<ExpenseCategory[]>([])

  const [form, setForm] = useState({ customerId: '', invoiceId: '', reason: '', amount: '', notes: '' })
  const [saving, setSaving] = useState(false)

  // Itemization is create-only — creditNotes.update never accepted `items`
  // (see credit-note.validation.ts's own comment), so editing an existing
  // note always uses the plain amount field, matching what the backend can
  // actually do.
  const [useItems, setUseItems] = useState(false)
  const [lineItems, setLineItems] = useState<CreditNoteLineItem[]>([{ ...EMPTY_LINE_ITEM }])
  // Same shared module the note's backend service runs on save (src/shared/utils/money.ts).
  const moneyCtx = useMoneyContext()
  // A note against an invoice follows that invoice's price mode unless the user changes it.
  const [inclTaxChoice, setInclTaxChoice] = useState<boolean | null>(null)
  const linkedInvoice = invoices.find(i => i.id === form.invoiceId)
  const pricesIncludeTax = inclTaxChoice ?? linkedInvoice?.pricesIncludeTax ?? moneyCtx.pricesIncludeTaxDefault
  // Flipping the switch re-expresses every entered price in the other mode, so the credited price does not change.
  function changePriceMode(next: boolean) {
    setLineItems(items => items.map(i => ({ ...i, unitPrice: convertPriceMode(Number(i.unitPrice) || 0, Number(i.taxRate) || 0, next, moneyCtx.decimals) })))
    setInclTaxChoice(next)
  }
  const taxModel = useBusinessStore(s => s.profile?.taxModel ?? 'NONE')
  const gstChoice = useGstTypeChoice(resolvePartyState(customers.find(c => c.id === form.customerId)?.state, customers.find(c => c.id === form.customerId)?.taxNumber))
  // Presented like the invoice it corrects unless the owner chooses otherwise.
  const linkedGstType = isGstType(linkedInvoice?.gstType) ? linkedInvoice?.gstType : undefined
  const shownGstType = gstChoice.isAuto && linkedGstType ? linkedGstType : gstChoice.gstType

  // Add or skip tax per note. The default follows the linked document: yes when it carries tax, no when it does not
  // or when nothing is linked. Either way the owner can change it.
  const [taxChoice, setTaxChoice] = useState<boolean | null>(null)
  const [plainRate, setPlainRate] = useState('')
  const [defaultRate, setDefaultRate] = useState(0)
  const linkedTaxed = linkedInvoice ? (Number(linkedInvoice.taxAmount) || 0) > 0 : false
  const taxApplied = taxChoice ?? (editTarget ? editTarget.taxApplied === true : linkedTaxed)
  const editingItemised = !!editTarget && (editTarget.items?.length ?? 0) > 0
  const rateNumber = plainRate.trim() !== '' ? Number(plainRate) || 0 : defaultRate
  // One calculation for the form, the saved note and every print (src/shared/utils/money.ts computeNoteTotals).
  const itemsComputed = computeNoteTotals(
    useItems
      ? { items: lineItems.map(i => ({ quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitPrice) || 0, taxRate: Number(i.taxRate) || 0 })), taxApplied, pricesIncludeTax, decimals: moneyCtx.decimals }
      : editingItemised
        ? { items: editTarget!.items, taxApplied, pricesIncludeTax, decimals: moneyCtx.decimals }
        : { amount: Number(form.amount) || 0, taxApplied, taxRate: rateNumber, pricesIncludeTax, decimals: moneyCtx.decimals }
  )
  const itemsTotal = itemsComputed.totalAmount
  const noteTaxLines = splitTaxLines(taxModel, itemsComputed.taxAmount, shownGstType, moneyCtx.decimals, itemsComputed.lines.map(l => ({ taxRate: l.taxRate, taxAmount: l.tax })))

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
    window.api.tax.list().then(r => {
      if (!r.success) return
      const configs = (r.data as Array<{ rate: number; isDefault: boolean; isLegacy?: boolean }>) ?? []
      const current = configs.filter(c => !c.isLegacy)
      setDefaultRate((current.find(c => c.isDefault) ?? current.find(c => c.rate > 0))?.rate ?? 0)
    }).catch(() => {})
  }, [showForm])

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
      amount: String(enteredAmountOf(cn, moneyCtx.decimals)),
      notes: cn.notes ?? ''
    })
    setTaxChoice(cn.taxApplied === true)
    setPlainRate(cn.taxRate != null ? String(cn.taxRate) : '')
    setInclTaxChoice(cn.pricesIncludeTax === true)
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
    setInclTaxChoice(null)
    setTaxChoice(null)
    setPlainRate('')
    gstChoice.reset()
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
            amount: editingItemised ? undefined : parseFloat(form.amount),
            taxApplied,
            pricesIncludeTax,
            taxRate: taxApplied && !editingItemised && plainRate.trim() !== '' ? Number(plainRate) : undefined,
            notes: form.notes || null
          })
        : await window.api.creditNotes.create(useItems ? {
            customerId: form.customerId || undefined,
            invoiceId: form.invoiceId || undefined,
            reason: form.reason,
            pricesIncludeTax,
            taxApplied,
            gstType: gstChoice.isGst ? shownGstType : undefined,
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
            taxApplied,
            taxRate: taxApplied && plainRate.trim() !== '' ? Number(plainRate) : undefined,
            pricesIncludeTax,
            gstType: gstChoice.isGst && taxApplied ? shownGstType : undefined,
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
              <input type="number" min="0" value={useItems ? itemsTotal.toFixed(moneyCtx.decimals) : form.amount}
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

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
            <label className="flex items-center gap-3 min-h-[44px] text-sm font-medium text-dark dark:text-slate-100 cursor-pointer">
              <input type="checkbox" className="w-5 h-5" checked={taxApplied} onChange={e => setTaxChoice(e.target.checked)} />
              <span>{t('creditNotes.addTax')}</span>
            </label>
            <p className="text-xs text-slate-400">{t('creditNotes.addTaxHint')}</p>
            {linkedTaxed && !taxApplied && <p className="text-xs text-warning">{t('creditNotes.taxSkippedWarning')}</p>}
            {taxApplied && !useItems && (
              <div className="grid grid-cols-2 gap-4">
                {!editingItemised && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('creditNotes.taxRateLabel')}</label>
                    <input type="number" min="0" max="100" step="0.01" value={plainRate} placeholder={String(defaultRate)}
                      onChange={e => setPlainRate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand" />
                    <p className="text-xs text-slate-400 mt-1">{t('creditNotes.taxRateHint')}</p>
                  </div>
                )}
                <PricesIncludeTaxToggle checked={pricesIncludeTax} onChange={setInclTaxChoice} />
              </div>
            )}
            {taxApplied && !useItems && !editTarget && gstChoice.isGst && <GstTypeSelector value={shownGstType} onChange={gstChoice.setGstType} isAuto={gstChoice.isAuto && !linkedGstType} />}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 px-3 py-2 space-y-1 text-sm">
              {noteTaxLines.length > 0 && (
                <>
                  <div className="flex justify-between text-slate-500"><span>{t('creditNotes.amountBeforeTax')}</span><span>{formatCurrency(itemsComputed.taxable)}</span></div>
                  {noteTaxLines.map(line => (
                    <div key={line.label} className="flex justify-between text-slate-500"><span>{line.label}</span><span>{formatCurrency(line.amount)}</span></div>
                  ))}
                </>
              )}
              <div className="flex justify-between font-semibold text-dark dark:text-slate-100"><span>{t('creditNotes.noteTotal')}</span><span>{formatCurrency(itemsTotal)}</span></div>
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
                  <PricesIncludeTaxToggle checked={pricesIncludeTax} onChange={changePriceMode} />
                  {gstChoice.isGst && <GstTypeSelector value={shownGstType} onChange={gstChoice.setGstType} isAuto={gstChoice.isAuto && !linkedGstType} />}
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
                          <ProductAutocomplete value={item.productId} onChange={(product: ProductOption) => {
                            updateLineItem(index, { productId: product.id, unitPrice: product.sellingPrice === undefined || product.sellingPrice === null ? item.unitPrice : (pricesIncludeTax === moneyCtx.pricesIncludeTaxDefault ? product.sellingPrice : convertPriceMode(product.sellingPrice, product.taxRate ?? 0, pricesIncludeTax, moneyCtx.decimals)), taxRate: product.taxRate ?? item.taxRate })
                          }} onlyProductType="STANDARD" />
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
                        <input type="number" min="0" step="0.01" placeholder={`${t('salesOrders.unitPrice')} ${pricesIncludeTax ? t('billing.priceInclTax') : t('billing.priceExclTax')}`} value={item.unitPrice}
                          onChange={e => updateLineItem(index, { unitPrice: Number(e.target.value) || 0 })}
                          className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                        <input type="number" min="0" max="100" step="0.5" placeholder={t('bills.taxPercent')} value={item.taxRate}
                          onChange={e => updateLineItem(index, { taxRate: Number(e.target.value) || 0 })}
                          className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                      </div>
                    </div>
                  ))}
                  <OffSlabRateWarning rates={lineItems.map(i => Number(i.taxRate) || 0)} />
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
