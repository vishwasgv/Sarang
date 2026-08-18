import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { HeartPulse, RefreshCw, AlertTriangle, Clock, CheckCircle2, CalendarDays, Plus } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useIndustryStore } from '@app/store/industry.store'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { useNotificationStore } from '@app/store/notification.store'

// Phase 67 §9.1 item 19 (GP Clinic, GREENFIELD) — deliberately English-only:
// this is a vertical-specific screen (GP_CLINIC only), same languageLock
// convention as RecallListScreen (Dental) and every other screen under
// service-business/ui/. See feedback_vertical_screens_language_lock memory.

interface ChronicConditionRecord {
  id: string
  patientId: string
  conditionName: string
  diagnosedDate: string | null
  lastVisitDate: string
  nextRecallDate: string
  isActive: boolean
  notes: string | null
  patient: { id: string; customerName: string; phone: string | null }
}

interface CustomerOption { id: string; customerName: string }

type Band = 'OVERDUE' | 'DUE_SOON' | 'THIS_MONTH' | 'UPCOMING'

const CONDITION_SUGGESTIONS = ['Diabetes', 'Hypertension', 'Asthma', 'Thyroid Disorder', 'Cardiac Condition', 'Chronic Kidney Disease']

const BAND_CONFIG: Record<Band, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  OVERDUE:    { label: 'Overdue',     color: 'text-danger',  bg: 'bg-danger/5',  border: 'border-danger/20',  icon: <AlertTriangle size={14} /> },
  DUE_SOON:   { label: 'Due Soon',    color: 'text-warning', bg: 'bg-warning/5', border: 'border-warning/20', icon: <Clock size={14} /> },
  THIS_MONTH: { label: 'This Month',  color: 'text-info',    bg: 'bg-info/5',    border: 'border-info/20',    icon: <CalendarDays size={14} /> },
  UPCOMING:   { label: 'Upcoming',    color: 'text-success', bg: 'bg-success/5', border: 'border-success/20', icon: <CheckCircle2 size={14} /> },
}
const BAND_VARIANT: Record<Band, 'danger' | 'warning' | 'info' | 'success'> = {
  OVERDUE: 'danger', DUE_SOON: 'warning', THIS_MONTH: 'info', UPCOMING: 'success',
}

