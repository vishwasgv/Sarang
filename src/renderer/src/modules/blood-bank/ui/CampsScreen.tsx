import React, { useState, useEffect, useCallback } from 'react'
import { Tent, Plus, RefreshCw, X, Users } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { formatDate } from '@shared/utils/locale.util'

interface DonationCamp {
  id: string
  campName: string
  location: string | null
  campDate: string
  organizer: string | null
  notes: string | null
  _count: { donations: number }
}

const BLANK_FORM = { campName: '', location: '', campDate: '', organizer: '', notes: '' }

// Phase 67 §9.1 — Blood Bank item 3: camp/drive scheduling with donor-turnout
// tracking per drive. The backend (createDonationCamp/listDonationCamps,
// including donations._count) already existed from an earlier phase — this
// screen was the actual gap; without it, a shop had no way to ever create or
// see a camp at all, despite Donations & Screening already being able to
// link a donation record to one.
export function CampsScreen() {
  const { hasPermission } = useAuthStore()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canCreate = hasPermission('bloodBank.create')

  const [camps, setCamps] = useState<DonationCamp[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.bloodBank.listDonationCamps()
      if (res.success && res.data) {
        setCamps((res.data as DonationCamp[]) ?? [])
      } else {
        toastError('Failed', res.error?.message ?? 'Could not load donation camps.')
      }
    } catch {
      toastError('Failed', 'Could not load donation camps.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!form.campName.trim()) { toastError('Missing Name', 'Enter the camp/drive name.'); return }
    if (!form.campDate) { toastError('Missing Date', 'Select the camp date.'); return }
    setSaving(true)
    try {
      const res = await api.bloodBank.createDonationCamp({
        campName: form.campName.trim(),
        location: form.location || undefined,
        campDate: form.campDate,
        organizer: form.organizer || undefined,
        notes: form.notes || undefined,
      })
      if (res.success) {
        toastSuccess('Camp Scheduled', 'Donation camp scheduled successfully.')
        setShowCreate(false)
        setForm({ ...BLANK_FORM })
        load()
      } else {
        toastError('Failed', (res.error as { message: string })?.message ?? 'Could not schedule camp.')
      }
    } catch {
      toastError('Failed', 'Could not schedule camp.')
    } finally {
      setSaving(false)
    }
  }

  const totalTurnout = camps.reduce((s, c) => s + c._count.donations, 0)

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Tent size={24} className="text-brand" />
              Donation Camps
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{camps.length} camp(s) · {totalTurnout} total donations across all camps</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {canCreate && (
              <button onClick={() => setShowCreate(true)} className="h-11 px-4 flex items-center gap-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
                <Plus size={16} /> Schedule Camp
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
        ) : camps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Tent size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">No donation camps scheduled yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {camps.map((c) => (
              <div key={c.id} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary">{c.campName}</p>
                    <p className="text-sm text-text-secondary">
                      {formatDate(c.campDate)}{c.location ? ` · ${c.location}` : ''}{c.organizer ? ` · Organized by ${c.organizer}` : ''}
                    </p>
                    {c.notes && <p className="text-xs text-text-secondary mt-1">{c.notes}</p>}
                  </div>
                  <div className="text-end shrink-0 flex items-center gap-1.5 text-brand">
                    <Users size={16} />
                    <div>
                      <p className="text-lg font-bold leading-tight">{c._count.donations}</p>
                      <p className="text-xs text-text-secondary leading-tight">donors</p>
                    </div>
                  </div>
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
              <h2 className="text-xl font-bold text-text-primary">Schedule Donation Camp</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Camp / Drive Name</label>
                <input value={form.campName} onChange={(e) => setForm((f) => ({ ...f, campName: e.target.value }))}
                  placeholder="e.g. Community Center Drive" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Date</label>
                  <input type="date" value={form.campDate} onChange={(e) => setForm((f) => ({ ...f, campDate: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Location</label>
                  <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Organizer</label>
                <input value={form.organizer} onChange={(e) => setForm((f) => ({ ...f, organizer: e.target.value }))}
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
                {saving ? 'Saving…' : 'Schedule Camp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
