import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Activity, Dumbbell, Package, Plus, X, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Printer, Save, Trash2, GripVertical, RefreshCw, Pencil, AlertTriangle, Receipt,
} from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useIndustryStore } from '@app/store/industry.store'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { cn } from '@shared/utils/cn'
import { AszurexMark } from '@shared/ui/atoms/Brand'
import { DocumentWatermark, documentLogoUrl } from '@shared/ui/molecules/DocumentWatermark'
import { useNotificationStore } from '@app/store/notification.store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string
  customerName: string
  phone: string | null
}

interface TreatmentPhase {
  id: string
  phase: string
  title: string
  startDate: string
  endDate: string | null
  goals: string | null
  outcome: string | null
  isActive: boolean
  createdAt: string
  createdBy: { id: string; fullName: string } | null
}

interface Exercise {
  id: string
  name: string
  description: string
  sets: string
  reps: string
  hold: string
  frequency: string
  notes: string
}

interface ExerciseProgram {
  id: string
  title: string
  exercises: string
  isActive: boolean
  printedAt: string | null
  updatedAt: string
}

interface SessionLog {
  id: string
  deductedAt: string
  appointment: { id: string; appointmentNumber: string; scheduledDate: string; serviceTitle: string } | null
}

interface ClientSessionPack {
  id: string
  packName: string
  totalSessions: number
  usedSessions: number
  purchaseDate: string
  expiryDate: string | null
  pricePerPack: number
  taxRate: number
  sacCode: string | null
  invoiceId: string | null
  notes: string | null
  isActive: boolean
  sessionLogs?: SessionLog[]
}

const PHASE_LABELS: Record<string, string> = {
  ASSESSMENT:     'Initial Assessment',
  ACUTE:          'Acute Phase',
  SUB_ACUTE:      'Sub-Acute',
  REHABILITATION: 'Active Rehabilitation',
  MAINTENANCE:    'Maintenance',
  DISCHARGE:      'Discharge',
}

