import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Smile, ClipboardList, Calendar, Plus, X, Save, RefreshCw, AlertTriangle, CheckCircle2, Printer } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { cn } from '@shared/utils/cn'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ToothCondition = 'SOUND' | 'CARIES' | 'FILLED' | 'MISSING' | 'CROWN' | 'BRIDGE_ABUTMENT' | 'IMPLANT' | 'ROOT_CANAL' | 'EXTRACTION_SITE' | 'FRACTURE'

interface ToothRecord {
  id: string
  toothNumber: number
  condition: ToothCondition
  surface: string  // JSON
  notes: string | null
  recordedDate: string
  recordedBy: { id: string; fullName: string } | null
}

interface TreatmentPlanItem {
  toothNumber?: number
  procedure: string
  estimatedCost: number
  itemStatus: 'PENDING' | 'DONE'
}

interface TreatmentPlan {
  id: string
  title: string
  status: string
  planItems: string  // JSON
  totalEstimatedCost: string | number
  notes: string | null
  acceptedDate: string | null
  completedDate: string | null
  createdAt: string
  createdBy: { id: string; fullName: string } | null
}

interface RecallRecord {
  id: string
  recallType: string
  lastVisitDate: string
  nextRecallDate: string
  reminderSent: boolean
  notes: string | null
}

interface Patient {
  id: string
  customerName: string
  phone: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooth configuration
// ─────────────────────────────────────────────────────────────────────────────

const CONDITION_CONFIG: Record<ToothCondition, { label: string; color: string; bg: string }> = {
  SOUND:           { label: 'Sound',            color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
  CARIES:          { label: 'Caries',           color: 'text-red-600',   bg: 'bg-red-100' },
  FILLED:          { label: 'Filled',           color: 'text-blue-600',  bg: 'bg-blue-100' },
  MISSING:         { label: 'Missing',          color: 'text-slate-300', bg: 'bg-slate-50 dark:bg-slate-800' },
  CROWN:           { label: 'Crown',            color: 'text-amber-600', bg: 'bg-amber-100' },
  BRIDGE_ABUTMENT: { label: 'Bridge',           color: 'text-purple-600',bg: 'bg-purple-100' },
  IMPLANT:         { label: 'Implant',          color: 'text-emerald-600',bg: 'bg-emerald-100' },
  ROOT_CANAL:      { label: 'Root Canal',       color: 'text-orange-600',bg: 'bg-orange-100' },
  EXTRACTION_SITE: { label: 'Extraction Site',  color: 'text-rose-600',  bg: 'bg-rose-100' },
  FRACTURE:        { label: 'Fracture',         color: 'text-pink-600',  bg: 'bg-pink-100' },
}

// FDI notation — permanent (adult) teeth
// Upper: 18–11 | 21–28  (right to left as seen from patient, then left to right)
// Lower: 48–41 | 31–38
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38]

// Deciduous (primary) teeth
const DEC_UPPER_RIGHT = [55, 54, 53, 52, 51]
const DEC_UPPER_LEFT  = [61, 62, 63, 64, 65]
const DEC_LOWER_RIGHT = [85, 84, 83, 82, 81]
const DEC_LOWER_LEFT  = [71, 72, 73, 74, 75]

function printToothChart(patient: Patient | null, records: ToothRecord[]) {
  const name = patient?.customerName ?? 'Patient'
  const phone = patient?.phone ?? ''
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  const ALL_TEETH = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38,55,54,53,52,51,61,62,63,64,65,85,84,83,82,81,71,72,73,74,75]
  const recordMap = new Map(records.map(r => [r.toothNumber, r]))

