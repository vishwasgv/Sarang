import React, { useState, useEffect, useCallback } from 'react'
import { Activity, Plus, Trash2 } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Card } from '@shared/ui/molecules/Card'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useNotificationStore } from '@app/store/notification.store'

interface NormalRange {
  id: string
  testName: string
  unit: string | null
  minValue: number | null
  maxValue: number | null
  gender: string
  notes: string | null
}

// A doctor or lab saves "what's normal for this test" exactly once here —
// VisitNoteScreen's vitals and LabOrdersScreen's result entry both look this
// up automatically instead of the value being re-derived from memory every
// single time a result comes in.
export function NormalRangesScreen() {
  const { hasPermission } = useAuthStore()
  const { error: toastError } = useNotificationStore()
  const canWrite = hasPermission('clinicalNotes.write')

  const [ranges, setRanges] = useState<NormalRange[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [testName, setTestName] = useState('')
  const [unit, setUnit] = useState('')
  const [minValue, setMinValue] = useState('')
  const [maxValue, setMaxValue] = useState('')
  const [gender, setGender] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL')
  const [notes, setNotes] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<NormalRange | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.normalRange.list()
      if (res.success) setRanges((res.data as NormalRange[]) ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load normal ranges.')
    } catch {
      toastError('Error', 'Could not load normal ranges.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  function resetForm(): void {
    setTestName(''); setUnit(''); setMinValue(''); setMaxValue(''); setGender('ALL'); setNotes('')
  }

  async function handleSave(): Promise<void> {
    if (!testName.trim()) return
    setSaving(true)
    try {
      const res = await api.normalRange.save({
        testName: testName.trim(),
        unit: unit.trim() || undefined,
        minValue: minValue !== '' ? Number(minValue) : undefined,
        maxValue: maxValue !== '' ? Number(maxValue) : undefined,
        gender,
        notes: notes.trim() || undefined,
      })
      if (res.success) { setShowForm(false); resetForm(); load() }
      else toastError('Error', res.error?.message ?? 'Could not save normal range.')
    } catch {
      toastError('Error', 'Could not save normal range.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await api.normalRange.delete({ id: deleteTarget.id })
      if (res.success) { setDeleteTarget(null); load() }
      else toastError('Error', res.error?.message ?? 'Could not delete normal range.')
    } catch {
      toastError('Error', 'Could not delete normal range.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-brand" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Normal Ranges</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Saved reference ranges for vitals and lab tests — auto-flags results as Low / Normal / High</p>
          </div>
        </div>
        {canWrite && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}><Plus size={14} className="mr-1" /> Add Range</Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {showForm && (
          <Card padding="md" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Test / Vital Name" value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="e.g. Fasting Blood Sugar, Blood Pressure - Systolic" required />
              <Input label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. mg/dL, mmHg" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Min (Normal)" type="number" value={minValue} onChange={(e) => setMinValue(e.target.value)} placeholder="e.g. 70" />
              <Input label="Max (Normal)" type="number" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} placeholder="e.g. 100" />
              <Select label="Applies To" value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}>
                <option value="ALL">Everyone</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-dark dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>Cancel</Button>
              <Button size="sm" loading={saving} onClick={handleSave}>Save Range</Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm dark:text-slate-400">Loading...</div>
        ) : ranges.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-slate-500">
            <Activity className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No normal ranges saved yet.</p>
          </div>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 dark:bg-slate-950 dark:border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Test / Vital</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Normal Range</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Applies To</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {ranges.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{r.testName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                      {r.minValue ?? '—'}–{r.maxValue ?? '—'} {r.unit ?? ''}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{r.gender === 'ALL' ? 'Everyone' : r.gender}</td>
                    <td className="px-4 py-3 text-right">
                      {canWrite && (
                        <button onClick={() => setDeleteTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded dark:text-slate-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Remove Normal Range"
        message={`Remove this normal range for "${deleteTarget?.testName}"?`}
        confirmLabel="Remove"
      />
    </div>
  )
}
