import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Repeat, RefreshCw, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { cn } from '@shared/utils/cn'
import { CustomerFormModal } from '@modules/customers/ui/CustomerFormModal'
import { SupplierFormModal } from '@modules/suppliers/ui/SupplierFormModal'

interface RecurringProfile {
  id: string
  documentType: 'INVOICE' | 'BILL' | 'EXPENSE'
  cadence: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  dayOfPeriod: number
  startDate: string
  endDate: string | null
  active: boolean
  lastGeneratedPeriod: string | null
  customer?: { id: string; customerName: string } | null
  supplier?: { id: string; supplierName: string } | null
}

interface Customer { id: string; customerName: string; customerCode: string }
interface Supplier { id: string; supplierName: string; supplierCode: string }
interface Product { id: string; productName: string; sku?: string | null; unit: string; productType: string; sellingPrice: number; costPrice: number }
interface ExpenseCategory { id: string; categoryName: string }

const DOC_TYPES = ['INVOICE', 'BILL', 'EXPENSE'] as const
const CADENCES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const
const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER']
const DOC_BADGE: Record<string, 'info' | 'brand' | 'neutral'> = { INVOICE: 'info', BILL: 'brand', EXPENSE: 'neutral' }

// Phase 63 — Recurring Invoices/Bills/Expenses, evaluated on demand from the
// existing hourly setInterval (see recurring-profile.service.ts's own
// comment) — no manual "run now" trigger exists, matching the backend.
export function RecurringProfilesScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('recurringProfiles.manage')

  const [profiles, setProfiles] = useState<RecurringProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'' | typeof DOC_TYPES[number]>('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<RecurringProfile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RecurringProfile | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.recurringProfiles.list(typeFilter ? { documentType: typeFilter } : undefined)
      if (res.success && res.data) setProfiles(res.data as RecurringProfile[])
      else toastError(t('common.error'), res.error?.message ?? t('recurringProfiles.couldNotLoad'))
    } catch {
      toastError(t('common.error'), t('recurringProfiles.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [typeFilter, toastError, t])

  useEffect(() => { load() }, [load])

  async function toggleActive(profile: RecurringProfile) {
    try {
      const res = await window.api.recurringProfiles.update({ id: profile.id, active: !profile.active })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('recurringProfiles.couldNotSave')); return }
      load()
    } catch {
      toastError(t('common.error'), t('recurringProfiles.couldNotSave'))
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await window.api.recurringProfiles.delete(deleteTarget.id)
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('recurringProfiles.couldNotDelete')); return }
      toastSuccess(t('recurringProfiles.profileDeleted'), '')
      setDeleteTarget(null)
      load()
    } catch {
      toastError(t('common.error'), t('recurringProfiles.couldNotDelete'))
    } finally {
      setDeleting(false)
    }
  }

  function counterpartyName(p: RecurringProfile) {
    if (p.documentType === 'INVOICE') return p.customer?.customerName ?? '—'
    return p.supplier?.supplierName ?? '—'
  }

  function dayOfPeriodLabel(p: RecurringProfile) {
    if (p.cadence === 'WEEKLY') {
      const days = [t('recurringProfiles.mon'), t('recurringProfiles.tue'), t('recurringProfiles.wed'), t('recurringProfiles.thu'), t('recurringProfiles.fri'), t('recurringProfiles.sat'), t('recurringProfiles.sun')]
      return days[p.dayOfPeriod - 1] ?? p.dayOfPeriod
    }
    return t('recurringProfiles.dayOfMonth', { day: p.dayOfPeriod })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <Repeat size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('recurringProfiles.title')}</h1>
              <p className="text-xs text-slate-400">{t('recurringProfiles.subtitle', { count: profiles.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{t('recurringProfiles.newProfile')}</Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          {(['', ...DOC_TYPES] as const).map((val) => (
            <button
              key={val || 'ALL'}
              onClick={() => setTypeFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${typeFilter === val ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand'}`}
            >
              {val === '' ? t('common.all') : t(`recurringProfiles.docType.${val}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && profiles.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={6} cols={6} /></div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <Repeat size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('recurringProfiles.noProfilesYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('recurringProfiles.type')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('recurringProfiles.counterparty')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('recurringProfiles.schedule')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('recurringProfiles.lastGenerated')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.status')}</th>
                <th className="text-end px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-3"><Badge variant={DOC_BADGE[p.documentType]} size="sm">{t(`recurringProfiles.docType.${p.documentType}`)}</Badge></td>
                  <td className="px-4 py-3 font-semibold text-dark dark:text-slate-100">{counterpartyName(p)}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">{t(`recurringProfiles.cadence.${p.cadence}`)} · {dayOfPeriodLabel(p)}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-400">{p.lastGeneratedPeriod ?? t('recurringProfiles.never')}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={p.active ? 'success' : 'neutral'} size="sm">{p.active ? t('recurringProfiles.running') : t('recurringProfiles.paused')}</Badge>
                  </td>
                  <td className="px-6 py-3 text-end">
                    {canManage && (
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => toggleActive(p)} className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand transition-colors">{p.active ? t('recurringProfiles.pause') : t('recurringProfiles.resume')}</button>
                        <button onClick={() => setEditTarget(p)} className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand transition-colors">{t('common.edit')}</button>
                        <button onClick={() => setDeleteTarget(p)} className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors">{t('common.delete')}</button>
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
        <RecurringProfileFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      )}
      {editTarget && (
        <EditScheduleModal profile={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load() }} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          open
          title={t('recurringProfiles.deleteProfileTitle')}
          message={t('recurringProfiles.deleteProfileMessage')}
          confirmLabel={t('common.delete')}
          loading={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

function EditScheduleModal({ profile, onClose, onSaved }: { profile: RecurringProfile; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [cadence, setCadence] = useState(profile.cadence)
  const [dayOfPeriod, setDayOfPeriod] = useState(profile.dayOfPeriod)
  const [endDate, setEndDate] = useState(profile.endDate ? profile.endDate.slice(0, 10) : '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await window.api.recurringProfiles.update({ id: profile.id, cadence, dayOfPeriod, endDate: endDate || null })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('recurringProfiles.couldNotSave')); return }
      toastSuccess(t('common.saveChanges'), '')
      onSaved()
    } catch {
      toastError(t('common.error'), t('recurringProfiles.couldNotSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('recurringProfiles.editSchedule')} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} loading={saving}>{t('common.save')}</Button>
      </>}
    >
      <div className="space-y-4">
        <Select label={t('recurringProfiles.cadence.label')} value={cadence} onChange={(e) => setCadence(e.target.value as typeof cadence)}>
          {CADENCES.map(c => <option key={c} value={c}>{t(`recurringProfiles.cadence.${c}`)}</option>)}
        </Select>
        <Input label={cadence === 'WEEKLY' ? t('recurringProfiles.dayOfWeekLabel') : t('recurringProfiles.dayOfPeriodLabel')} type="number" min={1} max={cadence === 'WEEKLY' ? 7 : 31}
          value={dayOfPeriod} onChange={(e) => setDayOfPeriod(Number(e.target.value) || 1)} />
        <Input label={t('recurringProfiles.endDateOptional')} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
    </Modal>
  )
}

function ProductPicker({ products, value, onChange }: { products: Product[]; value: string; onChange: (id: string) => void }) {
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

interface FormValues {
  documentType: typeof DOC_TYPES[number]
  cadence: typeof CADENCES[number]
  dayOfPeriod: number
  startDate: string
  endDate: string
  customerId: string
  supplierId: string
  isReverseCharge: boolean
  notes: string
  items: Array<{ lineType: 'PRODUCT' | 'SERVICE'; productId: string; serviceDescription: string; serviceCategoryId: string; quantity: number; price: number; taxRate: number }>
  categoryId: string
  expenseName: string
  amount: number
  paymentMethod: string
  remarks: string
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

export function RecurringProfileFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [customerFormOpen, setCustomerFormOpen] = useState(false)
  const [supplierFormOpen, setSupplierFormOpen] = useState(false)

  const emptyItem = { lineType: 'PRODUCT' as const, productId: '', serviceDescription: '', serviceCategoryId: '', quantity: 1, price: 0, taxRate: 0 }

  const { control, register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      documentType: 'INVOICE', cadence: 'MONTHLY', dayOfPeriod: 1, startDate: todayStr(), endDate: '',
      customerId: '', supplierId: '', isReverseCharge: false, notes: '', items: [emptyItem],
      categoryId: '', expenseName: '', amount: 0, paymentMethod: 'CASH', remarks: ''
    }
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const documentType = watch('documentType')
  const cadence = watch('cadence')
  const watchedItems = watch('items')

  async function loadCustomers() {
    const res = await window.api.customers.list({ limit: 200 })
    if (res.success) setCustomers((res.data as { customers: Customer[] }).customers ?? [])
  }
  async function loadSuppliers() {
    const res = await window.api.suppliers.list({ limit: 200 })
    if (res.success) setSuppliers((res.data as { suppliers: Supplier[] }).suppliers ?? [])
  }

  useEffect(() => {
    async function loadAll() {
      setLoadingData(true)
      try {
        await Promise.all([loadCustomers(), loadSuppliers()])
        const [pRes, cRes] = await Promise.all([
          window.api.products.list({ isActive: true, limit: 500 }),
          window.api.expenses.listCategories()
        ])
        if (pRes.success) setProducts(((pRes.data as { products: Product[] }).products ?? []).filter(p => p.productType === 'STANDARD'))
        if (cRes.success) setCategories((cRes.data as ExpenseCategory[]) ?? [])
      } catch {
        toastError(t('common.error'), t('common.error'))
      } finally {
        setLoadingData(false)
      }
    }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleProductChange(index: number, productId: string, onChange: (v: string) => void) {
    onChange(productId)
    const product = products.find(p => p.id === productId)
    if (product) {
      setValue(`items.${index}.price`, documentType === 'INVOICE' ? (product.sellingPrice ?? 0) : (product.costPrice ?? 0))
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      let payload: unknown
      if (values.documentType === 'INVOICE') {
        if (!values.customerId) { toastError(t('recurringProfiles.missingFields'), t('salesOrders.selectCustomer')); return }
        payload = {
          documentType: 'INVOICE', customerId: values.customerId,
          items: values.items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.price, taxRate: i.taxRate ?? 0 })),
          notes: values.notes || undefined,
          cadence: values.cadence, dayOfPeriod: values.dayOfPeriod, startDate: values.startDate, endDate: values.endDate || undefined
        }
      } else if (values.documentType === 'BILL') {
        if (!values.supplierId) { toastError(t('recurringProfiles.missingFields'), t('bills.selectSupplier')); return }
        payload = {
          documentType: 'BILL', supplierId: values.supplierId,
          items: values.items.map(i => ({
            productId: i.lineType === 'PRODUCT' ? i.productId : undefined,
            serviceDescription: i.lineType === 'SERVICE' ? i.serviceDescription : undefined,
            serviceCategoryId: i.lineType === 'SERVICE' ? (i.serviceCategoryId || undefined) : undefined,
            quantity: i.quantity, unitCost: i.price, taxRate: i.taxRate ?? 0
          })),
          isReverseCharge: values.isReverseCharge, notes: values.notes || undefined,
          cadence: values.cadence, dayOfPeriod: values.dayOfPeriod, startDate: values.startDate, endDate: values.endDate || undefined
        }
      } else {
        if (!values.categoryId) { toastError(t('recurringProfiles.missingFields'), t('recurringProfiles.selectCategory')); return }
        if (!values.expenseName.trim()) { toastError(t('recurringProfiles.missingFields'), t('recurringProfiles.expenseNameRequired')); return }
        if (!values.amount || values.amount <= 0) { toastError(t('recurringProfiles.missingFields'), t('recurringProfiles.amountRequired')); return }
        payload = {
          documentType: 'EXPENSE', categoryId: values.categoryId, expenseName: values.expenseName.trim(), amount: values.amount,
          paymentMethod: values.paymentMethod || undefined, supplierId: values.supplierId || undefined, remarks: values.remarks || undefined,
          cadence: values.cadence, dayOfPeriod: values.dayOfPeriod, startDate: values.startDate, endDate: values.endDate || undefined
        }
      }
      const res = await window.api.recurringProfiles.create(payload)
      if (res.success) {
        toastSuccess(t('recurringProfiles.profileCreated'), '')
        onSaved()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('recurringProfiles.couldNotCreate'))
      }
    } catch {
      toastError(t('common.error'), t('recurringProfiles.couldNotCreate'))
    }
  }

  return (
    <Modal open onClose={onClose} title={t('recurringProfiles.newProfile')} size="xl"
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
        <Button size="sm" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{t('common.create')}</Button>
      </>}
    >
      {loadingData ? (
        <div className="space-y-3 py-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-1 w-fit">
            {DOC_TYPES.map(dt => (
              <label key={dt} className={cn('px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors', documentType === dt ? 'bg-brand text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900')}>
                <input type="radio" value={dt} {...register('documentType')} className="sr-only" />
                {t(`recurringProfiles.docType.${dt}`)}
              </label>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Select label={t('recurringProfiles.cadence.label')} {...register('cadence')}>
              {CADENCES.map(c => <option key={c} value={c}>{t(`recurringProfiles.cadence.${c}`)}</option>)}
            </Select>
            <Input label={cadence === 'WEEKLY' ? t('recurringProfiles.dayOfWeekLabel') : t('recurringProfiles.dayOfPeriodLabel')} type="number" min={1} max={cadence === 'WEEKLY' ? 7 : 31} {...register('dayOfPeriod', { valueAsNumber: true })} />
            <Input label={t('recurringProfiles.startDate')} type="date" {...register('startDate')} />
          </div>
          <Input label={t('recurringProfiles.endDateOptional')} type="date" {...register('endDate')} />

          {documentType === 'INVOICE' && (
            <>
              {(() => {
                const customerField = register('customerId')
                return (
                  <Select label={t('salesOrders.customer')} {...customerField}
                    onChange={(e) => { if (e.target.value === '__NEW__') { setCustomerFormOpen(true); return } customerField.onChange(e) }}>
                    <option value="">{t('salesOrders.selectCustomer')}</option>
                    <option value="__NEW__">{t('salesOrders.addNewCustomer')}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.customerName} ({c.customerCode})</option>)}
                  </Select>
                )
              })()}
            </>
          )}

          {(documentType === 'BILL' || documentType === 'EXPENSE') && (
            <>
              {(() => {
                const supplierField = register('supplierId')
                return (
                  <Select label={documentType === 'BILL' ? t('bills.supplier') : `${t('common.name')} (${t('common.optional')})`} {...supplierField}
                    onChange={(e) => { if (e.target.value === '__NEW__') { setSupplierFormOpen(true); return } supplierField.onChange(e) }}>
                    <option value="">{t('bills.selectSupplier')}</option>
                    <option value="__NEW__">{t('bills.addNewSupplier')}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierName} ({s.supplierCode})</option>)}
                  </Select>
                )
              })()}
            </>
          )}

          {(documentType === 'INVOICE' || documentType === 'BILL') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{t('purchaseOrders.items')}</p>
                <button type="button" onClick={() => append(emptyItem)} className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80 transition-colors">
                  <Plus size={12} /> {t('purchaseOrders.addItem')}
                </button>
              </div>
              <div className="space-y-2">
                {fields.map((field, index) => {
                  const lineType = watchedItems[index]?.lineType ?? 'PRODUCT'
                  return (
                    <div key={field.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 space-y-2">
                      {documentType === 'BILL' && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 p-0.5">
                            {(['PRODUCT', 'SERVICE'] as const).map(lt => (
                              <label key={lt} className={cn('px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors', lineType === lt ? 'bg-brand text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900')}>
                                <input type="radio" value={lt} {...register(`items.${index}.lineType`)} className="sr-only" />
                                {lt === 'PRODUCT' ? t('bills.product') : t('bills.service')}
                              </label>
                            ))}
                          </div>
                          <span className="flex-1" />
                          <button type="button" onClick={() => { if (fields.length > 1) remove(index) }} disabled={fields.length === 1}
                            className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger/10 disabled:opacity-30 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-start">
                        <div>
                          {lineType === 'PRODUCT' ? (
                            <Controller control={control} name={`items.${index}.productId`}
                              render={({ field: f }) => <ProductPicker products={products} value={f.value ?? ''} onChange={(id) => handleProductChange(index, id, f.onChange)} />} />
                          ) : (
                            <div className="space-y-1">
                              <input placeholder={t('bills.serviceDescription')} {...register(`items.${index}.serviceDescription`)}
                                className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                              <select {...register(`items.${index}.serviceCategoryId`)} className="w-full h-7 px-2 rounded border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-500">
                                <option value="">{t('bills.categoryOptional')}</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                        <input type="number" min="1" step="1" placeholder={t('bills.quantity')} {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                        <input type="number" min="0" step="0.01" placeholder={documentType === 'INVOICE' ? t('salesOrders.unitPrice') : t('bills.unitCost')} {...register(`items.${index}.price`, { valueAsNumber: true })}
                          className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                        <input type="number" min="0" max="100" step="0.5" placeholder={t('bills.taxPercent')} {...register(`items.${index}.taxRate`, { valueAsNumber: true })}
                          className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                        {documentType === 'INVOICE' && (
                          <button type="button" onClick={() => { if (fields.length > 1) remove(index) }} disabled={fields.length === 1}
                            className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger/10 disabled:opacity-30 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {documentType === 'BILL' && (
                <label className="flex items-center gap-2 cursor-pointer mt-3">
                  <input type="checkbox" {...register('isReverseCharge')} className="w-4 h-4 rounded accent-brand" />
                  <span className="text-sm font-medium text-dark dark:text-slate-100">{t('bills.reverseCharge')}</span>
                </label>
              )}
              <div className="mt-3">
                <textarea {...register('notes')} rows={2} placeholder={t('bills.internalNotes')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand resize-none text-slate-700 dark:text-slate-300 placeholder-slate-400" />
              </div>
            </div>
          )}

          {documentType === 'EXPENSE' && (
            <div className="space-y-4">
              <Select label={t('expenses.category')} {...register('categoryId')}>
                <option value="">{t('common.select')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
              </Select>
              <Input label={t('expenses.expenseName')} {...register('expenseName')} />
              <Input label={t('common.amount')} type="number" min="0" step="0.01" {...register('amount', { valueAsNumber: true })} />
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{t('expenses.paymentMethod')}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PAYMENT_METHODS.map(m => (
                    <Controller key={m} control={control} name="paymentMethod" render={({ field }) => (
                      <button type="button" onClick={() => field.onChange(m)}
                        className={cn('h-8 rounded-lg text-xs font-semibold border transition-colors', field.value === m ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand')}>
                        {m.replace('_', ' ')}
                      </button>
                    )} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">{t('common.notes')} ({t('common.optional')})</label>
                <textarea {...register('remarks')} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand resize-none text-slate-700 dark:text-slate-300 placeholder-slate-400" />
              </div>
            </div>
          )}
        </form>
      )}

      <CustomerFormModal open={customerFormOpen} onClose={() => setCustomerFormOpen(false)} onSaved={(c) => { setCustomerFormOpen(false); loadCustomers(); if (c) setValue('customerId', c.id) }} />
      <SupplierFormModal open={supplierFormOpen} onClose={() => setSupplierFormOpen(false)} onSaved={(s) => { setSupplierFormOpen(false); loadSuppliers(); if (s) setValue('supplierId', s.id) }} />
    </Modal>
  )
}
