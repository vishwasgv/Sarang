import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@shared/utils/currency.util'
import { useBusinessStore } from '@app/store/business.store'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'

interface ChallanItem {
  id: string; productId: string | null; productName: string; quantity: number
  returnedQty: number; unit: string; unitValue: number; totalValue: number; notes: string | null
}

interface Challan {
  id: string; challanNumber: string; challanType: string; customerId: string | null
  customerName: string; customerAddress: string | null; shipmentId: string | null; invoiceId: string | null
  vehicleId: string | null; vehicleNumber: string | null; driverName: string | null; driverPhone: string | null
  dispatchDate: string | null; expectedReturn: string | null; returnedAt: string | null
  status: string; totalValue: number; notes: string | null; createdAt: string; items: ChallanItem[]
}

interface Vehicle { id: string; vehicleNumber: string; driverName: string | null; status: string }

const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  ISSUED: 'info',
  DELIVERED: 'success',
  RETURNED: 'warning',
  CANCELLED: 'danger',
}

const EMPTY_FORM = { challanType: 'DELIVERY', customerName: '', customerAddress: '', vehicleId: '', driverName: '', driverPhone: '', dispatchDate: '', expectedReturn: '', notes: '' }
const EMPTY_ITEM = { productName: '', quantity: '', unit: 'PCS', unitValue: '', notes: '' }

interface ReturnItem { itemId: string; productName: string; quantity: number; returnedQty: number }