// Verified exhaustive against prisma/schema.prisma TreatmentPhase.phase comment
// (ASSESSMENT|ACUTE|SUB_ACUTE|REHABILITATION|MAINTENANCE|DISCHARGE) and the
// VALID_PHASES allow-list enforced in src/main/services/treatment-phase.service.ts,
// which rejects any other value at create/update time.
const PHASE_VARIANT: Record<string, 'brand' | 'danger' | 'warning' | 'success' | 'info' | 'neutral'> = {
  ASSESSMENT:     'brand',
  ACUTE:          'danger',
  SUB_ACUTE:      'warning',
  REHABILITATION: 'success',
  MAINTENANCE:    'info',
  DISCHARGE:      'neutral',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function newExercise(): Exercise {
  return { id: crypto.randomUUID(), name: '', description: '', sets: '', reps: '', hold: '', frequency: '', notes: '' }
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function PhysioPatientScreen() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const profile = useBusinessStore((s) => s.profile)
  const hasPhysioNotes = useIndustryStore((s) => s.isModuleEnabled('physio_notes'))
  const hasSessionPacks = useIndustryStore((s) => s.isModuleEnabled('session_packs'))
  const canWrite = hasPermission('clinicalNotes.write')
  const canBilling = hasPermission('billing.createInvoice')
  const { error: toastError } = useNotificationStore()

  const [tab, setTab] = useState<'treatment' | 'hep' | 'packs'>('treatment')
  const [patient, setPatient] = useState<Patient | null>(null)

  const [phases, setPhases] = useState<TreatmentPhase[]>([])
  const [program, setProgram] = useState<ExerciseProgram | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [packs, setPacks] = useState<ClientSessionPack[]>([])
  const [activePack, setActivePack] = useState<ClientSessionPack | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hepSaveError, setHepSaveError] = useState<string | null>(null)

  const [showNewPhase, setShowNewPhase] = useState(false)
  const [showClosePhase, setShowClosePhase] = useState<string | null>(null)
  const [showNewPack, setShowNewPack] = useState(false)
  const [showPrintHEP, setShowPrintHEP] = useState(false)
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
    const [custRes, phaseRes, hepRes, packRes] = await Promise.all([
      api.customers.get(patientId),
      hasPhysioNotes ? api.treatmentPhase.list({ patientId }) : Promise.resolve({ success: false, data: null }),
      hasPhysioNotes ? api.exerciseProgram.getActive({ patientId }) : Promise.resolve({ success: false, data: null }),
      hasSessionPacks ? api.sessionPack.list({ customerId: patientId }) : Promise.resolve({ success: false, data: null }),
    ])
    if (custRes.success && custRes.data) setPatient(custRes.data as Patient)
    else toastError('Error', (custRes as { error?: { message: string } }).error?.message ?? 'Could not load patient.')
    if (phaseRes.success && phaseRes.data) setPhases(phaseRes.data as TreatmentPhase[])
    if (hepRes.success) {
      const p = hepRes.data as ExerciseProgram | null
      setProgram(p)
      if (p) {
        try { setExercises(JSON.parse(p.exercises) as Exercise[]) } catch { setExercises([]) }
      } else {
        setExercises([])
      }
    }
    if (packRes.success && packRes.data) {
      const allPacks = packRes.data as ClientSessionPack[]
      setPacks(allPacks)
      setActivePack(allPacks.find((pk) => pk.isActive && pk.usedSessions < pk.totalSessions) ?? null)
    }
    } catch {
      toastError('Error', 'Could not load patient.')
    } finally {
      setLoading(false)
    }
  }, [patientId, hasPhysioNotes, hasSessionPacks, toastError])

  useEffect(() => { load() }, [load])

  // ─── HEP actions ─────────────────────────────────────────────────────────

  function addExercise() {
    setExercises((prev) => [...prev, newExercise()])
    setSaved(false)
  }

  function removeExercise(id: string) {
    setExercises((prev) => prev.filter((e) => e.id !== id))
    setSaved(false)
  }

  function updateExercise(id: string, key: keyof Exercise, value: string) {
    setExercises((prev) => prev.map((e) => e.id === id ? { ...e, [key]: value } : e))
    setSaved(false)
  }

  async function saveHEP() {
    if (!patientId) return
    setSaving(true)
    const res = await api.exerciseProgram.upsert({ patientId, exercises: JSON.stringify(exercises), title: program?.title ?? 'Home Exercise Program' })
    setSaving(false)
    if (res.success) {
      setHepSaveError(null)
      setSaved(true)
      load()
    } else {
      setHepSaveError(res.error?.message ?? 'Could not save program.')
    }
  }

  function handlePrintHEP() {
    setShowPrintHEP(true)
  }

  async function handleActualPrint() {
    if (program) {
      await api.exerciseProgram.markPrinted({ id: program.id }).catch(() => {})
      load()
    }
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
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">{patient?.customerName ?? 'Physio Patient'}</h1>
            {patient?.phone && <p className="text-xs text-slate-500 dark:text-slate-400">{patient.phone}</p>}
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex gap-1 shrink-0">
        {[
          { id: 'treatment' as const, label: 'Treatment', icon: <Activity size={13} />, show: hasPhysioNotes },
          { id: 'hep' as const, label: 'Exercise Program', icon: <Dumbbell size={13} />, show: hasPhysioNotes },
          { id: 'packs' as const, label: 'Session Packs', icon: <Package size={13} />, show: hasSessionPacks },
        ].filter((t) => t.show).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === t.id ? 'border-brand text-brand' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === 'treatment' && (
          <TreatmentTab
            phases={phases}
            patientId={patientId!}
            canWrite={canWrite}
            showNewPhase={showNewPhase}
            showClosePhase={showClosePhase}
            expandedPhase={expandedPhase}
            setShowNewPhase={setShowNewPhase}
            setShowClosePhase={setShowClosePhase}
            setExpandedPhase={setExpandedPhase}
            onRefresh={load}
          />
        )}
        {tab === 'hep' && (
          <HEPTab
            exercises={exercises}
            program={program}
            canWrite={canWrite}
            saving={saving}
            saved={saved}
            saveError={hepSaveError}
            onAdd={addExercise}
            onRemove={removeExercise}
            onUpdate={updateExercise}
            onSave={saveHEP}
            onPrint={handlePrintHEP}
          />
        )}
        {tab === 'packs' && (
          <SessionPacksTab
            packs={packs}
            activePack={activePack}
            patientId={patientId!}
            canBilling={canBilling}
            currSym={profile?.currencySymbol ?? '₹'}
            showNewPack={showNewPack}
            setShowNewPack={setShowNewPack}
            onRefresh={load}
          />
        )}
      </div>

      {/* HEP Print Modal */}
      {showPrintHEP && (
        <HEPPrintModal
          exercises={exercises}
          title={program?.title ?? 'Home Exercise Program'}
          patientName={patient?.customerName ?? ''}
          profile={profile}
          onClose={() => setShowPrintHEP(false)}
          onPrinted={handleActualPrint}
        />
      )}
    </div>
  )
}

