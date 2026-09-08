import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Syringe, Plus, RefreshCw, X, CheckCircle2, XCircle } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { Badge } from '@shared/ui/atoms/Badge'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { formatDate } from '@shared/utils/locale.util'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
const COMPONENT_TYPES = ['WHOLE_BLOOD', 'PACKED_RBC', 'PLATELETS', 'PLASMA', 'CRYOPRECIPITATE'] as const
type ScreeningStatus = 'PENDING' | 'PASSED' | 'FAILED'

interface Donor { id: string; fullName: string; donorCode: string; bloodGroup: string | null }
interface DonationCamp { id: string; campName: string; campDate: string }
interface DonationRecord {
  id: string
  donationNumber: string
  bloodGroup: string
  componentType: string
  volumeMl: number
  screeningStatus: ScreeningStatus
  collectionDate: string
  donor: { fullName: string; donorCode: string }
  camp: { campName: string } | null
  productBatch: { expiryDate: string } | null
}

const STATUS_TABS: (ScreeningStatus | 'ALL')[] = ['ALL', 'PENDING', 'PASSED', 'FAILED']
const STATUS_VARIANT: Record<ScreeningStatus, 'neutral' | 'success' | 'danger'> = { PENDING: 'neutral', PASSED: 'success', FAILED: 'danger' }
const STATUS_LABEL_KEY: Record<ScreeningStatus, string> = { PENDING: 'statusPending', PASSED: 'statusPassed', FAILED: 'statusFailed' }
const COMPONENT_LABEL_KEY: Record<string, string> = {
  WHOLE_BLOOD: 'componentWholeBlood',
  PACKED_RBC: 'componentPackedRbc',
  PLATELETS: 'componentPlatelets',
  PLASMA: 'componentPlasma',
  CRYOPRECIPITATE: 'componentCryoprecipitate',
}

const BLANK_FORM = { donorId: '', campId: '', bloodGroup: '', componentType: 'WHOLE_BLOOD', volumeMl: '450', notes: '' }