function getBand(nextRecallDate: string): Band {
  const diffDays = Math.floor((new Date(nextRecallDate).getTime() - Date.now()) / 86400000)
  if (diffDays < 0) return 'OVERDUE'
  if (diffDays <= 7) return 'DUE_SOON'
  if (diffDays <= 30) return 'THIS_MONTH'
  return 'UPCOMING'
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const emptyForm = { id: undefined as string | undefined, patientId: '', conditionName: '', diagnosedDate: '', lastVisitDate: new Date().toISOString().slice(0, 10), nextRecallDate: '', notes: '' }

export function ChronicRecallListScreen() {
  const isChronicRecall = useIndustryStore((s) => s.isModuleEnabled('chronic_recall'))
  const { error: toastError, success: toastSuccess } = useNotificationStore()

  const [records, setRecords] = useState<ChronicConditionRecord[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Band | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [compliancePercent, setCompliancePercent] = useState<number | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, custRes, countsRes] = await Promise.all([
        api.chronicRecall.list({ activeOnly: true }),
        api.customers.list(),
        api.chronicRecall.dashboardCounts(),
      ])
      if (listRes.success && listRes.data) setRecords(listRes.data as ChronicConditionRecord[])
      else toastError('Error', listRes.error?.message ?? 'Could not load chronic condition records.')

      if (custRes.success && custRes.data) {
        const d = custRes.data as { customers?: CustomerOption[] } | CustomerOption[]
        setCustomers(Array.isArray(d) ? d : (d.customers ?? []))
      }
      if (countsRes.success && countsRes.data) {
        setCompliancePercent((countsRes.data as { compliancePercent: number | null }).compliancePercent)
      }
    } catch {
      toastError('Error', 'Could not load chronic condition records.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  if (!isChronicRecall) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <HeartPulse size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Chronic Condition Recall is not enabled for your business type.</p>
        </div>
      </div>
    )
  }

  const filtered = records.filter((r) => {
    if (filter !== 'ALL' && getBand(r.nextRecallDate) !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.patient.customerName.toLowerCase().includes(q) || r.conditionName.toLowerCase().includes(q)
    }
    return true
  })

  const counts = {
    ALL: records.length,
    OVERDUE: records.filter((r) => getBand(r.nextRecallDate) === 'OVERDUE').length,
    DUE_SOON: records.filter((r) => getBand(r.nextRecallDate) === 'DUE_SOON').length,
    THIS_MONTH: records.filter((r) => getBand(r.nextRecallDate) === 'THIS_MONTH').length,
    UPCOMING: records.filter((r) => getBand(r.nextRecallDate) === 'UPCOMING').length,
  }

  function openAdd() { setForm(emptyForm); setFormError(null); setModalOpen(true) }
  function openEdit(r: ChronicConditionRecord) {
    setForm({
      id: r.id,
      patientId: r.patientId,
      conditionName: r.conditionName,
      diagnosedDate: r.diagnosedDate ? r.diagnosedDate.slice(0, 10) : '',
      lastVisitDate: new Date().toISOString().slice(0, 10),
      nextRecallDate: '',
      notes: r.notes ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.patientId || !form.conditionName || !form.lastVisitDate || !form.nextRecallDate) {
      setFormError('Patient, condition, last visit date, and next recall date are required.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const res = await api.chronicRecall.upsert({
        id: form.id,
        patientId: form.patientId,
        conditionName: form.conditionName,
        diagnosedDate: form.diagnosedDate || null,
        lastVisitDate: form.lastVisitDate,
        nextRecallDate: form.nextRecallDate,
        notes: form.notes || null,
      })
      if (!res.success) { setFormError(res.error?.message ?? 'Could not save.'); return }
      toastSuccess('Saved', form.id ? 'Recall updated.' : 'Chronic condition tagged.')
      setModalOpen(false)
      load()
    } catch {
      setFormError('Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <HeartPulse size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">Chronic Condition Recall</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {records.length} patient{records.length !== 1 ? 's' : ''} tracked
              {compliancePercent !== null && ` · ${compliancePercent}% recalls followed up on time (last 12 months)`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openAdd} className="h-9 px-4 rounded-lg bg-brand text-white text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
            <Plus size={15} /> Tag Condition
          </button>
        </div>
      </div>

      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0 flex-wrap">
        {(['ALL', 'OVERDUE', 'DUE_SOON', 'THIS_MONTH', 'UPCOMING'] as const).map((b) => {
          const cfg = b === 'ALL' ? null : BAND_CONFIG[b]
          const isActive = filter === b
          return (
            <button
              key={b}
              onClick={() => setFilter(b)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
                isActive
                  ? cfg ? `${cfg.color} ${cfg.bg} ${cfg.border}` : 'text-brand bg-brand/5 border-brand/20'
                  : 'text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              {cfg && <span className={cfg.color}>{cfg.icon}</span>}
              {b === 'ALL' ? 'All' : BAND_CONFIG[b].label}
              <span className={`ms-0.5 ${isActive ? '' : 'text-slate-400'}`}>({counts[b]})</span>
            </button>
          )
        })}
        <input
          type="text"
          placeholder="Search patient or condition..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ms-2 h-8 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <HeartPulse size={32} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No chronic conditions tracked</p>
            <p className="text-xs text-slate-400 mt-1">
              {filter !== 'ALL' ? 'Try a different filter.' : 'Tag a patient with a chronic condition to start tracking their recalls.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const band = getBand(r.nextRecallDate)
              const cfg = BAND_CONFIG[band]
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white dark:bg-slate-900 rounded-xl border p-4 flex items-center gap-4 hover:shadow-sm transition-all cursor-pointer ${cfg.border}`}
                  onClick={() => openEdit(r)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-dark dark:text-slate-100 truncate">{r.patient.customerName}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{r.conditionName}</span>
                      {r.patient.phone && <span>{r.patient.phone}</span>}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <p className={`text-sm font-semibold ${cfg.color}`}>{fmt(r.nextRecallDate)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Last: {fmt(r.lastVisitDate)}</p>
                  </div>
                  <Badge variant={BAND_VARIANT[band]} size="sm" className="shrink-0">{cfg.label}</Badge>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'Update Recall' : 'Tag Chronic Condition'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="h-9 px-4 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {formError && <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{formError}</p>}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Patient <span className="text-danger">*</span></label>
            <select
              value={form.patientId}
              disabled={!!form.id}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
              className="w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-60"
            >
              <option value="">Select patient...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Condition <span className="text-danger">*</span></label>
            <input
              type="text"
              list="chronic-condition-suggestions"
              value={form.conditionName}
              onChange={(e) => setForm({ ...form, conditionName: e.target.value })}
              placeholder="e.g. Diabetes"
              className="w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
            <datalist id="chronic-condition-suggestions">
              {CONDITION_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Diagnosed Date</label>
            <input
              type="date"
              value={form.diagnosedDate}
              onChange={(e) => setForm({ ...form, diagnosedDate: e.target.value })}
              className="w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">This Visit Date <span className="text-danger">*</span></label>
              <input
                type="date"
                value={form.lastVisitDate}
                onChange={(e) => setForm({ ...form, lastVisitDate: e.target.value })}
                className="w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Next Recall Date <span className="text-danger">*</span></label>
              <input
                type="date"
                value={form.nextRecallDate}
                onChange={(e) => setForm({ ...form, nextRecallDate: e.target.value })}
                className="w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Any special follow-up instructions..."
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