export default function ChallanScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [challans, setChallans] = useState<Challan[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterType, setFilterType] = useState('ALL')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])
  // Return dialog state
  const [returnChallanId, setReturnChallanId] = useState<string | null>(null)
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])
  const [returnSaving, setReturnSaving] = useState(false)
  const [returnError, setReturnError] = useState<string | null>(null)
  // Edit state for DRAFT challans
  const [editChallanId, setEditChallanId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM })
  const [editItems, setEditItems] = useState<typeof EMPTY_ITEM[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const currSym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')
  const profile = useBusinessStore(s => s.profile)
  const PAGE_SIZE = 100
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cr, vr] = await Promise.all([
        window.api.logisticsChallan.list({
          status: filterStatus !== 'ALL' ? filterStatus : undefined,
          challanType: filterType !== 'ALL' ? filterType : undefined,
          limit,
        }),
        window.api.logisticsVehicle.list(),
      ])
      if (cr.success) { setChallans(cr.data as Challan[]); setTotal((cr as { total?: number }).total ?? (cr.data as Challan[]).length) }
      else toastError(t('common.error'), cr.error?.message ?? t('common.error'))
      if (vr.success) setVehicles(vr.data as Vehicle[])
      else toastError(t('common.error'), vr.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterType, limit, toastError, t])

  useEffect(() => { setLimit(PAGE_SIZE) }, [filterStatus, filterType])
  useEffect(() => { load() }, [load])

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
  const updateItem = (idx: number, field: string, value: string) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))

  const save = async () => {
    if (!form.customerName.trim()) { setError(t('logistics.challan.customerNameRequired')); return }
    const validItems = items.filter(i => i.productName.trim() && parseFloat(i.quantity) > 0)
    if (!validItems.length) { setError(t('logistics.challan.atLeastOneValidItem')); return }
    setSaving(true); setError(null)
    const res = await window.api.logisticsChallan.create({
      challanType: form.challanType, customerName: form.customerName,
      customerAddress: form.customerAddress || undefined,
      vehicleId: form.vehicleId || undefined,
      driverName: form.driverName || undefined, driverPhone: form.driverPhone || undefined,
      dispatchDate: form.dispatchDate || undefined, expectedReturn: form.expectedReturn || undefined,
      notes: form.notes || undefined,
      items: validItems.map(i => ({ productName: i.productName, quantity: parseFloat(i.quantity), unit: i.unit, unitValue: i.unitValue ? parseFloat(i.unitValue) : 0, notes: i.notes || undefined }))
    })
    setSaving(false)
    if (res.success) { setShowForm(false); setForm({ ...EMPTY_FORM }); setItems([{ ...EMPTY_ITEM }]); load() }
    else setError(res.error?.message ?? t('common.error'))
  }

  const changeStatus = async (id: string, status: string) => {
    const res = await window.api.logisticsChallan.updateStatus({ id, status })
    if (!res.success) alert(res.error?.message)
    load()
  }

  const openEdit = (c: Challan) => {
    setEditForm({
      challanType: c.challanType, customerName: c.customerName,
      customerAddress: c.customerAddress ?? '', vehicleId: c.vehicleId ?? '',
      driverName: c.driverName ?? '', driverPhone: c.driverPhone ?? '',
      dispatchDate: c.dispatchDate ? c.dispatchDate.split('T')[0] : '',
      expectedReturn: c.expectedReturn ? c.expectedReturn.split('T')[0] : '',
      notes: c.notes ?? '',
    })
    setEditItems(c.items.map(i => ({
      productName: i.productName, quantity: i.quantity.toString(),
      unit: i.unit, unitValue: i.unitValue.toString(), notes: i.notes ?? '',
    })))
    setEditChallanId(c.id); setEditError(null)
  }

  const addEditItem = () => setEditItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeEditItem = (idx: number) => setEditItems(prev => prev.filter((_, i) => i !== idx))
  const updateEditItem = (idx: number, field: string, value: string) =>
    setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))

  const saveEdit = async () => {
    if (!editForm.customerName.trim()) { setEditError(t('logistics.challan.customerNameRequired')); return }
    const validEditItems = editItems.filter(i => i.productName.trim() && parseFloat(i.quantity) > 0)
    if (!validEditItems.length) { setEditError(t('logistics.challan.atLeastOneValidItem')); return }
    setEditSaving(true); setEditError(null)
    const res = await window.api.logisticsChallan.update({
      id: editChallanId!,
      challanType: editForm.challanType, customerName: editForm.customerName,
      customerAddress: editForm.customerAddress || undefined,
      vehicleId: editForm.vehicleId || null,
      driverName: editForm.driverName || undefined, driverPhone: editForm.driverPhone || undefined,
      dispatchDate: editForm.dispatchDate || undefined,
      expectedReturn: editForm.challanType === 'RETURNABLE' ? (editForm.expectedReturn || undefined) : null,
      notes: editForm.notes || undefined,
      items: validEditItems.map(i => ({
        productName: i.productName, quantity: parseFloat(i.quantity),
        unit: i.unit, unitValue: parseFloat(i.unitValue) || 0, notes: i.notes || undefined,
      })),
    })
    setEditSaving(false)
    if (res.success) { setEditChallanId(null); load() }
    else setEditError(res.error?.message ?? t('common.error'))
  }

  const deleteChallan = async (c: Challan) => {
    if (!confirm(t('logistics.challan.deleteConfirm', { number: c.challanNumber }))) return
    const res = await window.api.logisticsChallan.delete(c.id)
    if (!res.success) alert(res.error?.message)
    else load()
  }

  const openReturnDialog = (c: Challan) => {
    setReturnChallanId(c.id)
    setReturnItems(c.items.map(i => ({ itemId: i.id, productName: i.productName, quantity: i.quantity, returnedQty: i.quantity })))
    setReturnError(null)
  }

  const submitReturn = async () => {
    if (!returnChallanId) return
    if (!returnItems.some(i => i.returnedQty > 0)) { setReturnError(t('logistics.challan.atLeastOneReturnQty')); return }
    setReturnSaving(true); setReturnError(null)
    const res = await window.api.logisticsChallan.recordReturn({
      id: returnChallanId,
      items: returnItems.map(i => ({ itemId: i.itemId, returnedQty: i.returnedQty })),
    })
    setReturnSaving(false)
    if (res.success) { setReturnChallanId(null); load() }
    else setReturnError(res.error?.message ?? t('common.error'))
  }

  const printChallan = async (c: Challan) => {
    // Open the popup synchronously, still inside the click's user-gesture window —
    // awaiting the logo IPC call *before* window.open() risks losing that gesture
    // association and having the popup silently blocked. Write to it once ready.
    const w = window.open('', '_blank')
    const rows = c.items.map(i => `<tr><td>${i.productName}</td><td>${i.quantity}</td><td>${i.returnedQty || '-'}</td><td>${i.unit}</td><td>${formatCurrency(i.unitValue)}</td><td>${formatCurrency(i.totalValue)}</td></tr>`).join('')
    // A window.open()/document.write() popup has no resolvable file:// base, so the
    // logo must travel as a self-contained base64 data URI (same technique already
    // used for the Aszurex partnership mark below), not a file path.
    const logoRes = await api.app.getBusinessLogoDataUri()
    const logoDataUri = logoRes.success ? logoRes.data : null
    const bizName = profile?.businessName ?? ''
    const bizAddr = [profile?.address, profile?.city, profile?.state].filter(Boolean).join(', ')
    const watermarkHtml = profile?.enableDocumentWatermark && logoDataUri
      ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);opacity:0.08;z-index:-1;pointer-events:none;"><img src="${logoDataUri}" style="width:60vw;max-width:400px;object-fit:contain;" alt="" /></div>`
      : ''
    const logoImgHtml = logoDataUri ? `<img src="${logoDataUri}" alt="" style="max-height:48px;max-width:120px;object-fit:contain;display:block;margin-bottom:6px;" />` : ''
    const html = `<html><head><style>body{position:relative;z-index:0;font-family:Arial,sans-serif;font-size:12px;padding:20px}h2{margin-bottom:16px}.biz{margin-bottom:12px}.biz-name{font-size:15px;font-weight:bold}.biz-addr{font-size:11px;color:#666}.meta{margin-bottom:12px;font-size:11px;color:#666}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px}th{background:#f5f5f5}.total{text-align:right;font-weight:bold;margin-top:8px}footer{margin-top:24px;font-size:10px;color:#888;text-align:center}</style></head><body>${watermarkHtml}<div class="biz">${logoImgHtml}${bizName ? `<div class="biz-name">${bizName}</div>` : ''}${bizAddr ? `<div class="biz-addr">${bizAddr}</div>` : ''}</div><h2>Delivery Challan: ${c.challanNumber}</h2><div class="meta">Customer: ${c.customerName} | Type: ${c.challanType} | Vehicle: ${c.vehicleNumber ?? '-'} | Driver: ${c.driverName ?? '-'}</div><table><thead><tr><th>Item</th><th>Qty</th><th>Returned</th><th>Unit</th><th>Value</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Total: ${formatCurrency(c.totalValue)}</div><footer>${aszurexFooterHtml(10)}</footer></body></html>`
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">{t('logistics.challan.title')}</h1>
        <button onClick={() => { setError(null); setShowForm(true) }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{t('logistics.challan.newChallan')}</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('logistics.challan.searchPlaceholder')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-52" />
        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="ALL">{t('common.all')}</option>
          {['DRAFT', 'ISSUED', 'DELIVERED', 'RETURNED'].map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="ALL">{t('logistics.challan.allTypes')}</option>
          {['DELIVERY', 'RETURNABLE', 'BRANCH_TRANSFER'].map(ct => <option key={ct} value={ct}>{ct}</option>)}
        </Select>
      </div>

      {(() => {
        const filteredChallans = challans.filter(c => !search || c.customerName.toLowerCase().includes(search.toLowerCase()) || c.challanNumber.toLowerCase().includes(search.toLowerCase()))
        return loading ? (
        <div className="text-center py-12 text-gray-500">{t('logistics.challan.loading')}</div>
      ) : filteredChallans.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t('logistics.challan.empty')}</div>
      ) : (
        <div className="space-y-3">
          {filteredChallans.map(c => (
            <Card key={c.id} padding="none">
              <div className="p-4 flex items-start justify-between flex-wrap gap-2 cursor-pointer" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.challanNumber}</span>
                    <Badge variant={STATUS_VARIANT[c.status] ?? 'neutral'} size="sm">{c.status}</Badge>
                    <span className="text-xs text-gray-400">{c.challanType}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{c.customerName}</p>
                  {c.vehicleNumber && <p className="text-xs text-gray-400">{t('logistics.challan.vehicleLabel')} {c.vehicleNumber}{c.driverName ? ` (${c.driverName})` : ''}</p>}
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(c.totalValue)}</p>
                  <p className="text-xs text-gray-400">{t('logistics.challan.itemsCount', { count: c.items.length })}</p>
                  <div className="flex gap-2 mt-1 justify-end flex-wrap">
                    {c.status === 'DRAFT' && <button onClick={e => { e.stopPropagation(); openEdit(c) }} className="text-xs text-blue-600 hover:underline">{t('common.edit')}</button>}
                    {c.status === 'DRAFT' && <button onClick={e => { e.stopPropagation(); deleteChallan(c) }} className="text-xs text-red-500 hover:underline">{t('common.delete')}</button>}
                    {c.status === 'DRAFT' && <button onClick={e => { e.stopPropagation(); changeStatus(c.id, 'ISSUED') }} className="text-xs text-indigo-600 hover:underline">{t('logistics.challan.issue')}</button>}
                    {c.status === 'ISSUED' && c.challanType !== 'RETURNABLE' && <button onClick={e => { e.stopPropagation(); changeStatus(c.id, 'DELIVERED') }} className="text-xs text-green-600 hover:underline">{t('logistics.challan.markDelivered')}</button>}
                    {c.challanType === 'RETURNABLE' && c.status === 'ISSUED' && <button onClick={e => { e.stopPropagation(); openReturnDialog(c) }} className="text-xs text-orange-600 hover:underline">{t('logistics.challan.recordReturn')}</button>}
                    {['DRAFT', 'ISSUED'].includes(c.status) && <button onClick={e => { e.stopPropagation(); if (confirm(t('logistics.challan.cancelConfirm', { number: c.challanNumber }))) changeStatus(c.id, 'CANCELLED') }} className="text-xs text-gray-500 hover:underline">{t('logistics.challan.cancelChallan')}</button>}
                    <button onClick={e => { e.stopPropagation(); printChallan(c) }} className="text-xs text-gray-500 hover:underline">{t('common.print')}</button>
                  </div>
                </div>
              </div>
              {expanded === c.id && (
                <div className="border-t border-gray-100 px-4 py-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left py-1">Item</th><th className="text-right py-1">{t('logistics.shipments.qty')}</th><th className="text-right py-1">{t('logistics.grn.rejectedQty')}</th><th className="text-right py-1">{t('common.unit')}</th><th className="text-right py-1">{t('common.total')}</th></tr></thead>
                    <tbody>
                      {c.items.map(i => (
                        <tr key={i.id} className="border-t border-gray-50">
                          <td className="py-1">{i.productName}</td>
                          <td className="text-right">{i.quantity}</td>
                          <td className="text-right">{i.returnedQty > 0 ? i.returnedQty : '—'}</td>
                          <td className="text-right">{i.unit}</td>
                          <td className="text-right">{formatCurrency(i.totalValue)}</td>
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

      {!loading && total > challans.length && (
        <div className="text-center py-3">
          <p className="text-xs text-gray-400 mb-2">{t('logistics.showingOf', { shown: challans.length, total })}</p>
          <button onClick={() => setLimit(l => l + PAGE_SIZE)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('logistics.loadMore')}</button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{t('logistics.challan.newChallanTitle')}</h2>
            {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <Select label={t('logistics.challan.challanType')} value={form.challanType} onChange={e => setForm(f => ({ ...f, challanType: e.target.value }))}>
                {['DELIVERY', 'RETURNABLE', 'BRANCH_TRANSFER'].map(ct => <option key={ct}>{ct}</option>)}
              </Select>
              <Select label={t('logistics.shipments.vehicle')} value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                <option value="">{t('common.selectItem')}</option>
                {vehicles.filter(v => v.status === 'AVAILABLE' || v.id === (editChallanId ? editForm.vehicleId : form.vehicleId)).map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}{v.driverName ? ` (${v.driverName})` : ''}{v.status !== 'AVAILABLE' ? ` [${v.status}]` : ''}</option>)}
              </Select>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{t('logistics.challan.customerName')}</label>
                <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{t('logistics.challan.customerAddress')}</label>
                <textarea value={form.customerAddress} onChange={e => setForm(f => ({ ...f, customerAddress: e.target.value }))} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.challan.driverName')}</label>
                <input value={form.driverName} onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.challan.driverPhone')}</label>
                <input value={form.driverPhone} onChange={e => setForm(f => ({ ...f, driverPhone: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.challan.dispatchDate')}</label>
                <input type="date" value={form.dispatchDate} onChange={e => setForm(f => ({ ...f, dispatchDate: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              {form.challanType === 'RETURNABLE' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('logistics.challan.expectedReturn')}</label>
                  <input type="date" value={form.expectedReturn} onChange={e => setForm(f => ({ ...f, expectedReturn: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
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
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <input value={item.productName} onChange={e => updateItem(idx, 'productName', e.target.value)} placeholder={t('logistics.challan.productNamePlaceholder')} className="col-span-5 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="number" min="0" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder={t('logistics.shipments.qty')} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="col-span-2 border border-gray-300 rounded-lg px-1 py-1.5 text-xs">
                      {['PCS', 'KG', 'L', 'M', 'BOX'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input type="number" min="0" value={item.unitValue} onChange={e => updateItem(idx, 'unitValue', e.target.value)} placeholder={t('logistics.challan.valuePlaceholder', { symbol: currSym })} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <button onClick={() => removeItem(idx)} className="col-span-1 text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
                  </div>
                  <input value={item.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} placeholder={t('logistics.shipments.itemNotesPlaceholder')} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-500 placeholder-gray-300" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? t('common.loading') : t('common.create')}</button>
            </div>
          </div>
        </div>
      )}

      {editChallanId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{t('logistics.challan.editChallan')}</h2>
            {editError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{editError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <Select label={t('logistics.challan.challanType')} value={editForm.challanType} onChange={e => {
                const newType = e.target.value
                setEditForm(f => ({ ...f, challanType: newType, expectedReturn: newType === 'RETURNABLE' ? f.expectedReturn : '' }))
              }}>
                {['DELIVERY', 'RETURNABLE', 'BRANCH_TRANSFER'].map(ct => <option key={ct}>{ct}</option>)}
              </Select>
              <Select label={t('logistics.shipments.vehicle')} value={editForm.vehicleId} onChange={e => setEditForm(f => ({ ...f, vehicleId: e.target.value }))}>
                <option value="">{t('common.selectItem')}</option>
                {vehicles.filter(v => v.status === 'AVAILABLE' || v.id === (editChallanId ? editForm.vehicleId : form.vehicleId)).map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}{v.driverName ? ` (${v.driverName})` : ''}{v.status !== 'AVAILABLE' ? ` [${v.status}]` : ''}</option>)}
              </Select>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{t('logistics.challan.customerName')}</label>
                <input value={editForm.customerName} onChange={e => setEditForm(f => ({ ...f, customerName: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{t('logistics.challan.customerAddress')}</label>
                <textarea value={editForm.customerAddress} onChange={e => setEditForm(f => ({ ...f, customerAddress: e.target.value }))} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.challan.driverName')}</label>
                <input value={editForm.driverName} onChange={e => setEditForm(f => ({ ...f, driverName: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.challan.driverPhone')}</label>
                <input value={editForm.driverPhone} onChange={e => setEditForm(f => ({ ...f, driverPhone: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.challan.dispatchDate')}</label>
                <input type="date" value={editForm.dispatchDate} onChange={e => setEditForm(f => ({ ...f, dispatchDate: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              {editForm.challanType === 'RETURNABLE' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('logistics.challan.expectedReturn')}</label>
                  <input type="date" value={editForm.expectedReturn} onChange={e => setEditForm(f => ({ ...f, expectedReturn: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
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
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <input value={item.productName} onChange={e => updateEditItem(idx, 'productName', e.target.value)} placeholder={t('logistics.challan.productNamePlaceholder')} className="col-span-5 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="number" min="0" value={item.quantity} onChange={e => updateEditItem(idx, 'quantity', e.target.value)} placeholder={t('logistics.shipments.qty')} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <select value={item.unit} onChange={e => updateEditItem(idx, 'unit', e.target.value)} className="col-span-2 border border-gray-300 rounded-lg px-1 py-1.5 text-xs">
                      {['PCS', 'KG', 'L', 'M', 'BOX'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input type="number" min="0" value={item.unitValue} onChange={e => updateEditItem(idx, 'unitValue', e.target.value)} placeholder={t('logistics.challan.valuePlaceholder', { symbol: currSym })} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <button onClick={() => removeEditItem(idx)} className="col-span-1 text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
                  </div>
                  <input value={item.notes} onChange={e => updateEditItem(idx, 'notes', e.target.value)} placeholder={t('logistics.shipments.itemNotesPlaceholder')} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-500 placeholder-gray-300" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditChallanId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.cancel')}</button>
              <button onClick={saveEdit} disabled={editSaving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{editSaving ? t('common.loading') : t('common.saveChanges')}</button>
            </div>
          </div>
        </div>
      )}

      {returnChallanId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{t('logistics.challan.returnDialogTitle')}</h2>
            <p className="text-xs text-gray-500">{t('logistics.challan.returnDialogHint')}</p>
            {returnError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{returnError}</div>}
            <div className="space-y-2">
              {returnItems.map((ri, idx) => (
                <div key={ri.itemId} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-700">{ri.productName}</span>
                  <span className="text-xs text-gray-400">{t('logistics.challan.ofQty', { qty: ri.quantity })}</span>
                  <input
                    type="number" min={0} max={ri.quantity} value={ri.returnedQty}
                    onChange={e => setReturnItems(prev => prev.map((r, i) => i === idx ? { ...r, returnedQty: Math.min(ri.quantity, Math.max(0, parseInt(e.target.value) || 0)) } : r))}
                    className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setReturnChallanId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.cancel')}</button>
              <button onClick={submitReturn} disabled={returnSaving} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">{returnSaving ? t('logistics.challan.recording') : t('logistics.challan.confirmReturn')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
