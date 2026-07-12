import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'

interface FreightEntry {
  id: string; shipmentId: string | null; shipmentNumber: string | null
  carrierId: string | null; carrierName: string; referenceNumber: string | null
  amount: number; paidDate: string | null; paidBy: string; status: string
  notes: string | null; createdAt: string
}

interface Carrier { id: string; name: string }

interface FreightSummary { totalAmount: number; pendingAmount: number; paidAmount: number }

const STATUS_VARIANT: Record<string, 'success' | 'danger'> = {
  PAID: 'success',
  PENDING: 'danger',
}

const PAID_BY_OPTIONS = ['CASH', 'BANK', 'CREDIT', 'UPI']
const EMPTY_FORM = { carrierId: '', carrierName: '', shipmentId: '', referenceNumber: '', amount: '', paidBy: 'CASH', notes: '' }
const EMPTY_EDIT = { carrierId: '', carrierName: '', referenceNumber: '', amount: '', paidBy: 'CASH', notes: '' }

export default function FreightLedgerScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [entries, setEntries] = useState<FreightEntry[]>([])
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterCarrierId, setFilterCarrierId] = useState('')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [form, setForm] = useState({ ...EMPTY_FORM })
  // Edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ ...EMPTY_EDIT })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const currSym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')
  const PAGE_SIZE = 100
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [total, setTotal] = useState(0)

  const filteredEntries = entries.filter(e => !search || e.carrierName.toLowerCase().includes(search.toLowerCase()) || (e.referenceNumber ?? '').toLowerCase().includes(search.toLowerCase()) || (e.shipmentNumber ?? '').toLowerCase().includes(search.toLowerCase()))

  // Sourced from the dedicated summary aggregation (all matching rows for the date
  // range), not the capped/paginated list — the list alone silently under-reports
  // once a business has more entries than the list's row cap.
  const [summary, setSummary] = useState<FreightSummary>({ totalAmount: 0, pendingAmount: 0, paidAmount: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [lr, cr, sr] = await Promise.all([
        window.api.logisticsFreight.list({
          status: filterStatus !== 'ALL' ? filterStatus : undefined,
          carrierId: filterCarrierId || undefined,
          fromDate: appliedFrom || undefined,
          toDate: appliedTo || undefined,
          limit,
        }),
        window.api.logisticsCarrier.list({ activeOnly: true }),
        window.api.logisticsFreight.summary({
          fromDate: appliedFrom || undefined,
          toDate: appliedTo || undefined,
        }),
      ])
      if (lr.success) { setEntries(lr.data as FreightEntry[]); setTotal((lr as { total?: number }).total ?? (lr.data as FreightEntry[]).length) }
      else toastError(t('common.error'), lr.error?.message ?? t('common.error'))
      if (cr.success) setCarriers(cr.data as Carrier[])
      else toastError(t('common.error'), cr.error?.message ?? t('common.error'))
      if (sr.success) setSummary(sr.data as FreightSummary)
      else toastError(t('common.error'), sr.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterCarrierId, appliedFrom, appliedTo, limit, toastError, t])

  useEffect(() => { setLimit(PAGE_SIZE) }, [filterStatus, filterCarrierId, appliedFrom, appliedTo])
  useEffect(() => { load() }, [load])

  const handleApplyDates = () => { setAppliedFrom(fromDate); setAppliedTo(toDate) }
  const handleClearDates = () => { setFromDate(''); setToDate(''); setAppliedFrom(''); setAppliedTo('') }

  const save = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { setError(t('logistics.freight.amountRequired')); return }
    setSaving(true); setError(null)
    const selectedCarrier = carriers.find(c => c.id === form.carrierId)
    const res = await window.api.logisticsFreight.create({
      carrierId: form.carrierId || undefined,
      carrierName: selectedCarrier?.name || form.carrierName || 'Unknown',
      referenceNumber: form.referenceNumber || undefined,
      amount: parseFloat(form.amount),
      paidBy: form.paidBy,
      notes: form.notes || undefined,
    })
    setSaving(false)
    if (res.success) { setShowForm(false); setForm({ ...EMPTY_FORM }); load() }
    else setError(res.error?.message ?? t('common.error'))
  }

  const markPaid = async (id: string) => {
    const res = await window.api.logisticsFreight.markPaid({ id })
    if (!res.success) alert(res.error?.message)
    load()
  }

  const openEditFreight = (e: FreightEntry) => {
    setEditForm({
      carrierId: e.carrierId ?? '',
      carrierName: e.carrierName,
      referenceNumber: e.referenceNumber ?? '',
      amount: e.amount.toString(),
      paidBy: e.paidBy,
      notes: e.notes ?? '',
    })
    setEditId(e.id); setEditError(null)
  }

  const saveEditFreight = async () => {
    if (!editForm.amount || parseFloat(editForm.amount) <= 0) { setEditError(t('logistics.freight.amountRequired')); return }
    setEditSaving(true); setEditError(null)
    const selectedCarrier = carriers.find(c => c.id === editForm.carrierId)
    const res = await window.api.logisticsFreight.update({
      id: editId!,
      carrierId: editForm.carrierId || undefined,
      carrierName: selectedCarrier?.name || editForm.carrierName || undefined,
      referenceNumber: editForm.referenceNumber || undefined,
      amount: parseFloat(editForm.amount),
      paidBy: editForm.paidBy,
      notes: editForm.notes || undefined,
    })
    setEditSaving(false)
    if (res.success) { setEditId(null); load() }
    else setEditError(res.error?.message ?? t('common.error'))
  }

  const deleteFreightEntry = async (e: FreightEntry) => {
    if (!confirm(t('logistics.freight.deleteConfirm', { carrier: e.carrierName, amount: formatCurrency(e.amount) }))) return
    const res = await window.api.logisticsFreight.delete(e.id)
    if (!res.success) alert(res.error?.message)
    else load()
  }

  const printLedger = () => {
    const rows = filteredEntries.map(e => `<tr><td>${formatDate(e.createdAt)}</td><td>${e.carrierName}</td><td>${e.shipmentNumber ?? e.referenceNumber ?? '-'}</td><td>${formatCurrency(e.amount)}</td><td>${e.paidBy}</td><td>${e.paidDate ? formatDate(e.paidDate) : '—'}</td><td>${e.paidDate ? 'PAID' : 'PENDING'}</td></tr>`).join('')
    const html = `<html><head><style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h2{margin-bottom:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px}th{background:#f5f5f5}footer{margin-top:24px;font-size:10px;color:#888;text-align:center}</style></head><body><h2>Freight Ledger</h2><table><thead><tr><th>Entry Date</th><th>Carrier</th><th>Reference</th><th>Amount</th><th>Pay Mode</th><th>Paid Date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><footer>${aszurexFooterHtml(10)}</footer></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">{t('logistics.freight.title')}</h1>
        <div className="flex gap-2">
          <button onClick={printLedger} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">{t('common.print')}</button>
          <button onClick={() => { setError(null); setShowForm(true) }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{t('logistics.freight.addEntry')}</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label={t('logistics.freight.totalFreight')} value={formatCurrency(summary.totalAmount)} color="neutral" />
        <KpiCard label={t('logistics.freight.pending')} value={formatCurrency(summary.pendingAmount)} color="danger" />
        <KpiCard label={t('logistics.freight.paidLabel')} value={formatCurrency(summary.paidAmount)} color="success" />
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">{t('common.search')}</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('logistics.freight.searchPlaceholder')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48" />
        </div>
        <Select label={t('common.status')} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="ALL">{t('logistics.freight.allEntries')}</option>
          <option value="PENDING">{t('logistics.freight.pending')}</option>
          <option value="PAID">{t('logistics.freight.paidLabel')}</option>
        </Select>
        <Select label={t('logistics.freight.carrier')} value={filterCarrierId} onChange={e => setFilterCarrierId(e.target.value)}>
          <option value="">{t('logistics.freight.allCarriers')}</option>
          {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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

      {loading ? (
        <div className="text-center py-12 text-gray-500">{t('logistics.freight.loading')}</div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t('logistics.freight.empty')}</div>
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">{t('common.date')}</th>
                <th className="text-left px-4 py-3">{t('logistics.freight.carrier')}</th>
                <th className="text-left px-4 py-3">{t('logistics.freight.referenceNumber')}</th>
                <th className="text-right px-4 py-3">{t('common.amount')}</th>
                <th className="text-left px-4 py-3">{t('logistics.freight.paymentMode')}</th>
                <th className="text-left px-4 py-3">{t('common.status')}</th>
                <th className="text-left px-4 py-3">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEntries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{e.carrierName}</td>
                  <td className="px-4 py-3 text-gray-500">{e.shipmentNumber ?? e.referenceNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3">{e.paidBy}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[e.status] ?? 'neutral'} size="sm">
                      {e.status === 'PAID' ? t('logistics.freight.paidOn', { date: formatDate(e.paidDate!) }) : t('logistics.freight.pending')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {e.status === 'PENDING' && <button onClick={() => markPaid(e.id)} className="text-xs text-green-600 hover:underline">{t('logistics.freight.markPaid')}</button>}
                      {e.status === 'PENDING' && <button onClick={() => openEditFreight(e)} className="text-xs text-blue-600 hover:underline">{t('common.edit')}</button>}
                      {e.status === 'PENDING' && <button onClick={() => deleteFreightEntry(e)} className="text-xs text-red-500 hover:underline">{t('common.delete')}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {!loading && total > entries.length && (
        <div className="text-center py-3">
          <p className="text-xs text-gray-400 mb-2">{t('logistics.showingOf', { shown: entries.length, total })}</p>
          <button onClick={() => setLimit(l => l + PAGE_SIZE)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('logistics.loadMore')}</button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{t('logistics.freight.addEntryTitle')}</h2>
            {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}
            <div className="space-y-3">
              <Select label={t('logistics.freight.carrier')} value={form.carrierId} onChange={e => setForm(f => ({ ...f, carrierId: e.target.value }))}>
                <option value="">{t('logistics.freight.selectOrType')}</option>
                {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              {!form.carrierId && (
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('logistics.freight.carrierNameManual')}</label>
                  <input value={form.carrierName} onChange={e => setForm(f => ({ ...f, carrierName: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.freight.referenceNumber')}</label>
                <input value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder={t('logistics.freight.refPlaceholder')} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.freight.amountLabel', { symbol: currSym })}</label>
                <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <Select label={t('logistics.freight.paymentMode')} value={form.paidBy} onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))}>
                {PAID_BY_OPTIONS.map(p => <option key={p}>{p}</option>)}
              </Select>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('common.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? t('common.loading') : t('logistics.freight.addEntryBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{t('logistics.freight.editEntryTitle')}</h2>
            {editError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{editError}</div>}
            <div className="space-y-3">
              <Select label={t('logistics.freight.carrier')} value={editForm.carrierId} onChange={e => setEditForm(f => ({ ...f, carrierId: e.target.value }))}>
                <option value="">{t('logistics.freight.selectOrType')}</option>
                {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              {!editForm.carrierId && (
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('logistics.freight.carrierNameManual')}</label>
                  <input value={editForm.carrierName} onChange={e => setEditForm(f => ({ ...f, carrierName: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.freight.referenceNumber')}</label>
                <input value={editForm.referenceNumber} onChange={e => setEditForm(f => ({ ...f, referenceNumber: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.freight.amountLabel', { symbol: currSym })}</label>
                <input type="number" min="0" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <Select label={t('logistics.freight.paymentMode')} value={editForm.paidBy} onChange={e => setEditForm(f => ({ ...f, paidBy: e.target.value }))}>
                {PAID_BY_OPTIONS.map(p => <option key={p}>{p}</option>)}
              </Select>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('common.notes')}</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.cancel')}</button>
              <button onClick={saveEditFreight} disabled={editSaving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{editSaving ? t('common.loading') : t('common.saveChanges')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
