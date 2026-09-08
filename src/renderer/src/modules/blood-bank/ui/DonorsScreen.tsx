import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Droplet, Plus, RefreshCw, Send, X } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { Badge } from '@shared/ui/atoms/Badge'
import { formatDate } from '@shared/utils/locale.util'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

interface Donor {
  id: string
  donorCode: string
  fullName: string
  phone: string | null
  email: string | null
  gender: string | null
  bloodGroup: string | null
  weightKg: number | null
  lastDonationDate: string | null
  lastDonationComponentType: string | null
  nextEligibleDate: string | null
  isDeferred: boolean
  deferralReason: string | null
  deferredUntil: string | null
  isActive: boolean
}

const BLANK_FORM = { fullName: '', phone: '', email: '', gender: '', bloodGroup: '', weightKg: '', address: '', notes: '' }

export function DonorsScreen() {
  const { t } = useTranslation()
  const { hasPermission } = useAuthStore()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canCreate = hasPermission('bloodBank.create')
  const canManage = hasPermission('bloodBank.manage')

  const [donors, setDonors] = useState<Donor[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  // Phase 67 §9.1 — Blood Bank item 1: donor cooldown auto-reminder — turns
  // the donor list into an active outreach tool instead of requiring staff
  // to open each donor one at a time to check their cooldown status.
  const [dueForRecallIds, setDueForRecallIds] = useState<Set<string>>(new Set())
  const [showRecallDueOnly, setShowRecallDueOnly] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<Donor | null>(null)
  const [showDefer, setShowDefer] = useState(false)
  const [deferReason, setDeferReason] = useState('')
  const [deferUntil, setDeferUntil] = useState('')
  const [recalling, setRecalling] = useState(false)
  const [deferBusy, setDeferBusy] = useState(false)
  const [clearingDeferral, setClearingDeferral] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, recallRes] = await Promise.all([
        api.bloodBank.listDonors({ search: search || undefined, limit: 200 }),
        api.bloodBank.listDonorsDueForRecall(),
      ])
      if (res.success && res.data) {
        const d = res.data as { donors: Donor[]; total: number }
        setDonors(d.donors ?? [])
        setTotal(d.total ?? 0)
      } else {
        toastError(t('bloodBank.failed'), res.error?.message ?? t('bloodBank.donors.couldNotLoadDonors'))
      }
      if (recallRes.success && recallRes.data) {
        setDueForRecallIds(new Set((recallRes.data as Donor[]).map((d) => d.id)))
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.donors.couldNotLoadDonors'))
    } finally {
      setLoading(false)
    }
  }, [search, toastError, t])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!form.fullName.trim()) { toastError(t('bloodBank.donors.missingNameTitle'), t('bloodBank.donors.enterDonorName')); return }
    setSaving(true)
    try {
      const res = await api.bloodBank.createDonor({
        fullName: form.fullName.trim(),
        phone: form.phone || undefined,
        email: form.email || undefined,
        gender: form.gender || undefined,
        bloodGroup: form.bloodGroup || undefined,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
      })
      if (res.success) {
        toastSuccess(t('bloodBank.donors.donorRegisteredTitle'), t('bloodBank.donors.donorRegisteredDesc'))
        setShowCreate(false)
        setForm({ ...BLANK_FORM })
        load()
      } else {
        toastError(t('bloodBank.failed'), (res.error as { message: string })?.message ?? t('bloodBank.donors.couldNotRegisterDonor'))
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.donors.couldNotRegisterDonor'))
    } finally {
      setSaving(false)
    }
  }

  async function handleRecall(donor: Donor) {
    setRecalling(true)
    try {
      const res = await api.bloodBank.sendDonorRecall({ donorId: donor.id })
      if (res.success) toastSuccess(t('bloodBank.donors.reminderReadyTitle'), t('bloodBank.donors.reminderReadyDesc'))
      else toastError(t('bloodBank.failed'), (res.error as { message: string })?.message ?? t('bloodBank.donors.couldNotSendRecall'))
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.donors.couldNotSendRecall'))
    } finally {
      setRecalling(false)
    }
  }

  // Refresh via getDonor (not updateDonor's raw response) so the detail view
  // gets the same enriched shape (nextEligibleDate) listDonors already
  // provides — found live: updateDonor's response lacks that computed field,
  // which briefly made the detail modal show a wrong "Now" placeholder.
  async function refreshDetail(id: string) {
    try {
      const res = await api.bloodBank.getDonor({ id })
      if (res.success && res.data) {
        setDetail(res.data as Donor)
      } else {
        toastError(t('bloodBank.failed'), res.error?.message ?? t('bloodBank.donors.couldNotRefreshDetails'))
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.donors.couldNotRefreshDetails'))
    }
  }

  async function handleMarkDeferred() {
    if (!detail) return
    setDeferBusy(true)
    try {
      const res = await api.bloodBank.updateDonor({ id: detail.id, isDeferred: true, deferralReason: deferReason || undefined, deferredUntil: deferUntil || null })
      if (res.success) {
        toastSuccess(t('bloodBank.donors.donorDeferredTitle'), t('bloodBank.donors.donorDeferredDesc'))
        setShowDefer(false)
        setDeferReason('')
        setDeferUntil('')
        refreshDetail(detail.id)
        load()
      } else {
        toastError(t('bloodBank.failed'), (res.error as { message: string })?.message ?? t('bloodBank.donors.couldNotUpdateDonor'))
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.donors.couldNotUpdateDonor'))
    } finally {
      setDeferBusy(false)
    }
  }

  async function handleClearDeferral(donor: Donor) {
    setClearingDeferral(true)
    try {
      const res = await api.bloodBank.updateDonor({ id: donor.id, isDeferred: false, deferralReason: null, deferredUntil: null })
      if (res.success) {
        toastSuccess(t('bloodBank.donors.deferralClearedTitle'), t('bloodBank.donors.deferralClearedDesc'))
        refreshDetail(donor.id)
        load()
      } else {
        toastError(t('bloodBank.failed'), (res.error as { message: string })?.message ?? t('bloodBank.donors.couldNotUpdateDonor'))
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.donors.couldNotUpdateDonor'))
    } finally {
      setClearingDeferral(false)
    }
  }

  // A missing deferredUntil means an indefinite/permanent deferral — mirrors
  // the exact fix applied to createDonationRecord's guard in
  // blood-bank.service.ts (the same gap existed here independently, found by
  // the same review pass).
  function isEligibleNow(donor: Donor): boolean {
    if (donor.isDeferred && (!donor.deferredUntil || new Date(donor.deferredUntil) > new Date())) return false
    if (!donor.nextEligibleDate) return true
    return new Date(donor.nextEligibleDate) <= new Date()
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Droplet size={24} className="text-brand" />
              {t('bloodBank.donors.title')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{t('bloodBank.donors.registeredCount', { count: total })}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {canCreate && (
              <button onClick={() => setShowCreate(true)} className="h-11 px-4 flex items-center gap-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
                <Plus size={16} /> {t('bloodBank.donors.newDonor')}
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('bloodBank.donors.searchPlaceholder')}
            className="w-full max-w-md h-11 px-4 rounded-lg border border-border text-sm focus:outline-none focus:border-brand" />
          {/* Phase 67 §9.1 — Blood Bank item 1: donor cooldown auto-reminder.
              Filters the list down to donors already past their cooldown, so
              staff can work down a real outreach list instead of checking
              each donor's eligibility one at a time. */}
          <button
            onClick={() => setShowRecallDueOnly((v) => !v)}
            className={`h-11 px-4 rounded-lg text-sm font-semibold border transition-colors ${showRecallDueOnly ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-900 text-text-secondary border-border hover:border-brand hover:text-brand'}`}
          >
            {t('bloodBank.donors.recallDue', { count: dueForRecallIds.size })}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
        ) : (showRecallDueOnly ? donors.filter((d) => dueForRecallIds.has(d.id)) : donors).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Droplet size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{showRecallDueOnly ? t('bloodBank.donors.noneDueForRecall') : t('bloodBank.donors.noDonorsYet')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(showRecallDueOnly ? donors.filter((d) => dueForRecallIds.has(d.id)) : donors).map((d) => {
              const eligible = isEligibleNow(d)
              return (
                <button key={d.id} onClick={() => setDetail(d)}
                  className="w-full text-start bg-white dark:bg-slate-900 rounded-xl border border-border p-4 hover:border-brand/40 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-text-secondary">{d.donorCode}</span>
                        {d.bloodGroup && <Badge variant="brand" size="sm">{d.bloodGroup}</Badge>}
                        {d.isDeferred && <Badge variant="danger" size="sm">{t('bloodBank.donors.deferred')}</Badge>}
                        {!d.isDeferred && (eligible ? <Badge variant="success" size="sm">{t('bloodBank.donors.eligible')}</Badge> : <Badge variant="neutral" size="sm">{t('bloodBank.donors.recovering')}</Badge>)}
                      </div>
                      <p className="mt-1 font-semibold text-text-primary">{d.fullName}</p>
                      <p className="text-sm text-text-secondary">{d.phone ?? t('bloodBank.donors.noPhoneOnFile')}</p>
                    </div>
                    <div className="text-end shrink-0 text-xs text-text-secondary">
                      {d.lastDonationDate && <p>{t('bloodBank.donors.lastLabel', { date: formatDate(d.lastDonationDate) })}</p>}
                      {d.nextEligibleDate && <p>{t('bloodBank.donors.nextEligibleLabel', { date: formatDate(d.nextEligibleDate) })}</p>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary">{t('bloodBank.donors.registerDonor')}</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.donors.fullName')}</label>
                <input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('common.phone')}</label>
                  <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.bloodGroup')}</label>
                  <select value={form.bloodGroup} onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base bg-white dark:bg-slate-900">
                    <option value="">{t('bloodBank.unknown')}</option>
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Phase 58 §2 — feeds the sex-aware whole-blood/RBC donation
                    cooldown; previously collected nowhere in the UI despite
                    the field existing on the schema since Phase 51. */}
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.donors.gender')}</label>
                  <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base bg-white dark:bg-slate-900">
                    <option value="">{t('bloodBank.donors.unspecified')}</option>
                    <option value="MALE">{t('bloodBank.donors.male')}</option>
                    <option value="FEMALE">{t('bloodBank.donors.female')}</option>
                    <option value="OTHER">{t('bloodBank.donors.other')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.donors.weightKg')}</label>
                  <input type="number" value={form.weightKg} onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))}
                    placeholder={t('bloodBank.donors.weightPlaceholder')} className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('common.email')}</label>
                <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('common.address')}</label>
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('common.notes')}</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-border text-base focus:outline-none focus:border-brand resize-none" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 h-12 rounded-xl border border-border text-text-secondary font-semibold hover:bg-surface-hover transition-colors">{t('common.cancel')}</button>
              <button onClick={handleCreate} disabled={saving || !form.fullName.trim()}
                className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                {saving ? t('bloodBank.saving') : t('bloodBank.donors.registerDonor')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-xs text-text-secondary">{detail.donorCode}</span>
                <h2 className="text-lg font-bold text-text-primary mt-0.5">{detail.fullName}</h2>
              </div>
              <button onClick={() => setDetail(null)} className="text-text-secondary hover:text-text-primary text-2xl leading-none shrink-0">×</button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              {detail.bloodGroup && <Badge variant="brand" size="sm">{detail.bloodGroup}</Badge>}
              <div className="flex justify-between"><span className="text-text-secondary">{t('common.phone')}</span><span className="text-text-primary">{detail.phone ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">{t('bloodBank.donors.weightKg')}</span><span className="text-text-primary">{detail.weightKg ? t('bloodBank.donors.weightUnit', { value: detail.weightKg }) : '—'}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">{t('bloodBank.donors.lastDonation')}</span><span className="text-text-primary">{detail.lastDonationDate ? formatDate(detail.lastDonationDate) : t('bloodBank.donors.noneYet')}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">{t('bloodBank.donors.nextEligible')}</span><span className="text-text-primary">{detail.nextEligibleDate ? formatDate(detail.nextEligibleDate) : t('bloodBank.donors.now')}</span></div>
              {detail.isDeferred && (
                <div className="bg-danger/5 border border-danger/20 rounded-lg p-3">
                  <p className="text-danger font-semibold text-xs">{detail.deferredUntil ? t('bloodBank.donors.deferredUntilLabel', { date: formatDate(detail.deferredUntil) }) : `${t('bloodBank.donors.deferred')} ${t('bloodBank.donors.deferredIndefinitely')}`}</p>
                  {detail.deferralReason && <p className="text-xs text-text-secondary mt-0.5">{detail.deferralReason}</p>}
                </div>
              )}
              {canCreate && detail.phone && (
                <button onClick={() => handleRecall(detail)} disabled={recalling} className="w-full h-11 rounded-xl border border-brand text-brand text-sm font-semibold hover:bg-brand/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  <Send size={14} /> {recalling ? t('bloodBank.sending') : t('bloodBank.donors.sendRecallReminder')}
                </button>
              )}
              {canManage && !detail.isDeferred && (
                <button onClick={() => setShowDefer(true)} className="w-full h-11 rounded-xl border border-danger text-danger text-sm font-semibold hover:bg-danger/5 transition-colors">
                  {t('bloodBank.donors.markDeferred')}
                </button>
              )}
              {canManage && detail.isDeferred && (
                <button onClick={() => handleClearDeferral(detail)} disabled={clearingDeferral} className="w-full h-11 rounded-xl border border-success text-success text-sm font-semibold hover:bg-success/5 transition-colors disabled:opacity-50">
                  {clearingDeferral ? t('bloodBank.clearing') : t('bloodBank.donors.clearDeferral')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Defer modal */}
      {showDefer && detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-text-primary">{t('bloodBank.donors.markDeferredTitle', { name: detail.fullName })}</h2>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">{t('common.reason')}</label>
              <input value={deferReason} onChange={(e) => setDeferReason(e.target.value)} placeholder={t('bloodBank.donors.reasonPlaceholder')}
                className="w-full h-11 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.donors.deferredUntilField')}</label>
              <input type="date" value={deferUntil} onChange={(e) => setDeferUntil(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-brand" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDefer(false); setDeferReason(''); setDeferUntil('') }} disabled={deferBusy} className="flex-1 h-11 rounded-xl border border-border text-text-secondary text-sm font-semibold disabled:opacity-50">{t('common.cancel')}</button>
              <button onClick={handleMarkDeferred} disabled={deferBusy} className="flex-1 h-11 rounded-xl bg-danger text-white text-sm font-semibold disabled:opacity-50">{deferBusy ? t('bloodBank.saving') : t('bloodBank.donors.markDeferred')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
