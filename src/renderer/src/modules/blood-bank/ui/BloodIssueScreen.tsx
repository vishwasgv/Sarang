import React, { useState, useEffect, useCallback } from 'react'
import { Send, Plus, RefreshCw, X, AlertTriangle } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { Badge } from '@shared/ui/atoms/Badge'
import { CustomerPicker } from '@shared/ui/molecules/CustomerPicker'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

interface Customer { id: string; customerName: string; phone: string | null }
interface StockUnit { donationRecordId: string; donationNumber: string; bloodGroup: string; componentType: string; expiryDate: string; isExpired: boolean }
interface BloodIssueItem { id: string; bloodGroup: string; componentType: string; price: number; compatibilityNote: string | null; overrideReason: string | null }
interface BloodIssue {
  id: string
  issueNumber: string
  recipientName: string
  purpose: string | null
  status: 'ISSUED' | 'CANCELLED'
  totalAmount: number
  customerId: string | null
  invoiceId: string | null
  createdAt: string
  items: BloodIssueItem[]
  customer?: { customerName: string } | null
}

const BLANK_FORM = { recipientName: '', recipientBloodGroup: '', purpose: '', price: '' }

export function BloodIssueScreen() {
  const { hasPermission } = useAuthStore()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canCreate = hasPermission('bloodBank.create')
  const canManage = hasPermission('bloodBank.manage')

  const [issues, setIssues] = useState<BloodIssue[]>([])
  const [stockUnits, setStockUnits] = useState<StockUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [pickedCustomer, setPickedCustomer] = useState<Customer | null>(null)
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<BloodIssue | null>(null)
  const [incompatibleUnits, setIncompatibleUnits] = useState<{ donationRecordId: string; note: string }[]>([])
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Phase 58 §2 — the compatibility check now BLOCKS issuance by default;
  // this is the explicit, documented emergency-release override, not a
  // silent bypass. Reset whenever the incompatible set changes, so a stale
  // override reason can't silently carry over onto a DIFFERENT incompatible unit.
  const [overrideIncompatibility, setOverrideIncompatibility] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [iRes, sRes] = await Promise.all([
        api.bloodBank.listIssues({ limit: 200 }),
        api.bloodBank.getBloodStock(),
      ])
      if (iRes.success && iRes.data) {
        const d = iRes.data as { issues: BloodIssue[]; total: number }
        setIssues(d.issues ?? [])
      } else {
        toastError('Failed', iRes.error?.message ?? 'Could not load blood issues.')
      }
      if (sRes.success && sRes.data) {
        const d = sRes.data as { units: StockUnit[] }
        setStockUnits((d.units ?? []).filter((u) => !u.isExpired))
      } else {
        toastError('Failed', sRes.error?.message ?? 'Could not load blood stock.')
      }
    } catch {
      toastError('Failed', 'Could not load blood issue data.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  function toggleUnit(id: string) {
    setSelectedUnitIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // Real ABO/Rh compatibility check, delegated to the backend (single source
  // of truth for this safety-relevant calculation) rather than re-deriving
  // the matrix here — re-runs whenever the recipient group or selection changes.
  useEffect(() => {
    if (!form.recipientBloodGroup || selectedUnitIds.length === 0) { setIncompatibleUnits([]); return }
    const units = selectedUnitIds
      .map((id) => stockUnits.find((u) => u.donationRecordId === id))
      .filter((u): u is StockUnit => !!u)
      .map((u) => ({ donationRecordId: u.donationRecordId, bloodGroup: u.bloodGroup, componentType: u.componentType }))
    if (units.length === 0) { setIncompatibleUnits([]); return }
    let cancelled = false
    api.bloodBank.checkCompatibilityBatch({ recipientBloodGroup: form.recipientBloodGroup, units })
      .then((res) => {
        if (cancelled) return
        if (!res.success || !res.data) {
          toastError('Failed', res.error?.message ?? 'Could not verify blood compatibility.')
          return
        }
        const results = res.data as Array<{ donationRecordId: string; compatible: boolean; note: string }>
        setIncompatibleUnits(results.filter((r) => !r.compatible).map((r) => ({ donationRecordId: r.donationRecordId, note: r.note })))
        setOverrideIncompatibility(false)
        setOverrideReason('')
      })
      .catch(() => {
        if (!cancelled) toastError('Failed', 'Could not verify blood compatibility.')
      })
    return () => { cancelled = true }
  }, [form.recipientBloodGroup, selectedUnitIds, stockUnits, toastError])

  async function handleCreate() {
    if (!form.recipientName.trim()) { toastError('Missing Recipient', "Enter the recipient's name."); return }
    if (selectedUnitIds.length === 0) { toastError('No Units Selected', 'Select at least one unit to issue.'); return }
    // Phase 58 §2 — client-side mirror of the server-side block, so the
    // cashier gets an immediate, specific message instead of a generic
    // "Could not issue units." after a round-trip. The server enforces this
    // regardless — this is a UX improvement, not the actual safety gate.
    if (incompatibleUnits.length > 0 && !overrideIncompatibility) {
      toastError('Incompatible Units Selected', 'Check "Override — emergency release" and document a reason to proceed.')
      return
    }
    if (incompatibleUnits.length > 0 && overrideIncompatibility && !overrideReason.trim()) {
      toastError('Reason Required', 'Enter a documented reason for the emergency-release override.')
      return
    }
    setSaving(true)
    const res = await api.bloodBank.createIssue({
      customerId: pickedCustomer?.id || undefined,
      recipientName: form.recipientName.trim(),
      recipientBloodGroup: form.recipientBloodGroup || undefined,
      purpose: form.purpose || undefined,
      donationRecordIds: selectedUnitIds,
      price: form.price ? Number(form.price) : undefined,
      overrideIncompatibility: incompatibleUnits.length > 0 ? overrideIncompatibility : undefined,
      overrideReason: incompatibleUnits.length > 0 ? overrideReason.trim() || undefined : undefined,
    })
    setSaving(false)
    if (res.success) {
      toastSuccess('Units Issued', 'Blood units issued successfully.')
      setShowCreate(false)
      setForm({ ...BLANK_FORM })
      setPickedCustomer(null)
      setSelectedUnitIds([])
      setOverrideIncompatibility(false)
      setOverrideReason('')
      load()
    } else {
      toastError('Failed', (res.error as { message: string })?.message ?? 'Could not issue units.')
    }
  }

  async function refreshDetail(id: string) {
    try {
      const res = await api.bloodBank.getIssue({ id })
      if (res.success && res.data) {
        setDetail(res.data as BloodIssue)
      } else {
        toastError('Failed', res.error?.message ?? 'Could not refresh issue details.')
      }
    } catch {
      toastError('Failed', 'Could not refresh issue details.')
    }
  }

  async function handleCancel() {
    if (!detail) return
    setCancelling(true)
    const res = await api.bloodBank.cancelIssue({ id: detail.id })
    setCancelling(false)
    setConfirmCancel(false)
    if (res.success) { toastSuccess('Issue Cancelled', 'Units returned to stock.'); setDetail(null); load() }
    else toastError('Failed', (res.error as { message: string })?.message ?? 'Could not cancel issue.')
  }

  async function handleGenerateInvoice(id: string) {
    const res = await api.bloodBank.generateIssueInvoice({ id })
    if (res.success) { toastSuccess('Invoice Generated', 'Invoice generated for this issue.'); refreshDetail(id); load() }
    else toastError('Failed', (res.error as { message: string })?.message ?? 'Could not generate invoice.')
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Send size={24} className="text-brand" />
              Blood Issue
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{issues.filter((i) => i.status === 'ISSUED').length} active issues</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <button onClick={() => setShowCreate(true)} className="h-11 px-4 flex items-center gap-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
                <Plus size={16} /> Issue Units
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
        ) : issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Send size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">No blood issued yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((i) => (
              <button key={i.id} onClick={() => refreshDetail(i.id)}
                className="w-full text-left bg-white dark:bg-slate-900 rounded-xl border border-border p-4 hover:border-brand/40 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-text-secondary">{i.issueNumber}</span>
                      <Badge variant={i.status === 'ISSUED' ? 'success' : 'danger'} size="sm">{i.status}</Badge>
                    </div>
                    <p className="mt-1 font-semibold text-text-primary">{i.recipientName}</p>
                    <p className="text-sm text-text-secondary">{i.items.length} unit(s) · {i.items.map((it) => it.bloodGroup).join(', ')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-text-primary">{formatCurrency(i.totalAmount)}</p>
                    <p className="text-xs text-text-secondary">{formatDate(i.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary">Issue Blood Units</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Recipient Name</label>
                <input value={form.recipientName} onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Recipient Blood Group</label>
                  <select value={form.recipientBloodGroup} onChange={(e) => setForm((f) => ({ ...f, recipientBloodGroup: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base bg-white dark:bg-slate-900">
                    <option value="">Unknown</option>
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <CustomerPicker
                    label="Customer (optional — needed to invoice)"
                    value={pickedCustomer}
                    onChange={setPickedCustomer}
                    placeholder="Search by name or phone..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Purpose</label>
                  <input value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                    placeholder="e.g. Surgery transfusion" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Price per Unit</label>
                  <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Select Available Units ({selectedUnitIds.length} selected)</label>
                <div className="max-h-56 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                  {stockUnits.length === 0 ? (
                    <p className="p-4 text-sm text-text-secondary">No units currently in stock.</p>
                  ) : stockUnits.map((u) => (
                    <label key={u.donationRecordId} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-hover">
                      <input type="checkbox" checked={selectedUnitIds.includes(u.donationRecordId)} onChange={() => toggleUnit(u.donationRecordId)} />
                      <span className="font-mono text-xs text-text-secondary">{u.donationNumber}</span>
                      <Badge variant="brand" size="sm">{u.bloodGroup}</Badge>
                      <span className="text-xs text-text-secondary">{u.componentType.replace('_', ' ')}</span>
                      <span className="text-xs text-text-secondary ml-auto">Expires {formatDate(u.expiryDate)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Phase 58 §2 — this now BLOCKS issuance by default (it used
                  to be advisory-only, with nothing actually stopping an
                  incompatible unit from going out). An explicit, documented
                  override is required for the rare legitimate emergency
                  case — never a silent bypass. */}
              {incompatibleUnits.length > 0 && (
                <div className="bg-danger/5 border border-danger/20 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
                    <div className="text-xs text-text-secondary space-y-1">
                      <p><strong className="text-danger">Incompatible unit(s) — issuance blocked.</strong> Not a substitute for a real crossmatch test:</p>
                      {incompatibleUnits.map((u) => <p key={u.donationRecordId}>{u.note}</p>)}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-text-primary pl-6">
                    <input type="checkbox" checked={overrideIncompatibility} onChange={(e) => setOverrideIncompatibility(e.target.checked)} />
                    Override — emergency release (documented reason required)
                  </label>
                  {overrideIncompatibility && (
                    <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={2}
                      placeholder="Why this incompatible unit is being issued anyway (e.g. life-threatening emergency, no compatible unit in stock, physician's order)..."
                      className="w-full px-3 py-2 ml-6 rounded-lg border border-border text-xs resize-none" style={{ width: 'calc(100% - 1.5rem)' }} />
                  )}
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 h-12 rounded-xl border border-border text-text-secondary font-semibold hover:bg-surface-hover transition-colors">Cancel</button>
              <button onClick={handleCreate}
                disabled={saving || selectedUnitIds.length === 0 || (incompatibleUnits.length > 0 && (!overrideIncompatibility || !overrideReason.trim()))}
                className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                {saving ? 'Issuing…' : 'Issue Units'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-xs text-text-secondary">{detail.issueNumber}</span>
                <h2 className="text-lg font-bold text-text-primary mt-0.5">{detail.recipientName}</h2>
              </div>
              <button onClick={() => setDetail(null)} className="text-text-secondary hover:text-text-primary text-2xl leading-none shrink-0">×</button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <Badge variant={detail.status === 'ISSUED' ? 'success' : 'danger'} size="sm">{detail.status}</Badge>
              {detail.purpose && <div className="flex justify-between"><span className="text-text-secondary">Purpose</span><span className="text-text-primary">{detail.purpose}</span></div>}
              <div className="space-y-2">
                {detail.items.map((it) => (
                  <div key={it.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2"><Badge variant="brand" size="sm">{it.bloodGroup}</Badge><span className="text-xs text-text-secondary">{it.componentType.replace('_', ' ')}</span><span className="ml-auto text-xs font-semibold">{formatCurrency(it.price)}</span></div>
                    {it.compatibilityNote && <p className={`text-xs mt-1 ${it.overrideReason ? 'text-danger' : 'text-text-secondary'}`}>{it.compatibilityNote}</p>}
                    {it.overrideReason && <p className="text-xs text-text-secondary mt-0.5"><strong>Override reason:</strong> {it.overrideReason}</p>}
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2 border-t border-border"><span className="text-text-secondary">Total</span><span className="font-semibold text-text-primary">{formatCurrency(detail.totalAmount)}</span></div>

              {canCreate && detail.customerId && !detail.invoiceId && detail.status === 'ISSUED' && (
                <button onClick={() => handleGenerateInvoice(detail.id)} className="w-full h-11 rounded-xl border border-brand text-brand text-sm font-semibold hover:bg-brand/5 transition-colors">Generate Invoice</button>
              )}
              {canManage && detail.status === 'ISSUED' && !detail.invoiceId && (
                <button onClick={() => setConfirmCancel(true)} className="w-full h-11 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">Cancel Issue</button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
        loading={cancelling}
        title="Cancel Issue"
        message="Cancel this issue and return all units to stock?"
        confirmLabel="Cancel Issue"
      />
    </div>
  )
}
