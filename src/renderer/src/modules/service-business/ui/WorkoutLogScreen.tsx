import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Activity, RefreshCw, Plus, TrendingUp } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useIndustryStore } from '@app/store/industry.store'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { useNotificationStore } from '@app/store/notification.store'

interface Trainer { id: string; fullName: string }
interface WorkoutLogRow {
  id: string
  customerId: string
  exerciseName: string
  machineName: string | null
  weight: number | null
  reps: number | null
  sets: number | null
  notes: string | null
  loggedAt: string
  trainer: { id: string; fullName: string } | null
  customer?: { id: string; customerName: string; phone: string | null }
}

const CHART_TICK = { fontSize: 10, fill: '#94a3b8' }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// 2026-09 — Gym/Studio: machine-based workout progress tracking. English-only
// (no i18n) — same deliberate scope-fork convention as this module's other
// Gym-only screens (MembershipsScreen, SessionPacksScreen, BatchClassesScreen)
// which are all plain-English, since GYM_STUDIO is a language-locked ('en')
// service vertical.
export function WorkoutLogScreen(): React.JSX.Element {
  const hasWorkoutTracking = useIndustryStore((s) => s.isModuleEnabled('workout_tracking'))
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission('workoutLog.manage')
  const { success: toastSuccess, error: toastError } = useNotificationStore()

  const [logs, setLogs] = useState<WorkoutLogRow[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [knownExercises, setKnownExercises] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [pickedCustomer, setPickedCustomer] = useState<CustomerLite | null>(null)
  const [form, setForm] = useState({ exerciseName: '', machineName: '', weight: '', reps: '', sets: '', trainerId: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Progress view — pick a customer to see their trend for one exercise.
  const [progressCustomer, setProgressCustomer] = useState<CustomerLite | null>(null)
  const [progressExercise, setProgressExercise] = useState('')
  const [progressLogs, setProgressLogs] = useState<WorkoutLogRow[]>([])
  const [progressLoading, setProgressLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [logsRes, trainersRes, namesRes] = await Promise.all([
        api.workoutLog.listRecent({ limit: 150 }),
        api.hr.listEmployees({ isActive: true }),
        api.workoutLog.knownExerciseNames(),
      ])
      if (logsRes.success) setLogs((logsRes.data as WorkoutLogRow[]) ?? [])
      else toastError('Error', logsRes.error?.message ?? 'Could not load workout logs.')
      if (trainersRes.success && trainersRes.data) setTrainers((trainersRes.data as { employees: Trainer[] }).employees ?? [])
      if (namesRes.success) setKnownExercises((namesRes.data as string[]) ?? [])
    } catch {
      toastError('Error', 'Could not load workout logs.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!progressCustomer) { setProgressLogs([]); return }
    setProgressLoading(true)
    api.workoutLog.listForCustomer({ customerId: progressCustomer.id }).then((res) => {
      if (res.success) setProgressLogs((res.data as WorkoutLogRow[]) ?? [])
    }).finally(() => setProgressLoading(false))
  }, [progressCustomer])

  const progressExercises = useMemo(() => Array.from(new Set(progressLogs.map((l) => l.exerciseName))), [progressLogs])
  const progressChartData = useMemo(() => {
    if (!progressExercise) return []
    return progressLogs
      .filter((l) => l.exerciseName === progressExercise && l.weight != null)
      .slice().reverse()
      .map((l) => ({ label: fmtDate(l.loggedAt), weight: l.weight }))
  }, [progressLogs, progressExercise])

  function resetForm() {
    setPickedCustomer(null)
    setForm({ exerciseName: '', machineName: '', weight: '', reps: '', sets: '', trainerId: '', notes: '' })
    setFormError(null)
  }

  async function handleLogWorkout() {
    if (!pickedCustomer) { setFormError('Select a customer.'); return }
    if (!form.exerciseName.trim()) { setFormError('Exercise name is required.'); return }
    setSaving(true)
    setFormError(null)
    try {
      const res = await api.workoutLog.create({
        customerId: pickedCustomer.id,
        exerciseName: form.exerciseName.trim(),
        machineName: form.machineName.trim() || undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        reps: form.reps ? parseInt(form.reps, 10) : undefined,
        sets: form.sets ? parseInt(form.sets, 10) : undefined,
        trainerId: form.trainerId || undefined,
        notes: form.notes.trim() || undefined,
      })
      if (res.success) {
        toastSuccess('Workout logged', `${form.exerciseName} — ${pickedCustomer.customerName}`)
        setShowForm(false)
        resetForm()
        await load()
        if (progressCustomer?.id === pickedCustomer.id) {
          const refreshed = await api.workoutLog.listForCustomer({ customerId: pickedCustomer.id })
          if (refreshed.success) setProgressLogs((refreshed.data as WorkoutLogRow[]) ?? [])
        }
      } else {
        setFormError(res.error?.message ?? 'Could not log workout.')
      }
    } catch {
      setFormError('Could not log workout.')
    } finally {
      setSaving(false)
    }
  }

  if (!hasWorkoutTracking) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Activity size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Workout Log is not enabled for your business type.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">Workout Log</h2>
            <p className="text-sm text-slate-400">Machine and exercise progress — reps, weight, and sets over time</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {canManage && (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowForm((s) => !s)}>Log Workout</Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          {formError && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{formError}</p>}
          <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label="Member" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input label="Exercise / Machine" list="known-exercises" placeholder="e.g. Bench Press" value={form.exerciseName}
                onChange={(e) => setForm((f) => ({ ...f, exerciseName: e.target.value }))} />
              <datalist id="known-exercises">
                {knownExercises.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <Input label="Machine Name (optional)" placeholder="e.g. Smith Machine 2" value={form.machineName}
              onChange={(e) => setForm((f) => ({ ...f, machineName: e.target.value }))} />
            <Input label="Weight (kg, optional)" type="number" min="0" step="0.5" value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} />
            <Input label="Reps (optional)" type="number" min="0" value={form.reps}
              onChange={(e) => setForm((f) => ({ ...f, reps: e.target.value }))} />
            <Input label="Sets (optional)" type="number" min="0" value={form.sets}
              onChange={(e) => setForm((f) => ({ ...f, sets: e.target.value }))} />
            {trainers.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Trainer (optional)</label>
                <select value={form.trainerId} onChange={(e) => setForm((f) => ({ ...f, trainerId: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand">
                  <option value="">No trainer</option>
                  {trainers.map((tr) => <option key={tr.id} value={tr.id}>{tr.fullName}</option>)}
                </select>
              </div>
            )}
            <Input label="Notes (optional)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>Cancel</Button>
            <Button size="sm" onClick={() => void handleLogWorkout()} loading={saving}>Save</Button>
          </div>
        </Card>
      )}

      {/* Progress trend — pick a member + exercise to see weight over time */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-brand" />
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100">Progress Trend</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CustomerPicker value={progressCustomer} onChange={(c) => { setProgressCustomer(c); setProgressExercise('') }} label="Member" />
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Exercise</label>
            <select value={progressExercise} onChange={(e) => setProgressExercise(e.target.value)} disabled={progressExercises.length === 0}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-50">
              <option value="">{progressExercises.length === 0 ? 'No logs yet' : 'Select an exercise'}</option>
              {progressExercises.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>
        </div>
        {progressLoading ? (
          <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>
        ) : progressChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={progressChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} unit="kg" />
              <Tooltip formatter={(v: number) => `${v} kg`} />
              <Line type="monotone" dataKey="weight" stroke="#00AEEF" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : progressCustomer ? (
          <p className="text-sm text-slate-400 text-center py-6">{progressExercise ? 'No weight logged for this exercise yet.' : 'Select an exercise to see its trend.'}</p>
        ) : (
          <p className="text-sm text-slate-400 text-center py-6">Select a member to see their progress.</p>
        )}
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-2">Recent Logs</h3>
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>
        ) : logs.length === 0 ? (
          <Card padding="lg" className="text-center py-8">
            <p className="text-sm text-slate-400">No workouts logged yet.</p>
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {logs.map((row) => (
                <div key={row.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm dark:text-slate-100">
                      {row.customer?.customerName ?? '—'} <span className="font-normal text-slate-400">·</span> {row.exerciseName}
                      {row.machineName ? ` (${row.machineName})` : ''}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {[
                        row.weight != null ? `${row.weight} kg` : null,
                        row.reps != null ? `${row.reps} reps` : null,
                        row.sets != null ? `${row.sets} sets` : null,
                      ].filter(Boolean).join(' · ')}
                      {row.trainer ? ` · Trainer: ${row.trainer.fullName}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{fmtDate(row.loggedAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
