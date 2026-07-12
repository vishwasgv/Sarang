import React, { useState, useEffect, useCallback } from 'react'
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

const BLANK_FORM = { donorId: '', bloodGroup: '', componentType: 'WHOLE_BLOOD', volumeMl: '450', notes: '' }

export function DonationsScreen() {
  const { hasPermission } = useAuthStore()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canCreate = hasPermission('bloodBank.create')
  const canManage = hasPermission('bloodBank.manage')

  const [records, setRecords] = useState<DonationRecord[]>([])
  const [donors, setDonors] = useState<Donor[]>([])
  const [activeTab, setActiveTab] = useState<ScreeningStatus | 'ALL'>('ALL')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [screeningTarget, setScreeningTarget] = useState<DonationRecord | null>(null)
  const [screeningNotes, setScreeningNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rRes, dRes] = await Promise.all([
        api.bloodBank.listDonationRecords({ limit: 200 }),
        api.bloodBank.listDonors({ limit: 500 }),
      ])
      if (rRes.success && rRes.data) {
        const d = rRes.data as { records: DonationRecord[]; total: number }
        setRecords(d.records ?? [])
      } else {
        toastError('Failed', rRes.error?.message ?? 'Could not load donation records.')
      }
      if (dRes.success && dRes.data) {
        const d = dRes.data as { donors: Donor[]; total: number }
        setDonors(d.donors ?? [])
      } else {
        toastError('Failed', dRes.error?.message ?? 'Could not load donors.')
      }
    } catch {
      toastError('Failed', 'Could not load donations data.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

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
    if (!form.donorId) { toastError('Missing Donor', 'Select a donor.'); return }
    if (!form.bloodGroup) { toastError('Missing Blood Group', 'Select the blood group collected.'); return }
    setSaving(true)
    const res = await api.bloodBank.createDonationRecord({
      donorId: form.donorId,
      bloodGroup: form.bloodGroup,
      componentType: form.componentType,
      volumeMl: form.volumeMl ? Number(form.volumeMl) : undefined,
      notes: form.notes || undefined,
    })
    setSaving(false)
    if (res.success) {
      toastSuccess('Donation Recorded', 'Donation recorded — pending screening.')
      setShowCreate(false)
      setForm({ ...BLANK_FORM })
      load()
    } else {
      toastError('Failed', (res.error as { message: string })?.message ?? 'Could not record donation.')
    }
  }

  async function handleScreening(status: 'PASSED' | 'FAILED') {
    if (!screeningTarget) return
    const res = await api.bloodBank.updateScreeningStatus({ id: screeningTarget.id, screeningStatus: status, screeningNotes: screeningNotes || undefined })
    if (res.success) {
      toastSuccess(status === 'PASSED' ? 'Unit Added to Stock' : 'Marked Failed', status === 'PASSED' ? 'Screening passed — unit is now in stock.' : 'Screening failed — unit discarded, not added to stock.')
      setScreeningTarget(null)
      setScreeningNotes('')
      load()
    } else {
      toastError('Failed', (res.error as { message: string })?.message ?? 'Could not record screening result.')
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Syringe size={24} className="text-brand" />
              Donations & Screening
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{tabCounts.PENDING ?? 0} awaiting screening</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {canCreate && (
              <button onClick={() => setShowCreate(true)} className="h-11 px-4 flex items-center gap-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
                <Plus size={16} /> Record Donation
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Tabs
            tabs={STATUS_TABS.map((tab) => ({ id: tab, label: tab === 'ALL' ? `All (${records.length})` : `${tab[0] + tab.slice(1).toLowerCase()} (${tabCounts[tab] ?? 0})` }))}
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
            <p className="text-base font-medium">No donation records found</p>
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
                      <Badge variant="neutral" size="sm">{r.componentType.replace('_', ' ')}</Badge>
                      <Badge variant={STATUS_VARIANT[r.screeningStatus]} size="sm">{r.screeningStatus}</Badge>
                    </div>
                    <p className="mt-1 font-semibold text-text-primary">{r.donor.fullName} ({r.donor.donorCode})</p>
                    <p className="text-xs text-text-secondary">{r.volumeMl}ml · Collected {formatDate(r.collectionDate)}{r.camp ? ` · ${r.camp.campName}` : ''}</p>
                    {r.productBatch && <p className="text-xs text-text-secondary">Expires {formatDate(r.productBatch.expiryDate)}</p>}
                  </div>
                  {canManage && r.screeningStatus === 'PENDING' && (
                    <button onClick={() => setScreeningTarget(r)} className="h-9 px-3 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark transition-colors shrink-0">
                      Record Screening
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
              <h2 className="text-xl font-bold text-text-primary">Record Donation</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Donor</label>
                <select value={form.donorId} onChange={(e) => pickDonor(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border text-base bg-white dark:bg-slate-900">
                  <option value="">Select donor…</option>
                  {donors.map((d) => <option key={d.id} value={d.id}>{d.fullName} ({d.donorCode})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Blood Group</label>
                  <select value={form.bloodGroup} onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base bg-white dark:bg-slate-900">
                    <option value="">Select…</option>
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Component Type</label>
                  <select value={form.componentType} onChange={(e) => setForm((f) => ({ ...f, componentType: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base bg-white dark:bg-slate-900">
                    {COMPONENT_TYPES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Volume (ml)</label>
                <input type="number" value={form.volumeMl} onChange={(e) => setForm((f) => ({ ...f, volumeMl: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-border text-base focus:outline-none focus:border-brand resize-none" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 h-12 rounded-xl border border-border text-text-secondary font-semibold hover:bg-surface-hover transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Record Donation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screening modal */}
      {screeningTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-text-primary">Screening Result</h2>
            <p className="text-sm text-text-secondary">{screeningTarget.donationNumber} — {screeningTarget.donor.fullName}</p>
            <textarea value={screeningNotes} onChange={(e) => setScreeningNotes(e.target.value)} rows={2} placeholder="Notes (optional)"
              className="w-full px-4 py-3 rounded-xl border border-border text-sm resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleScreening('PASSED')} className="h-11 rounded-xl bg-success text-white text-sm font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 size={14} /> Passed
              </button>
              <button onClick={() => handleScreening('FAILED')} className="h-11 rounded-xl bg-danger text-white text-sm font-semibold flex items-center justify-center gap-2">
                <XCircle size={14} /> Failed
              </button>
            </div>
            <button onClick={() => { setScreeningTarget(null); setScreeningNotes('') }} className="w-full h-10 rounded-xl border border-border text-text-secondary text-sm font-semibold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
