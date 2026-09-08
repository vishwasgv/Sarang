import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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

const COMPONENT_LABEL_KEY: Record<string, string> = {
  WHOLE_BLOOD: 'componentWholeBlood',
  PACKED_RBC: 'componentPackedRbc',
  PLATELETS: 'componentPlatelets',
  PLASMA: 'componentPlasma',
  CRYOPRECIPITATE: 'componentCryoprecipitate',
}

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
  const { t } = useTranslation()
  const { hasPermission } = useAuthStore()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canCreate = hasPermission('bloodBank.create')
  const canManage = hasPermission('bloodBank.manage')

  function componentLabel(type: string): string {
    const key = COMPONENT_LABEL_KEY[type]
    return key ? t(`bloodBank.${key}`) : type.replace('_', ' ')
  }

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
  const [generatingInvoice, setGeneratingInvoice] = useState(false)

  // Phase 58 §2 — the compatibility check now BLOCKS issuance by default;
  // this is the explicit, documented emergency-release override, not a
  // silent bypass. Reset whenever the incompatible set changes, so a stale
  // override reason can't silently carry over onto a DIFFERENT incompatible unit.
  const [overrideIncompatibility, setOverrideIncompatibility] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  // Phase 67 §9.1 — Blood Bank item 5: emergency fast-match search. Resolves
  // "I need N units of O+ packed RBC" as one query instead of a staffer
  // scrolling the flat unit list and mentally cross-checking each row.
  const [fastMatchComponent, setFastMatchComponent] = useState('')
  const [fastMatchQty, setFastMatchQty] = useState('1')
  const [fastMatching, setFastMatching] = useState(false)
  const [fastMatchResult, setFastMatchResult] = useState<{ matchedCount: number; requestedQuantity: number; fulfilled: boolean; shortfall: number } | null>(null)

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
        toastError(t('bloodBank.failed'), iRes.error?.message ?? t('bloodBank.issue.couldNotLoadIssues'))
      }
      if (sRes.success && sRes.data) {
        const d = sRes.data as { units: StockUnit[] }
        setStockUnits((d.units ?? []).filter((u) => !u.isExpired))
      } else {
        toastError(t('bloodBank.failed'), sRes.error?.message ?? t('bloodBank.stock.couldNotLoadStock'))
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.issue.couldNotLoadIssueData'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

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
          toastError(t('bloodBank.failed'), res.error?.message ?? t('bloodBank.issue.couldNotVerifyCompatibility'))
          return
        }
        const results = res.data as Array<{ donationRecordId: string; compatible: boolean; note: string }>
        setIncompatibleUnits(results.filter((r) => !r.compatible).map((r) => ({ donationRecordId: r.donationRecordId, note: r.note })))
        setOverrideIncompatibility(false)
        setOverrideReason('')
      })
      .catch(() => {
        if (!cancelled) toastError(t('bloodBank.failed'), t('bloodBank.issue.couldNotVerifyCompatibility'))
      })
    return () => { cancelled = true }
  }, [form.recipientBloodGroup, selectedUnitIds, stockUnits, toastError, t])

  async function handleFastMatch() {
    if (!form.recipientBloodGroup) { toastError(t('bloodBank.missingBloodGroupTitle'), t('bloodBank.issue.selectRecipientBloodGroupFirst')); return }
    const quantity = Number(fastMatchQty)
    if (!quantity || quantity < 1) { toastError(t('bloodBank.issue.invalidQuantityTitle'), t('bloodBank.issue.enterUnitsNeeded')); return }
    setFastMatching(true)
    try {
      const res = await api.bloodBank.fastMatchSearch({
        recipientBloodGroup: form.recipientBloodGroup,
        componentType: fastMatchComponent || undefined,
        quantity,
      })
      if (res.success && res.data) {
        const d = res.data as { matched: Array<{ donationRecordId: string }>; matchedCount: number; requestedQuantity: number; fulfilled: boolean; shortfall: number }
        setSelectedUnitIds(d.matched.map((u) => u.donationRecordId))
        setFastMatchResult({ matchedCount: d.matchedCount, requestedQuantity: d.requestedQuantity, fulfilled: d.fulfilled, shortfall: d.shortfall })
      } else {
        toastError(t('bloodBank.failed'), res.error?.message ?? t('bloodBank.issue.couldNotRunFastMatch'))
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.issue.couldNotRunFastMatch'))
    } finally {
      setFastMatching(false)
    }
  }

  async function handleCreate() {
    if (!form.recipientName.trim()) { toastError(t('bloodBank.issue.missingRecipientTitle'), t('bloodBank.issue.enterRecipientName')); return }
    if (selectedUnitIds.length === 0) { toastError(t('bloodBank.issue.noUnitsSelectedTitle'), t('bloodBank.issue.selectAtLeastOneUnit')); return }
    // Phase 58 §2 — client-side mirror of the server-side block, so the
    // cashier gets an immediate, specific message instead of a generic
    // "Could not issue units." after a round-trip. The server enforces this
    // regardless — this is a UX improvement, not the actual safety gate.
    if (incompatibleUnits.length > 0 && !overrideIncompatibility) {
      toastError(t('bloodBank.issue.incompatibleSelectedTitle'), t('bloodBank.issue.checkOverrideMsg'))
      return
    }
    if (incompatibleUnits.length > 0 && overrideIncompatibility && !overrideReason.trim()) {
      toastError(t('bloodBank.issue.reasonRequiredTitle'), t('bloodBank.issue.enterOverrideReason'))
      return
    }
    setSaving(true)
    try {
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
      if (res.success) {
        toastSuccess(t('bloodBank.issue.unitsIssuedTitle'), t('bloodBank.issue.unitsIssuedDesc'))
        setShowCreate(false)
        setForm({ ...BLANK_FORM })
        setPickedCustomer(null)
        setSelectedUnitIds([])
        setOverrideIncompatibility(false)
        setOverrideReason('')
        setFastMatchResult(null)
        setFastMatchComponent('')
        setFastMatchQty('1')
        load()
      } else {
        toastError(t('bloodBank.failed'), (res.error as { message: string })?.message ?? t('bloodBank.issue.couldNotIssueUnits'))
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.issue.couldNotIssueUnits'))
    } finally {
      setSaving(false)
    }
  }

  async function refreshDetail(id: string) {
    try {
      const res = await api.bloodBank.getIssue({ id })
      if (res.success && res.data) {
        setDetail(res.data as BloodIssue)
      } else {
        toastError(t('bloodBank.failed'), res.error?.message ?? t('bloodBank.issue.couldNotRefreshIssueDetails'))
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.issue.couldNotRefreshIssueDetails'))
    }
  }

  async function handleCancel() {
    if (!detail) return
    setCancelling(true)
    try {
      const res = await api.bloodBank.cancelIssue({ id: detail.id })
      setConfirmCancel(false)
      if (res.success) { toastSuccess(t('bloodBank.issue.issueCancelledTitle'), t('bloodBank.issue.issueCancelledDesc')); setDetail(null); load() }
      else toastError(t('bloodBank.failed'), (res.error as { message: string })?.message ?? t('bloodBank.issue.couldNotCancelIssue'))
    } catch {
      setConfirmCancel(false)
      toastError(t('bloodBank.failed'), t('bloodBank.issue.couldNotCancelIssue'))
    } finally {
      setCancelling(false)
    }
  }

  async function handleGenerateInvoice(id: string) {
    setGeneratingInvoice(true)
    try {
      const res = await api.bloodBank.generateIssueInvoice({ id })
      if (res.success) { toastSuccess(t('bloodBank.issue.invoiceGeneratedTitle'), t('bloodBank.issue.invoiceGeneratedDesc')); refreshDetail(id); load() }
      else toastError(t('bloodBank.failed'), (res.error as { message: string })?.message ?? t('bloodBank.issue.couldNotGenerateInvoice'))
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.issue.couldNotGenerateInvoice'))
    } finally {
      setGeneratingInvoice(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Send size={24} className="text-brand" />
              {t('bloodBank.issue.title')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{t('bloodBank.issue.activeIssuesCount', { count: issues.filter((i) => i.status === 'ISSUED').length })}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <button onClick={() => setShowCreate(true)} className="h-11 px-4 flex items-center gap-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
                <Plus size={16} /> {t('bloodBank.issue.issueUnits')}
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
            <p className="text-base font-medium">{t('bloodBank.issue.noIssuesYet')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((i) => (
              <button key={i.id} onClick={() => refreshDetail(i.id)}
                className="w-full text-start bg-white dark:bg-slate-900 rounded-xl border border-border p-4 hover:border-brand/40 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-text-secondary">{i.issueNumber}</span>
                      <Badge variant={i.status === 'ISSUED' ? 'success' : 'danger'} size="sm">{i.status === 'ISSUED' ? t('bloodBank.issue.statusIssued') : t('bloodBank.issue.statusCancelled')}</Badge>
                    </div>
                    <p className="mt-1 font-semibold text-text-primary">{i.recipientName}</p>
                    <p className="text-sm text-text-secondary">{t('bloodBank.issue.unitsCount', { count: i.items.length, groups: i.items.map((it) => it.bloodGroup).join(', ') })}</p>
                  </div>
                  <div className="text-end shrink-0">
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
              <h2 className="text-xl font-bold text-text-primary">{t('bloodBank.issue.issueUnitsModalTitle')}</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.issue.recipientName')}</label>
                <input value={form.recipientName} onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.issue.recipientBloodGroup')}</label>
                  <select value={form.recipientBloodGroup} onChange={(e) => { setForm((f) => ({ ...f, recipientBloodGroup: e.target.value })); setFastMatchResult(null) }}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base bg-white dark:bg-slate-900">
                    <option value="">{t('bloodBank.unknown')}</option>
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <CustomerPicker
                    label={t('bloodBank.issue.customerOptional')}
                    value={pickedCustomer}
                    onChange={setPickedCustomer}
                    placeholder={t('bloodBank.issue.customerSearchPlaceholder')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.issue.purpose')}</label>
                  <input value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                    placeholder={t('bloodBank.issue.purposePlaceholder')} className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.issue.pricePerUnit')}</label>
                  <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
              </div>

              {/* Phase 67 §9.1 — Blood Bank item 5: emergency fast-match search. */}
              <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-brand">{t('bloodBank.issue.fastMatchTitle')}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={fastMatchComponent} onChange={(e) => setFastMatchComponent(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-border text-xs bg-white dark:bg-slate-900">
                    <option value="">{t('bloodBank.componentAny')}</option>
                    <option value="WHOLE_BLOOD">{t('bloodBank.componentWholeBlood')}</option>
                    <option value="PACKED_RBC">{t('bloodBank.componentPackedRbc')}</option>
                    <option value="PLATELETS">{t('bloodBank.componentPlatelets')}</option>
                    <option value="PLASMA">{t('bloodBank.componentPlasma')}</option>
                    <option value="CRYOPRECIPITATE">{t('bloodBank.componentCryoprecipitate')}</option>
                  </select>
                  <input type="number" min="1" value={fastMatchQty} onChange={(e) => setFastMatchQty(e.target.value)}
                    className="w-20 h-9 px-3 rounded-lg border border-border text-xs" placeholder={t('bloodBank.issue.qtyPlaceholder')} />
                  <button onClick={handleFastMatch} disabled={fastMatching}
                    className="h-9 px-3 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark disabled:opacity-50">
                    {fastMatching ? t('bloodBank.issue.matching') : t('bloodBank.issue.findAndSelect')}
                  </button>
                </div>
                {fastMatchResult && (
                  <p className={`text-xs ${fastMatchResult.fulfilled ? 'text-success' : 'text-danger'}`}>
                    {fastMatchResult.fulfilled
                      ? t('bloodBank.issue.matchedAllDesc', { count: fastMatchResult.matchedCount })
                      : t('bloodBank.issue.matchedShortDesc', { matched: fastMatchResult.matchedCount, requested: fastMatchResult.requestedQuantity, shortfall: fastMatchResult.shortfall })}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">{t('bloodBank.issue.selectAvailableUnits', { count: selectedUnitIds.length })}</label>
                <div className="max-h-56 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                  {stockUnits.length === 0 ? (
                    <p className="p-4 text-sm text-text-secondary">{t('bloodBank.issue.noUnitsInStock')}</p>
                  ) : stockUnits.map((u) => (
                    <label key={u.donationRecordId} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-hover">
                      <input type="checkbox" checked={selectedUnitIds.includes(u.donationRecordId)} onChange={() => toggleUnit(u.donationRecordId)} />
                      <span className="font-mono text-xs text-text-secondary">{u.donationNumber}</span>
                      <Badge variant="brand" size="sm">{u.bloodGroup}</Badge>
                      <span className="text-xs text-text-secondary">{componentLabel(u.componentType)}</span>
                      <span className="text-xs text-text-secondary ms-auto">{t('bloodBank.expiresLabel', { date: formatDate(u.expiryDate) })}</span>
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
                      <p><strong className="text-danger">{t('bloodBank.issue.incompatibleWarningTitle')}</strong> {t('bloodBank.issue.incompatibleWarningDesc')}</p>
                      {incompatibleUnits.map((u) => <p key={u.donationRecordId}>{u.note}</p>)}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-text-primary ps-6">
                    <input type="checkbox" checked={overrideIncompatibility} onChange={(e) => setOverrideIncompatibility(e.target.checked)} />
                    {t('bloodBank.issue.overrideEmergencyRelease')}
                  </label>
                  {overrideIncompatibility && (
                    <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={2}
                      placeholder={t('bloodBank.issue.overrideReasonPlaceholder')}
                      className="w-full px-3 py-2 ms-6 rounded-lg border border-border text-xs resize-none" style={{ width: 'calc(100% - 1.5rem)' }} />
                  )}
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 h-12 rounded-xl border border-border text-text-secondary font-semibold hover:bg-surface-hover transition-colors">{t('common.cancel')}</button>
              <button onClick={handleCreate}
                disabled={saving || selectedUnitIds.length === 0 || (incompatibleUnits.length > 0 && (!overrideIncompatibility || !overrideReason.trim()))}
                className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                {saving ? t('bloodBank.issue.issuing') : t('bloodBank.issue.issueUnits')}
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
              <Badge variant={detail.status === 'ISSUED' ? 'success' : 'danger'} size="sm">{detail.status === 'ISSUED' ? t('bloodBank.issue.statusIssued') : t('bloodBank.issue.statusCancelled')}</Badge>
              {detail.purpose && <div className="flex justify-between"><span className="text-text-secondary">{t('bloodBank.issue.purpose')}</span><span className="text-text-primary">{detail.purpose}</span></div>}
              <div className="space-y-2">
                {detail.items.map((it) => (
                  <div key={it.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2"><Badge variant="brand" size="sm">{it.bloodGroup}</Badge><span className="text-xs text-text-secondary">{componentLabel(it.componentType)}</span><span className="ms-auto text-xs font-semibold">{formatCurrency(it.price)}</span></div>
                    {it.compatibilityNote && <p className={`text-xs mt-1 ${it.overrideReason ? 'text-danger' : 'text-text-secondary'}`}>{it.compatibilityNote}</p>}
                    {it.overrideReason && <p className="text-xs text-text-secondary mt-0.5"><strong>{t('bloodBank.issue.overrideReasonLabel')}</strong> {it.overrideReason}</p>}
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2 border-t border-border"><span className="text-text-secondary">{t('common.total')}</span><span className="font-semibold text-text-primary">{formatCurrency(detail.totalAmount)}</span></div>

              {canCreate && detail.customerId && !detail.invoiceId && detail.status === 'ISSUED' && (
                <button onClick={() => handleGenerateInvoice(detail.id)} disabled={generatingInvoice} className="w-full h-11 rounded-xl border border-brand text-brand text-sm font-semibold hover:bg-brand/5 transition-colors disabled:opacity-50">{generatingInvoice ? t('bloodBank.issue.generating') : t('bloodBank.issue.generateInvoice')}</button>
              )}
              {canManage && detail.status === 'ISSUED' && !detail.invoiceId && (
                <button onClick={() => setConfirmCancel(true)} className="w-full h-11 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">{t('bloodBank.issue.cancelIssue')}</button>
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
        title={t('bloodBank.issue.cancelIssue')}
        message={t('bloodBank.issue.cancelIssueConfirmMsg')}
        confirmLabel={t('bloodBank.issue.cancelIssue')}
      />
    </div>
  )
}