  const rows = ALL_TEETH.map(t => {
    const r = recordMap.get(t)
    if (!r || r.condition === 'SOUND') return ''
    let surfaces = ''
    try { surfaces = (JSON.parse(r.surface) as string[]).join(', ') } catch { surfaces = '' }
    return `<tr><td>${t}</td><td>${r.condition}</td><td>${surfaces || '—'}</td><td>${r.notes ?? '—'}</td><td>${new Date(r.recordedDate).toLocaleDateString('en-IN')}</td></tr>`
  }).filter(Boolean).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tooth Chart — ${name}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 32px; }
  h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 13px; margin: 0 0 16px; color: #555; }
  .meta { margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f1f5f9; text-align: left; padding: 7px 10px; font-size: 11px; border: 1px solid #e2e8f0; }
  td { padding: 6px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
  .disclaimer { font-size: 9px; color: #555; border: 1px solid #e2e8f0; padding: 8px; margin-top: 16px; background: #fffbeb; }
  .footer { font-size: 10px; color: #555; text-align: center; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .empty { color: #888; font-style: italic; }
</style></head><body>
<h1>Dental Chart</h1>
<h2>${name}</h2>
<div class="meta"><p>Phone: ${phone || '—'} &nbsp;|&nbsp; Printed: ${date}</p></div>
<table>
  <thead><tr><th>Tooth #</th><th>Condition</th><th>Surfaces</th><th>Notes</th><th>Recorded</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="5" class="empty">No abnormal tooth records — all teeth marked SOUND.</td></tr>'}</tbody>
</table>
<div class="disclaimer">This document was generated by Sarang Business OS Lite, a convenience tool. It is NOT a validated medical record, prescription, or clinical report. All content was entered by the practitioner. Verify all information before clinical use.</div>
<div class="footer">${aszurexFooterHtml(10)}</div>
</body></html>`

  const win = window.open('', '_blank', 'width=760,height=900')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

// Verified exhaustive against prisma/schema.prisma TreatmentPlan.status comment
// and src/main/services/treatment-plan.service.ts (free-form string, but the
// only values ever written are these 5 — enforced by the UI's status <select>).
const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  PROPOSED:    'neutral',
  ACCEPTED:    'info',
  IN_PROGRESS: 'warning',
  COMPLETED:   'success',
  DECLINED:    'danger',
}

const RECALL_TYPE_LABELS: Record<string, string> = {
  HYGIENE_6M:   '6-Month Hygiene',
  HYGIENE_12M:  '12-Month Hygiene',
  CROWN_REVIEW: 'Crown Review',
  CUSTOM:       'Custom',
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'chart' | 'plans' | 'recall'

export function DentalPatientScreen() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const currSym = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')
  const canWrite = hasPermission('clinicalNotes.write')
  const { error: toastError } = useNotificationStore()

  const [tab, setTab] = useState<Tab>('chart')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [toothRecords, setToothRecords] = useState<ToothRecord[]>([])
  const [plans, setPlans] = useState<TreatmentPlan[]>([])
  const [recall, setRecall] = useState<RecallRecord | null>(null)
  const [loading, setLoading] = useState(true)

  // Tooth editor state
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [editCondition, setEditCondition] = useState<ToothCondition>('SOUND')
  const [editSurfaces, setEditSurfaces] = useState<string[]>([])
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Treatment plan modal
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<TreatmentPlan | null>(null)

  // Recall form
  const [recallForm, setRecallForm] = useState({ recallType: 'HYGIENE_6M', lastVisitDate: '', nextRecallDate: '', notes: '' })
  const [recallSaving, setRecallSaving] = useState(false)
  const [recallError, setRecallError] = useState<string | null>(null)
  const [recallSaved, setRecallSaved] = useState(false)

  const loadAll = useCallback(async () => {
    if (!patientId) return
    setLoading(true)

    try {
      const [custRes, chartRes, plansRes, recallRes] = await Promise.all([
        api.customers.get(patientId),
        api.toothRecord.getChart({ patientId }),
        api.treatmentPlan.list({ patientId }),
        api.recall.get({ patientId }),
      ])

      if (custRes.success && custRes.data) setPatient(custRes.data as Patient)
      else toastError('Error', (custRes as { error?: { message: string } }).error?.message ?? 'Could not load patient.')
      if (chartRes.success && chartRes.data) setToothRecords(chartRes.data as ToothRecord[])
      if (plansRes.success && plansRes.data) setPlans(plansRes.data as TreatmentPlan[])
      if (recallRes.success) {
        const r = recallRes.data as RecallRecord | null
        setRecall(r)
        if (r) {
          setRecallForm({
            recallType: r.recallType,
            lastVisitDate: r.lastVisitDate.slice(0, 10),
            nextRecallDate: r.nextRecallDate.slice(0, 10),
            notes: r.notes ?? '',
          })
        }
      }
    } catch {
      toastError('Error', 'Could not load patient.')
    } finally {
      setLoading(false)
    }
  }, [patientId, toastError])

  useEffect(() => { loadAll() }, [loadAll])

  function getToothRecord(num: number): ToothRecord | undefined {
    return toothRecords.find((r) => r.toothNumber === num)
  }

  function getToothCondition(num: number): ToothCondition {
    return getToothRecord(num)?.condition as ToothCondition ?? 'SOUND'
  }

  function handleToothClick(num: number) {
    if (!canWrite) return
    const existing = getToothRecord(num)
    setSelectedTooth(num)
    setEditCondition(existing?.condition as ToothCondition ?? 'SOUND')
    setEditNotes(existing?.notes ?? '')
    setSaveError(null)
    try {
      setEditSurfaces(existing ? JSON.parse(existing.surface) : [])
    } catch {
      setEditSurfaces([])
    }
  }

  async function handleToothSave() {
    if (!patientId || selectedTooth === null) return
    setSaving(true)
    setSaveError(null)
    const res = await api.toothRecord.upsert({
      patientId,
      toothNumber: selectedTooth,
      condition: editCondition,
      surface: JSON.stringify(editSurfaces),
      notes: editNotes || null,
    })
    setSaving(false)
    if (!res.success) {
      setSaveError(res.error?.message ?? 'Could not save tooth record.')
      return
    }
    const chartRes = await api.toothRecord.getChart({ patientId })
    if (chartRes.success && chartRes.data) setToothRecords(chartRes.data as ToothRecord[])
    setSelectedTooth(null)
  }

  async function handleRecallSave() {
    if (!patientId) return
    if (!recallForm.lastVisitDate || !recallForm.nextRecallDate) {
      setRecallError('Last visit date and next recall date are required.')
      return
    }
    setRecallSaving(true)
    setRecallError(null)
    const res = await api.recall.upsert({
      patientId,
      recallType: recallForm.recallType,
      lastVisitDate: recallForm.lastVisitDate,
      nextRecallDate: recallForm.nextRecallDate,
      notes: recallForm.notes || null,
    })
    setRecallSaving(false)
    if (!res.success) {
      setRecallError(res.error?.message ?? 'Could not save recall record.')
      return
    }
    setRecallSaved(true)
    loadAll()
    setTimeout(() => setRecallSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/appointments')} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <ArrowLeft size={16} />
          </button>
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <Smile size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">{patient?.customerName ?? 'Dental Patient'}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{patient?.phone ?? 'Dental Chart & Records'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => printToothChart(patient, toothRecords)} title="Print tooth chart" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Printer size={14} /> Print Chart
          </button>
          <button onClick={loadAll} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1 shrink-0">
        {([
          { key: 'chart',  label: 'Tooth Chart',      icon: <Smile size={14} /> },
          { key: 'plans',  label: 'Treatment Plans',  icon: <ClipboardList size={14} /> },
          { key: 'recall', label: 'Recall',           icon: <Calendar size={14} /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
              tab === t.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'chart' && (
          <ToothChartTab
            toothRecords={toothRecords}
            selectedTooth={selectedTooth}
            editCondition={editCondition}
            editSurfaces={editSurfaces}
            editNotes={editNotes}
            saving={saving}
            saveError={saveError}
            canWrite={canWrite}
            getToothCondition={getToothCondition}
            onToothClick={handleToothClick}
            onConditionChange={setEditCondition}
            onSurfacesChange={setEditSurfaces}
            onNotesChange={setEditNotes}
            onSave={handleToothSave}
            onCancel={() => setSelectedTooth(null)}
          />
        )}
        {tab === 'plans' && (
          <TreatmentPlansTab
            plans={plans}
            currSym={currSym}
            canWrite={canWrite}
            onNew={() => { setEditingPlan(null); setShowPlanModal(true) }}
            onEdit={(p) => { setEditingPlan(p); setShowPlanModal(true) }}
          />
        )}
        {tab === 'recall' && (
          <RecallTab
            recall={recall}
            form={recallForm}
            saving={recallSaving}
            error={recallError}
            saved={recallSaved}
            canWrite={canWrite}
            onChange={(f) => setRecallForm(f)}
            onSave={handleRecallSave}
          />
        )}
      </div>

      {/* Treatment plan modal */}
      {showPlanModal && patientId && (
        <TreatmentPlanModal
          patientId={patientId}
          plan={editingPlan}
          currSym={currSym}
          onClose={() => setShowPlanModal(false)}
          onSaved={() => {
            setShowPlanModal(false)
            api.treatmentPlan.list({ patientId }).then((res) => {
              if (res.success && res.data) setPlans(res.data as TreatmentPlan[])
            })
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooth Chart Tab
// ─────────────────────────────────────────────────────────────────────────────

const TOOTH_SURFACES = ['BUCCAL', 'LINGUAL', 'MESIAL', 'DISTAL', 'OCCLUSAL'] as const

// ─── ToothBtn — module-level so React never sees a new component type on re-render ───
function ToothBtn({ num, selectedTooth, toothRecords, canWrite, getToothCondition, onToothClick }: {
  num: number
  selectedTooth: number | null
  toothRecords: ToothRecord[]
  canWrite: boolean
  getToothCondition: (n: number) => ToothCondition
  onToothClick: (n: number) => void
}) {
  const cond = getToothCondition(num)
  const cfg = CONDITION_CONFIG[cond]
  const isSelected = selectedTooth === num
  const hasRecord = toothRecords.some((r) => r.toothNumber === num && r.condition !== 'SOUND')
  return (
    <button
      onClick={() => onToothClick(num)}
      title={`Tooth ${num} — ${cfg.label}`}
      className={cn(
        'w-9 h-9 rounded-lg text-xs font-bold border-2 flex flex-col items-center justify-center transition-all',
        isSelected ? 'border-brand ring-2 ring-brand/30 scale-110' : hasRecord ? `border-transparent ${cfg.bg} ${cfg.color}` : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-brand/40',
        canWrite ? 'cursor-pointer' : 'cursor-default'
      )}
    >
      <span className="text-[9px] font-semibold leading-none">{num}</span>
      <div className="w-2 h-2 rounded-full mt-0.5" style={{ backgroundColor: condColor(cond) }} />
    </button>
  )
}

function ToothChartTab({
  toothRecords, selectedTooth, editCondition, editSurfaces, editNotes, saving, saveError, canWrite,
  getToothCondition, onToothClick, onConditionChange, onSurfacesChange, onNotesChange, onSave, onCancel,
}: {
  toothRecords: ToothRecord[]
  selectedTooth: number | null
  editCondition: ToothCondition
  editSurfaces: string[]
  editNotes: string
  saving: boolean
  saveError: string | null
  canWrite: boolean
  getToothCondition: (n: number) => ToothCondition
  onToothClick: (n: number) => void
  onConditionChange: (c: ToothCondition) => void
  onSurfacesChange: (surfaces: string[]) => void
  onNotesChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const toothProps = { selectedTooth, toothRecords, canWrite, getToothCondition, onToothClick }

  return (
    <div className="p-6">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(Object.entries(CONDITION_CONFIG) as [ToothCondition, { label: string; color: string; bg: string }][]).map(([cond, cfg]) => (
          <span key={cond} className={cn('px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.color)}>{cfg.label}</span>
        ))}
      </div>

      {/* Permanent teeth chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Permanent Teeth (FDI)</p>
        {/* Upper arch */}
        <div className="flex justify-center gap-1 mb-1">
          {UPPER_RIGHT.map((n) => <ToothBtn key={n} num={n} {...toothProps} />)}
          <div className="w-px bg-slate-300 mx-1" />
          {UPPER_LEFT.map((n) => <ToothBtn key={n} num={n} {...toothProps} />)}
        </div>
        <div className="text-center text-[9px] text-slate-300 font-mono mb-3">— Upper jaw —</div>
        <div className="text-center text-[9px] text-slate-300 font-mono mb-1">— Lower jaw —</div>
        {/* Lower arch */}
        <div className="flex justify-center gap-1">
          {LOWER_RIGHT.map((n) => <ToothBtn key={n} num={n} {...toothProps} />)}
          <div className="w-px bg-slate-300 mx-1" />
          {LOWER_LEFT.map((n) => <ToothBtn key={n} num={n} {...toothProps} />)}
        </div>
      </div>

      {/* Deciduous teeth chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Deciduous Teeth (Primary)</p>
        <div className="flex justify-center gap-1 mb-1">
          {DEC_UPPER_RIGHT.map((n) => <ToothBtn key={n} num={n} {...toothProps} />)}
          <div className="w-px bg-slate-300 mx-1" />
          {DEC_UPPER_LEFT.map((n) => <ToothBtn key={n} num={n} {...toothProps} />)}
        </div>
        <div className="text-center text-[9px] text-slate-300 font-mono mb-3">— Upper —</div>
        <div className="text-center text-[9px] text-slate-300 font-mono mb-1">— Lower —</div>
        <div className="flex justify-center gap-1">
          {DEC_LOWER_RIGHT.map((n) => <ToothBtn key={n} num={n} {...toothProps} />)}
          <div className="w-px bg-slate-300 mx-1" />
          {DEC_LOWER_LEFT.map((n) => <ToothBtn key={n} num={n} {...toothProps} />)}
        </div>
      </div>

      {/* Tooth editor panel */}
      <AnimatePresence>
        {selectedTooth !== null && canWrite && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-brand/20 p-5 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-dark dark:text-slate-100">Tooth {selectedTooth}</p>
              <button onClick={onCancel} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                <X size={14} />
              </button>
            </div>

            {saveError && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-danger/5 border border-danger/20 rounded-lg text-xs text-danger">
                <AlertTriangle size={12} /> {saveError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Condition</label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(CONDITION_CONFIG) as ToothCondition[]).map((cond) => {
                  const cfg = CONDITION_CONFIG[cond]
                  return (
                    <button
                      key={cond}
                      onClick={() => onConditionChange(cond)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                        editCondition === cond ? `${cfg.bg} ${cfg.color} border-current` : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      )}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {editCondition !== 'SOUND' && editCondition !== 'MISSING' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Surfaces Affected</label>
                <div className="flex flex-wrap gap-1.5">
                  {TOOTH_SURFACES.map((s) => {
                    const active = editSurfaces.includes(s)
                    return (
                      <button
                        key={s}
                        onClick={() => onSurfacesChange(active ? editSurfaces.filter((x) => x !== s) : [...editSurfaces, s])}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                          active ? 'bg-brand/10 text-brand border-brand/30' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        )}
                      >
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Clinical notes for this tooth..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>

            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Update Tooth'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Treatment Plans Tab
// ─────────────────────────────────────────────────────────────────────────────

function TreatmentPlansTab({ plans, currSym, canWrite, onNew, onEdit }: {
  plans: TreatmentPlan[]
  currSym: string
  canWrite: boolean
  onNew: () => void
  onEdit: (p: TreatmentPlan) => void
}) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-dark dark:text-slate-100">{plans.length} Plan{plans.length !== 1 ? 's' : ''}</p>
        {canWrite && (
          <button onClick={onNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors">
            <Plus size={14} /> New Plan
          </button>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList size={32} className="text-slate-300 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No treatment plans yet.</p>
          {canWrite && <p className="text-xs text-slate-400 mt-1">Click "New Plan" to create one.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const items: TreatmentPlanItem[] = (() => {
              try { return JSON.parse(plan.planItems) } catch { return [] }
            })()
            return (
              <div key={plan.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-dark dark:text-slate-100">{plan.title}</p>
                      <Badge variant={STATUS_VARIANT[plan.status] ?? 'neutral'} size="sm">{plan.status.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Created {fmt(plan.createdAt)}{plan.createdBy ? ` by ${plan.createdBy.fullName}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-dark dark:text-slate-100">{currSym}{Number(plan.totalEstimatedCost).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-slate-400">estimated</p>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', item.itemStatus === 'DONE' ? 'bg-success' : 'bg-slate-300')} />
                        {item.toothNumber && <span className="font-medium text-brand">T{item.toothNumber}</span>}
                        <span className="flex-1 truncate">{item.procedure}</span>
                        <span className="shrink-0 font-medium">{currSym}{Number(item.estimatedCost).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}

                {plan.notes && <p className="text-xs text-slate-400 mt-2 italic">{plan.notes}</p>}

                {canWrite && (
                  <button
                    onClick={() => onEdit(plan)}
                    className="mt-3 text-xs text-brand hover:underline"
                  >
                    Edit plan
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Recall Tab
// ─────────────────────────────────────────────────────────────────────────────

function RecallTab({ recall, form, saving, error, saved, canWrite, onChange, onSave }: {
  recall: RecallRecord | null
  form: { recallType: string; lastVisitDate: string; nextRecallDate: string; notes: string }
  saving: boolean
  error: string | null
  saved: boolean
  canWrite: boolean
  onChange: (f: { recallType: string; lastVisitDate: string; nextRecallDate: string; notes: string }) => void
  onSave: () => void
}) {
  function set(key: keyof typeof form, val: string) {
    onChange({ ...form, [key]: val })
  }

  const daysUntilRecall = recall ? Math.floor((new Date(recall.nextRecallDate).getTime() - Date.now()) / 86400000) : null

  return (
    <div className="p-6 max-w-lg">
      {recall && (
        <div className={cn(
          'mb-4 p-3 rounded-xl border text-sm font-medium flex items-center gap-2',
          daysUntilRecall !== null && daysUntilRecall < 0 ? 'bg-danger/5 border-danger/20 text-danger' :
          daysUntilRecall !== null && daysUntilRecall <= 7  ? 'bg-warning/5 border-warning/20 text-warning' :
          'bg-success/5 border-success/20 text-success'
        )}>
          <Calendar size={16} />
          {daysUntilRecall !== null && daysUntilRecall < 0
            ? `Recall overdue by ${Math.abs(daysUntilRecall)} days`
            : daysUntilRecall !== null && daysUntilRecall === 0
            ? 'Recall due today'
            : daysUntilRecall !== null
            ? `Next recall in ${daysUntilRecall} days — ${fmt(recall.nextRecallDate)}`
            : ''}
          {recall.reminderSent && <span className="ml-auto text-xs opacity-70">Reminder sent</span>}
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-danger/5 border border-danger/20 rounded-lg text-xs text-danger">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand border-b border-slate-100 dark:border-slate-800 pb-2">Recall Details</p>

        <Select
          label="Recall Type"
          value={form.recallType}
          onChange={(e) => set('recallType', e.target.value)}
          disabled={!canWrite}
        >
          {Object.entries(RECALL_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Last Visit Date <span className="text-danger">*</span></label>
            <input
              type="date"
              value={form.lastVisitDate}
              onChange={(e) => set('lastVisitDate', e.target.value)}
              disabled={!canWrite}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 dark:bg-slate-800 disabled:text-slate-500 dark:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Next Recall Date <span className="text-danger">*</span></label>
            <input
              type="date"
              value={form.nextRecallDate}
              onChange={(e) => set('nextRecallDate', e.target.value)}
              disabled={!canWrite}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 dark:bg-slate-800 disabled:text-slate-500 dark:text-slate-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            disabled={!canWrite}
            placeholder="Any special recall instructions..."
            rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 dark:bg-slate-800 disabled:text-slate-500 dark:text-slate-400"
          />
        </div>

        {canWrite && (
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            {saved ? <CheckCircle2 size={14} className="text-white" /> : <Save size={14} />}
            {saving ? 'Saving...' : saved ? 'Saved!' : recall ? 'Update Recall' : 'Set Recall Date'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Treatment Plan Modal
// ─────────────────────────────────────────────────────────────────────────────

function TreatmentPlanModal({ patientId, plan, currSym, onClose, onSaved }: {
  patientId: string
  plan: TreatmentPlan | null
  currSym: string
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(plan?.title ?? 'Treatment Plan')
  const [status, setStatus] = useState(plan?.status ?? 'PROPOSED')
  const [notes, setNotes] = useState(plan?.notes ?? '')
  const [items, setItems] = useState<TreatmentPlanItem[]>(() => {
    try { return plan ? JSON.parse(plan.planItems) : [] } catch { return [] }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addItem() {
    setItems((prev) => [...prev, { procedure: '', estimatedCost: 0, itemStatus: 'PENDING' }])
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, key: keyof TreatmentPlanItem, value: string | number | undefined) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item))
  }

  const totalEstimatedCost = items.reduce((sum, i) => sum + (Number(i.estimatedCost) || 0), 0)

  async function handleSave() {
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    setError(null)

    let res
    if (plan) {
      res = await api.treatmentPlan.update({
        id: plan.id, title, status,
        planItems: JSON.stringify(items), totalEstimatedCost,
        notes: notes || null,
      })
    } else {
      res = await api.treatmentPlan.create({
        patientId, title, status,
        planItems: JSON.stringify(items), totalEstimatedCost,
        notes: notes || undefined,
      })
    }

    setSaving(false)
    if (!res.success) { setError(res.error?.message ?? 'Could not save treatment plan.'); return }
    onSaved()
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{plan ? 'Edit Treatment Plan' : 'New Treatment Plan'}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-danger/5 border border-danger/20 rounded-lg text-xs text-danger">
              <AlertTriangle size={12} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Plan Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Phase 1 — Caries Control"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED'].map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </Select>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Total Estimate</label>
              <div className="h-11 px-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 flex items-center font-semibold">
                {currSym}{totalEstimatedCost.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Plan items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Procedures</label>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-brand hover:underline">
                <Plus size={12} /> Add
              </button>
            </div>
            {items.length === 0 && (
              <p className="text-xs text-slate-400 py-2">No procedures added yet.</p>
            )}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="number"
                    min={11}
                    max={85}
                    placeholder="T#"
                    value={item.toothNumber ?? ''}
                    onChange={(e) => {
                      const n = parseInt(e.target.value)
                      updateItem(idx, 'toothNumber', isNaN(n) ? undefined : n)
                    }}
                    className="w-14 h-9 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand/30 text-center"
                  />
                  <input
                    value={item.procedure}
                    onChange={(e) => updateItem(idx, 'procedure', e.target.value)}
                    placeholder="Procedure name"
                    className="flex-1 h-9 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand/30"
                  />
                  <input
                    type="number"
                    min={0}
                    value={item.estimatedCost}
                    onChange={(e) => updateItem(idx, 'estimatedCost', parseFloat(e.target.value) || 0)}
                    className="w-20 h-9 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand/30 text-right"
                  />
                  <select
                    value={item.itemStatus}
                    onChange={(e) => updateItem(idx, 'itemStatus', e.target.value as 'PENDING' | 'DONE')}
                    className="w-20 h-9 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand/30 bg-white dark:bg-slate-900"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="DONE">Done</option>
                  </select>
                  <button onClick={() => removeItem(idx)} className="p-1.5 text-slate-400 hover:text-danger">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function condColor(cond: ToothCondition): string {
  const map: Record<ToothCondition, string> = {
    SOUND:           '#cbd5e1',
    CARIES:          '#dc2626',
    FILLED:          '#2563eb',
    MISSING:         '#f1f5f9',
    CROWN:           '#d97706',
    BRIDGE_ABUTMENT: '#9333ea',
    IMPLANT:         '#059669',
    ROOT_CANAL:      '#ea580c',
    EXTRACTION_SITE: '#e11d48',
    FRACTURE:        '#db2777',
  }
  return map[cond] ?? '#cbd5e1'
}
