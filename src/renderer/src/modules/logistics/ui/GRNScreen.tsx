import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

interface GRNItem {
  id: string; productId: string | null; rawMaterialId: string | null; itemName: string
  orderedQty: number | null; receivedQty: number; rejectedQty: number; unit: string
  unitCost: number; totalCost: number; batchNumber: string | null; expiryDate: string | null; notes: string | null
}

interface GRN {
  id: string; grnNumber: string; supplierId: string | null; supplierName: string
  purchaseOrderId: string | null; shipmentId: string | null; receivedDate: string
  invoiceNumber: string | null; invoiceDate: string | null; totalValue: number
  status: string; postedAt: string | null; notes: string | null
  createdAt: string; updatedAt: string; items: GRNItem[]
}

interface ProductOption { id: string; productName: string; sku?: string | null; unit: string; costPrice: number; productType: string }
interface SupplierOption { id: string; supplierName: string; supplierCode?: string }
interface POOption { id: string; poNumber: string; status: string; supplier: { id: string; supplierName: string } }
interface POItemDetail { productId: string; quantity: number; receivedQty: number; unitCost: number; product: { productName: string; unit: string } }

const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  VERIFIED: 'info',
  POSTED: 'success',
  REVERSED: 'danger',
}

const EMPTY_ITEM = { productId: '', itemName: '', receivedQty: '', rejectedQty: '', unit: 'PCS', unitCost: '', batchNumber: '', notes: '', orderedHint: '' }