// ─── Treatment Tab ────────────────────────────────────────────────────────────

interface TreatmentTabProps {
  phases: TreatmentPhase[]
  patientId: string
  canWrite: boolean
  showNewPhase: boolean
  showClosePhase: string | null
  expandedPhase: string | null
  setShowNewPhase: (v: boolean) => void
  setShowClosePhase: (v: string | null) => void
  setExpandedPhase: (v: string | null) => void
  onRefresh: () => void
}

function TreatmentTab({ phases, patientId, canWrite, showNewPhase, showClosePhase, expandedPhase, setShowNewPhase, setShowClosePhase, setExpandedPhase, onRefresh }: TreatmentTabProps) {
  const [newPhaseForm, setNewPhaseForm] = useState({ phase: 'ASSESSMENT', title: '', startDate: new Date().toISOString().split('T')[0], goals: '' })
  const [closeOutcome, setCloseOutcome] = useState('')
  const [editingPhase, setEditingPhase] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ phase: 'ASSESSMENT', title: '', startDate: '', goals: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreatePhase() {
    if (!newPhaseForm.title.trim()) return
    setSaving(true)
    const res = await api.treatmentPhase.create({ patientId, ...newPhaseForm })
    setSaving(false)
    if (!res.success) { setError(res.error?.message ?? 'Could not create phase.'); return }
    setError(null)
    setShowNewPhase(false)
    setNewPhaseForm({ phase: 'ASSESSMENT', title: '', startDate: new Date().toISOString().split('T')[0], goals: '' })
    onRefresh()
  }

  async function handleClosePhase(id: string) {
    setSaving(true)
    const res = await api.treatmentPhase.close({ id, outcome: closeOutcome || undefined })
    setSaving(false)
    if (!res.success) { setError(res.error?.message ?? 'Could not close phase.'); return }
    setError(null)
    setShowClosePhase(null)
    setCloseOutcome('')
    onRefresh()
  }

  async function handleUpdatePhase(id: string) {
    if (!editForm.title.trim()) return
    setSaving(true)
    const res = await api.treatmentPhase.update({
      id,
      phase: editForm.phase,
      title: editForm.title.trim(),
      startDate: editForm.startDate,
      goals: editForm.goals.trim() || null,
    })
    setSaving(false)
    if (!res.success) { setError(res.error?.message ?? 'Could not update phase.'); return }
    setError(null)
    setEditingPhase(null)
    onRefresh()
  }

  function startEdit(phase: TreatmentPhase) {
    setEditingPhase(phase.id)
    setExpandedPhase(phase.id)
    setShowClosePhase(null)
    setCloseOutcome('')
    setEditForm({
      phase: phase.phase,
      title: phase.title,
      startDate: new Date(phase.startDate).toISOString().split('T')[0],
      goals: phase.goals ?? '',
    })
  }

  return (
    <div className="max-w-2xl space-y-4">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-danger/5 border border-danger/20 rounded-xl text-xs text-danger">
          <AlertTriangle size={12} /> {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-dark dark:text-slate-100">Treatment Phases</p>
        {canWrite && (
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowNewPhase(true)}>
            New Phase
          </Button>
        )}
      </div>

      {/* New phase form */}
      <AnimatePresence>
        {showNewPhase && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-brand/20 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-dark dark:text-slate-100">Add Treatment Phase</p>
              <button onClick={() => setShowNewPhase(false)} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Phase Type"
                value={newPhaseForm.phase}
                onChange={(e) => setNewPhaseForm((f) => ({ ...f, phase: e.target.value }))}
              >
                {Object.entries(PHASE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Input label="Start Date" type="date" value={newPhaseForm.startDate}
                onChange={(e) => setNewPhaseForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <Input label="Phase Title" placeholder="e.g. Post-operative rehab — knee" value={newPhaseForm.title}
              onChange={(e) => setNewPhaseForm((f) => ({ ...f, title: e.target.value }))} required />
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Goals (optional)</label>
              <textarea
                value={newPhaseForm.goals}
                onChange={(e) => setNewPhaseForm((f) => ({ ...f, goals: e.target.value }))}
                placeholder="Therapy goals for this phase..."
                rows={3}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => setShowNewPhase(false)}>Cancel</Button>
              <Button size="sm" loading={saving} onClick={handleCreatePhase} disabled={!newPhaseForm.title.trim()}>Save Phase</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phases.length === 0 && !showNewPhase && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Activity size={32} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No treatment phases yet</p>
          {canWrite && <p className="text-xs text-slate-400 mt-1">Click "New Phase" to begin the treatment journey.</p>}
        </div>
      )}

      {phases.map((phase) => {
        const isExpanded = expandedPhase === phase.id
        const isClosing = showClosePhase === phase.id
        const isEditing = editingPhase === phase.id
        return (
          <motion.div key={phase.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
            >
              <Badge variant={PHASE_VARIANT[phase.phase] ?? 'neutral'} size="sm" className="shrink-0">
                {PHASE_LABELS[phase.phase] ?? phase.phase}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-dark dark:text-slate-100 truncate">{phase.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{fmt(phase.startDate)} {phase.endDate ? `→ ${fmt(phase.endDate)}` : '(ongoing)'}</p>
              </div>
              {phase.isActive ? (
                <Badge variant="success" size="sm" icon={<Clock size={10} />} className="shrink-0">Active</Badge>
              ) : (
                <Badge variant="neutral" size="sm" icon={<CheckCircle2 size={10} />} className="shrink-0">Closed</Badge>
              )}
              {isExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="p-4 space-y-3">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Edit Phase</p>
                          <button onClick={() => setEditingPhase(null)} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={14} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Select
                            label="Phase Type"
                            value={editForm.phase}
                            onChange={(e) => setEditForm((f) => ({ ...f, phase: e.target.value }))}
                          >
                            {Object.entries(PHASE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </Select>
                          <Input label="Start Date" type="date" value={editForm.startDate}
                            onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))} />
                        </div>
                        <Input label="Phase Title" value={editForm.title} required
                          onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Goals (optional)</label>
                          <textarea value={editForm.goals} onChange={(e) => setEditForm((f) => ({ ...f, goals: e.target.value }))}
                            placeholder="Therapy goals for this phase..."
                            rows={3} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="secondary" onClick={() => setEditingPhase(null)}>Cancel</Button>
                          <Button size="sm" loading={saving} onClick={() => handleUpdatePhase(phase.id)} disabled={!editForm.title.trim()}>Save Changes</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {phase.goals && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Goals</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{phase.goals}</p>
                          </div>
                        )}
                        {phase.outcome && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Outcome</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{phase.outcome}</p>
                          </div>
                        )}
                        {phase.createdBy && <p className="text-xs text-slate-400">Recorded by {phase.createdBy.fullName}</p>}

                        {canWrite && isClosing && (
                          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Close phase — add outcome notes</p>
                            <textarea value={closeOutcome} onChange={(e) => setCloseOutcome(e.target.value)}
                              placeholder="Goals achieved, patient progress, reason for moving to next phase..."
                              rows={3} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
                            <div className="flex gap-2">
                              <Button size="sm" variant="secondary" onClick={() => { setShowClosePhase(null); setCloseOutcome('') }}>Cancel</Button>
                              <Button size="sm" loading={saving} onClick={() => handleClosePhase(phase.id)}>Close Phase</Button>
                            </div>
                          </div>
                        )}

                        {canWrite && !isClosing && (
                          <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                            {phase.isActive && (
                              <button onClick={() => { setShowClosePhase(phase.id); setExpandedPhase(phase.id) }}
                                className="text-xs text-slate-500 dark:text-slate-400 hover:text-dark dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 transition-colors">
                                Close This Phase
                              </button>
                            )}
                            <button onClick={() => startEdit(phase)}
                              className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-brand border border-slate-200 dark:border-slate-700 hover:border-brand/30 rounded-lg px-3 py-1.5 transition-colors">
                              <Pencil size={11} /> Edit
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── HEP Tab ─────────────────────────────────────────────────────────────────

interface HEPTabProps {
  exercises: Exercise[]
  program: ExerciseProgram | null
  canWrite: boolean
  saving: boolean
  saved: boolean
  saveError: string | null
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, key: keyof Exercise, value: string) => void
  onSave: () => void
  onPrint: () => void
}

function HEPTab({ exercises, program, canWrite, saving, saved, saveError, onAdd, onRemove, onUpdate, onSave, onPrint }: HEPTabProps) {
  return (
    <div className="max-w-2xl space-y-4">
      {saveError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-danger/5 border border-danger/20 rounded-xl text-xs text-danger">
          <AlertTriangle size={12} /> {saveError}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-dark dark:text-slate-100">Home Exercise Program</p>
          {program?.printedAt && <p className="text-xs text-slate-400 mt-0.5">Last printed {fmt(program.printedAt)}</p>}
        </div>
        <div className="flex items-center gap-2">
          {exercises.length > 0 && (
            <button onClick={onPrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <Printer size={13} /> Print HEP
            </button>
          )}
          {canWrite && (
            <Button size="sm" icon={<Plus size={13} />} onClick={onAdd}>Add Exercise</Button>
          )}
        </div>
      </div>

      {exercises.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Dumbbell size={32} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No exercises yet</p>
          {canWrite && <p className="text-xs text-slate-400 mt-1">Click "Add Exercise" to build the home program.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {exercises.map((ex, idx) => (
            <motion.div key={ex.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-slate-300 shrink-0" />
                <span className="text-xs font-bold text-brand shrink-0 w-6">{idx + 1}.</span>
                <input
                  value={ex.name}
                  onChange={(e) => onUpdate(ex.id, 'name', e.target.value)}
                  disabled={!canWrite}
                  placeholder="Exercise name (e.g. Knee extension)"
                  className="flex-1 text-sm font-semibold border-0 focus:outline-none focus:ring-0 bg-transparent placeholder:text-slate-300"
                />
                {canWrite && (
                  <button onClick={() => onRemove(ex.id)} className="shrink-0 p-1 text-slate-300 hover:text-danger transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <input
                value={ex.description}
                onChange={(e) => onUpdate(ex.id, 'description', e.target.value)}
                disabled={!canWrite}
                placeholder="How to perform (starting position, movement, tips)..."
                className="w-full text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 dark:bg-slate-800 disabled:text-slate-500 dark:text-slate-400"
              />
              <div className="grid grid-cols-4 gap-2">
                {(['sets', 'reps', 'hold', 'frequency'] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">{field}</label>
                    <input
                      value={ex[field]}
                      onChange={(e) => onUpdate(ex.id, field, e.target.value)}
                      disabled={!canWrite}
                      placeholder={field === 'hold' ? 'e.g. 5s' : field === 'frequency' ? 'e.g. 2x/day' : 'e.g. 3'}
                      className="w-full h-8 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 dark:bg-slate-800 disabled:text-slate-500 dark:text-slate-400"
                    />
                  </div>
                ))}
              </div>
              <input
                value={ex.notes}
                onChange={(e) => onUpdate(ex.id, 'notes', e.target.value)}
                disabled={!canWrite}
                placeholder="Additional notes (e.g. avoid if painful, progress to next level when..."
                className="w-full text-xs text-slate-500 dark:text-slate-400 border-0 focus:outline-none focus:ring-0 bg-transparent placeholder:text-slate-300 italic"
              />
            </motion.div>
          ))}
        </div>
      )}

      {canWrite && exercises.length > 0 && (
        <div className="flex justify-end pt-2">
          <Button size="sm" variant="secondary" loading={saving} icon={saved ? <CheckCircle2 size={13} className="text-success" /> : <Save size={13} />} onClick={onSave}>
            {saved ? 'Saved' : 'Save Program'}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Session Packs Tab ────────────────────────────────────────────────────────

interface SessionPacksTabProps {
  packs: ClientSessionPack[]
  activePack: ClientSessionPack | null
  patientId: string
  canBilling: boolean
  currSym: string
  showNewPack: boolean
  setShowNewPack: (v: boolean) => void
  onRefresh: () => void
}

function SessionPacksTab({ packs, activePack, patientId, canBilling, currSym, showNewPack, setShowNewPack, onRefresh }: SessionPacksTabProps) {
  const [form, setForm] = useState({
    packName: '',
    totalSessions: 10,
    purchaseDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    pricePerPack: 0,
    taxRate: 18,
    sacCode: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  async function handleCreatePack() {
    if (!form.packName.trim()) { setError('Pack name is required.'); return }
    if (form.totalSessions < 1) { setError('Sessions must be at least 1.'); return }
    setSaving(true)
    setError(null)
    const res = await api.sessionPack.create({
      customerId: patientId,
      packName: form.packName,
      totalSessions: form.totalSessions,
      purchaseDate: form.purchaseDate,
      expiryDate: form.expiryDate || undefined,
      pricePerPack: form.pricePerPack,
      taxRate: form.taxRate,
      sacCode: form.sacCode || undefined,
      notes: form.notes || undefined,
    })
    setSaving(false)
    if (res.success) {
      setShowNewPack(false)
      setForm({ packName: '', totalSessions: 10, purchaseDate: new Date().toISOString().split('T')[0], expiryDate: '', pricePerPack: 0, taxRate: 18, sacCode: '', notes: '' })
      onRefresh()
    } else {
      setError(res.error?.message ?? 'Could not create pack.')
    }
  }

  async function handleGenerateInvoice(packId: string) {
    setInvoiceError(null)
    setGeneratingId(packId)
    const res = await api.sessionPack.generateInvoice({ id: packId })
    if (res.success) {
      onRefresh()
    } else {
      setInvoiceError(res.error?.message ?? 'Could not generate invoice.')
    }
    setGeneratingId(null)
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-dark dark:text-slate-100">Session Packs</p>
        {canBilling && (
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowNewPack(true)}>Buy Pack</Button>
        )}
      </div>

      {/* Active pack banner */}
      {activePack && (
        <div className="bg-success/5 border border-success/30 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-dark dark:text-slate-100">{activePack.packName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Purchased {fmt(activePack.purchaseDate)}{activePack.expiryDate ? ` · Expires ${fmt(activePack.expiryDate)}` : ''}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-success">{activePack.totalSessions - activePack.usedSessions}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">of {activePack.totalSessions} sessions left</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-success h-2 rounded-full transition-all"
                style={{ width: `${Math.max(0, ((activePack.totalSessions - activePack.usedSessions) / activePack.totalSessions) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* New pack form */}
      <AnimatePresence>
        {showNewPack && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-brand/20 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-dark dark:text-slate-100">Buy Session Pack</p>
              <button onClick={() => setShowNewPack(false)} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={16} /></button>
            </div>
            {error && <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <Input label="Pack Name" placeholder="e.g. 10-session Physio Pack" value={form.packName}
                onChange={(e) => setForm((f) => ({ ...f, packName: e.target.value }))} required />
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Number of Sessions <span className="text-danger">*</span></label>
                <input type="number" min={1} value={form.totalSessions}
                  onChange={(e) => setForm((f) => ({ ...f, totalSessions: parseInt(e.target.value) || 1 }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
              </div>
              <Input label="Purchase Date" type="date" value={form.purchaseDate}
                onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
              <Input label="Expiry Date (optional)" type="date" value={form.expiryDate}
                onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Pack Price</label>
                <input type="number" min={0} value={form.pricePerPack}
                  onChange={(e) => setForm((f) => ({ ...f, pricePerPack: parseFloat(e.target.value) || 0 }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">GST Rate (%)</label>
                <input type="number" min={0} max={28} value={form.taxRate}
                  onChange={(e) => setForm((f) => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
              </div>
              <Input label="SAC Code (optional)" placeholder="e.g. 999723" value={form.sacCode}
                onChange={(e) => setForm((f) => ({ ...f, sacCode: e.target.value }))} />
              <Input label="Notes (optional)" value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => setShowNewPack(false)}>Cancel</Button>
              <Button size="sm" loading={saving} onClick={handleCreatePack}>Save Pack</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {invoiceError && <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{invoiceError}</p>}

      {packs.length === 0 && !showNewPack ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package size={32} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No session packs yet</p>
          {canBilling && <p className="text-xs text-slate-400 mt-1">Click "Buy Pack" to record a new session purchase.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {packs.map((pack) => {
            const remaining = pack.totalSessions - pack.usedSessions
            const isExpired = pack.expiryDate ? new Date(pack.expiryDate) < new Date() : false
            return (
              <div key={pack.id} className={cn('bg-white dark:bg-slate-900 rounded-xl border p-4 flex items-center gap-4',
                pack.isActive && !isExpired && remaining > 0 ? 'border-success/30' : 'border-slate-200 dark:border-slate-700 opacity-70')}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-dark dark:text-slate-100 truncate">{pack.packName}</p>
                    {isExpired && <Badge variant="danger" size="sm">Expired</Badge>}
                    {!pack.isActive && !isExpired && <Badge variant="neutral" size="sm">Depleted</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {pack.usedSessions}/{pack.totalSessions} sessions used · {currSym}{Number(pack.pricePerPack).toLocaleString('en-IN')} · {fmt(pack.purchaseDate)}
                  </p>
                </div>
                <div className={cn('text-right shrink-0', remaining <= 2 && remaining > 0 ? 'text-warning' : remaining === 0 ? 'text-slate-400' : 'text-success')}>
                  <p className="text-lg font-bold">{remaining}</p>
                  <p className="text-xs">remaining</p>
                </div>
                {pack.invoiceId ? (
                  <span className="shrink-0 text-xs text-success font-medium px-1">Invoiced</span>
                ) : canBilling && Number(pack.pricePerPack) > 0 && (
                  <button
                    onClick={() => handleGenerateInvoice(pack.id)}
                    disabled={generatingId === pack.id}
                    title="Generate Invoice"
                    className="shrink-0 p-1.5 text-slate-400 hover:text-success hover:bg-success/5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Receipt size={14} />
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

// ─── HEP Print Modal ──────────────────────────────────────────────────────────

interface BusinessProfile {
  businessName: string
  address?: string | null
  city?: string | null
  state?: string | null
  phone?: string | null
  logoPath?: string | null
  enableDocumentWatermark?: boolean | null
}

function HEPPrintModal({ exercises, title, patientName, profile, onClose, onPrinted }: {
  exercises: Exercise[]
  title: string
  patientName: string
  profile: BusinessProfile | null
  onClose: () => void
  onPrinted: () => void
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handlePrint() {
    window.print()
    onPrinted()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between print:hidden">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">Home Exercise Program — Preview</p>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors">
                <Printer size={14} /> Print
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-dark dark:hover:text-slate-100 transition-colors">✕</button>
            </div>
          </div>
          <div className="p-8">
            <HEPBody exercises={exercises} title={title} patientName={patientName} profile={profile} />
          </div>
        </div>
      </div>
      <div className="hidden print:block fixed inset-0 bg-white dark:bg-slate-900 z-[9999] p-10">
        <HEPBody exercises={exercises} title={title} patientName={patientName} profile={profile} />
      </div>
    </>
  )
}

function HEPBody({ exercises, title, patientName, profile }: {
  exercises: Exercise[]
  title: string
  patientName: string
  profile: BusinessProfile | null
}) {
  return (
    <div style={{ fontFamily: 'Georgia, serif' }} className="relative text-dark dark:text-slate-100 text-sm">
      <DocumentWatermark logoPath={profile?.logoPath} enabled={profile?.enableDocumentWatermark} />
      {/* Header */}
      <div className="text-center border-b-2 border-dark pb-4 mb-6">
        <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 dark:text-slate-400 uppercase mb-1">Physiotherapy</p>
        {profile?.logoPath && (
          <img src={documentLogoUrl(profile.logoPath)} alt="" className="mx-auto mb-2" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
        )}
        <h1 className="text-2xl font-bold">{profile?.businessName ?? 'Physio Clinic'}</h1>
        {(profile?.address || profile?.city) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{[profile?.address, profile?.city, profile?.state].filter(Boolean).join(', ')}</p>
        )}
        {profile?.phone && <p className="text-xs text-slate-500 dark:text-slate-400">Tel: {profile.phone}</p>}
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Patient</p>
          <p className="text-base font-bold">{patientName}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Date</p>
          <p className="text-sm">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <h2 className="text-lg font-bold text-center mb-6 border-b border-slate-200 dark:border-slate-700 pb-3">{title}</h2>

      <div className="space-y-5">
        {exercises.map((ex, idx) => (
          <div key={ex.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 break-inside-avoid">
            <div className="flex items-start gap-3 mb-2">
              <span className="text-base font-bold text-brand shrink-0">{idx + 1}.</span>
              <p className="text-base font-bold">{ex.name}</p>
            </div>
            {ex.description && <p className="text-xs text-slate-700 dark:text-slate-300 mb-3 ml-6 leading-relaxed">{ex.description}</p>}
            <div className="flex gap-4 ml-6 flex-wrap">
              {ex.sets && <span className="text-xs font-medium"><span className="text-slate-400">Sets: </span>{ex.sets}</span>}
              {ex.reps && <span className="text-xs font-medium"><span className="text-slate-400">Reps: </span>{ex.reps}</span>}
              {ex.hold && <span className="text-xs font-medium"><span className="text-slate-400">Hold: </span>{ex.hold}</span>}
              {ex.frequency && <span className="text-xs font-medium"><span className="text-slate-400">Frequency: </span>{ex.frequency}</span>}
            </div>
            {ex.notes && <p className="text-xs text-slate-500 dark:text-slate-400 italic ml-6 mt-2">{ex.notes}</p>}
          </div>
        ))}
      </div>

      <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-12">
        <div className="text-center">
          <div className="border-b border-dark h-10 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Physiotherapist Signature</p>
        </div>
        <div className="text-center">
          <div className="border-b border-dark h-10 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Clinic Stamp</p>
        </div>
      </div>

      {/* Clinical disclaimer */}
      <div className="mt-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <p className="text-[8px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong>Disclaimer:</strong> This document was generated by Sarang Business OS Lite, a convenience tool.
          It is NOT a validated medical record, prescription, or clinical report. All content was entered by the
          practitioner. Verify all information before clinical use.
        </p>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[9px] text-slate-400">Issued on {new Date().toLocaleDateString('en-IN')} · {profile?.businessName ?? 'Physio Clinic'}</p>
        <p className="text-[9px] text-slate-300 mt-0.5 inline-flex items-center gap-1">
          Generated by Sarang Business OS Lite | Aszurex <AszurexMark width={10} /> | www.aszurex.com
        </p>
      </div>
    </div>
  )
}
