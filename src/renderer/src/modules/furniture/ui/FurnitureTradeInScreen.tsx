import React, { useState, useEffect, useCallback } from 'react'
import { Repeat, Plus, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'

interface FurnitureTradeIn {
  id: string
  tradeInNumber: string
  customerId: string | null
  customerName: string | null
  itemDescription: string
  condition: string | null
  tradeInValue: number
  invoiceId: string | null
  notes: string | null
  createdAt: string
  customer: { id: string; customerName: string; phone: string | null } | null
}

// Phase 69 — Furniture vertical. Mirrors MetalExchangeScreen.tsx's UI pattern
// exactly (jewellery.ts's exchange screen), swapping the metal-rate-derived
// value for a direct shop-assessed figure. English-only for now, same
// deliberate scope-fork convention as Phase 38's Print Labels screen —
// full-language translation is a later task.
export function FurnitureTradeInScreen(): React.JSX.Element {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const sym = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('furnitureTradeIn.manage')

  const [tradeIns, setTradeIns] = useState<FurnitureTradeIn[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [pickedCustomer, setPickedCustomer] = useState<CustomerLite | null>(null)
  const [walkInName, setWalkInName] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [condition, setCondition] = useState('')
  const [tradeInValue, setTradeInValue] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [linkTarget, setLinkTarget] = useState<FurnitureTradeIn | null>(null)
  const [linkInvoiceNumber, setLinkInvoiceNumber] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<FurnitureTradeIn | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [linking, setLinking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.furnitureTradeIn.list()
      if (res.success) setTradeIns((res.data as FurnitureTradeIn[]) ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load trade-ins.')
    } catch {
      toastError('Error', 'Could not load trade-ins.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { void load() }, [load])

  function resetForm() {
    setPickedCustomer(null)
    setWalkInName('')
    setItemDescription('')
    setCondition('')
    setTradeInValue('')
    setNotes('')
    setError('')
  }

  async function handleCreate() {
    setError('')
    if (!pickedCustomer && !walkInName.trim()) { setError('Select a customer or enter a walk-in name.'); return }
    if (!itemDescription.trim()) { setError('Item description is required.'); return }
    const value = Number(tradeInValue)
    if (!Number.isFinite(value) || value <= 0) { setError('Enter a valid trade-in value greater than zero.'); return }
    setSaving(true)
    try {
      const res = await window.api.furnitureTradeIn.create({
        customerId: pickedCustomer?.id,
        customerName: pickedCustomer ? undefined : walkInName.trim(),
        itemDescription: itemDescription.trim(),
        condition: condition.trim() || undefined,
        tradeInValue: value,
        notes: notes.trim() || undefined,
      })
      if (res.success) {
        const data = res.data as FurnitureTradeIn
        toastSuccess('Trade-in recorded', `${data.tradeInNumber} — ${formatCurrency(data.tradeInValue)} credit`)
        setShowForm(false)
        resetForm()
        await load()
      } else {
        setError(res.error?.message ?? 'Could not record trade-in.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await window.api.furnitureTradeIn.delete({ id: deleteTarget.id })
      if (res.success) { toastSuccess('Deleted', 'Trade-in deleted.'); setDeleteTarget(null); await load() }
      else toastError('Error', res.error?.message ?? 'Could not delete trade-in.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleLink() {
    if (!linkTarget || !linkInvoiceNumber.trim() || linking) return
    setLinking(true)
    try {
      const res = await window.api.furnitureTradeIn.linkToInvoice({ tradeInId: linkTarget.id, invoiceId: linkInvoiceNumber.trim() })
      if (res.success) {
        toastSuccess('Linked', 'Trade-in linked to invoice.')
        setLinkTarget(null)
        setLinkInvoiceNumber('')
        await load()
      } else {
        toastError('Error', res.error?.message ?? 'Could not link trade-in.')
      }
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><Repeat size={20} /> Furniture Trade-Ins</h2>
          <p className="text-sm text-slate-400">Old-item trade-ins credited against a new purchase.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          {canManage && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>Record Trade-In</Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          {pickedCustomer ? (
            <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label="Customer" />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label="Customer (optional)" />
              <Input label="Walk-In Name" placeholder="Walk-in customer" value={walkInName} onChange={(e) => setWalkInName(e.target.value)} disabled={!!pickedCustomer} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Item Description" placeholder="e.g. 3-seater sofa, teak finish" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} />
            <Input label="Condition" placeholder="e.g. Good — minor wear on left arm" value={condition} onChange={(e) => setCondition(e.target.value)} />
          </div>
          <Input label={`Trade-In Value (${sym})`} type="number" step="0.01" min="0" value={tradeInValue} onChange={(e) => setTradeInValue(e.target.value)} />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>Cancel</Button>
            <Button size="sm" onClick={() => void handleCreate()} loading={saving}>Record</Button>
          </div>
        </Card>
      )}

      {linkTarget && (
        <Card padding="md" className="space-y-3 border-brand/40">
          <p className="text-sm font-semibold text-dark">Mark {linkTarget.tradeInNumber} as applied</p>
          <Input label="Invoice ID" placeholder="Invoice ID this trade-in was applied to" value={linkInvoiceNumber} onChange={(e) => setLinkInvoiceNumber(e.target.value)} />
          <p className="text-xs text-slate-400">Credits {formatCurrency(linkTarget.tradeInValue)} against that invoice's global discount.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setLinkTarget(null)} disabled={linking}>Cancel</Button>
            <Button size="sm" onClick={() => void handleLink()} loading={linking}>Link</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : tradeIns.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <Repeat size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No trade-ins recorded yet.</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {tradeIns.map((x) => (
              <div key={x.id} className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{x.tradeInNumber}</span>
                    {x.invoiceId ? (
                      <Badge variant="success" size="sm">Applied to {x.invoiceId}</Badge>
                    ) : (
                      <Badge variant="warning" size="sm">Not yet applied</Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{x.customer?.customerName ?? x.customerName ?? 'Walk-in'}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                    <span>{x.itemDescription}{x.condition ? ` — ${x.condition}` : ''}</span>
                    <span className="font-semibold text-dark dark:text-slate-100">{formatCurrency(x.tradeInValue)} credit</span>
                    <span>{new Date(x.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!x.invoiceId && canManage && (
                    <button onClick={() => { setLinkTarget(x); setLinkInvoiceNumber('') }} className="text-xs px-3 py-1.5 rounded-lg bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 flex items-center gap-1 font-medium">
                      <CheckCircle2 size={12} /> Mark Applied
                    </button>
                  )}
                  {!x.invoiceId && canManage && (
                    <button onClick={() => setDeleteTarget(x)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:text-slate-500"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Trade-In"
        message="This trade-in record will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  )
}
