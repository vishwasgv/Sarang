import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Smile, RefreshCw, AlertTriangle, Clock, CheckCircle2, CalendarDays } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@renderer/services/ipc-client'
import { useIndustryStore } from '@app/store/industry.store'
import { Badge } from '@shared/ui/atoms/Badge'
import { useNotificationStore } from '@app/store/notification.store'

interface RecallRecord {
  id: string
  patientId: string
  recallType: string
  lastVisitDate: string
  nextRecallDate: string
  reminderSent: boolean
  notes: string | null
  patient: { id: string; customerName: string; phone: string | null }
}

type Band = 'OVERDUE' | 'DUE_SOON' | 'THIS_MONTH' | 'UPCOMING'

const RECALL_TYPE_LABELS: Record<string, string> = {
  HYGIENE_6M:   '6-Month Hygiene',
  HYGIENE_12M:  '12-Month Hygiene',
  CROWN_REVIEW: 'Crown Review',
  CUSTOM:       'Custom',
}

const BAND_CONFIG: Record<Band, { label: string; desc: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  OVERDUE:    { label: 'Overdue',      desc: 'Past recall date',     color: 'text-danger',    bg: 'bg-danger/5',    border: 'border-danger/20',   icon: <AlertTriangle size={14} /> },
  DUE_SOON:   { label: 'Due Soon',     desc: 'Within 7 days',        color: 'text-warning',   bg: 'bg-warning/5',   border: 'border-warning/20',  icon: <Clock size={14} /> },
  THIS_MONTH:  { label: 'This Month',  desc: 'Within 30 days',       color: 'text-info',      bg: 'bg-info/5',      border: 'border-info/20',     icon: <CalendarDays size={14} /> },
  UPCOMING:   { label: 'Upcoming',     desc: 'More than 30 days',    color: 'text-success',   bg: 'bg-success/5',   border: 'border-success/20',  icon: <CheckCircle2 size={14} /> },
}

// Band is a locally computed classification (see getBand below), not a persisted
// backend field — exhaustive by construction since Band is a closed union of
// exactly these 4 literals and getBand() has no other return path.
const BAND_VARIANT: Record<Band, 'danger' | 'warning' | 'info' | 'success'> = {
  OVERDUE: 'danger',
  DUE_SOON: 'warning',
  THIS_MONTH: 'info',
  UPCOMING: 'success',
}

function getBand(nextRecallDate: string): Band {
  const now = new Date()
  const d = new Date(nextRecallDate)
  const diffDays = Math.floor((d.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0)  return 'OVERDUE'
  if (diffDays <= 7)  return 'DUE_SOON'
  if (diffDays <= 30) return 'THIS_MONTH'
  return 'UPCOMING'
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function RecallListScreen() {
  const navigate = useNavigate()
  const isDentalRecall = useIndustryStore((s) => s.isModuleEnabled('dental_recall'))
  const { error: toastError } = useNotificationStore()

  const [records, setRecords] = useState<RecallRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Band | 'ALL'>('ALL')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.recall.list()
      if (res.success && res.data) setRecords(res.data as RecallRecord[])
      else toastError('Error', res.error?.message ?? 'Could not load recall list.')
    } catch {
      toastError('Error', 'Could not load recall list.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  if (!isDentalRecall) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Smile size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Recall Schedule is not enabled for your business type.</p>
        </div>
      </div>
    )
  }

  const filtered = records.filter((r) => {
    if (filter !== 'ALL' && getBand(r.nextRecallDate) !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.patient.customerName.toLowerCase().includes(q) || (r.patient.phone ?? '').includes(q)
    }
    return true
  })

  const counts = {
    ALL:       records.length,
    OVERDUE:   records.filter((r) => getBand(r.nextRecallDate) === 'OVERDUE').length,
    DUE_SOON:  records.filter((r) => getBand(r.nextRecallDate) === 'DUE_SOON').length,
    THIS_MONTH: records.filter((r) => getBand(r.nextRecallDate) === 'THIS_MONTH').length,
    UPCOMING:  records.filter((r) => getBand(r.nextRecallDate) === 'UPCOMING').length,
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <Smile size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">Recall Schedule</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{records.length} patient{records.length !== 1 ? 's' : ''} on recall</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Band filter */}
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
              <span className={`ml-0.5 ${isActive ? '' : 'text-slate-400'}`}>({counts[b]})</span>
            </button>
          )
        })}
        <input
          type="text"
          placeholder="Search patient..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-2 h-8 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Smile size={32} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No recalls found</p>
            <p className="text-xs text-slate-400 mt-1">
              {filter !== 'ALL' ? 'Try a different filter.' : 'Set recall dates from patient dental charts.'}
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
                  onClick={() => navigate(`/dental/patient/${r.patientId}`)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                    {cfg.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-dark dark:text-slate-100 truncate">{r.patient.customerName}</p>
                      {r.reminderSent && (
                        <Badge variant="success" size="sm" className="shrink-0">Reminded</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{RECALL_TYPE_LABELS[r.recallType] ?? r.recallType}</span>
                      {r.patient.phone && <span>{r.patient.phone}</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${cfg.color}`}>{fmt(r.nextRecallDate)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Last: {fmt(r.lastVisitDate)}</p>
                  </div>

                  <Badge variant={BAND_VARIANT[band]} size="sm" className="shrink-0">
                    {cfg.label}
                  </Badge>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