export default function GRNScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [grns, setGrns] = useState<GRN[]>([])
  const [confirmAction, setConfirmAction] = useState<{ type: 'post' | 'reverse' | 'delete'; id: string; grnNumber: string } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState({ supplierId: '', supplierName: '', invoiceNumber: '', invoiceDate: '', receivedDate: '', notes: '' })
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])
  const [linkedPOId, setLinkedPOId] = useState('')
  // Catalog data that powers the product/supplier/PO linking pickers below.
  // Without a real productId, posting a GRN records a paper trail but never
  // touches Inventory; without a purchaseOrderId, the supplier ledger and the
  // PO's receivedQty/status are never updated either.
  const [products, setProducts] = useState<ProductOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [approvedPOs, setApprovedPOs] = useState<POOption[]>([])
  // Edit state for DRAFT/VERIFIED GRNs
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ supplierName: '', invoiceNumber: '', invoiceDate: '', receivedDate: '', notes: '' })
  const [editItems, setEditItems] = useState<typeof EMPTY_ITEM[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const currSym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')
  const PAGE_SIZE = 100
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.logisticsGrn.list({
        status: filterStatus !== 'ALL' ? filterStatus : undefined,
        fromDate: appliedFrom || undefined,
        toDate: appliedTo || undefined,
        limit,
      })
      if (res.success) { setGrns(res.data as GRN[]); setTotal((res as { total?: number }).total ?? (res.data as GRN[]).length) }
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [filterStatus, appliedFrom, appliedTo, limit, toastError, t])

  const handleApplyDates = () => { setAppliedFrom(fromDate); setAppliedTo(toDate) }
  const handleClearDates = () => { setFromDate(''); setToDate(''); setAppliedFrom(''); setAppliedTo('') }

  useEffect(() => { setLimit(PAGE_SIZE) }, [filterStatus, appliedFrom, appliedTo])
  useEffect(() => { load() }, [load])

  // Load the linking catalog whenever either dialog that needs it is open.
  useEffect(() => {
    if (!showForm && !editId) return
    let cancelled = false
    async function loadCatalog() {
      try {
        const [pRes, sRes, poRes] = await Promise.all([
          window.api.products.list({ isActive: true, limit: 500 }),
          window.api.suppliers.list({ limit: 200 }),
          window.api.purchaseOrders.list({ limit: 200 }),
        ])
        if (cancelled) return
        if (pRes.success) {
          const d = pRes.data as { products: ProductOption[] }
          setProducts((d.products ?? []).filter(p => p.productType === 'STANDARD'))
        } else {
          toastError(t('common.error'), pRes.error?.message ?? t('common.error'))
        }
        if (sRes.success) {
          const d = sRes.data as { suppliers: SupplierOption[] }
          setSuppliers(d.suppliers ?? [])
        } else {
          toastError(t('common.error'), sRes.error?.message ?? t('common.error'))
        }
        if (poRes.success) {
          const d = poRes.data as { orders: POOption[] }
          setApprovedPOs((d.orders ?? []).filter(po => po.status === 'APPROVED' || po.status === 'PARTIAL_RECEIVED'))
        } else {
          toastError(t('common.error'), poRes.error?.message ?? t('common.error'))
        }
      } catch {
        if (!cancelled) toastError(t('common.error'), t('common.error'))
      }
    }
    loadCatalog()
    return () => { cancelled = true }
  }, [showForm, editId, toastError, t])

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
  const updateItem = (idx: number, field: string, value: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const handleItemProductChange = (idx: number, productId: string) => {
    const product = products.find(p => p.id === productId)
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      return {
        ...it,
        productId,
        itemName: product ? product.productName : it.itemName,
        unit: product ? product.unit : it.unit,
        unitCost: product && !it.unitCost ? product.costPrice.toString() : it.unitCost,
      }
    }))
  }

  const handleSupplierSelect = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId)
    setForm(f => ({ ...f, supplierId, supplierName: supplier ? supplier.supplierName : f.supplierName }))
  }

  const handlePOLinkChange = async (poId: string) => {
    setLinkedPOId(poId)
    if (!poId) return
    const res = await window.api.purchaseOrders.get(poId)
    if (!res.success) { setError(res.error?.message ?? t('common.error')); return }
    const po = res.data as { supplier: { id: string; supplierName: string }; items: POItemDetail[] }
    setForm(f => ({ ...f, supplierId: po.supplier.id, supplierName: po.supplier.supplierName }))
    setItems(po.items.map(i => ({
      ...EMPTY_ITEM,
      productId: i.productId,
      itemName: i.product.productName,
      unit: i.product.unit,
      unitCost: i.unitCost.toString(),
      orderedHint: t('logistics.grn.orderedHint', { qty: i.quantity, unit: i.product.unit, received: i.receivedQty }),
    })))
  }

  const save = async () => {
    if (!form.supplierName.trim()) { setError(t('logistics.grn.supplierNameRequired')); return }
    const validItems = items.filter(i => i.itemName.trim() && parseFloat(i.receivedQty) > 0)
    if (!validItems.length) { setError(t('logistics.grn.atLeastOneValidItem')); return }
    setSaving(true); setError(null)
    const res = await window.api.logisticsGrn.create({
      supplierId: form.supplierId || undefined,
      supplierName: form.supplierName,
      purchaseOrderId: linkedPOId || undefined,
      invoiceNumber: form.invoiceNumber || undefined,
      invoiceDate: form.invoiceDate || undefined,
      receivedDate: form.receivedDate || undefined,
      notes: form.notes || undefined,
      items: validItems.map(i => ({
        productId: i.productId || undefined,
        itemName: i.itemName, receivedQty: parseFloat(i.receivedQty),
        rejectedQty: i.rejectedQty ? parseFloat(i.rejectedQty) : 0,
        unit: i.unit, unitCost: i.unitCost ? parseFloat(i.unitCost) : 0,
        batchNumber: i.batchNumber || undefined, notes: i.notes || undefined,
      }))
    })
    setSaving(false)
    if (res.success) {
      setShowForm(false)
      setForm({ supplierId: '', supplierName: '', invoiceNumber: '', invoiceDate: '', receivedDate: '', notes: '' })
      setItems([{ ...EMPTY_ITEM }])
      setLinkedPOId('')
      load()
    } else setError(res.error?.message ?? t('common.error'))
  }

  const verify = async (id: string) => {
    const res = await window.api.logisticsGrn.update({ id, status: 'VERIFIED' })
    if (!res.success) toastError(t('common.error'), res.error?.message ?? t('common.error'))
    load()
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    setConfirmLoading(true)
    const res = confirmAction.type === 'post'
      ? await window.api.logisticsGrn.post(confirmAction.id)
      : confirmAction.type === 'reverse'
        ? await window.api.logisticsGrn.reverse(confirmAction.id)
        : await window.api.logisticsGrn.delete(confirmAction.id)
    setConfirmLoading(false)
    setConfirmAction(null)
    if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('common.error')); if (confirmAction.type !== 'delete') load(); return }
    load()
  }

  const openEditGRN = (g: GRN) => {
    setEditForm({
      supplierName: g.supplierName, invoiceNumber: g.invoiceNumber ?? '',
      invoiceDate: g.invoiceDate ? g.invoiceDate.split('T')[0] : '',
      receivedDate: g.receivedDate ? g.receivedDate.split('T')[0] : '',
      notes: g.notes ?? '',
    })
    setEditItems(g.items.map(i => ({
      productId: i.productId ?? '',
      itemName: i.itemName, receivedQty: i.receivedQty.toString(),
      rejectedQty: i.rejectedQty?.toString() ?? '0',
      unit: i.unit, unitCost: i.unitCost?.toString() ?? '',
      batchNumber: i.batchNumber ?? '', notes: i.notes ?? '',
      orderedHint: i.orderedQty ? t('logistics.grn.orderedHintShort', { qty: i.orderedQty, unit: i.unit }) : '',
    })))
    setEditId(g.id); setEditError(null)
  }

  const addEditItem = () => setEditItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeEditItem = (idx: number) => setEditItems(prev => prev.filter((_, i) => i !== idx))
  const updateEditItem = (idx: number, field: string, value: string) =>
    setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))

  const handleEditItemProductChange = (idx: number, productId: string) => {
    const product = products.find(p => p.id === productId)
    setEditItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      return {
        ...it,
        productId,
        itemName: product ? product.productName : it.itemName,
        unit: product ? product.unit : it.unit,
        unitCost: product && !it.unitCost ? product.costPrice.toString() : it.unitCost,
      }
    }))
  }

  const saveEdit = async () => {
    if (!editForm.supplierName.trim()) { setEditError(t('logistics.grn.supplierNameRequired')); return }
    const validEditItems = editItems.filter(i => i.itemName.trim() && parseFloat(i.receivedQty) > 0)
    if (!validEditItems.length) { setEditError(t('logistics.grn.atLeastOneValidEditItem')); return }
    setEditSaving(true); setEditError(null)
    const res = await window.api.logisticsGrn.update({
      id: editId!,
      supplierName: editForm.supplierName,
      invoiceNumber: editForm.invoiceNumber || undefined,
      invoiceDate: editForm.invoiceDate || undefined,
      receivedDate: editForm.receivedDate || undefined,
      notes: editForm.notes || undefined,
      items: validEditItems.map(i => ({
        productId: i.productId || undefined,
        itemName: i.itemName, receivedQty: parseFloat(i.receivedQty),
        rejectedQty: i.rejectedQty ? parseFloat(i.rejectedQty) : 0,
        unit: i.unit, unitCost: i.unitCost ? parseFloat(i.unitCost) : 0,
        batchNumber: i.batchNumber || undefined, notes: i.notes || undefined,
      })),
    })
    setEditSaving(false)
    if (res.success) { setEditId(null); load() }
    else setEditError(res.error?.message ?? t('common.error'))
  }

  const printGRN = (g: GRN) => {
    const rows = g.items.map(i => `<tr><td>${i.itemName}</td><td>${i.receivedQty}</td><td>${i.rejectedQty}</td><td>${i.unit}</td><td>${formatCurrency(i.unitCost)}</td><td>${formatCurrency(i.totalCost)}</td><td>${i.batchNumber ?? '-'}</td></tr>`).join('')
    const html = `<html><head><style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h2{margin-bottom:16px}.meta{margin-bottom:12px;font-size:11px;color:#666}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px}th{background:#f5f5f5}.total{text-align:right;font-weight:bold;margin-top:8px}footer{margin-top:24px;font-size:10px;color:#888;text-align:center}</style></head><body><h2>Goods Receipt Note: ${g.grnNumber}</h2><div class="meta">Supplier: ${g.supplierName} | Invoice: ${g.invoiceNumber ?? '-'} | Date: ${formatDate(g.receivedDate)} | Status: ${g.status}</div><table><thead><tr><th>Item</th><th>Received</th><th>Rejected</th><th>Unit</th><th>Unit Cost</th><th>Total</th><th>Batch</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Total Value: ${formatCurrency(g.totalValue)}</div><footer>${aszurexFooterHtml(10)}</footer></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">{t('logistics.grn.title')}</h1>
        <button onClick={() => { setError(null); setShowForm(true) }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{t('logistics.grn.newGRN')}</button>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">{t('common.search')}</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('logistics.grn.searchPlaceholder')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48" />
        </div>
        <Select label={t('common.status')} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="ALL">{t('common.all')}</option>
          {['DRAFT', 'VERIFIED', 'POSTED', 'REVERSED'].map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <div>
          <label className="text-xs text-gray-500 block mb-1">{t('logistics.shipments.fromDate')}</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">{t('logistics.shipments.toDate')}</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={handleApplyDates} className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800">{t('common.apply')}</button>
        {(appliedFrom || appliedTo) && (
          <button onClick={handleClearDates} className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-gray-600">{t('common.clear')}</button>
        )}
      </div>

      {(() => {
        const filteredGrns = grns.filter(g => !search || g.supplierName.toLowerCase().includes(search.toLowerCase()) || (g.invoiceNumber ?? '').toLowerCase().includes(search.toLowerCase()))
        return loading ? (
        <div className="text-center py-12 text-gray-500">{t('logistics.grn.loading')}</div>
      ) : filteredGrns.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t('logistics.grn.empty')}</div>
      ) : (
        <div className="space-y-3">
          {filteredGrns.map(g => (
            <Card key={g.id} padding="none">
              <div className="p-4 flex items-center justify-between flex-wrap gap-2 cursor-pointer" onClick={() => setExpanded(expanded === g.id ? null : g.id)}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{g.grnNumber}</span>
                    <Badge variant={STATUS_VARIANT[g.status] ?? 'neutral'} size="sm">{g.status}</Badge>
                    {g.purchaseOrderId && <Badge variant="brand" size="sm">{t('logistics.grn.linkedToPO')}</Badge>}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{g.supplierName} {g.invoiceNumber && `| Inv: ${g.invoiceNumber}`}</p>
                  <p className="text-xs text-gray-400">{formatDate(g.receivedDate)} · {g.items.length} items</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(g.totalValue)}</p>
                  <div className="flex gap-2 mt-1">
                    {!['POSTED', 'REVERSED'].includes(g.status) && <button onClick={e => { e.stopPropagation(); openEditGRN(g) }} className="text-xs text-blue-600 hover:underline">{t('common.edit')}</button>}
                    {g.status === 'DRAFT' && <button onClick={e => { e.stopPropagation(); verify(g.id) }} className="text-xs text-purple-600 hover:underline">{t('logistics.grn.verify')}</button>}
                    {g.status === 'VERIFIED' && <button onClick={e => { e.stopPropagation(); setConfirmAction({ type: 'post', id: g.id, grnNumber: g.grnNumber }) }} className="text-xs text-green-600 hover:underline">{t('logistics.grn.post')}</button>}
                    {g.status === 'POSTED' && <button onClick={e => { e.stopPropagation(); setConfirmAction({ type: 'reverse', id: g.id, grnNumber: g.grnNumber }) }} className="text-xs text-orange-600 hover:underline">{t('logistics.grn.reverse')}</button>}
                    {g.status === 'DRAFT' && <button onClick={e => { e.stopPropagation(); setConfirmAction({ type: 'delete', id: g.id, grnNumber: g.grnNumber }) }} className="text-xs text-red-500 hover:underline">{t('common.delete')}</button>}
                    <button onClick={e => { e.stopPropagation(); printGRN(g) }} className="text-xs text-gray-500 hover:underline">{t('common.print')}</button>
                  </div>
                </div>
              </div>
              {expanded === g.id && (
                <div className="border-t border-gray-100 px-4 py-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left py-1">Item</th><th className="text-right py-1">{t('logistics.grn.receivedQty')}</th><th className="text-right py-1">{t('logistics.grn.rejectedQty')}</th><th className="text-right py-1">Unit Cost</th><th className="text-right py-1">{t('common.total')}</th></tr></thead>
                    <tbody>
                      {g.items.map(i => (
                        <tr key={i.id} className="border-t border-gray-50">
                          <td className="py-1">
                            {i.itemName}{i.batchNumber && <span className="text-gray-400 ml-1">({i.batchNumber})</span>}
                            {!i.productId && !i.rawMaterialId && <span className="text-amber-500 ml-1" title={t('logistics.grn.unlinkedWarning')}>⚠ {t('logistics.grn.unlinked')}</span>}
                          </td>
                          <td className="text-right">{i.receivedQty} {i.unit}</td>
                          <td className="text-right">{i.rejectedQty}</td>
                          <td className="text-right">{formatCurrency(i.unitCost)}</td>
                          <td className="text-right">{formatCurrency(i.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )
      })()}

      {!loading && total > grns.length && (
        <div className="text-center py-3">
          <p className="text-xs text-gray-400 mb-2">{t('logistics.showingOf', { shown: grns.length, total })}</p>
          <button onClick={() => setLimit(l => l + PAGE_SIZE)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('logistics.loadMore')}</button>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{t('logistics.grn.editGRNTitle')}</h2>
            {grns.find(g => g.id === editId)?.status === 'VERIFIED' && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">{t('logistics.grn.revertToDraftNote')}</div>
            )}
            {editError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{editError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{t('logistics.grn.supplierName')}</label>
                <input value={editForm.supplierName} onChange={e => setEditForm(f => ({ ...f, supplierName: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.grn.invoiceNumber')}</label>
                <input value={editForm.invoiceNumber} onChange={e => setEditForm(f => ({ ...f, invoiceNumber: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.grn.invoiceDate')}</label>
                <input type="date" value={editForm.invoiceDate} onChange={e => setEditForm(f => ({ ...f, invoiceDate: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.grn.receivedDate')}</label>
                <input type="date" value={editForm.receivedDate} onChange={e => setEditForm(f => ({ ...f, receivedDate: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{t('common.notes')}</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">{t('logistics.grn.itemsHeading')}</h3>
                <button onClick={addEditItem} className="text-xs text-blue-600 hover:underline">{t('logistics.shipments.addItem')}</button>
              </div>
              {editItems.map((item, idx) => (
                <div key={idx} className="space-y-1 pb-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <select value={item.productId} onChange={e => handleEditItemProductChange(idx, e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
                      <option value="">{t('logistics.grn.notInCatalog')}</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.productName}{p.sku ? ` (${p.sku})` : ''}</option>)}
                    </select>
                    {item.orderedHint && <span className="text-xs text-gray-400 whitespace-nowrap">{item.orderedHint}</span>}
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <input value={item.itemName} onChange={e => updateEditItem(idx, 'itemName', e.target.value)} placeholder={t('logistics.shipments.itemNamePlaceholder')} className="col-span-3 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="number" min="0" value={item.receivedQty} onChange={e => updateEditItem(idx, 'receivedQty', e.target.value)} placeholder={t('logistics.grn.receivedQty')} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="number" min="0" value={item.rejectedQty} onChange={e => updateEditItem(idx, 'rejectedQty', e.target.value)} placeholder={t('logistics.grn.rejectedQty')} className="col-span-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <select value={item.unit} onChange={e => updateEditItem(idx, 'unit', e.target.value)} className="col-span-1 border border-gray-300 rounded-lg px-1 py-1.5 text-xs">
                      {['PCS', 'KG', 'L', 'M', 'BOX'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input type="number" min="0" value={item.unitCost} onChange={e => updateEditItem(idx, 'unitCost', e.target.value)} placeholder={t('logistics.grn.costLabel', { symbol: currSym })} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input value={item.batchNumber} onChange={e => updateEditItem(idx, 'batchNumber', e.target.value)} placeholder={t('logistics.grn.batch')} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <button onClick={() => removeEditItem(idx)} className="col-span-1 text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
                  </div>
                  <input value={item.notes} onChange={e => updateEditItem(idx, 'notes', e.target.value)} placeholder={t('logistics.shipments.itemNotesPlaceholder')} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-500 placeholder-gray-300" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.cancel')}</button>
              <button onClick={saveEdit} disabled={editSaving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{editSaving ? t('common.loading') : t('common.saveChanges')}</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{t('logistics.grn.newGRNTitle')}</h2>
            {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}

            <Select label={t('logistics.grn.linkToPO')} value={linkedPOId} onChange={e => handlePOLinkChange(e.target.value)} hint={linkedPOId ? t('logistics.grn.poHint') : undefined}>
              <option value="">{t('logistics.grn.noneAdHoc')}</option>
              {approvedPOs.map(po => <option key={po.id} value={po.id}>{po.poNumber} — {po.supplier.supplierName} ({po.status})</option>)}
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Select label={`${t('logistics.grn.supplier')} ${!linkedPOId ? t('logistics.grn.supplierHint') : ''}`} value={form.supplierId} onChange={e => handleSupplierSelect(e.target.value)} disabled={!!linkedPOId}>
                  <option value="">— Not in supplier list (free text name) —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierName}</option>)}
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{t('logistics.grn.supplierName')}</label>
                <input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value, supplierId: f.supplierId && f.supplierName !== e.target.value ? '' : f.supplierId }))} disabled={!!linkedPOId} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.grn.invoiceNumber')}</label>
                <input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.grn.invoiceDate')}</label>
                <input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.grn.receivedDate')}</label>
                <input type="date" value={form.receivedDate} onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{t('common.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">{t('logistics.grn.itemsHeading')}</h3>
                <button onClick={addItem} className="text-xs text-blue-600 hover:underline">{t('logistics.shipments.addItem')}</button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="space-y-1 pb-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <select value={item.productId} onChange={e => handleItemProductChange(idx, e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
                      <option value="">{t('logistics.grn.notInCatalog')}</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.productName}{p.sku ? ` (${p.sku})` : ''}</option>)}
                    </select>
                    {item.orderedHint && <span className="text-xs text-gray-400 whitespace-nowrap">{item.orderedHint}</span>}
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <input value={item.itemName} onChange={e => updateItem(idx, 'itemName', e.target.value)} placeholder={t('logistics.shipments.itemNamePlaceholder')} className="col-span-3 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="number" min="0" value={item.receivedQty} onChange={e => updateItem(idx, 'receivedQty', e.target.value)} placeholder={t('logistics.grn.receivedQty')} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="number" min="0" value={item.rejectedQty} onChange={e => updateItem(idx, 'rejectedQty', e.target.value)} placeholder={t('logistics.grn.rejectedQty')} className="col-span-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="col-span-1 border border-gray-300 rounded-lg px-1 py-1.5 text-xs">
                      {['PCS', 'KG', 'L', 'M', 'BOX'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input type="number" min="0" value={item.unitCost} onChange={e => updateItem(idx, 'unitCost', e.target.value)} placeholder={t('logistics.grn.costLabel', { symbol: currSym })} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input value={item.batchNumber} onChange={e => updateItem(idx, 'batchNumber', e.target.value)} placeholder={t('logistics.grn.batch')} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <button onClick={() => removeItem(idx)} className="col-span-1 text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
                  </div>
                  <input value={item.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} placeholder={t('logistics.shipments.itemNotesPlaceholder')} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-500 placeholder-gray-300" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? t('common.loading') : t('logistics.grn.createGRNBtn')}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        loading={confirmLoading}
        title={confirmAction?.type === 'post' ? t('logistics.grn.post') : confirmAction?.type === 'reverse' ? t('logistics.grn.reverse') : t('common.delete')}
        message={
          confirmAction?.type === 'post' ? t('logistics.grn.postConfirm')
            : confirmAction?.type === 'reverse' ? t('logistics.grn.reverseConfirm', { number: confirmAction.grnNumber })
              : confirmAction ? t('logistics.grn.deleteConfirm', { number: confirmAction.grnNumber }) : ''
        }
        confirmLabel={confirmAction?.type === 'post' ? t('logistics.grn.post') : confirmAction?.type === 'reverse' ? t('logistics.grn.reverse') : t('common.delete')}
      />
    </div>
  )
}