export function DonationsScreen() {
  const { t } = useTranslation()
  const { hasPermission } = useAuthStore()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canCreate = hasPermission('bloodBank.create')
  const canManage = hasPermission('bloodBank.manage')

  function componentLabel(type: string): string {
    const key = COMPONENT_LABEL_KEY[type]
    return key ? t(`bloodBank.${key}`) : type.replace('_', ' ')
  }

  const [records, setRecords] = useState<DonationRecord[]>([])
  const [donors, setDonors] = useState<Donor[]>([])
  const [camps, setCamps] = useState<DonationCamp[]>([])
  const [activeTab, setActiveTab] = useState<ScreeningStatus | 'ALL'>('ALL')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [screeningTarget, setScreeningTarget] = useState<DonationRecord | null>(null)
  const [screeningNotes, setScreeningNotes] = useState('')
  const [screeningBusy, setScreeningBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rRes, dRes, cRes] = await Promise.all([
        api.bloodBank.listDonationRecords({ limit: 200 }),
        api.bloodBank.listDonors({ limit: 500 }),
        api.bloodBank.listDonationCamps(),
      ])
      if (rRes.success && rRes.data) {
        const d = rRes.data as { records: DonationRecord[]; total: number }
        setRecords(d.records ?? [])
      } else {
        toastError(t('bloodBank.failed'), rRes.error?.message ?? t('bloodBank.donations.couldNotLoadDonationRecords'))
      }
      if (dRes.success && dRes.data) {
        const d = dRes.data as { donors: Donor[]; total: number }
        setDonors(d.donors ?? [])
      } else {
        toastError(t('bloodBank.failed'), dRes.error?.message ?? t('bloodBank.donors.couldNotLoadDonors'))
      }
      if (cRes.success && cRes.data) {
        setCamps((cRes.data as DonationCamp[]) ?? [])
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.donations.couldNotLoadDonationsData'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  const visible = activeTab === 'ALL' ? records : records.filter((r) => r.screeningStatus === activeTab)
  const tabCounts = STATUS_TABS.slice(1).reduce<Record<string, number>>((acc, s) => {
    acc[s] = records.filter((r) => r.screeningStatus === s).length
    return acc
  }, {})

  function pickDonor(donorId: string) {
    const donor = donors.find((d) => d.id === donorId)
    setForm((f) => ({ ...f, donorId, bloodGroup: donor?.bloodGroup ?? f.bloodGroup }))
  }

  async function handleCreate() {
    if (!form.donorId) { toastError(t('bloodBank.donations.donorMissingTitle'), t('bloodBank.donations.selectDonorMsg')); return }
    if (!form.bloodGroup) { toastError(t('bloodBank.missingBloodGroupTitle'), t('bloodBank.donations.selectBloodGroupCollected')); return }
    setSaving(true)
    try {
      const res = await api.bloodBank.createDonationRecord({
        donorId: form.donorId,
        campId: form.campId || undefined,
        bloodGroup: form.bloodGroup,
        componentType: form.componentType,
        volumeMl: form.volumeMl ? Number(form.volumeMl) : undefined,
        notes: form.notes || undefined,
      })
      if (res.success) {
        toastSuccess(t('bloodBank.donations.donationRecordedTitle'), t('bloodBank.donations.donationRecordedDesc'))
        setShowCreate(false)
        setForm({ ...BLANK_FORM })
        load()
      } else {
        toastError(t('bloodBank.failed'), (res.error as { message: string })?.message ?? t('bloodBank.donations.couldNotRecordDonation'))
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.donations.couldNotRecordDonation'))
    } finally {
      setSaving(false)
    }
  }

  async function handleScreening(status: 'PASSED' | 'FAILED') {
    if (!screeningTarget) return
    setScreeningBusy(true)
    try {
      const res = await api.bloodBank.updateScreeningStatus({ id: screeningTarget.id, screeningStatus: status, screeningNotes: screeningNotes || undefined })
      if (res.success) {
        toastSuccess(
          status === 'PASSED' ? t('bloodBank.donations.unitAddedToStockTitle') : t('bloodBank.donations.markedFailedTitle'),
          status === 'PASSED' ? t('bloodBank.donations.screeningPassedDesc') : t('bloodBank.donations.screeningFailedDesc')
        )
        setScreeningTarget(null)
        setScreeningNotes('')
        load()
      } else {
        toastError(t('bloodBank.failed'), (res.error as { message: string })?.message ?? t('bloodBank.donations.couldNotRecordScreening'))
      }
    } catch {
      toastError(t('bloodBank.failed'), t('bloodBank.donations.couldNotRecordScreening'))
    } finally {
      setScreeningBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Syringe size={24} className="text-brand" />
              {t('bloodBank.donations.title')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{t('bloodBank.donations.awaitingScreening', { count: tabCounts.PENDING ?? 0 })}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {canCreate && (
              <button onClick={() => setShowCreate(true)} className="h-11 px-4 flex items-center gap-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
                <Plus size={16} /> {t('bloodBank.donations.recordDonation')}
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Tabs
            tabs={STATUS_TABS.map((tab) => ({
              id: tab,
              label: tab === 'ALL'
                ? t('bloodBank.donations.allTab', { count: records.length })
                : t('bloodBank.donations.statusTab', { status: t(`bloodBank.donations.${STATUS_LABEL_KEY[tab]}`), count: tabCounts[tab] ?? 0 })
            }))}
            active={activeTab}
            onChange={(id) => setActiveTab(id as ScreeningStatus | 'ALL')}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Syringe size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{t('bloodBank.donations.noRecordsFound')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((r) => (
              <div key={r.id} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-text-secondary">{r.donationNumber}</span>
                      <Badge variant="brand" size="sm">{r.bloodGroup}</Badge>
                      <Badge variant="neutral" size="sm">{componentLabel(r.componentType)}</Badge>
                      <Badge variant={STATUS_VARIANT[r.screeningStatus]} size="sm">{t(`bloodBank.donations.${STATUS_LABEL_KEY[r.screeningStatus]}`)}</Badge>
                    </div>
                    <p className="mt-1 font-semibold text-text-primary">{r.donor.fullName} ({r.donor.donorCode})</p>
                    <p className="text-xs text-text-secondary">
                      {r.camp
                        ? t('bloodBank.donations.volumeCollectedWithCamp', { ml: r.volumeMl, date: formatDate(r.collectionDate), camp: r.camp.campName })
                        : t('bloodBank.donations.volumeCollectedNoCamp', { ml: r.volumeMl, date: formatDate(r.collectionDate) })}
                    </p>
                    {r.productBatch && <p className="text-xs text-text-secondary">{t('bloodBank.expiresLabel', { date: formatDate(r.productBatch.expiryDate) })}</p>}
                  </div>
                  {canManage && r.screeningStatus === 'PENDING' && (
                    <button onClick={() => setScreeningTarget(r)} className="h-9 px-3 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark transition-colors shrink-0">
                      {t('bloodBank.donations.recordScreening')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary">{t('bloodBank.donations.recordDonation')}</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.donations.donor')}</label>
                <select value={form.donorId} onChange={(e) => pickDonor(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border text-base bg-white dark:bg-slate-900">
                  <option value="">{t('bloodBank.donations.selectDonor')}</option>
                  {donors.map((d) => <option key={d.id} value={d.id}>{d.fullName} ({d.donorCode})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.bloodGroup')}</label>
                  <select value={form.bloodGroup} onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base bg-white dark:bg-slate-900">
                    <option value="">{t('common.select')}…</option>
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.donations.componentType')}</label>
                  <select value={form.componentType} onChange={(e) => setForm((f) => ({ ...f, componentType: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base bg-white dark:bg-slate-900">
                    {COMPONENT_TYPES.map((c) => <option key={c} value={c}>{componentLabel(c)}</option>)}
                  </select>
                </div>
              </div>
              {/* Phase 67 §9.1 — Blood Bank item 3: optional camp/drive link,
                  so a donation collected at a scheduled camp counts toward
                  that camp's own turnout tracking. */}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.donations.donationCampLabel')}</label>
                <select value={form.campId} onChange={(e) => setForm((f) => ({ ...f, campId: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border text-base bg-white dark:bg-slate-900">
                  <option value="">{t('bloodBank.donations.walkInNotFromCamp')}</option>
                  {camps.map((c) => <option key={c.id} value={c.id}>{c.campName} — {formatDate(c.campDate)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('bloodBank.donations.volumeMl')}</label>
                <input type="number" value={form.volumeMl} onChange={(e) => setForm((f) => ({ ...f, volumeMl: e.target.value }))}
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
              <button onClick={handleCreate} disabled={saving} className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                {saving ? t('bloodBank.saving') : t('bloodBank.donations.recordDonation')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screening modal */}
      {screeningTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-text-primary">{t('bloodBank.donations.screeningResultTitle')}</h2>
            <p className="text-sm text-text-secondary">{screeningTarget.donationNumber} — {screeningTarget.donor.fullName}</p>
            <textarea value={screeningNotes} onChange={(e) => setScreeningNotes(e.target.value)} rows={2} placeholder={t('bloodBank.donations.notesOptionalPlaceholder')}
              className="w-full px-4 py-3 rounded-xl border border-border text-sm resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleScreening('PASSED')} disabled={screeningBusy} className="h-11 rounded-xl bg-success text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                <CheckCircle2 size={14} /> {t('bloodBank.donations.passed')}
              </button>
              <button onClick={() => handleScreening('FAILED')} disabled={screeningBusy} className="h-11 rounded-xl bg-danger text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                <XCircle size={14} /> {t('bloodBank.failed')}
              </button>
            </div>
            <button onClick={() => { setScreeningTarget(null); setScreeningNotes('') }} disabled={screeningBusy} className="w-full h-10 rounded-xl border border-border text-text-secondary text-sm font-semibold disabled:opacity-50">{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
